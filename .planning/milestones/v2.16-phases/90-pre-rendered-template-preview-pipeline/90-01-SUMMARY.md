---
phase: 90-pre-rendered-template-preview-pipeline
plan: 01
subsystem: template-preview-pipeline
tags: [scripts, tsx, supabase-storage, template-registry, wave-0-tests]
requires: []
provides:
  - "scripts/render-template-previews.ts (--dry-run pipeline + pure helpers buildGapMap/previewStoragePath/rewriteTemplateSource/main)"
  - "scripts/__tests__/render-template-previews.test.ts (pure-helper unit tests — GREEN)"
  - "src/lib/render/templates/__tests__/code-template-previews.test.ts (forcing-function test — RED-by-design)"
  - "tests/e2e/template-picker-previews.spec.ts (Playwright picker-smoke skeleton — test.fixme)"
affects:
  - "package.json (added \"previews\" script)"
tech-stack:
  added: []
  patterns:
    - "Standalone tsx one-off pipeline: requireEnv preflight + inline service-role createClient + numbered main() + isDirectRun guard"
    - "Pure helpers exported separately from main() so Wave-0 tests import them with no live DB / no Gemini spend"
    - "Lazy import of generateCarousel to keep the Pexels-client module-load side effect off the dry-run / unit-test path"
key-files:
  created:
    - "scripts/render-template-previews.ts"
    - "scripts/__tests__/render-template-previews.test.ts"
    - "src/lib/render/templates/__tests__/code-template-previews.test.ts"
    - "tests/e2e/template-picker-previews.spec.ts"
  modified:
    - "package.json"
decisions:
  - "main() is gated behind an isDirectRun (import.meta.url vs process.argv[1]) check — importing pure helpers in vitest must not run the pipeline"
  - "generateCarousel is imported lazily inside the live gap-fill path, never at module load — its transitive Pexels client init throws when PEXELS_API_KEY is absent"
  - "The \"previews\" npm script passes tsx --env-file=.env.local because standalone tsx does not auto-load .env.local (only next dev/build does)"
metrics:
  duration: ~25m
  completed: 2026-05-20
requirements: [PREVIEW-03]
---

# Phase 90 Plan 01: Build the Preview Pipeline Script Summary

A one-off `scripts/render-template-previews.ts` pipeline that gap-detects, generates, snapshots, uploads and rewrites code-template source files — built with separately-exported pure helpers and a fully working `--dry-run` mode that performs zero live writes, plus the three Wave-0 test files.

## What Was Built

**Task 1 — `scripts/render-template-previews.ts`** (commit `3d5e2ac`)
- Three side-effect-free, separately-exported pure helpers:
  - `previewStoragePath(id)` — returns `code-templates/{id}.png`, throws on any id failing `/^[a-z0-9-]+$/` (path-injection guard, threat T-90-01).
  - `buildGapMap(templates, projects)` — pure (takes projects as an argument, never queries); per template id returns `{ kind: 'exemplar', project }` (freshest completed project by `updated_at`) or `{ kind: 'gap' }`. All 16 ids appear as keys.
  - `rewriteTemplateSource(src, url)` — insert-or-replace the `preview:` field on a flat template literal; provably idempotent; preserves indentation on replace.
- `main()` orchestration: flag parsing (`--dry-run`, `--user-id=`), 5-var `requireEnv` preflight, inline service-role client, `template-previews` bucket pre-flight check (Pitfall 6), email→userId resolution (with `--user-id` override), `projects` query, gap-map + per-template plan + Gemini cost estimate, a `--dry-run` early return, and the full live path (generate → snapshot → upload → rewrite) for Plan 02 to invoke.
- All four RESEARCH.md pitfall mitigations baked in: `upsert: true` on the deterministic Storage path (Pitfall 2), `resolveTemplate(id)` for the snapshot rather than the snapped project `template_id` (Pitfall 1), `NEXT_PUBLIC_APP_URL` as the Satori asset origin (Pitfall 3), bucket pre-flight (Pitfall 6).
- A curated `TOPIC_MAP` with one evergreen topic for each of the 16 template ids.
- Added the `"previews"` npm script to `package.json`.

**Task 2 — Wave-0 test scaffolding** (commit `29d32bd`)
- `scripts/__tests__/render-template-previews.test.ts` — 13 pure-helper unit tests, **GREEN**. Imports the helpers directly (no `execSync`, no live DB). Includes the idempotency assertion (`expect(twice).toBe(once)`) and the replace-not-append assertion.
- `src/lib/render/templates/__tests__/code-template-previews.test.ts` — the forcing-function test: every `templates[]` entry has a non-empty https `preview`. **RED-by-design** (URLs are wired by Plan 02); a top-of-file banner documents this so the executor/checker do not treat the RED as a regression.
- `tests/e2e/template-picker-previews.spec.ts` — Playwright picker-smoke skeleton, all bodies wrapped in `test.fixme`. Encodes the post-Plan-03 contract: `<img>` tiles with valid `src`, zero `[data-testid="slide-preview"]` nodes, no broken images (`naturalWidth > 0`). Plan 03 finalizes it.

