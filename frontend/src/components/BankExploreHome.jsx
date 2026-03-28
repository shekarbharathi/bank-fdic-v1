import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chatAPI } from '../api/client';
import ChatFilterBox from './ChatFilterBox';
import ChatResponsePanel from './ChatResponsePanel';
import BankExplorerTable from './BankExplorerTable';
import { METRIC_DEFS_DEFAULT } from '../constants/metricDefsDefault';
import ColumnPickerModal from './ColumnPickerModal';
import {
  appendMetricsToQuery,
  canonicalFieldName,
  withDefaultAssetsDisplayNames,
} from '../utils/columnPickerQuery';
import { buildFieldMetaMap, mergeMetricDefs } from '../utils/columnPickerMetrics';
import { computeDiffHighlightRanges } from '../utils/queryDiffHighlight';
import { resolveExperience } from '../utils/vizRouting';
import BankComparisonViz from './viz/BankComparisonViz';
import TrendChartViz from './viz/TrendChartViz';
import MetricExplorerViz from './viz/MetricExplorerViz';
import StateOverviewViz from './viz/StateOverviewViz';
import PeerGroupViz from './viz/PeerGroupViz';
import SurprisingFactsCarousel from './viz/SurprisingFactsCarousel';
import './BankExploreHome.css';

/** Set to true to show the Surprising Facts (Insights) carousel again. */
const SHOW_INSIGHTS_CAROUSEL = false;

const LANDING_EXAMPLE_QUERIES = [
  'Compare JPMorgan Chase with CitiBank',
  'Bank of America assets over time',
  "What's the ROA distribution across banks",
  'Overview of banks in New York',
  'All banks in texas with more than 20 billion but less than 50 billion in assets',
];

const TYPEWRITER_PHRASES = [
  'top 10 banks by assets',
  'top 10 banks in california by deposits',
  'poorest 5 banks by assets',
  'top 5 banks in New York with highest net interest margin',
  '10 banks with lowest equity capital ratio',
];

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

const SUGGESTION_OPTIONS = [
  'Show me the top 10 banks by assets',
  'Which banks have the best capital ratios?',
  'top 10 banks in California with ROA greater than 1%?',
  'top 5 banks in texas less than 50 billion in assets',
];

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

