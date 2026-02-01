# Steps to Run the Chat Application

## Prerequisites

1. **PostgreSQL Database**: Ensure PostgreSQL is running and the `fdic` database exists with data loaded
2. **Python 3.9+**: Already installed
3. **Node.js and npm**: Required for the frontend

## Step 1: Install Backend Dependencies

```bash
# Activate virtual environment
source venv/bin/activate

# Install/upgrade all Python dependencies
pip install -r requirements.txt
```

## Step 2: Configure LLM Provider

Choose one of the following LLM providers and set the appropriate environment variables:

### Option A: OpenAI (Recommended for best results)

```bash
export LLM_PROVIDER=OPENAI
export OPENAI_API_KEY=your_openai_api_key_here
export OPENAI_MODEL=gpt-4  # or gpt-3.5-turbo for faster/cheaper
```

### Option B: Anthropic Claude

```bash
export LLM_PROVIDER=ANTHROPIC
export ANTHROPIC_API_KEY=your_anthropic_api_key_here
export ANTHROPIC_MODEL=claude-3-opus-20240229  # or claude-3-sonnet-20240229
```

### Option C: Local Model (Ollama)

First, install and start Ollama:
```bash
# Install Ollama from https://ollama.ai
# Then pull a model:
ollama pull llama2  # or mistral, codellama, etc.
```

Then set environment variables:
```bash
export LLM_PROVIDER=LOCAL
export LOCAL_MODEL_ENDPOINT=http://localhost:11434
export LOCAL_MODEL_NAME=llama2  # or your chosen model
```

### Option D: Make Configuration Persistent

To avoid setting environment variables each time, you can add them to your shell profile:

```bash
# Add to ~/.zshrc (or ~/.bashrc for bash)
echo 'export LLM_PROVIDER=OPENAI' >> ~/.zshrc
echo 'export OPENAI_API_KEY=your_key_here' >> ~/.zshrc
echo 'export OPENAI_MODEL=gpt-4' >> ~/.zshrc

# Reload shell configuration
source ~/.zshrc
```

## Step 3: Verify Database Configuration

Ensure your database credentials are correct in `config.py`:

```python
DB_CONFIG = {
    'dbname': 'fdic',
    'user': 'bharathishekar',  # Your PostgreSQL username
    'password': '',  # Your password if set
    'host': 'localhost',
    'port': '5432'
}
```

Test database connection:
```bash
python -c "from config import DB_CONNECTION; import psycopg2; conn = psycopg2.connect(DB_CONNECTION); print('✓ Database connected')"
```

## Step 4: Start the Backend Server

### Option A: Using the provided script

```bash
./run_backend.sh
```

### Option B: Manual start

```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Navigate to backend directory
cd backend

# Start the server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will start on `http://localhost:8000`

You should see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Keep this terminal window open!**

## Step 5: Install Frontend Dependencies

Open a **new terminal window** and navigate to the project:

```bash
cd /Users/bharathishekar/coding/cursor/bank-fdic/bank-fdic-v1/frontend

# Install npm dependencies
npm install
```

## Step 6: Start the Frontend Development Server

```bash
# Still in the frontend directory
npm run dev
```

The frontend will start on `http://localhost:5173`

You should see output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Keep this terminal window open too!**

## Step 7: Open the Application

1. Open your web browser
2. Navigate to: `http://localhost:5173`
3. You should see the chat interface

## Step 8: Test the Application

Try asking some questions:

- "Which banks have the best capital ratios?"
- "Show me the top 10 banks by assets"
- "How has JPMorgan's deposit growth trended?"
- "What banks are in California with ROA greater than 1%?"

## Troubleshooting

### Backend Issues

**Error: "Module not found"**
```bash
# Make sure virtual environment is activated
source venv/bin/activate
pip install -r requirements.txt
```

**Error: "Database connection failed"**
- Check PostgreSQL is running: `brew services list` (macOS) or `systemctl status postgresql` (Linux)
- Verify credentials in `config.py`
- Test connection manually: `psql -d fdic`

**Error: "LLM provider not configured"**
- Check environment variables are set: `echo $LLM_PROVIDER`
- Verify API key is set: `echo $OPENAI_API_KEY` (or ANTHROPIC_API_KEY)
- For local models, ensure Ollama is running: `ollama list`

**Error: "Port 8000 already in use"**
```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9

# Or use a different port
python -m uvicorn main:app --reload --port 8001
```

### Frontend Issues

**Error: "Cannot connect to backend"**
- Check backend is running on port 8000
- Check browser console for CORS errors
- Verify `VITE_API_URL` in frontend/.env (if set) matches backend URL

**Error: "npm install fails"**
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Port 5173 already in use**
```bash
# Vite will automatically use the next available port
# Or specify a different port:
npm run dev -- --port 3000
```

### General Issues

**Chat not responding**
- Check backend terminal for errors
- Check browser console (F12) for errors
- Verify LLM API key is valid and has credits
- Check database has data: `psql fdic -c "SELECT COUNT(*) FROM institutions;"`

**Slow responses**
- LLM API calls can take 5-30 seconds depending on provider
- Check your internet connection
- For local models, ensure you have enough RAM/VRAM

## Quick Start (All Commands)

Here's a quick reference for starting everything:

**Terminal 1 (Backend):**
```bash
cd /Users/bharathishekar/coding/cursor/bank-fdic/bank-fdic-v1
source venv/bin/activate
export LLM_PROVIDER=OPENAI
export OPENAI_API_KEY=your_key_here
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd /Users/bharathishekar/coding/cursor/bank-fdic/bank-fdic-v1/frontend
npm run dev
```

**Browser:**
- Open `http://localhost:5173`

## Stopping the Application

1. **Stop Frontend**: Press `Ctrl+C` in the frontend terminal
2. **Stop Backend**: Press `Ctrl+C` in the backend terminal
3. **Stop Database** (if needed): `brew services stop postgresql@15` (macOS)

## Production Deployment

For production, you'll want to:

1. Build the frontend: `cd frontend && npm run build`
2. Serve the built files with a production server (nginx, etc.)
3. Run backend with a production ASGI server (gunicorn with uvicorn workers)
4. Set up proper environment variable management
5. Configure CORS for your domain
6. Set up SSL/HTTPS

See `ARCHITECTURE.md` for more deployment considerations.
