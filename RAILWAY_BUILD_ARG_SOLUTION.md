# Railway Dockerfile Build Arguments - Final Solution

## The Problem

Your build logs show:
```
RUN echo "VITE_API_URL during build: ${VITE_API_URL:-NOT SET}"
================================
```

The output shows `NOT SET`, meaning Railway isn't passing `VITE_API_URL` to the Docker build.

## Root Cause

**Railway doesn't automatically pass environment variables as Docker build arguments.**

When using a Dockerfile:
- Environment variables set in Railway dashboard are available at **runtime**
- They are **NOT** available during the **build step** unless explicitly declared as `ARG`

Since Vite replaces `import.meta.env.VITE_API_URL` at **build time** (during `npm run build`), it needs to be available during the Docker build.

## The Fix

I've updated the Dockerfile to explicitly accept `VITE_API_URL` as a build argument:

```dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
```

This tells Docker:
1. Accept `VITE_API_URL` as a build argument (`ARG`)
2. Make it available as an environment variable during build (`ENV`)

## However, Railway Still Needs to Pass It

Railway should automatically pass environment variables as build arguments, but if it doesn't, we have two options:

### Option 1: Use .env.production (Recommended - Most Reliable)

Since the backend URL isn't a secret, the simplest and most reliable solution is to commit a `.env.production` file:

1. **Create `frontend/.env.production`**:
   ```
   VITE_API_URL=https://bank-fdic-v1-production.up.railway.app
   ```

2. **Commit and push**:
   ```bash
   git add frontend/.env.production
   git commit -m "Add VITE_API_URL to .env.production for build"
   git push
   ```

3. **Vite automatically loads `.env.production` during build** - no Railway configuration needed!

This is the most reliable because:
- ✅ Works regardless of Railway's build arg passing
- ✅ Vite automatically loads `.env.production` during `npm run build`
- ✅ No dependency on Railway's build configuration
- ✅ The backend URL isn't a secret, so it's safe to commit

### Option 2: Try Railway Build Args (If Option 1 Doesn't Work)

After updating the Dockerfile with `ARG VITE_API_URL`:

1. **Verify env var is set**:
   - Railway Dashboard → Frontend Service → Settings → Variables
   - Confirm `VITE_API_URL` = `https://bank-fdic-v1-production.up.railway.app`

2. **Trigger fresh build**:
   - Deployments tab → Redeploy
   - Wait for build to complete

3. **Check build logs**:
   - Should now show: `VITE_API_URL during build: https://bank-fdic-v1-production.up.railway.app`
   - If still `NOT SET`, Railway isn't passing it, use Option 1

## Recommended: Use .env.production

I recommend using `.env.production` because:
- It's the most reliable approach
- Doesn't depend on Railway's build argument passing
- Vite is designed to use `.env.production` files
- The backend URL isn't sensitive, so it's safe to commit

## Next Steps

1. **Create `frontend/.env.production`** with the backend URL
2. **Commit and push**
3. **Railway will rebuild automatically**
4. **Check the built JavaScript** - it should now have the correct URL

After this, your frontend will correctly call the backend API!
