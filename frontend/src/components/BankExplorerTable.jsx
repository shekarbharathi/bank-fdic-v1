import { useEffect, useMemo, useRef, useState } from 'react';
import './BankExplorerTable.css';

const METRIC_DEFS = {
  assets: {
    id: 'assets',
    label: 'Assets',
    kind: 'dollar',
    explanation: 'Total bank assets (latest report). Larger banks are shown first by default.',
  },
  roa: {
    id: 'roa',
    label: 'ROA',
    kind: 'percent',
    explanation: 'Return on Assets: net income as a percent of total assets. Higher generally means stronger profitability.',
  },
  capital_ratio: {
    id: 'capital_ratio',
    label: 'Capital Ratio',
    kind: 'percent',
    explanation: 'Capital ratio: equity divided by assets (percentage). Higher suggests a stronger capital position.',
  },
  deposits: {
    id: 'deposits',
    label: 'Deposits',
    kind: 'dollar',
    explanation: 'Total deposits (latest report). Helpful for understanding funding strength.',
  },
  netinc: {
    id: 'netinc',
    label: 'Net Income',
    kind: 'dollar',
    explanation: 'Net income (latest report). A core profitability signal for banks.',
  },
  nimy: {
    id: 'nimy',
    label: 'Net Interest Margin',
    kind: 'percent',
    explanation: 'Net interest margin (NIM): net interest income relative to earning assets.',
  },
  roaptx: {
    id: 'roaptx',
    label: 'ROAPTX',
    kind: 'percent',
    explanation: 'Alternative ROA measure used in FDIC data (ROAPTX).',
  },
  lnlsnet: {
    id: 'lnlsnet',
    label: 'LNLSNET',
    kind: 'percent',
    explanation: 'A FDIC efficiency/loan loss net metric. Higher/lower indicates different risk patterns depending on definition.',
  },
  elnatr: {
    id: 'elnatr',
    label: 'ELNATR',
    kind: 'percent',
    explanation: 'A FDIC risk metric related to expected losses and net charge-offs.',
  },
};

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

const formatMetricValue = (metricKey, value) => {
  const def = METRIC_DEFS[metricKey];
  if (!def) return value === null || value === undefined ? 'N/A' : String(value);
  if (def.kind === 'dollar') return formatCompact(Number(value));
  if (def.kind === 'percent') return formatPercent(Number(value));
  return value === null || value === undefined ? 'N/A' : String(value);
};

const getTrend = (growthPct) => {
  const v = Number(growthPct);
  if (!Number.isFinite(v)) return { arrow: '➜', tone: 'flat' };
  if (v > 2) return { arrow: '⬆', tone: 'up' };
  if (v < -2) return { arrow: '⬇', tone: 'down' };
  return { arrow: '➜', tone: 'flat' };
};

const MetricInfo = ({ metricKey }) => {
  const [open, setOpen] = useState(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const el = tooltipRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const def = METRIC_DEFS[metricKey];
  if (!def) return null;

  return (
    <span className="metric-info" ref={tooltipRef}>
      <button
        type="button"
        className="metric-info-btn"
        aria-label={`About ${def.label}`}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ⓘ
      </button>
      {open && (
        <span className="metric-info-tooltip" role="tooltip">
          {def.explanation}
        </span>
      )}
    </span>
  );
};

const BankExplorerTable = ({
  rows,
  sortState,
  visibleMetricIds,
  onSortChange,
  onOpenDetail,
  onRequestBranches,
}) => {
  const [tooltip, setTooltip] = useState(null); // {x,y, content}
  const [activeCell, setActiveCell] = useState(null);
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
    return cols.filter((k) => Boolean(METRIC_DEFS[k]));
  }, [visibleMetricIds]);

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

  const getCellTooltip = (colKey, row) => {
    if (!colKey) return '';
    if (colKey === 'bank_name') return `${row.bank_name}`;
    if (colKey === 'rank') return `Rank ${row.__rank}`;
    if (colKey === 'assets') {
      const trend = row.assets_growth_pct !== undefined ? getTrend(row.assets_growth_pct) : null;
      const trendStr = trend ? ` (${trend.arrow} vs previous)` : '';
      return `Assets: ${formatMetricValue('assets', row.assets)}${trendStr}`;
    }
    return `${METRIC_DEFS[colKey]?.label || colKey}: ${formatMetricValue(colKey, row[colKey])}`;
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
                      onClick={() => handleHeaderSort(metricKey, 'number')}
                      aria-label={`Sort by ${METRIC_DEFS[metricKey]?.label || metricKey}`}
                    >
                      {METRIC_DEFS[metricKey]?.label || metricKey}
                    </button>
                    <MetricInfo metricKey={metricKey} />
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
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setTooltip({ x: r.left + r.width / 2, y: r.top, content: getCellTooltip('rank', row) });
                      setActiveCell('rank');
                    }}
                    onMouseLeave={() => {
                      setTooltip(null);
                      setActiveCell(null);
                    }}
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
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setTooltip({ x: r.left + r.width / 2, y: r.top, content: getCellTooltip('bank_name', row) });
                      setActiveCell('bank_name');
                    }}
                    onMouseLeave={() => {
                      setTooltip(null);
                      setActiveCell(null);
                    }}
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
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      const r = el.getBoundingClientRect();
                      setTooltip({ x: r.left + r.width / 2, y: r.top, content: getCellTooltip('assets', row) });
                      setActiveCell('assets');
                    }}
                    onMouseLeave={() => {
                      setTooltip(null);
                      setActiveCell(null);
                    }}
                    title={`Assets: ${formatMetricValue('assets', row.assets)}`}
                    aria-label={`Assets for ${row.bank_name}`}
                  >
                    <span className="be-cell-metric-value">{formatMetricValue('assets', row.assets)}</span>
                  </button>
                </td>

                {visibleColumns
                  .filter((k) => k !== 'assets')
                  .map((metricKey) => (
                    <td key={`${row.cert}-${metricKey}`} data-label={METRIC_DEFS[metricKey]?.label || metricKey} className="be-td">
                      <button
                        type="button"
                        className="be-cell-button"
                        onClick={() => onOpenDetail?.(row)}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget;
                          const r = el.getBoundingClientRect();
                          setTooltip({
                            x: r.left + r.width / 2,
                            y: r.top,
                            content: getCellTooltip(metricKey, row),
                          });
                          setActiveCell(metricKey);
                        }}
                        onMouseLeave={() => {
                          setTooltip(null);
                          setActiveCell(null);
                        }}
                        title={`${METRIC_DEFS[metricKey]?.label || metricKey}: ${formatMetricValue(metricKey, row[metricKey])}`}
                        aria-label={`${METRIC_DEFS[metricKey]?.label || metricKey} for ${row.bank_name}`}
                      >
                        {formatMetricValue(metricKey, row[metricKey])}
                      </button>
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>

        {tooltip && (
          <div
            className={`be-tooltip ${activeCell ? 'active' : ''}`}
            style={{ left: tooltip.x, top: tooltip.y }}
            role="tooltip"
          >
            {tooltip.content}
          </div>
        )}

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
                      <span className="be-compare-metric-label">{METRIC_DEFS[k]?.label || k}</span>
                      <span className="be-compare-metric-value">
                        {formatMetricValue(k, b[k])}
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

