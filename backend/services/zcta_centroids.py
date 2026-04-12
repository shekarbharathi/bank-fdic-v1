"""
Load US Census 2020 ZCTA gazetteer centroids (INTPTLAT / INTPTLONG) for ZIP5 lookup.

USPS ZIP codes are matched to ZCTA GEOID (5-digit string, zero-padded). This is an approximation;
see docs/STATE_MAP_ZIP.md.
"""
from __future__ import annotations

import csv
import io
import logging
import os
import zipfile
from pathlib import Path
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Inside https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip
_ZIP_MEMBER_NAME = "2020_Gaz_zcta_national.txt"

Centroid = Tuple[float, float]


def normalize_zip5(raw) -> Optional[str]:
    """Return 5-digit ZCTA key or None if invalid."""
    if raw is None:
        return None
    if isinstance(raw, int):
        if raw < 0:
            return None
        s = str(raw)
        if len(s) > 5:
            s = s[:5]
        return s.zfill(5)
    s = str(raw).strip()
    if not s:
        return None
    part = s.split("-", 1)[0].strip()
    digits = "".join(c for c in part if c.isdigit())
    if not digits:
        return None
    if len(digits) <= 5:
        return digits.zfill(5)
    return digits[:5]


class ZctaCentroidService:
    """Lazy-loaded GEOID -> (lat, lon) from Census 2020 ZCTA gazetteer."""

    def __init__(self) -> None:
        self._centroids: Optional[Dict[str, Centroid]] = None
        self._loaded_from: Optional[str] = None

    def _default_path(self) -> Path:
        backend = Path(__file__).resolve().parent.parent
        return backend / "data" / "2020_Gaz_zcta_national.zip"

    def _resolve_path(self) -> Path:
        env = os.getenv("ZCTA_GAZETTEER_PATH", "").strip()
        if env:
            return Path(env).expanduser()
        return self._default_path()

    def _parse_tab_lines(self, lines: io.TextIOBase) -> Dict[str, Centroid]:
        reader = csv.reader(lines, delimiter="\t")
        try:
            header = next(reader)
        except StopIteration:
            return {}
        names = [(h or "").strip() for h in header]
        try:
            i_geoid = names.index("GEOID")
            i_lat = names.index("INTPTLAT")
            i_lon = names.index("INTPTLONG")
        except ValueError:
            logger.error("ZCTA gazetteer header missing GEOID/INTPTLAT/INTPTLONG: %s", names[:10])
            return {}
        out: Dict[str, Centroid] = {}
        for parts in reader:
            if i_geoid >= len(parts) or i_lat >= len(parts) or i_lon >= len(parts):
                continue
            geoid = (parts[i_geoid] or "").strip()
            z = normalize_zip5(geoid)
            if not z:
                continue
            lat_s = (parts[i_lat] or "").strip()
            lon_s = (parts[i_lon] or "").strip()
            try:
                lat = float(lat_s)
                lon = float(lon_s)
            except ValueError:
                continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            out[z] = (lat, lon)
        return out

    def _load_from_zip(self, path: Path) -> Dict[str, Centroid]:
        with zipfile.ZipFile(path, "r") as zf:
            try:
                data = zf.read(_ZIP_MEMBER_NAME)
            except KeyError:
                names = zf.namelist()
                logger.error("ZCTA zip missing %s; members: %s", _ZIP_MEMBER_NAME, names[:5])
                return {}
        text = data.decode("utf-8", errors="replace")
        return self._parse_tab_lines(io.StringIO(text))

    def _load_from_txt(self, path: Path) -> Dict[str, Centroid]:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            return self._parse_tab_lines(f)

    def ensure_loaded(self) -> None:
        if self._centroids is not None:
            return
        path = self._resolve_path()
        self._centroids = {}
        if not path.is_file():
            logger.warning(
                "ZCTA gazetteer not found at %s — set ZCTA_GAZETTEER_PATH or add %s (see backend/data/README.txt)",
                path,
                path.name,
            )
            self._loaded_from = None
            return
        try:
            if path.suffix.lower() == ".zip":
                self._centroids = self._load_from_zip(path)
            else:
                self._centroids = self._load_from_txt(path)
            self._loaded_from = str(path)
            logger.info("Loaded %s ZCTA centroids from %s", len(self._centroids), path)
        except OSError as e:
            logger.error("Failed to read ZCTA gazetteer %s: %s", path, e)
            self._centroids = {}

    def lookup_many(self, zips: list[str], cap: int = 500) -> Dict[str, Dict[str, float]]:
        """Return { zip5: { lat, lon } } for known ZCTAs only."""
        self.ensure_loaded()
        assert self._centroids is not None
        out: Dict[str, Dict[str, float]] = {}
        seen: set[str] = set()
        for raw in zips:
            if len(seen) >= cap:
                break
            z = normalize_zip5(raw)
            if not z or z in seen:
                continue
            seen.add(z)
            c = self._centroids.get(z)
            if c:
                lat, lon = c
                out[z] = {"lat": lat, "lon": lon}
        return out


zcta_service = ZctaCentroidService()
