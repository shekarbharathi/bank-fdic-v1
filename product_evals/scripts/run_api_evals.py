#!/usr/bin/env python3
"""
B1: Run structured product evals against POST /api/chat.
Writes Markdown + JSONL under product_evals/reports/.

Usage (from repo root, backend running):
  pip install -r product_evals/requirements.txt
  python product_evals/scripts/run_api_evals.py --base-url http://127.0.0.1:8000
  python product_evals/scripts/run_api_evals.py --tag guardrail
  python product_evals/scripts/run_api_evals.py --case-id G1 --with-judge
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
import yaml

PRODUCT_EVALS_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CASES = PRODUCT_EVALS_ROOT / "cases.yaml"

REFUSAL_PATTERNS = [
    "test query",
    "please provide a specific",
    "provide a specific question",
    "not a valid question",
    "cannot convert",
    "i don't understand",
    "i do not understand",
    "not related to fdic",
    "try asking about",
    "rephrase your",
    "unable to generate",
    "cannot generate sql",
    "out of scope",
    "outside the scope",
]


def _matches_refusal(text: str | None) -> bool:
    if not text:
        return False
    s = text.lower()
    return any(p in s for p in REFUSAL_PATTERNS)


def _get_viz_type(body: dict[str, Any]) -> str | None:
    v = body.get("visualization")
    if isinstance(v, dict):
        t = v.get("type")
        return str(t).lower().strip() if t else None
    return None


def _row_count(body: dict[str, Any]) -> int:
    d = body.get("data")
    if isinstance(d, list):
        return len(d)
    return 0


def evaluate_expect(body: dict[str, Any], expect: dict[str, Any] | None) -> list[str]:
    if not expect:
        return []
    failures: list[str] = []

    if expect.get("skip_assertions"):
        return []

    if expect.get("no_error"):
        err = body.get("error")
        if err:
            failures.append(f"expected no error, got error={err!r}")

    ec = body.get("error_code")
    one_of = expect.get("error_code_one_of")
    if one_of is not None:
        if ec not in one_of:
            failures.append(f"error_code {ec!r} not in {one_of}")

    if expect.get("response_refusal_ok"):
        r = body.get("response") or ""
        if not _matches_refusal(r) and ec != "out_of_scope":
            failures.append("expected refusal pattern or error_code out_of_scope")

    iof = expect.get("intent_one_of")
    if iof:
        intent = (body.get("intent") or "").lower().strip()
        allowed = [str(x).lower().strip() for x in iof]
        if intent not in allowed:
            failures.append(f"intent {body.get('intent')!r} not in {iof}")

    vof = expect.get("visualization_type_one_of")
    if vof:
        vt = _get_viz_type(body) or ""
        allowed = [str(x).lower().strip() for x in vof]
        if vt not in allowed:
            failures.append(f"visualization.type {vt!r} not in {vof}")

    min_rows = expect.get("min_rows")
    if min_rows is not None:
        n = _row_count(body)
        if n < int(min_rows):
            failures.append(f"expected min_rows {min_rows}, got {n}")

    max_rows = expect.get("max_rows")
    if max_rows is not None:
        n = _row_count(body)
        if n > int(max_rows):
            failures.append(f"expected max_rows {max_rows}, got {n}")

    if expect.get("data_must_be_empty"):
        n = _row_count(body)
        if n != 0:
            failures.append(f"expected empty data, got {n} rows")

    for sub in expect.get("response_contains_any", []) or []:
        r = body.get("response") or ""
        if sub.lower() not in r.lower():
            failures.append(f"response missing substring (any-of) {sub!r}")

    for sub in expect.get("response_contains_all", []) or []:
        r = body.get("response") or ""
        if sub.lower() not in r.lower():
            failures.append(f"response missing substring {sub!r}")

    for sub in expect.get("response_must_not_contain", []) or []:
        r = body.get("response") or ""
        if sub.lower() in r.lower():
            failures.append(f"response must not contain {sub!r}")

    sc = expect.get("sql_contains")
    if sc:
        sql = (body.get("sql") or "").lower()
        if str(sc).lower() not in sql:
            failures.append(f"sql missing substring {sc!r}")

    return failures


def load_cases(path: Path) -> list[dict[str, Any]]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    cases = raw.get("cases") or []
    if not isinstance(cases, list):
        raise ValueError("cases.yaml: top-level 'cases' must be a list")
    return cases


def main() -> int:
    ap = argparse.ArgumentParser(description="Run product evals against /api/chat")
    ap.add_argument("--base-url", default="http://127.0.0.1:8000", help="API origin (no trailing slash)")
    ap.add_argument("--cases", type=Path, default=DEFAULT_CASES, help="Path to cases.yaml")
    ap.add_argument("--tag", action="append", dest="tags", help="Run only cases with this tag (repeatable)")
    ap.add_argument("--case-id", dest="case_ids", action="append", help="Run only these ids (repeatable)")
    ap.add_argument("--timeout", type=float, default=180.0, help="HTTP timeout seconds")
    ap.add_argument("--with-judge", action="store_true", help="Chain run_llm_judge.py after this run")
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    url = f"{base}/api/chat"

    cases = load_cases(args.cases)
    selected: list[dict[str, Any]] = []
    for c in cases:
        cid = c.get("id")
        if args.case_ids and cid not in args.case_ids:
            continue
        tags = set(c.get("tags") or [])
        if args.tags and not tags.intersection(set(args.tags)):
            continue
        selected.append(c)

    if not selected:
        print("No cases selected.", file=sys.stderr)
        return 2

    reports = PRODUCT_EVALS_ROOT / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stem = f"api-run-{ts}"
    jsonl_path = reports / f"{stem}.jsonl"
    md_path = reports / f"{stem}.md"

    md_lines: list[str] = [
        f"# API product eval run `{stem}`",
        "",
        f"- Base URL: `{base}`",
        f"- Cases file: `{args.cases}`",
        "",
    ]

    all_pass = True
    with jsonl_path.open("w", encoding="utf-8") as jf:
        for c in selected:
            cid = c["id"]
            query = c["query"]
            expect = c.get("expect") or {}
            judge_category = c.get("judge_category", "data")

            record: dict[str, Any] = {
                "id": cid,
                "query": query,
                "tags": c.get("tags") or [],
                "judge_category": judge_category,
                "http_status": None,
                "passed": False,
                "failures": [],
                "api_response": None,
            }

            try:
                resp = requests.post(
                    url,
                    json={"message": query, "conversation_id": None},
                    headers={"Content-Type": "application/json"},
                    timeout=args.timeout,
                )
                record["http_status"] = resp.status_code
                if resp.status_code != 200:
                    record["failures"].append(f"HTTP {resp.status_code}: {resp.text[:500]}")
                    record["api_response"] = None
                else:
                    body = resp.json()
                    record["api_response"] = body
                    fails = evaluate_expect(body, expect)
                    if fails:
                        record["failures"].extend(fails)
                    else:
                        record["passed"] = True
            except requests.RequestException as e:
                record["failures"].append(f"request error: {e}")

            if not record["passed"]:
                all_pass = False

            jf.write(json.dumps(record, ensure_ascii=False) + "\n")

            status = "PASS" if record["passed"] else "FAIL"
            md_lines.append(f"## {cid} — {status}")
            md_lines.append("")
            md_lines.append("**Query**")
            md_lines.append("")
            md_lines.append("```")
            md_lines.append(query)
            md_lines.append("```")
            md_lines.append("")
            if record["failures"]:
                md_lines.append("**Failures**")
                for f in record["failures"]:
                    md_lines.append(f"- {f}")
                md_lines.append("")
            if record["api_response"] is not None:
                md_lines.append("**API response (JSON)**")
                md_lines.append("")
                md_lines.append("```json")
                snippet = json.dumps(record["api_response"], indent=2, ensure_ascii=False)
                if len(snippet) > 20000:
                    snippet = snippet[:20000] + "\n... (truncated)"
                md_lines.append(snippet)
                md_lines.append("```")
                md_lines.append("")
            md_lines.append("---")
            md_lines.append("")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    print(f"Wrote {jsonl_path}")
    print(f"Wrote {md_path}")

    if args.with_judge:
        judge_script = Path(__file__).resolve().parent / "run_llm_judge.py"
        rc = subprocess.call([sys.executable, str(judge_script), "--input", str(jsonl_path)])
        if rc != 0:
            return rc

    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
