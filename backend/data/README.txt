ZCTA gazetteer (state map ZIP placement)
=======================================

The API `POST /api/zcta/centroids` loads Census **2020 ZCTA** internal points from:

  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip

Default expected path (relative to the backend package):

  backend/data/2020_Gaz_zcta_national.zip

This zip is safe to **commit in git** (~1 MB) so Railway deploys include it with no extra build step.

Download (from repo root) if you do not have the file yet:

  curl -sL -o backend/data/2020_Gaz_zcta_national.zip \
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gaz_zcta_national.zip"

  git add backend/data/2020_Gaz_zcta_national.zip && git commit -m "Add ZCTA gazetteer for map centroids"

After deploy, verify on the backend (Railway: set service **Root Directory** to `backend`, then run):

  python scripts/verify_zcta_gazetteer.py

The API loads this file lazily on first use; the script only checks that the file is present and readable.

Or set `ZCTA_GAZETTEER_PATH` to a `.zip` or unpacked `.txt` file elsewhere.

See docs/STATE_MAP_ZIP.md for USPS ZIP vs ZCTA and fallback behavior.
