# Quick Start Guide: FDIC API to PostgreSQL

## Prerequisites

1. **Python 3.8+** installed
2. **PostgreSQL** installed and running
3. **Basic familiarity** with Python and SQL

## Setup Steps

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Create PostgreSQL Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE fdic;

# Exit
\q
```

### 3. Update Database Connection

Edit the scripts and update this line with your credentials:
```python
DB_CONNECTION = "dbname=fdic user=postgres password=yourpassword host=localhost"
```

### 4. Run Initial Data Load

```bash
# Creates tables and loads initial data
python fdic_to_postgres.py
```

This will:
- Create all necessary tables
- Fetch all active institutions
- Fetch last 2 years of financial data
- Insert everything into PostgreSQL

**Expected runtime:** 5-15 minutes depending on your connection

### 5. Set Up Incremental Updates

```bash
# For ongoing updates (e.g., run daily/weekly)
python fdic_incremental_pipeline.py
```

This will:
- Only fetch data that changed since last run
- Track state in `pipeline_state.json`
- Be much faster than full reload

## Quick API Tests

Test the API directly before running the full pipeline:

```bash
# Test 1: Get 5 banks in California
curl "https://banks.data.fdic.gov/api/institutions?filters=STNAME:California&limit=5&format=json"

# Test 2: Get JPMorgan Chase details (CERT 628)
curl "https://banks.data.fdic.gov/api/institutions?filters=CERT:628&format=json"

# Test 3: Get recent financial data for Wells Fargo (CERT 3511)
curl "https://banks.data.fdic.gov/api/financials?filters=CERT:3511&fields=CERT,REPDTE,ASSET,DEP,ROA&limit=4&format=json"
```

## Useful SQL Queries

Once data is loaded, try these queries:

```sql
-- Get top 10 banks by assets
SELECT name, city, stalp, asset, dep
FROM institutions
WHERE active = 1
ORDER BY asset DESC
LIMIT 10;

-- Get quarterly ROA trend for a specific bank
SELECT repdte, roa, asset, dep
FROM financials
WHERE cert = 628  -- JPMorgan Chase
ORDER BY repdte DESC
LIMIT 8;

-- Find banks in specific state with high ROA
SELECT i.name, i.city, f.roa, f.asset
FROM institutions i
JOIN financials f ON i.cert = f.cert
WHERE i.stalp = 'NY'
  AND i.active = 1
  AND f.repdte = (SELECT MAX(repdte) FROM financials WHERE cert = i.cert)
  AND f.roa > 1.0
ORDER BY f.roa DESC;

-- Count active institutions by state
SELECT stalp, stname, COUNT(*) as bank_count
FROM institutions
WHERE active = 1
GROUP BY stalp, stname
ORDER BY bank_count DESC
LIMIT 20;
```

## Data Update Schedule

Based on FDIC's update frequency:

| Data Type | Update Frequency | Recommended Sync |
|-----------|------------------|------------------|
| Institutions | Weekly | Weekly |
| Financials | Quarterly + Weekly (demographics) | Weekly |
| Locations | Weekly | Weekly |
| Failures | As they occur | Daily |
| SOD | Annual | Monthly |

## Common CERT Numbers (for testing)

- **628** - JPMorgan Chase Bank, National Association
- **3511** - Wells Fargo Bank, National Association  
- **3510** - Bank of America, National Association
- **852218** - Citibank, National Association
- **57053** - U.S. Bank National Association

## Troubleshooting

### "Connection refused" error
- Check PostgreSQL is running: `systemctl status postgresql`
- Verify credentials in connection string

### "No module named 'psycopg2'" error
```bash
pip install psycopg2-binary
```

### API returns empty results
- Check your filter syntax (see API guide)
- Verify date format is YYYY-MM-DD
- Some endpoints may not have data for all institutions

### Slow performance
- Add indexes (already included in schema)
- Use batch processing (already implemented)
- Consider partitioning financials table by year if dataset grows large

## Next Steps

1. **Explore the data** - Run SQL queries to understand what's available
2. **Add more tables** - Expand to locations, history, failures tables
3. **Build analytics** - Create views for common metrics (capital ratios, efficiency ratios, etc.)
4. **Set up automation** - Use cron/systemd to run incremental updates daily
5. **Build the chat interface** - Now you have the data foundation!

## Useful Resources

- **FDIC API Docs:** https://banks.data.fdic.gov/docs/
- **Field Definitions:** Download YAML files from API docs
- **Financial Report Queries:** https://banks.data.fdic.gov/docs/All%20Financial%20Reports.xlsx
- **bankfind Python library:** https://github.com/dpguthrie/bankfind

## Getting Help

If you get stuck:
1. Check the FDIC API interactive docs: https://banks.data.fdic.gov/docs/
2. Review the example queries in the API guide
3. Check the logs in `fdic_pipeline.log`
4. Test individual API calls with curl first

## Production Considerations

Before deploying to production:

- [ ] Set up proper logging and monitoring
- [ ] Implement data validation checks
- [ ] Add retry logic for API failures
- [ ] Set up database backups
- [ ] Consider data archival strategy for old quarters
- [ ] Implement API rate limiting on your end
- [ ] Add data quality checks
- [ ] Set up alerts for pipeline failures
- [ ] Document your schema and transformations
