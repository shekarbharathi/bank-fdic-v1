/** Default metric labels and formatting for the bank explorer table (merged with field_metadata). */
export const METRIC_DEFS_DEFAULT = {
  assets: {
    id: 'assets',
    label: 'Assets',
    kind: 'dollar',
    explanation: 'Total bank assets (latest report). Larger banks are shown first by default.',
  },
  roa: {
    id: 'roa',
    label: 'ROA',
    kind: 'percent',
    explanation: 'Return on Assets: net income as a percent of total assets. Higher generally means stronger profitability.',
  },
  capital_ratio: {
    id: 'capital_ratio',
    label: 'Capital Ratio',
    kind: 'percent',
    explanation: 'Capital ratio: equity divided by assets (percentage). Higher suggests a stronger capital position.',
  },
  deposits: {
    id: 'deposits',
    label: 'Deposits',
    kind: 'dollar',
    explanation: 'Total deposits (latest report). Helpful for understanding funding strength.',
  },
  netinc: {
    id: 'netinc',
    label: 'Net Income',
    kind: 'dollar',
    explanation: 'Net income (latest report). A core profitability signal for banks.',
  },
  nimy: {
    id: 'nimy',
    label: 'Net Interest Margin',
    kind: 'percent',
    explanation: 'Net interest margin (NIM): net interest income relative to earning assets.',
  },
  roaptx: {
    id: 'roaptx',
    label: 'ROAPTX',
    kind: 'percent',
    explanation: 'Alternative ROA measure used in FDIC data (ROAPTX).',
  },
  lnlsnet: {
    id: 'lnlsnet',
    label: 'LNLSNET',
    kind: 'percent',
    explanation: 'A FDIC efficiency/loan loss net metric. Higher/lower indicates different risk patterns depending on definition.',
  },
  elnatr: {
    id: 'elnatr',
    label: 'ELNATR',
    kind: 'percent',
    explanation: 'A FDIC risk metric related to expected losses and net charge-offs.',
  },
  /** Loan breakdowns — API columns often use *_dollars; normalized in bankDataNormalization.extractExtraMetric */
  credit_card_loans: {
    id: 'credit_card_loans',
    label: 'Credit Card Loans',
    kind: 'dollar',
    explanation: 'Credit card loans outstanding.',
  },
  real_estate_loans: {
    id: 'real_estate_loans',
    label: 'Real Estate Loans',
    kind: 'dollar',
    explanation: 'Real estate loans outstanding.',
  },
  commercial_industrial_loans: {
    id: 'commercial_industrial_loans',
    label: 'Commercial & Industrial Loans',
    kind: 'dollar',
    explanation: 'Commercial and industrial loans outstanding.',
  },
  residential_real_estate_loans: {
    id: 'residential_real_estate_loans',
    label: 'Residential Real Estate Loans',
    kind: 'dollar',
    explanation: 'Residential real estate loans outstanding.',
  },
};
