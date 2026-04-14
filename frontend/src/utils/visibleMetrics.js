import { METRIC_DEFS_DEFAULT } from '../constants/metricDefsDefault';

export const METRIC_KEY_ALIASES = {
  asset: 'assets',
  assets: 'assets',
  dep: 'deposits',
  deposits: 'deposits',
};

export const normalizeMetricKey = (metricKey) =>
  METRIC_KEY_ALIASES[String(metricKey || '').toLowerCase()] || metricKey;

export const resolveMetricDefKey = (metricKey, defs = METRIC_DEFS_DEFAULT) => {
  const normalized = normalizeMetricKey(metricKey);
  if (defs[normalized]) return normalized;
  return metricKey;
};

export function inferVisibleColumns(rows, configMetrics, defs = METRIC_DEFS_DEFAULT) {
  const sample = rows[0];
  if (!sample) return ['assets'];

  const known = new Set(
    Object.keys(defs).map((k) => normalizeMetricKey(k))
  );
  const dedupeNormalized = (keys) => {
    const seen = new Set();
    const out = [];
    for (const key of keys) {
      const normalized = normalizeMetricKey(key);
      if (!known.has(normalized) || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
    return out;
  };

  const fromRow = Object.keys(sample).filter(
    (k) =>
      k !== 'raw' &&
      known.has(normalizeMetricKey(k)) &&
      sample[k] !== null &&
      sample[k] !== undefined
  );
  const normalizedFromRow = dedupeNormalized(fromRow);

  if (Array.isArray(configMetrics) && configMetrics.length > 0) {
    const byConfig = dedupeNormalized(configMetrics);
    const seen = new Set(byConfig);
    const merged = [...byConfig];
    for (const k of normalizedFromRow) {
      if (!seen.has(k)) {
        merged.push(k);
        seen.add(k);
      }
    }
    return merged.length > 0 ? merged : ['assets'];
  }

  return normalizedFromRow.length > 0 ? normalizedFromRow : ['assets'];
}
