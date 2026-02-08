"""
FastAPI application entry point for FDIC Bank Data Chat Interface
"""
import os
import sys
import logging

# Configure logging - set to DEBUG to see all debug logs in Railway
log_level = os.getenv("LOG_LEVEL", "DEBUG").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.DEBUG),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# Add current directory to path for imports when running from backend directory
if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Use relative imports when running from backend directory
try:
    from api import chat
    from config import CORS_ORIGINS
except ImportError:
    # Fallback to absolute imports (for local development from project root)
    from backend.api import chat
    from backend.config import CORS_ORIGINS

app = FastAPI(
    title="FDIC Bank Data Chat API",
    description="Chat interface for analyzing FDIC bank data",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
# Note: The router already defines /chat, so with prefix="/api" it becomes /api/chat
app.include_router(chat.router, prefix="/api", tags=["chat"])

# Debug: List all routes and CORS configuration on startup
@app.on_event("startup")
async def startup_event():
    import logging
    logger = logging.getLogger(__name__)
    logger.info("=== CORS Configuration ===")
    logger.info(f"CORS_ORIGINS: {CORS_ORIGINS}")
    logger.info("==========================")
    logger.info("=== Registered Routes ===")
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            methods = list(route.methods) if hasattr(route, 'methods') else ['N/A']
            logger.info(f"  {methods} {route.path}")
    logger.info("========================")

# Include data ingestion routes (optional - for triggering ingestion via API)
try:
    from api import data_ingestion
    app.include_router(data_ingestion.router, tags=["data"])
except ImportError:
    # Data ingestion endpoint not available
    pass


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "FDIC Bank Data Chat API", "version": "1.0.0"}
