"""
Optimized FDIC financial ingestion for 500MB target.

- 35 fields organized in 8 groups
- ACTIVE:1 filter (~4.5K banks)
- 5-year time window (20 quarters)
- Replaces financials table with optimized schema

Usage:
    FDIC_MAX_LOOKBACK_YEARS=5 python3 backend/fdic_optimized_ingestion.py

Railway (storage-neutral refresh):
    FDIC_PRUNE_ON_INGEST=true FDIC_INGEST_MIN_REPDTE=2026-01-01 railway run python railway_data_ingestion.py

See docs/RAILWAY_DATA_REFRESH.md for env vars (including FDIC_DROP_FINANCIALS_KV when disk is tight).
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


def _env_truthy(name: str, default: str = "true") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def retention_cutoff_date() -> date:
    """Oldest report date to keep in Postgres (aligned with ingest window)."""
    return date.today() - timedelta(days=365 * LOOKBACK_YEARS)


def retention_cutoff_iso() -> str:
    return retention_cutoff_date().isoformat()


def resolve_fetch_cutoff_iso() -> str:
    """
    Lower bound for FDIC API REPDTE filter.
    Defaults to retention window; FDIC_INGEST_MIN_REPDTE can narrow the fetch (e.g. only new quarters).
    """
    floor = retention_cutoff_iso()
    override = (os.getenv("FDIC_INGEST_MIN_REPDTE") or "").strip()
    if not override:
        return floor
    try:
        requested = date.fromisoformat(override)
    except ValueError:
        print(f"[warn] Invalid FDIC_INGEST_MIN_REPDTE={override!r}; using {floor}")
        return floor
    effective = max(requested, date.fromisoformat(floor))
    if effective.isoformat() != override:
        print(
            f"[info] FDIC_INGEST_MIN_REPDTE raised to {effective.isoformat()} "
            f"(within {LOOKBACK_YEARS}y retention floor {floor})"
        )
    return effective.isoformat()

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
    try:
        from db_env import resolve_database_url
    except ImportError:
        from backend.db_env import resolve_database_url
    return resolve_database_url()


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
    migrations_dir = Path(__file__).resolve().parent / "migrations"
    with psycopg2.connect(conn_string) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financials'"
            )
            financials_exists = cur.fetchone() is not None

        if not financials_exists:
            sql_path = migrations_dir / "0003_optimized_financials.sql"
            with conn.cursor() as cur:
                cur.execute(sql_path.read_text(encoding="utf-8"))
            conn.commit()
            print("[info] Migration 0003 applied.")

        sql_path = migrations_dir / "0004_fix_numeric_overflow.sql"
        if sql_path.exists():
            with conn.cursor() as cur:
                cur.execute(sql_path.read_text(encoding="utf-8"))
            conn.commit()
            print("[info] Migration 0004 applied.")


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


def read_financials_repdte_bounds(conn_string: str) -> tuple[Optional[str], Optional[str], int]:
    with psycopg2.connect(conn_string) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT MIN(repdte)::text, MAX(repdte)::text, COUNT(*)::bigint FROM financials"
            )
            row = cur.fetchone()
    if not row or row[2] == 0:
        return None, None, 0
    return row[0], row[1], int(row[2])


def prune_historical_data(conn_string: str, cutoff_iso: str) -> dict:
    """
    Delete rows older than cutoff to keep storage flat when new quarters are loaded.
    Controlled by FDIC_PRUNE_ON_INGEST (default true).
    """
    stats: dict = {"cutoff": cutoff_iso}
    drop_kv = _env_truthy("FDIC_DROP_FINANCIALS_KV", "false")
    prune_kv = _env_truthy("FDIC_PRUNE_FINANCIALS_KV", "true")

    with psycopg2.connect(conn_string) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'financials_kv'
                """
            )
            has_kv = cur.fetchone() is not None

            if drop_kv and has_kv:
                cur.execute("DROP TABLE IF EXISTS financials_kv CASCADE")
                stats["financials_kv_dropped"] = True
                has_kv = False

            cur.execute("DELETE FROM financials WHERE repdte < %s", (cutoff_iso,))
            stats["financials_deleted"] = cur.rowcount

            if has_kv and prune_kv:
                cur.execute("DELETE FROM financials_kv WHERE repdte < %s", (cutoff_iso,))
                stats["financials_kv_deleted"] = cur.rowcount

        conn.commit()

    if _env_truthy("FDIC_VACUUM_AFTER_PRUNE", "true"):
        vacuum_allowlist(conn_string, ["financials"] + (["financials_kv"] if not drop_kv else []))

    return stats


def vacuum_allowlist(conn_string: str, tables: List[str]) -> None:
    import psycopg2.extensions

    allowed = {"financials", "financials_kv", "institutions"}
    to_vacuum = [t for t in tables if t in allowed]
    if not to_vacuum:
        return
    conn = psycopg2.connect(conn_string)
    try:
        conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
        with conn.cursor() as cur:
            for table in to_vacuum:
                cur.execute(f"VACUUM ANALYZE {table}")
        print(f"[info] VACUUM ANALYZE completed for: {', '.join(to_vacuum)}")
    finally:
        conn.close()


def ingest(conn_string: str, api_key: Optional[str] = None) -> None:
    cutoff = resolve_fetch_cutoff_iso()
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


def run_refresh(conn_string: Optional[str] = None, api_key: Optional[str] = None) -> dict:
    """Prune (optional), refresh institutions + financials; return summary for operators."""
    conn_string = conn_string or build_db_connection()
    api_key = api_key if api_key is not None else (os.getenv("FDIC_API_KEY") or None)
    ensure_migration(conn_string)

    min_before, max_before, count_before = read_financials_repdte_bounds(conn_string)
    print(f"[info] financials before: rows={count_before} min_repdte={min_before} max_repdte={max_before}")

    prune_stats: dict = {}
    retention = retention_cutoff_iso()
    if _env_truthy("FDIC_PRUNE_ON_INGEST", "true"):
        print(f"[info] Pruning data with repdte < {retention} (FDIC_MAX_LOOKBACK_YEARS={LOOKBACK_YEARS})")
        prune_stats = prune_historical_data(conn_string, retention)
        print(f"[info] Prune result: {prune_stats}")
    else:
        print("[info] FDIC_PRUNE_ON_INGEST=false; skipping delete (storage may grow)")

    ingest_institutions(conn_string, api_key=api_key)
    ingest(conn_string, api_key=api_key)

    min_after, max_after, count_after = read_financials_repdte_bounds(conn_string)
    print(f"[info] financials after: rows={count_after} min_repdte={min_after} max_repdte={max_after}")

    return {
        "retention_cutoff": retention,
        "fetch_cutoff": resolve_fetch_cutoff_iso(),
        "lookback_years": LOOKBACK_YEARS,
        "before": {"min_repdte": min_before, "max_repdte": max_before, "row_count": count_before},
        "after": {"min_repdte": min_after, "max_repdte": max_after, "row_count": count_after},
        "prune": prune_stats,
    }


def main() -> None:
    try:
        run_refresh()
    except RuntimeError as exc:
        print(f"[error] {exc}")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
