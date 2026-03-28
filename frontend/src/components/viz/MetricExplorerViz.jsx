import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './VizPlaceholder.css';

function labelForRow(row, metric) {
  return row.name ?? row.bank_name ?? row.NAME ?? String(row.cert ?? '');
}

/** Distribution / ranking placeholder with simple bar chart. */
export default function MetricExplorerViz({ data, title, config }) {
  const rows = Array.isArray(data) ? data : [];
  const metric = config?.metric || 'roa';
  const chartRows = rows.slice(0, 20).map((r) => ({
    name: String(labelForRow(r, metric)).slice(0, 24),
    v: Number(r[metric]) || 0,
  }));

  return (
    <div className="viz-placeholder" role="region" aria-label={title || 'Metric explorer'}>
      {title ? <h3 className="viz-placeholder-title">{title}</h3> : null}
      <p className="viz-placeholder-hint">
        Metric: <strong>{config?.metric_display_name || metric}</strong>
      </p>
      {chartRows.length > 0 ? (
        <div className="viz-chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="v" fill="#2563eb" name={metric} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      <details className="viz-config-details">
        <summary>Raw rows ({rows.length})</summary>
        <pre className="viz-placeholder-pre">{JSON.stringify(rows.slice(0, 8), null, 2)}</pre>
      </details>
    </div>
  );
}
