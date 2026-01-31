"""
Configuration file for FDIC Bank Data Pipeline

Copy this file to config.py and update with your actual credentials.
Never commit config.py to version control!
"""

import os

# Database Configuration
DB_CONFIG = {
    'dbname': os.getenv('DB_NAME', 'fdic'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'yourpassword'),
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432')
}

# Build connection string
DB_CONNECTION = (
    f"dbname={DB_CONFIG['dbname']} "
    f"user={DB_CONFIG['user']} "
    f"password={DB_CONFIG['password']} "
    f"host={DB_CONFIG['host']} "
    f"port={DB_CONFIG['port']}"
)

# FDIC API Configuration (optional)
API_KEY = os.getenv('FDIC_API_KEY', None)  # Get from https://banks.data.fdic.gov/apikey
