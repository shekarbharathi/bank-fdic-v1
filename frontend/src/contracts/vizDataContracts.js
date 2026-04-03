/**
 * Per-experience data shape contracts.
 *
 * These document the expected shape of `data` (the row array from ChatResponse)
 * for each visualization experience. The backend LLM generates SQL whose result
 * set should conform to these shapes. The frontend viz components rely on these
 * field names (case-insensitive matching via pickCaseInsensitive where needed).
 *
 * Keep in sync with backend INTENT_JSON_RULES in services/text_to_sql.py.
 */

/**
 * browse_table / table experience.
 * Rows are individual banks with optional metric columns.
 * Normalized on the frontend by normalizeBankRows().
 *
 * @typedef {Object} TableRow
 * @property {number}  cert              - FDIC certificate number (unique bank ID)
 * @property {string}  bank_name         - Institution name (aliases: name, institution_name)
 * @property {string}  [city]            - City
 * @property {string}  [stalp]           - State abbreviation (e.g. "CA")
 * @property {string}  [stname]          - Full state name
 * @property {string}  [report_date]     - Reporting period (aliases: repdte)
 * @property {number}  [asset]           - Total assets in thousands (FDIC native unit)
 * @property {number}  [dep]             - Deposits in thousands
 * @property {number}  [netinc]          - Net income in thousands
 * @property {number}  [roa]             - Return on assets (percentage)
 * @property {number}  [eqtot]           - Total equity capital in thousands
 * @property {number}  [nimy]            - Net interest margin (percentage)
 * @property {number}  [roaptx]          - Return on assets (pretax, percentage)
 * @property {number}  [lnlsnet]         - Net loans & leases in thousands
 * @property {number}  [elnatr]          - Efficiency ratio
 */

/**
 * scalar experience.
 * Exactly one row with exactly one column whose value is the answer.
 *
 * @typedef {Object} ScalarRow
 * @property {number|string} [column_name] - Single aggregate value (count, sum, avg, etc.)
 */

/**
 * compare_banks experience.
 * 2-4 rows, one per bank, with shared metric columns for side-by-side comparison.
 *
 * @typedef {Object} ComparisonRow
 * @property {number}  cert         - FDIC certificate number
 * @property {string}  bank_name    - Institution name
 * @property {number}  [asset]      - Total assets in thousands
 * @property {number}  [dep]        - Deposits in thousands
 * @property {number}  [roa]        - Return on assets
 * @property {number}  [eqtot]      - Total equity capital in thousands
 * @property {number}  [nimy]       - Net interest margin
 * @property {number}  [netinc]     - Net income in thousands
 * @property {string}  [stalp]      - State abbreviation
 *
 * visualization.config may include:
 *   { metrics: string[], bank_names: string[] }
 */

/**
 * trend_tracker experience.
 * Multiple rows ordered by date, each representing a reporting period.
 * May track one bank over time or an aggregate across banks.
 *
 * @typedef {Object} TrendRow
 * @property {string}  repdte          - Reporting date (YYYYMMDD or YYYY-MM-DD)
 * @property {string}  [bank_name]     - Bank name (present when tracking a single bank)
 * @property {number}  [cert]          - FDIC cert (present when tracking a single bank)
 * @property {number}  [asset]         - Total assets in thousands
 * @property {number}  [dep]           - Deposits in thousands
 * @property {number}  [roa]           - Return on assets
 * @property {number}  [nimy]          - Net interest margin
 * @property {number}  [netinc]        - Net income in thousands
 *
 * visualization.config may include:
 *   { metrics: string[], chart_type: "line"|"area", bank_name: string }
 */

/**
 * metric_explorer experience.
 * Rows represent banks or buckets showing distribution/landscape of a metric.
 *
 * @typedef {Object} MetricExplorerRow
 * @property {string}  [bank_name]     - Bank name (when showing per-bank values)
 * @property {number}  [cert]          - FDIC cert
 * @property {number}  [roa]           - Metric value (key depends on the metric being explored)
 * @property {number}  [asset]         - Used for context or as explored metric
 * @property {number}  [dep]
 * @property {number}  [nimy]
 * @property {string}  [bucket]        - Bucket label (when binned distribution)
 * @property {number}  [count]         - Count in bucket
 *
 * visualization.config may include:
 *   { metric: string, metric_display_name: string, chart_type: "bar"|"histogram" }
 */

/**
 * state_explorer experience.
 * Rows represent banks within a state, or aggregated state-level statistics.
 * Used to render a map or state overview dashboard.
 *
 * @typedef {Object} StateExplorerRow
 * @property {string}  [stalp]         - State abbreviation (e.g. "TX")
 * @property {string}  [stname]        - Full state name
 * @property {number}  [bank_count]    - Number of banks in the state
 * @property {number}  [total_assets]  - Sum of assets (dollars or thousands)
 * @property {number}  [total_deposits]- Sum of deposits
 * @property {number}  [avg_roa]       - Average ROA across banks in the state
 * @property {number}  [avg_nimy]      - Average net interest margin
 * @property {string}  [bank_name]     - Individual bank name (when listing banks in a state)
 * @property {number}  [cert]          - Individual bank cert
 * @property {number}  [asset]         - Individual bank assets
 *
 * visualization.config may include:
 *   { state: string, state_code: string, metric: string }
 */

/**
 * peer_group experience.
 * Rows represent banks similar to a target bank.
 *
 * @typedef {Object} PeerGroupRow
 * @property {number}  cert         - FDIC certificate number
 * @property {string}  bank_name    - Institution name
 * @property {number}  [asset]      - Total assets in thousands
 * @property {number}  [dep]        - Deposits in thousands
 * @property {number}  [roa]        - Return on assets
 * @property {number}  [nimy]       - Net interest margin
 * @property {string}  [stalp]      - State abbreviation
 *
 * visualization.config may include:
 *   { target_cert: number, target_bank: string }
 */

/**
 * Maps experience name to a human-readable description of the expected data.
 * Useful for runtime diagnostics and developer tooling.
 */
export const EXPERIENCE_DATA_DESCRIPTIONS = {
  table: 'Array of bank rows with cert, bank_name, and optional metric columns',
  scalar: 'Single row with a single numeric/string column',
  compare_banks: '2-4 bank rows with shared metric columns for side-by-side comparison',
  trend_tracker: 'Rows ordered by repdte with metric columns for time-series plotting',
  metric_explorer: 'Rows with a focal metric for distribution/landscape visualization',
  state_explorer: 'State-level aggregates or bank rows for a specific state, for map rendering',
  peer_group: 'Bank rows representing peers of a target bank',
};
