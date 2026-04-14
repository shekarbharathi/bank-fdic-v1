import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { chatAPI, sendClientDebugLog } from '../api/client';
import ChatFilterBox from './ChatFilterBox';
import ChatResponsePanel from './ChatResponsePanel';
import { METRIC_DEFS_DEFAULT } from '../constants/metricDefsDefault';
import ColumnPickerModal from './ColumnPickerModal';
import ManualModalPopup from './ManualModalPopup';
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

/** Minimum time to show “Interpreting…” before “Fetching data…” (if API still pending). */
const INTERPRETING_MS = 800;

/** Merge API `entities` (e.g. state) into viz config so components like StateOverviewViz can resolve geography when rows omit stalp. */
function mergeVizEntities(config, entities) {
  if (!entities || typeof entities !== 'object') return config;
  return { ...config, ...entities };
}

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
  const [manualOpen, setManualOpen] = useState(false);
  const [pickerSession, setPickerSession] = useState(0);

  const fieldMetaByName = useMemo(() => buildFieldMetaMap(fieldGroups), [fieldGroups]);
  const metricDefsMerged = useMemo(() => mergeMetricDefs(METRIC_DEFS_DEFAULT, fieldGroups), [fieldGroups]);

  const [, setConfirmation] = useState('');

  const [detailBank, setDetailBank] = useState(null);
  const [branchRows, setBranchRows] = useState([]);
  const [branchLoading, setBranchLoading] = useState(false);

  /** null | 'interpreting' | 'fetching' | 'loading_viz' */
  const [statusPhase, setStatusPhase] = useState(null);
  /** Bumped on each successful viz dispatch so VizRenderer remounts and onVizReady runs again. */
  const [vizRenderGeneration, setVizRenderGeneration] = useState(0);
  /** Collapsible Examples panel under the chatbox after the first send. */
  const [postSubmitExamplesOpen, setPostSubmitExamplesOpen] = useState(false);
  /** Collapsible Examples panel on first load (before first submit). */
  const [landingExamplesOpen, setLandingExamplesOpen] = useState(false);

  const requestStartTimeRef = useRef(0);
  const apiResolvedRef = useRef(false);
  const pendingLoadingVizRef = useRef(false);
  const vizReadyPendingRef = useRef(false);
  const phase800TimerRef = useRef(null);

  const hasSubmittedQueryRef = useRef(hasSubmittedQuery);
  const userHasInteractedRef = useRef(userHasInteracted);
  const chatInputRef = useRef(chatInput);
  const lastSubmittedQueryRef = useRef('');
  const handleChatSubmitRef = useRef(null);
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

  const handleVizRenderComplete = useCallback(() => {
    setStatusPhase((prev) => {
      if (prev === 'loading_viz') return null;
      vizReadyPendingRef.current = true;
      return prev;
    });
  }, []);

  useEffect(() => {
    if (statusPhase !== 'loading_viz') return;
    if (vizReadyPendingRef.current) {
      vizReadyPendingRef.current = false;
      setStatusPhase(null);
    }
  }, [statusPhase]);

  const clearPhase800Timer = useCallback(() => {
    if (phase800TimerRef.current != null) {
      clearTimeout(phase800TimerRef.current);
      phase800TimerRef.current = null;
    }
  }, []);

  const handleChatSubmit = useCallback(
    async (text, submitOptions = {}) => {
      const raw = String(text ?? '');
      const trimmed = raw.trim();
      if (!trimmed) return;

      const { visibleMetricOverride } = submitOptions;
      lastSubmittedQueryRef.current = trimmed;
      setHasSubmittedQuery(true);
      setChatInput(raw);
      setTypewriterDisplay('');
      setUserHasInteracted(true);

      const nextLimit = extractTopN(trimmed);
      const nextRegionAbbr = extractStateAbbr(trimmed);
      const inferredRanking = extractRankingCriteria(trimmed);
      const requestedMetrics = extractRequestedMetrics(trimmed);
      setError(null);
      setPostSubmitExamplesOpen(false);
      setLandingExamplesOpen(false);
      setStatusPhase('interpreting');
      setIsLoading(true);
      setDetailBank(null);
      setBranchRows([]);
      setBranchLoading(false);
      dispatchView({ type: 'RESET' });

      requestStartTimeRef.current = Date.now();
      apiResolvedRef.current = false;
      pendingLoadingVizRef.current = false;
      vizReadyPendingRef.current = false;
      clearPhase800Timer();
      phase800TimerRef.current = window.setTimeout(() => {
        phase800TimerRef.current = null;
        if (!apiResolvedRef.current) {
          setStatusPhase('fetching');
        } else if (pendingLoadingVizRef.current) {
          setStatusPhase('loading_viz');
        }
      }, INTERPRETING_MS);

      const markApiFailure = () => {
        apiResolvedRef.current = true;
        pendingLoadingVizRef.current = false;
        clearPhase800Timer();
        setStatusPhase(null);
      };

      const applySuccessfulVizDispatch = (dispatchFn) => {
        apiResolvedRef.current = true;
        pendingLoadingVizRef.current = true;
        const elapsed = Date.now() - requestStartTimeRef.current;
        setVizRenderGeneration((g) => g + 1);
        if (elapsed >= INTERPRETING_MS) {
          setStatusPhase('loading_viz');
        }
        dispatchFn();
      };

      try {
        const res = await chatAPI.sendMessage(trimmed);

        if (res?.error_code === 'out_of_scope' || res?.error === 'out_of_scope') {
          markApiFailure();
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        if (res?.error) {
          markApiFailure();
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        const data = res?.data;
        if (!Array.isArray(data)) {
          markApiFailure();
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        if (isRefusalResponse(res?.response)) {
          markApiFailure();
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        const { experience, title, config } = resolveExperience(res.intent, res.visualization, data);
        const mergedConfig = mergeVizEntities(config, res.entities);

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
            markApiFailure();
            dispatchView({ type: 'SHOW_SUGGESTIONS' });
            return;
          }
          const val = Object.values(row0)[0];
          if (isRefusalResponse(val) || isRefusalResponse(res?.response)) {
            markApiFailure();
            dispatchView({ type: 'SHOW_SUGGESTIONS' });
            return;
          }
          applySuccessfulVizDispatch(() => {
            dispatchView({ type: 'SHOW_SCALAR', value: val, vizMeta: { title, config: mergedConfig } });
          });
          return;
        }

        if (experience === 'table') {
          const nextVisible = new Set((visibleMetricOverride ?? visibleMetricIds).map(canonicalFieldName));
          for (const m of requestedMetrics) nextVisible.add(canonicalFieldName(m));
          /** Do not inject rank columns when the user explicitly chose visible columns in the modal. */
          if (!visibleMetricOverride) {
            if (inferredRanking === 'profitability') nextVisible.add('roa');
            if (inferredRanking === 'safety') nextVisible.add('capital_ratio');
          }
          const effectiveExtra = Array.from(nextVisible);

          setVisibleMetricIds(effectiveExtra);

          updateConfirmationFromIntent({
            inferredRanking,
            inferredRegionAbbr: nextRegionAbbr,
            inferredLimit: nextLimit,
            requestedMetrics,
          });

          const tableConfig = {
            ...mergedConfig,
            visibleMetrics: effectiveExtra,
            ranking: inferredRanking,
            sortKey: inferredRanking === 'size' ? 'assets' : inferredRanking === 'profitability' ? 'roa' : 'capital_ratio',
            sortDirection: 'desc',
            metricDefs: metricDefsMerged,
            fieldMetaByName,
            onOpenColumnPicker: () => {
              setPickerSession((s) => s + 1);
              setColumnPickerOpen(true);
            },
            onExpandQuery: handleExpandClick,
          };
          applySuccessfulVizDispatch(() => {
            dispatchView({ type: 'SHOW_VIZ', experience: 'table', data, vizMeta: { title, config: tableConfig } });
          });
          return;
        }

        applySuccessfulVizDispatch(() => {
          dispatchView({ type: 'SHOW_VIZ', experience, data, vizMeta: { title, config: mergedConfig } });
        });
      } catch {
        markApiFailure();
        dispatchView({ type: 'SHOW_SUGGESTIONS' });
      } finally {
        setIsLoading(false);
        shouldFocusAfterLoad.current = true;
      }
    },
    [updateConfirmationFromIntent, visibleMetricIds, fieldMetaByName, clearPhase800Timer]
  );
  handleChatSubmitRef.current = handleChatSubmit;

  const pickerSelectedFieldNames = useMemo(
    () => visibleMetricIds.map((id) => canonicalFieldName(id)),
    [visibleMetricIds]
  );

  const clearQueryHighlight = useCallback(() => setQueryHighlightRanges(null), []);

  const handleChatFilterFocus = useCallback(
    (e) => {
      if (hasSubmittedQuery) return;
      // Stop typewriter immediately on first user interaction (tap/click focus).
      if (!userHasInteracted) {
        setUserHasInteracted(true);
        setTypewriterDisplay('');
      }
      if (chatInput && chatInput.length > 0) return;
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

  const handleExpandClick = useCallback(
    async () => {
      const queryText = lastSubmittedQueryRef.current;
      if (!queryText) return;
      setError(null);
      try {
        const expanded = await chatAPI.expandQuery(queryText);
        setUserHasInteracted(true);
        setChatInput(expanded);
        const expRanges = computeDiffHighlightRanges(queryText, expanded);
        setQueryHighlightRanges(expRanges.length ? expRanges : null);
        await handleChatSubmitRef.current(expanded);
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message || 'Failed to expand');
        dispatchView({ type: 'SHOW_SUGGESTIONS' });
      }
    },
    []
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
            <div
              className={`bank-explore-banks-root ${
                hasSubmittedQuery ? 'bank-explore-banks-root--has-query' : 'bank-explore-banks-root--landing'
              }`}
            >
              <div
                className={`bank-explore-landing-stack${
                  hasSubmittedQuery ? ' bank-explore-landing-stack--post-submit' : ''
                }`}
              >
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
                  typewriterSuggestion={!hasSubmittedQuery && isTypewriterMuted}
                />
                <div className="bank-explore-examples-below-chat">
                  <div className="bank-explore-footer-examples">
                    <div className="bank-explore-below-chat-actions">
                      <button
                        type="button"
                        className="bank-explore-footer-examples-toggle bank-explore-footer-manual-link"
                        onClick={() => setManualOpen(true)}
                        aria-haspopup="dialog"
                      >
                        <svg
                          className="bank-explore-manual-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M12 6.25C10.6 5.2 8.2 4.5 5.25 4.5C4.56 4.5 4 5.06 4 5.75V17.5C4 18.19 4.56 18.75 5.25 18.75C8.2 18.75 10.6 19.45 12 20.5M12 6.25C13.4 5.2 15.8 4.5 18.75 4.5C19.44 4.5 20 5.06 20 5.75V17.5C20 18.19 19.44 18.75 18.75 18.75C15.8 18.75 13.4 19.45 12 20.5M12 6.25V20.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Manual
                      </button>
                      <button
                        type="button"
                        className="bank-explore-footer-examples-toggle"
                        onClick={() =>
                          hasSubmittedQuery
                            ? setPostSubmitExamplesOpen((open) => !open)
                            : setLandingExamplesOpen((open) => !open)
                        }
                        aria-expanded={hasSubmittedQuery ? postSubmitExamplesOpen : landingExamplesOpen}
                        aria-controls={hasSubmittedQuery ? 'bank-explore-post-submit-examples-panel' : 'bank-explore-landing-examples-panel'}
                        id={hasSubmittedQuery ? 'bank-explore-examples-link-label' : 'bank-explore-landing-examples-link-label'}
                      >
                        <span>Examples</span>
                        <span className="bank-explore-footer-examples-chevron" aria-hidden="true">
                          {hasSubmittedQuery ? (postSubmitExamplesOpen ? 'v' : '>') : landingExamplesOpen ? 'v' : '>'}
                        </span>
                      </button>
                    </div>
                    {!hasSubmittedQuery ? (
                      <div
                        className={`bank-explore-footer-examples-panel ${
                          landingExamplesOpen ? 'is-open' : 'is-closed'
                        }`}
                        id="bank-explore-landing-examples-panel"
                        role="region"
                        aria-labelledby="bank-explore-landing-examples-link-label"
                        aria-hidden={!landingExamplesOpen}
                      >
                        <ul className="bank-explore-landing-example-list bank-explore-footer-examples-list">
                          {LANDING_EXAMPLE_QUERIES.map((q) => (
                            <li key={q}>
                              <button
                                type="button"
                                className="bank-explore-landing-example-tile"
                                onClick={() => {
                                  setLandingExamplesOpen(false);
                                  handleSuggestionClick(q);
                                }}
                              >
                                {q}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {hasSubmittedQuery ? (
                      <div
                        className={`bank-explore-footer-examples-panel ${
                          postSubmitExamplesOpen ? 'is-open' : 'is-closed'
                        }`}
                        id="bank-explore-post-submit-examples-panel"
                        role="region"
                        aria-labelledby="bank-explore-examples-link-label"
                        aria-hidden={!postSubmitExamplesOpen}
                      >
                        <ul className="bank-explore-landing-example-list bank-explore-footer-examples-list">
                          {LANDING_EXAMPLE_QUERIES.map((q) => (
                            <li key={q}>
                              <button
                                type="button"
                                className="bank-explore-landing-example-tile"
                                onClick={() => {
                                  setPostSubmitExamplesOpen(false);
                                  handleSuggestionClick(q);
                                }}
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
            </div>

            {hasSubmittedQuery ? (
              <div className="bank-explore-results-column">
                <div className="bank-explore-results-main">
                  {statusPhase ? (
                    <div className="bank-explore-results-status" aria-live="polite">
                      <span>
                        {statusPhase === 'interpreting'
                          ? 'Interpreting...'
                          : statusPhase === 'fetching'
                            ? 'Fetching data...'
                            : 'Loading visualization...'}
                      </span>
                      <span className="bank-explore-status-spinner" aria-hidden="true">
                        <span className="bank-explore-status-spinner-icon" />
                      </span>
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
                    key={vizRenderGeneration}
                    experience={viewMode}
                    data={vizData}
                    title={vizMeta.title}
                    config={vizMeta.config}
                    onVizReady={handleVizRenderComplete}
                  />
                </div>
              </div>
            ) : null}
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
          <ManualModalPopup open={manualOpen} onClose={() => setManualOpen(false)} groups={fieldGroups} />

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

