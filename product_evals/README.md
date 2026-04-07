# Product evals (FDIC chat)

End-user–style checks for `POST /api/chat`. **All assets live here**; application source under `backend/` and `frontend/` is unchanged.

**Copy-paste commands and Railway-from-laptop steps:** [`COMMANDS.md`](COMMANDS.md).

## Setup

From the repo root (use the same venv as the backend, or install minimal deps):

```bash
pip install -r product_evals/requirements.txt
```

Start the API (e.g. backend on `http://127.0.0.1:8000`).

## B1 — API structured evals

Runs cases in [`cases.yaml`](cases.yaml), writes a **Markdown** summary and **JSONL** machine log under [`reports/`](reports/). The folder is tracked (see `.gitkeep`); generated `api-run-*` / `judge-run-*` files are ignored by default—remove those lines from [`reports/.gitignore`](reports/.gitignore) or `git add -f` if you want a run in version control.

```bash
# All cases
python product_evals/scripts/run_api_evals.py --base-url http://127.0.0.1:8000

# By tag
python product_evals/scripts/run_api_evals.py --tag guardrail
python product_evals/scripts/run_api_evals.py --tag help

# Single case
python product_evals/scripts/run_api_evals.py --case-id G1

# Slower LLM: raise timeout
python product_evals/scripts/run_api_evals.py --timeout 300
```

- Exit code **0** = every selected case passed its `expect` block; **1** = at least one failure; **2** = no cases selected / usage error.

### Artifacts

- `reports/api-run-<UTC>.md` — human-readable: query, pass/fail, failures, full JSON response per case.
- `reports/api-run-<UTC>.jsonl` — one JSON object per line (`id`, `query`, `passed`, `failures`, `api_response`, …). Use this as input for B2.

## B2 — LLM-as-judge (on demand)

Evaluates **assistant quality** using a separate model. You see **every input and output** in the report.

```bash
export OPENAI_API_KEY=sk-...
# optional: export JUDGE_MODEL=gpt-4o-mini

python product_evals/scripts/run_llm_judge.py \
  --input product_evals/reports/api-run-20260101T120000Z.jsonl
```

Chain after B1:

```bash
python product_evals/scripts/run_api_evals.py --with-judge
```

### Artifacts

- `reports/judge-run-<UTC>.md` — per case: user query, **judge user JSON payload**, rubric excerpt, **raw judge output**, verdict, rationale.
- `reports/judge-run-<UTC>.jsonl` — includes `judge_system_prompt`, `judge_user_payload`, `judge_raw` for full traceability.

Exit **0** if every judged case returns verdict `PASS`; cases with no API body to judge are marked **SKIP** and do not fail the run.

Rubrics: [`prompts/judge_rubric.md`](prompts/judge_rubric.md) (data / refusal), [`prompts/judge_help_rubric.md`](prompts/judge_help_rubric.md) (product help).

## Human catalog

Scenario descriptions and IDs: [`catalog.md`](catalog.md).

## Adding cases

Edit [`cases.yaml`](cases.yaml). Use `tags` for filtering, `judge_category`: `data` | `refusal` | `help`. For help-style questions where B1 checks are too brittle, set `expect.skip_assertions: true` and rely on B2.

See inline comments in `cases.yaml` for `expect` fields.
