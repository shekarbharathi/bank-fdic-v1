# Railway Deployment Fix - Step by Step

## The Problem

Railway is giving "There was an error deploying from source" because:

1. **Path Issue**: When Root Directory is set to `backend`, Railway can't access `../requirements.txt`
2. **Config Conflict**: `railway.toml` had `cd backend` in start command, which fails when root is already `backend`
3. **Missing requirements.txt**: Railway needs `requirements.txt` in the backend directory when that's the root

## The Fix

I've made these changes:

1. ✅ Created `backend/requirements.txt` - Railway can now find dependencies
2. ✅ Updated `backend/nixpacks.toml` - Now uses `requirements.txt` (not `../requirements.txt`)
3. ✅ Updated `railway.toml` - Removed `cd backend` from start command
4. ✅ Fixed all imports - Code works when backend is root directory

## Step-by-Step Deployment Instructions

### Step 1: Commit and Push Changes

```bash
git add .
git commit -m "Fix Railway deployment: add backend/requirements.txt and update configs"
git push
```

### Step 2: Configure Railway Backend Service

1. Go to Railway Dashboard → Your Project → **Backend** service
2. Click **Settings** → **Deploy**
3. **IMPORTANT**: Set these values:
   - **Root Directory**: `backend` (must be exactly `backend`)
   - **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Build Command**: (leave empty - Railway will auto-detect)
4. Click **Save**

### Step 3: Verify Environment Variables

Go to **Variables** tab and make sure you have:

```
LLM_PROVIDER=OPENAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
DATABASE_URL=(automatically provided by Railway)
```

### Step 4: Redeploy

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Or Railway will auto-deploy after you push to GitHub

### Step 5: Check Build Logs

1. Click on the deployment
2. Check **Build Logs** - you should see:
   ```
   pip install -r requirements.txt
   ```
   (Not `../requirements.txt`)

3. Check **Runtime Logs** - you should see:
   ```
   INFO:     Uvicorn running on http://0.0.0.0:PORT
   ```

## Alternative: Use Dockerfile

If Nixpacks still fails, use the Dockerfile:

1. **Settings** → **Deploy**
2. Set **Root Directory**: (empty - project root)
3. Railway will detect `Dockerfile.backend`
4. The Dockerfile handles everything correctly

## Troubleshooting

### Still Getting Errors?

1. **Check Build Logs**: Look for specific error messages
2. **Verify Root Directory**: Must be exactly `backend` (not `./backend` or `/backend`)
3. **Check requirements.txt**: Make sure `backend/requirements.txt` exists
4. **Verify imports**: The code should work - imports are fixed for both scenarios

### Common Errors:

**Error: "pip: command not found"**
- Solution: Railway should install Python 3.9 automatically via nixpacks.toml

**Error: "ModuleNotFoundError: No module named 'backend'"**
- Solution: Already fixed! Imports work when backend is root directory

**Error: "requirements.txt not found"**
- Solution: Make sure `backend/requirements.txt` exists (I just created it)

**Error: "cd: backend: No such file or directory"**
- Solution: Don't use `cd backend` in start command when root directory is `backend`

## Verification

After successful deployment:

1. Check the service URL (e.g., `https://your-backend.up.railway.app`)
2. Visit the root endpoint: `https://your-backend.up.railway.app/`
3. Should see: `{"message": "FDIC Bank Data Chat API", "version": "1.0.0"}`
4. Test health endpoint: `https://your-backend.up.railway.app/api/health`

If you see these responses, deployment is successful! 🎉
