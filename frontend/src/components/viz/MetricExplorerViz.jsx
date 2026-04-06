import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  binValuesWinsorized,
  formatBinRange,
  formatCompactDollars,
  inferMetricKind,
} from './metricExplorerBinning.js';
import './VizPlaceholder.css';

const MAX_ROWS_BIN = 50_000;
const EXCLUDE_FROM_METRIC_INFER = new Set([
  'name',
  'bank_name',
  'NAME',
  'cert',
  'id',
  'repdte',
  'faildate',
  'procdate',
  'dateupdt',
  'stname',
  'state',
  'city',
  'zip',
  'bkclass',
  'regagnt',
]);

function labelForRow(row) {
  return row.name ?? row.bank_name ?? row.NAME ?? String(row.cert ?? '');
}

function isFiniteNumber(v) {
  if (v == null) return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n);
}

/**
 * Pick the main numeric column when config.metric is missing (e.g. only `{ roa }` rows).
 */
function inferMetricKey(rows, preferred) {
  if (preferred && typeof preferred === 'string' && rows.some((r) => isFiniteNumber(r?.[preferred]))) {
    return preferred;
  }
  if (!rows.length) return preferred || 'roa';

  const keys = new Set();
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = rows[i];
    if (row && typeof row === 'object') Object.keys(row).forEach((k) => keys.add(k));
  }

  let bestKey = null;
  let bestScore = -1;
  for (const k of keys) {
    if (EXCLUDE_FROM_METRIC_INFER.has(k)) continue;
    let num = 0;
    let tot = 0;
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      tot++;
      if (isFiniteNumber(r[k])) num++;
    }
    if (tot === 0) continue;
    const score = num / tot;
    if (score > bestScore) {
      bestScore = score;
      bestKey = k;
    }
  }
  if (bestKey && bestScore >= 0.5) return bestKey;
  return preferred || bestKey || 'roa';
}

function fractionWithBankLabel(rows) {
  if (!rows.length) return 0;
  let n = 0;
  for (const r of rows) {
    const lab = r && typeof r === 'object' ? labelForRow(r) : '';
    if (String(lab).trim()) n++;
  }
  return n / rows.length;
}

/** True when we should show a frequency histogram instead of one bar per bank. */
function shouldUseHistogram(config, rows) {
  if ((config?.visualizationType || '').toLowerCase() === 'metric_distribution') return true;
  if (rows.length < 2) return false;
  // Long lists of numeric observations without bank labels (e.g. SELECT roa only)
  if (rows.length >= 8 && fractionWithBankLabel(rows) < 0.15) return true;
  return false;
}

function HistogramTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const count = row.count;
  const pct = total > 0 ? ((100 * count) / total).toFixed(1) : '0';
  return (
    <div className="viz-tooltip-inner">
      <div className="viz-tooltip-label">{row.binLabel}</div>
      <div>
        <strong>{count}</strong> banks ({pct}%)
      </div>
    </div>
  );
}

/** Distribution / metric explorer: histogram (frequency) or bar-per-row for small named lists. */
export default function MetricExplorerViz({ data, title, config }) {
  const rows = useMemo(() => {
    const raw = Array.isArray(data) ? data : [];
    return raw.length > MAX_ROWS_BIN ? raw.slice(0, MAX_ROWS_BIN) : raw;
  }, [data]);

  const metric = useMemo(() => inferMetricKey(rows, config?.metric), [rows, config?.metric]);

  const metricKind = useMemo(
    () => inferMetricKind(metric, config?.metric_kind),
    [metric, config?.metric_kind]
  );

  const histogram = useMemo(() => shouldUseHistogram(config, rows), [config, rows]);

  const histogramData = useMemo(() => {
    if (!histogram) return [];
    const values = rows.map((r) => Number(r?.[metric])).filter(Number.isFinite);
    const bins = binValuesWinsorized(values);
    return bins.map((b) => ({
      ...b,
      binLabel: formatBinRange(metricKind, b.binStart, b.binEnd),
    }));
  }, [histogram, rows, metric, metricKind]);

  const totalInBins = useMemo(
    () => histogramData.reduce((s, b) => s + (b.count || 0), 0),
    [histogramData]
  );

  const chartRows = useMemo(() => {
    if (histogram) return [];
    return rows.slice(0, 20).map((r) => ({
      name: String(labelForRow(r)).slice(0, 24) || '—',
      v: Number(r[metric]) || 0,
    }));
  }, [histogram, rows, metric]);

  const displayName = config?.metric_display_name || metric;

  const unitHint =
    metricKind === 'dollar' ? 'US$' : metricKind === 'percent' ? 'percent' : 'value';

  const barXTickFormatter = useMemo(() => {
    if (metricKind === 'dollar') return (v) => formatCompactDollars(Number(v));
    if (metricKind === 'percent') return (v) => `${Number(v).toFixed(1)}%`;
    return (v) => String(Number(v).toFixed(3));
  }, [metricKind]);

  return (
    <div className="viz-placeholder" role="region" aria-label={title || 'Metric explorer'}>
      <p className="viz-placeholder-hint">
        Metric: <strong>{displayName}</strong>
        {histogram ? (
          <span className="viz-histogram-sub">
            {' '}
            · {rows.length.toLocaleString()} bank{rows.length === 1 ? '' : 's'} · {unitHint} · frequency by
            range
          </span>
        ) : null}
      </p>
      {histogram && histogramData.length > 0 ? (
        <div className="viz-chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={histogramData} margin={{ left: 8, right: 8, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="binLabel"
                type="category"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={56}
              />
              <YAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
              <Tooltip content={(tipProps) => <HistogramTooltip {...tipProps} total={totalInBins} />} />
              <Bar dataKey="count" fill="#2563eb" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      {!histogram && chartRows.length > 0 ? (
        <div className="viz-chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={barXTickFormatter} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [barXTickFormatter(v), displayName]} />
              <Bar dataKey="v" fill="#2563eb" name={metric} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      {histogram && histogramData.length === 0 ? (
        <p className="viz-placeholder-hint">No numeric values to chart for this metric.</p>
      ) : null}
    </div>
  );
}
