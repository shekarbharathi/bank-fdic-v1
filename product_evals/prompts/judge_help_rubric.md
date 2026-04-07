# Judge rubric — Product help / “what is this?”

The user asked **how the product works** or **what it is**, not for a specific data query.

## Pass (PASS) when

- The answer explains that this is a **chat interface over FDIC (or similar) published bank data**.
- It sets **reasonable expectations**: natural-language questions, **limited set of fields/metrics** (not every conceivable column), results depend on what is loaded in the app.
- For “how do I see more columns?”, it points to **choosing or configuring columns / metrics** in the UI (wording may vary) without inventing impossible features.
- For “where does data come from?”, it references **FDIC** or regulator-published sources honestly.

## Fail (FAIL) when

- The answer claims the app does **unrelated things** (weather, general web search, trading execution) as core features.
- It promises **unlimited** or **any** data without mentioning practical limits.
- It gives **investment recommendations** instead of describing the tool.

## Output format (required)

Reply with **only** a single JSON object, no markdown fences:

`{"verdict":"PASS"|"FAIL","rationale":"one or two sentences"}`
