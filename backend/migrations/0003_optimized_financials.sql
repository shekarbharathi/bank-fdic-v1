-- Migration: Optimized financials table (35 fields, 8 groups) + field_metadata for UI
-- Target: <500 MB with 5 years, ACTIVE banks only (~4.5K banks x 20 quarters)

BEGIN;

-- Ensure institutions exists (for optimized ingestion join)
CREATE TABLE IF NOT EXISTS institutions (
    cert INTEGER PRIMARY KEY,
    name VARCHAR(255),
    city VARCHAR(100),
    stalp VARCHAR(2),
    stname VARCHAR(50),
    zip VARCHAR(10),
    asset NUMERIC,
    dep NUMERIC,
    depdom NUMERIC,
    bkclass VARCHAR(5),
    charter VARCHAR(10),
    dateupdt DATE,
    active INTEGER,
    fed_rssd INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_institutions_name ON institutions(name);
CREATE INDEX IF NOT EXISTS idx_institutions_active ON institutions(active);

-- Drop existing financials (replaced by optimized schema)
DROP TABLE IF EXISTS financials CASCADE;

-- Table 1: financials (main data table)
CREATE TABLE financials (
    id SERIAL PRIMARY KEY,
    cert INTEGER NOT NULL,
    repdte DATE NOT NULL,

    -- GROUP 2: Size & Balance Sheet (thousands, BIGINT)
    asset BIGINT,
    dep BIGINT,
    depdom BIGINT,
    eqtot BIGINT,
    lnlsnet BIGINT,
    earna BIGINT,
    ilndom BIGINT,
    chbal BIGINT,

    -- GROUP 3: Deposit Breakdown
    dpmmd BIGINT,
    dpsav BIGINT,
    brttrans BIGINT,
    p2215 BIGINT,

    -- GROUP 4: Loan Breakdown
    lncrcd BIGINT,
    lnre BIGINT,
    lnci BIGINT,
    lnresre BIGINT,

    -- GROUP 5: Income Statement
    intinc BIGINT,
    intexp BIGINT,
    nonii BIGINT,
    nonix BIGINT,
    netinc BIGINT,
    sc BIGINT,

    -- GROUP 6: Profitability Ratios (percentage, NUMERIC - 18,4 for FDIC outliers)
    roa NUMERIC(18,4),
    roaptx NUMERIC(18,4),
    nimy NUMERIC(18,4),

    -- GROUP 7: Asset Quality & Safety
    elnatr NUMERIC(18,4),
    eq NUMERIC(18,4),
    rbct BIGINT,
    rbcrwaj BIGINT,
    lnatres BIGINT,

    -- GROUP 8: Operations
    numemp INTEGER,
    offdom INTEGER,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cert, repdte)
);

CREATE INDEX idx_financials_cert ON financials(cert);
CREATE INDEX idx_financials_repdte ON financials(repdte);

