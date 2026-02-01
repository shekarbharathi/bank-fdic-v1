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
console.log('API Configuration:', {
  'VITE_API_URL (raw)': import.meta.env.VITE_API_URL,
  'API_BASE_URL (final)': API_BASE_URL || '(empty - using relative path)',
  'Environment': import.meta.env.MODE
});

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const chatAPI = {
  /**
   * Send a chat message to the backend
   * @param {string} message - User's question
   * @param {string} conversationId - Optional conversation ID
   * @returns {Promise} API response
   */
  sendMessage: async (message, conversationId = null) => {
    const response = await client.post('/api/chat', {
      message,
      conversation_id: conversationId,
    });
    return response.data;
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
};

export default client;
