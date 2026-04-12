"""
ZCTA centroid lookup for state-map pin placement (Census 2020 gazetteer).
"""
import os
import sys

if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter
from pydantic import BaseModel, Field

try:
    from services.zcta_centroids import zcta_service
except ImportError:
    from backend.services.zcta_centroids import zcta_service

router = APIRouter()

_MAX_ZIPS = int(os.getenv("ZCTA_API_MAX_ZIPS", "500"))


class ZctaCentroidsRequest(BaseModel):
    zips: list[str] = Field(default_factory=list, description="ZIP or ZCTA strings (5-digit after normalization)")


@router.post("/zcta/centroids")
async def post_zcta_centroids(body: ZctaCentroidsRequest):
    """
    Batch-resolve 5-digit USPS/ZCTA keys to approximate centroid lat/lon (Census ZCTA internal point).
    Unknown or invalid codes are omitted from the response.
    """
    zips = body.zips if isinstance(body.zips, list) else []
    centroids = zcta_service.lookup_many(zips, cap=_MAX_ZIPS)
    return {"centroids": centroids}
