# Railway Dockerfile Build Arguments - The Missing Piece

## The Problem

You've set `VITE_API_URL` in Railway's environment variables, but the build logs show it's not available during the Docker build. This is because:

**Railway doesn't automatically pass environment variables as Docker build arguments.**

Docker builds run in isolation. Environment variables from Railway are available at **runtime**, but **NOT during the build step** unless you explicitly declare them as `ARG` in the Dockerfile.

## The Solution

I've updated the Dockerfile to explicitly accept `VITE_API_URL` as a build argument:

```dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
```

However, **Railway still needs to pass it as a build argument**. Railway should do this automatically, but if it doesn't, we need to configure it.

## Step 1: Verify Dockerfile is Updated

The Dockerfile now has:
```dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
```

This tells Docker to:
1. Accept `VITE_API_URL` as a build argument (`ARG`)
2. Make it available as an environment variable during build (`ENV`)

## Step 2: Railway Configuration

Railway should automatically pass environment variables as build arguments, but let's verify:

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Settings** → **Variables**
3. Verify `VITE_API_URL` is set to: `https://bank-fdic-v1-production.up.railway.app` (NO trailing slash)
4. **Save**

## Step 3: Trigger Fresh Build

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Deployments** tab
3. Click **Redeploy** (or push a commit)
4. **Wait for build to complete**

## Step 4: Check Build Logs

After rebuilding, check the build logs. You should now see:
```
=== Build Environment Check ===
VITE_API_URL during build: https://bank-fdic-v1-production.up.railway.app
================================
```

If you still see `NOT SET`, Railway isn't passing the env var as a build argument.

## If Still Not Working: Railway Build Args Configuration

If Railway still doesn't pass the env var, we might need to configure it explicitly. Some Railway setups require:

1. **Check Railway Service Settings**:
   - Settings → Deploy
   - Look for "Build Arguments" or "Docker Build Args"
   - Some Railway plans require explicit configuration

2. **Alternative: Use railway.toml**:
   ```toml
   [build]
   builder = "DOCKERFILE"
   dockerfilePath = "Dockerfile"
   
   [build.args]
   VITE_API_URL = "https://bank-fdic-v1-production.up.railway.app"
   ```

   However, this hardcodes the URL, which isn't ideal.

3. **Alternative: Use .env.production file**:
   Create `frontend/.env.production`:
   ```
   VITE_API_URL=https://bank-fdic-v1-production.up.railway.app
   ```
   
   **Note**: This exposes the URL in git, but it's not a secret, so it's acceptable.

## Recommended: Use .env.production (Simplest)

Since the backend URL isn't a secret, the simplest solution is to commit a `.env.production` file:

1. Create `frontend/.env.production`:
   ```
   VITE_API_URL=https://bank-fdic-v1-production.up.railway.app
   ```

2. Commit and push:
   ```bash
   git add frontend/.env.production
   git commit -m "Add VITE_API_URL to .env.production"
   git push
   ```

3. Railway will rebuild, and Vite will use this file during build.

This is the most reliable approach because:
- ✅ Vite automatically loads `.env.production` during build
- ✅ No dependency on Railway's build arg passing
- ✅ Works consistently across all environments
- ✅ The backend URL isn't a secret, so it's safe to commit

## Next Steps

1. **Try the updated Dockerfile first** (with `ARG VITE_API_URL`)
2. **Rebuild and check logs**
3. **If still `NOT SET`, use `.env.production` approach** (recommended)

The `.env.production` approach is the most reliable because it doesn't depend on Railway's build argument passing mechanism.
