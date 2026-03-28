# Banks tab — manual test matrix (multi-viz routing)

Use the Banks chat after the backend is running with LLM configured. Confirm the main area matches the expected **experience** (table, scalar, or placeholder viz).

| Query (example) | Expected intent / viz | Expected UI |
|-----------------|------------------------|-------------|
| Top 10 banks by total deposits | `browse_table` / table | `BankExplorerTable` with multiple rows |
| What is the total number of active banks? (single aggregate) | scalar (1×1 row) | Large single value |
| Compare JPMorgan Chase and Bank of America by assets | `compare_banks` (if model returns it) | `BankComparisonViz` placeholder |
| Show deposits over time for one bank | `trend_tracker` / time_series | `TrendChartViz` |
| Distribution of ROA across banks in Texas | `metric_explorer` | `MetricExplorerViz` |
| Banks in California summary by region | `state_explorer` | `StateOverviewViz` |
| Banks similar in size to a given cert | `peer_group` | `PeerGroupViz` |
| Unrelated question (e.g. weather) | refusal | Suggestions panel; API may return `error_code: out_of_scope` |

**Surprising facts:** Use **Explore with query** on the Insights carousel; it should populate the chat and run the same pipeline as a manual submit.

**Backend parser:** Run `cd backend && python -m unittest tests.test_llm_response_parser`.
