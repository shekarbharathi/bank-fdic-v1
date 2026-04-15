"""
Chat API endpoints
"""
import logging
import os
import sys
from uuid import uuid4
from typing import Optional

# Handle imports for both Railway (backend as root) and local dev (project root)
if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, backend_dir)

from fastapi import APIRouter, HTTPException

# Try relative imports first (for Railway), fallback to absolute (for local dev)
try:
    from models.chat import ChatRequest, ChatResponse, ExpandRequest, ExpandResponse, HealthResponse
    from services.database import DatabaseService
    from services.text_to_sql import TextToSQLService
    from services.response_formatter import ResponseFormatter
    from services.llm_providers import get_llm_provider
    from services.llm_response_parser import OutOfScopeError
    from config import LLM_PROVIDER
except ImportError:
    from backend.models.chat import ChatRequest, ChatResponse, ExpandRequest, ExpandResponse, HealthResponse
    from backend.services.database import DatabaseService
    from backend.services.text_to_sql import TextToSQLService
    from backend.services.response_formatter import ResponseFormatter
    from backend.services.llm_providers import get_llm_provider
    from backend.services.llm_response_parser import OutOfScopeError
    from backend.config import LLM_PROVIDER

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize services (will be initialized on first request)
_db_service = None
_text_to_sql_service = None
_response_formatter = None


def get_services():
    """Lazy initialization of services"""
    global _db_service, _text_to_sql_service, _response_formatter
    
    if _db_service is None:
        _db_service = DatabaseService()
        _text_to_sql_service = TextToSQLService(_db_service)
        _response_formatter = ResponseFormatter()
    
    return _db_service, _text_to_sql_service, _response_formatter


