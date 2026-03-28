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
import './VizPlaceholder.css';

function pickNumericKeys(sample) {
  if (!sample || typeof sample !== 'object') return [];
  return Object.keys(sample).filter((k) => {
    const v = sample[k];
    return typeof v === 'number' && k.toLowerCase() !== 'cert';
  });
}

/** Time-series chart stub (repdte + metrics). */
export default function TrendChartViz({ data, title, config }) {
  const rows = Array.isArray(data) ? data : [];
  const chartData = rows.map((r) => {
    const x = r.repdte ?? r.report_date ?? r.REPDTE ?? r.date;
    const rest = { ...r };
    if (x !== undefined) rest._x = String(x).slice(0, 10);
    return rest;
  });
  const metrics =
    (config?.metrics && Array.isArray(config.metrics) ? config.metrics : null) ||
    pickNumericKeys(rows[0]).filter((k) => !['repdte', 'report_date'].includes(k.toLowerCase()));
  const keys = metrics.length ? metrics : pickNumericKeys(rows[0]).slice(0, 3);
  const xKey = chartData[0]?._x !== undefined ? '_x' : Object.keys(chartData[0] || {})[0];

  return (
    <div className="viz-placeholder viz-trend" role="region" aria-label={title || 'Trend chart'}>
      {title ? <h3 className="viz-placeholder-title">{title}</h3> : null}
      <p className="viz-placeholder-hint">Time series from query results (latest quarter per row).</p>
      {chartData.length > 0 && keys.length > 0 && xKey ? (
        <div className="viz-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {keys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={['#2563eb', '#16a34a', '#ca8a04'][i % 3]} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <pre className="viz-placeholder-pre">{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
      )}
    </div>
  );
}
