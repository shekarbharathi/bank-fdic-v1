-- Migration 0006: LLM quality tracking + user feedback tables

BEGIN;

CREATE TABLE IF NOT EXISTS llm_query_events (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255),
    response_instance_id VARCHAR(255) NOT NULL UNIQUE,
    user_query TEXT NOT NULL,
    llm_sql TEXT,
    llm_intent VARCHAR(100),
    llm_visualization_type VARCHAR(100),
    llm_visualization_title VARCHAR(255),
    data_row_count INTEGER NOT NULL DEFAULT 0,
    column_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_llm_query_events_created_at
    ON llm_query_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_query_events_status
    ON llm_query_events(status);

CREATE INDEX IF NOT EXISTS idx_llm_query_events_intent
    ON llm_query_events(llm_intent);

CREATE TABLE IF NOT EXISTS llm_query_feedback (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_instance_id VARCHAR(255) NOT NULL UNIQUE,
    feedback_value VARCHAR(10) NOT NULL,
    down_reason VARCHAR(64),
    down_reason_other_text TEXT,
    CONSTRAINT fk_feedback_response_instance
        FOREIGN KEY (response_instance_id)
        REFERENCES llm_query_events(response_instance_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_llm_query_feedback_created_at
    ON llm_query_feedback(created_at DESC);

COMMIT;