async def persist_llm_query_event(
    db_service: DatabaseService,
    *,
    response_instance_id: str,
    session_id: Optional[str],
    user_query: str,
    llm_sql: Optional[str],
    llm_intent: Optional[str],
    llm_visualization_type: Optional[str],
    llm_visualization_title: Optional[str],
    data_row_count: int,
    column_count: int,
    status: str,
    error_message: Optional[str],
) -> None:
    insert_sql = """
        INSERT INTO llm_query_events (
            response_instance_id,
            session_id,
            user_query,
            llm_sql,
            llm_intent,
            llm_visualization_type,
            llm_visualization_title,
            data_row_count,
            column_count,
            status,
            error_message
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    await db_service.execute_write(
        insert_sql,
        (
            response_instance_id,
            session_id,
            user_query,
            llm_sql,
            llm_intent,
            llm_visualization_type,
            llm_visualization_title,
            data_row_count,
            column_count,
            status,
            error_message,
        ),
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Main chat endpoint that converts natural language to SQL and executes queries
    """
    import time
    start_time = time.time()
    
    response_instance_id = str(uuid4())

    try:
        db_service, text_to_sql_service, response_formatter = get_services()

        plan = await text_to_sql_service.generate_query_plan(request.message)
        sql_query = plan.sql

        results = await db_service.execute_query(sql_query)

        intent_norm = (plan.intent or "").lower().strip()
        if intent_norm == "trend_tracker" and not results:
            logger.warning(
                "trend_tracker returned 0 rows sql=%s entities=%s",
                sql_query[:500],
                plan.entities,
            )
            bank_name = plan.entities.get("bank_name") if plan.entities else None
            if isinstance(bank_name, str) and bank_name.strip():
                try:
                    retry_plan = await text_to_sql_service.generate_trend_retry_plan(
                        request.message,
                        sql_query,
                        plan.entities or {},
                    )
                    sql_retry = retry_plan.sql
                    results_retry = await db_service.execute_query(sql_retry)
                    if results_retry:
                        sql_query = sql_retry
                        results = results_retry
                        logger.info(
                            "trend_tracker retry succeeded: %s rows",
                            len(results),
                        )
                    else:
                        logger.warning(
                            "trend_tracker retry still 0 rows sql=%s",
                            sql_retry[:500],
                        )
                except Exception as e:
                    logger.warning("trend_tracker retry failed: %s", e, exc_info=True)

        formatted_response = response_formatter.format_response(
            request.message, sql_query, results, intent=plan.intent
        )

        execution_time = time.time() - start_time
        visualization = plan.visualization or {}
        column_count = len(results[0].keys()) if results else 0

        try:
            await persist_llm_query_event(
                db_service,
                response_instance_id=response_instance_id,
                session_id=request.conversation_id,
                user_query=request.message,
                llm_sql=sql_query,
                llm_intent=plan.intent,
                llm_visualization_type=visualization.get("type"),
                llm_visualization_title=visualization.get("title"),
                data_row_count=len(results),
                column_count=column_count,
                status="success",
                error_message=None,
            )
        except Exception as telemetry_error:
            logger.warning("Failed to persist llm_query_events (success path): %s", telemetry_error)

        return ChatResponse(
            response=formatted_response,
            sql=sql_query,
            data=results,
            intent=plan.intent,
            visualization=plan.visualization,
            entities=plan.entities or None,
            execution_time=execution_time,
            response_instance_id=response_instance_id,
        )

    except OutOfScopeError:
        execution_time = time.time() - start_time
        try:
            db_service, _, _ = get_services()
            await persist_llm_query_event(
                db_service,
                response_instance_id=response_instance_id,
                session_id=request.conversation_id,
                user_query=request.message,
                llm_sql=None,
                llm_intent=None,
                llm_visualization_type=None,
                llm_visualization_title=None,
                data_row_count=0,
                column_count=0,
                status="error",
                error_message="out_of_scope",
            )
        except Exception as telemetry_error:
            logger.warning("Failed to persist llm_query_events (out_of_scope path): %s", telemetry_error)
        return ChatResponse(
            response="I only answer questions about FDIC bank data. Try asking about banks, assets, deposits, or safety metrics.",
            error="out_of_scope",
            error_code="out_of_scope",
            execution_time=execution_time,
            response_instance_id=response_instance_id,
        )

    except Exception as e:
        execution_time = time.time() - start_time
        try:
            db_service, _, _ = get_services()
            await persist_llm_query_event(
                db_service,
                response_instance_id=response_instance_id,
                session_id=request.conversation_id,
                user_query=request.message,
                llm_sql=None,
                llm_intent=None,
                llm_visualization_type=None,
                llm_visualization_title=None,
                data_row_count=0,
                column_count=0,
                status="error",
                error_message=str(e),
            )
        except Exception as telemetry_error:
            logger.warning("Failed to persist llm_query_events (exception path): %s", telemetry_error)
        return ChatResponse(
            response=f"I encountered an error: {str(e)}",
            error=str(e),
            execution_time=execution_time,
            response_instance_id=response_instance_id,
        )


EXPAND_SYSTEM = """You are a query rewriter for FDIC bank data. Given the user's natural language query, return an expanded version that increments any result count by 5 (e.g. "top 5" -> "top 10", "top 10" -> "top 15", "limit 20" -> "limit 25"). Preserve all other aspects. Respond with ONLY the expanded query text, nothing else."""


@router.post("/expand-query", response_model=ExpandResponse)
async def expand_query_endpoint(request: ExpandRequest):
    """Expand a bank query by incrementing result count by 5"""
    try:
        llm = get_llm_provider()
        expanded = await llm.generate_with_system(EXPAND_SYSTEM, request.message.strip())
        expanded = (expanded or "").strip()
        if not expanded:
            raise ValueError("Empty expand response")
        return ExpandResponse(expanded_query=expanded)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        db_service = DatabaseService()
        db_connected = await db_service.check_connection()
    except Exception:
        db_connected = False
    
    return HealthResponse(
        status="healthy" if db_connected else "unhealthy",
        database_connected=db_connected,
        llm_provider=LLM_PROVIDER
    )


@router.get("/schema")
async def get_schema():
    """Get database schema information"""
    try:
        db_service = DatabaseService()
        schema = await db_service.get_schema_info()
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