-- Table 2: field_metadata (UI grouping and descriptions)
CREATE TABLE field_metadata (
    id SERIAL PRIMARY KEY,
    field_name VARCHAR(50) NOT NULL UNIQUE,
    fdic_field_code VARCHAR(50),
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    group_id INTEGER NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    display_order INTEGER,
    data_type VARCHAR(20),
    unit VARCHAR(50),
    is_ratio BOOLEAN DEFAULT FALSE,
    is_currency BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_field_metadata_group ON field_metadata(group_id, display_order);

-- Populate field metadata with grouping
INSERT INTO field_metadata (field_name, fdic_field_code, display_name, description, group_id, group_name, display_order, data_type, unit, is_ratio, is_currency) VALUES
('cert', 'CERT', 'Certificate Number', 'Unique FDIC certificate number', 1, 'Identifiers & Dates', 1, 'integer', NULL, FALSE, FALSE),
('repdte', 'REPDTE', 'Report Date', 'Quarter-end date for this data', 1, 'Identifiers & Dates', 2, 'date', NULL, FALSE, FALSE),

('asset', 'ASSET', 'Total Assets', 'Total assets of the institution', 2, 'Size & Balance Sheet', 1, 'bigint', 'thousands', FALSE, TRUE),
('dep', 'DEP', 'Total Deposits', 'Total deposits held', 2, 'Size & Balance Sheet', 2, 'bigint', 'thousands', FALSE, TRUE),
('depdom', 'DEPDOM', 'Domestic Deposits', 'Deposits in domestic offices only', 2, 'Size & Balance Sheet', 3, 'bigint', 'thousands', FALSE, TRUE),
('eqtot', 'EQTOT', 'Total Equity Capital', 'Stockholders equity', 2, 'Size & Balance Sheet', 4, 'bigint', 'thousands', FALSE, TRUE),
('lnlsnet', 'LNLSNET', 'Net Loans and Leases', 'Total loans and leases, net', 2, 'Size & Balance Sheet', 5, 'bigint', 'thousands', FALSE, TRUE),
('earna', 'EARNA', 'Earning Assets', 'Total earning assets', 2, 'Size & Balance Sheet', 6, 'bigint', 'thousands', FALSE, TRUE),
('ilndom', 'ILNDOM', 'Domestic Loans', 'Total loans in domestic offices', 2, 'Size & Balance Sheet', 7, 'bigint', 'thousands', FALSE, TRUE),
('chbal', 'CHBAL', 'Cash and Balances', 'Cash and balances due', 2, 'Size & Balance Sheet', 8, 'bigint', 'thousands', FALSE, TRUE),

('dpmmd', 'DPMMD', 'Money Market Deposit Accounts', 'MMDAs', 3, 'Deposit Breakdown', 1, 'bigint', 'thousands', FALSE, TRUE),
('dpsav', 'DPSAV', 'Other Savings Deposits', 'Savings excluding MMDAs', 3, 'Deposit Breakdown', 2, 'bigint', 'thousands', FALSE, TRUE),
('brttrans', 'P6631/BRTTRANS', 'Total Transaction Accounts', 'Domestic transaction accounts', 3, 'Deposit Breakdown', 3, 'bigint', 'thousands', FALSE, TRUE),
('p2215', 'P2215', 'IPC Transaction Accounts', 'Transaction accounts: Individuals, Partnerships, Corporations', 3, 'Deposit Breakdown', 4, 'bigint', 'thousands', FALSE, TRUE),

('lncrcd', 'LNCRCD', 'Credit Card Loans', 'Credit card loans to individuals', 4, 'Loan Breakdown', 1, 'bigint', 'thousands', FALSE, TRUE),
('lnre', 'LNRE', 'Real Estate Loans', 'Total real estate loans', 4, 'Loan Breakdown', 2, 'bigint', 'thousands', FALSE, TRUE),
('lnci', 'LNCI', 'Commercial & Industrial Loans', 'C&I loans', 4, 'Loan Breakdown', 3, 'bigint', 'thousands', FALSE, TRUE),
('lnresre', 'LNRESRE', 'Residential Real Estate Loans', 'Residential RE loans', 4, 'Loan Breakdown', 4, 'bigint', 'thousands', FALSE, TRUE),

('intinc', 'INTINC', 'Total Interest Income', 'Interest and fee income', 5, 'Income Statement', 1, 'bigint', 'thousands', FALSE, TRUE),
('intexp', 'INTEXP', 'Total Interest Expense', 'Interest expense', 5, 'Income Statement', 2, 'bigint', 'thousands', FALSE, TRUE),
('nonii', 'NONII', 'Noninterest Income', 'Total noninterest income', 5, 'Income Statement', 3, 'bigint', 'thousands', FALSE, TRUE),
('nonix', 'NONIX', 'Noninterest Expense', 'Total noninterest expense', 5, 'Income Statement', 4, 'bigint', 'thousands', FALSE, TRUE),
('netinc', 'NETINC', 'Net Income', 'Net income after taxes', 5, 'Income Statement', 5, 'bigint', 'thousands', FALSE, TRUE),
('sc', 'SC', 'Service Charges', 'Service charges on deposit accounts', 5, 'Income Statement', 6, 'bigint', 'thousands', FALSE, TRUE),

('roa', 'ROA', 'Return on Assets', 'Net income / Average assets', 6, 'Profitability & Efficiency', 1, 'numeric', 'percentage', TRUE, FALSE),
('roaptx', 'ROAPTX', 'Return on Assets (Pre-Tax)', 'Pre-tax income / Average assets', 6, 'Profitability & Efficiency', 2, 'numeric', 'percentage', TRUE, FALSE),
('nimy', 'NIMY', 'Net Interest Margin', 'Net interest income / Earning assets', 6, 'Profitability & Efficiency', 3, 'numeric', 'percentage', TRUE, FALSE),

('elnatr', 'ELNATR', 'Noncurrent Loans Ratio', 'Noncurrent loans / Total loans', 7, 'Asset Quality & Safety', 1, 'numeric', 'percentage', TRUE, FALSE),
('eq', 'EQ', 'Equity Capital Ratio', 'Equity / Assets', 7, 'Asset Quality & Safety', 2, 'numeric', 'percentage', TRUE, FALSE),
('rbct', 'RBCT1', 'Tier 1 Capital', 'Risk-based capital tier 1', 7, 'Asset Quality & Safety', 3, 'bigint', 'thousands', FALSE, TRUE),
('rbcrwaj', 'RWAJ', 'Risk-Weighted Assets', 'Total risk-weighted assets', 7, 'Asset Quality & Safety', 4, 'bigint', 'thousands', FALSE, TRUE),
('lnatres', 'LNATRES', 'Loan Loss Allowance', 'Allowance for loan and lease losses', 7, 'Asset Quality & Safety', 5, 'bigint', 'thousands', FALSE, TRUE),

('numemp', 'NUMEMP', 'Number of Employees', 'Full-time equivalent employees', 8, 'Operations & Infrastructure', 1, 'integer', 'count', FALSE, FALSE),
('offdom', 'OFFDOM', 'Domestic Offices', 'Number of domestic offices/branches', 8, 'Operations & Infrastructure', 2, 'integer', 'count', FALSE, FALSE);

COMMIT;
