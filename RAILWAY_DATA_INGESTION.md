# Railway Data Ingestion Guide

## Overview

After deploying your backend service to Railway, you need to load the FDIC bank data into your PostgreSQL database.

## Prerequisites

1. ✅ Backend service deployed and running
2. ✅ PostgreSQL database service created in Railway
3. ✅ `DATABASE_URL` environment variable available (automatically provided by Railway)
4. ✅ `FDIC_API_KEY` environment variable set (optional, but recommended)

## Step 1: Set Environment Variables

In your **Backend** service settings, add:

```
FDIC_API_KEY=your_fdic_api_key_here
```

**Note**: The FDIC API key is optional but recommended to avoid rate limits. You can get one from [FDIC API](https://banks.data.fdic.gov/docs/api).

## Step 2: Run Data Ingestion

Since your backend service has **Root Directory** set to `backend`, you have two options:

### Option A: Use the Script in Backend Directory (Recommended)

I've created `backend/railway_data_ingestion.py` which is accessible from the backend service:

```bash
railway run python railway_data_ingestion.py
```

When Railway asks you to pick a service, select **backend**.

### Option B: Use the Script from Project Root

If you want to use the original script in the project root:

```bash
railway run python ../railway_data_ingestion.py
```

When Railway asks you to pick a service, select **backend**.

**Note**: This requires that Railway can access the parent directory, which may not always work depending on your setup.

## Step 3: Monitor the Process

The ingestion process will:

1. ✅ Create database tables (`institutions` and `financials`)
2. ✅ Fetch all institutions from FDIC API (active and inactive)
3. ✅ Load institution data into PostgreSQL
4. ✅ Fetch financial data from the last 2 years
5. ✅ Load financial data into PostgreSQL

**Expected time**: 5-15 minutes depending on network speed and API rate limits.

## What the Script Does

The `railway_data_ingestion.py` script:

- Connects to Railway's PostgreSQL database using `DATABASE_URL`
- Creates the necessary tables if they don't exist
- Fetches all institutions (both active and inactive)
- Fetches financial data from 2022 onwards
- Uses upsert operations to avoid duplicates
- Handles errors gracefully

## Troubleshooting

### Error: "No such file or directory"

**Solution**: Make sure you're using the correct path:
- If Root Directory is `backend`: Use `python railway_data_ingestion.py`
- If Root Directory is project root: Use `python railway_data_ingestion.py`

### Error: "ModuleNotFoundError: No module named 'fdic_to_postgres'"

**Solution**: The script in `backend/` automatically adds the parent directory to the Python path. If this fails:
1. Make sure `fdic_to_postgres.py` exists in the project root
2. Check that the script has the correct path handling code

### Error: "psycopg2.OperationalError: connection failed"

**Solution**: 
1. Verify PostgreSQL service is running in Railway
2. Check that `DATABASE_URL` is available in backend service environment variables
3. Railway automatically provides `DATABASE_URL` - make sure it's not overridden

### Error: "FDIC API rate limit exceeded"

**Solution**:
1. Add `FDIC_API_KEY` to your environment variables
2. Wait a few minutes and try again
3. The script includes delays between requests to avoid rate limits

### Data Ingestion Takes Too Long

**Solution**:
- This is normal - the script fetches thousands of records
- Financial data alone can be 70,000+ records
- Be patient, it should complete in 10-15 minutes

## Verify Data Load

After ingestion completes, verify the data:

1. Connect to your Railway PostgreSQL database
2. Run these queries:

```sql
-- Check institution count
SELECT COUNT(*) FROM institutions;

-- Check financial records count
SELECT COUNT(*) FROM financials;

-- Check recent data
SELECT COUNT(*) FROM financials WHERE repdte >= '2024-01-01';

-- Sample institutions
SELECT name, city, stalp, asset FROM institutions WHERE active = 1 LIMIT 10;
```

## Re-running Data Ingestion

The script uses `UPSERT` operations, so it's safe to run multiple times:
- Existing records will be updated
- New records will be inserted
- No duplicates will be created

## Next Steps

After data ingestion:
1. ✅ Verify data is loaded (see queries above)
2. ✅ Test your backend API: `https://your-backend.up.railway.app/api/health`
3. ✅ Try a chat query: "Show me the top 10 banks by assets"
4. ✅ Deploy your frontend service

## Alternative: Incremental Updates

For production, consider using `fdic_incremental_pipeline.py` which:
- Only fetches new/updated records
- Handles errors and retries
- Can be scheduled to run periodically

See `fdic_incremental_pipeline.py` for details.
