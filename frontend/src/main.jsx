import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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
        hypothesisId: 'H2_host_domain_mismatch',
        location: 'frontend/src/main.jsx:1',
        message: 'Page host + api env snapshot',
        data: {
          href: window.location?.href,
          host: window.location?.host,
          apiUrlEnv: import.meta.env?.VITE_API_URL || null,
          mode: import.meta.env?.MODE || null,
          prod: Boolean(import.meta.env?.PROD),
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
