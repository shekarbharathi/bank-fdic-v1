import { useMemo, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import './StateOverviewViz.css';
import './VizPlaceholder.css';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const STATE_ABBR_BY_NAME = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI',
  Wyoming: 'WY', 'District of Columbia': 'DC',
};

function pickInsensitive(row, ...keys) {
  if (!row) return undefined;
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const k of keys) {
    const real = lower.get(String(k).toLowerCase());
    if (real !== undefined) return row[real];
  }
  return undefined;
}

function resolveStateKey(row) {
  const stalp = pickInsensitive(row, 'stalp', 'state_code', 'state_abbr', 'state');
  if (stalp && typeof stalp === 'string' && stalp.length === 2) return stalp.toUpperCase();
  const name = pickInsensitive(row, 'stname', 'state_name');
  if (name && STATE_ABBR_BY_NAME[name]) return STATE_ABBR_BY_NAME[name];
  return null;
}

function pickMetric(row) {
  const candidates = [
    'bank_count', 'total_assets', 'total_deposits', 'avg_roa',
    'avg_nimy', 'asset', 'dep', 'count', 'num_banks',
  ];
  for (const c of candidates) {
    const v = pickInsensitive(row, c);
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (Number.isFinite(n)) return { key: c, value: n };
    }
  }
  const numericEntries = Object.entries(row).filter(([, v]) => {
    const n = Number(v);
    return typeof v === 'number' || (typeof v === 'string' && Number.isFinite(n) && v.trim() !== '');
  });
  if (numericEntries.length > 0) {
    const [k, v] = numericEntries[0];
    return { key: k, value: Number(v) };
  }
  return null;
}

function formatValue(val, key) {
  if (val == null || !Number.isFinite(val)) return '—';
  const lower = String(key).toLowerCase();
  if (/asset|deposit|dep\b/.test(lower)) {
    if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toLocaleString()}`;
  }
  if (/roa|nimy|ratio|margin|percent/.test(lower)) return `${val.toFixed(2)}%`;
  if (Number.isInteger(val)) return val.toLocaleString();
  return val.toFixed(2);
}

function labelForKey(key) {
  const map = {
    bank_count: 'Banks',
    num_banks: 'Banks',
    count: 'Count',
    total_assets: 'Total Assets',
    total_deposits: 'Total Deposits',
    avg_roa: 'Avg ROA',
    avg_nimy: 'Avg NIM',
    asset: 'Assets',
    dep: 'Deposits',
  };
  return map[key] || key.replace(/_/g, ' ');
}

const BLUE_SCALE = ['#eff6ff', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'];

function quantileScale(values, buckets) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return () => 0;
  const step = Math.max(1, Math.floor(sorted.length / buckets));
  const thresholds = [];
  for (let i = 1; i < buckets; i++) {
    thresholds.push(sorted[Math.min(i * step, sorted.length - 1)]);
  }
  return (v) => {
    if (!Number.isFinite(v)) return 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (v <= thresholds[i]) return i;
    }
    return thresholds.length;
  };
}

export default function StateOverviewViz({ data, title, config }) {
  const rows = Array.isArray(data) ? data : [];
  const [tooltip, setTooltip] = useState(null);

  const focusState = config?.state_code || config?.state || null;

  const { stateDataMap, metricKey, allValues } = useMemo(() => {
    const map = new Map();
    let mKey = null;
    const vals = [];

    for (const row of rows) {
      const stAbbr = resolveStateKey(row);
      if (!stAbbr) continue;
      const m = pickMetric(row);
      if (m) {
        if (!mKey) mKey = m.key;
        map.set(stAbbr, { value: m.value, row });
        vals.push(m.value);
      } else {
        map.set(stAbbr, { value: null, row });
      }
    }
    return { stateDataMap: map, metricKey: mKey || 'value', allValues: vals };
  }, [rows]);

  const colorFn = useMemo(
    () => quantileScale(allValues, BLUE_SCALE.length),
    [allValues]
  );

  const hasManyStates = stateDataMap.size > 1;
  const singleStateData = !hasManyStates && stateDataMap.size === 1
    ? [...stateDataMap.values()][0]
    : null;

  const kpiEntries = useMemo(() => {
    if (rows.length === 0) return [];
    const source = rows.length === 1 ? rows[0] : null;
    if (!source) return [];
    return Object.entries(source)
      .filter(([, v]) => v !== null && v !== undefined)
      .slice(0, 8);
  }, [rows]);

  return (
    <div className="viz-placeholder viz-state-overview" role="region" aria-label={title || 'State overview'}>
      {title ? <h3 className="viz-placeholder-title">{title}</h3> : null}

      {focusState ? (
        <p className="viz-placeholder-hint">
          {config.state || ''} {config.state_code ? `(${config.state_code})` : ''}
        </p>
      ) : null}

      {hasManyStates ? (
        <div className="state-map-container">
          <ComposableMap projection="geoAlbersUsa" width={960} height={600}>
            <ZoomableGroup>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const geoName = geo.properties.name;
                    const abbr = STATE_ABBR_BY_NAME[geoName];
                    const entry = abbr ? stateDataMap.get(abbr) : null;
                    const bucket = entry?.value != null ? colorFn(entry.value) : 0;
                    const fill = entry ? BLUE_SCALE[bucket] : '#f3f4f6';
                    const isHighlighted = focusState && abbr === focusState.toUpperCase();

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke={isHighlighted ? '#1e40af' : '#d1d5db'}
                        strokeWidth={isHighlighted ? 2 : 0.5}
                        onMouseEnter={() => {
                          setTooltip({
                            name: geoName,
                            abbr,
                            value: entry?.value,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          hover: { fill: '#93c5fd', stroke: '#2563eb', strokeWidth: 1.5, outline: 'none' },
                          pressed: { outline: 'none' },
                          default: { outline: 'none' },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {tooltip ? (
            <div className="state-map-tooltip" aria-live="polite">
              <strong>{tooltip.name} ({tooltip.abbr})</strong>
              <span>{tooltip.value != null ? `${labelForKey(metricKey)}: ${formatValue(tooltip.value, metricKey)}` : 'No data'}</span>
            </div>
          ) : null}

          <div className="state-map-legend">
            <span className="state-map-legend-label">Low</span>
            {BLUE_SCALE.map((color, i) => (
              <span key={i} className="state-map-legend-swatch" style={{ background: color }} />
            ))}
            <span className="state-map-legend-label">High</span>
            <span className="state-map-legend-metric">{labelForKey(metricKey)}</span>
          </div>
        </div>
      ) : null}

      {kpiEntries.length > 0 ? (
        <div className="viz-kpi-row">
          {kpiEntries.map(([k, v]) => (
            <div key={k} className="viz-kpi-card">
              <div className="viz-kpi-label">{labelForKey(k)}</div>
              <div className="viz-kpi-value">
                {typeof v === 'number' ? formatValue(v, k) : String(v)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!hasManyStates && singleStateData === null && rows.length > 1 ? (
        <div className="viz-kpi-row">
          {rows.slice(0, 12).map((row, idx) => {
            const name = pickInsensitive(row, 'bank_name', 'name', 'institution_name') || `Bank ${idx + 1}`;
            const metric = pickMetric(row);
            return (
              <div key={idx} className="viz-kpi-card">
                <div className="viz-kpi-label">{name}</div>
                <div className="viz-kpi-value">
                  {metric ? formatValue(metric.value, metric.key) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
