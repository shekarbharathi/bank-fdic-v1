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
import { normalizeBankRows, pickCaseInsensitive } from '../utils/bankDataNormalization';
import { inferVisibleColumns } from '../utils/visibleMetrics';
import { getAnalyticsQueryText, startViewTimer, trackEvent, trackInputEdit } from '../utils/analytics';
import { extractTopN, extractStateAbbr, extractRankingCriteria, extractRequestedMetrics } from '../utils/queryParsing';
import { isRefusalResponse } from '../utils/responseValidation';
import { stateNameByAbbr } from '../constants/states';
import { LANDING_EXAMPLE_QUERIES, TYPEWRITER_PHRASES, SUGGESTION_OPTIONS } from '../constants/uiContent';
import VizRenderer from './viz/VizRenderer';
import SurprisingFactsCarousel from './viz/SurprisingFactsCarousel';
import manualOpenBookIcon from '../assets/icons/open-book-166088.png';
import './BankExploreHome.css';

/** Set to true to show the Surprising Facts (Insights) carousel again. */
const SHOW_INSIGHTS_CAROUSEL = false;
const DOWNVOTE_REASONS = [
  { id: 'not_factually_correct', label: 'Not factually correct' },
  { id: 'did_not_understand_query', label: 'Did not understand my query' },
  { id: 'data_insufficient', label: 'Data is insufficient' },
  { id: 'other', label: 'Other' },
];

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
  const [vizContentReady, setVizContentReady] = useState(false);
  /** Collapsible Examples panel under the chatbox after the first send. */
  const [postSubmitExamplesOpen, setPostSubmitExamplesOpen] = useState(false);
  /** Collapsible Examples panel on first load (before first submit). */
  const [landingExamplesOpen, setLandingExamplesOpen] = useState(false);
  const [currentResponseMeta, setCurrentResponseMeta] = useState(null);
  const [feedbackByResponseId, setFeedbackByResponseId] = useState({});
  const [downvoteModalOpen, setDownvoteModalOpen] = useState(false);
  const [pendingDownvoteResponseId, setPendingDownvoteResponseId] = useState(null);
  const [selectedDownReason, setSelectedDownReason] = useState('');
  const [downReasonOtherText, setDownReasonOtherText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

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
    if (activeTopTab !== 'banks') return undefined;
    const endView = startViewTimer('banks_home', {
      tab_name: 'banks',
      has_results: hasSubmittedQuery ? 1 : 0,
    });
    return () => endView();
  }, [activeTopTab, hasSubmittedQuery]);

  useEffect(() => {
    if (!manualOpen) return;
    trackEvent('manual_opened', {
      component: 'manual_modal',
      action: 'open',
      group_count: fieldGroups.length,
    });
  }, [manualOpen, fieldGroups.length]);

  useEffect(() => {
    if (isLoading || !hasSubmittedQuery) return;
    const rowCount = Array.isArray(vizData) ? vizData.length : 0;
    const metricCount = Array.isArray(visibleMetricIds) ? visibleMetricIds.length : 0;
    trackEvent('results_rendered', {
      viz_mode: viewMode,
      row_count: rowCount,
      metric_count: metricCount,
      has_results: rowCount > 0 ? 1 : 0,
      status_phase: statusPhase || 'ready',
      error_state: error ? 'error' : 'ok',
    });
  }, [isLoading, hasSubmittedQuery, vizData, visibleMetricIds, viewMode, statusPhase, error]);

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
    setVizContentReady(true);
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
      const selectedMetricCount = Array.isArray(visibleMetricOverride)
        ? visibleMetricOverride.length
        : visibleMetricIds.length;
      trackEvent('query_submit', {
        input_id: 'bank-chat-filter-input',
        char_count: trimmed.length,
        token_estimate: Math.ceil(trimmed.split(/\s+/).filter(Boolean).length * 1.3),
        has_with_clause: /\swith\s/i.test(trimmed) ? 1 : 0,
        selected_metric_count: selectedMetricCount,
        query_text: getAnalyticsQueryText(trimmed),
      });
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
      setVizContentReady(false);
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
        const responseInstanceId = res?.response_instance_id || null;

        if (res?.error_code === 'out_of_scope' || res?.error === 'out_of_scope') {
          markApiFailure();
          setCurrentResponseMeta(null);
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        if (res?.error) {
          markApiFailure();
          setCurrentResponseMeta(null);
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        const data = res?.data;
        if (!Array.isArray(data)) {
          markApiFailure();
          setCurrentResponseMeta(null);
          dispatchView({ type: 'SHOW_SUGGESTIONS' });
          return;
        }

        if (isRefusalResponse(res?.response)) {
          markApiFailure();
          setCurrentResponseMeta(null);
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
            setCurrentResponseMeta(null);
            dispatchView({ type: 'SHOW_SUGGESTIONS' });
            return;
          }
          const val = Object.values(row0)[0];
          if (isRefusalResponse(val) || isRefusalResponse(res?.response)) {
            markApiFailure();
            setCurrentResponseMeta(null);
            dispatchView({ type: 'SHOW_SUGGESTIONS' });
            return;
          }
          setCurrentResponseMeta({
            responseInstanceId,
            query: trimmed,
            intent: res?.intent || null,
            vizType: mergedConfig?.type || experience,
          });
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
              trackEvent('column_picker_opened', {
                component: 'interactive_table',
                action: 'open',
                selected_metric_count: effectiveExtra.length,
              });
              setPickerSession((s) => s + 1);
              setColumnPickerOpen(true);
            },
            onExpandQuery: handleExpandClick,
          };
          setCurrentResponseMeta({
            responseInstanceId,
            query: trimmed,
            intent: res?.intent || null,
            vizType: tableConfig?.type || experience,
          });
          applySuccessfulVizDispatch(() => {
            dispatchView({ type: 'SHOW_VIZ', experience: 'table', data, vizMeta: { title, config: tableConfig } });
          });
          return;
        }

        setCurrentResponseMeta({
          responseInstanceId,
          query: trimmed,
          intent: res?.intent || null,
          vizType: mergedConfig?.type || experience,
        });
        applySuccessfulVizDispatch(() => {
          dispatchView({ type: 'SHOW_VIZ', experience, data, vizMeta: { title, config: mergedConfig } });
        });
      } catch {
        markApiFailure();
        setCurrentResponseMeta(null);
        dispatchView({ type: 'SHOW_SUGGESTIONS' });
      } finally {
        setIsLoading(false);
        shouldFocusAfterLoad.current = true;
      }
    },
    [updateConfirmationFromIntent, visibleMetricIds, fieldMetaByName, clearPhase800Timer]
  );
  handleChatSubmitRef.current = handleChatSubmit;

  const pickerSelectedFieldNames = useMemo(() => {
    if (viewMode !== 'table' || !Array.isArray(vizData) || vizData.length === 0) {
      return [...new Set(visibleMetricIds.map((id) => canonicalFieldName(id)).filter(Boolean))];
    }

    const tableConfig = vizMeta?.config ?? {};
    const defs = tableConfig.metricDefs ?? metricDefsMerged;
    const configMetrics = tableConfig.visibleMetrics ?? visibleMetricIds;
    const normalizedRows = normalizeBankRows(vizData, {
      extraFieldNames: configMetrics || [],
      fieldMetaByName: tableConfig.fieldMetaByName ?? fieldMetaByName,
    });

    return [...new Set(
      inferVisibleColumns(normalizedRows, configMetrics, defs)
        .map((id) => canonicalFieldName(id))
        .filter(Boolean)
    )];
  }, [viewMode, vizData, vizMeta, metricDefsMerged, visibleMetricIds, fieldMetaByName]);

  const clearQueryHighlight = useCallback(() => setQueryHighlightRanges(null), []);

  const handleChatFilterFocus = useCallback(
    (e) => {
      if (hasSubmittedQuery) return;
      if (chatInput && chatInput.length > 0) return;
      const ta = e.target;
      if (typewriterDisplay.length > 0 && ta && typeof ta.select === 'function') {
        requestAnimationFrame(() => ta.select());
      }
    },
    [hasSubmittedQuery, chatInput, typewriterDisplay.length]
  );

  const handleChatInteractStart = useCallback(() => {
    if (hasSubmittedQuery || userHasInteracted) return;
    // Stop typewriter immediately on explicit user pointer interaction.
    setUserHasInteracted(true);
    setTypewriterDisplay('');
  }, [hasSubmittedQuery, userHasInteracted]);

  const handleChatInputChange = useCallback((next) => {
    setQueryHighlightRanges(null);
    setChatInput(next);
    trackInputEdit({
      input_id: 'bank-chat-filter-input',
      char_count: String(next || '').length,
      token_estimate: String(next || '').trim()
        ? String(next || '').trim().split(/\s+/).filter(Boolean).length
        : 0,
      has_with_clause: /\swith\s/i.test(String(next || '')) ? 1 : 0,
    });
    if (next === '') {
      setUserHasInteracted(false);
      setTypewriterDisplay('');
    } else {
      setUserHasInteracted(true);
    }
  }, []);

  const handleColumnPickerApply = useCallback(
    ({ selectedFieldNames }) => {
      const canonFromModal = selectedFieldNames.map((id) => canonicalFieldName(id)).filter(Boolean);
      const prevCanon = visibleMetricIds.map((id) => canonicalFieldName(id)).filter(Boolean);
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
      trackEvent('column_picker_applied', {
        component: 'column_picker_modal',
        action: 'apply',
        selected_metric_count: mergedVisible.length,
      });
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
        trackEvent('ui_click', {
          component: 'interactive_table',
          element_id: 'expand_query',
          action: 'expand_query',
        });
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
  const activeResponseId = currentResponseMeta?.responseInstanceId || null;
  const activeFeedback = activeResponseId ? feedbackByResponseId[activeResponseId] : null;
  const canShowFeedback =
    Boolean(activeResponseId) &&
    hasSubmittedQuery &&
    !isLoading &&
    !error &&
    vizContentReady &&
    statusPhase === null &&
    viewMode !== 'suggestions' &&
    viewMode !== 'pending';

  const submitFeedback = useCallback(
    async ({ responseInstanceId, feedbackValue, downReason = null, downReasonOtherTextValue = null }) => {
      if (!responseInstanceId) return;
      try {
        setFeedbackSubmitting(true);
        await chatAPI.submitLlmFeedback({
          response_instance_id: responseInstanceId,
          feedback_value: feedbackValue,
          down_reason: downReason ?? undefined,
          down_reason_other_text: downReasonOtherTextValue ?? undefined,
        });
        setFeedbackByResponseId((prev) => ({
          ...prev,
          [responseInstanceId]: {
            feedbackValue,
            downReason,
            downReasonOtherText: downReasonOtherTextValue,
          },
        }));
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message || 'Failed to submit feedback');
      } finally {
        setFeedbackSubmitting(false);
      }
    },
    []
  );

  const handleThumbsUp = useCallback(() => {
    if (!activeResponseId || feedbackSubmitting || activeFeedback) return;
    submitFeedback({
      responseInstanceId: activeResponseId,
      feedbackValue: 'up',
    });
  }, [activeResponseId, feedbackSubmitting, activeFeedback, submitFeedback]);

  const handleThumbsDown = useCallback(() => {
    if (!activeResponseId || feedbackSubmitting || activeFeedback) return;
    setPendingDownvoteResponseId(activeResponseId);
    setSelectedDownReason('');
    setDownReasonOtherText('');
    setDownvoteModalOpen(true);
  }, [activeResponseId, feedbackSubmitting, activeFeedback]);

  const submitDownvote = useCallback(async () => {
    if (!pendingDownvoteResponseId || !selectedDownReason) return;
    if (selectedDownReason === 'other' && !downReasonOtherText.trim()) return;
    await submitFeedback({
      responseInstanceId: pendingDownvoteResponseId,
      feedbackValue: 'down',
      downReason: selectedDownReason,
      downReasonOtherTextValue: selectedDownReason === 'other' ? downReasonOtherText.trim() : null,
    });
    setDownvoteModalOpen(false);
    setPendingDownvoteResponseId(null);
    setSelectedDownReason('');
    setDownReasonOtherText('');
  }, [pendingDownvoteResponseId, selectedDownReason, downReasonOtherText, submitFeedback]);

  return (
    <div className="bank-explore-page">
      <header className="bank-explore-header">
        <div className="bank-explore-brand-row">
          <div className="bank-explore-title">BankStatz</div>
          <div className="bank-explore-subtitle"> - ChatGPT for FDIC data</div>
        </div>
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
                  onInteractStart={handleChatInteractStart}
                  typewriterSuggestion={!hasSubmittedQuery && isTypewriterMuted}
                />
                <div className="bank-explore-examples-below-chat">
                  <div className="bank-explore-footer-examples">
                    <div className="bank-explore-below-chat-actions">
                      <button
                        type="button"
                        className="bank-explore-footer-examples-toggle bank-explore-footer-manual-link"
                        onClick={() => {
                          trackEvent('ui_click', {
                            component: 'bank_explore_footer',
                            element_id: 'manual_link',
                            action: 'open_manual',
                          });
                          setManualOpen(true);
                        }}
                        aria-haspopup="dialog"
                      >
                        <img src={manualOpenBookIcon} alt="" className="bank-explore-manual-icon" aria-hidden="true" />
                        Manual
                      </button>
                      <button
                        type="button"
                        className="bank-explore-footer-examples-toggle"
                        onClick={() => {
                          const nextOpen = hasSubmittedQuery ? !postSubmitExamplesOpen : !landingExamplesOpen;
                          trackEvent('examples_toggled', {
                            component: 'bank_explore_footer',
                            action: nextOpen ? 'open' : 'close',
                            context: hasSubmittedQuery ? 'post_submit' : 'landing',
                          });
                          if (hasSubmittedQuery) setPostSubmitExamplesOpen(nextOpen);
                          else setLandingExamplesOpen(nextOpen);
                        }}
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
                  {canShowFeedback ? (
                    <div className="bank-explore-feedback-bar" role="group" aria-label="Response feedback">
                      <button
                        type="button"
                        className={`bank-explore-feedback-btn ${activeFeedback?.feedbackValue === 'up' ? 'is-selected' : ''}`}
                        onClick={handleThumbsUp}
                        disabled={Boolean(activeFeedback) || feedbackSubmitting}
                        aria-label="Thumbs up"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M14.5 10V5.5C14.5 4.12 13.38 3 12 3L8.6 10.2C8.22 11 8 11.88 8 12.78V19.5C8 20.88 9.12 22 10.5 22H17.29C18.23 22 19.05 21.36 19.27 20.45L20.82 13.95C20.94 13.46 21 12.96 21 12.45C21 11.09 19.91 10 18.55 10H14.5ZM3 22H6V10H3V22Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`bank-explore-feedback-btn ${activeFeedback?.feedbackValue === 'down' ? 'is-selected' : ''}`}
                        onClick={handleThumbsDown}
                        disabled={Boolean(activeFeedback) || feedbackSubmitting}
                        aria-label="Thumbs down"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M9.5 14V18.5C9.5 19.88 10.62 21 12 21L15.4 13.8C15.78 13 16 12.12 16 11.22V4.5C16 3.12 14.88 2 13.5 2H6.71C5.77 2 4.95 2.64 4.73 3.55L3.18 10.05C3.06 10.54 3 11.04 3 11.55C3 12.91 4.09 14 5.45 14H9.5ZM18 2H21V14H18V2Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      {activeFeedback ? (
                        <span className="bank-explore-feedback-saved">
                          Thank you for your feedback. We will use it to improve this product.
                        </span>
                      ) : null}
                    </div>
                  ) : null}
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
            onApply={handleColumnPickerApply}
          />
          <ManualModalPopup open={manualOpen} onClose={() => setManualOpen(false)} groups={fieldGroups} />
          {downvoteModalOpen ? (
            <div
              className="bank-explore-feedback-overlay"
              role="presentation"
              onMouseDown={(e) => e.target === e.currentTarget && setDownvoteModalOpen(false)}
            >
              <div className="bank-explore-feedback-modal" role="dialog" aria-modal="true" aria-label="Downvote reason">
                <h3 className="bank-explore-feedback-title">What went wrong?</h3>
                <div className="bank-explore-feedback-reason-list">
                  {DOWNVOTE_REASONS.map((reason) => (
                    <label key={reason.id} className="bank-explore-feedback-reason-row">
                      <input
                        type="radio"
                        name="downvote-reason"
                        checked={selectedDownReason === reason.id}
                        onChange={() => setSelectedDownReason(reason.id)}
                      />
                      <span>{reason.label}</span>
                    </label>
                  ))}
                </div>
                {selectedDownReason === 'other' ? (
                  <textarea
                    className="bank-explore-feedback-other-input"
                    value={downReasonOtherText}
                    onChange={(e) => setDownReasonOtherText(e.target.value)}
                    placeholder="Please share more details"
                    rows={3}
                  />
                ) : null}
                <div className="bank-explore-feedback-actions">
                  <button
                    type="button"
                    className="bank-explore-feedback-cancel"
                    onClick={() => setDownvoteModalOpen(false)}
                    disabled={feedbackSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bank-explore-feedback-submit"
                    onClick={submitDownvote}
                    disabled={
                      feedbackSubmitting ||
                      !selectedDownReason ||
                      (selectedDownReason === 'other' && !downReasonOtherText.trim())
                    }
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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

