const REFUSAL_PATTERNS = [
  'test query',
  'please provide a specific',
  'provide a specific question',
  'not a valid question',
  'cannot convert',
  "i don't understand",
  "i do not understand",
  'not related to fdic',
  'try asking about',
  'rephrase your',
  'unable to generate',
  'cannot generate sql',
];

export const isRefusalResponse = (val) => {
  if (val == null) return false;
  const s = String(val).toLowerCase();
  return REFUSAL_PATTERNS.some((p) => s.includes(p.toLowerCase()));
};