## Verification Results

- `npx tsc --noEmit` — **20 errors** (== baseline); **zero** in any phase-90-touched file.
- `npx tsx --env-file=.env.local scripts/render-template-previews.ts --dry-run` — exits 0, prints the per-template plan for all 16 templates + `10 gap(s)` cost estimate, ends `STATUS: dry-run ok`, performs **zero** live writes (the run never reaches step 9).
- `npx vitest run scripts/__tests__/render-template-previews.test.ts` — **13/13 passed**, no unhandled errors.
- `npx vitest run src/lib/render/templates/__tests__/code-template-previews.test.ts` — **1 failed (RED)** — expected.
- The 3 render-parity fixture suites (`legacy-templates-byte-identical`, `legacy-templates-regression`, `new-templates-parity`) — **45/45 GREEN** (this plan touches no render code).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Lazy-import `generateCarousel` to keep the dry-run / unit-test path hermetic**
- **Found during:** Task 1 (`--dry-run` verification).
- **Issue:** A static top-level `import { generateCarousel }` pulls in `src/lib/pexels/search-photos.ts`, which constructs the Pexels client at module-load time (`createClient(process.env.PEXELS_API_KEY!)`) and **throws** when the key is absent — crashing `--dry-run` (and any test importing the script) before `requireEnv` can emit its clean message.
- **Fix:** Moved `generateCarousel` to a dynamic `await import(...)` inside the live gap-fill path of `main()`. The dry-run path and the pure-helper tests never load it. Documented with a note at the top of the file.
- **Files modified:** `scripts/render-template-previews.ts`
- **Commit:** `3d5e2ac`

**2. [Rule 1 - Bug] Gate `main()` invocation behind an `isDirectRun` check**
- **Found during:** Task 2 (helper-test run).
- **Issue:** The script invoked `main()` unconditionally at file bottom (`main().catch(...)`). When the Wave-0 unit test imports the module to obtain the pure helpers, `main()` ran, failed its `requireEnv` preflight (no env in vitest), and called `process.exit(1)` — surfacing as a vitest "unhandled error" that "might cause false positive tests."
- **Fix:** Wrapped the `main()` call in an `isDirectRun` guard (`import.meta.url === pathToFileURL(process.argv[1]).href`). The pipeline runs only on direct execution; importing the helpers is now a clean no-op. Verified: helper tests run with zero unhandled errors, and `--dry-run` still executes.
- **Files modified:** `scripts/render-template-previews.ts`
- **Commit:** `29d32bd`

**3. [Rule 3 - Blocking issue] `"previews"` npm script loads `.env.local` via `--env-file`**
- **Found during:** Task 1 (`--dry-run` verification).
- **Issue:** Standalone `tsx` does not auto-load `.env.local` (only `next dev/build` does), so the script's `requireEnv` exited immediately on a missing `NEXT_PUBLIC_SUPABASE_URL`.
- **Fix:** The `"previews"` script is `tsx --env-file=.env.local scripts/render-template-previews.ts`; the module doc-comment documents both `npm run previews` and the direct `--env-file` invocation. (Plan 02's live run uses `npm run previews`.)
- **Files modified:** `package.json`, `scripts/render-template-previews.ts` (doc-comment)
- **Commit:** `3d5e2ac`

### Scope Note — `package.json`

`package.json` is not in this plan's `files_modified`, but the plan's Task 1 `<action>` explicitly instructs adding the `"previews"` script entry and calling it out here. Done — one-line addition mirroring the existing `"thumbs"` entry.

### Out-of-Scope Discovery (not fixed)

A broad `--testNamePattern` run surfaced **12 pre-existing test failures** in unrelated files (editor `text-editor-panel.regression`, auth, etc.) — these match the pre-v2.16 baseline noted in `90-RESEARCH.md` § "tsc / Test Baseline" and are NOT caused by this plan. Per the Scope Boundary they were not fixed. The 3 named render-parity fixture suites this plan must protect are confirmed 45/45 GREEN.

## Notable Dry-Run Output

The live dry-run against `buyer@example.com` found **17 completed carousels** and computed **6 exemplars / 10 gaps** across the 16 templates — a useful preview of Plan 02's expected Gemini spend (~10 Flash text calls).

## Worktree Note

`.env.local` was copied into the worktree from the main repo solely to exercise the live dry-run during verification. It is gitignored (`.env*` rule) and is NOT part of any commit.

## Self-Check: PASSED

- All 5 created/modified files verified present on disk.
- Both task commits (`3d5e2ac`, `29d32bd`) verified in `git log`.
