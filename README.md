# FDIC Bank Data Pipeline

A Python project for scraping FDIC bank data from the [FDIC BankFind Suite API](https://banks.data.fdic.gov/api) and loading it into PostgreSQL for analysis.

## Features

- **Complete Data Ingestion**: Fetches institution data, financial reports, locations, history, and failures
- **Incremental Updates**: Smart pipeline that only fetches new/changed data
- **PostgreSQL Integration**: Robust database schema with proper indexing
- **Error Handling**: Comprehensive error handling and logging
- **Batch Processing**: Efficient batch processing for large datasets

## Project Structure

```
bank-fdic-v1/
├── fdic_to_postgres.py          # Initial data load script
├── fdic_incremental_pipeline.py  # Incremental update pipeline
├── fdic_api_guide.md             # FDIC API documentation
├── QUICKSTART.md                 # Quick start guide
├── requirements.txt              # Python dependencies
├── config.py                     # Configuration file (create from config.example.py)
└── README.md                     # This file
```

## Prerequisites

- **Python 3.8+**
- **PostgreSQL 12+**
- **pip** (Python package manager)

## Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd bank-fdic-v1
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt
```

### 3. Set Up PostgreSQL

#### macOS (using Homebrew)

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database
createdb fdic
```

#### Alternative: PostgreSQL.app (macOS)

1. Download from [postgresapp.com](https://postgresapp.com/)
2. Install and launch the app
3. Create a new database named `fdic`

#### Linux

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql

# Create database
sudo -u postgres createdb fdic
```

### 4. Configure Database Connection

1. Copy the example config file:
   ```bash
   cp config.example.py config.py
   ```

2. Edit `config.py` with your PostgreSQL credentials:
   ```python
   DB_CONFIG = {
       'dbname': 'fdic',
       'user': 'postgres',  # or your PostgreSQL username
       'password': 'your_password',
       'host': 'localhost',
       'port': 5432
   }
   ```

   Or set environment variables:
   ```bash
   export DB_NAME=fdic
   export DB_USER=postgres
   export DB_PASSWORD=your_password
   export DB_HOST=localhost
   export DB_PORT=5432
   ```

## Usage

### Initial Data Load

Run the initial data load script to create tables and load historical data:

```bash
python fdic_to_postgres.py
```

This will:
- Create all necessary database tables
- Fetch all active institutions
- Fetch last 2 years of financial data
- Insert everything into PostgreSQL

**Expected runtime:** 5-15 minutes depending on your connection

### Incremental Updates

For ongoing updates (recommended to run daily/weekly):

```bash
python fdic_incremental_pipeline.py
```

This will:
- Only fetch data that changed since last run
- Track state in `pipeline_state.json`
- Be much faster than full reload

### Schedule Regular Updates

#### macOS/Linux (cron)

```bash
# Edit crontab
crontab -e

# Add line to run daily at 2 AM
0 2 * * * cd /path/to/bank-fdic-v1 && /path/to/venv/bin/python fdic_incremental_pipeline.py
```

#### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily/weekly)
4. Action: Start a program
5. Program: `C:\path\to\venv\Scripts\python.exe`
6. Arguments: `fdic_incremental_pipeline.py`
7. Start in: `C:\path\to\bank-fdic-v1`

## Database Schema

### Tables

- **institutions**: Bank institution data (name, location, assets, etc.)
- **financials**: Quarterly financial reports (assets, deposits, ROA, etc.)
- **locations**: Branch and location data
- **history**: Structure change events (mergers, acquisitions, etc.)
- **failures**: Failed institution data

See the SQL schema in `fdic_to_postgres.py` for complete table definitions.

## Example Queries

```sql
-- Top 10 banks by assets
SELECT name, city, stalp, asset, dep
FROM institutions
WHERE active = 1
ORDER BY asset DESC
LIMIT 10;

-- Quarterly ROA trend for a specific bank
SELECT repdte, roa, asset, dep
FROM financials
WHERE cert = 628  -- JPMorgan Chase
ORDER BY repdte DESC
LIMIT 8;

-- Banks in a state with high ROA
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

## Data Update Frequency

Based on FDIC's update frequency:

| Data Type | Update Frequency | Recommended Sync |
|-----------|------------------|------------------|
| Institutions | Weekly | Weekly |
| Financials | Quarterly + Weekly (demographics) | Weekly |
| Locations | Weekly | Weekly |
| Failures | As they occur | Daily |
| SOD | Annual | Monthly |

## Common Bank CERT Numbers (for testing)

- **628** - JPMorgan Chase Bank, National Association
- **3511** - Wells Fargo Bank, National Association  
- **3510** - Bank of America, National Association
- **852218** - Citibank, National Association
- **57053** - U.S. Bank National Association

## API Testing

Test the API directly before running the full pipeline:

```bash
# Get 5 banks in California
curl "https://banks.data.fdic.gov/api/institutions?filters=STNAME:California&limit=5&format=json"

# Get JPMorgan Chase details (CERT 628)
curl "https://banks.data.fdic.gov/api/institutions?filters=CERT:628&format=json"

# Get recent financial data for Wells Fargo (CERT 3511)
curl "https://banks.data.fdic.gov/api/financials?filters=CERT:3511&fields=CERT,REPDTE,ASSET,DEP,ROA&limit=4&format=json"
```

## Troubleshooting

### "Connection refused" error
- Check PostgreSQL is running: `brew services list` (macOS) or `systemctl status postgresql` (Linux)
- Verify credentials in `config.py`
- Check PostgreSQL is listening on the correct port (default: 5432)

### "No module named 'psycopg2'" error
```bash
pip install psycopg2-binary
```

### API returns empty results
- Check your filter syntax (see `fdic_api_guide.md`)
- Verify date format is YYYY-MM-DD
- Some endpoints may not have data for all institutions

### Slow performance
- Add indexes (already included in schema)
- Use batch processing (already implemented)
- Consider partitioning financials table by year if dataset grows large

## Configuration

### Environment Variables

You can set these environment variables instead of using `config.py`:

- `DB_NAME`: Database name (default: `fdic`)
- `DB_USER`: PostgreSQL username (default: `postgres`)
- `DB_PASSWORD`: PostgreSQL password
- `DB_HOST`: Database host (default: `localhost`)
- `DB_PORT`: Database port (default: `5432`)
- `FDIC_API_KEY`: Optional FDIC API key

### API Key (Optional)

While the FDIC API doesn't require an API key, it's recommended for monitoring usage:

1. Get your API key: https://banks.data.fdic.gov/apikey
2. Set it in `config.py` or as environment variable `FDIC_API_KEY`

## Resources

- **FDIC API Documentation:** https://banks.data.fdic.gov/docs/
- **Interactive API Explorer:** https://banks.data.fdic.gov/docs/
- **Field Definitions:** Download YAML files from API docs
- **Financial Report Queries:** https://banks.data.fdic.gov/docs/All%20Financial%20Reports.xlsx
- **bankfind Python library:** https://github.com/dpguthrie/bankfind

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions:
1. Check the [FDIC API interactive docs](https://banks.data.fdic.gov/docs/)
2. Review the example queries in `fdic_api_guide.md`
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
- [ ] Use environment variables or secrets management for credentials
