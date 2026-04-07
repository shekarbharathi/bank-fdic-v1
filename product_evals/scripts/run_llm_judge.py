#!/usr/bin/env python3
"""
B2: LLM-as-judge over JSONL from run_api_evals.py.

Requires OPENAI_API_KEY. Optional JUDGE_MODEL (default gpt-4o-mini).

Usage:
  export OPENAI_API_KEY=sk-...
  python product_evals/scripts/run_llm_judge.py --input product_evals/reports/api-run-....jsonl

Writes:
  product_evals/reports/judge-run-<utc>.md
  product_evals/reports/judge-run-<utc>.jsonl
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PRODUCT_EVALS_ROOT = Path(__file__).resolve().parent.parent
PROMPTS = PRODUCT_EVALS_ROOT / "prompts"

RUBRIC_FILES = {
    "data": "judge_rubric.md",
    "refusal": "judge_rubric.md",
    "help": "judge_help_rubric.md",
}


def load_rubric(category: str) -> str:
    name = RUBRIC_FILES.get(category, "judge_rubric.md")
    p = PROMPTS / name
    if not p.is_file():
        return ""
    return p.read_text(encoding="utf-8")


def parse_verdict(text: str) -> tuple[str, str]:
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}\s*$", text)
    if m:
        try:
            j = json.loads(m.group(0))
            v = str(j.get("verdict", "FAIL")).upper()
            r = str(j.get("rationale", ""))
            return v, r
        except json.JSONDecodeError:
            pass
    u = text.upper()
    if "PASS" in u and "FAIL" not in u:
        return "PASS", text
    return "FAIL", text


def truncate_data_sample(body: dict[str, Any], max_rows: int = 5) -> Any:
    if not isinstance(body, dict):
        return body
    out = dict(body)
    d = out.get("data")
    if isinstance(d, list) and len(d) > max_rows:
        out["data"] = d[:max_rows] + [f"... ({len(d) - max_rows} more rows)"]
    return out


def main() -> int:
    try:
        from openai import OpenAI
    except ImportError:
        print("Install openai: pip install -r product_evals/requirements.txt", file=sys.stderr)
        return 2

    ap = argparse.ArgumentParser(description="LLM judge for product eval snapshots")
    ap.add_argument("--input", type=Path, required=True, help="JSONL from run_api_evals.py")
    ap.add_argument("--model", default=os.environ.get("JUDGE_MODEL", "gpt-4o-mini"))
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        print("Set OPENAI_API_KEY", file=sys.stderr)
        return 2

    if not args.input.is_file():
        print(f"Missing input file: {args.input}", file=sys.stderr)
        return 2

    client = OpenAI()
    reports = PRODUCT_EVALS_ROOT / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stem = f"judge-run-{ts}"
    md_path = reports / f"{stem}.md"
    jsonl_out = reports / f"{stem}.jsonl"

    records: list[dict[str, Any]] = []
    for line in args.input.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        records.append(json.loads(line))

    md_lines: list[str] = [
        f"# LLM judge run `{stem}`",
        "",
        f"- Input snapshot: `{args.input}`",
        f"- Model: `{args.model}`",
        "",
    ]

    all_pass = True
    with jsonl_out.open("w", encoding="utf-8") as jout:
        for rec in records:
            cid = rec.get("id", "?")
            query = rec.get("query", "")
            cat = rec.get("judge_category", "data")
            api = rec.get("api_response")
            rubric = load_rubric(cat)

            judge_system = (
                "You are an evaluator for a banking data chat product.\n\n"
                + rubric
                + "\n\nEvaluate the assistant's reply (in the API response field `response`) "
                "in context of the user query and optional SQL/data."
            )

            sample = truncate_data_sample(api) if isinstance(api, dict) else api
            judge_user = json.dumps(
                {
                    "eval_id": cid,
                    "user_query": query,
                    "api_response_for_judge": sample,
                },
                indent=2,
                ensure_ascii=False,
            )

            verdict = "SKIP"
            rationale = "no API response to judge"
            raw_judge = ""

            if api is not None:
                try:
                    comp = client.chat.completions.create(
                        model=args.model,
                        temperature=0,
                        messages=[
                            {"role": "system", "content": judge_system},
                            {"role": "user", "content": judge_user},
                        ],
                    )
                    raw_judge = (comp.choices[0].message.content or "").strip()
                    verdict, rationale = parse_verdict(raw_judge)
                except Exception as e:
                    raw_judge = f"JUDGE_ERROR: {e}"
                    rationale = str(e)

            if verdict not in ("PASS", "SKIP"):
                all_pass = False

            out_rec = {
                "id": cid,
                "query": query,
                "judge_category": cat,
                "judge_verdict": verdict,
                "judge_rationale": rationale,
                "judge_raw": raw_judge,
                "judge_system_prompt": judge_system,
                "judge_user_payload": judge_user,
            }
            jout.write(json.dumps(out_rec, ensure_ascii=False) + "\n")

            md_lines.append(f"## {cid} — judge {verdict}")
            md_lines.append("")
            md_lines.append("### User query")
            md_lines.append("")
            md_lines.append("```")
            md_lines.append(query)
            md_lines.append("```")
            md_lines.append("")
            md_lines.append("### Judge input (user message to judge model)")
            md_lines.append("")
            md_lines.append("```json")
            md_lines.append(judge_user[:15000] + ("..." if len(judge_user) > 15000 else ""))
            md_lines.append("```")
            md_lines.append("")
            md_lines.append("### Judge system rubric (excerpt)")
            md_lines.append("")
            md_lines.append("```")
            md_lines.append(rubric[:4000] + ("..." if len(rubric) > 4000 else ""))
            md_lines.append("```")
            md_lines.append("")
            md_lines.append("### Judge raw response")
            md_lines.append("")
            md_lines.append("```")
            md_lines.append(raw_judge[:8000] or "(empty)")
            md_lines.append("```")
            md_lines.append("")
            md_lines.append(f"**Rationale:** {rationale}")
            md_lines.append("")
            md_lines.append("---")
            md_lines.append("")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    print(f"Wrote {md_path}")
    print(f"Wrote {jsonl_out}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
