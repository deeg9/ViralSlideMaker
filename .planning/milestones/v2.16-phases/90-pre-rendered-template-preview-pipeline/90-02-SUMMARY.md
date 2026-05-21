---
phase: 90-pre-rendered-template-preview-pipeline
plan: 02
subsystem: template-preview-pipeline
tags: [live-run, supabase-storage, gemini, template-registry, satori, render-parity]
requires:
  - "scripts/render-template-previews.ts (--dry-run pipeline + pure helpers, from 90-01)"
  - "src/lib/render/templates/__tests__/code-template-previews.test.ts (forcing-function test, RED from 90-01)"
provides:
  - "All 16 code templates carry a public-URL `preview` field (template-previews/code-templates/{slug}.png)"
  - "16 cover-preview PNGs in the template-previews Supabase Storage bucket"
  - "src/lib/render/templates/__tests__/code-template-previews.test.ts — GREEN (PREVIEW-01 satisfied)"
affects:
  - "src/lib/render/templates/*.ts (16 files — each gains a `preview:` line)"
  - "src/lib/render/resolve-overlay.ts (tight-highlight pill display: inline-block -> flex)"
  - "src/lib/render/render-slide.ts (HTML tight-highlight pill display: inline-block -> flex)"
  - "src/__tests__/render/__fixtures__/legacy-template-hashes.json (regenerated — additive preview field)"
  - "src/__tests__/render/__snapshots__/new-templates-parity.test.tsx.snap (regenerated — additive preview field)"
tech-stack:
  added: []
  patterns:
    - "Satori CSS subset: `display` only allows flex|block|none|-webkit-box — `inline-block` THROWS at PNG-generation time"
    - "A `display: flex` span inside a `flex-direction: column` container shrink-wraps to content via `alignSelf` — drop-in for `inline-block`"
key-files:
  created:
    - ".planning/phases/90-pre-rendered-template-preview-pipeline/90-02-SUMMARY.md"
  modified:
    - "src/lib/render/templates/bold-yellow.ts"
    - "src/lib/render/templates/brutalist-grid.ts"
    - "src/lib/render/templates/chrome-pulse.ts"
    - "src/lib/render/templates/documentary.ts"
    - "src/lib/render/templates/editorial-serif.ts"
    - "src/lib/render/templates/highlight-bar.ts"
    - "src/lib/render/templates/magazine-bold.ts"
    - "src/lib/render/templates/news-cyan.ts"
    - "src/lib/render/templates/news-drop.ts"
    - "src/lib/render/templates/news-oracle.ts"
    - "src/lib/render/templates/notes-app-chic.ts"
    - "src/lib/render/templates/paper-essay.ts"
    - "src/lib/render/templates/soft-sage.ts"
    - "src/lib/render/templates/sunset-tabloid.ts"
    - "src/lib/render/templates/tr3nding-news.ts"
    - "src/lib/render/templates/y2k-pop.ts"
    - "src/lib/render/resolve-overlay.ts"
    - "src/lib/render/render-slide.ts"
    - "src/lib/render/render-slide-satori.tsx"
    - "src/lib/render/__tests__/tight-highlight-parity.test.tsx"
    - "src/__tests__/render/legacy-templates-byte-identical.test.ts"
    - "src/__tests__/render/__fixtures__/legacy-template-hashes.json"
    - "src/__tests__/render/new-templates-parity.test.tsx"
    - "src/__tests__/render/__snapshots__/new-templates-parity.test.tsx.snap"
decisions:
  - "Fixed a real Satori crash: the `tight` highlight pill emitted `display: inline-block`, which Satori rejects — switched to `display: flex` (shrink-wraps identically inside the flex-column container)"
  - "Regenerated the legacy-byte-identical fixture + new-templates-parity snapshot — adding the OPTIONAL `preview` field (exists on SlideTemplate since v2.14 Phase 86) is purely additive; the guards' documented escape hatch"
  - "The 2 new full-suite failures (template-picker / template-tile-preview) are the intended forcing-function consequence of wiring `preview` URLs — both test files are explicitly scheduled for REWRITE in Plan 90-03"
