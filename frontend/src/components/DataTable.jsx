import './DataTable.css';

const DataTable = ({ data }) => {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);

  const isDateColumn = (columnName) => {
    const colLower = columnName.toLowerCase();
    const dateKeywords = ['date', 'repdte', 'faildate', 'procdate', 'dateupdt'];
    return dateKeywords.some(keyword => colLower.includes(keyword));
  };

  const formatValue = (value, columnName = '') => {
    if (value === null || value === undefined) return 'N/A';
    
    // Skip number formatting for date columns
    if (isDateColumn(columnName)) {
      return String(value);
    }
    
    // Convert to number if it's a string representation of a number
    let numValue = value;
    if (typeof value === 'string') {
      // Try to parse as number (handles cases like "3456789012" or "3456789.12")
      const parsed = parseFloat(value.replace(/,/g, ''));
      if (!isNaN(parsed) && isFinite(parsed)) {
        numValue = parsed;
      } else {
        // Not a number, return as string
        return value;
      }
    }
    
    // Only format if it's actually a number
    if (typeof numValue === 'number' && !isNaN(numValue) && isFinite(numValue)) {
      // Check if this looks like a dollar amount
      const colLower = columnName.toLowerCase();
      const isDollar = ['asset', 'dep', 'deposit', 'dollar', 'cost', 'income', 'equity', 'capital', 'netinc', 'lnlsnet', 'eqtot'].some(
        word => colLower.includes(word)
      );
      const prefix = isDollar ? '$' : '';
      
      const absVal = Math.abs(numValue);
      const sign = numValue < 0 ? '-' : '';
      
      // Round to nearest unit with up to 2 decimals (matching backend logic)
      if (absVal >= 1_000_000_000_000) {  // Trillions
        const rounded = Math.round((numValue / 1_000_000_000_000) * 100) / 100;
        return `${sign}${prefix}${Math.abs(rounded).toFixed(2)}T`;
      } else if (absVal >= 1_000_000_000) {  // Billions
        const rounded = Math.round((numValue / 1_000_000_000) * 100) / 100;
        return `${sign}${prefix}${Math.abs(rounded).toFixed(2)}B`;
      } else if (absVal >= 1_000_000) {  // Millions
        const rounded = Math.round((numValue / 1_000_000) * 100) / 100;
        return `${sign}${prefix}${Math.abs(rounded).toFixed(2)}M`;
      } else if (absVal >= 1_000) {  // Thousands
        const rounded = Math.round((numValue / 1_000) * 100) / 100;
        return `${sign}${prefix}${Math.abs(rounded).toFixed(2)}K`;
      } else {
        // Less than 1000, show as-is with 2 decimals if float
        if (Number.isInteger(numValue)) {
          return `${sign}${prefix}${absVal}`;
        } else {
          return `${sign}${prefix}${absVal.toFixed(2)}`;
        }
      }
    }
    
    // Fallback: return as string
    return String(value);
  };

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((row, idx) => (
            <tr key={idx}>
            {columns.map((col) => (
              <td key={col}>{formatValue(row[col], col)}</td>
            ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 100 && (
        <div className="table-footer">
          Showing 100 of {data.length} results
        </div>
      )}
    </div>
  );
};

export default DataTable;
