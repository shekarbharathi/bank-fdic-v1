import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { buildHighlightSegments } from '../utils/queryDiffHighlight';
import './ChatFilterBox.css';

const SendIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="chat-filter-send-svg">
    <path d="M2 2L23 12L2 22V14L16 12L2 10V2Z" fill="currentColor" />
    <path d="M2 14L9 12.5L8 17Z" fill="currentColor" opacity="0.35" />
  </svg>
);

const ChatFilterBox = forwardRef(
  (
    {
      value,
      onChange,
      onSubmit,
      isLoading,
      disabled,
      placeholder = 'Show me...',
      highlightRanges = null,
      onHighlightClear,
      onFocus: onFocusProp,
    },
    ref
  ) => {
    const textareaRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);
    const [scroll, setScroll] = useState({ top: 0, left: 0 });

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    const isDisabled = disabled || isLoading;
    const trimmed = (value || '').trim();
    const canSubmit = !isDisabled && trimmed.length > 0;

    const hasHighlight = Array.isArray(highlightRanges) && highlightRanges.length > 0;
    const segments = hasHighlight ? buildHighlightSegments(value || '', highlightRanges) : [];

    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [value, hasHighlight]);

    useEffect(() => {
      if (!hasHighlight || !onHighlightClear) return;
      const t = window.setTimeout(() => onHighlightClear(), 3400);
      return () => window.clearTimeout(t);
    }, [hasHighlight, highlightRanges, onHighlightClear]);

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSubmit) onSubmit?.(value);
      }
    };

    const handleScroll = (e) => {
      const t = e.target;
      setScroll({ top: t.scrollTop, left: t.scrollLeft });
    };

    return (
      <div className="chat-filter">
        <div
          className={`chat-filter-shell ${isFocused ? 'focused' : ''} ${isDisabled ? 'disabled' : ''}`}
        >
          <form
            className="chat-filter-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) onSubmit?.(value);
            }}
            aria-label="Bank data chat filter"
          >
            <label className="sr-only" htmlFor="bank-chat-filter-input">
              Ask for banks to show in the table
            </label>
            <div className="chat-filter-input-wrap">
              {hasHighlight && (
                <div className="chat-filter-mirror-clip" aria-hidden>
                  <div
                    className="chat-filter-mirror-inner"
                    style={{
                      transform: `translate(${-scroll.left}px, ${-scroll.top}px)`,
                    }}
                  >
                    {segments.map((seg, idx) =>
                      seg.highlight ? (
                        <span key={`h-${idx}`} className="chat-filter-diff-chunk">
                          {seg.text}
                        </span>
                      ) : (
                        <span key={`n-${idx}`}>{seg.text}</span>
                      )
                    )}
                  </div>
                </div>
              )}
              <textarea
                id="bank-chat-filter-input"
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => {
                  setIsFocused(true);
                  onFocusProp?.(e);
                }}
                onBlur={() => setIsFocused(false)}
                onScroll={handleScroll}
                placeholder={placeholder}
                disabled={isDisabled}
                rows={1}
                className={`chat-filter-textarea ${hasHighlight ? 'chat-filter-textarea-mirror-mode' : ''}`}
                aria-label="Ask to show banks"
              />
            </div>
            <button
              className="chat-filter-send"
              type="submit"
              disabled={!canSubmit}
              aria-label="Send message"
            >
              {isLoading ? (
                <span className="chat-filter-loading" aria-label="Processing">
                  <span className="spinner" aria-hidden="true" />
                </span>
              ) : (
                <span className="chat-filter-send-icon" aria-hidden="true">
                  <SendIcon />
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }
);

ChatFilterBox.displayName = 'ChatFilterBox';

export default ChatFilterBox;
