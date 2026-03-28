"""
Text-to-SQL service using LLM to convert natural language to SQL queries
and structured visualization intent (JSON envelope).
"""
import os
import sys

# Handle imports for both Railway (backend as root) and local dev (project root)
if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, backend_dir)

import json
import logging
from typing import Optional

# Try relative imports first (for Railway), fallback to absolute (for local dev)
try:
    from services.llm_providers import get_llm_provider, LLMProvider
    from services.schema_builder import SchemaBuilder
    from services.sql_validator import SQLValidator
    from services.database import DatabaseService
    from services.bank_name_mapping import get_bank_name_mapping_text, get_bank_name_instructions
    from services.llm_response_parser import (
        QueryPlan,
        OutOfScopeError,
        parse_structured_response,
        build_fallback_plan_from_sql,
    )
except ImportError:
    from backend.services.llm_providers import get_llm_provider, LLMProvider
    from backend.services.schema_builder import SchemaBuilder
    from backend.services.sql_validator import SQLValidator
    from backend.services.database import DatabaseService
    from backend.services.bank_name_mapping import get_bank_name_mapping_text, get_bank_name_instructions
    from backend.services.llm_response_parser import (
        QueryPlan,
        OutOfScopeError,
        parse_structured_response,
        build_fallback_plan_from_sql,
    )

logger = logging.getLogger(__name__)


INTENT_JSON_RULES = """
## RESPONSE FORMAT (REQUIRED)

Respond with ONLY a single JSON object (no markdown outside the JSON). Shape:

{
  "intent": "<intent_type>",
  "sql": "<valid PostgreSQL SELECT only>",
  "visualization": {
    "type": "<viz_type>",
    "title": "<short human-readable title>",
    "config": { }
  },
  "entities": { }
}

### intent_type (choose one)

- browse_table — DEFAULT for lists, filters, and rankings: "top N banks", "top N by assets", "show banks in CA",
  "banks with ROA above X%", "highest ROA banks" (as a ranked table), "safest banks" when the user wants a list to browse.
  Use browse_table whenever the answer is "show me banks (rows) sorted or filtered by a metric" — not a distribution analysis.
- scalar — the user wants **one simple number** (a count, sum, average, or other single aggregate). SQL should return one row with one numeric column.
  Use scalar for: "how many banks in total", "how many active banks in US", "how many inactive banks",
  "how many banks in California", "how many banks in Texas", "total of all assets of all banks",
  "total of all deposits of banks in California", and similar **how many / total / sum** questions.
  Set visualization.type to "scalar". Do NOT use scalar when the user wants a list of banks (that is browse_table).
- compare_banks — user compares 2–4 named banks (keywords: compare, vs, versus, difference between)
- trend_tracker — time series / over time / history / growth / since YEAR
- metric_explorer — ONLY when the question is clearly about **distribution, landscape, or system-wide patterns** across many banks
  (not a simple ranked list). Examples: "What's the ROA distribution across banks?", "credit card lending landscape",
  "How much do banks lend in credit cards (overall / across the industry)?", "How safe are US banks?" (as a pattern/distribution),
  "What makes a bank safe?" (exploratory / multi-faceted view). Do NOT use metric_explorer for plain "top 5 banks",
  "top 5 by assets", or "show me high ROA banks" — those are browse_table.
- state_explorer — the user asks for a **banking overview or landscape in a specific state** (holistic picture: mix of
  stats, context, or how banking looks in that state — not merely a single count). Examples: "Texas banking landscape",
  "New York banks overview", "California banking market overview". Set visualization.type to "state_overview".
  If the question is only "how many banks in [state]" or "total deposits in [state]" with no overview wording, prefer **scalar**
  (one number). If they want a **list of banks** in a state, use **browse_table**.
- peer_group — similar banks, peers, comparable to, like [bank]

### visualization.type

Mirror intent when possible: "table", "scalar", "comparison", "time_series", "metric_distribution",
"state_overview", "peer_comparison". Use "table" for browse_table. Use "metric_distribution" only with intent
metric_explorer (not for ordinary top-N / ranked tables).

### visualization.config

Optional keys depending on intent, e.g. columns, metrics, state, chart_type, limit — only if helpful.

### entities

Extract useful slots: state, limit, bank names, metric names, time range — as strings/numbers.

### REFUSAL

If the question is NOT about FDIC banking data, respond with ONLY:
{"error":"out_of_scope"}

### SQL RULES

- SELECT only; use schema tables from the context (institutions, financials, financials_kv, fdic_field_dictionary, etc.)
- Include columns the user asked for (metrics) in SELECT
- Most recent quarter: use MAX(repdte) subqueries where appropriate
- Active banks: filter institutions.active = 1 when listing banks
- Bank names: ILIKE '%Name%'
- NULL handling: IS NOT NULL / COALESCE / NULLIF as needed
- LIMIT for large lists
"""


