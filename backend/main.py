"""
FastAPI application entry point for FDIC Bank Data Chat Interface
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