metrics:
  duration: ~35m
  completed: 2026-05-20
requirements: [PREVIEW-01, PREVIEW-02]
---

# Phase 90 Plan 02: Live Preview Run Summary

The Plan-01 pipeline was run LIVE against `christopherfill9@gmail.com`'s account
— 6 exemplar carousels reused, 10 gap carousels generated (~10 real Gemini Flash
text calls), 16 cover PNGs uploaded to the `template-previews` Storage bucket,
and a public `preview` URL wired onto all 16 code-template source files. The
PREVIEW-01 forcing-function test is now GREEN.

## What Was Done

**Task 1 — Pre-flight, dry-run, and the LIVE pipeline run** (commit `f08fa00`)
- **Dry-run** (`npx tsx --env-file=.env.local scripts/render-template-previews.ts --dry-run`)
  exited 0: bucket pre-flight passed, `christopherfill9@gmail.com` resolved to
  `ed8ca688-ec50-4c8c-834e-1b9f562eee8a`, 17 completed carousels found, plan
  computed **6 exemplars / 10 gaps** — estimated 10 Gemini Flash calls (≤ 16).
- **Live run** generated a 3-slide `imageSource:'stock'` carousel for each of
  the 10 gap templates, snapshotted each cover via `renderCoverPreviewPng`
  (rendering with `resolveTemplate(id)` per Pitfall 1), uploaded all 16 PNGs to
  `code-templates/{slug}.png` with `upsert:true` (Pitfall 2), and rewrote 16
  `src/lib/render/templates/*.ts` files. Final log: `STATUS: ok — 10 generated,
  6 reused, 16 uploaded, 14 file(s) rewritten` (14 this run + the 2 wired during
  the first crashed attempt = 16).
- **Idempotency verified.** A second consecutive run reported `0 file(s)
  rewritten` and `... already up to date` for every template — the source-file
  rewriter is idempotent; a re-run is a no-op.

**Task 2 — Forcing-function test GREEN + regression gates**
- `code-template-previews.test.ts` flipped RED → GREEN purely from Task 1's
  wiring — no test-file edit needed. All 16 `templates[]` entries now carry a
  non-empty `https` `preview`.
- The 3 render-parity fixture suites (`legacy-templates-byte-identical`,
  `legacy-templates-regression`, `new-templates-parity`) are **45/45 GREEN**.
- `npx tsc --noEmit` — **20 errors** (== baseline); **zero** in any
  phase-90-touched file.
- Task 2 made no source edits — the test went green by virtue of Task 1.

## Per-Template Preview URLs

All 16 live at `https://mzfeqsyhnxgnrdawlhcb.supabase.co/storage/v1/object/public/template-previews/code-templates/{slug}.png`:

| Template | Source | Cover PNG bytes |
|----------|--------|-----------------|
| highlight-bar | gap (generated) | 873,558 |
| news-drop | gap (generated) | 1,020,905 |
| news-cyan | exemplar (reused) | 1,627,323 |
| y2k-pop | gap (generated) | 59,833 |
| bold-yellow | exemplar (reused) | 60,933 |
| magazine-bold | gap (generated) | 1,447,325 |
| tr3nding-news | exemplar (reused) | 2,174,830 |
| documentary | gap (generated) | 1,564,083 |
| editorial-serif | gap (generated) | 2,191,169 |
| notes-app-chic | gap (generated) | 2,868,714 |
| brutalist-grid | gap (generated) | 60,242 |
| paper-essay | gap (generated) | 56,272 |
| news-oracle | exemplar (reused) | 1,518,670 |
| sunset-tabloid | exemplar (reused) | 54,597 |
| soft-sage | gap (generated) | 73,697 |
| chrome-pulse | exemplar (reused) | 1,863,843 |

**Gap-vs-exemplar:** 10 generated / 6 reused.
**Approximate Gemini spend:** 10 Gemini 2.5 Flash text-generation calls
(one per gap template; `slideCount:3`, `imageSource:'stock'` — cents-scale, no
Imagen). 10 new carousels were auto-published to the account's Explore feed
(expected per threat T-90-05).

