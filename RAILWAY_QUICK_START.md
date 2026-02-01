# Railway Deployment - Quick Start Guide

## Quick Deployment Steps

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Add Railway deployment configuration"
git push origin main
```

### 2. Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **"Deploy from GitHub repo"**
3. Choose your `bank-fdic-v1` repository

### 3. Add PostgreSQL Database

1. In Railway project → **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway automatically provides `DATABASE_URL` to all services

### 4. Deploy Backend

1. **"+ New"** → **"GitHub Repo"** → Select your repo
2. Railway auto-detects Python project
3. **Settings** → **Deploy**:
   - **Root Directory**: `backend` (IMPORTANT: Set this to avoid building frontend)
   - **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Build Command**: (leave empty - Railway auto-detects)
4. **Variables** tab → Add:
   ```
   LLM_PROVIDER=OPENAI
   OPENAI_API_KEY=your_key_here
   OPENAI_MODEL=gpt-4o
   ```
5. Copy the backend URL (e.g., `https://backend-production-xxxx.up.railway.app`)

### 5. Deploy Frontend

1. **"+ New"** → **"GitHub Repo"** → Select your repo again
2. **Settings** → **Deploy**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview --host 0.0.0.0 --port $PORT`
3. **Variables** tab → Add:
   ```
   VITE_API_URL=https://your-backend-url.up.railway.app
   ```
4. Copy the frontend URL

### 6. Update Backend CORS

1. Go to **Backend** service → **Variables**
2. Add:
   ```
   FRONTEND_URL=https://your-frontend-url.up.railway.app
   CORS_ORIGINS=https://your-frontend-url.up.railway.app
   ```
3. Redeploy backend

### 7. Ingest Data

**Option A: Railway CLI (Recommended)**
```bash
npm install -g @railway/cli
railway login
railway link  # Select your project
railway run python railway_data_ingestion.py
```

**Option B: Railway Web Console**
1. Backend service → **Deployments** → **"Run Command"**
2. Command: `python railway_data_ingestion.py`
3. Working directory: project root

### 8. Test Your Deployment

- Frontend: `https://your-frontend.up.railway.app`
- Backend Health: `https://your-backend.up.railway.app/api/health`
- Try asking: "Show me the top 10 banks by assets"

## Environment Variables Checklist

### Backend Service
- [ ] `LLM_PROVIDER` = `OPENAI`
- [ ] `OPENAI_API_KEY` = `sk-...`
- [ ] `OPENAI_MODEL` = `gpt-3.5-turbo`
- [ ] `FRONTEND_URL` = `https://your-frontend.up.railway.app`
- [ ] `CORS_ORIGINS` = `https://your-frontend.up.railway.app`
- [ ] `DATABASE_URL` = (automatically provided by Railway)

### Frontend Service
- [ ] `VITE_API_URL` = `https://your-backend.up.railway.app`

## Troubleshooting

**Backend won't start?**
- Check logs in Railway dashboard
- Verify `DATABASE_URL` exists (should be automatic)
- Verify LLM API key is set

**Frontend can't connect?**
- Check `VITE_API_URL` matches backend URL
- Verify CORS settings in backend
- Check browser console for errors

**Database connection fails?**
- Verify PostgreSQL service is running
- Check `DATABASE_URL` is available
- Railway automatically provides this to all services

## Files Created

- `railway.json` - Railway service configuration
- `railway.toml` - Alternative Railway config
- `Dockerfile.backend` - Backend Docker image
- `Dockerfile.frontend` - Frontend Docker image
- `nginx.conf` - Nginx config for frontend
- `railway_data_ingestion.py` - Data loading script
- `RAILWAY_DEPLOYMENT.md` - Detailed deployment guide
- `.railwayignore` - Files to exclude from deployment

See `RAILWAY_DEPLOYMENT.md` for detailed instructions.
