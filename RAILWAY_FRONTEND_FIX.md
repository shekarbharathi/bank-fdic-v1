# Fixing Railway Frontend Host Blocking Error

## The Problem

When accessing your frontend on Railway, you see:
```
Blocked request. This host ("powerful-celebration-production-f926.up.railway.app") is not allowed.
To allow this host, add "powerful-celebration-production-f926.up.railway.app" to `preview.allowedHosts` in vite.config.js.
```

## Root Cause

Vite's preview mode has host checking enabled by default for security. When Railway serves your app, it uses a Railway domain, which Vite blocks unless explicitly allowed.

## The Fix

I've updated `frontend/vite.config.js` to allow Railway hosts:

```javascript
preview: {
  port: 4173,
  host: true,
  allowedHosts: [
    'localhost',
    '.railway.app',
    '.up.railway.app'
  ]
}
```

The `.railway.app` and `.up.railway.app` patterns will match any Railway subdomain.

## Next Steps

1. **Commit and push the changes**:
   ```bash
   git add frontend/vite.config.js
   git commit -m "Fix Vite host blocking for Railway deployment"
   git push
   ```

2. **Wait for Railway to redeploy** your frontend service

3. **Try accessing your frontend again** - it should work now!

## Alternative: Use Nginx (Recommended for Production)

If you continue to have issues with Vite preview, consider using the Dockerfile approach with Nginx:

1. Go to Railway Dashboard → Frontend Service
2. Settings → Deploy
3. Railway should detect `Dockerfile.frontend`
4. This uses Nginx to serve the built files, which doesn't have host restrictions

The Dockerfile approach is more production-ready and doesn't have Vite's host restrictions.

## Verify the Fix

After redeployment, your frontend should:
- ✅ Load without host blocking errors
- ✅ Connect to your backend API
- ✅ Display the chat interface

If you still see errors, check:
1. Railway deployment logs for any build errors
2. Browser console for any JavaScript errors
3. Network tab to verify API calls are working
