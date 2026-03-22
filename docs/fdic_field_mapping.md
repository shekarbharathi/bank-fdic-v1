# FDIC Field Mapping (Optimized Schema)

Target: 35 fields across 8 groups, fitting within 500 MB with 5 years of ACTIVE banks only (~4.5K banks × 20 quarters).

---

## Field Mapping Table

| Requirement | FDIC Field Code | DB Column | Field Group |
|-------------|-----------------|-----------|-------------|
| Certificate number | CERT | cert | Identifiers & Dates |
| Report date | REPDTE | repdte | Identifiers & Dates |
| Total assets | ASSET | asset | Size & Balance Sheet |
| Total deposits | DEP | dep | Size & Balance Sheet |
| Domestic deposits | DEPDOM | depdom | Size & Balance Sheet |
| Total equity capital | EQTOT | eqtot | Size & Balance Sheet |
| Net loans and leases | LNLSNET | lnlsnet | Size & Balance Sheet |
| Earning assets | EARNA / ERNAST | earna | Size & Balance Sheet |
| Domestic loans | ILNDOM | ilndom | Size & Balance Sheet |
| Cash and balances | CHBAL | chbal | Size & Balance Sheet |
| Credit card loans | LNCRCD | lncrcd | Loan Breakdown |
| Money market deposit accounts | DPMMD / NTRSMMDA | dpmmd | Deposit Breakdown |
| Other savings (excluding MMDAs) | DPSAV / NTRSOTH | dpsav | Deposit Breakdown |
| Domestic transaction accounts | P6631 / BRTTRANS / TRN | brttrans | Deposit Breakdown |
| Transaction accounts: IPC including checks | P2215 | p2215 | Deposit Breakdown |
| Real estate loans | LNRE | lnre | Loan Breakdown |
| Commercial & industrial loans | LNCI | lnci | Loan Breakdown |
| Residential real estate loans | LNRESRE | lnresre | Loan Breakdown |
| Total interest income | INTINC | intinc | Income Statement |
| Total interest expense | EINTEXP / INTEXP | intexp | Income Statement |
| Noninterest income | NONII | nonii | Income Statement |
| Noninterest expense | NONIX | nonix | Income Statement |
| Net income | NETINC | netinc | Income Statement |
| Service charges | SC | sc | Income Statement |
| Return on assets | ROA | roa | Profitability & Efficiency |
| Return on assets (pre-tax) | ROAPTX | roaptx | Profitability & Efficiency |
| Net interest margin | NIMY | nimy | Profitability & Efficiency |
| Noncurrent loans ratio | ELNATR | elnatr | Asset Quality & Safety |
| Equity capital ratio | EQ | eq | Asset Quality & Safety |
| Tier 1 capital | RBCT1 | rbct | Asset Quality & Safety |
| Risk-weighted assets | RWAJ | rbcrwaj | Asset Quality & Safety |
| Loan loss allowance | LNATRES | lnatres | Asset Quality & Safety |
| Number of employees | NUMEMP | numemp | Operations & Infrastructure |
| Domestic offices | OFFDOM | offdom | Operations & Infrastructure |

---

## Calculated Fields (Not Stored)

These can be computed in SQL or UI:

| Metric | Formula |
|--------|---------|
| Yield on earning assets | `(intinc / NULLIF(earna, 0)) * 100` |
| Cost of funding earning assets | `(intexp / NULLIF(earna, 0)) * 100` |

*(Note: All dollar amounts in DB are in thousands; multiply by 1000 for actual dollars.)*

---

## Group Descriptions for UI

| Group ID | Group Name | Description |
|----------|------------|-------------|
| 1 | Identifiers & Dates | Certificate and report period |
| 2 | Size & Balance Sheet | Core balance sheet metrics |
| 3 | Deposit Breakdown | Deposit composition (MMDA, savings, transaction) |
| 4 | Loan Breakdown | Loan portfolio by type |
| 5 | Income Statement | Revenue and expense lines |
| 6 | Profitability & Efficiency | Ratios (ROA, NIM) |
| 7 | Asset Quality & Safety | Capital and credit metrics |
| 8 | Operations & Infrastructure | Branches and headcount |

---

## Storage Validation Queries

```sql
-- Total database size
SELECT pg_size_pretty(pg_database_size(current_database())) AS total_size;

-- Size by table
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- Data completeness
SELECT
    COUNT(*) AS total_rows,
    COUNT(DISTINCT cert) AS unique_banks,
    MIN(repdte) AS oldest_quarter,
    MAX(repdte) AS newest_quarter,
    COUNT(CASE WHEN lncrcd IS NOT NULL THEN 1 END) AS rows_with_credit_cards,
    COUNT(CASE WHEN dpmmd IS NOT NULL THEN 1 END) AS rows_with_mmda
FROM financials;
```

---

## Ingestion

```bash
FDIC_MAX_LOOKBACK_YEARS=5 python3 backend/fdic_optimized_ingestion.py
```

Environment: `DATABASE_URL`, optional `FDIC_API_KEY`, optional `FDIC_WRITE_BATCH_SIZE` (default 5000).