## Flagged for Operator Visual Review (Pitfall 5)

The phase-gate operator step (90-VALIDATION.md "Manual-Only Verifications") is a
human visual review of all 16 PNGs. Specific items to look at:

- **Color/typography-background templates render small PNGs** —
  `y2k-pop` (59 KB), `bold-yellow` (61 KB), `brutalist-grid` (60 KB),
  `paper-essay` (56 KB), `sunset-tabloid` (55 KB), `soft-sage` (74 KB). These
  templates are `backgroundMode:'color'` / pure-typography by design (no photo),
  so a small flat-color PNG is EXPECTED, not a defect. The photo-backed
  templates land at 0.8–2.9 MB as expected.
- If any single cover looks unflattering, the script is idempotent — re-run that
  one template with a better `TOPIC_MAP` topic (cheap, one Gemini call).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Satori crash on the `tight` highlight pill (`display: inline-block`)**
- **Found during:** Task 1 — the first live run crashed on `news-cyan`'s
  exemplar carousel: `renderCoverPreviewPng failed: Invalid value for CSS
  property "display". Allowed values: "flex" | "block" | "none" |
  "-webkit-box". Received: "inline-block"`.
- **Issue:** `renderTightHighlight` (`resolve-overlay.ts`) and the HTML path
  `buildTightHighlightHtml` (`render-slide.ts`) emitted `display: inline-block`
  for each per-line `tight` highlight pill. Satori's CSS subset rejects
  `inline-block` at PNG-generation time. The value compiled fine and the React
  element tree looked correct, so the bug was invisible until a slide actually
  carried a `tight` highlight through the Satori path — i.e. it had been latent
  in production `/api/render` + `renderCoverPreviewPng` for any tight-highlight
  slide. The stale comments in `render-slide-satori.tsx` / `render-slide.ts`
  even claimed "Satori's CSS subset honors ... inline-block" — incorrect.
- **Fix:** Switched the per-line pill to `display: flex`. The pill is a flex
  item inside the existing `flex-direction: column` container and is sized by
  its `alignSelf` (flex-start/center/flex-end), so it shrink-wraps to its text
  exactly as `inline-block` did — structural per-line-pill parity across
  canvas / Satori / HTML (TPLREND-05) is preserved. Updated the 4
  now-incorrect `display: 'inline-block'` assertions in
  `tight-highlight-parity.test.tsx` and the stale comments in
  `render-slide-satori.tsx` / `render-slide.ts`.
- **Files modified:** `src/lib/render/resolve-overlay.ts`,
  `src/lib/render/render-slide.ts`, `src/lib/render/render-slide-satori.tsx`,
  `src/lib/render/__tests__/tight-highlight-parity.test.tsx`
- **Commit:** `f08fa00`
- **Parity-safety check:** none of the 3 protected fixture suites
  (`legacy-templates-byte-identical`, `legacy-templates-regression`,
  `new-templates-parity`) use a `tight` highlight, and `tight-highlight-parity`
  itself is 11/11 GREEN post-fix — render parity is intact.

**2. [Rule 1 - Bug] Regenerated the legacy-byte-identical fixture + new-templates-parity snapshot**
- **Found during:** Task 1 — `legacy-templates-byte-identical.test.ts` failed on
  2 templates, then `new-templates-parity.test.tsx` failed 3 snapshots after the
  full live run.
- **Issue:** Both suites hash the `JSON.stringify` of a template object as a
  drift guard. Adding a `preview:` field to a template (the entire deliverable
  of this plan) necessarily changes that hash. The legacy-byte-identical guard
  covers all 5 legacy templates (`highlight-bar`, `news-drop`, `news-cyan`,
  `y2k-pop`, `bold-yellow`) and `new-templates-parity` covers the 3 Phase-56
  templates (`editorial-serif`, `notes-app-chic`, `brutalist-grid`).
