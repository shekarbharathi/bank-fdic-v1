import { useCallback, useEffect, useState } from 'react';
import { chatAPI } from '../api/client';
import ChatFilterBox from './ChatFilterBox';
import ChatResponsePanel from './ChatResponsePanel';
import BankExplorerTable from './BankExplorerTable';
import './BankExploreHome.css';

const STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
];

const stateNameByAbbr = STATES.reduce((acc, s) => {
  acc[s.abbr] = s.name;
  return acc;
}, {});

const rankingCriteriaLabels = {
  size: 'assets',
  profitability: 'ROA',
  safety: 'capital ratio',
};

const extractTopN = (text) => {
  const m = String(text || '').match(/top\s+(\d{1,3})/i);
  if (!m) return 5;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(30, n));
};

const extractStateAbbr = (text) => {
  const t = String(text || '');
  const lower = t.toLowerCase();

  // Check full state names first.
  for (const s of STATES) {
    if (lower.includes(s.name.toLowerCase())) return s.abbr;
  }

  // Then check state abbreviations (word-ish boundaries).
  for (const s of STATES) {
    const re = new RegExp(`\\b${s.abbr}\\b`, 'i');
    if (re.test(t)) return s.abbr;
  }

  return null;
};

const extractRankingCriteria = (text) => {
  const lower = String(text || '').toLowerCase();
  if (/\bcapital\b|\bsafety\b|\bcapital ratio\b|\bequity\b/.test(lower)) return 'safety';
  if (/\broa\b|\bprofit\b|\bprofitability\b/.test(lower)) return 'profitability';
  return 'size';
};

const extractRequestedMetrics = (text) => {
  const lower = String(text || '').toLowerCase();
  const metrics = [];

  if (/\broa\b|\bprofit\b/.test(lower)) metrics.push('roa');
  if (/\bcapital\b|\bsafety\b|\bcapital ratio\b|\bequity\b/.test(lower)) metrics.push('capital_ratio');
  if (/\bdeposit\b/.test(lower)) metrics.push('deposits');
  if (/\bnet income\b|\bnetinc\b|\bnet earnings\b/.test(lower)) metrics.push('netinc');
  if (/\bnet interest margin\b|\bnim\b/.test(lower)) metrics.push('nimy');

  return Array.from(new Set(metrics));
};

const buildExplorePrompt = ({ userText, limit }) => {
  const base = userText?.trim() ? userText.trim() : '';
  return `${base}

Return a ranking table for US FDIC banking data (active banks), limited to top ${limit}.
Use the most recent available financial report date per bank.
Return columns (as SQL aliases): cert, bank_name, city, stalp, stname, report_date,
assets_dollars, deposits_dollars, roa, capital_ratio, netinc_dollars, nimy, roaptx, lnlsnet, elnatr.
`;
};

const buildTopByCriteriaPrompt = ({ rankingCriteria, regionAbbr, limit }) => {
  const stateText = regionAbbr ? ` in ${stateNameByAbbr[regionAbbr]}` : '';
  const metricText = rankingCriteriaLabels[rankingCriteria] || 'assets';

  return `Show the top ${limit} active US banks${stateText} ranked by ${metricText}.
Use the most recent available financial report date per bank.
Return columns (as SQL aliases): cert, bank_name, city, stalp, stname, report_date,
assets_dollars, deposits_dollars, roa, capital_ratio, netinc_dollars, nimy, roaptx, lnlsnet, elnatr.
If needed, compute capital_ratio as (eqtot / NULLIF(asset, 0)) * 100.
`;
};

const pickCaseInsensitive = (row, ...candidates) => {
  if (!row) return undefined;
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const c of candidates) {
    const k = lowerMap.get(String(c).toLowerCase());
    if (k !== undefined) return row[k];
  }
  return undefined;
};

const maybeThousandsToDollars = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  // Heuristic: values above 1e11 are probably already dollars.
  if (Math.abs(n) >= 100_000_000_000) return n;
  return n * 1000;
};