class TextToSQLService:
    """Service for converting natural language to SQL queries and visualization intent"""

    def __init__(self, db_service: DatabaseService):
        self.db_service = db_service
        self.schema_builder = SchemaBuilder(db_service)
        self.sql_validator = SQLValidator()
        self.llm_provider: Optional[LLMProvider] = None
        self._schema_description: Optional[str] = None
        self._example_queries: Optional[str] = None

    async def _initialize_llm(self):
        """Lazy initialization of LLM provider"""
        if self.llm_provider is None:
            try:
                self.llm_provider = get_llm_provider()
            except Exception as e:
                logger.error(f"Failed to initialize LLM provider: {e}")
                raise

    async def _get_schema_context(self) -> str:
        """Get schema description (cached)"""
        if self._schema_description is None:
            self._schema_description = await self.schema_builder.get_schema_description()
        return self._schema_description

    async def _get_example_queries(self) -> str:
        """Get example queries (cached)"""
        if self._example_queries is None:
            self._example_queries = await self.schema_builder.get_example_queries()
        return self._example_queries

    def _validate_and_sanitize_sql(self, sql: str) -> str:
        sql = self.sql_validator.extract_sql_from_markdown(sql)
        sql = self.sql_validator.sanitize(sql)
        is_valid, error_msg = self.sql_validator.validate(sql)
        if not is_valid:
            raise ValueError(f"Generated SQL failed safety validation: {error_msg}")
        return sql

    def _plan_from_raw_llm_response(self, raw_response: str) -> QueryPlan:
        """Parse JSON envelope or fall back to SQL-only legacy response."""
        raw_stripped = raw_response.strip()

        # Fast path: refusal JSON without full parse
        if '"out_of_scope"' in raw_response and '"error"' in raw_response:
            try:
                probe = json.loads(raw_stripped)
                if isinstance(probe, dict) and probe.get("error") == "out_of_scope":
                    raise OutOfScopeError()
            except json.JSONDecodeError:
                pass

        try:
            return parse_structured_response(raw_response)
        except OutOfScopeError:
            raise
        except (ValueError, TypeError) as e:
            logger.info("Structured JSON parse failed, trying legacy SQL-only: %s", e)
            sql = self._validate_and_sanitize_sql(raw_response)
            return build_fallback_plan_from_sql(sql)

    async def generate_query_plan(self, user_question: str) -> QueryPlan:
        """
        Convert natural language to a QueryPlan (SQL + intent + visualization metadata).

        Raises:
            OutOfScopeError: question not FDIC-related
            ValueError: SQL validation failed
        """
        await self._initialize_llm()

        schema_desc = await self._get_schema_context()
        examples = await self._get_example_queries()
        bank_mapping = get_bank_name_mapping_text()
        bank_instructions = get_bank_name_instructions()

        prompt = f"""You are a PostgreSQL expert for FDIC bank data. Classify the user's intent and return ONLY valid JSON (no prose before or after).

{schema_desc}

{bank_mapping}

{bank_instructions}

{examples}

{INTENT_JSON_RULES}

User Question: {user_question}

JSON response:"""

        logger.debug("LLM prompt length: %s", len(prompt))

        raw_response = await self.llm_provider.generate(prompt)
        logger.debug("LLM raw response length: %s", len(raw_response or ""))

        plan = self._plan_from_raw_llm_response(raw_response)

        # Validate SQL inside accepted plan
        sql = self._validate_and_sanitize_sql(plan.sql)
        plan = QueryPlan(
            sql=sql,
            intent=plan.intent,
            visualization=dict(plan.visualization),
            entities=dict(plan.entities),
        )

        logger.info("Query plan intent=%s sql=%s...", plan.intent, plan.sql[:120])
        return plan

    async def generate_sql(self, user_question: str) -> str:
        """Backward-compatible: return only the SQL string."""
        plan = await self.generate_query_plan(user_question)
        return plan.sql
