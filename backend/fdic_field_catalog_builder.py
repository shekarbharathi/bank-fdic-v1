"""
Build FDIC field catalog and prioritization artifacts.

Outputs:
1) docs/data/fdic_field_reference.csv
2) docs/fdic_field_recommendations.md
"""

from __future__ import annotations

import ast
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple
from urllib.request import urlopen

import pandas as pd
import yaml


YAML_URL = "https://api.fdic.gov/banks/docs/risview_properties.yaml"
XLSX_URL = "https://api.fdic.gov/banks/docs/All%20Financial%20Reports.xlsx"


@dataclass(frozen=True)
class MetricMapping:
    metric: str
    primary_field: str
    alternates: List[str]
    rationale: str


METRIC_MAPPINGS: List[MetricMapping] = [
    MetricMapping(
        metric="Credit card loans",
        primary_field="LNCRCD",
        alternates=["LNCRCDR", "NTCRCD", "P3CRCD", "P9CRCD", "NACRCD", "NCCRCD"],
        rationale=(
            "LNCRCD is the direct stock measure for consumer credit card plan loans. "
            "Alternates capture ratio, net charge-offs, delinquency, and noncurrent views."
        ),
    ),
    MetricMapping(
        metric="Money market deposit accounts",
        primary_field="NTRSMMDA",
        alternates=["NTRSMMDAR", "DEPDOM", "DEP"],
        rationale=(
            "NTRSMMDA explicitly maps to savings MMDA balances. "
            "DEPDOM/DEP are aggregate deposit totals if MMDA-only data is unavailable."
        ),
    ),
    MetricMapping(
        metric="Other savings (excluding MMDAs)",
        primary_field="NTRSOTH",
        alternates=["NTRSOTHR", "NTR", "DEPDOM"],
        rationale=(
            "NTRSOTH is the direct non-MMDA savings bucket under nontransaction accounts."
        ),
    ),
    MetricMapping(
        metric="Domestic Transaction Accounts",
        primary_field="TRN",
        alternates=["DDT", "TRNIPC", "TRNIPCOC"],
        rationale=(
            "TRN is the transaction-account total. DDT is demand deposits (subset); "
            "TRNIPC/TRNIPCOC are ownership/category breakouts."
        ),
    ),
    MetricMapping(
        metric="Transaction Accounts: IPC including Checks",
        primary_field="TRNIPCOC",
        alternates=["TRNIPC", "DEPIPCCF"],
        rationale=(
            "TRNIPCOC explicitly includes official checks within IPC transaction accounts."
        ),
    ),
    MetricMapping(
        metric="Total Interest Income",
        primary_field="INTINC",
        alternates=["INTINQ", "INTINCR", "ILNDOM", "ILNFOR", "ICHBAL", "ISC", "IFREPO", "IOTHII"],
        rationale=(
            "INTINC is the direct total interest income measure; alternates are quarterly/ratio "
            "variants and major component lines."
        ),
    ),
    MetricMapping(
        metric="Yield on earning assets",
        primary_field="INTINCY",
        alternates=["INTINCYQ", "NIMY", "NIM", "ERNAST5"],
        rationale=(
            "INTINCY is the direct annualized interest-income-to-earning-assets yield proxy."
        ),
    ),
    MetricMapping(
        metric="Cost of funding earning assets",
        primary_field="INTEXPY",
        alternates=["INTEXPYQ", "EINTEXP", "NIMY"],
        rationale=(
            "INTEXPY/INTEXPYQ are explicit cost-of-funding-to-earning-assets ratios."
        ),
    ),
]


