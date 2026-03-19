# FDIC Field Definitions and Prioritization

## Overview

- Total FDIC fields parsed: **2377**
- Current DB baseline fields detected from repo: **23**
- Primary catalog: `docs/data/fdic_field_reference.csv`

## Requested Metric Mappings

| Metric | Primary FDIC Field | Alternate Fields | Notes |
|---|---|---|---|
| Credit card loans | `LNCRCD` | `LNCRCDR`, `NTCRCD`, `P3CRCD`, `P9CRCD`, `NACRCD`, `NCCRCD` | LNCRCD is the direct stock measure for consumer credit card plan loans. Alternates capture ratio, net charge-offs, delinquency, and noncurrent views. |
| Money market deposit accounts | `NTRSMMDA` | `NTRSMMDAR`, `DEPDOM`, `DEP` | NTRSMMDA explicitly maps to savings MMDA balances. DEPDOM/DEP are aggregate deposit totals if MMDA-only data is unavailable. |
| Other savings (excluding MMDAs) | `NTRSOTH` | `NTRSOTHR`, `NTR`, `DEPDOM` | NTRSOTH is the direct non-MMDA savings bucket under nontransaction accounts. |
| Domestic Transaction Accounts | `TRN` | `DDT`, `TRNIPC`, `TRNIPCOC` | TRN is the transaction-account total. DDT is demand deposits (subset); TRNIPC/TRNIPCOC are ownership/category breakouts. |
| Transaction Accounts: IPC including Checks | `TRNIPCOC` | `TRNIPC`, `DEPIPCCF` | TRNIPCOC explicitly includes official checks within IPC transaction accounts. |
| Total Interest Income | `INTINC` | `INTINQ`, `INTINCR`, `ILNDOM`, `ILNFOR`, `ICHBAL`, `ISC`, `IFREPO`, `IOTHII` | INTINC is the direct total interest income measure; alternates are quarterly/ratio variants and major component lines. |
| Yield on earning assets | `INTINCY` | `INTINCYQ`, `NIMY`, `NIM`, `ERNAST5` | INTINCY is the direct annualized interest-income-to-earning-assets yield proxy. |
| Cost of funding earning assets | `INTEXPY` | `INTEXPYQ`, `EINTEXP`, `NIMY` | INTEXPY/INTEXPYQ are explicit cost-of-funding-to-earning-assets ratios. |

## Top Recommended Fields Beyond Current Schema

Recommended additions (excluding existing baseline fields): **78** fields.

