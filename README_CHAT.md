# FDIC Bank Data Chat Interface

A chat-based web application for analyzing FDIC bank data using natural language queries.

## Features

- Natural language to SQL conversion using LLMs
- Real-time chat interface
- Support for multiple LLM providers (OpenAI, Anthropic, Local)
- SQL query safety validation
- Formatted responses with data tables
- Financial metrics calculations

## Quick Start

### 1. Install Backend Dependencies

```bash
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure LLM Provider

Set environment variables for your chosen LLM provider:

**OpenAI:**
```bash
export LLM_PROVIDER=OPENAI
export OPENAI_API_KEY=your_api_key_here
export OPENAI_MODEL=gpt-4  # or gpt-3.5-turbo
```

**Anthropic:**
```bash
export LLM_PROVIDER=ANTHROPIC
export ANTHROPIC_API_KEY=your_api_key_here
export ANTHROPIC_MODEL=claude-3-opus-20240229
```

**Local (Ollama):**
```bash
export LLM_PROVIDER=LOCAL
export LOCAL_MODEL_ENDPOINT=http://localhost:11434
export LOCAL_MODEL_NAME=llama2
```

### 3. Start Backend Server

```bash
./run_backend.sh
```

Or manually:
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### 4. Start Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 5. Use the Chat Interface

Open your browser and navigate to `http://localhost:5173`

Try asking questions like:
- "Which banks have the best capital ratios?"
- "How has JPMorgan's deposit growth trended?"
- "Show me the top 10 banks by assets"
- "What banks are in California with ROA greater than 1%?"

## API Endpoints

### POST /api/chat
Send a chat message and get a response with SQL query and results.

**Request:**
```json
{
  "message": "Which banks have the best capital ratios?",
  "conversation_id": "optional"
}
```

**Response:**
```json
{
  "response": "Formatted natural language response...",
  "sql": "SELECT ...",
  "data": [...],
  "execution_time": 1.23
}
```

### GET /api/health
Health check endpoint.

### GET /api/schema
Get database schema information.

## Configuration

All configuration is done via environment variables. See `backend/config.py` for available options.

Key settings:
- `LLM_PROVIDER`: OPENAI, ANTHROPIC, or LOCAL
- `MAX_QUERY_EXECUTION_TIME`: Maximum query execution time in seconds (default: 30)
- `MAX_RESULT_ROWS`: Maximum rows to return (default: 1000)
- `CORS_ORIGINS`: Comma-separated list of allowed origins

## Security

- SQL injection prevention through validation
- Read-only database queries (SELECT only)
- Query timeout protection
- Result size limits
- Table whitelist validation

## Troubleshooting

### Backend won't start
- Check that PostgreSQL is running
- Verify database credentials in `config.py`
- Ensure all Python dependencies are installed

### LLM provider errors
- Verify API keys are set correctly
- Check that the provider package is installed (openai, anthropic)
- For local models, ensure Ollama is running

### Frontend can't connect to backend
- Check CORS settings in `backend/config.py`
- Verify backend is running on port 8000
- Check browser console for errors

## Development

### Backend Structure
```
backend/
├── main.py              # FastAPI app
├── config.py            # Configuration
├── api/
│   └── chat.py          # Chat endpoints
├── services/
│   ├── database.py      # Database operations
│   ├── llm_providers.py # LLM abstraction
│   ├── text_to_sql.py   # Text-to-SQL conversion
│   ├── sql_validator.py # SQL safety validation
│   ├── schema_builder.py # Schema context
│   ├── response_formatter.py # Response formatting
│   └── metrics_calculator.py # Financial metrics
└── models/
    └── chat.py          # Pydantic models
```

### Frontend Structure
```
frontend/
├── src/
│   ├── App.jsx          # Main app component
│   ├── components/
│   │   ├── ChatWindow.jsx
│   │   ├── MessageList.jsx
│   │   ├── MessageInput.jsx
│   │   ├── SQLDisplay.jsx
│   │   └── DataTable.jsx
│   └── api/
│       └── client.js    # API client
```

## License

Same as main project.
