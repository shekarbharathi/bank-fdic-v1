/**
 * API client for backend communication
 */
import axios from 'axios';

// Use environment variable for API URL, fallback to relative path for production
// Remove trailing slash if present to avoid double slashes
const rawUrl = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? '' : 'http://localhost:8000');
const API_BASE_URL = rawUrl ? rawUrl.replace(/\/+$/, '') : '';

// Debug: Log API URL (always log to help debug)
// Using window.console to ensure it's not stripped in production
if (typeof window !== 'undefined') {
  window.console.log('=== API Configuration ===');
  window.console.log('VITE_API_URL (raw):', import.meta.env.VITE_API_URL);
  window.console.log('API_BASE_URL (final):', API_BASE_URL || '(empty - using relative path)');
  window.console.log('Environment:', import.meta.env.MODE);
  window.console.log('Full URL will be:', API_BASE_URL ? `${API_BASE_URL}/api/chat` : '/api/chat (relative)');
  window.console.log('========================');
}

// #region agent log
if (!import.meta.env.PROD) {
  try {
    fetch('http://127.0.0.1:7350/ingest/152fb36c-8b60-412e-91e5-51df2bbb09a0', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '073e07',
      },
      body: JSON.stringify({
        sessionId: '073e07',
        runId: 'pre-debug',
        hypothesisId: 'H1_api_base_url_misconfigured',
        location: 'frontend/src/api/client.js:1',
        message: 'Resolved API base URL used by axios',
        data: {
          VITE_API_URL_raw: import.meta.env.VITE_API_URL || null,
          API_BASE_URL_final: API_BASE_URL || null,
          computedChatEndpoint: API_BASE_URL ? `${API_BASE_URL}/api/chat` : '/api/chat',
          windowHost: typeof window !== 'undefined' ? window.location.host : null,
        },
        timestamp: Date.now(),
      }),
    }).catch((e) => {
      void e;
    });
  } catch (e) {
    void e;
  }
}
// #endregion

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * @typedef {Object} ChatApiResponse
 * @property {string} response - Human-readable answer text
 * @property {string} [sql] - Executed SQL
 * @property {Array<Record<string, unknown>>} [data] - Query rows
 * @property {string} [error] - Error message when present
 * @property {'out_of_scope' | string} [error_code] - Machine-readable error (e.g. out_of_scope)
 * @property {string} [intent] - Query intent from LLM plan (browse_table, compare_banks, …)
 * @property {{ type?: string, title?: string, config?: Record<string, unknown> }} [visualization]
 * @property {Record<string, unknown>} [entities] - Optional extracted entities
 * @property {number} [execution_time]
 */

export const chatAPI = {
  /**
   * Send a chat message to the backend
   * @param {string} message - User's question
   * @param {string} conversationId - Optional conversation ID
   * @returns {Promise<ChatApiResponse>}
   */
  sendMessage: async (message, conversationId = null) => {
    const response = await client.post('/api/chat', {
      message,
      conversation_id: conversationId,
    });
    return response.data;
  },

  expandQuery: async (message) => {
    const response = await client.post('/api/expand-query', { message });
    return response.data.expanded_query;
  },

  /**
   * Health check
   * @returns {Promise} Health status
   */
  healthCheck: async () => {
    const response = await client.get('/api/health');
    return response.data;
  },

  /**
   * Get database schema
   * @returns {Promise} Schema information
   */
  getSchema: async () => {
    const response = await client.get('/api/schema');
    return response.data;
  },

  /**
   * Field groups for column picker (from field_metadata)
   * @returns {Promise<{ groups: Array }>}
   */
  getFieldGroups: async () => {
    const response = await client.get('/api/metadata/field-groups');
    return response.data;
  },
};

export default client;
