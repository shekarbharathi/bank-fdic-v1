import './ChatResponsePanel.css';

const ChatResponsePanel = ({
  isVisible,
  isLoading,
  confirmation,
  suggestions = [],
  onSuggestionClick,
  error,
}) => {
  if (!isVisible && !isLoading) return null;

  return (
    <div className="chat-response" aria-live="polite">
      {error ? (
        <div className="chat-response-error" role="alert">
          <strong>Sorry:</strong> {error}
          <div className="chat-response-error-hint">
            Try something like: <span className="chat-response-error-hint-chip">“banks in California”</span>
          </div>
        </div>
      ) : isLoading ? (
        <div className="chat-response-loading">
          <span className="spinner" aria-hidden="true" />
          <span>Top 5 Banks...</span>
        </div>
      ) : (
        <>
          <div className="chat-response-confirmation">💬 {confirmation}</div>
          {suggestions.length > 0 && (
            <div className="chat-response-suggestions">
              <div className="chat-response-suggestions-title">💡 You can also try:</div>
              <div className="chat-response-suggestions-list">
                {suggestions.slice(0, 3).map((s, idx) => (
                  <button
                    key={`${s}-${idx}`}
                    type="button"
                    className="chat-response-suggestion"
                    onClick={() => onSuggestionClick?.(s)}
                    aria-label={`Suggestion: ${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChatResponsePanel;

