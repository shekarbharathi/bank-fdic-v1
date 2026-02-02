# Fixing VITE_API_URL Not Available During Build

## The Problem

You've set `VITE_API_URL` in Railway, but the built JavaScript still shows it as `undefined`. This happens because:

**Vite environment variables are replaced at BUILD TIME, not runtime.**

If the build happened before you set the env var, or if Railway doesn't pass it to the build process, it will be `undefined` in the built code.

## Why This Happens

1. **Build Timing**: If you set `VITE_API_URL` after the frontend was already built, the old build still has `undefined`
2. **Dockerfile Issue**: The Dockerfile might not be receiving the env var during build
3. **Railway Build Process**: Railway needs to pass env vars to the Docker build process

## The Fix

I've updated the Dockerfile to explicitly accept `VITE_API_URL` as a build argument:

```dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
```

This ensures the env var is available during the build step.

## Steps to Fix

### Step 1: Commit and Push the Updated Dockerfile

```bash
git add frontend/Dockerfile
git commit -m "Fix Dockerfile to accept VITE_API_URL as build arg"
git push
```

### Step 2: Verify Environment Variable in Railway

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Settings** → **Variables**
3. Verify `VITE_API_URL` exists and is set to:
   ```
   https://bank-fdic-v1-production.up.railway.app
   ```
   (NO trailing slash)

### Step 3: Trigger a Fresh Build

**IMPORTANT**: You need to trigger a new build so Railway passes the env var:

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Deployments** tab
3. Click **Redeploy** (or wait for auto-deploy after git push)
4. **Wait for build to complete**

### Step 4: Verify the Fix

After rebuild, check the built JavaScript. It should show:
```javascript
window.console.log("VITE_API_URL (raw):","https://bank-fdic-v1-production.up.railway.app")
```

## Alternative: Check Railway Build Logs

After triggering a rebuild, check the build logs:

1. Go to Railway Dashboard → Frontend Service → Deployments
2. Click on the latest deployment
3. Check **Build Logs**
4. Look for the `npm run build` step
5. The build should complete successfully

If you see any errors about `VITE_API_URL`, Railway might not be passing it correctly.

## If Still Not Working

If after rebuilding you still see `undefined`:

1. **Check Railway Build Logs**: See if `VITE_API_URL` is mentioned
2. **Try Setting in railway.toml**: Some Railway setups need env vars in config files
3. **Check Docker Build Args**: Railway might need explicit build args configuration

## Expected Result

After the fix:
- ✅ `VITE_API_URL` is available during build
- ✅ Built JavaScript has the correct backend URL
- ✅ Requests go to backend, not frontend
- ✅ No more 405 errors

The key is that **the build must happen AFTER the env var is set AND the Dockerfile must accept it as a build argument**.
