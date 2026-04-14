"""
Field metadata API for UI grouping.
"""
import asyncio
import os
import sys
from decimal import Decimal

if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, HTTPException

try:
    from config import DB_CONNECTION
except ImportError:
    from backend.config import DB_CONNECTION

router = APIRouter()


def _run_query(sql: str, params=None):
    conn = psycopg2.connect(DB_CONNECTION)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(sql, params)
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()
    out = []
    for r in rows:
        d = dict(r)
        for k, v in d.items():
            if isinstance(v, Decimal):
                d[k] = float(v)
        out.append(d)
    return out


@router.get("/metadata/field-groups")
async def get_field_groups():
    """
    Return field metadata organized by groups for UI.
    Groups are ordered by group_id; fields within each group by display_order.
    """
    query = """
    SELECT
        group_id,
        group_name,
        COALESCE(
            json_agg(
                json_build_object(
                    'field_name', field_name,
                    'fdic_field_code', fdic_field_code,
                    'display_name', display_name,
                    'synopsis', synopsis,
                    'description', description,
                    'data_type', data_type,
                    'unit', unit,
                    'is_ratio', is_ratio,
                    'is_currency', is_currency,
                    'display_order', display_order
                ) ORDER BY display_order
            ) FILTER (WHERE field_name IS NOT NULL),
            '[]'::json
        ) AS fields
    FROM field_metadata
    GROUP BY group_id, group_name
    ORDER BY group_id
    """
    try:
        loop = asyncio.get_event_loop()
        rows = await loop.run_in_executor(None, _run_query, query)
        return {"groups": rows}
    except Exception as e:
        if "field_metadata" in str(e) and "does not exist" in str(e):
            raise HTTPException(
                status_code=503,
                detail="Field metadata not yet loaded. Run fdic_optimized_ingestion.py and apply migration 0003."
            ) from e
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/metadata/fields/{group_name}")
async def get_fields_by_group(group_name: str):
    """
    Get all fields in a specific group by group name (URL-encoded).
    Example: /api/metadata/fields/Size%20%26%20Balance%20Sheet
    """
    query = """
    SELECT field_name, fdic_field_code, display_name, synopsis, description, data_type, unit, is_ratio, is_currency
    FROM field_metadata
    WHERE group_name = %s
    ORDER BY display_order
    """
    try:
        loop = asyncio.get_event_loop()
        rows = await loop.run_in_executor(None, lambda: _run_query(query, (group_name,)))
        return {"group_name": group_name, "fields": rows}
    except Exception as e:
        if "field_metadata" in str(e) and "does not exist" in str(e):
            raise HTTPException(
                status_code=503,
                detail="Field metadata not yet loaded. Run fdic_optimized_ingestion.py and apply migration 0003."
            ) from e
        raise HTTPException(status_code=500, detail=str(e)) from e
