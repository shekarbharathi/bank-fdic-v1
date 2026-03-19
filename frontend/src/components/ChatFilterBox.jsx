import { useEffect, useMemo, useRef, useState } from 'react';
import './ChatFilterBox.css';

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChatFilterBox = ({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  placeholder = 'Show me...',
  examples = [],
  onExampleClick,
}) => {
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  const isDisabled = disabled || isLoading;
  const trimmed = (value || '').trim();
  const canSubmit = !isDisabled && trimmed.length > 0;

  const exampleChips = useMemo(() => {
    // Ensure we always have at least a couple chips.
    if (examples.length > 0) return examples;
    return ["most profitable banks", "banks in Texas"];
  }, [examples]);

  useEffect(() => {
    // Keep textarea height responsive (single-line -> multi-line).
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const handleKeyDown = (e) => {
    // Enter submits; Shift+Enter keeps newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit?.(value);
    }
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
          <textarea
            id="bank-chat-filter-input"
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={isDisabled}
            rows={1}
            className="chat-filter-textarea"
            aria-label="Ask to show banks"
          />
          <button
            className="chat-filter-send"
            type="submit"
            disabled={!canSubmit}
            aria-label="Send message"
          >
            {isLoading ? (
              <span className="chat-filter-loading">
                <span className="spinner" aria-hidden="true" />
                <span>Top 5 Banks...</span>
              </span>
            ) : (
              <span className="chat-filter-send-icon" aria-hidden="true">
                <SendIcon />
              </span>
            )}
          </button>
        </form>
      </div>

      <div className="chat-filter-examples" aria-label="Example prompts">
        <span className="chat-filter-examples-label">Try:</span>
        {exampleChips.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chat-filter-example-chip"
            onClick={() => onExampleClick?.(ex)}
            disabled={isLoading}
            aria-label={`Example prompt: ${ex}`}
          >
            &quot;{ex}&quot;
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatFilterBox;

