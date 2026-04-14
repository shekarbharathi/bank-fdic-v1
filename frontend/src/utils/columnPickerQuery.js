/**
 * Sync natural-language query with column picker selections using a trailing " with ..." clause.
 */

const WITH_SUFFIX_RE = /\s+with\s+.+$/is;

const uniqueDisplayNames = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const label = String(item || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
};

export function stripTrailingWithClause(text) {
  return String(text || '').replace(WITH_SUFFIX_RE, '').trim();
}

/**
 * @param {string} baseQuery
 * @param {string[]} displayNames - human-readable metric names from metadata
 */
export function appendMetricsToQuery(baseQuery, displayNames) {
  const base = stripTrailingWithClause(baseQuery);
  const deduped = uniqueDisplayNames(displayNames);
  if (!deduped.length) return base;
  return `${base} with ${deduped.join(', ')}`;
}

/**
 * Prepend default Assets label so the LLM keeps asset/ASSET in SELECT (picker skips `asset`).
 * Dedupes case-insensitive against existing display names.
 * @param {string[]} displayNames
 * @param {string} assetLabel
 * @returns {string[]}
 */
export function withDefaultAssetsDisplayNames(displayNames, assetLabel) {
  const list = uniqueDisplayNames(displayNames || []);
  if (!list.length) return list;
  const label = String(assetLabel || 'Total Assets').trim();
  if (!label) return [...list];
  const lower = label.toLowerCase();
  const rest = list.filter(
    (d) => String(d || '').trim().toLowerCase() !== lower
  );
  return [label, ...rest];
}

/** Map legacy visible metric ids to metadata field_name */
export function canonicalFieldName(id) {
  if (id === 'assets') return 'asset';
  if (id === 'deposits') return 'dep';
  return id;
}

export function denormalizeFieldNameForLegacy(id) {
  if (id === 'asset') return ['asset', 'assets'];
  if (id === 'dep') return ['dep', 'deposits'];
  return [id];
}
