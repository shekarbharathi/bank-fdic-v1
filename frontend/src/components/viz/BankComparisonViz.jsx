import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import './TrendChartViz.css';
import './VizPlaceholder.css';

const PALETTE = [
  '#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed',
  '#0891b2', '#db2777', '#ea580c',
];

const METRIC_LABELS = {
  asset: 'Total Assets',
  assets: 'Total Assets',
  assets_dollars: 'Total Assets',
  total_assets_dollars: 'Total Assets',
  dep: 'Deposits',
  deposits: 'Deposits',
  deposits_dollars: 'Deposits',
  total_deposits_dollars: 'Deposits',
  netinc: 'Net Income',
  net_income_dollars: 'Net Income',
  roa: 'ROA',
  return_on_assets: 'ROA',
  nimy: 'Net Interest Margin',
  net_interest_margin: 'Net Interest Margin',
  eqtot: 'Equity Capital',
  roaptx: 'Pretax ROA',
  lnlsnet: 'Net Loans & Leases',
  elnatr: 'Efficiency Ratio',
  capital_ratio: 'Capital Ratio',
};

const RATE_METRICS = new Set([
  'roa', 'return_on_assets', 'nimy', 'net_interest_margin',
  'roaptx', 'elnatr', 'capital_ratio',
]);

function isRateMetric(key) {
  return RATE_METRICS.has(String(key).toLowerCase());
}

function isCurrencyMetric(key) {
  return /asset|dep|netinc|net_income|eqtot|equity|lnlsnet|income|deposit|dollars/i.test(String(key));
}

function formatDate(raw) {
  const s = String(raw || '');
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    return `${m}/${d}/${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${m}/${d}/${y}`;
  }
  return s.slice(0, 10);
}

