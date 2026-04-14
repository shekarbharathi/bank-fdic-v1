import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { canonicalFieldName } from '../utils/columnPickerQuery';
import { buildFieldMetaMap } from '../utils/columnPickerMetrics';
import './ColumnPickerModal.css';

const GROUP_ICONS = {
  'Identifiers & Dates': '📋',
  'Size & Balance Sheet': '📊',
  'Deposit Breakdown': '💰',
  'Loan Breakdown': '🏠',
  'Income Statement': '💵',
  'Profitability & Efficiency': '📈',
  'Asset Quality & Safety': '🛡️',
  'Operations & Infrastructure': '🏢',
};

const POPULAR_FIELDS = ['roa', 'nimy', 'dep', 'netinc', 'lncrcd', 'eq'];

const SKIP_PICKER_FIELDS = new Set();

const UNLOCK_STORAGE_PREFIX = 'bankstatz_unlock_group_';

const IDENTIFIERS_GROUP_NAME = 'Identifiers & Dates';

/** API returns groups by group_id; show Identifiers & Dates last in the modal. */
function orderGroupsWithIdentifiersLast(list) {
  if (!Array.isArray(list) || list.length === 0) return list;
  const ident = list.filter((g) => g.group_name === IDENTIFIERS_GROUP_NAME);
  const rest = list.filter((g) => g.group_name !== IDENTIFIERS_GROUP_NAME);
  return [...rest, ...ident];
}