| Field | Theme | Priority Phase | Description |
|---|---|---|---|
| `INTINC` | Profitability/Margin | Phase 1 (Core analyst workflows) | TOTAL INTEREST INCOME |
| `INTINQ` | Profitability/Margin | Phase 1 (Core analyst workflows) | TOTAL INTEREST INCOME QUARTERLY |
| `EINTEXP` | Profitability/Margin | Phase 1 (Core analyst workflows) | TOTAL INTEREST EXPENSE |
| `EINTXQ` | Profitability/Margin | Phase 1 (Core analyst workflows) | TOTAL INTEREST EXPENSE QUARTERLY |
| `NONII` | Profitability/Margin | Phase 1 (Core analyst workflows) | TOTAL NONINTEREST INCOME |
| `NONIX` | Profitability/Margin | Phase 1 (Core analyst workflows) | TOTAL NONINTEREST EXPENSE |
| `IBEFTAX` | Profitability/Margin | Phase 1 (Core analyst workflows) | INCOME BEFORE INC TAXES & DISC |
| `PTAXNETINC` | Profitability/Margin | Phase 1 (Core analyst workflows) | PRE-TAX NET INCOME OPERATING INCOME |
| `NETIMIN` | Profitability/Margin | Phase 1 (Core analyst workflows) | NET INC - ATTRIB TO MINORITY INT |
| `ROE` | Profitability/Margin | Phase 1 (Core analyst workflows) | Return on Equity (ROE) |
| `INTINCY` | Profitability/Margin | Phase 1 (Core analyst workflows) | INTEREST INCOME TO EARNING ASSETS RATIO |
| `INTEXPY` | Profitability/Margin | Phase 1 (Core analyst workflows) | INTEREST EXPENSE TO EARNING ASSETS RATIO |
| `ERNAST` | Profitability/Margin | Phase 1 (Core analyst workflows) | TOTAL EARNING ASSETS |
| `ERNAST5` | Profitability/Margin | Phase 1 (Core analyst workflows) | TOTAL EARNING ASSETS-CAVG5I |
| `NIM` | Profitability/Margin | Phase 1 (Core analyst workflows) | NET INTEREST INCOME |
| `DDT` | Funding/Deposits | Phase 1 (Core analyst workflows) | DDA TRANS-TOTAL |
| `TRN` | Funding/Deposits | Phase 1 (Core analyst workflows) | TRANSACTION-TOTAL |
| `TRNIPC` | Funding/Deposits | Phase 1 (Core analyst workflows) | TRANSACTION-IPC |
| `TRNIPCOC` | Funding/Deposits | Phase 1 (Core analyst workflows) | TRAN-IPC-OFFICIAL CHECKS |
| `NTR` | Funding/Deposits | Phase 1 (Core analyst workflows) | NONTRANSACTION-TOTAL |
| `NTRIPC` | Funding/Deposits | Phase 1 (Core analyst workflows) | NONTRANSACTION-IPC |
| `NTRSMMDA` | Funding/Deposits | Phase 1 (Core analyst workflows) | SAVINGS DEP-MMDA |
| `NTRSOTH` | Funding/Deposits | Phase 1 (Core analyst workflows) | SAVINGS DEP-OTHER |
| `DEPINS` | Funding/Deposits | Phase 1 (Core analyst workflows) | ESTIMATED INSURED DEPOSITS |
| `DEPUNINS` | Funding/Deposits | Phase 1 (Core analyst workflows) | ESTIMATED UNINSURED DEPOSITS IN DOMESTIC OFFICES AND IN INSURED BRANCHES IN US TERRITORIES AND POSSESSIONS |
| `DEPI` | Funding/Deposits | Phase 1 (Core analyst workflows) | INTEREST-BEARING DEP |
| `DEPNI` | Funding/Deposits | Phase 1 (Core analyst workflows) | NONINTEREST-BEARING DEP |
| `DEPFOR` | Funding/Deposits | Phase 1 (Core analyst workflows) | TOTAL DEPOSITS-FOR |
| `LNLS` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | LN&LS + UNEARNED INC |
| `LNLSGR` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | LOANS AND LEASES-TOTAL |
| `LNRE` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | RE LOANS |
| `LNRERES` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | RE 1-4 FAMILY |
| `LNREMULT` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | RE MULTIFAMILY |
| `LNRENRES` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | RE NONFARM NONRESIDENTIAL PROP |
| `LNRECONS` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | RE CONSTRUCTION & LAND DEVELOP |
| `LNREAG` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | RE AGRICULTURAL |
| `LNCI` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | C&I LOANS |
| `LNCON` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | CONSUMER LOANS |
| `LNAUTO` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | CONSUMER LOANS - AUTO |
| `LNCRCD` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | CONSUMER LOANS-CREDIT CARD PLAN |
| `LNCOMRE` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | COMMERCIAL RE LOANS |
| `LNMUNI` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | MUNI LOANS |
| `LNSOTHER` | Asset Mix/Credit | Phase 1 (Core analyst workflows) | OTHER LOANS |
| `NALNLS` | Asset Quality | Phase 2 (Risk and resilience) | NONACCRUAL-LOANS & LEASES |
| `NCLNLS` | Asset Quality | Phase 2 (Risk and resilience) | TOTAL N/C-LOANS & LEASES |
| `P3LNLS` | Asset Quality | Phase 2 (Risk and resilience) | 30-89 DAYS P/D-LOANS & LEASES |
| `P9LNLS` | Asset Quality | Phase 2 (Risk and resilience) | 90+ DAYS P/D-LOANS & LEASES |
| `DRLNLS` | Asset Quality | Phase 2 (Risk and resilience) | TOTAL LN&LS CHARGE-OFFS |
| `CRLNLS` | Asset Quality | Phase 2 (Risk and resilience) | TOTAL LN&LS RECOVERIES |
| `ELNLOS` | Asset Quality | Phase 2 (Risk and resilience) | PROVISIONS FOR LN & LEASE LOSSES |
| `SUBLLPF` | Asset Quality | Phase 2 (Risk and resilience) | SUB. DEBT & L/L PREFERRED STK |
| `NACRCD` | Asset Quality | Phase 2 (Risk and resilience) | NONACCRUAL-CREDIT CARD PLANS |
| `NCCRCD` | Asset Quality | Phase 2 (Risk and resilience) | TOTAL N/C CREDIT CARD PLANS |
| `P3CRCD` | Asset Quality | Phase 2 (Risk and resilience) | 30-89 DAYS P/D-CREDIT CARD PLANS |
| `P9CRCD` | Asset Quality | Phase 2 (Risk and resilience) | 90+ DAYS P/D-CREDIT CARD PLANS |
| `EQCS` | Capital/Solvency | Phase 2 (Risk and resilience) | COMMON STOCK |
| `EQSUR` | Capital/Solvency | Phase 2 (Risk and resilience) | SURPLUS |
| `EQUPTOT` | Capital/Solvency | Phase 2 (Risk and resilience) | UP-NET & OTHER CAPITAL COMP |
| `RBCT1` | Capital/Solvency | Phase 2 (Risk and resilience) | TIER 1 RBC-PCA |
| `RBCT2` | Capital/Solvency | Phase 2 (Risk and resilience) | RBC-TIER2-PCA |
| `RBC` | Capital/Solvency | Phase 2 (Risk and resilience) | RBC-TOTAL-PCA |
| `RWAJ` | Capital/Solvency | Phase 2 (Risk and resilience) | RWA-ADJUST-PCA-T1 & CET1 RATIO |
| `LIAB` | Capital/Solvency | Phase 2 (Risk and resilience) | TOTAL LIABILITIES |
| `OFFDOM` | Scale/Operations | Phase 3 (Depth and market structure) | Number of Domestic Offices |
| `OFFFOR` | Scale/Operations | Phase 3 (Depth and market structure) | Number of Foreign Offices |
| `OFFTOT` | Scale/Operations | Phase 3 (Depth and market structure) | TOTAL OFFICES |
| `NUMEMP` | Scale/Operations | Phase 3 (Depth and market structure) | NUMBER OF FULL TIME EMPLOYEES |
| `BKPREM` | Balance Sheet Detail | Phase 3 (Depth and market structure) | PREMISES AND FIXED ASSETS |
| `ORE` | Balance Sheet Detail | Phase 3 (Depth and market structure) | OTHER REAL ESTATE OWNED |
| `INTAN` | Balance Sheet Detail | Phase 3 (Depth and market structure) | INTANGIBLE ASSETS |
| `FREPO` | Liquidity/Market | Phase 3 (Depth and market structure) | FED FUNDS & REPOS SOLD |
| `SC` | Liquidity/Market | Phase 3 (Depth and market structure) | SECURITIES |
| `CHBAL` | Liquidity/Market | Phase 3 (Depth and market structure) | CASH & DUE FROM DEPOSITORY INST |
| `TRADE` | Liquidity/Market | Phase 3 (Depth and market structure) | TRADING ACCOUNTS |
| `TRNFC` | Liquidity/Market | Phase 3 (Depth and market structure) | TRANSACTION-FOR COUNTRY |
| `TRNUSGOV` | Liquidity/Market | Phase 3 (Depth and market structure) | TRANSACTION-U.S. GOVERNMENT |
| `TRNMUNI` | Liquidity/Market | Phase 3 (Depth and market structure) | TRANSACTION-MUNI |
| `REPOPURF` | Liquidity/Market | Phase 3 (Depth and market structure) | REPURCHASE AGREEMENT-FOR |

