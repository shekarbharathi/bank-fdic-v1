"""
Full FDIC financial ingestion into dictionary + long-form table.

Usage:
    python3 backend/fdic_full_ingestion.py

Notes:
- Designed for Railway/Postgres.
- Keeps existing curated financials table untouched.
- Ingests full FDIC field set into financials_kv for scalable querying.

Environment:
- FDIC_MIN_REPDTE: earliest report date to fetch (YYYY-MM-DD). Default 2001-01-01.
- FDIC_MAX_LOOKBACK_YEARS: if set (e.g. 2), never fetch older than today minus N years
  (uses max(FDIC_MIN_REPDTE, today-N years)). Recommended for disk limits.
- After that, dates are still capped by enforce_ten_year_lookback (max 10 years).
"""

from __future__ import annotations

import csv
import os
import time
from datetime import date
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
from urllib.request import urlopen

import psycopg2
from psycopg2 import OperationalError, InterfaceError
from psycopg2.extras import execute_values
import yaml

try:
    from fdic_to_postgres import FDICAPIClient
except ImportError:
    from backend.fdic_to_postgres import FDICAPIClient


YAML_URL = "https://api.fdic.gov/banks/docs/risview_properties.yaml"
CATALOG_PATH = Path(__file__).resolve().parents[1] / "docs" / "data" / "fdic_field_reference.csv"
CHUNK_SIZE = 120
WRITE_BATCH_SIZE = int(os.getenv("FDIC_WRITE_BATCH_SIZE", "20000"))
DB_MAX_RETRIES = int(os.getenv("FDIC_DB_MAX_RETRIES", "5"))
DB_RETRY_SLEEP_SEC = float(os.getenv("FDIC_DB_RETRY_SLEEP_SEC", "2.0"))


def build_db_connection_from_env() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        # psycopg2 supports URL form directly
        return database_url

    db_name = os.getenv("PGDATABASE") or os.getenv("DB_NAME", "")
    db_user = os.getenv("PGUSER") or os.getenv("DB_USER", "")
    db_password = os.getenv("PGPASSWORD") or os.getenv("DB_PASSWORD", "")
    db_host = os.getenv("PGHOST") or os.getenv("DB_HOST", "")
    db_port = os.getenv("PGPORT") or os.getenv("DB_PORT", "5432")
    if not all([db_name, db_user, db_host]):
        raise ValueError("Missing database connection environment variables.")
    return (
        f"dbname={db_name} user={db_user} password={db_password} "
        f"host={db_host} port={db_port}"
    )


def load_field_dictionary_records() -> List[Dict[str, str]]:
    if CATALOG_PATH.exists():
        with CATALOG_PATH.open("r", encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))

    # Fallback to YAML only
    payload = yaml.safe_load(urlopen(YAML_URL, timeout=90).read().decode("utf-8"))
    props = payload["properties"]["data"]["properties"]
    rows = []
    for field, meta in props.items():
        rows.append(
            {
                "field_name": field,
                "source_title": str(meta.get("title") or ""),
                "source_definition": str(meta.get("description") or ""),
                "data_type": str(meta.get("type") or "unknown"),
                "call_report_line": "unknown",
            }
        )
    return rows


