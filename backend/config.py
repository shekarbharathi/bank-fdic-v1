"""
Backend configuration for FDIC Chat Interface
"""
import os
from typing import Optional
from urllib.parse import urlparse, unquote

# Database Configuration
# Railway provides DATABASE_URL, parse it if available
DATABASE_URL = os.getenv('DATABASE_URL', '')


def _parse_database_url(url: str) -> Optional[dict]:
    """
    Parse postgres/postgresql URLs including postgres://, query strings (?sslmode=require),
    and URL-encoded credentials. Returns dict with dbname, user, password, host, port or None.
    """
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("postgres", "postgresql"):
        return None
    if not parsed.hostname:
        return None
    path = (parsed.path or "").lstrip("/")
    dbname = path.split("?", 1)[0] if path else ""
    user = unquote(parsed.username) if parsed.username else ""
    password = unquote(parsed.password) if parsed.password else ""
    host = parsed.hostname
    port = str(parsed.port or 5432)
    if not all([dbname, user, host]):
        return None
    return {
        "dbname": dbname,
        "user": user,
        "password": password,
        "host": host,
        "port": port,
    }


if DATABASE_URL:
    parsed_cfg = _parse_database_url(DATABASE_URL)
    if parsed_cfg:
        DB_CONFIG = {
            "dbname": parsed_cfg["dbname"],
            "user": parsed_cfg["user"],
            "password": parsed_cfg["password"],
            "host": parsed_cfg["host"],
            "port": parsed_cfg["port"],
        }
        # psycopg2 accepts the URL directly (preserves ?sslmode= etc.)
        DB_CONNECTION = DATABASE_URL.strip()
    else:
        # Fallback to individual env vars only if URL is present but unparsable
        DB_CONFIG = {
            "dbname": os.getenv("DB_NAME", "fdic"),
            "user": os.getenv("DB_USER", "postgres"),
            "password": os.getenv("DB_PASSWORD", ""),
            "host": os.getenv("DB_HOST", "localhost"),
            "port": os.getenv("DB_PORT", "5432"),
        }
        DB_CONNECTION = (
            f"dbname={DB_CONFIG['dbname']} "
            f"user={DB_CONFIG['user']} "
            f"password={DB_CONFIG['password']} "
            f"host={DB_CONFIG['host']} "
            f"port={DB_CONFIG['port']}"
        )
else:
    # Try to import from parent config (local development)
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from config import DB_CONNECTION, DB_CONFIG
    except ImportError:
        # Final fallback
        DB_CONFIG = {
            'dbname': os.getenv('DB_NAME', 'fdic'),
            'user': os.getenv('DB_USER', 'postgres'),
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
# Railway frontend URL will be set via environment variable
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# Parse CORS_ORIGINS from environment variable or use defaults
# CORS_ORIGINS should be a comma-separated list of allowed origins
cors_origins_str = os.getenv('CORS_ORIGINS', '')
if cors_origins_str:
    # Use the provided CORS_ORIGINS, split by comma and strip whitespace
    CORS_ORIGINS = [origin.strip() for origin in cors_origins_str.split(',') if origin.strip()]
else:
    # Default: include FRONTEND_URL and localhost URLs for development
    CORS_ORIGINS = [
        FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
    ]

# Always include custom domain (bankstatz.com) to ensure it's allowed
# This ensures the domain works even if CORS_ORIGINS env var doesn't include it
required_origins = [
    'https://bankstatz.com',
    'https://www.bankstatz.com',
]

# Add required origins if not already present
for origin in required_origins:
    if origin not in CORS_ORIGINS:
        CORS_ORIGINS.append(origin)

# Remove duplicates while preserving order
CORS_ORIGINS = list(dict.fromkeys(CORS_ORIGINS))