const ColumnPickerModal = ({
  open,
  onClose,
  groups,
  selectedFieldNames,
  onApply,
}) => {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);

  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set());
  const [localSelected, setLocalSelected] = useState(
    () => new Set((selectedFieldNames || []).map(canonicalFieldName))
  );
  const [search, setSearch] = useState('');
  const [unlockMessage, setUnlockMessage] = useState(null);

  const fieldMeta = useMemo(() => buildFieldMetaMap(groups), [groups]);
  const allFieldNames = useMemo(() => new Set(fieldMeta.keys()), [fieldMeta]);

  const filteredGroups = useMemo(() => {
    if (!Array.isArray(groups)) return [];
    const q = search.trim().toLowerCase();
    const base = !q
      ? groups
      : groups
          .map((g) => ({
            ...g,
            fields: (g.fields || []).filter((f) => {
              if (SKIP_PICKER_FIELDS.has(f.field_name)) return false;
              const hay = `${f.display_name || ''} ${f.field_name || ''} ${f.fdic_field_code || ''}`.toLowerCase();
              return hay.includes(q);
            }),
          }))
          .filter((g) => g.fields.length > 0);
    return orderGroupsWithIdentifiersLast(base);
  }, [groups, search]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  // Always reflect currently visible columns when the modal opens.
  useEffect(() => {
    if (!open) return;
    setLocalSelected(new Set((selectedFieldNames || []).map(canonicalFieldName)));
  }, [open, selectedFieldNames]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleField = useCallback(
    (fieldName, groupIdHint) => {
      if (SKIP_PICKER_FIELDS.has(fieldName)) return;
      const gid =
        groupIdHint ??
        groups?.find((g) => g.fields?.some((f) => f.field_name === fieldName))?.group_id;

      setLocalSelected((prev) => {
        const next = new Set(prev);
        const wasSelected = next.has(fieldName);
        if (wasSelected) next.delete(fieldName);
        else {
          next.add(fieldName);
          if (gid != null && typeof localStorage !== 'undefined') {
            const key = `${UNLOCK_STORAGE_PREFIX}${gid}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, '1');
              const g = groups?.find((x) => x.group_id === gid);
              if (g?.group_name) {
                setUnlockMessage(`You discovered ${g.group_name}! Keep exploring to find more insights.`);
              }
            }
          }
        }
        return next;
      });
    },
    [groups]
  );

  const togglePopular = useCallback((fieldName) => {
    toggleField(fieldName, undefined);
  }, [toggleField]);

  const handleApply = useCallback(() => {
    const selected = Array.from(new Set(Array.from(localSelected).map(canonicalFieldName)));
    const displayNames = selected
      .map((id) => fieldMeta.get(id)?.display_name || id)
      .filter(Boolean);
    onApply?.({ selectedFieldNames: selected, displayNames });
  }, [localSelected, fieldMeta, onApply]);

  const popularAvailable = useMemo(
    () => POPULAR_FIELDS.filter((f) => allFieldNames.has(f)),
    [allFieldNames]
  );

  if (!open) return null;

  return (
    <div className="cpm-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className="cpm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className="cpm-header">
          <div>
            <h2 id={titleId} className="cpm-title">
              Add columns
            </h2>
          </div>
          <button
            type="button"
            ref={closeBtnRef}
            className="cpm-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {unlockMessage && (
          <div className="cpm-unlock" role="status">
            {unlockMessage}
          </div>
        )}

        <div className="cpm-search-wrap">
          <label htmlFor="cpm-search" className="sr-only">
            Search metrics
          </label>
          <input
            id="cpm-search"
            type="search"
            className="cpm-search"
            placeholder="Search all metrics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        {popularAvailable.length > 0 && (
          <div className="cpm-section">
            <h3 className="cpm-section-title">Frequently used</h3>
            <div className="cpm-quick-row">
              {popularAvailable.map((name) => {
                const field = fieldMeta.get(name);
                const label = field?.display_name || name;
                const checked = localSelected.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`cpm-quick-btn ${checked ? 'is-on' : ''}`}
                    onClick={() => togglePopular(name)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="cpm-body" role="list">
          {filteredGroups.map((group) => {
            const gid = group.group_id;
            const expanded = expandedGroupIds.has(gid);
            const icon = GROUP_ICONS[group.group_name] || '📁';
            const fields = (group.fields || []).filter((f) => !SKIP_PICKER_FIELDS.has(f.field_name));

            return (
              <div key={gid} className="cpm-card" role="listitem">
                <button
                  type="button"
                  className="cpm-card-header"
                  onClick={() => toggleGroup(gid)}
                  aria-expanded={expanded}
                  aria-controls={`cpm-group-${gid}`}
                >
                  <span className="cpm-card-icon" aria-hidden="true">
                    {icon}
                  </span>
                  <span className="cpm-card-name">{group.group_name}</span>
                  <span className="cpm-card-count">{fields.length} fields</span>
                  <span className="cpm-card-chevron" aria-hidden="true">
                    {expanded ? '▾' : '▸'}
                  </span>
                </button>

                {expanded && (
                  <div id={`cpm-group-${gid}`} className="cpm-field-list">
                    {fields.map((field) => {
                      const fname = field.field_name;
                      const checked = localSelected.has(fname);
                      return (
                        <label key={fname} className="cpm-field-row">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleField(fname, gid)}
                          />
                          <span className="cpm-field-text">
                            <span className="cpm-field-label">{field.display_name}</span>
                            {field.synopsis && (
                              <>
                                <span className="cpm-field-sep" aria-hidden="true">
                                  ·
                                </span>
                                <span className="cpm-field-desc" title={field.synopsis}>
                                  {field.synopsis}
                                </span>
                              </>
                            )}
                            {field.fdic_field_code && (
                              <>
                                <span className="cpm-field-sep" aria-hidden="true">
                                  ·
                                </span>
                                <span className="cpm-field-code" title={field.fdic_field_code}>
                                  {field.fdic_field_code}
                                </span>
                              </>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="cpm-footer">
          <span className="cpm-count" aria-live="polite">
            {localSelected.size} column{localSelected.size === 1 ? '' : 's'} selected
          </span>
          <div className="cpm-footer-actions">
            <button type="button" className="cpm-btn cpm-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="cpm-btn cpm-btn-primary" onClick={handleApply}>
              Add Selected Columns
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnPickerModal;