function formatAxisTick(val, metricKey) {
  if (!Number.isFinite(val)) return '';
  if (isRateMetric(metricKey)) return `${val.toFixed(1)}%`;
  if (isCurrencyMetric(metricKey)) {
    const abs = Math.abs(val);
    if (abs >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
    if (abs >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  }
  if (Number.isInteger(val)) return val.toLocaleString();
  return val.toFixed(2);
}

function formatTooltipValue(val, metricKey) {
  if (!Number.isFinite(Number(val))) return String(val);
  const n = Number(val);
  if (isRateMetric(metricKey)) return `${n.toFixed(2)}%`;
  if (isCurrencyMetric(metricKey)) {
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${n.toLocaleString()}`;
  }
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

function labelForMetric(key) {
  const k = String(key);
  return METRIC_LABELS[k] || METRIC_LABELS[k.toLowerCase()] || k.replace(/_/g, ' ');
}

function pickDate(row) {
  return row.repdte ?? row.REPORT_DATE ?? row.report_date ?? row.REPDTE ?? row.date ?? row.DATE;
}

function bankSeriesKey(row) {
  const c = row.cert ?? row.CERT;
  if (c !== undefined && c !== null && String(c).trim() !== '') return `b_${String(c)}`;
  const n = row.bank_name ?? row.BANK_NAME ?? row.name ?? row.NAME;
  if (n != null && String(n).trim() !== '') return `n_${String(n).slice(0, 48)}`;
  return null;
}

function bankDisplayName(row) {
  return String(
    row.bank_name ?? row.BANK_NAME ?? row.name ?? row.NAME ?? (row.cert != null ? `Cert ${row.cert}` : 'Bank')
  );
}

const SKIP_METRIC_KEYS = new Set([
  'cert', 'repdte', 'report_date', 'date', 'city', 'stalp', 'stname', 'zip',
]);

function discoverNumericMetrics(sample) {
  if (!sample || typeof sample !== 'object') return [];
  return Object.keys(sample).filter((k) => {
    const kl = k.toLowerCase();
    if (kl === 'cert') return false;
    if (SKIP_METRIC_KEYS.has(kl)) return false;
    const v = sample[k];
    return typeof v === 'number' && Number.isFinite(v);
  });
}

function computeYDomain(chartData, lineKeys, metricKey) {
  const vals = [];
  for (const row of chartData) {
    for (const lk of lineKeys) {
      const v = row[lk];
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
  }
  if (vals.length === 0) return undefined;
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = maxV - minV;
  const pad = span > 0 ? span * 0.12 : Math.max(Math.abs(maxV) * 0.02, 1);
  if (isRateMetric(metricKey)) {
    const low = Math.min(0, minV - (span > 0 ? span * 0.15 : 0.1));
    const high = maxV + (span > 0 ? span * 0.15 : 0.1);
    return [low, high];
  }
  if (minV === maxV) {
    const b = Math.max(Math.abs(minV) * 0.05, 1);
    return [minV - b, maxV + b];
  }
  return [minV - pad, maxV + pad];
}

/**
 * Pivot long-format rows (date × bank × metrics) into wide rows (date × one column per bank) for one metric.
 */
function pivotMetricSeries(rows, metricKey) {
  const byDate = new Map();
  const bankLabels = new Map();

  for (const row of rows) {
    const d = pickDate(row);
    const bk = bankSeriesKey(row);
    if (d == null || bk == null) continue;
    const v = row[metricKey];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    bankLabels.set(bk, bankDisplayName(row));
    const dk = String(d);
    if (!byDate.has(dk)) byDate.set(dk, new Map());
    byDate.get(dk).set(bk, v);
  }

  const sortedDates = [...byDate.keys()].sort();
  const lineKeys = [...bankLabels.keys()];

  const chartData = sortedDates.map((dk) => {
    const point = { _x: dk, _date: formatDate(dk) };
    const m = byDate.get(dk);
    for (const lk of lineKeys) {
      const val = m?.get(lk);
      point[lk] = val !== undefined ? val : null;
    }
    return point;
  });

  return { chartData, lineKeys, bankLabels };
}

function ComparisonTooltip({ active, payload, label, metricKey }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-date">{formatDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="trend-tooltip-row">
          <span className="trend-tooltip-dot" style={{ background: entry.color }} />
          <span className="trend-tooltip-label">{entry.name}</span>
          <span className="trend-tooltip-value">{formatTooltipValue(entry.value, metricKey)}</span>
        </div>
      ))}
    </div>
  );
}

/** compare_banks: multi-bank time series — one line chart per metric, one line per bank. */
export default function BankComparisonViz({ data, title, config }) {
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const metrics = useMemo(() => {
    const sample = rows[0];
    if (!sample) return [];
    const fromConfig = config?.metrics;
    if (Array.isArray(fromConfig) && fromConfig.length > 0) {
      return fromConfig.filter((m) => typeof sample[m] === 'number' && Number.isFinite(sample[m]));
    }
    return discoverNumericMetrics(sample);
  }, [rows, config?.metrics]);

  const hasTimeAndBanks = useMemo(() => {
    if (rows.length < 2) return false;
    let dates = 0;
    const banks = new Set();
    for (const row of rows) {
      if (pickDate(row) != null) dates++;
      const bk = bankSeriesKey(row);
      if (bk) banks.add(bk);
    }
    return dates >= 1 && banks.size >= 1;
  }, [rows]);

  const charts = useMemo(() => {
    if (!hasTimeAndBanks || metrics.length === 0) return [];
    return metrics.map((metricKey) => {
      const { chartData, lineKeys, bankLabels } = pivotMetricSeries(rows, metricKey);
      const yDomain = computeYDomain(chartData, lineKeys, metricKey);
      return { metricKey, chartData, lineKeys, bankLabels, yDomain };
    }).filter((c) => c.chartData.length > 0 && c.lineKeys.length > 0);
  }, [rows, metrics, hasTimeAndBanks]);

  if (rows.length === 0) {
    return (
      <div className="viz-placeholder viz-trend" role="region" aria-label={title || 'Bank comparison'}>
        <p className="viz-placeholder-hint">No comparison data.</p>
      </div>
    );
  }

  if (!hasTimeAndBanks || charts.length === 0) {
    return (
      <div className="viz-placeholder viz-trend" role="region" aria-label={title || 'Bank comparison'}>
        {title ? <h3 className="viz-placeholder-title">{title}</h3> : null}
        <p className="viz-placeholder-hint">
          Need reporting dates and bank identifiers (e.g. bank_name, cert) to plot comparison over time.
        </p>
        <pre className="viz-placeholder-pre">{JSON.stringify(rows.slice(0, 6), null, 2)}</pre>
      </div>
    );
  }

  return (
    <div className="viz-placeholder viz-trend" role="region" aria-label={title || 'Bank comparison'}>
      {title ? <h3 className="viz-placeholder-title">{title}</h3> : null}
      <p className="viz-placeholder-hint">
        {charts.length} metric{charts.length === 1 ? '' : 's'} · {rows.length} rows
      </p>

      <div className="viz-comparison-charts">
        {charts.map(({ metricKey, chartData, lineKeys, bankLabels, yDomain }) => (
          <div key={metricKey} className="viz-comparison-chart-block">
            <h4 className="viz-comparison-metric-title">{labelForMetric(metricKey)}</h4>
            <div className="viz-chart-wrap viz-chart-wrap--trend">
              <ResponsiveContainer width="100%" height={chartData.length > 30 ? 380 : 320}>
                <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="_x"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    interval={chartData.length > 40 ? 'preserveStart' : 'preserveStartEnd'}
                    minTickGap={chartData.length > 20 ? 24 : 8}
                  />
                  <YAxis
                    domain={yDomain || ['auto', 'auto']}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={(v) => formatAxisTick(v, metricKey)}
                    width={78}
                  />
                  <Tooltip
                    content={<ComparisonTooltip metricKey={metricKey} />}
                    labelFormatter={(x) => x}
                  />
                  <Legend
                    formatter={(value) => bankLabels.get(value) || value}
                    wrapperStyle={{ fontSize: '0.8rem' }}
                  />
                  {lineKeys.map((lk, i) => (
                    <Line
                      key={lk}
                      type="monotone"
                      dataKey={lk}
                      name={bankLabels.get(lk) || lk}
                      stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
