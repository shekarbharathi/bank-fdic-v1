import { canonicalFieldName } from './columnPickerQuery';

export const pickCaseInsensitive = (row, ...candidates) => {
  if (!row) return undefined;
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const c of candidates) {
    const k = lowerMap.get(String(c).toLowerCase());
    if (k !== undefined) return row[k];
  }
  return undefined;
};

export const maybeThousandsToDollars = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  if (Math.abs(n) >= 100_000_000_000) return n;
  return n * 1000;
};

/**
 * Normalize a field or column name so metadata `net_loans_leases` matches API `net_loans_and_leases_dollars`.
 */
const normalizeDollarFieldBase = (name) =>
  String(name)
    .toLowerCase()
    .replace(/_dollars$/i, '')
    .replace(/_and_/g, '_')
    .replace(/_+/g, '_');

/**
 * When explicit aliases miss, find a row key ending in _dollars whose base matches fieldName (after _and_ normalization).
 */
const findDollarColumnByNormalizedBase = (row, fieldName) => {
  if (!row || typeof row !== 'object') return undefined;
  const target = normalizeDollarFieldBase(fieldName);
  if (!target) return undefined;
  for (const key of Object.keys(row)) {
    const lk = String(key).toLowerCase();
    if (!lk.endsWith('_dollars')) continue;
    if (normalizeDollarFieldBase(key) === target) {
      const v = row[key];
      if (v !== undefined && v !== null) return v;
    }
  }
  return undefined;
};

/** LLM/SQL may alias columns with descriptive snake_case; map metadata field_name to extra JSON keys. */
const EXTRA_FIELD_JSON_ALIASES = {
  asset: ['total_assets_dollars'],
  dep: ['total_deposits_dollars'],
  nimy: ['net_interest_margin'],
  intinc: ['total_interest_income_dollars'],
  depdom: ['domestic_deposits_dollars'],
  eqtot: ['total_equity_capital_dollars'],
  roa: ['return_on_assets'],
  numemp: ['number_of_employees'],
  /** API may return either spelling for the same concept; try both before giving up */
  net_loans_leases: ['net_loans_leases_dollars', 'net_loans_and_leases_dollars'],
  net_loans_and_leases: ['net_loans_leases_dollars', 'net_loans_and_leases_dollars'],
  earning_assets: ['earning_assets_dollars'],
  domestic_loans: ['domestic_loans_dollars'],
  cash_balances: ['cash_balances_dollars', 'cash_and_balances_dollars'],
  cash_and_balances: ['cash_balances_dollars', 'cash_and_balances_dollars'],
};

