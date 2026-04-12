ZCTA gazetteer (state map ZIP placement)
=======================================

The API `POST /api/zcta/centroids` loads Census **2020 ZCTA** internal points from:

  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip

Default expected path (relative to the backend package):

  backend/data/2020_Gaz_zcta_national.zip

Download (from repo root):

  curl -sL -o backend/data/2020_Gaz_zcta_national.zip \
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip"

Or set `ZCTA_GAZETTEER_PATH` to a `.zip` or unpacked `.txt` file.

See docs/STATE_MAP_ZIP.md for USPS ZIP vs ZCTA and fallback behavior.
