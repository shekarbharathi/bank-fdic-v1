import './VizPlaceholder.css';

/** State-level aggregates placeholder. */
export default function StateOverviewViz({ data, title, config }) {
  const row = Array.isArray(data) && data[0] ? data[0] : {};
  return (
    <div className="viz-placeholder viz-state" role="region" aria-label={title || 'State overview'}>
      {title ? <h3 className="viz-placeholder-title">{title}</h3> : null}
      {config?.state || config?.state_code ? (
        <p className="viz-placeholder-hint">
          {config.state || ''} {config.state_code ? `(${config.state_code})` : ''}
        </p>
      ) : null}
      <div className="viz-kpi-row">
        {Object.entries(row).map(([k, v]) => (
          <div key={k} className="viz-kpi-card">
            <div className="viz-kpi-label">{k}</div>
            <div className="viz-kpi-value">{String(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
