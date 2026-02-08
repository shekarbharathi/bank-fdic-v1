import './DataTable.css';

const DataTable = ({ data }) => {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);

  const formatValue = (value, columnName = '') => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      // Check if this looks like a dollar amount
      const colLower = columnName.toLowerCase();
      const isDollar = ['asset', 'dep', 'deposit', 'dollar', 'cost', 'income', 'equity', 'capital', 'netinc', 'lnlsnet'].some(
        word => colLower.includes(word)
      );
      const prefix = isDollar ? '$' : '';
      
      const absVal = Math.abs(value);
      const sign = value < 0 ? '-' : '';
      
      // Round to nearest unit with up to 2 decimals (matching backend logic)
      if (absVal >= 1_000_000_000_000) {  // Trillions
        const rounded = Math.round((value / 1_000_000_000_000) * 100) / 100;
        return `${sign}${prefix}${Math.abs(rounded).toFixed(2)}T`;
      } else if (absVal >= 1_000_000_000) {  // Billions
        const rounded = Math.round((value / 1_000_000_000) * 100) / 100;
        return `${sign}${prefix}${Math.abs(rounded).toFixed(2)}B`;
      } else if (absVal >= 1_000_000) {  // Millions
        const rounded = Math.round((value / 1_000_000) * 100) / 100;
        return `${sign}${prefix}${Math.abs(rounded).toFixed(2)}M`;
      } else if (absVal >= 1_000) {  // Thousands
        const rounded = Math.round((value / 1_000) * 100) / 100;
        return `${sign}${prefix}${Math.abs(rounded).toFixed(2)}K`;
      } else {
        // Less than 1000, show as-is with 2 decimals if float
        if (Number.isInteger(value)) {
          return `${sign}${prefix}${absVal}`;
        } else {
          return `${sign}${prefix}${absVal.toFixed(2)}`;
        }
      }
    }
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
