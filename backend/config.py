"""
Backend configuration for FDIC Chat Interface
"""
import os
from typing import Optional

# Database Configuration (reuse from parent config)
try:
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import DB_CONNECTION, DB_CONFIG
except ImportError:
    # Fallback if config.py not found
    DB_CONFIG = {
        'dbname': os.getenv('DB_NAME', 'fdic'),
        'user': os.getenv('DB_USER', 'bharathishekar'),
        'password': os.getenv('DB_PASSWORD', ''),
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5432')
    }
    DB_CONNECTION = (
        f"dbname={DB_CONFIG['dbname']} "
        f"user={DB_CONFIG['user']} "
        f"password={DB_CONFIG['password']} "
        f"host={DB_CONFIG['host']} "
        f"port={DB_CONFIG['port']}"
    )

# LLM Configuration
LLM_PROVIDER = os.getenv('LLM_PROVIDER', 'openai').upper()  # OPENAI, ANTHROPIC, LOCAL

# OpenAI Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')  # Default to gpt-3.5-turbo (more accessible)

# Anthropic Configuration
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-3-opus-20240229')

# Local Model Configuration (Ollama)
LOCAL_MODEL_ENDPOINT = os.getenv('LOCAL_MODEL_ENDPOINT', 'http://localhost:11434')
LOCAL_MODEL_NAME = os.getenv('LOCAL_MODEL_NAME', 'llama2')

# Query Limits
MAX_QUERY_EXECUTION_TIME = int(os.getenv('MAX_QUERY_EXECUTION_TIME', '30'))  # seconds
MAX_RESULT_ROWS = int(os.getenv('MAX_RESULT_ROWS', '1000'))

# CORS Configuration
CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',')
