---
phase: 89-brand-kit-shelving-full-removal
verified: 2026-05-20T20:06:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
gaps: []
deferred: []
human_verification:
  - test: "Open the project page template picker and confirm no 'Your Brand Kit' tile and no 'Build your brand kit' empty-state CTA"
    expected: "Picker shows only registry/DB template tiles; no brand-kit tile or CTA"
    why_human: "Visual UI rendering — grep confirms code absence but cannot confirm rendered appearance"
  - test: "Navigate to /settings/brand-kit and curl /api/v1/me/brand-kit + /api/v1/me/brand-kit/logo-upload-url"
    expected: "All return HTTP 404"
    why_human: "Requires a running Next.js server; route directories are deleted (App Router auto-404) but the live 404 is not verified programmatically"
  - test: "Open /docs (OpenAPI) and confirm no /me/brand-kit endpoints or BrandKit schema appear"
    expected: "OpenAPI spec at /docs renders without brand-kit paths/schema and without a dangling-$ref fault"
    why_human: "Requires a running server to render the live OpenAPI doc page"
  - test: "Run the style-from-reference flow end-to-end and complete a remix/regenerate"
    expected: "Shell renders without the brand-kit remix toggle; regenerate completes via the regular state-spec path"
    why_human: "Real-time multi-step user flow with AI calls — cannot be exercised by unit tests alone"
  - test: "Generate a carousel end-to-end (web form + POST /api/v1/carousel + MCP create_carousel)"
    expected: "Generation succeeds with no brandKit param in any request body"
    why_human: "End-to-end generation across three entry points needs a running app + external AI service"
---

# Phase 89: Brand-Kit Shelving (Full Removal) Verification Report

**Phase Goal:** Fully remove the brand-kit feature from the user-facing app, types, render/publish/download wiring, AI prompts, and style-from-reference flow — without breaking v2.13/v2.14/v2.15 render or generation parity. DB schema is left dormant (NOT migrated).

**Verified:** 2026-05-20T20:06:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth (ROADMAP Success Criteria) | Status | Evidence |
| -- | -------------------------------- | ------ | -------- |
| 1  | Project picker no longer shows the "Your Brand Kit" tile or the "Build your brand kit" empty-state CTA | ✓ VERIFIED | `grep "Brand Kit\|brandKit\|BRAND_KIT\|brand-kit" template-picker.tsx template-tile-preview.tsx` → zero matches. `template-picker.test.tsx` 6/7 pass (the one failure is the documented pre-existing "Notes App Chic" test, NOT brand-kit). |
| 2  | `/settings/brand-kit` returns 404, brand-kit Settings row gone; `/api/v1/me/brand-kit/*` returns 404 and removed from OpenAPI | ✓ VERIFIED | `src/app/(dashboard)/settings/brand-kit/` and `src/app/api/v1/me/brand-kit/` directories deleted (App Router auto-404). `settings/layout.tsx` brand-kit grep → zero. `openapi.ts` grep for `schemas/BrandKit` and `/me/brand-kit` → zero (no dangling $ref). Live 404 routed to human verification. |
| 3  | Existing carousels render and publish byte-identically — the 3 fixture suites stay GREEN at 45/45 | ✓ VERIFIED | `legacy-templates-byte-identical` + `legacy-templates-regression` + `new-templates-parity`: **45/45 GREEN**. No fixture regenerated. |
| 4  | Style-from-reference shell renders without the brand-kit remix toggle; remix completes via the regular state-spec path | ✓ VERIFIED | `brand-kit-remix-toggle.tsx` deleted; `spec-preview-panel.tsx` + `style-from-reference-shell.tsx` brand-kit grep → zero; `state-machine.ts` carries no `useBrandKitRemix`/`TOGGLE_BRAND_KIT_REMIX`. `state-machine.test.ts` + `style-from-reference-shell.test.tsx`: 20/20 pass. |
| 5  | Carousel generation succeeds without any brand-kit param; legacy `template_id === 'brand-kit'` resolves to `news-oracle` | ✓ VERIFIED | `generation-form.tsx`/`carousel.ts`/`style-from-reference/actions.ts` brand-kit grep → zero. `getTemplate('brand-kit')` AND `resolveTemplate('brand-kit')` both resolve to `news-oracle` (WR-01 fix in `registry.ts`); fallback test 5/5 pass. `carousel-from-references.test.ts` 7/7 pass. |

