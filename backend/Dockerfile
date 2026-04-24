# Backend image when Railway (or Docker) build context is the `backend/` directory.
# For a monorepo build from the repository root, use ../Dockerfile.backend instead.
FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install --no-cache-dir -r requirements.txt

# Entire service root (backend package) is the context
COPY . .

EXPOSE 8000

CMD python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
