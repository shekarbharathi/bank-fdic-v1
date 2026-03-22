import './ChatResponsePanel.css';

const ChatResponsePanel = ({
  isVisible,
  isLoading,
  error,
}) => {
  // Only show panel for errors; loading state is indicated by spinner in chatbox
  if (!error) return null;

  return (
    <div className="chat-response" aria-live="polite" role="alert">
      <div className="chat-response-error">
          <strong>Sorry:</strong> {error}
          <div className="chat-response-error-hint">
            Try something like: <span className="chat-response-error-hint-chip">“banks in California”</span>
          </div>
        </div>
    </div>
  );
};

export default ChatResponsePanel;

