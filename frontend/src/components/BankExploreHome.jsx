import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { chatAPI, sendClientDebugLog } from '../api/client';
import ChatFilterBox from './ChatFilterBox';
import ChatResponsePanel from './ChatResponsePanel';
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
import { INITIAL_VIEW_STATE, viewStateReducer } from '../reducers/viewStateReducer';
import { pickCaseInsensitive } from '../utils/bankDataNormalization';
import { extractTopN, extractStateAbbr, extractRankingCriteria, extractRequestedMetrics } from '../utils/queryParsing';
import { isRefusalResponse } from '../utils/responseValidation';
import { stateNameByAbbr } from '../constants/states';
import { LANDING_EXAMPLE_QUERIES, TYPEWRITER_PHRASES, SUGGESTION_OPTIONS } from '../constants/uiContent';
import VizRenderer from './viz/VizRenderer';
import SurprisingFactsCarousel from './viz/SurprisingFactsCarousel';
import './BankExploreHome.css';

/** Set to true to show the Surprising Facts (Insights) carousel again. */
const SHOW_INSIGHTS_CAROUSEL = false;

const BankExploreHome = () => {
  const chatFilterRef = useRef(null);
  const shouldFocusAfterLoad = useRef(false);
  const [activeTopTab, setActiveTopTab] = useState('banks');
  const [viewState, dispatchView] = useReducer(viewStateReducer, INITIAL_VIEW_STATE);
  const { viewMode, scalarValue, vizMeta, vizData } = viewState;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  /** After first successful chat submit, chat moves to top and results area is shown. */
  const [hasSubmittedQuery, setHasSubmittedQuery] = useState(false);

  const [chatInput, setChatInput] = useState('');
  /** When false and landing, show cycling typewriter in the chat field; any real input sets true until cleared. */
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [typewriterDisplay, setTypewriterDisplay] = useState('');
  const [queryHighlightRanges, setQueryHighlightRanges] = useState(null);

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

  /** Right-aligned user query bubbles after submit (persists across turns). */
  const [userChatMessages, setUserChatMessages] = useState([]);
  /** Shown above composer while loading: Interpreting → Fetching Data */
  const [statusPhase, setStatusPhase] = useState(null);
  /** Collapsible “Try these examples” under the bottom chatbox (after first submit). */
  const [footerExamplesOpen, setFooterExamplesOpen] = useState(false);

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

  useEffect(() => {
    if (!isLoading) {
      setStatusPhase(null);
      return;
    }
    const t = window.setTimeout(() => setStatusPhase('fetching'), 550);
    return () => window.clearTimeout(t);
  }, [isLoading]);

  const handleChatSubmit = useCallback(
    async (text, submitOptions = {}) => {
      const trimmed = String(text ?? '').trim();
      if (!trimmed) return;

      const { visibleMetricOverride } = submitOptions;
      setHasSubmittedQuery(true);
      setUserChatMessages((prev) => [...prev, trimmed]);
      setChatInput('');
      setTypewriterDisplay('');
      setUserHasInteracted(false);

      const nextLimit = extractTopN(trimmed);
      const nextRegionAbbr = extractStateAbbr(trimmed);
      const inferredRanking = extractRankingCriteria(trimmed);
      const requestedMetrics = extractRequestedMetrics(trimmed);
      setError(null);
      setStatusPhase('interpreting');
      setIsLoading(true);
      setDetailBank(null);
      setBranchRows([]);
      setBranchLoading(false);
      dispatchView({ type: 'RESET' });

      try {
        const res = await chatAPI.sendMessage(trimmed);

        if (res?.error_code === 'out_of_scope' || res?.error === 'out_of_scope') {
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        if (res?.error) {
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        const data = res?.data;
        if (!Array.isArray(data)) {
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        if (isRefusalResponse(res?.response)) {
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        const { experience, title, config } = resolveExperience(res.intent, res.visualization, data);

        // #region agent log
        sendClientDebugLog({
          sessionId: '073e07',
          hypothesisId: 'H1-H2',
          location: 'BankExploreHome.jsx:handleChatSubmit:afterResolveExperience',
          message: 'resolved experience',
          data: {
            intent: res?.intent,
            experience,
            dataRowCount: Array.isArray(data) ? data.length : null,
            hasError: !!(res?.error || res?.error_code),
          },
          timestamp: Date.now(),
        });
        // #endregion

        if (experience === 'scalar') {
          const row0 = data[0];
          if (!row0 || Object.keys(row0).length === 0) {
            dispatchView({ type: 'SHOW_SUGGESTIONS' });
            return;
          }
          const val = Object.values(row0)[0];
          if (isRefusalResponse(val) || isRefusalResponse(res?.response)) {
            dispatchView({ type: 'SHOW_SUGGESTIONS' });
            return;
          }
          dispatchView({ type: 'SHOW_SCALAR', value: val, vizMeta: { title, config } });
          return;
        }

        if (experience === 'table') {
          const nextVisible = new Set((visibleMetricOverride ?? visibleMetricIds).map(canonicalFieldName));
          for (const m of requestedMetrics) nextVisible.add(canonicalFieldName(m));
          if (inferredRanking === 'profitability') nextVisible.add('roa');
          if (inferredRanking === 'safety') nextVisible.add('capital_ratio');
          const effectiveExtra = Array.from(nextVisible);

          setVisibleMetricIds(effectiveExtra);

          updateConfirmationFromIntent({
            inferredRanking,
            inferredRegionAbbr: nextRegionAbbr,
            inferredLimit: nextLimit,
            requestedMetrics,
          });

          const tableConfig = {
            ...config,
            visibleMetrics: effectiveExtra,
            ranking: inferredRanking,
            sortKey: inferredRanking === 'size' ? 'assets' : inferredRanking === 'profitability' ? 'roa' : 'capital_ratio',
            sortDirection: 'desc',
            metricDefs: metricDefsMerged,
            fieldMetaByName,
          };
          dispatchView({ type: 'SHOW_VIZ', experience: 'table', data, vizMeta: { title, config: tableConfig } });
          return;
        }

        dispatchView({ type: 'SHOW_VIZ', experience, data, vizMeta: { title, config } });
      } catch {
        dispatchView({ type: 'SHOW_SUGGESTIONS' });
      } finally {
        setIsLoading(false);
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

  const handleFooterExamplePick = useCallback(
    (optionText) => {
      setFooterExamplesOpen(false);
      handleSuggestionClick(optionText);
    },
    [handleSuggestionClick]
  );

  const handleExploreFactQuery = useCallback(
    (q) => {
      setUserHasInteracted(true);
      setChatInput(q);
      handleChatSubmit(q);
    },
    [handleChatSubmit]
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
            {!hasSubmittedQuery ? (
              <div className="bank-explore-banks-root bank-explore-banks-root--landing">
                <div className="bank-explore-landing-stack">
                  <ChatFilterBox
                    ref={chatFilterRef}
                    value={displayValue}
                    onChange={handleChatInputChange}
                    onSubmit={handleChatSubmit}
                    isLoading={isLoading}
                    disabled={false}
                    placeholder=""
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
              </div>
            ) : (
              <div className="bank-explore-chat-layout">
                <div className="bank-explore-chat-main">
                  <div className="bank-explore-chat-bubbles" aria-live="polite">
                    {userChatMessages.map((msg, i) => (
                      <div key={`user-msg-${i}`} className="bank-explore-chat-user-bubble">
                        {msg}
                      </div>
                    ))}
                  </div>

                  {isLoading && statusPhase ? (
                    <div className="bank-explore-chat-status bank-explore-chat-status--below-bubble" aria-live="polite">
                      {statusPhase === 'interpreting' ? 'Interpreting...' : 'Fetching Data...'}
                    </div>
                  ) : null}

                  {!isLoading && SHOW_INSIGHTS_CAROUSEL ? (
                    <SurprisingFactsCarousel onExploreQuery={handleExploreFactQuery} disabled={isLoading} />
                  ) : null}

                  {!isLoading && (
                    <ChatResponsePanel
                      isVisible={showChatPanel}
                      isLoading={isLoading}
                      error={error}
                    />
                  )}

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

                  <VizRenderer
                    experience={viewMode}
                    data={vizData}
                    title={vizMeta.title}
                    config={vizMeta.config}
                  />



                </div>

                <div className="bank-explore-chat-footer">
                  <ChatFilterBox
                    ref={chatFilterRef}
                    value={displayValue}
                    onChange={handleChatInputChange}
                    onSubmit={handleChatSubmit}
                    isLoading={isLoading}
                    disabled={isLoading}
                    placeholder=""
                    highlightRanges={queryHighlightRanges}
                    onHighlightClear={clearQueryHighlight}
                    onFocus={handleChatFilterFocus}
                  />
                  <div className="bank-explore-footer-examples">
                    <button
                      type="button"
                      className="bank-explore-footer-examples-toggle"
                      onClick={() => setFooterExamplesOpen((open) => !open)}
                      aria-expanded={footerExamplesOpen}
                      aria-controls="bank-explore-footer-examples-panel"
                      id="bank-explore-footer-examples-label"
                    >
                      Try these examples
                    </button>
                    {footerExamplesOpen ? (
                      <div
                        className="bank-explore-footer-examples-panel"
                        id="bank-explore-footer-examples-panel"
                        role="region"
                        aria-labelledby="bank-explore-footer-examples-label"
                      >
                        <ul className="bank-explore-landing-example-list bank-explore-footer-examples-list">
                          {LANDING_EXAMPLE_QUERIES.map((q) => (
                            <li key={q}>
                              <button
                                type="button"
                                className="bank-explore-landing-example-tile"
                                onClick={() => handleFooterExamplePick(q)}
                                disabled={isLoading}
                              >
                                {q}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
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

