"""
Configuration file for FDIC Bank Data Pipeline

This file contains your database credentials.
Never commit this file to version control!
"""

import os

# Database Configuration
# For fresh Homebrew PostgreSQL installations, the postgres user typically
# doesn't require a password for local connections. If you set a password,
# update the password field below.
DB_CONFIG = {
    'dbname': os.getenv('DB_NAME', 'fdic'),
    'user': os.getenv('DB_USER', 'bharathishekar'),  # Homebrew PostgreSQL uses macOS username
    'password': os.getenv('DB_PASSWORD', ''),  # Empty password for local connections
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
