# Fixing 405 Error - The Real Problem

## What's Happening

Looking at your built JavaScript, I can see:
```javascript
window.console.log("VITE_API_URL (raw):",void 0)  // undefined!
window.console.log("API_BASE_URL (final):","(empty - using relative path)")
```

**The Problem:**
1. `VITE_API_URL` is `undefined` in the built code
2. So `API_BASE_URL` is empty
3. Axios uses a relative path `/api/chat`
4. This resolves to your **frontend URL**: `https://powerful-celebration-production-f926.up.railway.app/api/chat`
5. Nginx (serving the frontend) tries to handle it, but doesn't have that route
6. Nginx returns 405 Method Not Allowed

## The Solution

### Step 1: Set VITE_API_URL Correctly

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Settings** → **Variables**
3. Add/Edit `VITE_API_URL`:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://bank-fdic-v1-production.up.railway.app` (NO trailing slash!)
   - This is your **backend** URL, not frontend URL

### Step 2: Rebuild Frontend

**CRITICAL**: Vite environment variables are baked into the build at **build time**. You MUST rebuild:

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Deployments** tab
3. Click **Redeploy** (or wait for auto-deploy after git push)
4. Wait for build to complete

### Step 3: Verify

After rebuild, check the built JavaScript again. It should show:
```javascript
window.console.log("VITE_API_URL (raw):","https://bank-fdic-v1-production.up.railway.app")
window.console.log("API_BASE_URL (final):","https://bank-fdic-v1-production.up.railway.app")
```

## Why This Happens

Vite replaces `import.meta.env.VITE_API_URL` at **build time** with the actual value. If the env var wasn't set when Railway built the frontend, it becomes `undefined` in the built code.

## Quick Test

After setting `VITE_API_URL` and rebuilding:

1. Open your frontend in browser
2. Open DevTools → Console
3. You should see:
   ```
   === API Configuration ===
   VITE_API_URL (raw): https://bank-fdic-v1-production.up.railway.app
   API_BASE_URL (final): https://bank-fdic-v1-production.up.railway.app
   ```

4. Try sending a message
5. Check Network tab - request should go to:
   `https://bank-fdic-v1-production.up.railway.app/api/chat` (backend URL)
   NOT `https://powerful-celebration-production-f926.up.railway.app/api/chat` (frontend URL)

## Important Notes

- **Frontend URL**: `https://powerful-celebration-production-f926.up.railway.app` (where your React app is)
- **Backend URL**: `https://bank-fdic-v1-production.up.railway.app` (where your FastAPI is)
- **VITE_API_URL must point to BACKEND URL**

After you set `VITE_API_URL` to the backend URL and rebuild, it should work!
