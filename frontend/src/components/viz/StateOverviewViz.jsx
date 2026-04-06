import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { geoPath } from 'd3-geo';
import {
  approximateLonLatForCity,
  boundsFromFeature,
  buildNameByAbbr,
  clampLonLat,
  fetchUsStatesTopo,
  getStateFeatureFromTopo,
  offsetForBankIndex,
  projectionForState,
} from '../../utils/stateSingleMap';
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

const NAME_BY_ABBR = buildNameByAbbr(STATE_ABBR_BY_NAME);

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

function resolveStateFromConfig(config) {
  const c = config?.state_code;
  if (c && typeof c === 'string' && c.length === 2) return c.toUpperCase();
  const n = config?.state;
  if (n && typeof n === 'string' && STATE_ABBR_BY_NAME[n]) return STATE_ABBR_BY_NAME[n];
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
    assets_dollars: 'Assets',
    assets: 'Assets',
    roa: 'ROA',
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

function formatBankRowSnippet(row) {
  const name = pickInsensitive(row, 'bank_name', 'name', 'institution_name') || '—';
  const city = pickInsensitive(row, 'city', 'CITY');
  const cert = pickInsensitive(row, 'cert', 'CERT');
  const asset = pickInsensitive(row, 'assets_dollars', 'asset', 'asset_dollars', 'assets', 'ASSET');
  const roa = pickInsensitive(row, 'roa', 'ROA');
  const metrics = [];
  if (asset != null && asset !== '') {
    const n = Number(asset);
    if (Number.isFinite(n)) metrics.push(`${labelForKey('asset')}: ${formatValue(n, 'asset')}`);
  }
  if (roa != null && roa !== '') {
    const n = Number(roa);
    if (Number.isFinite(n)) metrics.push(`${labelForKey('roa')}: ${formatValue(n, 'roa')}`);
  }
  return { name, city, cert, metrics };
}

const MAP_W = 960;
const MAP_H = 620;

/** Single-state map with bank pins (coordinates from API or approximated by city). */
function SingleStateBankMap({ stateAbbr, rows }) {
  const wrapRef = useRef(null);
  const [stateFeature, setStateFeature] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const topo = await fetchUsStatesTopo();
        const feat = getStateFeatureFromTopo(topo, stateAbbr, NAME_BY_ABBR);
        if (cancelled) return;
        if (!feat) {
          setLoadError(`Could not load outline for ${stateAbbr}.`);
          return;
        }
        setStateFeature(feat);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || 'Map failed to load.');
      }
    })();
    return () => { cancelled = true; };
  }, [stateAbbr]);

  const projection = useMemo(() => {
    if (!stateFeature) return null;
    return projectionForState(stateFeature, MAP_W, MAP_H);
  }, [stateFeature]);

  const outlineD = useMemo(() => {
    if (!stateFeature || !projection) return '';
    const path = geoPath(projection);
    return path(stateFeature);
  }, [stateFeature, projection]);

  const geoBounds = useMemo(() => (stateFeature ? boundsFromFeature(stateFeature) : null), [stateFeature]);

  const markers = useMemo(() => {
    if (!projection || !geoBounds || !rows.length) return [];
    const byCity = new Map();
    rows.forEach((row, idx) => {
      const city = String(pickInsensitive(row, 'city', 'CITY') || '').trim() || 'Unknown';
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city).push({ row, idx });
    });

    const out = [];
    for (const [city, list] of byCity) {
      list.forEach((item, i) => {
        const { row } = item;
        const lat = pickInsensitive(row, 'latitude', 'lat', 'LATITUDE');
        const lon = pickInsensitive(row, 'longitude', 'lon', 'lng', 'LONGITUDE');
        let lonLat;
        if (lat != null && lon != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
          lonLat = clampLonLat(Number(lon), Number(lat), geoBounds);
        } else {
          const base = approximateLonLatForCity(geoBounds, stateAbbr, city);
          const off = offsetForBankIndex(i, list.length, geoBounds);
          lonLat = clampLonLat(base[0] + off[0], base[1] + off[1], geoBounds);
        }
        const xy = projection(lonLat);
        if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return;
        const cert = pickInsensitive(row, 'cert', 'CERT');
        out.push({
          key: `pin-${cert ?? city}-${i}-${item.idx}`,
          x: xy[0],
          y: xy[1],
          row,
          city,
        });
      });
    }
    return out;
  }, [projection, geoBounds, rows, stateAbbr]);

  const handlePinEnter = (e, row) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHover({
      row,
      left: e.clientX - rect.left + 12,
      top: e.clientY - rect.top - 8,
    });
  };

  if (loadError) {
    return <p className="viz-placeholder-hint">{loadError}</p>;
  }

  if (!stateFeature || !projection) {
    return <p className="viz-placeholder-hint">Loading state map…</p>;
  }

  return (
    <div className="state-single-map-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="state-single-map-svg"
        role="img"
        aria-label={`Banks in ${stateAbbr}`}
      >
        <path d={outlineD} className="state-single-outline" />
        {markers.map((m) => (
          <g
            key={m.key}
            className="state-bank-pin"
            transform={`translate(${m.x},${m.y})`}
            onMouseEnter={(e) => handlePinEnter(e, m.row)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{formatBankRowSnippet(m.row).name}</title>
            <circle r="14" className="state-bank-pin-hit" />
            <circle r="6" className="state-bank-pin-dot" />
            <path
              className="state-bank-pin-icon"
              d="M-4-5h8v1.5h-2.5v5h-3v-5H-4V-5z"
              fill="currentColor"
            />
          </g>
        ))}
      </svg>
      {hover ? (
        <div
          className="state-bank-hover-card"
          style={{ left: hover.left, top: hover.top }}
          role="tooltip"
        >
          {(() => {
            const { name, city, cert, metrics } = formatBankRowSnippet(hover.row);
            return (
              <>
                <div className="state-bank-hover-title">{name}</div>
                <div className="state-bank-hover-meta">
                  {city ? <span>{city}</span> : null}
                  {city && cert != null ? <span> · </span> : null}
                  {cert != null ? <span>Cert {cert}</span> : null}
                </div>
                {metrics.length ? (
                  <ul className="state-bank-hover-metrics">
                    {metrics.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

export default function StateOverviewViz({ data, title, config }) {
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
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

  const effectiveStateAbbr = useMemo(() => {
    const fromConfig = resolveStateFromConfig(config);
    if (fromConfig) return fromConfig;
    return resolveStateKey(rows[0]) || null;
  }, [config, rows]);

  const hasBankNameRows = useMemo(
    () => rows.some((r) => pickInsensitive(r, 'bank_name', 'name', 'institution_name')),
    [rows]
  );

  const allRowsMatchState = useMemo(() => {
    if (!effectiveStateAbbr || !rows.length) return false;
    return rows.every((r) => {
      const k = resolveStateKey(r);
      return !k || k === effectiveStateAbbr;
    });
  }, [rows, effectiveStateAbbr]);

  const showSingleStateBankMap = Boolean(
    effectiveStateAbbr &&
      hasBankNameRows &&
      allRowsMatchState &&
      rows.length > 0 &&
      !hasManyStates
  );

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

      {showSingleStateBankMap ? (
        <div className="state-map-container state-map-container--single">
          <SingleStateBankMap stateAbbr={effectiveStateAbbr} rows={rows} />
          <p className="viz-placeholder-hint state-map-hint">
            {rows.length} bank{rows.length === 1 ? '' : 's'} — hover a pin for details. Cities without coordinates are
            placed approximately within the state.
          </p>
        </div>
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

      {!showSingleStateBankMap && !hasManyStates && rows.length > 1 ? (
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
