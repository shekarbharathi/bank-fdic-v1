import { useState } from 'react';
import './SQLDisplay.css';

const SQLDisplay = ({ sql }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sql) return null;

  return (
    <div className="sql-display">
      <button
        className="sql-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '▼' : '▶'} SQL Query
      </button>
      {isExpanded && (
        <pre className="sql-code">
          <code>{sql}</code>
        </pre>
      )}
    </div>
  );
};

export default SQLDisplay;