RECOMMENDED_FIELDS: List[Tuple[str, str]] = [
    ("INTINC", "Profitability/Margin"),
    ("INTINQ", "Profitability/Margin"),
    ("EINTEXP", "Profitability/Margin"),
    ("EINTXQ", "Profitability/Margin"),
    ("NONII", "Profitability/Margin"),
    ("NONIX", "Profitability/Margin"),
    ("IBEFTAX", "Profitability/Margin"),
    ("PTAXNETINC", "Profitability/Margin"),
    ("NETIMIN", "Profitability/Margin"),
    ("ROE", "Profitability/Margin"),
    ("INTINCY", "Profitability/Margin"),
    ("INTEXPY", "Profitability/Margin"),
    ("ERNAST", "Profitability/Margin"),
    ("ERNAST5", "Profitability/Margin"),
    ("NIM", "Profitability/Margin"),
    ("DDT", "Funding/Deposits"),
    ("TRN", "Funding/Deposits"),
    ("TRNIPC", "Funding/Deposits"),
    ("TRNIPCOC", "Funding/Deposits"),
    ("NTR", "Funding/Deposits"),
    ("NTRIPC", "Funding/Deposits"),
    ("NTRSMMDA", "Funding/Deposits"),
    ("NTRSOTH", "Funding/Deposits"),
    ("DEPINS", "Funding/Deposits"),
    ("DEPUNINS", "Funding/Deposits"),
    ("DEPI", "Funding/Deposits"),
    ("DEPNI", "Funding/Deposits"),
    ("DEPFOR", "Funding/Deposits"),
    ("LNLS", "Asset Mix/Credit"),
    ("LNLSGR", "Asset Mix/Credit"),
    ("LNRE", "Asset Mix/Credit"),
    ("LNRERES", "Asset Mix/Credit"),
    ("LNREMULT", "Asset Mix/Credit"),
    ("LNRENRES", "Asset Mix/Credit"),
    ("LNRECONS", "Asset Mix/Credit"),
    ("LNREAG", "Asset Mix/Credit"),
    ("LNCI", "Asset Mix/Credit"),
    ("LNCON", "Asset Mix/Credit"),
    ("LNAUTO", "Asset Mix/Credit"),
    ("LNCRCD", "Asset Mix/Credit"),
    ("LNCOMRE", "Asset Mix/Credit"),
    ("LNMUNI", "Asset Mix/Credit"),
    ("LNSOTHER", "Asset Mix/Credit"),
    ("NALNLS", "Asset Quality"),
    ("NCLNLS", "Asset Quality"),
    ("P3LNLS", "Asset Quality"),
    ("P9LNLS", "Asset Quality"),
    ("DRLNLS", "Asset Quality"),
    ("CRLNLS", "Asset Quality"),
    ("ELNLOS", "Asset Quality"),
    ("SUBLLPF", "Asset Quality"),
    ("NACRCD", "Asset Quality"),
    ("NCCRCD", "Asset Quality"),
    ("P3CRCD", "Asset Quality"),
    ("P9CRCD", "Asset Quality"),
    ("EQTOT", "Capital/Solvency"),
    ("EQCS", "Capital/Solvency"),
    ("EQSUR", "Capital/Solvency"),
    ("EQUPTOT", "Capital/Solvency"),
    ("RBCT1", "Capital/Solvency"),
    ("RBCT2", "Capital/Solvency"),
    ("RBC", "Capital/Solvency"),
    ("RWAJ", "Capital/Solvency"),
    ("LIAB", "Capital/Solvency"),
    ("OFFDOM", "Scale/Operations"),
    ("OFFFOR", "Scale/Operations"),
    ("OFFTOT", "Scale/Operations"),
    ("NUMEMP", "Scale/Operations"),
    ("BKPREM", "Balance Sheet Detail"),
    ("ORE", "Balance Sheet Detail"),
    ("INTAN", "Balance Sheet Detail"),
    ("FREPO", "Liquidity/Market"),
    ("SC", "Liquidity/Market"),
    ("CHBAL", "Liquidity/Market"),
    ("TRADE", "Liquidity/Market"),
    ("TRNFC", "Liquidity/Market"),
    ("TRNUSGOV", "Liquidity/Market"),
    ("TRNMUNI", "Liquidity/Market"),
    ("REPOPURF", "Liquidity/Market"),
]


def fetch_yaml_properties() -> Dict[str, dict]:
    data = urlopen(YAML_URL, timeout=90).read().decode("utf-8")
    parsed = yaml.safe_load(data)
    return parsed["properties"]["data"]["properties"]


