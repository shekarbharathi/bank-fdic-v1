#!/usr/bin/env python3
"""
Verify the Census 2020 ZCTA gazetteer zip is present and parses (~33k rows).

Run from the backend service root (Railway Root Directory = backend):

  python scripts/verify_zcta_gazetteer.py

Exit code 0 if OK, 1 if missing or clearly broken.
"""
import os
import sys

# Run as `python scripts/verify_zcta_gazetteer.py` from backend/ (Railway root).
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)


def main() -> int:
    from services.zcta_centroids import zcta_service

    path = zcta_service._resolve_path()
    print(f"Expected gazetteer path: {path}")
    if not path.is_file():
        print(
            "ERROR: File not found. Add backend/data/2020_Gaz_zcta_national.zip "
            "(see backend/data/README.txt) and redeploy.",
            file=sys.stderr,
        )
        return 1

    zcta_service.ensure_loaded()
    n = len(zcta_service._centroids or {})
    print(f"Loaded ZCTA centroid rows: {n}")
    if n < 10_000:
        print(
            "ERROR: Expected on the order of 33,000 rows; check file integrity.",
            file=sys.stderr,
        )
        return 1

    sample = zcta_service.lookup_many(["90210", "00601"])
    if "90210" not in sample or "00601" not in sample:
        print("ERROR: Spot-check lookups failed.", file=sys.stderr)
        return 1
    print("Spot-check OK (90210, 00601):", sample)
    print("ZCTA gazetteer setup OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
