import './VizPlaceholder.css';

/** Side-by-side comparison of 2–4 banks (placeholder). */
export default function BankComparisonViz({ data, title, config }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="viz-placeholder viz-comparison" role="region" aria-label={title || 'Bank comparison'}>
      {title ? <h3 className="viz-placeholder-title">{title}</h3> : null}
      <p className="viz-placeholder-hint">Side-by-side metrics for selected banks.</p>
      <div className="viz-comparison-grid">
        {rows.slice(0, 8).map((row, idx) => (
          <div key={idx} className="viz-comparison-card">
            <pre className="viz-placeholder-pre">{JSON.stringify(row, null, 2)}</pre>
          </div>
        ))}
      </div>
      {config && Object.keys(config).length > 0 ? (
        <details className="viz-config-details">
          <summary>Visualization config</summary>
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}
