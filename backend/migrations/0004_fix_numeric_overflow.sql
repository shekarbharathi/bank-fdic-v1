-- Migration 0004: Fix NUMERIC(5,2) overflow for ratio columns
-- FDIC may return values > 999.99 (e.g. basis points); widen to NUMERIC(10,2)

ALTER TABLE financials
  ALTER COLUMN roa TYPE NUMERIC(10,2),
  ALTER COLUMN roaptx TYPE NUMERIC(10,2),
  ALTER COLUMN nimy TYPE NUMERIC(10,2),
  ALTER COLUMN elnatr TYPE NUMERIC(10,2),
  ALTER COLUMN eq TYPE NUMERIC(10,2);
