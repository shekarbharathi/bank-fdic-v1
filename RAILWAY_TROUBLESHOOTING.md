# Railway Deployment Troubleshooting

## Common Issues and Solutions

### Issue: "There was an error deploying from source"

This generic error can have several causes. Here's how to fix it:

#### Solution 1: Check Root Directory Setting

**Most Common Fix:**

1. Go to your **Backend** service in Railway
2. Click **Settings** → **Deploy**
3. **IMPORTANT**: Set **Root Directory** to: `backend`
4. Set **Start Command** to: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Save** and redeploy

#### Solution 2: Check Build Logs

1. Go to your service → **Deployments** tab
2. Click on the failed deployment
3. Check the **Build Logs** for specific errors
4. Common issues:
   - Missing dependencies
   - Import errors
   - Python version mismatch
   - Port configuration issues

#### Solution 3: Verify requirements.txt Location

If Root Directory is set to `backend`, Railway needs to find `requirements.txt` one level up:

1. Make sure `requirements.txt` is in the project root (not in `backend/`)
2. The `backend/nixpacks.toml` references `../requirements.txt` which should work

#### Solution 4: Use Dockerfile Instead

If Nixpacks continues to fail:

1. Go to **Settings** → **Deploy**
2. Railway should auto-detect `Dockerfile.backend` in the project root
3. Set **Root Directory** to: (empty - project root)
4. Railway will use the Dockerfile instead of Nixpacks

#### Solution 5: Check Environment Variables

Make sure all required environment variables are set:

- `LLM_PROVIDER` = `OPENAI`
- `OPENAI_API_KEY` = (your key)
- `OPENAI_MODEL` = `gpt-3.5-turbo`
- `DATABASE_URL` = (automatically provided by Railway)

#### Solution 6: Verify Python Version

Railway's Nixpacks uses Python 3.9. If you need a different version:

1. Create `runtime.txt` in project root:
   ```
   python-3.9.6
   ```

Or use the Dockerfile which specifies the Python version.

### Issue: Import Errors

If you see `ModuleNotFoundError: No module named 'backend'`:

**This is now fixed!** The code has been updated to handle both:
- Railway deployment (backend as root directory)
- Local development (project root)

The imports will automatically work in both scenarios.

### Issue: Port Configuration

Railway automatically sets the `$PORT` environment variable. Make sure your start command uses it:

```
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Issue: Database Connection

If database connection fails:

1. Verify PostgreSQL service is running
2. Check that `DATABASE_URL` is available in backend service
3. Railway automatically provides `DATABASE_URL` to all services
4. The backend code automatically parses `DATABASE_URL`

### Issue: Build Timeout

If the build times out:

1. Check if `requirements.txt` has too many dependencies
2. Consider using a Dockerfile for faster builds
3. Railway free tier has build time limits

### Debugging Steps

1. **Check Build Logs**: Service → Deployments → Click failed deployment → View logs
2. **Check Runtime Logs**: Service → Deployments → Click deployment → View runtime logs
3. **Test Locally**: Make sure the app runs locally first
4. **Verify Files**: Ensure all necessary files are committed to Git

### Recommended Railway Configuration

**Backend Service:**
```
Root Directory: backend
Start Command: python -m uvicorn main:app --host 0.0.0.0 --port $PORT
Build Command: (leave empty - auto-detected)
```

**Environment Variables:**
```
LLM_PROVIDER=OPENAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
DATABASE_URL=(automatically provided)
```

### Still Having Issues?

1. Check Railway status: https://status.railway.app
2. Review Railway docs: https://docs.railway.app
3. Check Railway Discord for help
4. Verify your code works locally first
5. Try deploying with Dockerfile instead of Nixpacks
