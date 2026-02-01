# Railway Frontend Host Blocking - Working Solution

## Current Status

You've tried multiple approaches but Vite preview is still blocking Railway hosts. Here's the definitive solution.

## Solution: Use `--allowed-hosts` Flag in Start Script

I've updated the configuration to use the `--allowed-hosts` flag directly in the `start` script, which is more reliable than config file settings.

### What I Changed

1. **`frontend/package.json`** - Updated `start` script to include:
   ```json
   "start": "vite preview --host 0.0.0.0 --port ${PORT:-4173} --allowed-hosts .railway.app,.up.railway.app,localhost,all"
   ```

2. **`frontend/nixpacks.toml`** - Updated to use `npm run start`:
   ```toml
   [start]
   cmd = "npm run start"
   ```

3. **`frontend/vite.config.js`** - Cleaned up, removed unnecessary options

### Next Steps

1. **Commit and push**:
   ```bash
   git add frontend/package.json frontend/nixpacks.toml frontend/vite.config.js
   git commit -m "Fix Vite host blocking with --allowed-hosts flag"
   git push
   ```

2. **Verify Railway Configuration**:
   - Go to Railway Dashboard → Frontend Service
   - Settings → Deploy
   - **Root Directory**: Should be `frontend`
   - **Start Command**: Should be empty (uses nixpacks.toml)

3. **Redeploy** and test

## If This Still Doesn't Work: Use Dockerfile

If Vite preview continues to block hosts, use the Dockerfile approach:

### Step 1: Configure Railway for Dockerfile

1. Go to Railway Dashboard → Frontend Service
2. Settings → Deploy
3. **Root Directory**: Set to `frontend` (NOT empty!)
4. Railway should detect `Dockerfile.frontend` in project root
5. If not detected, manually set:
   - **Build Command**: (leave empty)
   - **Start Command**: (leave empty)

### Step 2: Update Dockerfile for Frontend Root

If Railway needs root directory as `frontend`, we need a different Dockerfile approach. Create `frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy frontend source
COPY . ./

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (from project root)
COPY ../nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

But this won't work because we can't copy from parent. Better approach:

### Step 3: Use Nixpacks with Serve Package

Add `serve` package as an alternative:

1. Update `frontend/package.json`:
   ```json
   "dependencies": {
     ...
     "serve": "^14.2.0"
   },
   "scripts": {
     ...
     "serve": "serve -s dist -l $PORT"
   }
   ```

2. Update `frontend/nixpacks.toml`:
   ```toml
   [start]
   cmd = "npm run serve"
   ```

3. This completely bypasses Vite preview

## Recommended: Try the --allowed-hosts Flag First

The `--allowed-hosts` flag in the start script should work. Try that first before switching to Dockerfile or serve.

## Verify It's Working

After deployment:

1. Check Railway logs - should see Vite preview starting
2. Access your frontend URL
3. Should load without host blocking error
4. Check browser console - should see no errors

## Debugging

If still not working, check:

1. **Railway logs** - Is the command using `--allowed-hosts`?
2. **Browser console** - Any other errors?
3. **Network tab** - Are requests being blocked?

Share the Railway deployment logs if you need further help!
