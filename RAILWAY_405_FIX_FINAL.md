# Fixing 405 Error - Final Solution

## The Problem

Even after setting `VITE_API_URL`, you're still getting 405 errors. The curl command works, so the backend is fine.

## Root Causes

1. **Trailing Slash Issue**: `VITE_API_URL` has a trailing slash (`https://bank-fdic-v1-production.up.railway.app/`), which can cause URL construction issues
2. **Vite Env Vars are Build-Time**: Vite environment variables are baked into the build at **build time**, not runtime. If you set `VITE_API_URL` after the frontend was built, it won't work until you rebuild.

## The Fix

### Step 1: Remove Trailing Slash from VITE_API_URL

1. Go to Railway Dashboard → Frontend Service → Settings → Variables
2. Edit `VITE_API_URL`
3. Change from: `https://bank-fdic-v1-production.up.railway.app/`
4. Change to: `https://bank-fdic-v1-production.up.railway.app` (NO trailing slash)
5. Save

### Step 2: Rebuild Frontend

Since Vite env vars are build-time, you MUST rebuild the frontend:

1. Go to Railway Dashboard → Frontend Service
2. Click **Deployments** tab
3. Click **Redeploy** (or wait for auto-deploy after git push)
4. This will trigger a fresh build with the new `VITE_API_URL`

### Step 3: Verify in Browser Console

After redeployment:

1. Open your frontend in browser
2. Open DevTools → Console
3. You should see: `API Configuration: { VITE_API_URL (raw): "...", API_BASE_URL (final): "...", Environment: "production" }`
4. This confirms the env var is being read correctly

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Try sending a message
3. Look at the failed request:
   - **Request URL**: Should be `https://bank-fdic-v1-production.up.railway.app/api/chat`
   - **Request Method**: Should be `POST`
   - **Status**: Should be 200 (not 405)

## Why This Happens

Vite replaces `import.meta.env.VITE_API_URL` at **build time** with the actual value. If the env var wasn't set when the build happened, it becomes `undefined` in the built code.

## Verification Checklist

- [ ] `VITE_API_URL` is set (NO trailing slash)
- [ ] Frontend has been rebuilt after setting the env var
- [ ] Browser console shows correct API_BASE_URL
- [ ] Network tab shows requests going to backend URL
- [ ] Backend logs show the POST request arriving

## If Still Not Working

1. **Check Browser Console**: Look for the API Configuration log
2. **Check Network Tab**: See what URL is actually being called
3. **Check Backend Logs**: See if the request is arriving at the backend
4. **Test Backend Directly**: `curl -X POST https://bank-fdic-v1-production.up.railway.app/api/chat -H "Content-Type: application/json" -d '{"message": "test"}'`

If curl works but frontend doesn't, it's definitely a frontend configuration issue.

## Alternative: Hardcode for Testing

If you want to test quickly, you can temporarily hardcode the URL in `client.js`:

```javascript
const API_BASE_URL = 'https://bank-fdic-v1-production.up.railway.app';
```

Then rebuild. But using the env var is the correct approach for production.
