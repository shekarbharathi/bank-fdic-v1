import './ChatResponsePanel.css';

const ChatResponsePanel = ({
  isVisible,
  isLoading,
  confirmation,
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
        </>
      )}
    </div>
  );
};

export default ChatResponsePanel;