const isRefusalResponse = (val) => {
  if (val == null) return false;
  const s = String(val).toLowerCase();
  return REFUSAL_PATTERNS.some((p) => s.includes(p.toLowerCase()));
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

/** LLM/SQL may alias columns with descriptive snake_case; map metadata field_name → extra JSON keys. */
const EXTRA_FIELD_JSON_ALIASES = {
  asset: ['total_assets_dollars'],
  dep: ['total_deposits_dollars'],
  nimy: ['net_interest_margin'],
  intinc: ['total_interest_income_dollars'],
  depdom: ['domestic_deposits_dollars'],
  eqtot: ['total_equity_capital_dollars'],
  roa: ['return_on_assets'],
  numemp: ['number_of_employees'],
};

const extractExtraMetric = (row, fieldName, fieldMetaByName) => {
  const meta = fieldMetaByName.get(fieldName);
  // LLM *_dollars / descriptive keys are whole dollars, not FDIC thousands
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
  const raw = pickCaseInsensitive(
    row,
    fieldName,
    fieldName.toUpperCase(),
    ...aliases,
    `total_${fieldName}_dollars`
  );
  if (raw === undefined || raw === null) return null;
  if (meta?.is_currency && meta?.unit === 'thousands') {
    return maybeThousandsToDollars(Number(raw));
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
};

const normalizeBankRows = (rawRows, options = {}) => {
  const { extraFieldNames = [], fieldMetaByName = new Map() } = options;
  const extra = new Set(extraFieldNames.map((k) => canonicalFieldName(k)).filter(Boolean));

  if (!Array.isArray(rawRows)) return [];

  return rawRows.map((row) => {
    const cert = pickCaseInsensitive(row, 'cert', 'CERT');
    const bank_name = pickCaseInsensitive(row, 'bank_name', 'BANK_NAME', 'name', 'NAME', 'institution_name', 'INSTITUTION_NAME');

    // Dollars columns might be aliased as *_dollars; otherwise we try to convert from thousands.
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

const BankExploreHome = () => {
  const chatFilterRef = useRef(null);
  const shouldFocusAfterLoad = useRef(false);
  const [activeTopTab, setActiveTopTab] = useState('banks');
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  /** table | scalar | suggestions | compare_banks | trend_tracker | metric_explorer | state_explorer | peer_group */
  const [viewMode, setViewMode] = useState('table');
  const [scalarValue, setScalarValue] = useState(null);
  const [vizMeta, setVizMeta] = useState({ title: '', config: {} });
  const [vizData, setVizData] = useState([]);
  /** After first successful chat submit, chat moves to top and results area is shown. */
  const [hasSubmittedQuery, setHasSubmittedQuery] = useState(false);

  const [chatInput, setChatInput] = useState('');
  /** When false and landing, show cycling typewriter in the chat field; any real input sets true until cleared. */
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [typewriterDisplay, setTypewriterDisplay] = useState('');
  const [queryHighlightRanges, setQueryHighlightRanges] = useState(null);

  const [sortState, setSortState] = useState({ key: 'assets', direction: 'desc' });

  const [visibleMetricIds, setVisibleMetricIds] = useState([]);

  const [fieldGroups, setFieldGroups] = useState([]);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [pickerSession, setPickerSession] = useState(0);

  const fieldMetaByName = useMemo(() => buildFieldMetaMap(fieldGroups), [fieldGroups]);
  const metricDefsMerged = useMemo(() => mergeMetricDefs(METRIC_DEFS_DEFAULT, fieldGroups), [fieldGroups]);

  const [, setConfirmation] = useState('');

  const [detailBank, setDetailBank] = useState(null);
  const [branchRows, setBranchRows] = useState([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const hasSubmittedQueryRef = useRef(hasSubmittedQuery);
  const userHasInteractedRef = useRef(userHasInteracted);
  const chatInputRef = useRef(chatInput);
  hasSubmittedQueryRef.current = hasSubmittedQuery;
  userHasInteractedRef.current = userHasInteracted;
  chatInputRef.current = chatInput;

  const displayValue = useMemo(() => {
    if (hasSubmittedQuery) return chatInput;
    if (!userHasInteracted) return typewriterDisplay;
    return chatInput;
  }, [hasSubmittedQuery, userHasInteracted, chatInput, typewriterDisplay]);

  /** Lighter textarea color while cycling typewriter; normal color once user types. */
  const isTypewriterMuted = useMemo(
    () => !hasSubmittedQuery && !userHasInteracted && chatInput === '',
    [hasSubmittedQuery, userHasInteracted, chatInput]
  );

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await chatAPI.getFieldGroups();
        if (!cancelled && data?.groups) setFieldGroups(data.groups);
      } catch {
        if (!cancelled) setFieldGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hasSubmittedQuery || isLoading) return;
    if (userHasInteracted || chatInput !== '') return;

    let cancelled = false;
    const phrases = TYPEWRITER_PHRASES;
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const shouldStop = () =>
      cancelled ||
      hasSubmittedQueryRef.current ||
      userHasInteractedRef.current ||
      chatInputRef.current !== '';

    (async () => {
      while (!cancelled) {
        for (const phrase of phrases) {
          if (shouldStop()) return;
          for (let i = 0; i <= phrase.length; i++) {
            if (shouldStop()) return;
            setTypewriterDisplay(phrase.slice(0, i));
            await delay(42);
          }
          if (shouldStop()) return;
          await delay(1800);
          for (let i = phrase.length; i >= 0; i--) {
            if (shouldStop()) return;
            setTypewriterDisplay(phrase.slice(0, i));
            await delay(22);
          }
          if (shouldStop()) return;
          await delay(550);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasSubmittedQuery, userHasInteracted, chatInput, isLoading]);

  const handleChatSubmit = useCallback(
    async (text, submitOptions = {}) => {
      const { visibleMetricOverride } = submitOptions;
      const nextLimit = extractTopN(text);
      const nextRegionAbbr = extractStateAbbr(text);
      const inferredRanking = extractRankingCriteria(text);
      const requestedMetrics = extractRequestedMetrics(text);
      setError(null);
      setIsLoading(true);
      setDetailBank(null);
      setBranchRows([]);
      setBranchLoading(false);
      setViewMode('table');
      setScalarValue(null);
      setVizMeta({ title: '', config: {} });
      setVizData([]);

      try {
        const res = await chatAPI.sendMessage(text?.trim() || text);

        if (res?.error_code === 'out_of_scope' || res?.error === 'out_of_scope') {
          setViewMode('suggestions');
          setRows([]);
          setScalarValue(null);
          return;
        }

        if (res?.error) {
          setViewMode('suggestions');
          setRows([]);
          setScalarValue(null);
          return;
        }

        const data = res?.data;
        if (!Array.isArray(data)) {
          setViewMode('suggestions');
          setRows([]);
          setScalarValue(null);
          return;
        }

        if (isRefusalResponse(res?.response)) {
          setViewMode('suggestions');
          setRows([]);
          setScalarValue(null);
          return;
        }

        const { experience, title, config } = resolveExperience(res.intent, res.visualization, data);

        if (experience === 'scalar') {
          const row0 = data[0];
          if (!row0 || Object.keys(row0).length === 0) {
            setViewMode('suggestions');
            setRows([]);
            setScalarValue(null);
            return;
          }
          const val = Object.values(row0)[0];
          if (isRefusalResponse(val) || isRefusalResponse(res?.response)) {
            setViewMode('suggestions');
            setRows([]);
            setScalarValue(null);
            return;
          }
          setViewMode('scalar');
          setScalarValue(val);
          setRows([]);
          setVizMeta({ title, config });
          setVizData([]);
          return;
        }

        if (experience === 'table') {
          const nextVisible = new Set((visibleMetricOverride ?? visibleMetricIds).map(canonicalFieldName));
          for (const m of requestedMetrics) nextVisible.add(canonicalFieldName(m));
          if (inferredRanking === 'profitability') nextVisible.add('roa');
          if (inferredRanking === 'safety') nextVisible.add('capital_ratio');
          const effectiveExtra = Array.from(nextVisible);

          const normalized = normalizeBankRows(data, {
            extraFieldNames: effectiveExtra,
            fieldMetaByName,
          });
          setRows(normalized);

          setVisibleMetricIds(effectiveExtra);

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
          setVizMeta({ title, config });
          setVizData([]);
          return;
        }

        setViewMode(experience);
        setVizMeta({ title, config });
        setVizData(data);
        setRows([]);
        setScalarValue(null);
      } catch {
        setViewMode('suggestions');
        setRows([]);
        setScalarValue(null);
        setVizMeta({ title: '', config: {} });
        setVizData([]);
      } finally {
        setIsLoading(false);
        setHasSubmittedQuery(true);
        shouldFocusAfterLoad.current = true;
      }
    },
    [updateConfirmationFromIntent, visibleMetricIds, fieldMetaByName]
  );

  const pickerSelectedFieldNames = useMemo(
    () => visibleMetricIds.map((id) => canonicalFieldName(id)),
    [visibleMetricIds]
  );

  const clearQueryHighlight = useCallback(() => setQueryHighlightRanges(null), []);

  const handleChatFilterFocus = useCallback(
    (e) => {
      if (hasSubmittedQuery || userHasInteracted || (chatInput && chatInput.length > 0)) return;
      const ta = e.target;
      if (typewriterDisplay.length > 0 && ta && typeof ta.select === 'function') {
        requestAnimationFrame(() => ta.select());
      }
    },
    [hasSubmittedQuery, userHasInteracted, chatInput, typewriterDisplay.length]
  );

  const handleChatInputChange = useCallback((next) => {
    setQueryHighlightRanges(null);
    setChatInput(next);
    if (next === '') {
      setUserHasInteracted(false);
      setTypewriterDisplay('');
    } else {
      setUserHasInteracted(true);
    }
  }, []);

  const handleColumnPickerApply = useCallback(
    ({ selectedFieldNames }) => {
      const canonFromModal = selectedFieldNames.map((id) => canonicalFieldName(id));
      const prevCanon = visibleMetricIds.map((id) => canonicalFieldName(id));
      // Union: keep columns already shown (incl. ranking/inferred metrics not in metadata) plus modal picks.
      const mergedVisible = [...new Set([...prevCanon, ...canonFromModal])];

      const displayNames = mergedVisible
        .map((id) => {
          const fm = fieldMetaByName.get(id);
          if (fm?.display_name) return fm.display_name;
          return metricDefsMerged[id]?.label || id;
        })
        .filter(Boolean);

      const assetLabel =
        fieldMetaByName.get('asset')?.display_name ??
        metricDefsMerged.assets?.label ??
        'Total Assets';
      const prevText = chatInput;
      const q = appendMetricsToQuery(
        chatInput,
        withDefaultAssetsDisplayNames(displayNames, assetLabel)
      );
      setChatInput(q);
      const colRanges = computeDiffHighlightRanges(prevText, q);
      setQueryHighlightRanges(colRanges.length ? colRanges : null);
      setColumnPickerOpen(false);
      setUserHasInteracted(true);
      handleChatSubmit(q, { visibleMetricOverride: mergedVisible });
    },
    [chatInput, handleChatSubmit, visibleMetricIds, fieldMetaByName, metricDefsMerged]
  );

  const handleSuggestionClick = useCallback(
    (optionText) => {
      setUserHasInteracted(true);
      setChatInput(optionText);
      handleChatSubmit(optionText);
    },
    [handleChatSubmit]
  );

  const handleExploreFactQuery = useCallback(
    (q) => {
      setUserHasInteracted(true);
      setChatInput(q);
      handleChatSubmit(q);
    },
    [handleChatSubmit]
  );

  const handleExpandClick = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);
      const prevText = chatInput;
      try {
        const expanded = await chatAPI.expandQuery(chatInput);
        setUserHasInteracted(true);
        setChatInput(expanded);
        const expRanges = computeDiffHighlightRanges(prevText, expanded);
        setQueryHighlightRanges(expRanges.length ? expRanges : null);
        await handleChatSubmit(expanded);
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message || 'Failed to expand');
        setViewMode('suggestions');
        setVizMeta({ title: '', config: {} });
        setVizData([]);
      } finally {
        setIsLoading(false);
      }
    },
    [chatInput, handleChatSubmit]
  );

  useEffect(() => {
    if (!isLoading && shouldFocusAfterLoad.current && activeTopTab === 'banks') {
      shouldFocusAfterLoad.current = false;
      const focusChatbox = () => {
        const input = document.getElementById('bank-chat-filter-input');
        if (input) {
          input.focus();
          const len = (input.value || '').length;
          input.setSelectionRange(len, len);
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(focusChatbox));
    }
  }, [isLoading, activeTopTab]);

  useEffect(() => {
    if (activeTopTab !== 'banks' || hasSubmittedQuery) return undefined;
    const id = window.setTimeout(() => {
      document.getElementById('bank-chat-filter-input')?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [activeTopTab, hasSubmittedQuery]);

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

  const showChatPanel = true;

  return (
    <div className="bank-explore-page">
      <header className="bank-explore-header">
        <div className="bank-explore-title">BankStatz</div>
      </header>
      <nav className="top-dataset-tabs" aria-label="Dataset type">
        <button
          type="button"
          className={`top-dataset-tab ${activeTopTab === 'banks' ? 'active' : ''}`}
          onClick={() => setActiveTopTab('banks')}
          aria-pressed={activeTopTab === 'banks'}
        >
          Banks
        </button>
        <button
          type="button"
          className={`top-dataset-tab ${activeTopTab === 'credit-unions' ? 'active' : ''}`}
          onClick={() => setActiveTopTab('credit-unions')}
          aria-pressed={activeTopTab === 'credit-unions'}
        >
          Credit Unions
        </button>
      </nav>

      {activeTopTab === 'banks' ? (
        <>
          <div className="bank-explore-banks-shell">
            <div
              className={`bank-explore-banks-root ${
                hasSubmittedQuery ? 'bank-explore-banks-root--has-query' : 'bank-explore-banks-root--landing'
              }`}
            >
              {hasSubmittedQuery ? (
                <ChatFilterBox
                  ref={chatFilterRef}
                  value={displayValue}
                  onChange={handleChatInputChange}
                  onSubmit={handleChatSubmit}
                  isLoading={isLoading}
                  disabled={false}
                  placeholder="Show me..."
                  highlightRanges={queryHighlightRanges}
                  onHighlightClear={clearQueryHighlight}
                  onFocus={handleChatFilterFocus}
                />
              ) : (
                <div className="bank-explore-landing-stack">
                  <ChatFilterBox
                    ref={chatFilterRef}
                    value={displayValue}
                    onChange={handleChatInputChange}
                    onSubmit={handleChatSubmit}
                    isLoading={isLoading}
                    disabled={false}
                    placeholder="Show me..."
                    highlightRanges={queryHighlightRanges}
                    onHighlightClear={clearQueryHighlight}
                    onFocus={handleChatFilterFocus}
                    typewriterSuggestion={isTypewriterMuted}
                  />
                  <section className="bank-explore-landing-examples" aria-label="Example queries">
                    <p className="bank-explore-landing-examples-heading">Try these examples</p>
                    <ul className="bank-explore-landing-example-list">
                      {LANDING_EXAMPLE_QUERIES.map((q) => (
                        <li key={q}>
                          <button
                            type="button"
                            className="bank-explore-landing-example-tile"
                            onClick={() => handleSuggestionClick(q)}
                            disabled={isLoading}
                          >
                            {q}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
            </div>

            {hasSubmittedQuery && (
              <>
                {SHOW_INSIGHTS_CAROUSEL ? (
                  <SurprisingFactsCarousel onExploreQuery={handleExploreFactQuery} disabled={isLoading} />
                ) : null}

                <ChatResponsePanel
                  isVisible={showChatPanel}
                  isLoading={isLoading}
                  error={error}
                />

                {viewMode === 'suggestions' && (
            <div className="bank-explore-suggestions" aria-live="polite">
              <p className="bank-explore-suggestions-intro">
                I only understand FDIC published information about banks. Try some of these:
              </p>
              <ul className="bank-explore-suggestions-list">
                {SUGGESTION_OPTIONS.map((option) => (
                  <li key={option}>
                    <button
                      type="button"
                      className="bank-explore-suggestion-option"
                      onClick={() => handleSuggestionClick(option)}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {viewMode === 'scalar' && (
            <div className="bank-explore-scalar" aria-live="polite">
              {vizMeta.title ? <h3 className="bank-explore-scalar-title">{vizMeta.title}</h3> : null}
              <span className="bank-explore-scalar-value">{String(scalarValue ?? '')}</span>
            </div>
          )}

          {viewMode === 'compare_banks' && (
            <BankComparisonViz data={vizData} title={vizMeta.title} config={vizMeta.config} />
          )}
          {viewMode === 'trend_tracker' && (
            <TrendChartViz data={vizData} title={vizMeta.title} config={vizMeta.config} />
          )}
          {viewMode === 'metric_explorer' && (
            <MetricExplorerViz data={vizData} title={vizMeta.title} config={vizMeta.config} />
          )}
          {viewMode === 'state_explorer' && (
            <StateOverviewViz data={vizData} title={vizMeta.title} config={vizMeta.config} />
          )}
          {viewMode === 'peer_group' && (
            <PeerGroupViz data={vizData} title={vizMeta.title} config={vizMeta.config} />
          )}

          {viewMode === 'table' && (
            <div className="bank-explore-table-wrap">
              <BankExplorerTable
                rows={rows}
                sortState={sortState}
                visibleMetricIds={visibleMetricIds}
                metricDefs={metricDefsMerged}
                onSortChange={handleSortChange}
                onOpenDetail={handleOpenDetail}
                onRequestBranches={handleRequestBranches}
                onOpenColumnPicker={() => {
                  setPickerSession((s) => s + 1);
                  setColumnPickerOpen(true);
                }}
                columnPickerDisabled={isLoading}
              />
              <button
                type="button"
                className="bank-explore-expand-chevron"
                onClick={handleExpandClick}
                disabled={isLoading}
                aria-label="Show 5 more results"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
                )}

              </>
            )}
          </div>

          <ColumnPickerModal
            key={columnPickerOpen ? `picker-${pickerSession}` : 'closed'}
            open={columnPickerOpen}
            onClose={() => setColumnPickerOpen(false)}
            groups={fieldGroups}
            selectedFieldNames={pickerSelectedFieldNames}
            currentQueryText={chatInput}
            onApply={handleColumnPickerApply}
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
        </>
      ) : (
        <section className="coming-soon-panel" aria-live="polite">
          Coming Soon
        </section>
      )}
    </div>
  );
};

export default BankExploreHome;

