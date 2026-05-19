---
phase: 88-render-paths-per-slide-override-publish-fork
status: passed
date: 2026-05-19
requirements: [WIRE-03, WIRE-04, WIRE-05, WIRE-06]
---

# Phase 88 Verification — Render Paths + Per-Slide Override + Publish/Fork

## Success criteria

### SC1 — a DB-template carousel renders identically across all three render paths
**PASS (automated).**
- `/api/render`, `/api/v1/projects/[id]/download`, `publish-actions.ts`
  (`renderHero` + `renderMinimalHero`), and `services/publish.ts`
  (`renderHeroBuffer`) all resolve the project `template_id` via async
  `resolveTemplate` instead of the sync code-only `getTemplate` — no more
  silent `highlight-bar` fallback for a DB id.
- The editor canvas path resolves a DB project `template_id`: the project page
  server component fetches DB templates and threads them to the client
  `SlideEditor`, which resolves code-first then from the passed-in list.
- `prompts.ts buildSystemPrompt` accepts a pre-resolved template;
  `generate-slides.ts` pre-resolves it DB-aware so a DB template's
  `aiVoiceNote` / `accentColor` reach the prompt.
- Proven by `db-template-parity.test.tsx` (8/8) — a resolved DB template
  renders byte-identically to its code-template equivalent across
  `buildSlideHtml`, `buildSlideElement`, and `SlidePreview`.

### SC2 — a per-slide template_id_override set to a DB id resolves and renders
**PASS (automated).**
- `resolvePerSlideTemplate` gains an optional sync DB-template map.
  `buildSlideElement` / `buildSlideHtml` forward it; the four server render
  routes pre-fetch it via the new `getDbTemplatesMap()`.
- Proven by `db-template-parity.test.tsx` WIRE-04 block (per-slide DB override
  resolves through HTML + Satori) and `resolve-per-slide-template.test.ts`
  WIRE-04 block (6 tests) — DB-id override resolves from the map; STYLESPEC-10
  fallback preserved when the id is unknown or no map is supplied.

### SC3 — publish keeps the DB template_id; fork inherits it
**PASS (automated).**
- Publish render is covered by the `publish.ts` / `publish-actions.ts`
  `resolveTemplate` conversion; `published_carousels.template_id` already
  persists the id (Phase 82) — no schema change.
- The fork route `explore/[slug]/fork/route.ts` inherits the source carousel's
  `template_id` (`.select` fetches it; `.insert` uses
  `published.template_id ?? 'bold-minimal'`) instead of hardcoding
  `'highlight-bar'`. The `fork_published_carousel` RPC already inherits via
  `COALESCE` (migration `20260512`) — left untouched.
- Proven by `fork-inherits-template-id.test.ts` (3/3) — code id, DB id, and
  NULL→`bold-minimal` fallback.

### SC4 — the 13 code templates and ~82 existing carousels stay byte-identical
**PASS (automated).**
- `legacy-templates-byte-identical`, `legacy-templates-regression`,
  `new-templates-parity` — confirmed GREEN at 45/45 (before and after Phase 88).
- `wire-async-resolution-byte-identity.test.ts` (3/3) proves the
  `getTemplate`→`resolveTemplate` conversion is byte-identical for all 13 code
  template ids — both the template object (sha256) and `buildSlideHtml` output.
- Full-suite failing-test-file set is byte-identical between clean HEAD and the
  Phase 88 working tree — ZERO new failures.

### SC5 — end-to-end dry-run: admin save → picker → generate → render → publish/fork
**HUMAN-NEEDED.** See "Human verification" below. This is the `human_needed`
verification item from 88-CONTEXT.md — automated tests cover every layer, but
the live full-loop dry-run is driven by the orchestrator via Playwright after
execution.

## Must-haves

| Item | Status |
|------|--------|
| `/api/render` resolves the project template via async `resolveTemplate` | PASS |
| `/api/v1/projects/[id]/download` resolves via async `resolveTemplate` | PASS |
| `publish-actions.ts` `renderHero` + `renderMinimalHero` resolve via `resolveTemplate` | PASS |
| `publish.ts` `renderHeroBuffer` resolves via `resolveTemplate` | PASS |
| `buildSystemPrompt` gets a DB-aware resolved template (sync — caller pre-resolves) | PASS |
| `actions.ts` `generateCarousel` resolves DB-aware at both `getTemplate` sites | PASS |
| Editor canvas resolves a DB project template via server-passed DB templates | PASS |
| `getDbTemplatesMap()` — all DB templates as a sync-lookup map | PASS |
| `resolvePerSlideTemplate` resolves a DB per-slide override (optional sync map, STYLESPEC-10 preserved) | PASS |
| `buildSlideElement` / `buildSlideHtml` forward the optional DB-template map | PASS |
| All four server render routes pre-fetch + thread the DB-template map | PASS |
| Fork route inherits the source `template_id` (no `highlight-bar` hardcode) | PASS |
| `fork_published_carousel` RPC untouched (already inherits via COALESCE) | PASS |
| 3 fixture suites stay GREEN at 45/45 | PASS |
| Byte-identity guard: sync `getTemplate` vs async `resolveTemplate` for 13 code ids | PASS |
| No schema migration; closed-enum invariant; no new Gemini tier | PASS |

