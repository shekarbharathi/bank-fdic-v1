import { feature } from 'topojson-client';
import { geoMercator, geoBounds } from 'd3-geo';

export const US_STATES_TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

/** Reverse of common state name → abbr maps */
export function buildNameByAbbr(stateAbbrByName) {
  return Object.fromEntries(
    Object.entries(stateAbbrByName).map(([name, abbr]) => [abbr, name])
  );
}

let cachedTopo = null;

export async function fetchUsStatesTopo() {
  if (cachedTopo) return cachedTopo;
  const res = await fetch(US_STATES_TOPO_URL);
  if (!res.ok) throw new Error(`Failed to load map data: ${res.status}`);
  cachedTopo = await res.json();
  return cachedTopo;
}

/**
 * @param {object} topo - us-atlas topojson
 * @param {string} stateAbbr - e.g. "CA"
 * @param {Record<string, string>} nameByAbbr - e.g. { CA: "California" }
 */
export function getStateFeatureFromTopo(topo, stateAbbr, nameByAbbr) {
  const abbr = String(stateAbbr || '').toUpperCase();
  const geoName = nameByAbbr[abbr];
  if (!geoName || !topo?.objects?.states) return null;
  const collection = feature(topo, topo.objects.states);
  return collection.features.find((f) => f.properties?.name === geoName) ?? null;
}

/**
 * @param {GeoJSON.Feature} stateFeature
 * @param {number} width
 * @param {number} height
 */
export function projectionForState(stateFeature, width, height) {
  return geoMercator().fitSize([width, height], stateFeature);
}

/** [[minLon, minLat], [maxLon, maxLat]] in degrees */
export function boundsFromFeature(stateFeature) {
  return geoBounds(stateFeature);
}

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic [lon, lat] inside geographic bounds for a city label (when API has no coordinates).
 */
export function approximateLonLatForCity(bounds, stalp, city) {
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  const w = maxLon - minLon;
  const h = maxLat - minLat;
  const key = `${String(stalp || '').toUpperCase()}|${String(city || '').trim().toLowerCase()}`;
  const a = hash32(key);
  const b = hash32(`${key}|2`);
  const u = 0.12 + 0.76 * (a % 10000) / 10000;
  const v = 0.12 + 0.76 * (b % 10000) / 10000;
  return [minLon + u * w, minLat + v * h];
}

/**
 * Small offset so multiple banks in the same city don't fully overlap (degrees).
 */
export function offsetForBankIndex(i, n, bounds) {
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  const w = maxLon - minLon;
  const h = maxLat - minLat;
  const scale = Math.min(w, h) * 0.018;
  const angle = (i / Math.max(n, 1)) * 2 * Math.PI;
  const ring = 0.35 + (i % 6) * 0.2;
  const r = scale * ring;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

export function clampLonLat(lon, lat, bounds) {
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  return [
    Math.min(maxLon, Math.max(minLon, lon)),
    Math.min(maxLat, Math.max(minLat, lat)),
  ];
}
