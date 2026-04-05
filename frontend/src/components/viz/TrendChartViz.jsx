import { useMemo, useState } from 'react';
import {
  LineChart,
  AreaChart,
  Line,
  Area,
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
  total_assets: 'Total Assets',
  total_assets_dollars: 'Total Assets',
  dep: 'Deposits',
  total_deposits: 'Deposits',
  total_deposits_dollars: 'Deposits',
  netinc: 'Net Income',
  net_income_dollars: 'Net Income',
  roa: 'ROA',
  return_on_assets: 'ROA',
  nimy: 'Net Interest Margin',
  net_interest_margin: 'Net Interest Margin',
  eqtot: 'Equity Capital',
  total_equity_capital_dollars: 'Equity Capital',
  roaptx: 'Pretax ROA',
  lnlsnet: 'Net Loans & Leases',
  elnatr: 'Efficiency Ratio',
  capital_ratio: 'Capital Ratio',
  numemp: 'Employees',
  number_of_employees: 'Employees',
};

const RATE_METRICS = new Set([
  'roa', 'return_on_assets', 'nimy', 'net_interest_margin',
  'roaptx', 'elnatr', 'capital_ratio',
]);

function isRateMetric(key) {
  return RATE_METRICS.has(key.toLowerCase());
}

function isCurrencyMetric(key) {
  return /asset|dep|netinc|net_income|eqtot|equity|lnlsnet|income|interest_income/i.test(key);
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

function formatAxisTick(val, key) {
  if (!Number.isFinite(val)) return '';
  if (isRateMetric(key)) return `${val.toFixed(1)}%`;
  if (isCurrencyMetric(key)) {
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

function formatTooltipValue(val, key) {
  if (!Number.isFinite(Number(val))) return String(val);
  const n = Number(val);
  if (isRateMetric(key)) return `${n.toFixed(2)}%`;
  if (isCurrencyMetric(key)) {
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${n.toLocaleString()}`;
  }
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

function labelFor(key) {
  return METRIC_LABELS[key] || METRIC_LABELS[key.toLowerCase()] || key.replace(/_/g, ' ');
}

/** Y-axis domain for currency: pad data range so line isn't flattened against zero when values are huge. */
function computeCurrencyYDomain(chartData, keys) {
  if (!keys?.length || !chartData?.length) return undefined;
  const vals = [];
  for (const row of chartData) {
    for (const k of keys) {
      const v = row[k];
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
  }
  if (vals.length === 0) return undefined;
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = maxV - minV;
  const pad = span > 0 ? span * 0.12 : Math.max(Math.abs(maxV) * 0.02, 1);
  const low = minV - pad;
  const high = maxV + pad;
  if (minV === maxV) {
    const b = Math.max(Math.abs(minV) * 0.05, 1);
    return [minV - b, maxV + b];
  }
  return [low, high];
}

/** Y-axis domain for rate metrics (percent): keep readable floor unless all values high. */
function computeRateYDomain(chartData, keys) {
  if (!keys?.length || !chartData?.length) return undefined;
  const vals = [];
  for (const row of chartData) {
    for (const k of keys) {
      const v = row[k];
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
  }
  if (vals.length === 0) return undefined;
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = maxV - minV;
  const pad = span > 0 ? span * 0.15 : 0.1;
  const low = Math.min(0, minV - pad);
  const high = maxV + pad;
  return [low, high];
}

function pickNumericKeys(sample) {
  if (!sample || typeof sample !== 'object') return [];
  const skip = new Set(['cert', '_x', '_date']);
  return Object.keys(sample).filter((k) => {
    if (skip.has(k.toLowerCase())) return false;
    const v = sample[k];
    return typeof v === 'number';
  });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-date">{formatDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="trend-tooltip-row">
          <span className="trend-tooltip-dot" style={{ background: entry.color }} />
          <span className="trend-tooltip-label">{labelFor(entry.dataKey)}</span>
          <span className="trend-tooltip-value">{formatTooltipValue(entry.value, entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
}

export default function TrendChartViz({ data, title, config }) {
  const rows = Array.isArray(data) ? data : [];

  const chartData = useMemo(() =>
    rows.map((r) => {
      const x = r.repdte ?? r.report_date ?? r.REPDTE ?? r.date ?? r.DATE;
      const out = { ...r };
      if (x !== undefined) {
        out._x = String(x);
        out._date = formatDate(x);
      }
      return out;
    }),
    [rows]
  );

  const allMetrics = useMemo(() => {
    const fromConfig = config?.metrics && Array.isArray(config.metrics)
      ? config.metrics
      : null;
    if (fromConfig?.length) return fromConfig;
    const dateKeys = new Set(['repdte', 'report_date', '_x', '_date', 'date']);
    const auto = pickNumericKeys(chartData[0])
      .filter((k) => !dateKeys.has(k.toLowerCase()));
    return auto.length ? auto : pickNumericKeys(chartData[0]).slice(0, 3);
  }, [chartData, config?.metrics]);

  const [visibleKeys, setVisibleKeys] = useState(null);
  const activeKeys = visibleKeys ?? allMetrics;

  const { rateKeys, currencyKeys } = useMemo(() => {
    const r = activeKeys.filter(isRateMetric);
    const c = activeKeys.filter((k) => !isRateMetric(k));
    return { rateKeys: r, currencyKeys: c };
  }, [activeKeys]);

  const needsDualAxis = rateKeys.length > 0 && currencyKeys.length > 0;

  const leftYDomain = useMemo(() => {
    if (needsDualAxis) {
      return computeCurrencyYDomain(chartData, currencyKeys);
    }
    const rates = activeKeys.filter(isRateMetric);
    const currencies = activeKeys.filter((k) => !isRateMetric(k));
    if (rates.length && !currencies.length) {
      return computeRateYDomain(chartData, activeKeys);
    }
    if (rates.length && currencies.length) {
      return undefined;
    }
    return computeCurrencyYDomain(chartData, currencies);
  }, [chartData, needsDualAxis, currencyKeys, activeKeys]);

  const rightYDomain = useMemo(
    () => (needsDualAxis ? computeRateYDomain(chartData, rateKeys) : undefined),
    [chartData, needsDualAxis, rateKeys]
  );

  const xKey = chartData[0]?._x !== undefined ? '_x' : Object.keys(chartData[0] || {})[0];

  const chartType = config?.chart_type === 'area' ? 'area' : 'line';
  const Chart = chartType === 'area' ? AreaChart : LineChart;
  const Series = chartType === 'area' ? Area : Line;

  const bankName = config?.bank_name
    || (chartData[0] && (chartData[0].bank_name ?? chartData[0].BANK_NAME ?? chartData[0].name))
    || null;

  const toggleMetric = (key) => {
    const current = visibleKeys ?? allMetrics;
    if (current.includes(key)) {
      if (current.length <= 1) return;
      setVisibleKeys(current.filter((k) => k !== key));
    } else {
      setVisibleKeys([...current, key]);
    }
  };

  if (chartData.length === 0 || allMetrics.length === 0) {
    return (
      <div className="viz-placeholder viz-trend" role="region" aria-label="Trend chart">
        <p className="viz-placeholder-hint">No time-series data available.</p>
        <pre className="viz-placeholder-pre">{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
      </div>
    );
  }

  return (
    <div className="viz-placeholder viz-trend" role="region" aria-label="Trend chart">
      {bankName ? (
        <p className="viz-placeholder-hint">{bankName} &mdash; {chartData.length} data points</p>
      ) : (
        <p className="viz-placeholder-hint">{chartData.length} data points</p>
      )}

      {allMetrics.length > 1 ? (
        <div className="trend-metric-toggles">
          {allMetrics.map((k, i) => {
            const active = activeKeys.includes(k);
            return (
              <button
                key={k}
                type="button"
                className={`trend-metric-toggle ${active ? 'active' : ''}`}
                style={active ? { borderColor: PALETTE[i % PALETTE.length], color: PALETTE[i % PALETTE.length] } : undefined}
                onClick={() => toggleMetric(k)}
              >
                {labelFor(k)}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="viz-chart-wrap viz-chart-wrap--trend">
        <ResponsiveContainer width="100%" height={chartData.length > 25 ? 400 : 360}>
          <Chart data={chartData} margin={{ top: 8, right: needsDualAxis ? 56 : 16, bottom: 16, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey={xKey}
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              interval={chartData.length > 40 ? 'preserveStart' : 'preserveStartEnd'}
              minTickGap={chartData.length > 25 ? 8 : 4}
            />
            <YAxis
              yAxisId="left"
              domain={leftYDomain || ['auto', 'auto']}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => {
                const ref = currencyKeys[0] || activeKeys[0];
                return formatAxisTick(v, ref);
              }}
              width={78}
            />
            {needsDualAxis ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={rightYDomain || ['auto', 'auto']}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => formatAxisTick(v, rateKeys[0])}
                width={52}
              />
            ) : null}
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => labelFor(value)}
              wrapperStyle={{ fontSize: '0.8rem' }}
            />
            {activeKeys.map((k, i) => {
              const yId = needsDualAxis && isRateMetric(k) ? 'right' : 'left';
              const color = PALETTE[allMetrics.indexOf(k) % PALETTE.length];
              return chartType === 'area' ? (
                <Series
                  key={k}
                  type="monotone"
                  dataKey={k}
                  yAxisId={yId}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ) : (
                <Series
                  key={k}
                  type="monotone"
                  dataKey={k}
                  yAxisId={yId}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              );
            })}
          </Chart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
