# Railway Dockerfile Environment Variables - The Real Issue

## The Problem

You've set `VITE_API_URL` in Railway's environment variables, but it's still `undefined` in the built code. This is because:

**Railway doesn't automatically pass environment variables to Docker build context.**

When using a Dockerfile, Railway environment variables are available at **runtime**, but **NOT during the build step** unless explicitly configured.

## Why This Happens

1. **Docker Build Context**: Docker builds run in isolation. Environment variables from Railway aren't automatically available.
2. **Vite Needs Build-Time**: Vite replaces `import.meta.env.VITE_API_URL` during `npm run build`, which happens in the Docker build step.
3. **Railway Limitation**: Railway doesn't automatically pass env vars as Docker build arguments.

## Solutions

### Solution 1: Use Railway's Build-Time Env Vars (Recommended)

Railway should make env vars available during build, but there might be a timing issue. Try:

1. **Verify the env var is set BEFORE building**:
   - Go to Railway Dashboard → Frontend Service → Settings → Variables
   - Make sure `VITE_API_URL` is set to: `https://bank-fdic-v1-production.up.railway.app`
   - **Save**

2. **Clear build cache and rebuild**:
   - Go to Deployments tab
   - Look for "Clear Build Cache" option
   - Or delete and recreate the service
   - Trigger a fresh build

3. **Check build logs**:
   - After rebuild, check build logs
   - Look for: `VITE_API_URL during build: https://...`
   - If it shows "not set", Railway isn't passing it

### Solution 2: Use .env File in Git (Not Recommended for Secrets)

You could commit a `.env.production` file, but this exposes the URL in git:

```bash
# frontend/.env.production
VITE_API_URL=https://bank-fdic-v1-production.up.railway.app
```

**Don't do this** - it's not secure and the URL might change.

### Solution 3: Use Runtime Configuration (Workaround)

If build-time env vars don't work, we can use runtime configuration:

1. Create a config file that's loaded at runtime
2. Set the backend URL via a window variable or API endpoint
3. This is more complex but works around the build-time issue

### Solution 4: Check Railway Service Settings

Railway might have a setting to pass env vars to build:

1. Go to Railway Dashboard → Frontend Service
2. Settings → Deploy
3. Look for "Build Arguments" or "Build Environment Variables"
4. Some Railway setups require explicit configuration

## Most Likely Fix

The issue is probably that **the build happened before you set the env var**, or Railway isn't passing it to the build context.

**Try this:**

1. **Delete the frontend service** (or clear all deployments)
2. **Recreate it** with `VITE_API_URL` already set
3. **This ensures the env var exists before any build**

Or:

1. **Set the env var**
2. **Wait a few minutes**
3. **Manually trigger a redeploy** (not auto-deploy)
4. **This gives Railway time to register the env var**

## Verification

After rebuilding, check the built JavaScript file. Search for:
- `VITE_API_URL` - should show the actual URL, not `void 0`
- The console.log should show the backend URL

If it's still `undefined`, Railway isn't passing the env var to the build. In that case, we might need to use a different approach (runtime config or Railway-specific build configuration).
