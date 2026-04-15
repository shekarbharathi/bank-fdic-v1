import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './ManualModalPopup.css';

const SUBTITLE =
  'Every quarter, the Federal Desposit Insurance Corporation (FDIC) publishes a vast amount of data (1100+ data fields) about all insured banks. The following are the most frequently analyzed data fields. You can use BankStatz to explore these for all FDIC insured banks.';
const IDENTIFIERS_GROUP_NAME = 'Identifiers & Dates';

function fieldKey(field) {
  return String(field?.field_name || field?.fdic_field_code || field?.display_name || Math.random());
}

export default function ManualModalPopup({ open, onClose, groups, onRequestFeedback }) {
  const titleId = useId();
  const subtitleId = useId();
  const closeBtnRef = useRef(null);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [expandedFields, setExpandedFields] = useState(() => new Set());

  const safeGroups = useMemo(() => (Array.isArray(groups) ? groups : []), [groups]);
  const orderedGroups = useMemo(() => {
    if (!safeGroups.length) return safeGroups;
    const ident = safeGroups.filter((g) => g?.group_name === IDENTIFIERS_GROUP_NAME);
    const rest = safeGroups.filter((g) => g?.group_name !== IDENTIFIERS_GROUP_NAME);
    return [...rest, ...ident];
  }, [safeGroups]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

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

  if (!open) return null;

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleField = (key) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="manual-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="manual-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitleId}>
        <div className="manual-header">
          <div>
            <h2 id={titleId} className="manual-title">
              FDIC field code manual
            </h2>
            <p id={subtitleId} className="manual-subtitle">
              {SUBTITLE}
            </p>
          </div>
          <button type="button" ref={closeBtnRef} className="manual-close" onClick={onClose} aria-label="Close manual">
            ✕
          </button>
        </div>

        <div className="manual-groups">
          {orderedGroups.map((group) => {
            const gid = group?.group_id;
            const fields = Array.isArray(group?.fields) ? group.fields : [];
            const isGroupOpen = expandedGroups.has(gid);
            return (
              <section key={gid ?? group?.group_name} className="manual-group">
                <button type="button" className="manual-group-toggle" onClick={() => toggleGroup(gid)} aria-expanded={isGroupOpen}>
                  <span className="manual-toggle-symbol">{isGroupOpen ? '▾' : '▸'}</span>
                  <span className="manual-group-name">{group?.group_name || 'Unnamed group'}</span>
                  <span className="manual-group-count">{fields.length}</span>
                </button>

                {isGroupOpen ? (
                  <div className="manual-fields">
                    {fields.map((field) => {
                      const key = fieldKey(field);
                      const isFieldOpen = expandedFields.has(key);
                      return (
                        <article key={key} className="manual-field">
                          <button
                            type="button"
                            className="manual-field-toggle"
                            onClick={() => toggleField(key)}
                            aria-expanded={isFieldOpen}
                          >
                            <span className="manual-toggle-symbol">{isFieldOpen ? '▾' : '▸'}</span>
                            <span className="manual-field-title">{field?.display_name || field?.field_name || 'Unnamed field'}</span>
                            <span className="manual-field-code">{field?.fdic_field_code || ''}</span>
                          </button>
                          {isFieldOpen ? (
                            <>
                              <div className="manual-field-synopsis">{field?.synopsis || '—'}</div>
                              <div className="manual-field-description">{field?.description || '—'}</div>
                            </>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
        <div className="manual-attribution-row">
          <button
            type="button"
            className="manual-feedback-link"
            onClick={() => onRequestFeedback?.('manual_data_fields')}
          >
            If you want more data fields to be added, let us know
          </button>
          <div className="manual-attribution">
            Icon made by{' '}
            <a
              href="https://www.flaticon.com/authors/freepik"
              target="_blank"
              rel="noreferrer"
            >
              Freepik
            </a>{' '}
            from{' '}
            <a
              href="https://www.flaticon.com/free-icon/open-book_166088?term=open+book&related_id=166088"
              target="_blank"
              rel="noreferrer"
            >
              Flaticon
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
