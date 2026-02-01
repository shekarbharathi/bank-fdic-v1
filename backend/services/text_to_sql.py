"""
Text-to-SQL service using LLM to convert natural language to SQL queries
"""
import logging
from typing import Optional
from backend.services.llm_providers import get_llm_provider, LLMProvider
from backend.services.schema_builder import SchemaBuilder
from backend.services.sql_validator import SQLValidator
from backend.services.database import DatabaseService

logger = logging.getLogger(__name__)


class TextToSQLService:
    """Service for converting natural language to SQL queries"""
    
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
    
    async def generate_sql(self, user_question: str) -> str:
        """
        Convert natural language question to SQL query
        
        Args:
            user_question: User's natural language question
            
        Returns:
            Validated SQL query string
        """
        await self._initialize_llm()
        
        # Build prompt with schema context
        schema_desc = await self._get_schema_context()
        examples = await self._get_example_queries()
        
        prompt = f"""You are a SQL expert for FDIC bank data. Convert the user's question to PostgreSQL SQL.

{schema_desc}

{examples}

User Question: {user_question}

Instructions:
- Generate ONLY the SQL query, no explanations or markdown formatting
- Use the most recent data available (use MAX(repdte) subqueries when needed)
- Always filter for active banks when appropriate (WHERE active = 1)
- Handle NULL values properly (use IS NOT NULL, COALESCE, NULLIF)
- Use proper JOINs to combine data from multiple tables
- Limit results appropriately (use LIMIT for top N queries)

SQL Query:"""
        
        try:
            # Generate SQL using LLM
            raw_response = await self.llm_provider.generate(prompt)
            
            # Extract SQL from markdown if present
            sql = self.sql_validator.extract_sql_from_markdown(raw_response)
            
            # Sanitize SQL
            sql = self.sql_validator.sanitize(sql)
            
            # Validate SQL
            is_valid, error_msg = self.sql_validator.validate(sql)
            
            if not is_valid:
                logger.warning(f"Generated SQL failed validation: {error_msg}")
                logger.warning(f"Generated SQL: {sql}")
                raise ValueError(f"Generated SQL failed safety validation: {error_msg}")
            
            logger.info(f"Generated SQL: {sql}")
            return sql
            
        except Exception as e:
            logger.error(f"Error generating SQL: {e}")
            raise
