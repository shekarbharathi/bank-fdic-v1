# FDIC API Integration Guide

## Overview

The FDIC BankFind Suite API provides free access to comprehensive banking data including financial reports, institution details, locations, failures, and more.

**Base URL:** `https://banks.data.fdic.gov/api`

**API Key:** Currently optional, but recommended for monitoring usage
- Get your API key: https://banks.data.fdic.gov/apikey (external site)

---

## Main API Endpoints

### 1. **Institutions** (`/institutions`)
Financial institution data including charter info, regulatory details, and basic metrics.

**Example Query:**
```
GET https://banks.data.fdic.gov/api/institutions?filters=STNAME:California&limit=100&offset=0&format=json
```

### 2. **Financials** (`/financials`)
Over 1,100 Call Report variables reported quarterly since 1992.

**Example Query:**
```
GET https://banks.data.fdic.gov/api/financials?filters=CERT:3511 AND REPDTE:[2023-01-01 TO *]&fields=CERT,REPDTE,ASSET,DEP,ROA,ROAPTX&limit=100&format=json
```

### 3. **Locations** (`/locations`)
Branch and location data for all FDIC-insured institutions.

**Example Query:**
```
GET https://banks.data.fdic.gov/api/locations?filters=CERT:3511&limit=1000&format=json
```

### 4. **History** (`/history`)
Structure change events (mergers, acquisitions, name changes, etc.) back to 1970.

**Example Query:**
```
GET https://banks.data.fdic.gov/api/history?filters=CERT:3511&format=json
```

### 5. **Failures** (`/failures`)
Details on failed financial institutions.

**Example Query:**
```
GET https://banks.data.fdic.gov/api/failures?filters=FAILDATE:[2020-01-01 TO *]&format=json
```

### 6. **Summary of Deposits (SOD)** (`/sod`)
Annual deposit data by branch since 1994.

**Example Query:**
```
GET https://banks.data.fdic.gov/api/sod?filters=CERT:3511 AND YEAR:2023&format=json
```

### 7. **Summary** (`/summary`)
Historic aggregate financial and structure data subtotaled by year.

**Example Query:**
```
GET https://banks.data.fdic.gov/api/summary?filters=YEAR:2023&format=json
```

---

## Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `filters` | Elasticsearch query string syntax | `STNAME:California` |
| `fields` | Comma-separated list of fields to return | `CERT,NAME,ASSET,DEP` |
| `sort_by` | Field to sort by | `ASSET` |
| `sort_order` | ASC or DESC | `DESC` |
| `limit` | Max records per request (default 100, max 10,000) | `1000` |
| `offset` | Pagination offset | `1000` |
| `format` | json or csv | `json` |
| `download` | true to force download | `true` |
| `filename` | Custom filename for downloads | `my_data.csv` |

---

## Filter Syntax (Elasticsearch Query String)

**Basic filters:**
```
NAME:"JPMorgan Chase Bank"
STNAME:California
ASSET:[1000000 TO *]
REPDTE:[2023-01-01 TO 2023-12-31]
```

**Combining filters:**
```
STNAME:California AND ASSET:[1000000 TO *]
BKCLASS:N OR BKCLASS:NM
!(STNAME:California OR STNAME:Texas)
```

**Date format:** `yyyy-mm-dd`

**Ranges:**
- Inclusive: `[min TO max]`
- Exclusive: `{min TO max}`
- Open-ended: `[value TO *]` or `[* TO value]`

---

## Important Field Names

### Institutions Endpoint
- `CERT` - Certificate number (unique ID)
- `NAME` - Institution name
- `CITY`, `STALP`, `STNAME` - Location
- `ASSET` - Total assets
- `DATEUPDT` - Last update date
- `ACTIVE` - Active status (1=active)
- `BKCLASS` - Bank class code

### Financials Endpoint
- `REPDTE` - Report date (YYYY-MM-DD)
- `ASSET` - Total assets
- `DEP` - Total deposits
- `DEPDOM` - Domestic deposits
- `LNLSNET` - Net loans and leases
- `EQTOT` - Total equity capital
- `ROA` - Return on assets
- `ROAPTX` - Return on assets (pre-tax)
- `NETINC` - Net income
- `NIMY` - Net interest margin
- `ELNATR` - Non-current loans to total loans

---

## Rate Limits

- No official rate limits documented
- Recommended: max 10,000 records per request
- For bulk data, use pagination with offset

---

## Output Formats

**JSON (default):**
```bash
curl -H "Accept: application/json" \
  "https://banks.data.fdic.gov/api/institutions?limit=10"
```

**CSV:**
```bash
curl -H "Accept: text/csv" \
  "https://banks.data.fdic.gov/api/institutions?limit=10"
```

---

## Additional Resources

- **Interactive API Documentation:** https://banks.data.fdic.gov/docs/
- **OpenAPI/Swagger Spec:** https://banks.data.fdic.gov/docs/swagger.yaml
- **Field Definitions (YAML files):**
  - Institutions: https://banks.data.fdic.gov/docs/institution_properties.yaml
  - Financials: https://banks.data.fdic.gov/docs/risview_properties.yaml
  - Locations: https://banks.data.fdic.gov/docs/location_properties.yaml
  - History: https://banks.data.fdic.gov/docs/history_properties.yaml
  - Failures: https://banks.data.fdic.gov/docs/failure_properties.yaml
  - SOD: https://banks.data.fdic.gov/docs/sod_properties.yaml

- **Common Financial Reports:** https://banks.data.fdic.gov/docs/All%20Financial%20Reports.xlsx

---

## Data Update Frequency

| Endpoint | Update Frequency | Historical Data |
|----------|------------------|-----------------|
| Institutions | Weekly | Back to 1934 |
| Financials | Quarterly + Weekly (demographics) | Back to 1992 |
| Locations | Weekly | Back to 1970 |
| History | Weekly | Back to 1970 |
| Failures | As events occur | All failures |
| SOD | Annual | Back to 1994 |

---

## Python Libraries

**Official/Community:**
- `bankfind` - Python wrapper for FDIC API: https://github.com/dpguthrie/bankfind
  ```bash
  pip install bankfind
  ```

**Usage example:**
```python
from bankfind import BankFind

bf = BankFind()

# Get all institutions in California
institutions = bf.get_institutions(filters="STNAME:California", limit=1000)

# Get financial data for a specific bank
financials = bf.get_financials(filters="CERT:3511", fields="CERT,REPDTE,ASSET,DEP,ROA")
```
