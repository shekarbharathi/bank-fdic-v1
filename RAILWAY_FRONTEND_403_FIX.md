# Fixing Railway Frontend 403 Errors

## The Problem

After fixing the host blocking issue, you're now getting 403 Forbidden errors:
- Browser console: `Failed to load resource: the server responded with a status of 403`
- Railway logs: `GET / 403`, `GET /favicon.ico 403`

## Root Cause

403 errors from Vite preview typically mean:
1. **Built files not found** - Vite preview can't find the `dist` directory
2. **Wrong working directory** - Vite is running from the wrong location
3. **Build didn't complete** - The build phase might have failed

## The Fix

I've updated the configuration to:

1. **Explicitly specify `--outDir dist`** in the preview command
2. **Added `build.outDir`** to `vite.config.js` to ensure consistent build output
3. **Updated nixpacks.toml** to use the correct preview command with explicit paths

## Changes Made

### 1. `frontend/nixpacks.toml`
```toml
[start]
cmd = "npm run preview -- --host 0.0.0.0 --port $PORT --outDir dist --allowed-hosts .railway.app,.up.railway.app,localhost,all"
```

### 2. `frontend/vite.config.js`
Added explicit build output directory:
```javascript
build: {
  outDir: 'dist',
  emptyOutDir: true
}
```

### 3. `frontend/package.json`
Updated start script to include `--outDir dist`

## Next Steps

1. **Commit and push**:
   ```bash
   git add frontend/nixpacks.toml frontend/vite.config.js frontend/package.json
   git commit -m "Fix 403 errors: specify dist directory for Vite preview"
   git push
   ```

2. **Check Railway build logs**:
   - Go to Railway Dashboard → Frontend Service → Deployments
   - Click on latest deployment
   - Check **Build Logs** to verify:
     - `npm run build` completed successfully
     - `dist` directory was created
     - Files were built correctly

3. **Check Railway runtime logs**:
   - View **Runtime Logs** after deployment
   - Should see Vite preview starting
   - Should NOT see 403 errors

4. **Verify build output**:
   The build should create files in `dist/`:
   - `dist/index.html`
   - `dist/assets/` (JS, CSS files)

## Debugging

If you still get 403 errors:

### Check Build Logs
Look for:
- ✅ `npm run build` completed without errors
- ✅ `dist` directory mentioned in logs
- ✅ Build output files listed

### Check Runtime Logs
Look for:
- ✅ Vite preview server starting
- ✅ Port number being used
- ❌ Any errors about missing files

### Verify File Structure
The build should create:
```
frontend/
  dist/
    index.html
    assets/
      index-*.js
      index-*.css
```

### Alternative: Check Working Directory

If files still aren't found, the issue might be the working directory. Try:

1. **Add debug to nixpacks.toml**:
   ```toml
   [start]
   cmd = "ls -la dist && npm run preview -- --host 0.0.0.0 --port $PORT --outDir dist --allowed-hosts all"
   ```

This will list the dist directory contents before starting preview.

## If Build is Failing

If the build phase is failing:

1. **Check for build errors** in Railway logs
2. **Verify all dependencies** are installed
3. **Check Node version** - should be 18.x
4. **Look for TypeScript/ESLint errors** that might stop the build

## Alternative: Use Dockerfile (Most Reliable)

If Vite preview continues to have issues, the Dockerfile approach is more reliable:

1. Go to Railway Dashboard → Frontend Service
2. Settings → Deploy
3. Set **Root Directory** to: `frontend`
4. Railway should detect `Dockerfile.frontend` in project root
5. Or create `frontend/Dockerfile` that builds and serves with Nginx

The Dockerfile approach:
- ✅ Builds in a controlled environment
- ✅ Serves with Nginx (no 403 issues)
- ✅ More production-ready
- ✅ Better performance

## Expected Behavior After Fix

After deploying with these changes:

1. ✅ Build completes successfully
2. ✅ `dist` directory is created with built files
3. ✅ Vite preview starts and serves from `dist`
4. ✅ Frontend loads without 403 errors
5. ✅ No host blocking errors

If you still see issues, share the Railway build and runtime logs!
