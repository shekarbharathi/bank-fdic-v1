# Railway Data Ingestion via API Endpoint

## The Problem

The `railway run` command is giving "No such file or directory" errors, making it impossible to run the data ingestion script via CLI.

## Solution: Use API Endpoint

I've created an API endpoint that you can call via HTTP request to trigger data ingestion. This bypasses the `railway run` CLI issues.

## Step 1: Deploy the Updated Backend

The backend now includes a data ingestion endpoint. Make sure to:

1. **Commit and push the changes**:
   ```bash
   git add backend/api/data_ingestion.py backend/main.py
   git commit -m "Add data ingestion API endpoint"
   git push
   ```

2. **Wait for Railway to deploy** (or manually redeploy)

## Step 2: Trigger Data Ingestion via API

Once deployed, you can trigger data ingestion by making a POST request to:

```
POST https://your-backend.up.railway.app/api/data/ingest
```

### Using curl:

```bash
curl -X POST https://your-backend.up.railway.app/api/data/ingest
```

### Using Python:

```python
import requests

response = requests.post("https://your-backend.up.railway.app/api/data/ingest")
print(response.json())
```

### Using Browser/Postman:

1. Open Postman or any HTTP client
2. Set method to **POST**
3. URL: `https://your-backend.up.railway.app/api/data/ingest`
4. Click **Send**

## Step 3: Monitor Progress

The ingestion will run in the background. You can:

1. **Check Railway logs**:
   - Go to Railway Dashboard → Backend Service
   - Click **Deployments** → Latest deployment
   - View **Runtime Logs** to see progress

2. **Check API response**:
   - The endpoint will return when ingestion completes
   - Response includes number of records loaded

## Expected Response

**Success:**
```json
{
  "status": "success",
  "message": "Data ingestion completed successfully",
  "institutions_loaded": 4337,
  "financials_loaded": 69964
}
```

**Error:**
```json
{
  "detail": "Data ingestion failed: <error message>"
}
```

## What the Endpoint Does

The `/api/data/ingest` endpoint:

1. ✅ Connects to Railway's PostgreSQL database
2. ✅ Creates database tables if they don't exist
3. ✅ Fetches all institutions from FDIC API
4. ✅ Loads institution data into PostgreSQL
5. ✅ Fetches financial data from last 2 years
6. ✅ Loads financial data into PostgreSQL

**Note**: This process takes 5-15 minutes depending on network speed and API rate limits.

## Check Ingestion Status

You can check if the endpoint is available:

```
GET https://your-backend.up.railway.app/api/data/ingest/status
```

## Troubleshooting

### Error: "DATABASE_URL not found"

**Solution**: Make sure PostgreSQL service is running and connected to your backend service. Railway automatically provides `DATABASE_URL`.

### Error: "Invalid DATABASE_URL format"

**Solution**: Check that Railway's `DATABASE_URL` is correctly formatted. It should be: `postgresql://user:password@host:port/dbname`

### Ingestion Takes Too Long

**Solution**: This is normal. The process can take 10-15 minutes. Monitor the Railway logs to see progress.

### Timeout Error

**Solution**: The endpoint might timeout if it takes too long. In that case:
1. Check Railway logs to see if ingestion is still running
2. The data might still be loading in the background
3. Check the database directly to verify data was loaded

## Verify Data Load

After ingestion, verify the data:

1. Connect to your Railway PostgreSQL database
2. Run these queries:

```sql
-- Check institution count
SELECT COUNT(*) FROM institutions;

-- Check financial records count
SELECT COUNT(*) FROM financials;

-- Sample institutions
SELECT name, city, stalp, asset FROM institutions WHERE active = 1 LIMIT 10;
```

## Alternative: Still Try Railway CLI

If you want to try `railway run` again, make sure to:

1. **Specify service explicitly**:
   ```bash
   railway run --service backend python railway_data_ingestion.py
   ```

2. **Or set service context first**:
   ```bash
   railway service backend
   railway run python railway_data_ingestion.py
   ```

But the API endpoint method is more reliable and easier to use!
