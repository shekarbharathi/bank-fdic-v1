# Fixing Railway Backend Deployment

## The Problem

Railway was trying to build both frontend and backend because:
1. The root `nixpacks.toml` included both Python and Node.js
2. Railway detected both `requirements.txt` and `frontend/package.json`
3. The pip command path was incorrect in Nixpacks environment

## The Solution

I've created separate configuration files:
- **Backend**: Use `backend/nixpacks.toml` or set root directory to `backend/`
- **Frontend**: Use `frontend/nixpacks.toml` or set root directory to `frontend/`

## How to Fix Your Current Backend Deployment

### Option 1: Set Root Directory (Easiest)

1. Go to your **Backend** service in Railway
2. Click **Settings** → **Deploy**
3. Set **Root Directory** to: `backend`
4. Set **Start Command** to: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Save** and redeploy

Railway will now:
- Only see Python files in the `backend/` directory
- Use `requirements.txt` from the project root
- Not try to build the frontend

### Option 2: Use Dockerfile

1. Go to your **Backend** service in Railway
2. Click **Settings** → **Deploy**
3. Set **Root Directory** to: (empty or project root)
4. Railway will detect `Dockerfile.backend`
5. **Save** and redeploy

### Option 3: Copy nixpacks.toml to Backend Directory

If you want to use Nixpacks with explicit config:

1. The `backend/nixpacks.toml` file is already created
2. Set **Root Directory** to: `backend`
3. Railway will use `backend/nixpacks.toml`

## Recommended Configuration

**For Backend Service:**
- **Root Directory**: `backend`
- **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Build Command**: (leave empty, Railway auto-detects)

**For Frontend Service (when you deploy it):**
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run preview -- --host 0.0.0.0 --port $PORT`

## Environment Variables

Make sure these are set in your **Backend** service:

```
LLM_PROVIDER=OPENAI
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-3.5-turbo
DATABASE_URL=postgresql://... (automatically provided)
```

## After Fixing

1. **Redeploy** the backend service
2. Check logs to verify it starts correctly
3. Test: `https://your-backend.up.railway.app/api/health`

The deployment should now work correctly!
