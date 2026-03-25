import { diffChars } from 'diff';

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * Ranges [start, end) in `newStr` that cover inserted/changed characters vs `oldStr`.
 */
export function computeDiffHighlightRanges(oldStr, newStr) {
  const old = oldStr ?? '';
  const next = newStr ?? '';
  if (old === next) return [];

  const changes = diffChars(old, next);
  let pos = 0;
  const ranges = [];
  for (const part of changes) {
    if (part.added) {
      ranges.push({ start: pos, end: pos + part.value.length });
      pos += part.value.length;
    } else if (!part.removed) {
      pos += part.value.length;
    }
  }
  return mergeRanges(ranges);
}

/**
 * Split text into segments for rendering (plain vs highlighted).
 */
export function buildHighlightSegments(text, ranges) {
  const t = text ?? '';
  if (!ranges?.length) return [{ text: t, highlight: false }];

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out = [];
  let i = 0;
  for (const r of sorted) {
    const start = Math.max(0, Math.min(r.start, t.length));
    const end = Math.max(start, Math.min(r.end, t.length));
    if (start > i) out.push({ text: t.slice(i, start), highlight: false });
    if (end > start) out.push({ text: t.slice(start, end), highlight: true });
    i = Math.max(i, end);
  }
  if (i < t.length) out.push({ text: t.slice(i), highlight: false });
  return out.length ? out : [{ text: t, highlight: false }];
}
