"""
Parse LLM responses: structured JSON query plans or legacy SQL-only text.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple, Union

logger = logging.getLogger(__name__)


class OutOfScopeError(Exception):
    """User question is not FDIC-related (LLM returned refusal JSON)."""


@dataclass
class QueryPlan:
    """Structured result from the LLM: intent, SQL, visualization metadata."""

    sql: str
    intent: str
    visualization: Dict[str, Any]
    entities: Dict[str, Any] = field(default_factory=dict)


def strip_json_from_markdown(text: str) -> str:
    """Extract JSON from ```json ... ``` or ``` ... ``` fences; else return stripped text."""
    if not text:
        return ""
    sql_pattern = r"```(?:json)?\s*(.*?)```"
    matches = re.findall(sql_pattern, text, re.DOTALL | re.IGNORECASE)
    if matches:
        return matches[0].strip()
    return text.strip()


def _is_out_of_scope(obj: Any) -> bool:
    return isinstance(obj, dict) and obj.get("error") == "out_of_scope"


def parse_structured_response(raw: str) -> QueryPlan:
    """
    Parse LLM response as JSON with intent, sql, visualization, entities.

    Raises:
        OutOfScopeError: refusal payload
        ValueError: invalid or incomplete JSON structure
    """
    stripped = strip_json_from_markdown(raw)
    try:
        obj = json.loads(stripped)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON from LLM: {e}") from e

    if _is_out_of_scope(obj):
        raise OutOfScopeError()

    if not isinstance(obj, dict):
        raise ValueError("LLM response JSON must be an object")

    sql = obj.get("sql")
    if not sql or not isinstance(sql, str):
        raise ValueError("Missing or invalid 'sql' in LLM JSON")

    intent = obj.get("intent")
    if not intent or not isinstance(intent, str):
        raise ValueError("Missing or invalid 'intent' in LLM JSON")

    viz = obj.get("visualization")
    if not isinstance(viz, dict):
        raise ValueError("Missing or invalid 'visualization' object in LLM JSON")

    vtype = viz.get("type")
    if not vtype or not isinstance(vtype, str):
        raise ValueError("visualization.type is required")

    title = viz.get("title")
    if title is not None and not isinstance(title, str):
        title = str(title)
    if title is None:
        title = ""

    config = viz.get("config")
    if config is not None and not isinstance(config, dict):
        raise ValueError("visualization.config must be an object when present")

    visualization: Dict[str, Any] = {
        "type": vtype,
        "title": title,
    }
    if config is not None:
        visualization["config"] = config

    entities = obj.get("entities")
    if entities is not None and not isinstance(entities, dict):
        raise ValueError("'entities' must be an object when present")

    return QueryPlan(
        sql=sql.strip(),
        intent=intent.strip(),
        visualization=visualization,
        entities=dict(entities) if entities else {},
    )


def try_parse_structured_response(raw: str) -> Optional[QueryPlan]:
    """Return QueryPlan if valid structured JSON; None if not (caller may fall back to SQL-only)."""
    try:
        return parse_structured_response(raw)
    except OutOfScopeError:
        raise
    except (ValueError, TypeError) as e:
        logger.debug("Structured parse skipped: %s", e)
        return None


def build_fallback_plan_from_sql(sql: str) -> QueryPlan:
    """Legacy path: SQL only, default browse_table intent."""
    return QueryPlan(
        sql=sql.strip(),
        intent="browse_table",
        visualization={
            "type": "table",
            "title": "",
            "config": {},
        },
        entities={},
    )
