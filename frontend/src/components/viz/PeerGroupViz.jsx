import './VizPlaceholder.css';

/** Peer group comparison placeholder. */
export default function PeerGroupViz({ data, title, config }) {
  const rows = Array.isArray(data) ? data : [];
  const targetCert = config?.target_cert;
  return (
    <div className="viz-placeholder viz-peer" role="region" aria-label={title || 'Peer analysis'}>
      {title ? <h3 className="viz-placeholder-title">{title}</h3> : null}
      {config?.target_bank ? (
        <p className="viz-placeholder-hint">Target: {config.target_bank}</p>
      ) : null}
      <ul className="viz-peer-list">
        {rows.map((row, idx) => {
          const cert = row.cert ?? row.CERT;
          const isTarget = targetCert != null && String(cert) === String(targetCert);
          return (
            <li key={idx} className={isTarget ? 'viz-peer-target' : ''}>
              <pre>{JSON.stringify(row, null, 2)}</pre>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
