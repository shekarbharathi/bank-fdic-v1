#!/bin/bash
# Script to run the FastAPI backend server

cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Install/upgrade dependencies
pip install -q -r requirements.txt

# Run the backend server from project root (so backend module can be imported)
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