def fetch_excel_definitions() -> Dict[str, Dict[str, str]]:
    df = pd.read_excel(XLSX_URL, sheet_name="Reference-Variables&Definitions")
    out: Dict[str, Dict[str, str]] = {}
    for _, row in df.iterrows():
        variable = str(row.get("Variable", "")).strip().upper()
        if not variable or variable == "NAN":
            continue
        title = str(row.get("Title", "")).strip()
        definition = str(row.get("Definition", "")).strip()
        out[variable] = {"title": title, "definition": definition}
    return out


def parse_field_set_from_code(py_path: Path) -> Set[str]:
    text = py_path.read_text(encoding="utf-8")
    fields: Set[str] = set()

    for m in re.finditer(r"fields\s*=\s*\"([A-Z0-9_,]+)\"", text):
        fields.update(part.strip().lower() for part in m.group(1).split(",") if part.strip())

    try:
        tree = ast.parse(text)
    except SyntaxError:
        return fields

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
            value = node.value.value
            if isinstance(value, str):
                cols = [p.strip().lower() for p in value.split(",")]
                if cols and all(re.fullmatch(r"[a-z0-9_]+", c or "") for c in cols if c):
                    fields.update(c for c in cols if c)

    return fields


def parse_current_db_fields(repo_root: Path) -> Set[str]:
    baseline = {
        "asset",
        "dep",
        "depdom",
        "eqtot",
        "roa",
        "roaptx",
        "netinc",
        "nimy",
        "lnlsnet",
        "elnatr",
    }
    sources = [
        repo_root / "backend" / "fdic_to_postgres.py",
        repo_root / "backend" / "api" / "data_ingestion.py",
    ]
    all_fields = set(baseline)
    for src in sources:
        if src.exists():
            all_fields.update(parse_field_set_from_code(src))
    return all_fields


def infer_call_report_line(description: str, title: str, source_mapping: object) -> str:
    joined = f"{title}\n{description}"
    line_match = re.search(
        r"(Schedule\s+[A-Z0-9\-]+(?:\s*,\s*item\s+[A-Z0-9\.\-]+)?|"
        r"Call\s+Report\s+item\s+[A-Z0-9\.\-]+|"
        r"RC\-[A-Z]{1,3}\s*item\s*[A-Z0-9\.\-]+)",
        joined,
        re.IGNORECASE,
    )
    if line_match:
        return line_match.group(1).strip()
    if isinstance(source_mapping, list):
        for item in source_mapping:
            if isinstance(item, dict) and item.get("field"):
                return f"RISVIEW:{item.get('field')}"
    return "unknown"


def build_catalog_rows(
    yaml_props: Dict[str, dict],
    excel_defs: Dict[str, Dict[str, str]],
    current_fields: Set[str],
) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for field, metadata in sorted(yaml_props.items()):
        excel_entry = excel_defs.get(field, {})
        title = str(metadata.get("title") or excel_entry.get("title") or "").strip()
        description = str(metadata.get("description") or excel_entry.get("definition") or "").strip()
        dtype = str(metadata.get("type") or "").strip() or "unknown"
        call_line = infer_call_report_line(description, title, metadata.get("x-source-mapping"))
        rows.append(
            {
                "field_name": field,
                "human_readable_description": title or description or "",
                "data_type": dtype,
                "call_report_line": call_line,
                "present_in_current_db": str(field.lower() in current_fields).lower(),
                "source_title": title,
                "source_definition": description,
            }
        )
    return rows


def pick_existing_recommendations(
    catalog_rows: Iterable[Dict[str, str]],
    current_fields: Set[str],
) -> List[Dict[str, str]]:
    by_field = {row["field_name"]: row for row in catalog_rows}
    selected: List[Dict[str, str]] = []
    seen: Set[str] = set()
    for field, theme in RECOMMENDED_FIELDS:
        row = by_field.get(field)
        if not row:
            continue
        if field.lower() in current_fields:
            continue
        if field in seen:
            continue
        seen.add(field)
        selected.append(
            {
                "field_name": field,
                "theme": theme,
                "description": row["human_readable_description"] or row["source_definition"],
            }
        )
    return selected


