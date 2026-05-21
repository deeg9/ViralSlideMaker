---
status: partial
phase: 90-pre-rendered-template-preview-pipeline
source: [90-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual review of the 16 generated preview PNGs
expected: Each of the 16 code-template preview PNGs (uploaded by the live pipeline run to the Supabase `template-previews/code-templates/{slug}.png` bucket path) depicts its template the way generation actually produces it — photo-backed templates show a real photo background; flat-color templates (`y2k-pop`, `bold-yellow`, `brutalist-grid`, `paper-essay`, `sunset-tabloid`, `soft-sage`) show their solid-color design. No black-screen / text-on-empty-background tiles. Open the project picker (`/project/[id]`) and confirm the tiles look like real carousels.
result: [pending]

### 2. End-to-end Playwright picker smoke (auth-gated route)
expected: With an authenticated session, `tests/e2e/template-picker-previews.spec.ts` passes — every visible picker tile renders as an `<img>` with a valid non-empty `src` and `naturalWidth > 0` (no broken images), and there are zero `data-testid="slide-preview"` nodes. The spec currently `test.skip()`s cleanly without an auth session; run it against a logged-in dev server to confirm live.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
