# Railway FDIC Full-Field Migration Plan

## Goal

Ingest and query the full FDIC financial field universe (1100+ fields; currently ~2300 in published metadata) while preserving app stability, query safety, and text-to-SQL quality.

## Why Not A Single Wide Table

- PostgreSQL has practical/structural limits on max columns per table.
- FDIC publishes more fields than are safe for a single `financials` table design.
- A long-form model scales without future schema rewrites.

## Target Data Model

1. Keep current curated table:
   - `financials(cert, repdte, asset, dep, depdom, eqtot, roa, roaptx, netinc, nimy, lnlsnet, elnatr, updated_at)`
2. Add field dictionary:
   - `fdic_field_dictionary(field_name, title, description, data_type, call_report_line, source, updated_at)`
3. Add long-form values table:
   - `financials_kv(cert, repdte, field_name, value_num, value_text, source_row_updated_at, updated_at)`
   - PK: `(cert, repdte, field_name)`
   - Indexes for `(field_name, repdte)` and `(cert, repdte)`

## Migration Steps (Railway)

### Phase 1: Schema rollout (safe, no app behavior change)

1. Apply SQL migration:
   - `backend/migrations/0002_fdic_full_field_model.sql`
2. Verify tables and indexes:
   - `fdic_field_dictionary`
   - `financials_kv`
3. Keep existing endpoints and UI unchanged.

### Phase 2: Dictionary load

1. Generate/refresh local FDIC catalog (already available in `docs/data/fdic_field_reference.csv`).
2. Run ingestion script:
   - `python3 backend/fdic_full_ingestion.py`
3. Verify dictionary cardinality:
   - Expect ~2000+ rows in `fdic_field_dictionary`.

### Phase 3: Historical backfill into `financials_kv`

1. Run `backend/fdic_full_ingestion.py` with date windows using env:
   - `FDIC_MIN_REPDTE` (example: `2001-01-01`)
2. Execute in batches/chunks to avoid FDIC URL-length/timeouts.
3. Monitor Railway metrics (CPU, memory, lock waits).

### Phase 4: Prompt + query behavior upgrade

1. Use updated schema context in `backend/services/schema_builder.py`:
   - Includes long-form model guidance
   - Includes FDIC field dictionary excerpt for LLM grounding
2. Use updated instructions in `backend/services/text_to_sql.py`:
   - Prefer `fdic_field_dictionary` + `financials_kv` when available
   - Preserve dollar scaling behavior (`* 1000`)

### Phase 5: Validation and release

1. Regression checks:
   - Existing curated financial queries continue to pass.
   - New queries over fields like `LNCRCD`, `TRNIPCOC`, `NTRSMMDA`, `INTINCY`, `INTEXPY` succeed.
2. Performance checks:
   - Ensure field-specific queries use `idx_financials_kv_field_repdte`.
3. Deploy to production Railway service.

## Operational Recommendations

- Run full backfill as a one-off job service in Railway, not in request path.
- Keep curated `financials` table for common UI paths and low-latency ranking/sorting.
- Use `financials_kv` for long-tail analytics and new metric discovery.
- Refresh `fdic_field_dictionary` periodically (monthly/quarterly) from FDIC definitions.

## Rollback

- App remains functional using curated `financials` table if `financials_kv` population is paused.
- To rollback new model usage, revert prompt preference to curated tables only.

