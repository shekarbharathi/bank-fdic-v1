/**
 * Sync natural-language query with column picker selections using a trailing " with ..." clause.
 */

const WITH_SUFFIX_RE = /\s+with\s+.+$/is;

export function stripTrailingWithClause(text) {
  return String(text || '').replace(WITH_SUFFIX_RE, '').trim();
}

/**
 * @param {string} baseQuery
 * @param {string[]} displayNames - human-readable metric names from metadata
 */
export function appendMetricsToQuery(baseQuery, displayNames) {
  const base = stripTrailingWithClause(baseQuery);
  if (!displayNames?.length) return base;
  return `${base} with ${displayNames.join(', ')}`;
}

/**
 * Prepend default Assets label so the LLM keeps asset/ASSET in SELECT (picker skips `asset`).
 * Dedupes case-insensitive against existing display names.
 * @param {string[]} displayNames
 * @param {string} assetLabel
 * @returns {string[]}
 */
export function withDefaultAssetsDisplayNames(displayNames, assetLabel) {
  const list = displayNames || [];
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
  if (id === 'deposits') return 'dep';
  return id;
}

export function denormalizeFieldNameForLegacy(id) {
  if (id === 'dep') return ['dep', 'deposits'];
  return [id];
}
