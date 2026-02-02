# Why VITE_API_URL is Still Undefined After Setting It

## The Root Cause

Even though you've set `VITE_API_URL` in Railway, it's still `undefined` in the built code because:

**Railway environment variables are available during Docker builds, BUT:**
1. **Build Timing**: If the build happened BEFORE you set the env var, it won't be in the built code
2. **Cached Builds**: Railway might be using a cached build from before you set the env var
3. **Build Context**: Railway needs to pass the env var to the Docker build context

## How to Fix

### Step 1: Verify the Env Var is Set

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Settings** → **Variables**
3. Verify `VITE_API_URL` is set to: `https://bank-fdic-v1-production.up.railway.app` (NO trailing slash)
4. **Save** if you made any changes

### Step 2: Clear Build Cache and Rebuild

**This is the most important step:**

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Deployments** tab
3. Look for **"Clear Build Cache"** or **"Redeploy"** button
4. Click it to force a fresh build
5. **Wait for the build to complete**

### Step 3: Check Build Logs

After rebuilding, check the build logs. You should see:
```
=== Build Environment Check ===
VITE_API_URL during build: https://bank-fdic-v1-production.up.railway.app
================================
```

If you see `VITE_API_URL during build: NOT SET`, Railway isn't passing the env var to the build.

### Step 4: Verify in Built Code

After rebuild, check the built JavaScript:
1. Open your frontend in browser
2. Open DevTools → **Sources** or **Network**
3. Find the JavaScript bundle (e.g., `client-*.js`)
4. Search for `VITE_API_URL`
5. It should show the actual URL, not `void 0` or `undefined`

## Why This Happens

Railway's Docker builds have access to environment variables, but:
- **Vite replaces env vars at BUILD TIME** - they're baked into the JavaScript bundle
- **If the build used a cache**, it might have the old (undefined) value
- **The env var must exist BEFORE the build runs**

## Alternative: Force Fresh Build

If clearing cache doesn't work:

1. **Temporarily change the Dockerfile** (add a comment or whitespace)
2. **Commit and push** to trigger a fresh build
3. Railway will rebuild from scratch with the env var available

Or:

1. **Delete the frontend service** (keep the database!)
2. **Recreate it** with `VITE_API_URL` already set
3. **This ensures the env var exists before any build**

## Expected Result

After a fresh build with `VITE_API_URL` set:
- ✅ Build logs show: `VITE_API_URL during build: https://bank-fdic-v1-production.up.railway.app`
- ✅ Built JavaScript has the correct URL
- ✅ Browser console shows: `VITE_API_URL (raw): https://bank-fdic-v1-production.up.railway.app`
- ✅ Requests go to backend, not frontend
- ✅ No more 405 errors

## If Still Not Working

If after clearing cache and rebuilding you still see `NOT SET` in build logs:

1. **Check Railway Service Settings**:
   - Settings → Deploy
   - Look for "Build Arguments" or "Build Environment Variables"
   - Some Railway setups need explicit configuration

2. **Try Setting in railway.toml**:
   ```toml
   [build]
   builder = "DOCKERFILE"
   
   [build.args]
   VITE_API_URL = "https://bank-fdic-v1-production.up.railway.app"
   ```

3. **Contact Railway Support**: If env vars aren't available during builds, it might be a Railway configuration issue.

The key is: **The build must happen AFTER the env var is set, and Railway must pass it to the Docker build context.**