def chunked(items: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def ensure_migration_applied(conn_string: str) -> None:
    sql_path = Path(__file__).resolve().parent / "migrations" / "0002_fdic_full_field_model.sql"
    sql = sql_path.read_text(encoding="utf-8")
    with psycopg2.connect(conn_string) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()


def _connect(conn_string: str):
    return psycopg2.connect(
        conn_string,
        connect_timeout=20,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


def date_years_ago(years: int) -> date:
    """Calendar-based N years before today (handles Feb 29)."""
    today = date.today()
    try:
        return today.replace(year=today.year - years)
    except ValueError:
        return today.replace(month=2, day=28, year=today.year - years)


def resolve_requested_min_repdte() -> str:
    """
    Combine FDIC_MIN_REPDTE with optional FDIC_MAX_LOOKBACK_YEARS.
    Example: MAX_LOOKBACK_YEARS=2 with MIN=2001-01-01 -> ~2 years ago.
    """
    raw = os.getenv("FDIC_MIN_REPDTE", "2001-01-01").strip()
    max_years_str = os.getenv("FDIC_MAX_LOOKBACK_YEARS", "").strip()
    if not max_years_str:
        return raw
    try:
        n = int(max_years_str)
    except ValueError:
        raise ValueError(f"FDIC_MAX_LOOKBACK_YEARS must be an integer, got {max_years_str!r}") from None
    if n < 0:
        raise ValueError("FDIC_MAX_LOOKBACK_YEARS must be non-negative")
    floor = date_years_ago(n)
    try:
        requested = date.fromisoformat(raw)
    except Exception:
        requested = floor
    effective = max(requested, floor)
    if effective.isoformat() != raw:
        print(
            f"[info] FDIC_MAX_LOOKBACK_YEARS={n} -> earliest ingest date {effective.isoformat()} "
            f"(max of FDIC_MIN_REPDTE and {n}y floor)"
        )
    return effective.isoformat()


def enforce_ten_year_lookback(min_repdte: str) -> str:
    """
    Clamp min report date to no older than 10 years from today.
    If parsing fails, fallback to the 10-year cutoff.
    """
    today = date.today()
    try:
        ten_year_cutoff = today.replace(year=today.year - 10)
    except ValueError:
        # Leap-day fallback (e.g., Feb 29 -> Feb 28)
        ten_year_cutoff = today.replace(month=2, day=28, year=today.year - 10)

    try:
        requested = date.fromisoformat(min_repdte)
    except Exception:
        return ten_year_cutoff.isoformat()

    if requested < ten_year_cutoff:
        return ten_year_cutoff.isoformat()
    return requested.isoformat()


def _upsert_values_with_retry(conn_string: str, values: List[Tuple]) -> None:
    for attempt in range(1, DB_MAX_RETRIES + 1):
        try:
            with _connect(conn_string) as conn:
                with conn.cursor() as cur:
                    execute_values(
                        cur,
                        """
                        INSERT INTO financials_kv (
                            cert, repdte, field_name, value_num, value_text, source_row_updated_at
                        ) VALUES %s
                        ON CONFLICT (cert, repdte, field_name) DO UPDATE SET
                            value_num = EXCLUDED.value_num,
                            value_text = EXCLUDED.value_text,
                            source_row_updated_at = EXCLUDED.source_row_updated_at,
                            updated_at = CURRENT_TIMESTAMP
                        """,
                        values,
                        page_size=2000,
                    )
                conn.commit()
            return
        except (OperationalError, InterfaceError) as exc:
            if attempt >= DB_MAX_RETRIES:
                raise
            sleep_seconds = DB_RETRY_SLEEP_SEC * attempt
            print(
                f"[warn] DB write failed (attempt {attempt}/{DB_MAX_RETRIES}): {exc}. "
                f"Retrying in {sleep_seconds:.1f}s..."
            )
            time.sleep(sleep_seconds)


def upsert_field_dictionary(conn_string: str, records: List[Dict[str, str]]) -> None:
    sql = """
    INSERT INTO fdic_field_dictionary (field_name, title, description, data_type, call_report_line)
    VALUES %s
    ON CONFLICT (field_name) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        data_type = EXCLUDED.data_type,
        call_report_line = EXCLUDED.call_report_line,
        updated_at = CURRENT_TIMESTAMP
    """
    values = []
    for row in records:
        values.append(
            (
                (row.get("field_name") or "").upper(),
                row.get("source_title") or row.get("title") or "",
                row.get("source_definition") or row.get("description") or "",
                row.get("data_type") or "unknown",
                row.get("call_report_line") or "unknown",
            )
        )
    with _connect(conn_string) as conn:
        with conn.cursor() as cur:
            execute_values(cur, sql, values, page_size=1000)
        conn.commit()


def to_numeric_or_text(value) -> Tuple[float, str]:
    if value is None:
        return None, None
    if isinstance(value, (int, float)):
        return float(value), None
    sval = str(value).strip()
    if sval == "":
        return None, None
    try:
        return float(sval), None
    except Exception:
        return None, sval


def ingest_financials_kv(
    conn_string: str,
    api_key: str,
    min_repdte: str = "2001-01-01",
) -> None:
    client = FDICAPIClient(api_key=api_key or None)
    dictionary_rows = load_field_dictionary_records()
    all_fields = sorted({row["field_name"].upper() for row in dictionary_rows if row.get("field_name")})

    id_fields = ["CERT", "REPDTE"]
    field_chunks = list(chunked([f for f in all_fields if f not in set(id_fields)], CHUNK_SIZE))
    chunk_start = int(os.getenv("FDIC_FIELD_CHUNK_START", "0"))
    chunk_end = int(os.getenv("FDIC_FIELD_CHUNK_END", str(len(field_chunks))))

    for chunk_idx, fields in enumerate(field_chunks):
        if chunk_idx < chunk_start or chunk_idx >= chunk_end:
            continue
        print(f"[info] Processing field chunk {chunk_idx + 1}/{len(field_chunks)}")
        query_fields = ",".join(id_fields + fields)
        rows = client.get_financials(
            filters=f"REPDTE:[{min_repdte} TO *]",
            fields=query_fields,
        )

        values = []
        for row in rows:
            data = row.get("data", {})
            cert = data.get("CERT")
            repdte = data.get("REPDTE")
            if not cert or not repdte:
                continue

            for field_name in fields:
                raw_val = data.get(field_name)
                num_val, text_val = to_numeric_or_text(raw_val)
                if num_val is None and text_val is None:
                    continue
                values.append(
                    (
                        cert,
                        repdte,
                        field_name,
                        num_val,
                        text_val,
                        date.today().isoformat(),
                    )
                )

        if not values:
            continue

        for i in range(0, len(values), WRITE_BATCH_SIZE):
            batch = values[i : i + WRITE_BATCH_SIZE]
            _upsert_values_with_retry(conn_string, batch)
            print(
                f"[info] Wrote {min(i + WRITE_BATCH_SIZE, len(values))}/{len(values)} "
                f"rows for chunk {chunk_idx + 1}"
            )


def main() -> None:
    conn_string = build_db_connection_from_env()
    api_key = os.getenv("FDIC_API_KEY", "")
    requested_min_repdte = resolve_requested_min_repdte()
    min_repdte = enforce_ten_year_lookback(requested_min_repdte)
    if min_repdte != requested_min_repdte:
        print(
            f"[info] After 10-year cap: using start date {min_repdte} "
            f"(was {requested_min_repdte})"
        )

    ensure_migration_applied(conn_string)
    records = load_field_dictionary_records()
    upsert_field_dictionary(conn_string, records)
    ingest_financials_kv(conn_string, api_key=api_key, min_repdte=min_repdte)
    print("Full FDIC ingestion completed.")


if __name__ == "__main__":
    main()