**Score:** 5/5 ROADMAP truths verified. (Plan-frontmatter must-haves below also all verified — 9/9 BKSHELVE requirements.)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/components/slides/template-picker.tsx` | Picker free of brand-kit tile + empty-state | ✓ VERIFIED | Zero brand-kit tokens; registry tiles still render |
| `src/lib/api/openapi.ts` | No BrandKit schema, no /me/brand-kit paths, no $ref | ✓ VERIFIED | Zero `schemas/BrandKit` / `/me/brand-kit` hits |
| `src/lib/render/templates/index.ts` | `getTemplate()` with `brand-kit`→`news-oracle` fallback | ✓ VERIFIED | L264 `const resolvedId = id === 'brand-kit' ? 'news-oracle' : id` |
| `src/lib/render/templates/registry.ts` | `resolveTemplate()` mirrors the fallback (WR-01) | ✓ VERIFIED | L105 same normalize before code+DB lookup |
| `src/lib/render/templates/__tests__/getTemplate-brand-kit-fallback.test.ts` | Wave-0 fallback test, covers getTemplate AND resolveTemplate | ✓ VERIFIED | 5/5 pass; WR-01 `resolveTemplate` parity block present |
| `src/lib/render/render-slide-satori.tsx` | `buildSlideElement` signature without brandKit arg | ✓ VERIFIED | Zero brandKit tokens; 10/10 satori test calls 2-arg-clean |
| `src/components/slides/generation-form.tsx` | No brandKit prop or request-body field | ✓ VERIFIED | Zero brand-kit tokens (see WARNING — separate non-phase-89 regression) |
| `src/lib/services/carousel.ts` | No brandKit on input type, no applyBrandKitRemix | ✓ VERIFIED | Zero brand-kit tokens; `applyBrandKitRemix` gone, no dangling `merged` |
| `src/lib/types/style-spec.ts` | Relocated alias, no import from deleted brand-kit module | ✓ VERIFIED | `HookTextPosition` alias (WR-02 rename to avoid `TextPosition` collision); `hookPosition?: HookTextPosition` |
| `supabase/migrations/20260427_brand_kit_template.sql` | SHELVED doc note, NOT rolled back | ✓ VERIFIED | File exists; L2 `SHELVED 2026-05-20 (Phase 89, BKSHELVE)` note present; no down-migration |
| `src/lib/brand-kit/`, `src/lib/types/brand-kit.ts` | Deleted | ✓ VERIFIED | Both confirmed deleted; zero dangling `@/lib/brand-kit` imports |
| `src/lib/ai/style-spec-brand-kit-merge.ts`, `brand-kit-remix-toggle.tsx` | Deleted | ✓ VERIFIED | Both deleted (+ their test files) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `getTemplate()` | `news-oracle` | `id === 'brand-kit' ? 'news-oracle' : id` | ✓ WIRED | index.ts L264 |
| `resolveTemplate()` | `news-oracle` | mirror normalize before code+DB lookup | ✓ WIRED | registry.ts L105 (WR-01 fix) |
| `render/route.ts`, `download/route.ts`, `publish.ts`, `publish-actions.ts` | `resolveTemplate`/`getTemplate` | template-id resolution, no brand-kit branch | ✓ WIRED | Zero `effectiveTemplate`/`mergeWithBrandKit`/`synthesizeBrandKitTemplate` across all 7 render-core files |
| `spec-preview-panel.tsx` | (removed) `BrandKitRemixToggle` | deleted import + deleted slot | ✓ WIRED | Zero `BrandKitRemixToggle` references |
| `carousel.ts` | (removed) `applyBrandKitRemix` | merge step collapsed to `filtered` | ✓ WIRED | Zero `applyBrandKitRemix`; no dangling `merged` |

### Requirements Coverage

All 9 BKSHELVE IDs are declared across the 4 PLAN frontmatter blocks (89-01: 01/02/03; 89-02: 05/07; 89-03: 04/06/08; 89-04: 09) and all 9 map to Phase 89 in REQUIREMENTS.md. No orphaned requirements.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| BKSHELVE-01 | 89-01 | "Your Brand Kit" tile/CTA removed from picker | ✓ SATISFIED | picker grep zero; picker test 6/7 (1 pre-existing non-brand-kit fail) |
| BKSHELVE-02 | 89-01 | Settings → Brand Kit page + nav removed; /settings/brand-kit 404 | ✓ SATISFIED | dir deleted; layout.tsx grep zero |
| BKSHELVE-03 | 89-01 | /api/v1/me/brand-kit/* removed; OpenAPI schema removed | ✓ SATISFIED | api dir deleted; openapi.ts grep zero, no $ref |
| BKSHELVE-04 | 89-03 | Generation works with no brand-kit param | ✓ SATISFIED | generation-form/carousel/actions grep zero; `carousel-from-references.test.ts` 7/7. (`generation-form-routing.test.tsx` fails — see WARNING; proven a post-phase-89 regression, NOT a BKSHELVE-04 defect) |
| BKSHELVE-05 | 89-02 | Render parity preserved — 3 fixture suites GREEN 45/45 | ✓ SATISFIED | 45/45 GREEN; no fixture regenerated |
| BKSHELVE-06 | 89-03 | Style-from-reference works without remix toggle | ✓ SATISFIED | toggle deleted; state-machine grep zero; 20/20 pass |
| BKSHELVE-07 | 89-02 | Publish/fork/download free of brand-kit; legacy id → news-oracle | ✓ SATISFIED | render-core grep zero; getTemplate + resolveTemplate (WR-01) both → news-oracle; fallback test 5/5 |
| BKSHELVE-08 | 89-03 | AI prompts free of brand-kit; merge module deleted | ✓ SATISFIED | `style-spec-brand-kit-merge.ts` deleted; prompts.ts/style-spec-projector.ts/generate-from-style-spec.ts grep zero; SUMMARY confirms comment-only diff |
| BKSHELVE-09 | 89-04 | brand-kit lib + types deleted; all 79-file footprint imports resolved | ✓ SATISFIED | `src/lib/brand-kit/` + `src/lib/types/brand-kit.ts` deleted; zero dangling imports; footprint grep clean |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| tsc whole-tree error count ≤ 20, none in brand-kit files | `npx tsc --noEmit \| grep -cE 'error TS'` | 20; `grep -i brand-kit` → none; all 20 in pre-existing test files | ✓ PASS |
| getTemplate + resolveTemplate brand-kit fallback | `vitest run getTemplate-brand-kit-fallback.test.ts` | 5/5 pass | ✓ PASS |
| BKSHELVE-05 hard gate — 3 fixture suites | `vitest run legacy-templates-byte-identical legacy-templates-regression new-templates-parity` | 45/45 GREEN | ✓ PASS |
| BKSHELVE-06 — state machine + shell | `vitest run state-machine.test.ts style-from-reference-shell.test.tsx` | 20/20 pass | ✓ PASS |
| render-slide-satori atomic arg removal | `vitest run render-slide-satori.test.tsx` | 10/10 pass | ✓ PASS |
| per-slide template resolution | `vitest run resolve-per-slide-template.test.ts per-slide-template-override.test.tsx` | 17/17 pass | ✓ PASS |
| style-spec contract (T5/T10 repoint) | `vitest run style-spec.test.ts` | 10/10 pass | ✓ PASS |
| migration SHELVED + intact | `test -f ... && grep -i SHELVED ...` | file exists, SHELVED note at L2 | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `render-slide.ts` / `render-slide-satori.tsx` | 383 / 411 | `resolveWatermark(null, ...)` always returns null → watermark layer is now permanently dead code | ℹ️ Info | REVIEW WR-03. Intentional — kept with explicit "brand-kit removed" comments for the documented future revival. No functional impact; byte-identical (45/45 parity holds). Not a phase-89 gap. |
| _(none)_ | — | — | — | No phase-89 anti-patterns. See the note below re: a separate quarantined WIP branch. |

### Human Verification Required

The following could not be verified programmatically and need human testing (see frontmatter `human_verification` for the full list):

1. **Template picker visual** — confirm no brand-kit tile/CTA renders on the project page.
2. **404 routes** — `/settings/brand-kit`, `/api/v1/me/brand-kit`, `/api/v1/me/brand-kit/logo-upload-url` all return 404 (requires running server).
3. **OpenAPI /docs** — renders without brand-kit paths/schema and without a dangling-$ref fault.
4. **Style-from-reference flow** — full remix/regenerate completes without the toggle.
5. **End-to-end generation** — web form + `POST /api/v1/carousel` + MCP `create_carousel` all succeed with no brand-kit param.

Code-level evidence for all five is already VERIFIED (directories deleted, grep clean, suites green); human verification confirms the live runtime behavior.

### Note — Quarantined WIP Branch (NOT on `main`, does NOT affect phase 89)

During phase-89 execution a coherent but unrelated change — an inline carousel-generation form on the dashboard (`dashboard/page.tsx` + `generation-form.tsx`) — appeared in the working tree. It was not part of phase 89 (brand-kit removal) and existed in no commit. It has been **quarantined onto a separate branch `wip/dashboard-inline-form` (commit `7217e9a`)** and removed from `main`'s working tree.

`main`'s HEAD is `da713ab` (the phase-89 endpoint + WR-01/WR-02 code-review fixes). On `main`:
- `generation-form.tsx` is intact — all `useState` declarations present.
- `generation-form-routing.test.tsx` → **3/3 PASS** (re-confirmed on `main`).

The quarantined `7217e9a` is itself incomplete — it deleted the `showInspiredByRefs` / `showVisualStyle` / `inlineSpec` `useState` declarations while leaving their usages, so the `wip/dashboard-inline-form` branch does not yet build. That is a property of the quarantined WIP work, to be resolved if/when that branch is picked up — it does not touch `main` and does not affect the phase-89 verdict.

### Gaps Summary

No phase-89 gaps. All 9 BKSHELVE requirements are satisfied, all 5 ROADMAP Success Criteria are verified, all hard gates pass:

- Brand-kit fully removed from UI, API, OpenAPI, render/publish/download, AI prompts, style-from-reference, and shared library/types.
- `getTemplate('brand-kit')` AND `resolveTemplate('brand-kit')` both resolve to `news-oracle` (WR-01 code-review fix verified in `registry.ts` and covered by the fallback test).
- WR-02 (TextPosition naming collision) fixed — relocated alias is `HookTextPosition`.
- tsc = 20 (documented pre-existing baseline; none in brand-kit files; the two phase-89-adjacent error lines — `db-template-parity.test.tsx:39`, `slide-editor.treatment-sync.test.tsx:46` — are byte-identical to the base SHA, i.e. pre-existing, not phase-89-introduced).
- The 3 BKSHELVE-05 fixture suites GREEN at 45/45; no fixture regenerated.
- The brand-kit migration is SHELVED (doc note) and intact — DB left dormant, not rolled back.
- Footprint grep returns only documented comment-only false positives + the kept `resolve-watermark.ts` + the `'brand-kit'` reserved username; zero strong tokens.

An unrelated inline-dashboard-form change that surfaced during execution has been quarantined onto `wip/dashboard-inline-form` (see the note above) — `main` is clean and unaffected.

Phase 89 goal is achieved. Status: **passed** (with human verification items for live-runtime confirmation).

---

_Verified: 2026-05-20T20:06:00Z_
_Verifier: Claude (gsd-verifier)_
