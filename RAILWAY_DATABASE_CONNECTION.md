# Fixing Railway DATABASE_URL Connection

## The Problem

When calling `/api/data/ingest`, you get:
```json
{"detail":"Data ingestion failed: DATABASE_URL not found"}
```

## Root Cause

Railway automatically provides `DATABASE_URL` when a PostgreSQL service is **connected** to your backend service. If you're getting this error, it means:

1. PostgreSQL service exists but isn't connected to backend service
2. Or the environment variable isn't being passed correctly

## Solution: Connect PostgreSQL to Backend Service

### Step 1: Check if PostgreSQL Service Exists

1. Go to Railway Dashboard → Your Project
2. Look for a **PostgreSQL** service
3. If it doesn't exist, create it:
   - Click **"+ New"**
   - Select **"Database"** → **"Add PostgreSQL"**

### Step 2: Connect PostgreSQL to Backend Service

Railway automatically connects services, but let's verify:

1. Go to Railway Dashboard → Your **Backend** service
2. Click **Settings** → **Variables** tab
3. Look for `DATABASE_URL` in the environment variables
4. If it's **not there**, you need to connect the services:

**To connect services:**
1. Go to your **PostgreSQL** service
2. Click **Settings** → **Connections**
3. Make sure your **Backend** service is listed as a connected service
4. If not, Railway should auto-connect, but you can also:
   - Go to Backend service → Settings → Variables
   - Railway should show "Connect to PostgreSQL" option

### Step 3: Verify DATABASE_URL is Available

After connecting, check:

1. Go to **Backend** service → **Settings** → **Variables**
2. You should see `DATABASE_URL` with a value like:
   ```
   postgresql://postgres:password@hostname:5432/railway
   ```
3. If you see it, the connection is set up correctly

### Step 4: Redeploy Backend

After connecting the services:

1. Go to **Backend** service → **Deployments**
2. Click **Redeploy** to pick up the new environment variable
3. Wait for deployment to complete

### Step 5: Try Data Ingestion Again

```bash
curl -X POST https://your-backend.up.railway.app/api/data/ingest
```

## Alternative: Manual Connection String

If Railway's auto-connection isn't working, you can manually set the connection:

1. Go to **PostgreSQL** service → **Settings** → **Variables**
2. Note down these values (or Railway provides them):
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`

3. Go to **Backend** service → **Settings** → **Variables**
4. Add these variables:
   ```
   PGHOST=<from PostgreSQL service>
   PGPORT=<from PostgreSQL service>
   PGDATABASE=<from PostgreSQL service>
   PGUSER=<from PostgreSQL service>
   PGPASSWORD=<from PostgreSQL service>
   ```

The updated code will automatically construct `DATABASE_URL` from these variables.

## Verify Connection

You can verify the database connection works by calling the health endpoint:

```bash
curl https://your-backend.up.railway.app/api/health
```

This should return:
```json
{
  "status": "healthy",
  "database_connected": true,
  "llm_provider": "OPENAI"
}
```

If `database_connected` is `false`, the connection isn't set up correctly.

## Troubleshooting

### Error: "DATABASE_URL not found"

**Check:**
1. ✅ PostgreSQL service exists
2. ✅ PostgreSQL is connected to backend service
3. ✅ Backend service has `DATABASE_URL` in Variables
4. ✅ Backend has been redeployed after connection

### Error: "Invalid DATABASE_URL format"

**Check:**
1. The `DATABASE_URL` format should be: `postgresql://user:password@host:port/dbname`
2. Make sure there are no extra spaces or characters
3. Check Railway logs for the actual DATABASE_URL value (password will be masked)

### Still Not Working?

1. **Check Railway Logs**:
   - Go to Backend service → Deployments → Latest deployment
   - View Runtime Logs
   - Look for database connection errors

2. **Test Database Connection Manually**:
   - Use Railway's PostgreSQL service → Connect tab
   - Try connecting with psql or a database client
   - Verify the connection string works

3. **Check Service Status**:
   - Make sure PostgreSQL service is running (green status)
   - Make sure Backend service is running (green status)

## Quick Fix Checklist

- [ ] PostgreSQL service exists in Railway project
- [ ] PostgreSQL service is running (green status)
- [ ] Backend service is connected to PostgreSQL (check Variables tab)
- [ ] `DATABASE_URL` appears in Backend service Variables
- [ ] Backend service has been redeployed after connection
- [ ] Health endpoint shows `database_connected: true`

Once all these are checked, the data ingestion should work!
