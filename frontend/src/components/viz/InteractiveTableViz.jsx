import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { METRIC_DEFS_DEFAULT } from '../../constants/metricDefsDefault';
import { normalizeBankRows } from '../../utils/bankDataNormalization';
import { inferVisibleColumns, resolveMetricDefKey } from '../../utils/visibleMetrics';
import { trackEvent } from '../../utils/analytics';
import './InteractiveTableViz.css';
import './VizPlaceholder.css';

const formatCompact = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return 'N/A';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};

const formatPercent = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return 'N/A';
  return `${Number(num).toFixed(2)}%`;
};

const formatMetricValue = (metricKey, value, defs) => {
  const def = defs[metricKey];
  if (!def) return value === null || value === undefined ? 'N/A' : String(value);
  if (def.kind === 'dollar') return formatCompact(Number(value));
  if (def.kind === 'percent') return formatPercent(Number(value));
  if (def.kind === 'date') {
    if (value === null || value === undefined) return 'N/A';
    return String(value);
  }
  return value === null || value === undefined ? 'N/A' : String(value);
};

const METADATA_KEY_BY_METRIC_KEY = {
  assets: 'asset',
  deposits: 'dep',
};

const resolveMetricLabel = (metricKey, defs, fieldMetaByName) => {
  if (metricKey === 'bank_name') return 'Bank Name';
  if (metricKey === 'rank' || metricKey === '__rank') return 'Rank';
  const defKey = resolveMetricDefKey(metricKey, defs);
  const metadataKey = METADATA_KEY_BY_METRIC_KEY[defKey] || metricKey;
  return (
    fieldMetaByName?.get(metadataKey)?.display_name ||
    fieldMetaByName?.get(defKey)?.display_name ||
    defs[defKey]?.label ||
    defs[metricKey]?.label ||
    metricKey
  );
};

const isNumericLikeValue = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return Number.isFinite(Number(value.trim()));
  return false;
};

const inferColumnSortKind = (rowKey, defKind, rows) => {
  if (defKind === 'date') return 'string';
  if (defKind === 'dollar' || defKind === 'percent' || defKind === 'number') return 'number';
  const samples = [];
  for (const row of rows || []) {
    const v = row?.[rowKey];
    if (v === null || v === undefined || v === '') continue;
    samples.push(v);
    if (samples.length >= 10) break;
  }
  if (samples.length === 0) return 'string';
  return samples.every((v) => isNumericLikeValue(v)) ? 'number' : 'string';
};

function inferSortKey(config, defs) {
  if (config?.sortKey) {
    const def = defs?.[config.sortKey];
    const kind = def?.kind === 'date' ? 'string' : 'number';
    return { key: config.sortKey, direction: config.sortDirection || 'desc', kind };
  }
  if (config?.ranking === 'profitability') return { key: 'roa', direction: 'desc', kind: 'number' };
  if (config?.ranking === 'safety') return { key: 'capital_ratio', direction: 'desc', kind: 'number' };
  return { key: 'assets', direction: 'desc', kind: 'number' };
}

