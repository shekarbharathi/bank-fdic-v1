"""
FastAPI application entry point for FDIC Bank Data Chat Interface
"""
import os
import sys

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
app.include_router(chat.router, prefix="/api", tags=["chat"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "FDIC Bank Data Chat API", "version": "1.0.0"}