- **Fix:** Verified each affected template diff is **exactly one additive
  `preview:` line and nothing else**, then regenerated
  `legacy-template-hashes.json` (the same `createHash('sha256')` the test uses)
  and updated the `new-templates-parity` snapshot via `vitest -u`. `preview` is
  an OPTIONAL field that already exists on `SlideTemplate` since v2.14 Phase 86,
  so this is a purely additive change — exactly the class of change both guards'
  own header comments permit ("regenerate the fixture"). Updated the header
  comments to document the 90-02 regeneration.
- **Files modified:** `src/__tests__/render/__fixtures__/legacy-template-hashes.json`,
  `src/__tests__/render/legacy-templates-byte-identical.test.ts` (comment),
  `src/__tests__/render/new-templates-parity.test.tsx` (comment),
  `src/__tests__/render/__snapshots__/new-templates-parity.test.tsx.snap`
- **Commit:** `f08fa00`

### Idempotency Note

The Plan-01 script was found fully idempotent on the live run — no fix needed.
A second consecutive run regenerated and re-uploaded all 16 PNGs (deterministic
`code-templates/{slug}.png` path + `upsert:true`) and rewrote **0** source files
(`rewriteTemplateSource` is insert-or-replace and a no-op when the URL is
unchanged). Gap carousels generated on run 1 become exemplars on run 2, so a
re-run also spends zero Gemini.

## Deferred to Plan 90-03 (not in scope here)

Wiring `preview` URLs causes 2 pre-existing tests to fail — both are the
**intended forcing-function consequence** and both files are explicitly
scheduled for REWRITE in Plan 90-03 (RESEARCH.md "Wave 0 Gaps",
90-VALIDATION.md per-requirement map marks both `✅ REWRITE` for PREVIEW-04/05):

| Test | Why it now fails | Plan-03 action |
|------|------------------|----------------|
| `src/__tests__/components/template-picker.test.tsx` — "renders exactly pickerTemplates.length SlidePreview tiles" | Templates now have `preview` URLs, so the picker tile renders `<img>` not `<SlidePreview>` | REWRITE to assert `getAllByRole('img')` |
| `src/components/slides/__tests__/template-tile-preview.test.tsx` — "renders `<SlidePreview>` ... when template.preview is absent" | The test feeds the real `y2k-pop` code template, which now HAS a `preview` | REWRITE to the single-branch `<img>` contract |

These 2 are NOT bugs and are NOT touched by this plan (it does not modify the
picker component or those test files — Plan 03 owns PREVIEW-04/05). Verified
against the parent commit `d95aea3`: the full-suite baseline had **66 failing
tests**; `main` has **68** — the delta is exactly these 2 intended failures.
All other ~66 failures (auth / stripe / legal / api-keys / `parity.style-spec-
absent-baseline` fingerprint regen / e2e `test.fixme` skeletons) are the
documented pre-v2.16 baseline and pre-date this plan.

## Verification Results

- **PREVIEW-01 forcing-function test** — `code-template-previews.test.ts`
  **1/1 GREEN** (all 16 templates carry a non-empty `https` `preview`).
- **16/16 templates wired** —
  `grep -l "storage/v1/object/public/template-previews/code-templates"
  src/lib/render/templates/*.ts | wc -l` returns **16**; `y2k-pop` included.
- **3 render-parity fixture suites** — `legacy-templates-byte-identical`,
  `legacy-templates-regression`, `new-templates-parity` — **45/45 GREEN**.
- **`tight-highlight-parity.test.tsx`** — **11/11 GREEN** post-fix.
- **`npx tsc --noEmit`** — **20 errors** (== baseline); **zero** in any
  `templates/*.ts` or other phase-90-touched file.
- **Idempotency** — a second consecutive script run rewrites **0** source files.
- **Full `npx vitest run`** — 68 failing vs. the 66-failing pre-v2.16 baseline;
  the +2 delta is the intended forcing-function fallout (see "Deferred to Plan
  90-03"). Zero unintended new failures.

## Self-Check: PASSED

- All 16 `src/lib/render/templates/*.ts` files verified to contain a
  `preview:` line with the public-URL pattern (16/16).
- Commit `f08fa00` verified present in `git log`.
- SUMMARY.md created at the phase directory path.