const normalizeBankRows = (rawRows) => {
  if (!Array.isArray(rawRows)) return [];

  return rawRows.map((row) => {
    const cert = pickCaseInsensitive(row, 'cert', 'CERT');
    const bank_name = pickCaseInsensitive(row, 'bank_name', 'BANK_NAME', 'name', 'NAME', 'institution_name', 'INSTITUTION_NAME');

    // Dollars columns might be aliased as *_dollars; otherwise we try to convert from thousands.
    const assets_dollars_raw = pickCaseInsensitive(
      row,
      'assets_dollars',
      'ASSETS_DOLLARS',
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

    const netinc_dollars_raw = pickCaseInsensitive(row, 'netinc_dollars', 'NETINC_DOLLARS');
    const netinc_thousands_raw = pickCaseInsensitive(row, 'netinc', 'NETINC');
    const netinc =
      netinc_dollars_raw !== undefined
        ? Number(netinc_dollars_raw)
        : netinc_thousands_raw !== undefined
          ? maybeThousandsToDollars(netinc_thousands_raw)
          : undefined;

    const roa = pickCaseInsensitive(row, 'roa', 'ROA', 'calculated_roa', 'CALCULATED_ROA');

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

    const nimy = pickCaseInsensitive(row, 'nimy', 'NIMY');
    const roaptx = pickCaseInsensitive(row, 'roaptx', 'ROAPTX');
    const lnlsnet = pickCaseInsensitive(row, 'lnlsnet', 'LNLSNET');
    const elnatr = pickCaseInsensitive(row, 'elnatr', 'ELNATR');

    const assets_growth_pct = pickCaseInsensitive(row, 'assets_growth_pct', 'ASSETS_GROWTH_PCT', 'growth_pct', 'GROWTH_PCT');

    return {
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
  });
};

const BankExploreHome = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [chatInput, setChatInput] = useState('');

  const [limit, setLimit] = useState(5);
  const [regionAbbr, setRegionAbbr] = useState(null);

  const [rankingCriteria, setRankingCriteria] = useState('size');
  const [sortState, setSortState] = useState({ key: 'assets', direction: 'desc' });

  const [visibleMetricIds, setVisibleMetricIds] = useState([]);

  const [confirmation, setConfirmation] = useState('Okay, showing you the top 5 banks by total assets.');

  const [detailBank, setDetailBank] = useState(null);
  const [branchRows, setBranchRows] = useState([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const handleOpenDetail = useCallback((bankRow) => {
    setDetailBank(bankRow);
    setBranchRows([]);
  }, []);

  const handleRequestBranches = useCallback(
    async (bankRow) => {
      if (!bankRow?.cert) return;
      setBranchLoading(true);
      setBranchRows([]);
      setError(null);

      try {
        const prompt = `For bank cert = ${bankRow.cert}, show its branches/locations from the locations table.
Return rows with columns: name, address, city, stalp, stname, zip, county, cbsa, cbsa_div, servtype.
Limit 20.`;
        const res = await chatAPI.sendMessage(prompt);
        const normalized = Array.isArray(res?.data)
          ? res.data.map((r) => ({
              name: pickCaseInsensitive(r, 'name') ?? null,
              address: pickCaseInsensitive(r, 'address') ?? null,
              city: pickCaseInsensitive(r, 'city') ?? null,
              stalp: pickCaseInsensitive(r, 'stalp') ?? null,
              stname: pickCaseInsensitive(r, 'stname') ?? null,
              zip: pickCaseInsensitive(r, 'zip') ?? null,
              county: pickCaseInsensitive(r, 'county') ?? null,
              cbsa: pickCaseInsensitive(r, 'cbsa') ?? null,
              cbsa_div: pickCaseInsensitive(r, 'cbsa_div') ?? null,
              servtype: pickCaseInsensitive(r, 'servtype') ?? null,
            }))
          : [];

        setBranchRows(normalized);
      } catch (e) {
        setError(e?.message || 'Failed to load branches');
      } finally {
        setBranchLoading(false);
      }
    },
    []
  );

  const updateConfirmationFromIntent = useCallback(
    ({ inferredRanking, inferredRegionAbbr, inferredLimit }) => {
      const regionName = inferredRegionAbbr ? stateNameByAbbr[inferredRegionAbbr] : null;
      const metricLabel =
        inferredRanking === 'size'
          ? 'total assets'
          : inferredRanking === 'profitability'
            ? 'ROA (profitability)'
            : 'capital ratio (safety)';

      const regionPart = regionName ? ` in ${regionName}` : '';
      setConfirmation(`Okay, showing you the top ${inferredLimit} banks${regionPart} ranked by ${metricLabel}.`);
    },
    []
  );

  const fetchTopByCriteria = useCallback(
    async ({ nextRankingCriteria, nextRegionAbbr, nextLimit }) => {
      setIsLoading(true);
      setError(null);
      setDetailBank(null);
      setBranchRows([]);
      setBranchLoading(false);
      try {
        const prompt = buildTopByCriteriaPrompt({
          rankingCriteria: nextRankingCriteria,
          regionAbbr: nextRegionAbbr,
          limit: nextLimit,
        });
        const res = await chatAPI.sendMessage(prompt);
        if (res?.error) throw new Error(res?.error || 'Backend error');

        const normalized = normalizeBankRows(res?.data);
        setRows(normalized);

        // Ensure the ranking metric is visible (progressive exploration).
        const metricKey =
          nextRankingCriteria === 'size'
            ? null
            : nextRankingCriteria === 'profitability'
              ? 'roa'
              : 'capital_ratio';

        setVisibleMetricIds((prev) => {
          const next = new Set(prev);
          // Always keep assets visible (handled by table core).
          if (metricKey) next.add(metricKey);
          return Array.from(next);
        });

        setSortState({
          key: metricKey ?? 'assets',
          direction: 'desc',
        });

        updateConfirmationFromIntent({
          inferredRanking: nextRankingCriteria,
          inferredRegionAbbr: nextRegionAbbr,
          inferredLimit: nextLimit,
          requestedMetrics: metricKey ? [metricKey] : [],
        });
      } catch (e) {
        setError(e?.message || 'Failed to load banks');
      } finally {
        setIsLoading(false);
      }
    },
    [updateConfirmationFromIntent]
  );

  useEffect(() => {
    // Initial table state: Top 5 Banks.
    // If the user has no backend configured, this may show the error panel.
    fetchTopByCriteria({ nextRankingCriteria: 'size', nextRegionAbbr: null, nextLimit: 5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChatSubmit = useCallback(
    async (text) => {
      const nextLimit = extractTopN(text);
      const nextRegionAbbr = extractStateAbbr(text);
      const inferredRanking = extractRankingCriteria(text);
      const requestedMetrics = extractRequestedMetrics(text);

      setLimit(nextLimit);
      setRegionAbbr(nextRegionAbbr);
      setRankingCriteria(inferredRanking);
      setError(null);
      setIsLoading(true);
      setDetailBank(null);
      setBranchRows([]);
      setBranchLoading(false);

      try {
        const prompt = buildExplorePrompt({ userText: text, limit: nextLimit });
        const res = await chatAPI.sendMessage(prompt);
        if (res?.error) throw new Error(res?.error || 'Backend error');

        const normalized = normalizeBankRows(res?.data);
        setRows(normalized);

        // Update visible columns to reflect what the user asked for.
        const nextVisible = new Set(visibleMetricIds);
        for (const m of requestedMetrics) nextVisible.add(m);
        if (inferredRanking === 'profitability') nextVisible.add('roa');
        if (inferredRanking === 'safety') nextVisible.add('capital_ratio');
        setVisibleMetricIds(Array.from(nextVisible));

        setSortState({
          key:
            inferredRanking === 'size'
              ? 'assets'
              : inferredRanking === 'profitability'
                ? 'roa'
                : 'capital_ratio',
          direction: 'desc',
        });

        updateConfirmationFromIntent({
          inferredRanking,
          inferredRegionAbbr: nextRegionAbbr,
          inferredLimit: nextLimit,
          requestedMetrics,
        });

        setChatInput('');
      } catch (e) {
        setError(
          e?.message ||
            "I couldn't load that right now. Try something like “most profitable banks” or “banks in California”."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [updateConfirmationFromIntent, visibleMetricIds]
  );

  const handleRankingCriteriaChange = useCallback(
    async (nextCriteria) => {
      setRankingCriteria(nextCriteria);
      await fetchTopByCriteria({
        nextRankingCriteria: nextCriteria,
        nextRegionAbbr: regionAbbr,
        nextLimit: limit,
      });
    },
    [fetchTopByCriteria, limit, regionAbbr]
  );

  const handleSortChange = useCallback(
    (nextSort) => {
      setSortState(nextSort);
      const key = nextSort?.key;
      const label =
        key === 'assets'
          ? 'assets'
          : key === 'bank_name'
            ? 'bank name'
            : key === 'capital_ratio'
              ? 'capital ratio'
              : key === 'roa'
                ? 'ROA'
                : key;

      const dir = nextSort?.direction === 'asc' ? 'low to high' : 'high to low';
      setConfirmation(`Okay, sorting by ${label} (${dir}).`);
    },
    []
  );

  const handleToggleMetric = useCallback(
    (metricKey) => {
      setVisibleMetricIds((prev) => {
        const next = new Set(prev);
        if (next.has(metricKey)) next.delete(metricKey);
        else next.add(metricKey);
        return Array.from(next);
      });

      const label = metricKey === 'roa' ? 'ROA (profitability)' : metricKey === 'capital_ratio' ? 'capital ratio (safety)' : metricKey;
      setConfirmation(`Okay, adding ${label} to the table.`);
    },
    []
  );

  const showChatPanel = true;

  return (
    <div className="bank-explore-page">
      <header className="bank-explore-header">
        <div className="bank-explore-title">BankStatz</div>
        <div className="bank-explore-subtitle">Explore US banking data interactively</div>
      </header>

      <ChatFilterBox
        value={chatInput}
        onChange={setChatInput}
        onSubmit={handleChatSubmit}
        isLoading={isLoading}
        disabled={false}
        placeholder="Show me..."
      />

      <ChatResponsePanel
        isVisible={showChatPanel}
        isLoading={isLoading}
        confirmation={confirmation}
        error={error}
      />

      <BankExplorerTable
        rows={rows}
        rankingCriteria={rankingCriteria}
        sortState={sortState}
        visibleMetricIds={visibleMetricIds}
        onRankingCriteriaChange={handleRankingCriteriaChange}
        onSortChange={handleSortChange}
        onToggleMetric={handleToggleMetric}
        onOpenDetail={handleOpenDetail}
        onRequestBranches={handleRequestBranches}
      />

      <aside className={`detail-panel ${detailBank ? 'open' : ''}`} aria-label="Bank detail panel">
        <div className="detail-panel-shell">
          <div className="detail-panel-header">
            <div>
              <div className="detail-panel-title">{detailBank?.bank_name || 'Bank Details'}</div>
              <div className="detail-panel-sub">
                {detailBank ? `${detailBank.city || ''}${detailBank.stalp ? `, ${detailBank.stalp}` : ''}` : 'Click a bank name to explore.'}
              </div>
            </div>
            <button
              type="button"
              className="detail-panel-close"
              onClick={() => setDetailBank(null)}
              aria-label="Close details"
            >
              ✕
            </button>
          </div>

          {detailBank ? (
            <div className="detail-panel-body">
              <div className="detail-metrics">
                <div className="detail-metric">
                  <div className="detail-metric-label">Rank</div>
                  <div className="detail-metric-value">{detailBank.__rank ?? '—'}</div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">Assets</div>
                  <div className="detail-metric-value">{detailBank.assets !== undefined && detailBank.assets !== null ? `$${Number(detailBank.assets).toFixed(0)}` : 'N/A'}</div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">ROA</div>
                  <div className="detail-metric-value">{detailBank.roa !== null ? `${detailBank.roa.toFixed(2)}%` : 'N/A'}</div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">Capital Ratio</div>
                  <div className="detail-metric-value">
                    {detailBank.capital_ratio !== null ? `${Number(detailBank.capital_ratio).toFixed(2)}%` : 'N/A'}
                  </div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">Deposits</div>
                  <div className="detail-metric-value">{detailBank.deposits !== null ? `$${Number(detailBank.deposits).toFixed(0)}` : 'N/A'}</div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">Report Date</div>
                  <div className="detail-metric-value">{detailBank.report_date || '—'}</div>
                </div>
              </div>

              <div className="detail-branch-section">
                <div className="detail-branch-title">Branches</div>
                <div className="detail-branch-actions">
                  <button
                    type="button"
                    className="detail-action"
                    onClick={() => handleRequestBranches(detailBank)}
                    disabled={branchLoading}
                    aria-label="View branches for this bank"
                  >
                    {branchLoading ? 'Loading...' : 'View Branches'}
                  </button>
                </div>

                {branchLoading ? (
                  <div className="detail-loading">
                    <span className="spinner" aria-hidden="true" />
                    <span>Fetching locations...</span>
                  </div>
                ) : branchRows.length === 0 ? (
                  <div className="detail-branch-empty">No branches loaded yet. Click “View Branches”.</div>
                ) : (
                  <div className="detail-branch-list" role="list">
                    {branchRows.slice(0, 12).map((b, idx) => (
                      <div key={`${b.name || 'branch'}-${idx}`} className="detail-branch-row" role="listitem">
                        <div className="detail-branch-name">{b.name || 'Branch'}</div>
                        <div className="detail-branch-address">
                          {[b.address, b.city, b.stalp, b.zip].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="detail-panel-empty">
              Every row is clickable. Open a bank to see details, or right-click a row for Compare and View Branches.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default BankExploreHome;

