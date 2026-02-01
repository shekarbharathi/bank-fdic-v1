# Railway Deployment Guide

This guide will help you deploy the FDIC Bank Data Chat Interface to Railway.

## Overview

Railway will host:
1. **PostgreSQL Database** - FDIC bank data
2. **Backend API** - FastAPI server
3. **Frontend** - React application

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your code should be pushed to GitHub
3. **LLM API Key**: OpenAI or Anthropic API key

## Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account if not already connected
5. Select your repository: `bank-fdic-v1`
6. Railway will create a new project

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will create a PostgreSQL database
4. **Important**: Note the database name (usually `railway` or `postgres`)

## Step 3: Configure Database Connection

Railway automatically provides a `DATABASE_URL` environment variable. The backend is configured to use it automatically.

**Optional**: You can also set individual variables:
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_HOST` - Database host
- `DB_PORT` - Database port (usually 5432)

## Step 4: Deploy Backend Service

### Option A: Using Railway's Auto-Detection (Recommended)

1. In your Railway project, click **"+ New"**
2. Select **"GitHub Repo"** → Select your repository
3. Railway will auto-detect it's a Python project
4. Configure the service:
   - **Root Directory**: `backend` (IMPORTANT: Set this to avoid building frontend)
   - **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Watch Paths**: `backend/**` (optional)
   
   **Note**: Setting Root Directory to `backend` ensures Railway only sees Python files and won't try to build the frontend.

### Option B: Using Dockerfile

1. In your Railway project, click **"+ New"**
2. Select **"GitHub Repo"** → Select your repository
3. Railway will detect `Dockerfile.backend`
4. Set the service name to "backend"

### Environment Variables for Backend

Add these environment variables in the backend service settings:

**Required:**
- `LLM_PROVIDER` = `OPENAI` (or `ANTHROPIC` or `LOCAL`)
- `OPENAI_API_KEY` = `your_openai_api_key` (if using OpenAI)
- `ANTHROPIC_API_KEY` = `your_anthropic_api_key` (if using Anthropic)
- `OPENAI_MODEL` = `gpt-3.5-turbo` (or `gpt-4` if you have access)

**Optional:**
- `FRONTEND_URL` = Your frontend Railway URL (will be set after frontend deployment)
- `CORS_ORIGINS` = Comma-separated list of allowed origins
- `MAX_QUERY_EXECUTION_TIME` = `30` (seconds)
- `MAX_RESULT_ROWS` = `1000`

**Database Connection:**
- Railway automatically provides `DATABASE_URL` - no need to set manually
- The backend will automatically parse and use it

### Generate Backend URL

1. After deployment, Railway will provide a URL like: `https://your-backend.up.railway.app`
2. Copy this URL - you'll need it for the frontend

## Step 5: Deploy Frontend Service

1. In your Railway project, click **"+ New"**
2. Select **"GitHub Repo"** → Select your repository again
3. Railway will detect it's a Node.js project (from `frontend/package.json`)
4. Configure the service:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview` (or use nginx with Dockerfile)
   - **Watch Paths**: `frontend/**`

### Environment Variables for Frontend

Add this environment variable:

- `VITE_API_URL` = Your backend Railway URL (e.g., `https://your-backend.up.railway.app`)

### Using Dockerfile for Frontend (Recommended for Production)

If you want to use the Dockerfile approach:

1. Railway will auto-detect `Dockerfile.frontend`
2. Set **Root Directory** to project root
3. Railway will build and serve with nginx

## Step 6: Ingest Data into Database

After the database and backend are deployed, you need to load the FDIC data.

### Option A: Using Railway CLI (Recommended)

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link to your project**:
   ```bash
   railway link
   ```
   Select your project when prompted.

4. **Run data ingestion**:
   ```bash
   railway run python railway_data_ingestion.py
   ```

### Option B: Using Railway's Web Console

1. Go to your backend service in Railway
2. Click on **"Deployments"** tab
3. Click **"New Deployment"** → **"Run Command"**
4. Enter command: `python railway_data_ingestion.py`
5. Make sure the working directory is set to project root

### Option C: Using a One-Time Service

1. Create a new service in Railway
2. Use the same GitHub repo
3. Set **Start Command** to: `python railway_data_ingestion.py`
4. Add all the same environment variables as backend
5. Deploy it once, let it run, then you can delete the service

## Step 7: Update CORS Settings

After both services are deployed:

1. Go to your **Backend** service settings
2. Add/update environment variable:
   - `FRONTEND_URL` = Your frontend Railway URL
   - `CORS_ORIGINS` = `https://your-frontend.up.railway.app,https://your-frontend.railway.app`

3. Redeploy the backend service

## Step 8: Verify Deployment

1. **Test Backend**:
   - Visit: `https://your-backend.up.railway.app/api/health`
   - Should return: `{"status":"healthy","database_connected":true,...}`

2. **Test Frontend**:
   - Visit: `https://your-frontend.up.railway.app`
   - Should show the chat interface

3. **Test Chat**:
   - Try asking: "Show me the top 10 banks by assets"

## Railway Service Structure

Your Railway project should have 3 services:

```
Railway Project: bank-fdic-v1
├── PostgreSQL (Database)
│   └── Provides: DATABASE_URL
├── Backend (FastAPI)
│   └── URL: https://your-backend.up.railway.app
└── Frontend (React)
    └── URL: https://your-frontend.up.railway.app
```

## Environment Variables Summary

### Backend Service
```
LLM_PROVIDER=OPENAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
FRONTEND_URL=https://your-frontend.up.railway.app
CORS_ORIGINS=https://your-frontend.up.railway.app
DATABASE_URL=postgresql://... (automatically provided)
```

### Frontend Service
```
VITE_API_URL=https://your-backend.up.railway.app
```

### PostgreSQL Service
- `DATABASE_URL` is automatically provided to all services
- No manual configuration needed

## Custom Domains

Railway provides free `.up.railway.app` domains. You can also add custom domains:

1. Go to your service settings
2. Click **"Settings"** → **"Domains"**
3. Add your custom domain
4. Follow Railway's DNS instructions

## Monitoring and Logs

- **Logs**: Click on any service → **"Deployments"** → View logs
- **Metrics**: Railway provides CPU, memory, and network metrics
- **Health Checks**: Backend has `/api/health` endpoint

## Troubleshooting

### Backend won't start
- Check logs in Railway dashboard
- Verify `DATABASE_URL` is set (should be automatic)
- Verify LLM API keys are set correctly
- Check that `PORT` environment variable is available (Railway sets this automatically)

### Frontend can't connect to backend
- Verify `VITE_API_URL` is set correctly
- Check CORS settings in backend
- Verify backend is running and accessible

### Database connection errors
- Verify PostgreSQL service is running
- Check that `DATABASE_URL` is available in backend service
- Verify database credentials in Railway dashboard

### Data ingestion fails
- Check that database is accessible
- Verify `DATABASE_URL` is set
- Check Railway logs for errors
- Ensure you have enough Railway credits (data ingestion uses resources)

## Cost Considerations

Railway pricing:
- **Free tier**: $5 credit/month
- **Hobby**: $20/month
- Database storage and compute usage count toward limits

**Tips to reduce costs:**
- Use `gpt-3.5-turbo` instead of `gpt-4` (cheaper)
- Limit data ingestion to recent years only
- Use Railway's sleep feature for development

## Updating the Application

Railway automatically deploys when you push to your GitHub repository's main branch.

To update:
1. Make changes locally
2. Commit and push to GitHub
3. Railway will automatically rebuild and redeploy

## Data Ingestion Updates

To update the database with new data:

```bash
railway run python fdic_incremental_pipeline.py
```

Or create a scheduled job in Railway (requires Pro plan) or use external cron service.

## Security Notes

- Never commit API keys or secrets to Git
- Use Railway's environment variables for all secrets
- Enable Railway's automatic HTTPS (enabled by default)
- Consider setting up Railway's authentication if needed

## Next Steps

1. Set up custom domains (optional)
2. Configure monitoring and alerts
3. Set up automated data updates (cron job or Railway scheduled tasks)
4. Consider adding authentication if needed
5. Set up backups for the database

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check Railway status: https://status.railway.app
