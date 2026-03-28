"""
Client debug ingest: browser POSTs structured payloads; Railway captures stdout when enabled.
Set ENABLE_CLIENT_DEBUG_LOG=true on the backend service.
"""
import json
import logging
import os
from typing import Any, Dict

from fastapi import APIRouter, Body

router = APIRouter()
_logger = logging.getLogger(__name__)


@router.post("/debug/client-log")
async def client_debug_log(body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    flag = os.getenv("ENABLE_CLIENT_DEBUG_LOG", "").strip().lower()
    if flag not in ("1", "true", "yes", "on"):
        return {"ok": True, "logged": False}
    try:
        line = json.dumps(body, default=str, separators=(",", ":"))
        _logger.info("CLIENT_DEBUG %s", line)
    except Exception as e:
        _logger.warning("CLIENT_DEBUG log failed: %s", e)
    return {"ok": True, "logged": True}
