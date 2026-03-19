-- Migration: Full FDIC financial field model for >1100 fields
-- Why: FDIC field universe exceeds practical "single wide table" limits.
-- Approach: keep curated financials table + add dictionary + long-form values table.

BEGIN;

-- 1) Canonical field dictionary for all FDIC variables
CREATE TABLE IF NOT EXISTS fdic_field_dictionary (
    field_name TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    data_type TEXT,
    call_report_line TEXT,
    source TEXT DEFAULT 'fdic',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fdic_field_dictionary_title
    ON fdic_field_dictionary USING gin (to_tsvector('english', COALESCE(title, '')));

CREATE INDEX IF NOT EXISTS idx_fdic_field_dictionary_description
    ON fdic_field_dictionary USING gin (to_tsvector('english', COALESCE(description, '')));

-- 2) Long-form FDIC financial values (supports arbitrary field growth)
CREATE TABLE IF NOT EXISTS financials_kv (
    cert INTEGER NOT NULL,
    repdte DATE NOT NULL,
    field_name TEXT NOT NULL REFERENCES fdic_field_dictionary(field_name),
    value_num NUMERIC,
    value_text TEXT,
    source_row_updated_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cert, repdte, field_name)
);

CREATE INDEX IF NOT EXISTS idx_financials_kv_cert_repdte
    ON financials_kv (cert, repdte);

CREATE INDEX IF NOT EXISTS idx_financials_kv_field_repdte
    ON financials_kv (field_name, repdte DESC);

CREATE INDEX IF NOT EXISTS idx_financials_kv_repdte
    ON financials_kv (repdte DESC);

-- Optional helper index for numeric filtering by specific fields
CREATE INDEX IF NOT EXISTS idx_financials_kv_field_value_num
    ON financials_kv (field_name, value_num);

COMMIT;

