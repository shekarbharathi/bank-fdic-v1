# GA4 Activity Tracking

This project uses a GA4-first analytics layer in the frontend to track user activity.

## Configuration

- Set `VITE_GA4_MEASUREMENT_ID` in frontend env.
- Optional: set `VITE_GA4_CAPTURE_QUERY_TEXT=true` if you want submitted query text captured in GA4 (`query_submit.query_text`).
- Example values are in `frontend/.env.example`.
- If `VITE_GA4_MEASUREMENT_ID` is empty, analytics calls become no-ops.

## Railway Setup Instructions

1. In GA4, create/get your web data stream and copy the Measurement ID (format: `G-XXXXXXXXXX`).
2. In Railway, open your frontend service (the service that builds/runs Vite app).
3. Go to **Variables** and add:
   - `VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX`
   - `VITE_GA4_CAPTURE_QUERY_TEXT=true` (only if you want raw submitted query text tracked)
4. Redeploy the frontend service so Vite rebuilds with new env vars.
5. Open the app and use GA4 **DebugView** to verify events.

## Privacy Rules

- By default, raw typed query text is not sent.
- If `VITE_GA4_CAPTURE_QUERY_TEXT=true`, submitted query text is sent as `query_submit.query_text` (truncated to 120 chars).
- Do not send raw table row values.
- Send metadata only: counts, lengths, IDs, states, timings.
- All event params pass through an allowlist in `frontend/src/utils/analytics.js`.

## Event Taxonomy (Phase 1)

- Session lifecycle:
  - `app_session_start`
  - `app_heartbeat`
  - `app_session_end`
- View exposure:
  - `view_impression_start`
  - `view_impression_end`
- Inputs:
  - `input_edit` (sampled)
  - `query_submit`
- Data and UI:
  - `results_rendered`
  - `viz_rendered`
  - `viz_interaction`
  - `column_picker_opened`
  - `column_picker_applied`
  - `manual_opened`
  - `examples_toggled`
  - `table_sort_changed`
  - `ui_click`

## Guardrails

- `event_version` is attached to all events.
- Keep event names stable; add new names rather than repurposing old names.
- Keep high-cardinality fields out of params (no free-form text).
- Use coarse contexts (`landing`, `post_submit`, `interactive_table`) instead of dynamic strings.

## Validation (DebugView)

1. Set `VITE_GA4_MEASUREMENT_ID` locally.
2. Run frontend and open GA4 DebugView.
3. Confirm events appear for:
   - typing, submitting query, results rendering,
   - viz render + interaction (`viz_component` should indicate `trend_tracker`, `state_explorer`, etc.),
   - opening picker/manual, toggling examples,
   - sorting table columns.
4. Confirm payloads:
   - do not include raw financial values,
   - include `query_text` only when `VITE_GA4_CAPTURE_QUERY_TEXT=true`.
