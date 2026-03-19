import './ChatResponsePanel.css';

const ChatResponsePanel = ({
  isVisible,
  isLoading,
  error,
}) => {
  if (!isVisible && !isLoading && !error) return null;

  // If we're neither loading nor showing an error, we intentionally render nothing.
  if (!isLoading && !error) return null;

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
        null
      )}
    </div>
  );
};

export default ChatResponsePanel;