## Prioritized Add-First Rollout

### Phase 1 (Core analyst workflows)

- `INTINC`, `INTINQ`, `EINTEXP`, `EINTXQ`, `NONII`, `NONIX`, `IBEFTAX`, `PTAXNETINC`, `NETIMIN`, `ROE`, `INTINCY`, `INTEXPY`, `ERNAST`, `ERNAST5`, `NIM`, `DDT`, `TRN`, `TRNIPC`, `TRNIPCOC`, `NTR`, `NTRIPC`, `NTRSMMDA`, `NTRSOTH`, `DEPINS`, `DEPUNINS`

### Phase 2 (Risk and resilience)

- `NALNLS`, `NCLNLS`, `P3LNLS`, `P9LNLS`, `DRLNLS`, `CRLNLS`, `ELNLOS`, `SUBLLPF`, `NACRCD`, `NCCRCD`, `P3CRCD`, `P9CRCD`, `EQCS`, `EQSUR`, `EQUPTOT`, `RBCT1`, `RBCT2`, `RBC`, `RWAJ`, `LIAB`

### Phase 3 (Depth and market structure)

- `OFFDOM`, `OFFFOR`, `OFFTOT`, `NUMEMP`, `BKPREM`, `ORE`, `INTAN`, `FREPO`, `SC`, `CHBAL`, `TRADE`, `TRNFC`, `TRNUSGOV`, `TRNMUNI`, `REPOPURF`

## Notes

- `call_report_line` is best-effort from available public metadata. Many fields expose RIS mappings but not explicit Schedule/Line annotations.
- `present_in_current_db` is inferred from repo schema/ingestion code, per project direction.