export default function InteractiveTableViz({ data, title, config }) {
  const rawRows = Array.isArray(data) ? data : [];
  const defs = config?.metricDefs ?? METRIC_DEFS_DEFAULT;
  const fieldMetaByName = config?.fieldMetaByName;

  const normalizedRows = useMemo(
    () => normalizeBankRows(rawRows, {
      extraFieldNames: config?.visibleMetrics || [],
      fieldMetaByName: config?.fieldMetaByName ?? new Map(),
    }),
    [rawRows, config?.visibleMetrics, config?.fieldMetaByName]
  );

  const [sortState, setSortState] = useState(() => inferSortKey(config, defs));
  const [columnWidths, setColumnWidths] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const contextMenuRef = useRef(null);
  const theadRef = useRef(null);
  const [headerRowPx, setHeaderRowPx] = useState(null);

  const visibleColumnSpecs = useMemo(
    () =>
      inferVisibleColumns(normalizedRows, config?.visibleMetrics, defs)
        .map((metricKey) => {
          const defKey = resolveMetricDefKey(metricKey, defs);
          if (!defs[defKey]) return null;
          const sortKind = inferColumnSortKind(defKey, defs[defKey]?.kind, normalizedRows);
          return { metricKey, defKey, rowKey: defKey, sortKind };
        })
        .filter(Boolean),
    [normalizedRows, config?.visibleMetrics, defs]
  );

  const sortedRows = useMemo(() => {
    if (!normalizedRows.length) return [];
    const dir = sortState.direction;
    const key = sortState.key;
    const kind = sortState.kind || 'number';
    const copy = [...normalizedRows];
    copy.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (kind === 'string') {
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const diff = Number(av) - Number(bv);
      return dir === 'asc' ? diff : -diff;
    });
    return copy.map((r, idx) => ({ ...r, __rank: idx + 1 }));
  }, [normalizedRows, sortState]);

  const handleHeaderSort = useCallback((key, kind) => {
    setSortState((prev) => {
      const isSame = prev.key === key;
      const nextDir = isSame ? (prev.direction === 'desc' ? 'asc' : 'desc') : kind === 'string' ? 'asc' : 'desc';
      trackEvent('table_sort_changed', {
        component: 'interactive_table',
        action: 'sort',
        sort_key: key,
        sort_kind: kind,
        sort_direction: nextDir,
      });
      return { key, direction: nextDir, kind };
    });
  }, []);

  const startResize = useCallback((e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = 140;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      setColumnWidths((prev) => ({ ...prev, [colKey]: Math.max(85, Math.min(520, (prev[colKey] ?? startW) + dx)) }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  useLayoutEffect(() => {
    const thead = theadRef.current;
    if (!thead) { setHeaderRowPx(null); return; }
    const measure = () => {
      const h = thead.getBoundingClientRect().height;
      if (h > 0) setHeaderRowPx(Math.round(h * 100) / 100);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(thead);
    return () => ro.disconnect();
  }, []);

  // Close context menu on outside click
  const handleContextClose = useCallback((e) => {
    if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
      setContextMenu(null);
    }
  }, []);

  useMemo(() => {
    if (contextMenu) {
      window.addEventListener('mousedown', handleContextClose);
      return () => window.removeEventListener('mousedown', handleContextClose);
    }
  }, [contextMenu, handleContextClose]);

  if (sortedRows.length === 0) {
    return (
      <div className="viz-placeholder" role="region" aria-label={title || 'Table'}>
        <p className="viz-placeholder-hint">No data to display.</p>
      </div>
    );
  }

  const onOpenColumnPicker = config?.onOpenColumnPicker;
  const onExpandQuery = config?.onExpandQuery;

  return (
    <div className="viz-placeholder viz-interactive-table" role="region" aria-label={title || 'Interactive table'}>
      {onOpenColumnPicker ? (
        <div className="ivt-toolbar">
          <button
            type="button"
            className="ivt-add-col-btn"
            onClick={onOpenColumnPicker}
            aria-label="Add columns"
            title="Add columns"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}

      {selectedRow ? (
        <div className="ivt-detail-bar">
          <div className="ivt-detail-info">
            <strong>{selectedRow.bank_name}</strong>
            {selectedRow.city || selectedRow.stalp ? (
              <span className="ivt-detail-loc">
                {[selectedRow.city, selectedRow.stalp].filter(Boolean).join(', ')}
              </span>
            ) : null}
          </div>
          <div className="ivt-detail-metrics">
            {['assets', 'roa', 'capital_ratio', 'deposits'].map((k) => {
              if (selectedRow[k] === null || selectedRow[k] === undefined) return null;
              return (
                <span key={k} className="ivt-detail-chip">
                  <span className="ivt-detail-chip-label">{defs[k]?.label || k}</span>
                  <span className="ivt-detail-chip-value">{formatMetricValue(k, selectedRow[k], defs)}</span>
                </span>
              );
            })}
          </div>
          <button type="button" className="ivt-detail-close" onClick={() => setSelectedRow(null)} aria-label="Close detail">
            &times;
          </button>
        </div>
      ) : null}

      <div className="ivt-table-shell" role="region" aria-label="Bank data table">
        <table className="ivt-table">
          <thead ref={theadRef}>
            <tr>
              <th className="ivt-th ivt-th-rank" style={{ width: columnWidths.rank ?? 64 }}>
                <span className="ivt-rank-label">Rank</span>
              </th>
              <th className="ivt-th ivt-th-name" style={{ width: columnWidths.bank_name ?? 260 }}>
                <button type="button" className="ivt-header-btn" onClick={() => handleHeaderSort('bank_name', 'string')}>
                  Bank Name
                  {sortState.key === 'bank_name' ? <span className="ivt-sort-arrow">{sortState.direction === 'asc' ? '▲' : '▼'}</span> : null}
                </button>
                <div className="ivt-resizer" onMouseDown={(e) => startResize(e, 'bank_name')} aria-hidden="true" />
              </th>
              {visibleColumnSpecs.map(({ metricKey, defKey, rowKey, sortKind }) => (
                <th key={metricKey} className="ivt-th ivt-th-metric" style={{ width: columnWidths[metricKey] ?? 150 }}>
                  <button
                    type="button"
                    className="ivt-header-btn"
                    onClick={() => handleHeaderSort(rowKey, sortKind)}
                  >
                    {resolveMetricLabel(metricKey, defs, fieldMetaByName)}
                    {sortState.key === rowKey ? <span className="ivt-sort-arrow">{sortState.direction === 'asc' ? '▲' : '▼'}</span> : null}
                  </button>
                  <div className="ivt-resizer" onMouseDown={(e) => startResize(e, metricKey)} aria-hidden="true" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.cert ?? row.bank_name ?? row.__rank}
                className={`ivt-row ${selectedRow?.cert === row.cert ? 'ivt-row--selected' : ''}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  trackEvent('ui_click', {
                    component: 'interactive_table',
                    element_id: 'row_context_menu',
                    action: 'open_context_menu',
                    context: 'row',
                  });
                  setContextMenu({ x: e.clientX, y: e.clientY, row });
                }}
              >
                <td className="ivt-td ivt-td-rank">{row.__rank}</td>
                <td className="ivt-td ivt-td-name">{row.bank_name}</td>
                {visibleColumnSpecs.map(({ metricKey, defKey, rowKey }) => (
                  <td key={metricKey} className="ivt-td ivt-td-metric">
                    {formatMetricValue(defKey, row[rowKey], defs)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {contextMenu ? (
          <div
            className="ivt-context-menu"
            ref={contextMenuRef}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
          >
            <button
              type="button"
              className="ivt-context-item"
              onClick={() => {
                trackEvent('ui_click', {
                  component: 'interactive_table',
                  element_id: 'view_details',
                  action: 'open_detail_bar',
                  context: 'context_menu',
                });
                setSelectedRow(contextMenu.row);
                setContextMenu(null);
              }}
              role="menuitem"
            >
              View Details
            </button>
          </div>
        ) : null}
      </div>

      <div className="ivt-footer">
        <span className="ivt-row-count">{sortedRows.length} rows</span>
        <span className="ivt-sort-info">
          Sorted by {resolveMetricLabel(sortState.key, defs, fieldMetaByName)} ({sortState.direction === 'asc' ? 'low → high' : 'high → low'})
        </span>
      </div>

      {onExpandQuery ? (
        <button
          type="button"
          className="ivt-expand-chevron"
          onClick={onExpandQuery}
          aria-label="Show 5 more results"
          title="Show 5 more results"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
