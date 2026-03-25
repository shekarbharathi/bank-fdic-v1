import { useEffect, useMemo, useRef, useState } from 'react';
import { METRIC_DEFS_DEFAULT } from '../constants/metricDefsDefault';
import './BankExplorerTable.css';

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
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
  }
  return value === null || value === undefined ? 'N/A' : String(value);
};

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="add-column-btn-svg">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const BankExplorerTable = ({
  rows,
  sortState,
  visibleMetricIds,
  metricDefs,
  onSortChange,
  onOpenDetail,
  onRequestBranches,
  onOpenColumnPicker,
  columnPickerDisabled,
}) => {
  const defs = metricDefs || METRIC_DEFS_DEFAULT;
  const [columnWidths, setColumnWidths] = useState({});

  const [contextMenu, setContextMenu] = useState(null); // {x,y,row}
  const contextMenuRef = useRef(null);

  const [compareBanks, setCompareBanks] = useState([]); // normalized rows

  const containerRef = useRef(null);

  const visibleColumns = useMemo(() => {
    const cols = ['assets'];
    // visibleMetricIds are additional columns besides assets.
    for (const id of visibleMetricIds) {
      if (id !== 'assets') cols.push(id);
    }
    // Only keep columns we know about.
    return cols.filter((k) => Boolean(defs[k]));
  }, [visibleMetricIds, defs]);

  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e) => {
      const el = contextMenuRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setContextMenu(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [contextMenu]);

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    const dir = sortState?.direction || 'desc';
    const key = sortState?.key || 'assets';

    const rowsCopy = [...rows];
    rowsCopy.sort((a, b) => {
      if (key === 'rank') return a.__rank - b.__rank;
      const av = a[key];
      const bv = b[key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av);
      const bn = Number(bv);
      const diff = an - bn;
      return dir === 'asc' ? diff : -diff;
    });

    // Recompute rank after sort.
    return rowsCopy.map((r, idx) => ({ ...r, __rank: idx + 1 }));
  }, [rows, sortState]);

  const handleHeaderSort = (key, kind) => {
    // kind is only used for initial default direction.
    const currentKey = sortState?.key;
    const currentDir = sortState?.direction || 'desc';
    const isSameKey = currentKey === key;
    const nextDir = isSameKey ? (currentDir === 'desc' ? 'asc' : 'desc') : kind === 'string' ? 'asc' : 'desc';
    onSortChange?.({ key, direction: nextDir });
  };

  const startResize = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = columnWidths[colKey] ?? 140;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const next = Math.max(85, Math.min(520, startW + dx));
      setColumnWidths((prev) => ({ ...prev, [colKey]: next }));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="be-wrap" ref={containerRef}>
      <div className="be-table-header-row">
      <div className="be-table-shell" role="region" aria-label="Interactive bank exploration table">
        <table className="be-table">
          <thead>
            <tr>
              <th
                className="be-th be-th-rank"
                style={{ width: columnWidths.rank ?? 72 }}
              >
                <div className="be-rank-static" role="presentation">
                  <span className="be-rank-header-title">Rank</span>
                </div>

              </th>
              <th
                className="be-th be-th-name"
                style={{ width: columnWidths.bank_name ?? 260 }}
              >
                <button
                  type="button"
                  className="be-header-clickable"
                  onClick={() => handleHeaderSort('bank_name', 'string')}
                  aria-label="Sort by bank name"
                >
                  Bank Name
                </button>
                <div className="be-resizer" onMouseDown={(e) => startResize(e, 'bank_name')} aria-hidden="true" />
              </th>
              <th
                className="be-th be-th-assets"
                style={{ width: columnWidths.assets ?? 170 }}
              >
                <button
                  type="button"
                  className="be-header-clickable"
                  onClick={() => handleHeaderSort('assets', 'number')}
                  aria-label="Sort by assets"
                >
                  Assets
                </button>
                {/* Assets info tooltip intentionally removed per UX request */}
                <div className="be-resizer" onMouseDown={(e) => startResize(e, 'assets')} aria-hidden="true" />
              </th>

              {visibleColumns
                .filter((k) => k !== 'assets')
                .map((metricKey) => (
                  <th
                    key={metricKey}
                    className="be-th be-th-metric"
                    style={{ width: columnWidths[metricKey] ?? 155 }}
                  >
                    <button
                      type="button"
                      className="be-header-clickable"
                      onClick={() =>
                        handleHeaderSort(
                          metricKey,
                          defs[metricKey]?.kind === 'date' ? 'string' : 'number'
                        )
                      }
                      aria-label={`Sort by ${defs[metricKey]?.label || metricKey}`}
                    >
                      {defs[metricKey]?.label || metricKey}
                    </button>
                    <span className="be-sort-hint">{sortState?.key === metricKey ? (sortState.direction === 'asc' ? '⬆' : '⬇') : ''}</span>
                    <div
                      className="be-resizer"
                      onMouseDown={(e) => startResize(e, metricKey)}
                      aria-hidden="true"
                    />
                  </th>
                ))}

            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.cert ?? row.bank_name}
                className="be-row"
                onDoubleClick={() => {
                  setCompareBanks((prev) => {
                    if (!prev.find((b) => b.cert === row.cert)) {
                      if (prev.length === 2) return [prev[1], row];
                      return [...prev, row];
                    }
                    return prev;
                  });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, row });
                }}
              >
                <td data-label="Rank" className="be-td">
                  <button
                    type="button"
                    className="be-cell-button"
                    onClick={() => onOpenDetail?.(row)}
                    aria-label={`Open details for rank ${row.__rank}`}
                  >
                    {row.__rank}
                  </button>
                </td>
                <td data-label="Bank Name" className="be-td">
                  <button
                    type="button"
                    className="be-cell-button be-cell-bank"
                    onClick={() => onOpenDetail?.(row)}
                    aria-label={`Open details for ${row.bank_name}`}
                  >
                    {row.bank_name}
                  </button>
                </td>

                <td data-label="Assets" className="be-td be-td-metric">
                  <button
                    type="button"
                    className="be-cell-button be-cell-metric"
                    onClick={() => onOpenDetail?.(row)}
                    title={`Assets: ${formatMetricValue('assets', row.assets, defs)}`}
                    aria-label={`Assets for ${row.bank_name}`}
                  >
                    <span className="be-cell-metric-value">{formatMetricValue('assets', row.assets, defs)}</span>
                  </button>
                </td>

                {visibleColumns
                  .filter((k) => k !== 'assets')
                  .map((metricKey) => (
                    <td
                      key={`${row.cert}-${metricKey}`}
                      data-label={defs[metricKey]?.label || metricKey}
                      className="be-td"
                    >
                      <button
                        type="button"
                        className="be-cell-button"
                        onClick={() => onOpenDetail?.(row)}
                        title={`${defs[metricKey]?.label || metricKey}: ${formatMetricValue(metricKey, row[metricKey], defs)}`}
                        aria-label={`${defs[metricKey]?.label || metricKey} for ${row.bank_name}`}
                      >
                        {formatMetricValue(metricKey, row[metricKey], defs)}
                      </button>
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>

        {contextMenu && (
          <div
            className="be-context-menu"
            ref={contextMenuRef}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
            aria-label="Row context menu"
          >
            <button
              type="button"
              className="be-context-item"
              onClick={() => {
                setCompareBanks((prev) => {
                  if (prev.find((b) => b.cert === contextMenu.row.cert)) return prev;
                  if (prev.length === 2) return [prev[1], contextMenu.row];
                  return [...prev, contextMenu.row];
                });
                setContextMenu(null);
              }}
              role="menuitem"
            >
              Compare
            </button>
            <button
              type="button"
              className="be-context-item"
              onClick={() => {
                onRequestBranches?.(contextMenu.row);
                setContextMenu(null);
              }}
              role="menuitem"
            >
              View Branches
            </button>
            <div className="be-context-divider" />
            <button
              type="button"
              className="be-context-item"
              onClick={() => {
                onOpenDetail?.(contextMenu.row);
                setContextMenu(null);
              }}
              role="menuitem"
            >
              Open Details
            </button>
          </div>
        )}
      </div>

      {onOpenColumnPicker && (
        <button
          type="button"
          className="add-column-btn"
          onClick={onOpenColumnPicker}
          disabled={columnPickerDisabled}
          aria-haspopup="dialog"
          aria-label="Add columns"
        >
          <span className="add-column-btn-icon" aria-hidden="true">
            <PlusIcon />
          </span>
        </button>
      )}
      </div>

      {compareBanks.length > 0 && (
        <div className="be-compare-overlay" role="dialog" aria-label="Quick compare">
          <div className="be-compare-header">
            <div>
              Quick Compare
              <span className="be-compare-sub">
                Double-click rows or use right-click → Compare
              </span>
            </div>
            <button
              type="button"
              className="be-compare-close"
              onClick={() => setCompareBanks([])}
              aria-label="Close compare"
            >
              ✕
            </button>
          </div>
          <div className="be-compare-grid">
            {compareBanks.map((b) => (
              <div key={b.cert} className="be-compare-card">
                <div className="be-compare-name">{b.bank_name}</div>
                <div className="be-compare-meta">
                  {b.city}, {b.stalp}
                </div>
                <div className="be-compare-metrics">
                  {['assets', 'roa', 'capital_ratio', 'deposits', 'netinc'].map((k) => (
                    <div key={k} className="be-compare-metric">
                      <span className="be-compare-metric-label">{defs[k]?.label || k}</span>
                      <span className="be-compare-metric-value">
                        {formatMetricValue(k, b[k], defs)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BankExplorerTable;

