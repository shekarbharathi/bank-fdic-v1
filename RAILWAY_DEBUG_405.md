# Debugging 405 Error - Step by Step

## Current Status

You've set `VITE_API_URL` but still getting 405 errors. The console log isn't showing, which means either:
1. The updated code hasn't been deployed yet
2. Console logs are being stripped in production

## Immediate Steps

### Step 1: Commit and Push the Updated Code

The console.log code needs to be deployed:

```bash
git add frontend/src/api/client.js
git commit -m "Add debug logging for API configuration"
git push
```

### Step 2: Wait for Railway to Rebuild

Railway will automatically rebuild the frontend. Wait for deployment to complete.

### Step 3: Check Browser Console Again

1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Open DevTools → Console
3. Look for: `=== API Configuration ===`
4. This will show what URL is actually being used

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Try sending a message
3. Look at the failed request:
   - **Request URL**: What URL is it actually calling?
   - **Status Code**: Should show 405
   - **Request Headers**: Check the full URL

## What to Look For

### If Console Shows API_BASE_URL is Empty

This means `VITE_API_URL` wasn't set when the build happened:
- Solution: Set `VITE_API_URL` in Railway, then rebuild

### If Console Shows Wrong URL

Check:
- Is there a trailing slash?
- Is it pointing to the frontend URL instead of backend?
- Is it using relative path?

### If Network Tab Shows Wrong URL

The request might be going to:
- Frontend URL instead of backend URL
- Wrong path (e.g., `/api/api/chat` instead of `/api/chat`)
- Relative path that doesn't work

## Quick Test: Check What URL is Being Called

In the Network tab, when you send a message, check:

1. **Request URL column**: What's the full URL?
2. If it shows your frontend URL → `VITE_API_URL` isn't set correctly
3. If it shows backend URL but 405 → Backend route issue
4. If it shows relative path → `VITE_API_URL` wasn't in build

## Alternative: Check Railway Build Logs

1. Go to Railway Dashboard → Frontend Service → Deployments
2. Click on latest deployment
3. Check **Build Logs**:
   - Look for `VITE_API_URL` being used
   - Check if build completed successfully

## Most Likely Issue

Since curl works but frontend doesn't, and you're getting 405:

**The frontend is probably calling the wrong URL or the env var wasn't in the build.**

After you commit, push, and Railway rebuilds, check the console log. It will tell us exactly what's happening.
