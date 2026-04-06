/**
 * Histogram helpers for MetricExplorerViz: winsorized inner range + Freedman–Diaconis bin width
 * so outliers do not collapse the chart into one or two bars.
 */

import { METRIC_DEFS_DEFAULT } from '../../constants/metricDefsDefault.js';

/** @typedef {'dollar' | 'percent' | 'number'} MetricKind */

/** Map common SQL / API column names to METRIC_DEFS_DEFAULT keys. */
const METRIC_KEY_ALIASES = {
  asset: 'assets',
  assets: 'assets',
  total_assets_dollars: 'assets',
  dep: 'deposits',
  deposits: 'deposits',
  total_deposits_dollars: 'deposits',
  return_on_assets: 'roa',
  net_interest_margin: 'nimy',
  net_interest_margin_pct: 'nimy',
  equity_capital_ratio: 'capital_ratio',
};

/**
 * @param {string | undefined} metricKey — column name from API row
 * @param {string | undefined} [configKind] — optional override from visualization.config
 * @returns {MetricKind}
 */
export function inferMetricKind(metricKey, configKind) {
  const ck = String(configKind || '').toLowerCase();
  if (ck === 'dollar' || ck === 'percent' || ck === 'number') return ck;

  const raw = String(metricKey || '').toLowerCase();
  const strip = raw.replace(/_dollars$/i, '');
  const aliasRaw = METRIC_KEY_ALIASES[raw];
  const aliasStrip = METRIC_KEY_ALIASES[strip];

  for (const key of [raw, strip, aliasRaw, aliasStrip].filter(Boolean)) {
    const def = METRIC_DEFS_DEFAULT[key];
    if (def?.kind) return def.kind;
  }

  if (raw.includes('dollars') || strip.includes('dollars')) return 'dollar';
  if (/(^|_)ratio($|_)/i.test(strip) || /_pct$/i.test(strip) || strip.endsWith('_percent')) return 'percent';
  return 'number';
}

/**
 * @param {number[]} sortedAsc
 * @param {number} q 0..1
 */
export function quantileSorted(sortedAsc, q) {
  if (!sortedAsc.length) return NaN;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedAsc[base + 1] === undefined) return sortedAsc[base];
  return sortedAsc[base] + rest * (sortedAsc[base + 1] - sortedAsc[base]);
}

export function formatCompactDollars(x) {
  if (!Number.isFinite(x)) return '';
  const ax = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  if (ax >= 1e12) return `${sign}$${(ax / 1e12).toFixed(2)}T`;
  if (ax >= 1e9) return `${sign}$${(ax / 1e9).toFixed(2)}B`;
  if (ax >= 1e6) return `${sign}$${(ax / 1e6).toFixed(2)}M`;
  if (ax >= 1e3) return `${sign}$${(ax / 1e3).toFixed(1)}K`;
  return `${sign}$${ax.toFixed(0)}`;
}

export function formatPercentValue(x, decimals = 2) {
  if (!Number.isFinite(x)) return '';
  return `${x.toFixed(decimals)}%`;
}

/**
 * @param {MetricKind} kind
 * @param {number} lo
 * @param {number} hi
 */
export function formatBinRange(kind, lo, hi) {
  if (kind === 'dollar') return `${formatCompactDollars(lo)}–${formatCompactDollars(hi)}`;
  if (kind === 'percent') return `${formatPercentValue(lo)}–${formatPercentValue(hi)}`;
  const fmt = (x) => {
    const ax = Math.abs(x);
    if (ax >= 1000) return x.toExponential(1);
    if (ax >= 1) return x.toFixed(2);
    if (ax >= 0.01) return x.toFixed(3);
    return x.toFixed(4);
  };
  return `${fmt(lo)}–${fmt(hi)}`;
}

/**
 * Equal-width bins on [pLow, pHigh] with optional tail bins for values outside that range.
 *
 * @param {number[]} values
 * @returns {{ binStart: number, binEnd: number, count: number }[]}
 */
export function binValuesWinsorized(values) {
  const filtered = values.filter((v) => Number.isFinite(v));
  if (filtered.length === 0) return [];

  const sorted = [...filtered].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const pLow = quantileSorted(sorted, 0.01);
  const pHigh = quantileSorted(sorted, 0.99);

  if (pHigh - pLow < 1e-15 || min === max) {
    return [{ binStart: min, binEnd: max, count: n }];
  }

  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = Math.max(q3 - q1, 1e-12);
  const fdWidth = 2 * iqr * n ** (-1 / 3);
  const innerSpan = Math.max(pHigh - pLow, 1e-12);
  let innerBins = Math.ceil(innerSpan / Math.max(fdWidth, innerSpan / 28));
  innerBins = Math.max(12, Math.min(28, innerBins));

  const w = innerSpan / innerBins;
  const innerCounts = new Array(innerBins).fill(0);
  let leftCount = 0;
  let rightCount = 0;

  for (const v of filtered) {
    if (v < pLow) {
      leftCount++;
    } else if (v > pHigh) {
      rightCount++;
    } else {
      let idx = Math.floor((v - pLow) / w);
      if (idx >= innerBins) idx = innerBins - 1;
      if (idx < 0) idx = 0;
      innerCounts[idx]++;
    }
  }

  /** @type {{ binStart: number, binEnd: number, count: number }[]} */
  const out = [];

  if (leftCount > 0) {
    out.push({ binStart: min, binEnd: pLow, count: leftCount });
  }

  for (let i = 0; i < innerBins; i++) {
    const c = innerCounts[i];
    if (c === 0) continue;
    const a = pLow + i * w;
    const b = i === innerBins - 1 ? pHigh : pLow + (i + 1) * w;
    out.push({ binStart: a, binEnd: b, count: c });
  }

  if (rightCount > 0) {
    out.push({ binStart: pHigh, binEnd: max, count: rightCount });
  }

  return out.length > 0 ? out : [{ binStart: min, binEnd: max, count: n }];
}
