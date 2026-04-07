# Copy-paste commands — product evals

Run these from your **machine** (your laptop). The repo root is the directory that contains `product_evals/` (e.g. `bank-fdic-v1/`).

---

## 0) One-time setup on your laptop

```bash
cd /path/to/bank-fdic-v1

python3 -m venv .venv-product-evals
source .venv-product-evals/bin/activate   # Windows: .venv-product-evals\Scripts\activate

pip install -r product_evals/requirements.txt
```

You can reuse your backend virtualenv instead; only `requests`, `PyYAML`, and `openai` (for B2) are required.

---

## 1) Point evals at an API (`BASE_URL`)

The script calls `POST {BASE_URL}/api/chat`. **No trailing slash** on `BASE_URL`.

**Local backend**

```bash
export BASE_URL="http://127.0.0.1:8000"
```

**Railway (app deployed, evals on laptop)**

1. In [Railway](https://railway.app), open your **backend / API** service (the one that serves FastAPI), not the static frontend-only service if split.
2. Open **Settings → Networking** (or **Public URL** / **Generate domain**) and copy the HTTPS URL, e.g. `https://your-service-production-xxxx.up.railway.app`.
3. If you use a **custom domain**, use that origin instead (still no trailing slash).

```bash
export BASE_URL="https://your-service-production-xxxx.up.railway.app"
```

4. Quick check from the same laptop (optional):

```bash
curl -sS "${BASE_URL}/api/health"
```

You should see JSON with `"status"` (or similar). If this fails, fix Railway networking / domain before running evals.

**Notes**

- Evals are plain HTTPS requests from your laptop to Railway; you do **not** need to SSH into Railway.
- The **judge step (B2)** calls **OpenAI from your laptop**, not Railway. Only `OPENAI_API_KEY` on your machine is required for B2.
- If your API is behind extra auth (API keys, Cloudflare), you would need to extend `run_api_evals.py` to send headers; the stock script has no auth.

---

## 2) B1 — Run API evals (structured checks)

**All cases**

```bash
cd /path/to/bank-fdic-v1
source .venv-product-evals/bin/activate   # if you use that venv

export BASE_URL="https://your-railway-api.example"   # or http://127.0.0.1:8000

python product_evals/scripts/run_api_evals.py --base-url "${BASE_URL}"
```

**Only guardrails**

```bash
python product_evals/scripts/run_api_evals.py --base-url "${BASE_URL}" --tag guardrail
```

**Only help / meta questions**

```bash
python product_evals/scripts/run_api_evals.py --base-url "${BASE_URL}" --tag help
```

**Single case**

```bash
python product_evals/scripts/run_api_evals.py --base-url "${BASE_URL}" --case-id G1
```

**Slow LLM / long queries**

```bash
python product_evals/scripts/run_api_evals.py --base-url "${BASE_URL}" --timeout 300
```

**Where output goes**

The script prints paths like:

- `product_evals/reports/api-run-<timestamp>.md`
- `product_evals/reports/api-run-<timestamp>.jsonl`

Open the `.md` file in an editor to review each query and API response.

---

## 3) B2 — LLM-as-judge (optional, from your laptop)

Set your OpenAI key (used only on the laptop for judging):

```bash
export OPENAI_API_KEY="sk-..."
# optional:
# export JUDGE_MODEL="gpt-4o-mini"
```

**Judge a specific B1 run** (replace the filename with the one printed by B1):

```bash
cd /path/to/bank-fdic-v1
source .venv-product-evals/bin/activate

python product_evals/scripts/run_llm_judge.py \
  --input product_evals/reports/api-run-20260101T120000Z.jsonl
```

**B1 immediately followed by judge**

```bash
export BASE_URL="https://your-railway-api.example"
export OPENAI_API_KEY="sk-..."

python product_evals/scripts/run_api_evals.py --base-url "${BASE_URL}" --with-judge
```

Judge reports appear under `product_evals/reports/judge-run-<timestamp>.md` and `.jsonl`.

---

## 4) Railway-specific checklist (laptop → production API)

| Step | Action |
|------|--------|
| 1 | Deploy backend on Railway; confirm `/api/health` works in a browser or `curl`. |
| 2 | Copy the **API** public HTTPS origin → `export BASE_URL="..."`. |
| 3 | From laptop, `cd` to repo, activate venv, `pip install -r product_evals/requirements.txt` once. |
| 4 | Run B1 with `--base-url "${BASE_URL}"`. |
| 5 | For B2, set `OPENAI_API_KEY` locally and run `run_llm_judge.py` or `--with-judge`. |

If the **frontend** is on a different Railway URL than the API, that is fine: evals only talk to the **backend** `BASE_URL`.
