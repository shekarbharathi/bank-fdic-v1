/**
 * Build metric definition map from field_metadata API fields for table formatting.
 */

export function fieldToMetricDef(field) {
  const id = field.field_name;
  let kind = 'number';
  if (field.data_type === 'date' || field.field_name === 'repdte') kind = 'date';
  else if (field.is_ratio) kind = 'percent';
  else if (field.is_currency) kind = 'dollar';

  return {
    id,
    label: field.display_name || id,
    kind,
    explanation: field.synopsis || field.description || '',
    fdic_field_code: field.fdic_field_code,
  };
}

export function buildFieldMetaMap(groups) {
  const map = new Map();
  if (!Array.isArray(groups)) return map;
  for (const g of groups) {
    for (const f of g.fields || []) {
      map.set(f.field_name, f);
    }
  }
  return map;
}

export function mergeMetricDefs(baseDefs, groups) {
  const merged = { ...baseDefs };
  if (!Array.isArray(groups)) return merged;
  for (const g of groups) {
    for (const f of g.fields || []) {
      merged[f.field_name] = fieldToMetricDef(f);
    }
  }
  return merged;
}
