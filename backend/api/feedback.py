"""
Feedback API endpoints for LLM response quality.
"""
import os
import sys
import asyncio
from typing import Optional

if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, backend_dir)

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests

try:
    from services.database import DatabaseService
except ImportError:
    from backend.services.database import DatabaseService

router = APIRouter()

_db_service = None


def get_db() -> DatabaseService:
    global _db_service
    if _db_service is None:
        _db_service = DatabaseService()
    return _db_service


class LlmFeedbackRequest(BaseModel):
    response_instance_id: str
    feedback_value: str
    down_reason: Optional[str] = None
    down_reason_other_text: Optional[str] = None


class LlmFeedbackResponse(BaseModel):
    success: bool
    response_instance_id: str
    feedback_value: str


class SimpleFeedbackRequest(BaseModel):
    message: str
    source: Optional[str] = None


class SimpleFeedbackResponse(BaseModel):
    success: bool


ALLOWED_FEEDBACK = {"up", "down"}
ALLOWED_DOWN_REASONS = {
    "not_factually_correct",
    "did_not_understand_query",
    "data_insufficient",
    "other",
}


def _send_feedback_email_via_resend(message: str, source: Optional[str]) -> None:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY is not configured")

    to_email = os.getenv("FEEDBACK_TO_EMAIL", "niide.kyojo@gmail.com").strip()
    from_email = os.getenv("FEEDBACK_FROM_EMAIL", "onboarding@resend.dev").strip()
    source_safe = (source or "general").strip()[:80]

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": f"BankStatz feedback ({source_safe})",
        "text": f"Source: {source_safe}\n\nMessage:\n{message}",
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    resp = requests.post(
        "https://api.resend.com/emails",
        json=payload,
        headers=headers,
        timeout=15,
    )
    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail="Failed to send feedback email")


@router.post("/feedback/llm-response", response_model=LlmFeedbackResponse)
async def submit_llm_feedback(payload: LlmFeedbackRequest):
    db = get_db()

    feedback_value = (payload.feedback_value or "").strip().lower()
    down_reason = (payload.down_reason or "").strip().lower() or None
    down_reason_other_text = (payload.down_reason_other_text or "").strip() or None

    if feedback_value not in ALLOWED_FEEDBACK:
        raise HTTPException(status_code=400, detail="feedback_value must be 'up' or 'down'")

    if feedback_value == "down":
        if down_reason not in ALLOWED_DOWN_REASONS:
            raise HTTPException(status_code=400, detail="Valid down_reason is required for thumbs down")
        if down_reason == "other" and not down_reason_other_text:
            raise HTTPException(status_code=400, detail="down_reason_other_text is required when down_reason is 'other'")
    else:
        down_reason = None
        down_reason_other_text = None

    # Ensure response_instance_id exists before storing feedback.
    exists_row = await db.execute_fetchone(
        "SELECT response_instance_id FROM llm_query_events WHERE response_instance_id = %s",
        (payload.response_instance_id,),
    )
    if not exists_row:
        raise HTTPException(status_code=400, detail="Unknown response_instance_id")

    upsert_sql = """
        INSERT INTO llm_query_feedback (
            response_instance_id,
            feedback_value,
            down_reason,
            down_reason_other_text
        )
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (response_instance_id)
        DO UPDATE SET
            feedback_value = EXCLUDED.feedback_value,
            down_reason = EXCLUDED.down_reason,
            down_reason_other_text = EXCLUDED.down_reason_other_text,
            created_at = CURRENT_TIMESTAMP
    """
    await db.execute_write(
        upsert_sql,
        (
            payload.response_instance_id,
            feedback_value,
            down_reason,
            down_reason_other_text,
        ),
    )

    return LlmFeedbackResponse(
        success=True,
        response_instance_id=payload.response_instance_id,
        feedback_value=feedback_value,
    )


@router.post("/feedback/simple", response_model=SimpleFeedbackResponse)
async def submit_simple_feedback(payload: SimpleFeedbackRequest):
    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if len(message) > 4000:
        raise HTTPException(status_code=400, detail="message is too long")

    await asyncio.to_thread(_send_feedback_email_via_resend, message, payload.source)
    return SimpleFeedbackResponse(success=True)
