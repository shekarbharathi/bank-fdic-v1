"""
Chat API endpoints
"""
from fastapi import APIRouter, HTTPException
from backend.models.chat import ChatRequest, ChatResponse, HealthResponse
from backend.services.database import DatabaseService
from backend.services.text_to_sql import TextToSQLService
from backend.services.response_formatter import ResponseFormatter
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
        
        # Convert natural language to SQL
        sql_query = await text_to_sql_service.generate_sql(request.message)
        
        # Execute query
        results = await db_service.execute_query(sql_query)
        
        # Format response
        formatted_response = response_formatter.format_response(
            request.message, sql_query, results
        )
        
        execution_time = time.time() - start_time
        
        return ChatResponse(
            response=formatted_response,
            sql=sql_query,
            data=results,
            execution_time=execution_time
        )
    
    except Exception as e:
        execution_time = time.time() - start_time
        return ChatResponse(
            response=f"I encountered an error: {str(e)}",
            error=str(e),
            execution_time=execution_time
        )


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
