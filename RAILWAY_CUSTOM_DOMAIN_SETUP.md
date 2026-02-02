# Setting Up Custom Domain (bankstats.co) on Railway

## Overview

You want to use your custom domain `bankstats.co` instead of the Railway-generated URL. This requires:
1. Configuring the custom domain in Railway
2. Setting up DNS records
3. Updating environment variables (CORS, API URLs)
4. Updating `.env.production` if needed

## Step 1: Configure Custom Domain in Railway

### For Frontend Service

1. Go to Railway Dashboard → **Frontend Service**
2. Click **Settings** → **Networking** (or **Domains**)
3. Click **"Add Custom Domain"** or **"Generate Domain"**
4. Enter your domain: `bankstats.co`
5. Railway will show you the DNS records you need to configure

### For Backend Service (If You Want a Subdomain)

If you want a subdomain for the backend (e.g., `api.bankstats.co`):

1. Go to Railway Dashboard → **Backend Service**
2. Click **Settings** → **Networking**
3. Click **"Add Custom Domain"**
4. Enter: `api.bankstats.co`
5. Railway will show DNS records

**Note**: You can also keep the backend on Railway's URL and just use the custom domain for the frontend.

## Step 2: Configure DNS Records

You need to add DNS records at your domain registrar (where you purchased `bankstats.co`).

### Option A: Root Domain (bankstats.co)

Add a **CNAME** record:
- **Type**: CNAME
- **Name**: `@` (or leave blank for root domain)
- **Value**: `powerful-celebration-production-f926.up.railway.app` (your Railway frontend URL)
- **TTL**: 3600 (or default)

**OR** if your registrar doesn't support CNAME for root domain, use **A** record:
- **Type**: A
- **Name**: `@`
- **Value**: Railway will provide an IP address (check Railway's domain settings)

### Option B: Subdomain (www.bankstats.co)

Add a **CNAME** record:
- **Type**: CNAME
- **Name**: `www`
- **Value**: `powerful-celebration-production-f926.up.railway.app`
- **TTL**: 3600

### For Backend API (api.bankstats.co)

If you set up a backend subdomain:
- **Type**: CNAME
- **Name**: `api`
- **Value**: `bank-fdic-v1-production.up.railway.app` (your backend Railway URL)

## Step 3: Wait for DNS Propagation

DNS changes can take:
- **5 minutes to 24 hours** (usually 15-30 minutes)
- Check propagation: https://dnschecker.org

Railway will show the domain status:
- **Pending**: DNS not configured yet
- **Valid**: DNS configured correctly
- **Active**: Domain is live

## Step 4: Update Environment Variables

### Frontend: Update .env.production

If you're using `api.bankstats.co` for the backend:

1. Update `frontend/.env.production`:
   ```
   VITE_API_URL=https://api.bankstats.co
   ```

2. Commit and push:
   ```bash
   git add frontend/.env.production
   git commit -m "Update API URL to custom domain"
   git push
   ```

**OR** if keeping backend on Railway URL, no change needed.

### Backend: Update CORS Settings

1. Go to Railway Dashboard → **Backend Service**
2. Click **Settings** → **Variables**
3. Update `CORS_ORIGINS`:
   ```
   CORS_ORIGINS=https://bankstats.co,https://www.bankstats.co
   ```

4. Update `FRONTEND_URL` (if set):
   ```
   FRONTEND_URL=https://bankstats.co
   ```

5. **Redeploy backend** for changes to take effect

## Step 5: Verify SSL Certificate

Railway automatically provisions SSL certificates via Let's Encrypt:
- Usually takes **5-10 minutes** after DNS is configured
- Railway will show SSL status in domain settings
- Your site will be available at `https://bankstats.co` (HTTPS)

## Step 6: Test Everything

1. **Visit your custom domain**: `https://bankstats.co`
2. **Check browser console**: Should show API calls going to correct backend
3. **Test chat functionality**: Send a message and verify it works
4. **Check Network tab**: Verify API requests are successful

## Recommended Setup

### Option 1: Root Domain Only (Simplest)

- **Frontend**: `bankstats.co`
- **Backend**: Keep on Railway URL (`bank-fdic-v1-production.up.railway.app`)
- **Update**: Only `CORS_ORIGINS` in backend
- **No change**: `frontend/.env.production` (keeps Railway backend URL)

### Option 2: Root + API Subdomain (More Professional)

- **Frontend**: `bankstats.co`
- **Backend**: `api.bankstats.co`
- **Update**: `frontend/.env.production` → `VITE_API_URL=https://api.bankstats.co`
- **Update**: `CORS_ORIGINS` in backend → `https://bankstats.co,https://www.bankstats.co`

## Troubleshooting

### Domain Not Working

1. **Check DNS propagation**: https://dnschecker.org
2. **Verify DNS records**: Make sure CNAME/A records are correct
3. **Check Railway domain status**: Should show "Active"
4. **Wait longer**: DNS can take up to 24 hours (usually much faster)

### SSL Certificate Issues

1. **Wait 10-15 minutes** after DNS is configured
2. **Check Railway domain settings** for SSL status
3. **Verify DNS is correct** - SSL won't provision if DNS is wrong

### CORS Errors

1. **Update `CORS_ORIGINS`** in backend to include your custom domain
2. **Redeploy backend** after updating env vars
3. **Check browser console** for exact CORS error message

### API Not Working

1. **Check `VITE_API_URL`** in `frontend/.env.production`
2. **Rebuild frontend** after changing `.env.production`
3. **Verify backend is accessible** at the URL you configured

## Summary Checklist

- [ ] Add custom domain in Railway (frontend service)
- [ ] Configure DNS records at domain registrar
- [ ] Wait for DNS propagation (15-30 minutes)
- [ ] Update `CORS_ORIGINS` in backend service
- [ ] Update `frontend/.env.production` if using API subdomain
- [ ] Redeploy backend (if CORS changed)
- [ ] Rebuild frontend (if `.env.production` changed)
- [ ] Test at `https://bankstats.co`
- [ ] Verify SSL certificate is active

After completing these steps, your app will be live at `https://bankstats.co`! 🎉
