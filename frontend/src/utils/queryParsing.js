import { STATES } from '../constants/states';
import { stripTrailingWithClause } from './columnPickerQuery';

export const extractTopN = (text) => {
  const m = String(text || '').match(/top\s+(\d{1,3})/i);
  if (!m) return 5;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(30, n));
};

export const extractStateAbbr = (text) => {
  const t = String(text || '');
  const lower = t.toLowerCase();

  for (const s of STATES) {
    if (lower.includes(s.name.toLowerCase())) return s.abbr;
  }

  for (const s of STATES) {
    const re = new RegExp(`\\b${s.abbr}\\b`, 'i');
    if (re.test(t)) return s.abbr;
  }

  return null;
};

export const extractRankingCriteria = (text) => {
  /** Ignore trailing " with …" from the column picker so metric display names (e.g. Total Equity Capital) do not flip ranking. */
  const lower = stripTrailingWithClause(String(text || '')).toLowerCase();
  if (/\bcapital\b|\bsafety\b|\bcapital ratio\b|\bequity\b/.test(lower)) return 'safety';
  if (/\broa\b|\bprofit\b|\bprofitability\b/.test(lower)) return 'profitability';
  return 'size';
};

export const extractRequestedMetrics = (text) => {
  const lower = stripTrailingWithClause(String(text || '')).toLowerCase();
  const metrics = [];

  if (/\broa\b|\bprofit\b/.test(lower)) metrics.push('roa');
  if (/\bcapital\b|\bsafety\b|\bcapital ratio\b|\bequity\b/.test(lower)) metrics.push('capital_ratio');
  if (/\bdeposit\b/.test(lower)) metrics.push('deposits');
  if (/\bnet income\b|\bnetinc\b|\bnet earnings\b/.test(lower)) metrics.push('netinc');
  if (/\bnet interest margin\b|\bnim\b/.test(lower)) metrics.push('nimy');

  return Array.from(new Set(metrics));
};
