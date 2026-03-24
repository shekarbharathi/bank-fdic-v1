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

/** Map legacy visible metric ids to metadata field_name */
export function canonicalFieldName(id) {
  if (id === 'deposits') return 'dep';
  return id;
}

export function denormalizeFieldNameForLegacy(id) {
  if (id === 'dep') return ['dep', 'deposits'];
  return [id];
}
