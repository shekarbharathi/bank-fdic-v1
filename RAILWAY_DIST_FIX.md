# Fixing Railway Frontend 403 - Dist Directory Issue

## The Problem

Build completes (`✓ built in 1.37s`) but:
- No mention of `dist` in build logs
- 403 errors when accessing the frontend
- Vite preview can't find the built files

## Root Cause

The `dist` directory is being created during build, but Railway might not be preserving it between the build phase and the start phase, or the working directory might be different.

## The Fix

I've updated `frontend/nixpacks.toml` to:

1. **Verify dist exists after build** - Added `ls -la dist` commands in build phase
2. **Check dist at startup** - Added verification before starting Vite preview
3. **Better error messages** - Will show if dist is missing or empty

## What to Check

After deploying with these changes, check Railway logs:

### Build Logs Should Show:
```
npm run build
✓ built in X.XXs
ls -la dist || echo 'ERROR: dist directory not found after build'
[Should list dist directory contents]
ls -la dist/ | head -20 || echo 'ERROR: dist directory is empty'
[Should list files in dist/]
```

### Runtime Logs Should Show:
```
Checking dist directory...
[Should list dist directory]
Starting Vite preview...
[Vite preview server starting]
```

## If Dist is Missing

If the build logs show "ERROR: dist directory not found", the build is failing silently. Check for:
- Build errors (even if build says it succeeded)
- TypeScript/ESLint errors
- Missing dependencies

## If Dist is Empty

If dist exists but is empty, the build output might be going to a different location. Check:
- Vite config `build.outDir` setting
- Working directory during build vs start

## Alternative: Use Dockerfile (Most Reliable)

If Nixpacks continues to have issues with dist persistence, use Dockerfile:

1. Go to Railway Dashboard → Frontend Service
2. Settings → Deploy
3. Set **Root Directory** to: `frontend`
4. Railway should detect `Dockerfile.frontend` in project root
5. Dockerfile explicitly copies dist to final image

The Dockerfile approach:
- ✅ Builds in a controlled environment
- ✅ Explicitly copies dist to final image
- ✅ Serves with Nginx (no 403 issues)
- ✅ More reliable for production

## Next Steps

1. **Commit and push**:
   ```bash
   git add frontend/nixpacks.toml
   git commit -m "Add dist directory verification in build and start phases"
   git push
   ```

2. **Check Railway build logs** - Look for dist directory verification
3. **Check Railway runtime logs** - Look for dist directory listing
4. **Share the logs** if dist is still missing or empty
