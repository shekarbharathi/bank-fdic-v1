import React from 'react';
import ReactMarkdown from 'react-markdown';
import SQLDisplay from './SQLDisplay';
import DataTable from './DataTable';
import './MessageList.css';

const MessageList = ({ messages, isLoading }) => {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="empty-state">
        <h2>Welcome to FDIC Bank Data Chat</h2>
        <p>Try asking questions like:</p>
        <ul>
          <li>"Which banks have the best capital ratios?"</li>
          <li>"How has JPMorgan's deposit growth trended?"</li>
          <li>"Show me the top 10 banks by assets"</li>
          <li>"What banks are in California with ROA greater than 1%?"</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message message-${message.role} ${message.error ? 'message-error' : ''}`}
        >
          <div className="message-header">
            <span className="message-role">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </span>
            {message.executionTime && (
              <span className="message-time">
                {message.executionTime.toFixed(2)}s
              </span>
            )}
          </div>
          <div className="message-content">
            {message.role === 'user' ? (
              <p>{message.content}</p>
            ) : (
              <>
                <ReactMarkdown>{message.content}</ReactMarkdown>
                {message.sql && <SQLDisplay sql={message.sql} />}
                {message.data && message.data.length > 0 && (
                  <DataTable data={message.data} />
                )}
                {message.error && (
                  <div className="error-message">
                    <strong>Error:</strong> {message.error}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="message message-assistant">
          <div className="message-content">
            <div className="loading-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Thinking...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageList;