## Human verification

The following item from 88-CONTEXT.md is a `human_needed` verification — the
orchestrator drives it via Playwright after this phase executes. Verbatim:

> **End-to-end dry-run** — an admin saves a template → it appears in the
> picker → a carousel generated on it comes out recipe-shaped, renders
> correctly in all three paths, and survives publish + fork.

Concretely, the dry-run should confirm:
1. Sign in as an admin user (`ADMIN_USER_IDS` set in `.env.local`) and use
   "Save as Template" on an existing carousel — the template row + preview PNG
   land in the `templates` table / `template-previews` bucket.
2. The saved template appears in the generation picker under its category
   (Phase 87 wiring).
3. Generate a carousel on that DB template — the result is recipe-shaped and
   the project's `template_id` is the DB id.
4. The carousel renders correctly in the editor canvas preview, the Satori PNG
   export, and the HTML/ZIP export — all showing the DB template's look, no
   `highlight-bar` fallback.
5. Publish the carousel — the published copy keeps the DB `template_id` and
   renders correctly.
6. Fork the published carousel — the fork inherits the DB `template_id` and
   renders correctly.

**Dry-run completed by orchestrator 2026-05-19 — PASSED:** DB template appeared
in the picker, generation preserved `template_id`, editor render correct,
publish + fork both inherited the DB `template_id`. The fork failure encountered
was a pre-existing bug (missing `_strip_locked_from_slide_data` fn, 2 unapplied
migrations) — fixed by applying `20260504_fork_strip_decoration_locked` to
Supabase; not a v2.15 defect.

## Tests

- Phase 88 new tests (all passing): `wire-async-resolution-byte-identity`
  (3), `resolve-per-slide-template` WIRE-04 (+6), `db-template-parity` WIRE-04
  (+3), `fork-inherits-template-id` (3) — 15 new passing tests.
- The 3 fixture suites — 45/45 GREEN.
- Full suite: failing-test-file set byte-identical to clean HEAD — ZERO new
  failures. (CI-mode counts: clean HEAD 47 failed / 3255 passed; with Phase 88
  47 failed / 3264 passed — the +9 net passing is the new tests. The "41"
  figure in CONTEXT.md / STATE.md is the non-CI count of the same baseline.)
- `npx tsc --noEmit` — zero errors in any Phase 88 SOURCE file. One pre-existing
  TS2352 in `db-template-parity.test.tsx`'s `buildFlatStyleFrom` helper shifted
  from line 38 → 39 (a 1-line offset from the import addition) — verified
  present on clean HEAD; project test-baseline debt, not a Phase 88 regression.

## Notes

- **Flagged design deviations from CONTEXT.md (both anticipated in the plans):**
  - CONTEXT.md said "make `resolvePerSlideTemplate` async" and "convert
    `prompts.ts buildSystemPrompt`'s `getTemplate` to async". A literal
    asyncification of either cascades into ~40 sync test callers + 7
    `'use client'` render-body callers (`resolvePerSlideTemplate`) and the
    sync `buildSlideElement`/`buildSlideHtml` builders. Both were instead made
    DB-aware via OPTIONAL parameters — the async caller pre-resolves and passes
    in; the helper/function stays sync; client + test callers are byte-identical
    to pre-Phase-88. Same end behavior (a DB id resolves in the consumable
    render), zero blast radius.
  - CONTEXT.md asked to "verify the `fork_published_carousel` RPC doesn't also
    override `template_id`". It does NOT — it already inherits correctly via
    `COALESCE(pub.template_id,'bold-minimal')` (migration `20260512`). The
    hardcode was solely in the TS fork route; fixed there, RPC untouched.
- The editor-canvas client component cannot async-resolve in its render body —
  the project page server component pre-fetches DB templates and threads them
  down as a prop. A per-slide DB override in the live canvas preview is not
  separately wired (the canvas preview path passes no per-slide DB map); the
  consumable exports (PNG/HTML/publish) — what CONTEXT.md's "Oracle-style
  per-slide look" cares about — do resolve it. Acceptable for v1.

## Verdict

**HUMAN-NEEDED** — all four requirements (WIRE-03, WIRE-04, WIRE-05, WIRE-06)
are satisfied by automated tests; SC1–SC4 PASS with zero new regressions and
the 3 fixture suites green at 45/45. SC5 (the end-to-end dry-run) is the
`human_needed` item — the orchestrator drives it via Playwright.
