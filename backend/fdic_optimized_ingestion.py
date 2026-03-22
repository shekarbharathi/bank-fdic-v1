"""
Optimized FDIC financial ingestion for 500MB target.

- 35 fields organized in 8 groups
- ACTIVE:1 filter (~4.5K banks)
- 5-year time window (20 quarters)
- Replaces financials table with optimized schema

Usage:
    FDIC_MAX_LOOKBACK_YEARS=5 python3 backend/fdic_optimized_ingestion.py
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import execute_values

try:
    from fdic_to_postgres import FDICAPIClient
except ImportError:
    from backend.fdic_to_postgres import FDICAPIClient


LOOKBACK_YEARS = int(os.getenv("FDIC_MAX_LOOKBACK_YEARS", "5"))
WRITE_BATCH_SIZE = int(os.getenv("FDIC_WRITE_BATCH_SIZE", "5000"))

# FDIC API field codes; some have fallbacks if primary not available
FIELD_GROUPS = {
    "identifiers": ["CERT", "REPDTE"],
    "size_balance_sheet": ["ASSET", "DEP", "DEPDOM", "EQTOT", "LNLSNET", "EARNA", "ILNDOM", "CHBAL"],
    "deposits": ["DPMMD", "DPSAV", "P6631", "P2215"],
    "loans": ["LNCRCD", "LNRE", "LNCI", "LNRESRE"],
    "income": ["INTINC", "EINTEXP", "NONII", "NONIX", "NETINC", "SC"],
    "profitability": ["ROA", "ROAPTX", "NIMY"],
    "safety": ["ELNATR", "EQ", "RBCT1", "RWAJ", "LNATRES"],
    "operations": ["NUMEMP", "OFFDOM"],
}

# Map FDIC response keys -> DB column; try fallback if primary missing
FDIC_TO_DB: Dict[str, List[str]] = {
    "asset": ["ASSET"],
    "dep": ["DEP"],
    "depdom": ["DEPDOM"],
    "eqtot": ["EQTOT"],
    "lnlsnet": ["LNLSNET"],
    "earna": ["EARNA", "ERNAST", "ERNAST5"],
    "ilndom": ["ILNDOM"],
    "chbal": ["CHBAL"],
    "dpmmd": ["DPMMD", "NTRSMMDA"],
    "dpsav": ["DPSAV", "NTRSOTH"],
    "brttrans": ["P6631", "BRTTRANS", "TRN"],
    "p2215": ["P2215"],
    "lncrcd": ["LNCRCD"],
    "lnre": ["LNRE"],
    "lnci": ["LNCI"],
    "lnresre": ["LNRESRE"],
    "intinc": ["INTINC"],
    "intexp": ["EINTEXP", "INTEXP"],
    "nonii": ["NONII"],
    "nonix": ["NONIX"],
    "netinc": ["NETINC"],
    "sc": ["SC"],
    "roa": ["ROA"],
    "roaptx": ["ROAPTX"],
    "nimy": ["NIMY"],
    "elnatr": ["ELNATR"],
    "eq": ["EQ"],
    "rbct": ["RBCT1", "RBCT"],
    "rbcrwaj": ["RWAJ", "RBCRWAJ"],
    "lnatres": ["LNATRES"],
    "numemp": ["NUMEMP"],
    "offdom": ["OFFDOM"],
}

DB_COLUMNS = [
    "cert", "repdte",
    "asset", "dep", "depdom", "eqtot", "lnlsnet", "earna", "ilndom", "chbal",
    "dpmmd", "dpsav", "brttrans", "p2215",
    "lncrcd", "lnre", "lnci", "lnresre",
    "intinc", "intexp", "nonii", "nonix", "netinc", "sc",
    "roa", "roaptx", "nimy",
    "elnatr", "eq", "rbct", "rbcrwaj", "lnatres",
    "numemp", "offdom",
]


def build_db_connection() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        return url
    return (
        f"dbname={os.getenv('DB_NAME', 'fdic')} "
        f"user={os.getenv('DB_USER', 'postgres')} "
        f"password={os.getenv('DB_PASSWORD', '')} "
        f"host={os.getenv('DB_HOST', 'localhost')} "
        f"port={os.getenv('DB_PORT', '5432')}"
    )


def _get_val(data: Dict[str, Any], db_col: str):
    """Get value from API data, trying FDIC code fallbacks."""
    for code in FDIC_TO_DB.get(db_col, [db_col.upper()]):
        v = data.get(code)
        if v is not None and v != "":
            return v
    return None


def _to_int(v) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def _to_num(v) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def ensure_migration(conn_string: str) -> None:
    sql_path = Path(__file__).resolve().parent / "migrations" / "0003_optimized_financials.sql"
    with psycopg2.connect(conn_string) as conn:
        with conn.cursor() as cur:
            cur.execute(sql_path.read_text(encoding="utf-8"))
        conn.commit()
    print("[info] Migration 0003 applied.")


def build_fields_string() -> str:
    """Build FDIC API fields string, including fallbacks for fields that may use alternate codes."""
    seen = set()
    codes = []
    for group in FIELD_GROUPS.values():
        for c in group:
            if c not in seen:
                seen.add(c)
                codes.append(c)
    # Add fallback codes FDIC might use (API returns what it has; extras ignored)
    fallbacks = ["NTRSMMDA", "NTRSOTH", "BRTTRANS", "TRN", "INTEXP", "ERNAST", "ERNAST5", "RBCT", "RBCRWAJ"]
    for c in fallbacks:
        if c not in seen:
            seen.add(c)
            codes.append(c)
    return ",".join(codes)


def ingest(conn_string: str, api_key: Optional[str] = None) -> None:
    cutoff = (date.today() - timedelta(days=365 * LOOKBACK_YEARS)).strftime("%Y-%m-%d")
    filters = f"ACTIVE:1 AND REPDTE:[{cutoff} TO *]"
    fields = build_fields_string()

    print(f"[info] Fetching financials: ACTIVE:1, REPDTE>={cutoff}, {len(fields.split(','))} fields")
    client = FDICAPIClient(api_key=api_key)
    rows = client.get_financials(filters=filters, fields=fields)

    values = []
    for row in rows:
        d = row.get("data", {})
        cert = _to_int(d.get("CERT"))
        repdte_raw = d.get("REPDTE")
        if not cert or not repdte_raw:
            continue
        repdte = repdte_raw[:10] if isinstance(repdte_raw, str) else str(repdte_raw)[:10]

        tuple_row = (cert, repdte)
        for col in DB_COLUMNS[2:]:
            raw = _get_val(d, col)
            if col in ("roa", "roaptx", "nimy", "elnatr", "eq"):
                tuple_row += (_to_num(raw),)
            elif col in ("numemp", "offdom"):
                tuple_row += (_to_int(raw),)
            else:
                tuple_row += (_to_int(raw),)
        values.append(tuple_row)

    if not values:
        print("[warn] No rows to insert.")
        return

    cols = ", ".join(DB_COLUMNS)
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in DB_COLUMNS[2:])
    sql = f"""
    INSERT INTO financials ({cols})
    VALUES %s
    ON CONFLICT (cert, repdte) DO UPDATE SET
        {updates},
        updated_at = CURRENT_TIMESTAMP
    """

    with psycopg2.connect(conn_string) as conn:
        for i in range(0, len(values), WRITE_BATCH_SIZE):
            batch = values[i : i + WRITE_BATCH_SIZE]
            with conn.cursor() as cur:
                execute_values(cur, sql, batch, page_size=500)
            conn.commit()
            print(f"[info] Upserted {min(i + WRITE_BATCH_SIZE, len(values))}/{len(values)} rows")

    print(f"[info] Ingestion complete: {len(values)} financial records.")


def ingest_institutions(conn_string: str, api_key: Optional[str] = None) -> None:
    """Fetch ACTIVE:1 institutions for join consistency."""
    filters = "ACTIVE:1"
    fields = "CERT,NAME,CITY,STALP,STNAME,ZIP,ASSET,DEP,DEPDOM,BKCLASS,CHARTER,DATEUPDT,ACTIVE,FED_RSSD"
    client = FDICAPIClient(api_key=api_key)
    rows = client.get_institutions(filters=filters, fields=fields)
    if not rows:
        print("[warn] No institutions fetched.")
        return
    values = []
    for row in rows:
        d = row.get("data", {})
        values.append((
            _to_int(d.get("CERT")),
            d.get("NAME"),
            d.get("CITY"),
            d.get("STALP"),
            d.get("STNAME"),
            d.get("ZIP"),
            _to_int(d.get("ASSET")),
            _to_int(d.get("DEP")),
            _to_int(d.get("DEPDOM")),
            d.get("BKCLASS"),
            d.get("CHARTER"),
            d.get("DATEUPDT"),
            _to_int(d.get("ACTIVE")),
            _to_int(d.get("FED_RSSD")),
        ))
    sql = """
    INSERT INTO institutions (cert, name, city, stalp, stname, zip, asset, dep, depdom, bkclass, charter, dateupdt, active, fed_rssd)
    VALUES %s
    ON CONFLICT (cert) DO UPDATE SET name=EXCLUDED.name, city=EXCLUDED.city, stalp=EXCLUDED.stalp, stname=EXCLUDED.stname,
        zip=EXCLUDED.zip, asset=EXCLUDED.asset, dep=EXCLUDED.dep, depdom=EXCLUDED.depdom,
        bkclass=EXCLUDED.bkclass, charter=EXCLUDED.charter, dateupdt=EXCLUDED.dateupdt,
        active=EXCLUDED.active, fed_rssd=EXCLUDED.fed_rssd
    """
    with psycopg2.connect(conn_string) as conn:
        with conn.cursor() as cur:
            execute_values(cur, sql, values, page_size=1000)
        conn.commit()
    print(f"[info] Upserted {len(values)} institutions (ACTIVE:1).")


if __name__ == "__main__":
    main()
