---
quick_task: extract-style-live-debug
created: 2026-05-11
status: in-progress
trigger: "Live smoke: 'We couldn't extract a style from these references' on every Extract click — need to find root cause and iterate to working state"
---

# Quick: Extract-style live debug

## Mission
Drive Playwright + real carousel reference image (`real-carousel.png` — Meta/Ray-Ban TikTok screenshot, ideal style-extraction fixture) until the extract path returns `{ok: true, spec: ...}` and the spec-preview panel renders.

## Loop
1. Navigate to `/style-from-reference/new`
2. Upload `real-carousel.png`
3. Click Extract
4. Capture Server Action response + console + server logs to identify failure mode
5. Apply targeted fix (DB constraint / RLS / Gemini wiring / Storage download / etc.)
6. Repeat until success

## Known about the environment
- User is now Diego (190 credits, presumably paid tier — different from previous Big D session)
- Phase 73 cost rails live (sharp + cache + rate-cap + ledger + retry)
- Phase 74 schema live (StyleSpec + closed-enum + slide-references bucket + RLS)
- Phase 75 extraction live (extractStyleSpec orchestrator + refusal-pre-pass + node-vibrant)
- ToS already accepted in earlier session (audit row exists from quick 260510)
- credit_transactions.type CHECK constraint was JUST fixed (quick 260510 Fix 6 — sentinel + extract_style type)

## Diagnostic plan
Server Action errors return discriminated-union `{error: 'extraction_failed', detail: '...'}` — but the UI's ErrorRouter routes generic `extraction_failed` to the "couldn't extract" recovery panel without surfacing detail. Need to read server logs (`stderr` from the dev server) to see the actual `detail` field.

Hypotheses, in order of likelihood:
1. **Storage download fails** — admin client tries to download by path but the row.url could be a signed URL or just a relative path; mismatch could throw at `admin.storage.from(...).download(row.url)`
2. **Gemini API issue** — env var unset, schema mismatch, network error
3. **Sharp preprocess fail** — HEIC encode unavailable (Plan 73-01 noted this) — but our test is PNG so unlikely
4. **node-vibrant subpath import fail at runtime** (worked in tests, mocked)
5. **Cache lookup throws** — admin client schema issue
6. **Refusal pre-pass throws** despite "never throws" contract

## Fixes ranked
- If (1): fix Server Action to download by path correctly OR pass the bucket-relative path
- If (2): check `GEMINI_API_KEY` env var, schema, model name
- If (3-6): per-symptom

## Acceptance
Extract click → spec-preview panel renders with palette swatches + font badges + layout sketch + voice_note. OR a graceful structured failure with actionable detail (not the generic "couldn't extract" panel).
