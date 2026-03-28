"""
Chat API endpoints
"""
import os
import sys

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


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Main chat endpoint that converts natural language to SQL and executes queries
    """
    import time
    start_time = time.time()
    
    try:
        db_service, text_to_sql_service, response_formatter = get_services()

        plan = await text_to_sql_service.generate_query_plan(request.message)
        sql_query = plan.sql

        results = await db_service.execute_query(sql_query)

        formatted_response = response_formatter.format_response(
            request.message, sql_query, results
        )

        execution_time = time.time() - start_time

        return ChatResponse(
            response=formatted_response,
            sql=sql_query,
            data=results,
            intent=plan.intent,
            visualization=plan.visualization,
            entities=plan.entities or None,
            execution_time=execution_time,
        )

    except OutOfScopeError:
        execution_time = time.time() - start_time
        return ChatResponse(
            response="I only answer questions about FDIC bank data. Try asking about banks, assets, deposits, or safety metrics.",
            error="out_of_scope",
            error_code="out_of_scope",
            execution_time=execution_time,
        )

    except Exception as e:
        execution_time = time.time() - start_time
        return ChatResponse(
            response=f"I encountered an error: {str(e)}",
            error=str(e),
            execution_time=execution_time,
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
