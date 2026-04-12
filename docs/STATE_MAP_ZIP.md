# State map: USPS ZIP vs Census ZCTA

## What the map uses

Bank rows from FDIC include a **USPS ZIP** on `institutions.zip`. The single-state map prefers that value to place pins using **Census 2020 ZCTA (Zip Code Tabulation Area) internal points** (centroids) from the [Census gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html).

**ZCTA is not the same as USPS ZIP.** ZCTAs are statistical polygons that *approximate* delivery areas. PO Boxes, unique ZIPs, military/APO, and boundary quirks can differ. Product copy should describe placement as an **approximate ZIP (ZCTA) area** or similar—not “exact USPS boundary.”

## Resolution order for a pin

1. If the row has valid **latitude/longitude**, those are used (unchanged).
2. Else if **ZIP** normalizes to five digits and `POST /api/zcta/centroids` returns a centroid for that key, **lat/lon** from the gazetteer are used.
3. Else the UI falls back to the previous **deterministic hash inside the state bbox** (and **city-based** grouping label where applicable).

## Invalid or missing ZIP

- Non-numeric, too short, or empty ZIP → step 3.
- Valid ZIP with **no ZCTA row** (gazetteer miss, or data not loaded on the server) → step 3.

## Backend data file

The centroid table is loaded from `backend/data/2020_Gaz_zcta_national.zip` (or `.txt`) — see `backend/data/README.txt`. The zip is small enough to **commit to git** so hosts like Railway receive it on every deploy without a download step.

If the file is missing, the API returns empty centroids and the UI uses fallbacks only.

**Verify after deploy** (from the backend app directory, e.g. Railway root `backend`):

`python scripts/verify_zcta_gazetteer.py`

No separate “install” runs at boot: the service reads the zip the first time `POST /api/zcta/centroids` is used (or when the verify script runs).

Environment:

- **`ZCTA_GAZETTEER_PATH`** — optional path to the `.zip` or `.txt` gazetteer.
- **`ZCTA_API_MAX_ZIPS`** — optional cap on batch size (default 500).

## SQL / API rows

`state_explorer` / `state_overview` institution lists and state-filtered `browse_table` queries should **SELECT `i.zip`** so the frontend can request centroids. Other columns are unchanged; `zip` is not altered by `response_formatter` (it is not a dollar column).