def write_csv(path: Path, rows: List[Dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "field_name",
        "human_readable_description",
        "data_type",
        "call_report_line",
        "present_in_current_db",
        "source_title",
        "source_definition",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def phase_for_theme(theme: str) -> str:
    if theme in {"Profitability/Margin", "Funding/Deposits", "Asset Mix/Credit"}:
        return "Phase 1 (Core analyst workflows)"
    if theme in {"Asset Quality", "Capital/Solvency"}:
        return "Phase 2 (Risk and resilience)"
    return "Phase 3 (Depth and market structure)"


def write_markdown(
    path: Path,
    total_fields: int,
    current_fields: Set[str],
    mappings: List[MetricMapping],
    recommendations: List[Dict[str, str]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: List[str] = []
    lines.append("# FDIC Field Definitions and Prioritization")
    lines.append("")
    lines.append("## Overview")
    lines.append("")
    lines.append(f"- Total FDIC fields parsed: **{total_fields}**")
    lines.append(f"- Current DB baseline fields detected from repo: **{len(current_fields)}**")
    lines.append("- Primary catalog: `docs/data/fdic_field_reference.csv`")
    lines.append("")
    lines.append("## Requested Metric Mappings")
    lines.append("")
    lines.append("| Metric | Primary FDIC Field | Alternate Fields | Notes |")
    lines.append("|---|---|---|---|")
    for mapping in mappings:
        lines.append(
            f"| {mapping.metric} | `{mapping.primary_field}` | "
            f"{', '.join(f'`{x}`' for x in mapping.alternates)} | {mapping.rationale} |"
        )

    lines.append("")
    lines.append("## Top Recommended Fields Beyond Current Schema")
    lines.append("")
    lines.append(
        f"Recommended additions (excluding existing baseline fields): **{len(recommendations)}** fields."
    )
    lines.append("")
    lines.append("| Field | Theme | Priority Phase | Description |")
    lines.append("|---|---|---|---|")
    for row in recommendations:
        phase = phase_for_theme(row["theme"])
        desc = row["description"].replace("\n", " ").strip()
        lines.append(f"| `{row['field_name']}` | {row['theme']} | {phase} | {desc} |")

    lines.append("")
    lines.append("## Prioritized Add-First Rollout")
    lines.append("")
    for phase_name in [
        "Phase 1 (Core analyst workflows)",
        "Phase 2 (Risk and resilience)",
        "Phase 3 (Depth and market structure)",
    ]:
        phase_rows = [r for r in recommendations if phase_for_theme(r["theme"]) == phase_name]
        lines.append(f"### {phase_name}")
        lines.append("")
        if not phase_rows:
            lines.append("- None")
            lines.append("")
            continue
        lines.append(
            "- " + ", ".join(f"`{row['field_name']}`" for row in phase_rows[:25])
        )
        lines.append("")

    lines.append("## Notes")
    lines.append("")
    lines.append(
        "- `call_report_line` is best-effort from available public metadata. "
        "Many fields expose RIS mappings but not explicit Schedule/Line annotations."
    )
    lines.append(
        "- `present_in_current_db` is inferred from repo schema/ingestion code, per project direction."
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    yaml_props = fetch_yaml_properties()
    excel_defs = fetch_excel_definitions()
    current_fields = parse_current_db_fields(repo_root)

    catalog_rows = build_catalog_rows(yaml_props, excel_defs, current_fields)
    recommendations = pick_existing_recommendations(catalog_rows, current_fields)

    csv_path = repo_root / "docs" / "data" / "fdic_field_reference.csv"
    md_path = repo_root / "docs" / "fdic_field_recommendations.md"

    write_csv(csv_path, catalog_rows)
    write_markdown(md_path, len(catalog_rows), current_fields, METRIC_MAPPINGS, recommendations)

    print(f"Wrote {len(catalog_rows)} catalog rows -> {csv_path}")
    print(f"Wrote recommendations -> {md_path}")
    print(f"Detected {len(current_fields)} current repo fields")
    print(f"Recommended additions: {len(recommendations)}")


if __name__ == "__main__":
    main()