export const extractExtraMetric = (row, fieldName, fieldMetaByName) => {
  const meta = fieldMetaByName.get(fieldName);
  if (fieldName === 'netinc') {
    const d = pickCaseInsensitive(
      row,
      'net_income_dollars',
      'netinc_dollars',
      'total_netinc_dollars'
    );
    if (d !== undefined && d !== null) {
      const n = Number(d);
      return Number.isFinite(n) ? n : null;
    }
  }
  const aliases = EXTRA_FIELD_JSON_ALIASES[fieldName] || [];
  const fn = String(fieldName);
  /** API often returns e.g. credit_card_loans_dollars while field_name is credit_card_loans */
  const dollarSuffixCandidates =
    fn.toLowerCase().endsWith('_dollars') ? [] : [`${fn}_dollars`];

  let raw = pickCaseInsensitive(
    row,
    fieldName,
    fieldName.toUpperCase(),
    ...aliases,
    ...dollarSuffixCandidates,
    `total_${fieldName}_dollars`
  );
  if (raw === undefined || raw === null) {
    raw = findDollarColumnByNormalizedBase(row, fieldName);
  }
  if (raw === undefined || raw === null) return null;
  if (meta?.is_currency && meta?.unit === 'thousands') {
    return maybeThousandsToDollars(Number(raw));
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
};

export const normalizeBankRows = (rawRows, options = {}) => {
  const { extraFieldNames = [], fieldMetaByName = new Map() } = options;
  const extra = new Set(extraFieldNames.map((k) => canonicalFieldName(k)).filter(Boolean));

  if (!Array.isArray(rawRows)) return [];

  return rawRows.map((row) => {
    const cert = pickCaseInsensitive(row, 'cert', 'CERT');
    const bank_name = pickCaseInsensitive(row, 'bank_name', 'BANK_NAME', 'name', 'NAME', 'institution_name', 'INSTITUTION_NAME');

    const assets_dollars_raw = pickCaseInsensitive(
      row,
      'assets_dollars',
      'ASSETS_DOLLARS',
      'total_assets_dollars',
      'TOTAL_ASSETS_DOLLARS',
      'assets',
      'ASSETS',
      'asset_dollars',
      'ASSET_DOLLARS'
    );
    const asset_thousands_raw = pickCaseInsensitive(row, 'asset', 'ASSET');

    const assets =
      assets_dollars_raw !== undefined
        ? Number(assets_dollars_raw)
        : asset_thousands_raw !== undefined
          ? maybeThousandsToDollars(asset_thousands_raw)
          : undefined;

    const deposits_dollars_raw = pickCaseInsensitive(
      row,
      'deposits_dollars',
      'DEPOSITS_DOLLARS',
      'total_deposits_dollars',
      'TOTAL_DEPOSITS_DOLLARS',
      'deposits',
      'DEPOSITS',
      'deposit_dollars',
      'DEP_DOLLARS',
      'dep_dollars',
      'DEP_DOLLARS'
    );
    const dep_thousands_raw =
      pickCaseInsensitive(row, 'dep', 'DEP') ?? pickCaseInsensitive(row, 'depdom', 'DEPDOM');

    const deposits =
      deposits_dollars_raw !== undefined
        ? Number(deposits_dollars_raw)
        : dep_thousands_raw !== undefined
          ? maybeThousandsToDollars(dep_thousands_raw)
          : undefined;

    const netinc_dollars_raw = pickCaseInsensitive(
      row,
      'netinc_dollars',
      'NETINC_DOLLARS',
      'net_income_dollars',
      'NET_INCOME_DOLLARS',
      'total_netinc_dollars',
      'TOTAL_NETINC_DOLLARS'
    );
    const netinc_thousands_raw = pickCaseInsensitive(row, 'netinc', 'NETINC');
    const netinc =
      netinc_dollars_raw !== undefined
        ? Number(netinc_dollars_raw)
        : netinc_thousands_raw !== undefined
          ? maybeThousandsToDollars(netinc_thousands_raw)
          : undefined;

    const roa = pickCaseInsensitive(
      row,
      'roa',
      'ROA',
      'return_on_assets',
      'RETURN_ON_ASSETS',
      'calculated_roa',
      'CALCULATED_ROA'
    );

    let capital_ratio = pickCaseInsensitive(row, 'capital_ratio', 'CAPITAL_RATIO');
    const eqtot_thousands = pickCaseInsensitive(row, 'eqtot', 'EQTOT');
    const asset_thousands_for_ratio = pickCaseInsensitive(row, 'asset', 'ASSET');

    if (capital_ratio === undefined && eqtot_thousands !== undefined && asset_thousands_for_ratio !== undefined) {
      const a = Number(asset_thousands_for_ratio);
      const e = Number(eqtot_thousands);
      if (Number.isFinite(a) && a !== 0 && Number.isFinite(e)) {
        capital_ratio = (e / a) * 100;
      }
    }

    const stname = pickCaseInsensitive(row, 'stname', 'STNAME');
    const stalp = pickCaseInsensitive(row, 'stalp', 'STALP');
    const city = pickCaseInsensitive(row, 'city', 'CITY');

    const report_date =
      pickCaseInsensitive(row, 'report_date', 'REPORT_DATE', 'repdte', 'REPDTE');

    const nimy = pickCaseInsensitive(
      row,
      'nimy',
      'NIMY',
      'net_interest_margin',
      'NET_INTEREST_MARGIN'
    );
    const roaptx = pickCaseInsensitive(row, 'roaptx', 'ROAPTX');
    const lnlsnet = pickCaseInsensitive(row, 'lnlsnet', 'LNLSNET');
    const elnatr = pickCaseInsensitive(row, 'elnatr', 'ELNATR');

    const assets_growth_pct = pickCaseInsensitive(row, 'assets_growth_pct', 'ASSETS_GROWTH_PCT', 'growth_pct', 'GROWTH_PCT');

    const out = {
      cert: cert ?? null,
      bank_name: bank_name ?? 'Unknown Bank',
      city: city ?? null,
      stalp: stalp ?? null,
      stname: stname ?? null,
      report_date: report_date ?? null,
      assets: assets !== undefined ? Number(assets) : null,
      deposits: deposits !== undefined ? Number(deposits) : null,
      netinc: netinc !== undefined ? Number(netinc) : null,
      roa: roa !== undefined ? Number(roa) : null,
      capital_ratio: capital_ratio !== undefined ? Number(capital_ratio) : null,
      nimy: nimy !== undefined ? Number(nimy) : null,
      roaptx: roaptx !== undefined ? Number(roaptx) : null,
      lnlsnet: lnlsnet !== undefined ? Number(lnlsnet) : null,
      elnatr: elnatr !== undefined ? Number(elnatr) : null,
      assets_growth_pct: assets_growth_pct !== undefined ? Number(assets_growth_pct) : undefined,
      raw: row,
    };

    for (const fname of extra) {
      if (fname === 'assets') continue;
      if (fname === 'repdte') {
        out.repdte = out.report_date ?? pickCaseInsensitive(row, 'repdte', 'REPDTE') ?? null;
        continue;
      }
      if (out[fname] !== undefined && out[fname] !== null) continue;
      if (fname === 'dep') {
        out.dep = out.deposits ?? extractExtraMetric(row, 'dep', fieldMetaByName);
        continue;
      }
      if (fname === 'deposits') {
        out.deposits = out.deposits ?? extractExtraMetric(row, 'dep', fieldMetaByName);
        continue;
      }
      const v = extractExtraMetric(row, fname, fieldMetaByName);
      if (v !== null && v !== undefined) out[fname] = v;
    }

    return out;
  });
};
