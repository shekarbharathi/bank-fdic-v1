# Fixing 405 Method Not Allowed Error

## The Problem

Frontend is getting `405 Method Not Allowed` when POSTing to `/api/chat`.

## Possible Causes

1. **Route not registered** - The `/api/chat` route isn't being registered correctly
2. **Wrong HTTP method** - Route exists but doesn't accept POST
3. **Double prefix** - Route path might be duplicated
4. **Backend not running** - Backend service might not be running
5. **Wrong API URL** - Frontend might be calling wrong backend URL

## Debugging Steps

### Step 1: Verify Backend is Running

1. Go to Railway Dashboard → Backend Service
2. Check **Runtime Logs**
3. Should see: `Uvicorn running on http://0.0.0.0:PORT`
4. Should see route listings from startup event

### Step 2: Check Backend Routes

The backend should have these routes:
- `POST /api/chat` - Main chat endpoint
- `GET /api/health` - Health check
- `GET /api/schema` - Schema endpoint
- `GET /` - Root endpoint

### Step 3: Test Backend Directly

Test the backend endpoint directly:

```bash
curl -X POST https://your-backend.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

If this works, the issue is with the frontend API URL configuration.

### Step 4: Verify Frontend API URL

1. Go to Railway Dashboard → Frontend Service → Settings → Variables
2. Check `VITE_API_URL` is set to your backend URL:
   ```
   VITE_API_URL=https://your-backend.up.railway.app
   ```
3. Make sure there's NO trailing slash

### Step 5: Check Browser Network Tab

1. Open browser DevTools → Network tab
2. Try sending a message
3. Look at the failed request:
   - What URL is it calling?
   - What's the exact error?
   - What's the response?

## Common Fixes

### Fix 1: Set VITE_API_URL Environment Variable

If `VITE_API_URL` isn't set, the frontend might be trying to use a relative path which won't work:

1. Go to Railway Dashboard → Frontend Service
2. Settings → Variables
3. Add:
   ```
   VITE_API_URL=https://your-backend.up.railway.app
   ```
4. Redeploy frontend

### Fix 2: Verify Backend CORS

Make sure backend allows requests from frontend:

1. Go to Railway Dashboard → Backend Service → Settings → Variables
2. Check `CORS_ORIGINS` or `FRONTEND_URL` includes your frontend URL
3. Should be: `https://your-frontend.up.railway.app`

### Fix 3: Check Route Registration

The backend code shows:
- Router defined with `@router.post("/chat")`
- Included with `prefix="/api"`
- Should create route: `POST /api/chat`

If routes aren't showing in logs, there might be an import error.

## Expected Behavior

After fixing:

1. ✅ Backend logs show route: `POST /api/chat`
2. ✅ Frontend `VITE_API_URL` points to backend
3. ✅ Backend CORS allows frontend origin
4. ✅ POST request succeeds with 200 status
5. ✅ Chat messages work

## Quick Test

Test the backend health endpoint first:

```bash
curl https://your-backend.up.railway.app/api/health
```

Should return:
```json
{
  "status": "healthy",
  "database_connected": true,
  "llm_provider": "OPENAI"
}
```

If this works, the backend is running. Then test the chat endpoint.
