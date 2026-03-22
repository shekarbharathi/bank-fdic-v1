-- Migration 0004: Fix NUMERIC overflow for ratio columns
-- FDIC may return very large values; use NUMERIC(18,4) to avoid overflow

ALTER TABLE financials
  ALTER COLUMN roa TYPE NUMERIC(18,4),
  ALTER COLUMN roaptx TYPE NUMERIC(18,4),
  ALTER COLUMN nimy TYPE NUMERIC(18,4),
  ALTER COLUMN elnatr TYPE NUMERIC(18,4),
  ALTER COLUMN eq TYPE NUMERIC(18,4);
