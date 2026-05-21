# Phase 89: Brand-Kit Shelving (Full Removal) - Research

**Researched:** 2026-05-20
**Domain:** Codebase-wide feature deletion / refactor (Next.js 15 App Router + TypeScript + Supabase)
**Confidence:** HIGH — entire footprint enumerated by grep against the working tree; tsc + parity baselines captured live.

## Summary

This is a deletion/refactor phase, not a feature build. The brand-kit feature touches **79 files** in `src/` (verified by `grep -RIl` across all 8 token variants). The footprint divides cleanly into three buckets: **11 files delete entirely** (the brand-kit library, types, settings UI, API routes, AI merge module, style-from-reference toggle, and their `__tests__` siblings), **~40 files edit-to-strip** (a deep `brandKit` prop-drilling chain through the whole editor + project component tree, plus render/publish/download wiring), and **~28 test files** (some delete outright, most need a brand-kit fixture/assertion arm pruned).

The single highest-risk item is **BKSHELVE-05 byte-identity parity**. Good news verified during research: `mergeWithBrandKit()` is *already a documented no-op* for every non-brand-kit template (its body is literally `return template`), and `synthesizeBrandKitTemplate()` only ever fires when `template_id === 'brand-kit'`. So for any non-brand-kit user/template, removing the brand-kit branch is provably a no-op — the parity suites encode exactly this invariant. The 3 hard-gate suites currently pass **45/45** (verified live). The real risk is mechanical: a careless edit that reorders a code path or changes a default while ripping out the brand-kit conditional.

Two structural items need care: (1) the `BRAND_KIT_TEMPLATE_ID` sentinel (`'brand-kit'`) must survive the library deletion — the `getTemplate()` resolver needs a `'brand-kit' → news-oracle` fallback added; (2) `src/lib/types/style-spec.ts` imports the type alias `BrandKitTextPosition` from `brand-kit.ts`, and a test (`style-spec.test.ts` Test T10) *asserts* that import exists — both must be repointed when `brand-kit.ts` is deleted.

**Primary recommendation:** Remove in dependency order across **4 plans** (UI surfaces → render/publish/download + resolver fallback → AI + style-from-reference → delete library + types + final type-check). Front-load a parity baseline run, keep `tsc --noEmit` clean on touched files at each wave, and treat the 3 fixture suites as the merge gate for every wave that touches render code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template picker tile removal | Frontend (React client component) | — | `template-picker.tsx` is a client component; pure UI delete |
| Settings → Brand Kit page removal | Frontend Server (App Router route) | — | Route segment deletion; 404 is automatic once dir is gone |
| `/api/v1/me/brand-kit/*` route removal | API / Backend | — | Route handlers; 404 automatic on directory deletion |
| Generation-form brand-kit param strip | Frontend → API | — | Prop + request-body field threaded form → action → service |
| Template resolution + `'brand-kit'` fallback | Render / Backend (shared lib) | — | `getTemplate()` in `templates/index.ts` — single resolver all paths share |
| Render parity (byte-identity) | Render (shared lib) | — | `render-slide.ts`, `render-slide-satori.tsx`, `resolve-watermark.ts` |
| AI prompt brand-kit merge removal | Backend (AI lib) | — | `style-spec-brand-kit-merge.ts` is pure server-side |
| Style-from-reference remix toggle | Frontend (client) → Backend (server action) | — | Toggle in shell → `useBrandKitRemix` field → server action |

## Standard Stack

**N/A — this is a removal phase. No new libraries.** No `npm install`. The "stack" here is the codebase's own modules and the existing test runner (`vitest 4.1.0`, verified live).

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` exists in the repo root. Project skills present: `.claude/skills/` symlinks `stripe-best-practices`, `stripe-projects`, `upgrade-stripe` — **all Stripe-related, none relevant to this phase**. No removal/refactor skill exists. Project config (`.planning/config.json`): `mode: yolo`, `granularity: coarse`, `parallelization: true`, `commit_docs: true`, `nyquist_validation: true`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Brand-kit DB data is left dormant.** No forward migration drops `brand_kit` columns or rows. `20260427_brand_kit_template.sql` is marked SHELVED (a doc note — not rolled back). Brand-kit DB rows stay dormant on existing accounts. Reversibility is the priority.
- **Removal is full and forward-only.** No feature flag, no compatibility shim. Delete the code outright. A future revival rebuilds against the same schema rather than toggling old code back on. This means: delete `src/lib/brand-kit/` and `src/lib/types/brand-kit.ts` entirely; remove all imports; remove brand-kit props/params/type-union members from every consumer.
- **Existing `template_id === 'brand-kit'` projects fall back gracefully.** Any project whose stored `template_id` is the brand-kit sentinel (`BRAND_KIT_TEMPLATE_ID`) must resolve to **`news-oracle`** at template-resolution time. It must NOT crash render, publish, fork, or download. The resolver (`resolveTemplate` / `getTemplate`) is the natural place for this fallback.
- **Render parity is the hard gate (BKSHELVE-05).** Byte-identity must be preserved for all 13 code templates + the live DB-backed templates currently in the `templates` table. The 3 fixture suites (`legacy-templates-byte-identical`, `legacy-templates-regression`, `new-templates-parity`) MUST stay GREEN at 45/45. No new fixture regeneration is allowed — if removal changes a rendered byte, that is a regression to fix, not a fixture to re-bless.

### Claude's Discretion

All other implementation choices — exact ordering of file deletions, how to thread the removal through the ~79-file footprint, whether to keep or inline the `BRAND_KIT_TEMPLATE_ID` constant for the fallback check, how to update or delete brand-kit-specific tests — are at Claude's discretion. Use the ROADMAP phase goal, success criteria, REQUIREMENTS.md, and existing codebase conventions.

### Deferred Ideas (OUT OF SCOPE)

- Dropping the brand-kit DB columns/rows — explicitly OUT of scope (left dormant).
- Rolling back the `20260427_brand_kit_template.sql` migration — out of scope.
- Any brand-kit revival / feature-flag — out of scope (removal is forward-only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BKSHELVE-01 | "Your Brand Kit" tile (configured + empty-state CTA) removed from the template picker | `template-picker.tsx` lines 8-9, 17, 35, 42-45, 73-117 — the configured-tile block and `brand-kit-empty` empty-state block. `template-tile-preview.tsx` `brandKit` prop. |
| BKSHELVE-02 | Settings → Brand Kit page removed; `/settings/brand-kit` → 404 | Delete dir `src/app/(dashboard)/settings/brand-kit/`. Nav entry in `settings/layout.tsx` line 12 is **already commented out** — delete the dead comment + the `getBrandKit` import path it documents. Also `app-header.tsx` line 14 (`/settings/brand-kit` href) + `resources/page.tsx` line 209 CTA. |
| BKSHELVE-03 | `/api/v1/me/brand-kit/*` routes removed; openapi schema removed | Delete dir `src/app/api/v1/me/brand-kit/`. Strip `openapi.ts` `BrandKit` schema (lines 265-269) + both `/me/brand-kit` + `/me/brand-kit/logo-upload-url` path objects (lines 1558-1660). No central route table — App Router auto-discovers; deleting the dir yields 404. |
| BKSHELVE-04 | Generation works without a brand-kit param in all code paths | `generation-form.tsx` (`brandKit` prop + `brandKitAvailable` + `useBrandKitRemix` in request body), `style-from-reference/actions.ts` (`brandKit`/`useBrandKitRemix` params), `carousel.ts` (`brandKit`+`useBrandKitRemix` on `GenerateInput` + the `applyBrandKitRemix` call). `project/[id]/actions.ts` has **zero brand-kit refs** despite CONTEXT listing it — verified, skip it. |
| BKSHELVE-05 | Render parity preserved; 3 fixture suites stay GREEN at 45/45 | See `## Common Pitfalls` Pitfall 1 + `## Parity Hard-Gate Risk Analysis`. `mergeWithBrandKit` is already a no-op for built-ins (verified). |
| BKSHELVE-06 | Style-from-reference works without the remix toggle | Delete `brand-kit-remix-toggle.tsx` + its test. Strip `state-machine.ts` (`useBrandKitRemix` + `brandKitAvailable` fields, `TOGGLE_BRAND_KIT_REMIX` + `BRAND_KIT_AVAILABILITY` actions), `style-from-reference-shell.tsx`, `spec-preview-panel.tsx` (`BrandKitRemixToggle` import + render). |
| BKSHELVE-07 | Publish/fork/download free of brand-kit; `'brand-kit'` projects fall back to `news-oracle` | `publish-actions.ts`, `publish.ts`, `download/route.ts`, `render/route.ts` — strip `BRAND_KIT_TEMPLATE_ID`/`synthesizeBrandKitTemplate`/`mergeWithBrandKit`. Add `'brand-kit' → news-oracle` fallback in `getTemplate()`. |
| BKSHELVE-08 | AI prompts free of brand-kit merge logic | Delete `style-spec-brand-kit-merge.ts` + test. `prompts.ts` / `style-spec-projector.ts` / `generate-from-style-spec.ts` have **only comment-mentions** of brand-kit — strip the comments, no logic change. |
| BKSHELVE-09 | `src/lib/brand-kit/` + `src/lib/types/brand-kit.ts` deleted; all 79-file imports resolved | Delete both. **Watch-out:** `style-spec.ts` imports the type alias `BrandKitTextPosition` from `brand-kit.ts` — relocate the alias. `style-spec.test.ts` Test T10 asserts that import exists — update the test. `resolve-watermark.ts` defines its OWN local `BrandKitSubset` — no import to fix there. |
</phase_requirements>

## Exact Footprint Map (79 files)

`grep -RIl -E 'BrandKit|brand-kit|brandKit|BRAND_KIT|synthesizeBrandKitTemplate|mergeWithBrandKit|BRAND_KIT_TEMPLATE_ID|useBrandKitRemix' src/` → **79 files** (verified count).

### Bucket A — DELETE ENTIRELY (11 files)

Sole purpose is brand-kit. Delete the whole file/directory.

| File | Notes |
|------|-------|
| `src/lib/brand-kit/get-effective-template.ts` | The library: `synthesizeBrandKitTemplate`, `mergeWithBrandKit`, `BRAND_KIT_TEMPLATE_ID` |
| `src/lib/brand-kit/get-effective-template.test.ts` | Test for the above (14 hits) |
| `src/lib/types/brand-kit.ts` | `BrandKit` interface + `LogoPosition`/`BrandKitTextAlign`/`BrandKitTextPosition`/`BrandKitHookStyle` aliases — **see Pitfall 2: `BrandKitTextPosition` is consumed by `style-spec.ts`, relocate first** |
| `src/app/(dashboard)/settings/brand-kit/page.tsx` | Settings page |
| `src/app/(dashboard)/settings/brand-kit/actions.ts` | `getBrandKit`/`saveBrandKit`/`uploadLogo`/`extractStyleFromImage` server actions |
| `src/components/brand-kit/brand-kit-form.tsx` | The form component (entire `src/components/brand-kit/` dir) |
| `src/app/api/v1/me/brand-kit/route.ts` | GET/PUT brand-kit API route |
| `src/app/api/v1/me/brand-kit/logo-upload-url/route.ts` | Signed-upload-URL route (entire `src/app/api/v1/me/brand-kit/` dir) |
| `src/lib/ai/style-spec-brand-kit-merge.ts` | `applyBrandKitRemix` pure helper |
| `src/lib/ai/__tests__/style-spec-brand-kit-merge.test.ts` | Test for the above (43 hits) |
| `src/components/style-from-reference/brand-kit-remix-toggle.tsx` | The remix-toggle UI component |
| `src/components/style-from-reference/__tests__/brand-kit-remix-toggle.test.tsx` | Test for the above (45 hits) |

> Note: that's 12 rows — `src/components/brand-kit/` and `src/app/api/v1/me/brand-kit/` are *directories* deleted whole. Count "files" loosely; the planner should delete the directories.

### Bucket B — EDIT TO STRIP (non-test, ~40 files)

Brand-kit is one concern among others. Remove the listed lines/props/branches.

**Render / publish / download (highest parity risk — BKSHELVE-05/07):**

| File | What to remove |
|------|----------------|
| `src/lib/render/render-slide.ts` | L3 `import type { BrandKit }`; L190 `brandKit?` param of `buildSlideElement`; L385 pass `brandKit` → `resolveWatermark` (replace with `null`); L390 comment. **`resolveWatermark` still needs a 1st arg — pass `null`.** |
| `src/lib/render/render-slide-satori.tsx` | L3 `import type { BrandKit }`; L136 `brandKit?` param; L413 `resolveWatermark` call — pass `null`. |
| `src/lib/render/resolve-watermark.ts` | **Decision needed:** the watermark resolver's only data source is brand-kit's `logo_*` fields. With brand-kit gone, `resolveWatermark` always returns `null`. Options: (a) keep the function, callers pass `null`, it short-circuits to `null` — safest, smallest diff, zero parity risk; (b) delete the function + the watermark layer. **Recommend (a)** — it's a documented no-op now and deleting it is extra parity surface. Strip only the comment "Brand-kit watermark resolver" naming and the `BrandKitSubset` interface name if desired. The free-tier forced watermark (render-slide.ts L390) is SEPARATE and stays. |
| `src/lib/render/resolve-per-slide-template.ts` | Comment-only refs (L8, L22-23) — strip comments, no logic change. Helper is already brand-kit-agnostic. |
| `src/app/api/render/route.ts` | L5/L10 imports; L77-94 brand-kit fetch + `synthesizeBrandKitTemplate`/`mergeWithBrandKit` block; L109 `brandKit` arg → drop. `template` resolves via `getTemplate()` only. |
| `src/app/api/v1/projects/[id]/download/route.ts` | L9/L13 imports; L51-65 brand-kit fetch + synth/merge; L87 arg. |
| `src/app/(dashboard)/project/[id]/publish-actions.ts` | L10-17 imports; L39/L80 `brandKit` params; L46-50/L86-89 synth/merge blocks; L58 arg; L203-225 brand-kit fetch + `renderHero`/`renderMinimalHero` brand-kit args. |
| `src/lib/services/publish.ts` | L7-14 imports; L46 `brandKit` param; L53-57 synth/merge; L64 arg; L134-143 brand-kit fetch + `renderHeroBuffer` arg. |
| `src/app/api/admin/seed-explore/route.ts` | L6 `import { mergeWithBrandKit }`; L239 `mergeWithBrandKit(template, null)` → replace with `template` (it was already passing `null`). |

**Generation pipeline (BKSHELVE-04):**

| File | What to remove |
|------|----------------|
| `src/components/slides/generation-form.tsx` | L18 import; L34/L56 `brandKit` prop; L237-238 `useBrandKitRemix`/`brandKit` in request body; L461-462 `brandKit`/`brandKitAvailable` props to child; L530 `brandKit` prop. |
| `src/lib/services/carousel.ts` | L24 `import { applyBrandKitRemix }`; L27 `import type { BrandKit }`; L290 comment; L313-314 `brandKit`/`useBrandKitRemix` on `GenerateInput`; L344-348 the `applyBrandKitRemix` merge step → replace `merged` with `filtered`. |
| `src/app/(dashboard)/style-from-reference/actions.ts` | L44 import; L147 comment; L165-166 `useBrandKitRemix`/`brandKit` params; L259/L398 comments; L405-406 `useBrandKitRemix: false`/`brandKit: null` literals. |

**Picker (BKSHELVE-01):**

| File | What to remove |
|------|----------------|
| `src/components/slides/template-picker.tsx` | L8-9 imports; L17 `brandKit?` prop; L35-44 `isBrandKitConfigured`/`brandKitTemplate`/`isBrandKitSelected`; L73-110 configured-tile JSX block; L112-117 `brand-kit-empty` empty-state JSX block. |
| `src/components/slides/template-tile-preview.tsx` | L8 comment; L14 import; L20/L23 `brandKit` prop; L48 `brandKit` pass-through to `SlidePreview`. |
| `src/components/slides/slide-preview.tsx` | L7 `import type { BrandKit }`; L428 `brandKit?` prop; L586 destructure; L936 comment; L1471/L3721 `resolveWatermark(brandKit ?? null, …)` → `resolveWatermark(null, …)`. |

**Editor + project component tree — the `brandKit` prop-drilling chain.** This is a connected graph: removing the prop from one node forces removing it from every caller and callee. Treat as one atomic unit per plan/wave.

| File | What to remove |
|------|----------------|
| `src/app/(dashboard)/project/[id]/page.tsx` | L16 `import { getBrandKit }`; L53 `const brandKit = …`; L117/L160 `brandKit` props to children. |
| `src/app/(dashboard)/dashboard/page.tsx` | L12 import; L34-44 brand-kit fetch; L131 `brandKit` prop. |
| `src/components/projects/project-card.tsx` | L17 import; L41/L44 `brandKit` prop; L170 pass-through. |
| `src/components/projects/project-list.tsx` | L9 import; L15/L44 `brandKit` prop; L96 pass-through. |
| `src/components/editor/slide-editor.tsx` | L8 `synthesizeBrandKitTemplate`/`BRAND_KIT_TEMPLATE_ID` import; L55 type import; L88/L104 `brandKit` prop; L136-141 synth fallback block; L1524/L1551/L1778/L1826/L1883 pass-throughs. |
| `src/components/editor/slide-list.tsx` | L18 import; L26/L39 prop; L82 pass-through. |
| `src/components/editor/sortable-slide.tsx` | L8 import; L29/L42 prop; L88 pass-through. |
| `src/components/editor/slide-canvas.tsx` | L8 import; L26/L117 prop; L207 pass-through. |
| `src/components/editor/text-editor-panel.tsx` | L12 import; L52/L75 prop; L129 pass-through. |
| `src/components/editor/text-editor-panel-legacy.tsx` | L8 import; L18/L41 prop; L47 `watermarkActive` derived from `brandKit?.logo_url` — remove (legacy panel; verify it's not the active panel). |
| `src/components/editor/elements-panel.tsx` | L32 import; L102/L126 prop; L190 pass-through. |
| `src/components/editor/text-rail/ActiveTextBoxCard.tsx` | L26 import; L32 prop; L87 `brandKit: _brandKit` (already unused — destructure-and-discard). |
| `src/components/editor/text-rail/decoration-card.tsx` | L13 comment; L50 import; L71 prop; L93-103 `brandKitColors()` helper; L118 destructure; L151-165 — swatches `useMemo` merges `brandKitColors(brandKit)` with `derivedPalette`. **Removing `brandKit` here is a real UX change: the color-swatch row loses brand-kit colors and shows only `derivedPalette`. This degrades gracefully (`brandKitColors(null)` already returns `[]`). Acceptable per "full removal" — but note it in the plan.** |

**Other surfaces:**

| File | What to remove |
|------|----------------|
| `src/app/(dashboard)/settings/layout.tsx` | L12 — already a *commented-out* nav entry `// { href: '/settings/brand-kit', … }`. Delete the dead comment. |
| `src/components/layout/app-header.tsx` | L14 — `href="/settings/brand-kit"` link. Remove the nav link. |
| `src/app/(dashboard)/resources/page.tsx` | L209 — CTA `{ label: 'Set up Brand Kit', href: '/settings/brand-kit' }`. Remove the CTA (or repoint). |
| `src/lib/api/openapi.ts` | L265-269 `BrandKit` schema; L1558-1660 `/me/brand-kit` + `/me/brand-kit/logo-upload-url` path objects + their `$ref`s. |
| `src/lib/types/style-spec.ts` | L65 `import type { BrandKitTextPosition }`; L106-110 `hookPosition?: BrandKitTextPosition`. **Relocate the alias (see Pitfall 2).** |
| `src/lib/ai/style-spec-projector.ts` | L53/L243 comment-only mentions — strip comments. |
| `src/lib/ai/prompts.ts` | L308 comment-only mention. |
| `src/lib/ai/generate-from-style-spec.ts` | L286 comment-only mention. |
| `src/components/style-from-reference/state-machine.ts` | L79-81 `useBrandKitRemix`/`brandKitAvailable` state fields; L103/L106 `TOGGLE_BRAND_KIT_REMIX`/`BRAND_KIT_AVAILABILITY` actions; L119-120 initial values; L163-164 preserved fields; L216-219/L235-236 reducer cases. |
| `src/components/style-from-reference/style-from-reference-shell.tsx` | L44 import; L62-63 props; L75/L129/L166 comments; L170-171 hydration `useEffect`; L274-275/L303/L307 `useBrandKitRemix`/`brandKit` wiring; L361 prop pass-through. |
| `src/components/style-from-reference/spec-preview-panel.tsx` | L19 import; L27 `BrandKitRemixToggle` import; L33 prop; L100-105 the `data-testid="brand-kit-slot"` slot + `<BrandKitRemixToggle>` render. |

**FALSE POSITIVES — comment-only "brand-kit" mentions, no code change required (leave as-is or optionally tidy):**

| File | Why it's a false positive |
|------|---------------------------|
| `src/lib/types/projects-storage-constants.ts` | L27 — comment "mirrors brand-kit-logo path-safety". No code. |
| `src/lib/storage/upload-reference-validation.ts` | L59/L107 — comments "Mirrors the brand-kit-logos route". No code. |
| `src/app/api/style-references/upload-url/route.ts` | L7 — comment "divergences from the original brand-kit logo-upload-url". No code. |
| `src/components/dashboard/reference-image-uploader.tsx` | L4 — comment "Mirrors BrandKitLogoUploader naming convention". No code. |
| `src/lib/profile/reserved-usernames.ts` | L24 — `'brand-kit'` is a *reserved username* string. Harmless to keep (still a reasonable reserved word); leave it unless the plan wants tidiness. |
| `src/lib/storage/__tests__/upload-reference-validation.test.ts` | 1 comment hit only. |
| `src/app/api/style-references/upload-url/__tests__/route.test.ts` | 2 comment hits only. |

### Bucket C — TEST FILES

**Delete outright (3, sole-purpose brand-kit tests):** already listed in Bucket A —
`get-effective-template.test.ts`, `style-spec-brand-kit-merge.test.ts`, `brand-kit-remix-toggle.test.tsx`.

**Edit to strip brand-kit assertion/fixture (test still has non-brand-kit value):**

| Test file | Brand-kit content to strip |
|-----------|----------------------------|
| `src/__tests__/components/template-picker.test.tsx` | 20 hits — brand-kit tile assertions + `brandKit` prop in render setup. Picker test stays (covers other picker behavior). **Also a PREVIEW-05 target — Phase 90 rewrites it; coordinate.** |
| `src/__tests__/render/per-slide-template-override.test.tsx` | L7/L9 imports; L106-113 `makeBrandKit`; L200-213 "brand-kit precedence" test case → delete that `it()` block; keep the override/precedence tests for registry templates. |
| `src/lib/render/__tests__/resolve-per-slide-template.test.ts` | L4/L6 imports; L42-52 `makeBrandKit`; L122-141 Test 6 + Test 7 brand-kit `it()` blocks → delete. Keep registry-template tests. |
| `src/lib/render/__tests__/parity.quick-260511-uk1-snapshot-template.test.tsx` | 24 hits — **this entire test pins "renderer is brandKit-independent".** Once `brandKit` params are gone, the test's premise (compare brandKit-non-null vs null arm) is moot. **Delete the file** — the invariant it guards is structurally eliminated by the removal. |
| `src/lib/render/__tests__/parity.publish-render-vs-slide-preview.test.tsx` | 27 hits — same: pins publish-path brand-kit independence. **Delete the file.** |
| `src/lib/render/__tests__/parity.test.tsx` | L17 import; L1246-1311 — brand-kit slot supplied so a floor test runs. Strip the brand-kit fixture + `brandKit` args; keep the floor test (it tests non-brand-kit behavior). |
| `src/lib/render/resolve-watermark.test.ts` | 15 hits — if `resolveWatermark` is kept (recommended), this test stays but its `baseBrandKit` fixture becomes a plain `LogoPositionKey`-ish object. If `resolveWatermark` is deleted, delete this test. |
| `src/__tests__/render/new-templates-parity.test.tsx` | A **BKSHELVE-05 hard-gate suite** — currently NO direct brand-kit code refs in the grep beyond being a render test; it's listed in the 79 only via a token match. Verify; it should need **zero edits** and stay GREEN. |
| `src/app/(dashboard)/project/[id]/__tests__/forked-project-references-strip.test.tsx` | 8 hits + imports `settings/brand-kit/actions` — strip brand-kit fork assertions. |
| `src/app/(dashboard)/project/[id]/__tests__/regenerate-button-wire.test.ts` | 1 hit — likely a `brandKit` prop in a render-stub. Trivial strip. |
| `src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts` | 2 hits — `useBrandKitRemix`/`brandKit` in action input fixtures. |
| `src/components/editor/__tests__/text-editor-panel.regression.test.tsx` | 1 hit — `brandKit` prop in render-stub. |
| `src/components/editor/text-rail/__tests__/decoration-card.test.tsx` | 6 hits — brand-kit swatch assertions + `brandKit` prop. Strip the swatch-from-brand-kit assertions; keep `derivedPalette` swatch tests. |
| `src/components/slides/__tests__/generation-form-routing.test.tsx` | 2 hits — `brandKit` prop in render setup. |
| `src/components/style-from-reference/__tests__/recovery-integration.test.tsx` | 8 hits — `brandKitAvailable`/`useBrandKitRemix` state in recovery scenarios. |
| `src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx` | 16 hits — `brand-kit-slot` testid + toggle assertions. Strip brand-kit assertions; keep panel tests. |
| `src/components/style-from-reference/__tests__/state-machine.test.ts` | 14 hits — `TOGGLE_BRAND_KIT_REMIX`/`BRAND_KIT_AVAILABILITY` reducer tests → delete those `it()` blocks. |
| `src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx` | 13 hits — brand-kit prop + toggle render assertions. |
| `src/lib/services/__tests__/carousel-from-references.test.ts` | 34 hits — heavy `applyBrandKitRemix`/`useBrandKitRemix` coverage. Strip brand-kit merge assertions; keep the non-brand-kit generation tests. |
| `src/lib/services/__tests__/publish-style-spec-snapshot.test.ts` | 10 hits — `brandKit` arg in publish call setup. |
| `src/lib/services/__tests__/publish-template-id-snapshot.test.ts` | 10 hits — `brandKit` arg in publish call setup. |
| `src/lib/types/__tests__/style-spec.test.ts` | 5 hits — **Test T10 (L169-181) asserts `style-spec.ts` imports from `@/lib/types/brand-kit`.** Once the `BrandKitTextPosition` alias is relocated, this assertion regex MUST be updated to the new module path (see Pitfall 2). T5 (L117-124) uses `BrandKitTextPosition` — repoint its import. |

> **Phase-90 overlap note:** `template-picker.test.tsx` and `template-tile-preview.tsx` are also in Phase 90's PREVIEW-04/05 scope. Phase 89 should make the *minimal* brand-kit strip; Phase 90 does the `<img>`-rewrite. Don't over-rewrite the picker test in 89.

## The `BRAND_KIT_TEMPLATE_ID` Fallback Question (BKSHELVE-07)

**Where the resolver lives:** `src/lib/render/templates/index.ts` L260-262:
```typescript
export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
```
This is the **single** template-by-id resolver. Every render path (`render/route.ts`, `download/route.ts`, `publish.ts`, `publish-actions.ts`, `slide-editor.tsx`) calls `getTemplate(project.template_id)`. There is no separate `resolveTemplate` — `getTemplate` is it. (Verified: only one `export function getTemplate` in `src/`.)

**Current behavior for `template_id === 'brand-kit'`:** today, callers special-case it *before* calling `getTemplate` — `template_id === BRAND_KIT_TEMPLATE_ID ? synthesizeBrandKitTemplate(brandKit) : getTemplate(template_id)`. Once that branch is deleted, a `'brand-kit'` id falls through to `getTemplate('brand-kit')`, which currently returns `templates[0]` = `highlight-bar` (the registry's first entry, a HIDDEN-from-picker legacy template). That "works" (no crash) but BKSHELVE-07 + CONTEXT lock the fallback to **`news-oracle`**, not `highlight-bar`.

**Recommended fix — single defensive line in `getTemplate()`:**
```typescript
export function getTemplate(id: string): SlideTemplate {
  // Phase 89 (BKSHELVE-07): legacy projects saved against the shelved
  // brand-kit feature carry template_id === 'brand-kit'. The brand-kit
  // library is gone; resolve the sentinel to a sensible live default.
  const resolvedId = id === 'brand-kit' ? 'news-oracle' : id
  return templates.find((t) => t.id === resolvedId) ?? templates[0]
}
```
**Why here:** every render/publish/fork/download path funnels through `getTemplate()`, so one line covers all four. **Inline the literal `'brand-kit'`** — do NOT keep `get-effective-template.ts` alive just for the `BRAND_KIT_TEMPLATE_ID` constant (CONTEXT explicitly permits inlining). A one-line `// 'brand-kit' is the shelved sentinel` comment documents it.

**Per-slide override path:** `resolve-per-slide-template.ts` takes a *caller-resolved* `projectTemplate` — it never resolves an id itself, so it inherits the fix automatically. Per-slide `template_id_override` values also flow through `getTemplate()` (verified `resolve-per-slide-template` is brand-kit-agnostic), so an overridden `'brand-kit'` is covered too.

**Is any production project actually `template_id === 'brand-kit'`?** **UNKNOWABLE from code** — that's a DB-data question and the DB is left dormant (no migration, no read in this phase). The fallback must therefore be **defensive regardless** — assume at least one such project exists. A `getTemplate('brand-kit')` unit test asserting `news-oracle` is the cheap proof.

## Parity Hard-Gate Risk Analysis (BKSHELVE-05)

**The 3 hard-gate suites — verified locations + live status:**

| Suite (describe-name / file) | File | Status (verified live) |
|------------------------------|------|------------------------|
| legacy-templates-byte-identical | `src/__tests__/render/legacy-templates-byte-identical.test.ts` | GREEN |
| legacy-templates-regression | `src/__tests__/render/legacy-templates-regression.test.tsx` | GREEN |
| new-templates-parity | `src/__tests__/render/new-templates-parity.test.tsx` | GREEN |

`npx vitest run` on all three → **45 passed (45)**, 765ms. This is the baseline the phase must preserve.

**Brand-kit code paths that feed rendering:**
1. `mergeWithBrandKit(template, brandKit)` — called in `render/route.ts`, `download/route.ts`, `publish.ts`, `publish-actions.ts`. **Body is `return template`** (verified — see `get-effective-template.ts` L35-40). The function comment (quick-260510-brand-kit-scope) documents it: "this is now a passthrough — for any built-in template." → **Removing it is a provable no-op.** Just delete the call and use `template` directly.
2. `synthesizeBrandKitTemplate(brandKit)` — only ever assigned when `template_id === BRAND_KIT_TEMPLATE_ID`. For any non-brand-kit template the ternary's else-branch (`getTemplate(...)`) was already taken. → **Removing it changes nothing for non-brand-kit templates.**
3. `resolveWatermark(brandKit ?? null, slide, …)` — in `render-slide.ts` L385, `render-slide-satori.tsx` L413, `slide-preview.tsx` L1471/L3721. `resolveWatermark` **short-circuits to `null` when `brandKit` is null/has no `logo_url`** (verified L57-58). For any user without a brand kit it already returns `null`. Passing literal `null` is byte-identical to passing a `brandKit` with no logo. → **No-op for the parity fixtures** (fixtures use templates, not brand-kit logos).

**The pre-existing parity tests already encode this invariant** — `parity.quick-260511-uk1-snapshot-template.test.tsx` exists *specifically* to prove "renderer is brandKit-independent for every built-in template." That test passing today is the proof that removing brand-kit is safe; it becomes redundant *after* removal (delete it, per Bucket C).

**Where removal could change a rendered byte for a NON-brand-kit template — the things to flag:**
- **`buildSlideElement` argument-position drift.** `buildSlideElement(slide, effectiveTemplate, brandKit, ownerTier, origin, ctx, dbTemplates)` — `brandKit` is positional arg #3. Removing it shifts `ownerTier`/`origin`/`ctx`/`dbTemplates` left by one. **Every call site AND the function signature must change together in the SAME commit.** A half-applied edit → wrong arg bound to wrong param → silent render corruption that parity catches but only after the fact. *This is the #1 mechanical risk.* Consider: keep arg #3 but pass `null`/drop it cleanly in one atomic edit per renderer.
- **`effectiveTemplate` vs `template`.** Callers compute `const effectiveTemplate = mergeWithBrandKit(template, brandKit)` then pass `effectiveTemplate`. Replacing with `template` is safe ONLY because `mergeWithBrandKit` is a no-op — but the variable rename must be total (don't leave a dangling `effectiveTemplate`).
- **Default-value drift in `getTemplate()`.** Adding the `'brand-kit' → news-oracle` line must NOT change the `?? templates[0]` fallback for any *other* unknown id. The recommended one-liner preserves it.
- **`resolveWatermark` deletion (if chosen).** If the plan deletes `resolveWatermark` instead of keeping it as a `null`-returning no-op, the watermark `<img>` layer disappears from the render tree. For users with a brand-kit logo that's intended; for users without one it was already absent. **But** the layer's mere presence/absence in the element tree could shift sibling z-index/DOM order. **Recommendation: KEEP `resolveWatermark`, pass `null`** — zero parity surface. This is the safer call.

**Mitigation protocol for the plan:**
1. Wave 0 / first task: run the 3 suites, record 45/45 GREEN as the baseline artifact.
2. After EVERY wave that touches `src/lib/render/` or publish/download: re-run the 3 suites. Must stay 45/45.
3. Treat any non-green as a regression to *fix in place* — never regenerate a fixture (CONTEXT lock).
4. Final phase gate: full 3-suite run + `tsc --noEmit` delta check.

## Common Pitfalls

### Pitfall 1: `buildSlideElement` positional-argument shift
**What goes wrong:** `brandKit` is a *positional* parameter (#3) of `buildSlideElement` and a param of the publish/render helpers. Removing it in the signature without simultaneously fixing every call site silently re-binds later args (`ownerTier`, `origin`, `ctx`, `dbTemplates`) to the wrong positions — `tsc` may even *pass* if types are loosely compatible, and the failure surfaces only as a corrupted render.
**Why it happens:** signature edit and call-site edits land in different commits/files.
**How to avoid:** Edit the signature and all call sites in ONE atomic commit. Prefer dropping `brandKit` entirely (not replacing with `null`) so a stale call site fails to type-check loudly. Re-run parity suites immediately.
**Warning signs:** parity fixture diff on a template you didn't touch; `tsc` green but a render test red.

### Pitfall 2: `BrandKitTextPosition` type alias is consumed outside brand-kit
**What goes wrong:** `src/lib/types/brand-kit.ts` exports `BrandKitTextPosition = 'top' | 'center' | 'bottom'`. `src/lib/types/style-spec.ts` (L65, L110) imports it for `StyleSpecLayout.hookPosition`. Deleting `brand-kit.ts` breaks `style-spec.ts` → cascades to everything importing `StyleSpec`. Worse: `style-spec.test.ts` **Test T10 (L169-181) asserts** the source string contains `from '@/lib/types/brand-kit'` — that test will FAIL by design when the import moves.
**Why it happens:** the alias looks brand-kit-owned but is a generic 3-value union.
**How to avoid:** Before deleting `brand-kit.ts`: (a) move the `'top'|'center'|'bottom'` type into `style-spec.ts` itself (inline it — it's 3 literals) or into a neutral module; (b) update `style-spec.ts` L65/L110; (c) update `style-spec.test.ts` T5 import + **rewrite T10's expected-imports regex** to drop the `brand-kit` entry (and add the new source module if you relocated rather than inlined). `resolve-watermark.ts` is NOT affected — it defines its own local `BrandKitSubset` interface, no import.
**Warning signs:** post-deletion `tsc` errors in `style-spec.ts` and a red `style-spec.test.ts` T10.

### Pitfall 3: deleting `resolveWatermark` over-extends the parity surface
**What goes wrong:** the temptation to "fully remove brand-kit" extends to deleting `resolveWatermark` + the watermark render layer. That changes the render element tree for *all* users (the `<img>` layer vanishes), adding parity risk for zero requirement benefit.
**How to avoid:** `resolveWatermark` already returns `null` for any null/logo-less input. Keep it; callers pass `null`. The free-tier forced watermark is a separate code path and stays. (BKSHELVE-07 says strip `BRAND_KIT_TEMPLATE_ID`/`synthesize`/`merge` — it does NOT mandate deleting the watermark resolver.)

### Pitfall 4: mid-removal dangling imports break unrelated waves
**What goes wrong:** deleting `src/lib/brand-kit/` before its consumers are stripped leaves dangling imports → every importer fails to compile → `tsc`/`vitest` red across files the wave never touched.
**How to avoid:** dependency-ordered removal (see below) — leaf consumers first, shared library LAST. Each wave must be independently `tsc --noEmit`-clean.

### Pitfall 5: `actions.ts` in `project/[id]/` is a phantom target
**What goes wrong:** CONTEXT.md L50 lists `src/app/(dashboard)/project/[id]/actions.ts` as a generation consumer. **Verified: it has ZERO brand-kit references.** A plan that allocates a task to "strip brand-kit from project actions.ts" will find nothing.
**How to avoid:** The generation-pipeline brand-kit code lives in `style-from-reference/actions.ts` and `carousel.ts`, not `project/[id]/actions.ts`. Use this RESEARCH's footprint map, not CONTEXT's approximate list.

### Pitfall 6: `settings/layout.tsx` nav entry is already dead
**What goes wrong:** plan allocates work to "remove the Brand Kit nav link from settings layout" — but L12 is already a *commented-out* line. The active nav link to strip is in `app-header.tsx` L14 and the `resources/page.tsx` L209 CTA.
**How to avoid:** treat `settings/layout.tsx` as a trivial dead-comment cleanup; the real user-facing links are `app-header.tsx` + `resources/page.tsx`.

## `tsc --noEmit` Baseline

`npx tsc --noEmit` on the working tree → **20 pre-existing errors** (verified 2026-05-20). All 20 are in **test files**, none in production source. Categorized:

| Cluster | Files | Error |
|---------|-------|-------|
| Vitest mock-callable typing | `__tests__/auth/*` (logout, middleware ×5, signup ×2), `__tests__/projects/crud.test.ts`, `__tests__/stripe/sync-subscription.test.ts` | TS2348 "Value of type 'Mock<…>' is not callable" |
| Stripe mock upsert | `__tests__/stripe/sync-subscription.test.ts` (×3) | TS2353/TS2339 `upsert` not on mock type |
| `Record<string,unknown>` casts | `__tests__/api/api-keys.test.ts`, `__tests__/render/db-template-parity.test.tsx` | TS2352 conversion-may-be-mistake |
| Spread/tuple | `editor/__tests__/slide-editor.treatment-sync.test.tsx` | TS2556 |
| Legal audit-log result type | `lib/legal/__tests__/audit-log.test.ts` (×2) | TS2339 `error` not on result |
| Storage mock generics | `lib/services/__tests__/projects-delete.test.ts` (×2) | TS2322 mock param mismatch |

**None of the 20 are in brand-kit files.** The executor's rule: after each wave, `npx tsc --noEmit 2>&1 | grep -cE 'error TS'` must stay **≤ 20**, AND no new error may name a brand-kit-touched file. A count of 20 with the same file:line set = clean. Any *new* line = a removal-introduced break.

> Caveat: stripping brand-kit assertions from `style-spec.test.ts` / `resolve-per-slide-template.test.ts` etc. may legitimately *reduce* the count if a stripped test happened to carry one of these errors — a count *below* 20 is fine, a count *above* 20 (or a new brand-kit-named file) is the failure signal.

## Removal Ordering

Dependency-ordered so no import dangles mid-removal and each wave is independently `tsc`-clean. Direction: **leaf consumers → shared callers → shared library → types**.

1. **Leaf UI surfaces** (no other module imports them): picker tile, settings page/route, API routes, `app-header` link, `resources` CTA, style-from-reference toggle component. These import brand-kit; nothing imports *them* for brand-kit. Safe to gut first.
2. **`applyBrandKitRemix` consumers** then the module: strip `carousel.ts` + `style-from-reference/actions.ts` call sites, then the `style-from-reference` shell/panel/state-machine, *then* delete `style-spec-brand-kit-merge.ts`.
3. **Render/publish/download wiring**: strip `render/route.ts`, `download/route.ts`, `publish.ts`, `publish-actions.ts`, `seed-explore/route.ts`, the renderers (`render-slide*.tsx`), `slide-preview.tsx`, and the editor/project prop-drill chain. Add the `getTemplate()` fallback here.
4. **Relocate `BrandKitTextPosition`** out of `brand-kit.ts` into `style-spec.ts`; fix `style-spec.test.ts`.
5. **Delete the shared library + types LAST**: `src/lib/brand-kit/` and `src/lib/types/brand-kit.ts`. By now nothing imports them. A clean `tsc --noEmit` here is the integration proof.

Within step 3, the `buildSlideElement` signature + all its call sites must change in one atomic unit (Pitfall 1).

## Suggested Plan Breakdown

`granularity: coarse` + 79 files → **4 plans**, each coherent and independently verifiable. Cross-plan dependency is strictly linear (P1→P2→P3→P4); the library delete in P4 depends on all consumers being stripped first.

### Plan 1 — UI surfaces (BKSHELVE-01, -02, -03)
Picker tile (`template-picker.tsx`, `template-tile-preview.tsx`) + Settings page/dir + `/api/v1/me/brand-kit/*` routes + `openapi.ts` schema + `app-header.tsx` link + `resources/page.tsx` CTA + `settings/layout.tsx` dead comment. Delete `src/components/brand-kit/` + `src/app/(dashboard)/settings/brand-kit/` + `src/app/api/v1/me/brand-kit/`.
**Verification:** `/settings/brand-kit` → 404; `/api/v1/me/brand-kit` → 404; picker renders without the tile; `tsc --noEmit` ≤ baseline on touched files.
**Note:** These dirs' deletion creates dangling imports in `project/[id]/page.tsx` (`getBrandKit`) — that import is removed in Plan 2. **Either** sequence Plan 1's `settings/brand-kit/` deletion to also touch `project/[id]/page.tsx` L16/L53, **or** keep `settings/brand-kit/actions.ts` until Plan 2. Recommend: strip the `page.tsx` brand-kit import in Plan 1 too (it's a leaf consumer of the deleted module).

### Plan 2 — Render / publish / download + resolver fallback (BKSHELVE-05, -07)
`render/route.ts`, `download/route.ts`, `publish.ts`, `publish-actions.ts`, `seed-explore/route.ts`, `render-slide.ts`, `render-slide-satori.tsx`, `slide-preview.tsx`, the editor + project prop-drill chain (`slide-editor`, `slide-list`, `sortable-slide`, `slide-canvas`, `text-editor-panel`, `text-editor-panel-legacy`, `elements-panel`, `ActiveTextBoxCard`, `decoration-card`, `project-card`, `project-list`, `dashboard/page`, `project/[id]/page`). Add the `getTemplate()` `'brand-kit' → news-oracle` line. Delete `parity.quick-260511-uk1-snapshot-template.test.tsx` + `parity.publish-render-vs-slide-preview.test.tsx`; strip brand-kit from `parity.test.tsx`, `per-slide-template-override.test.tsx`, `resolve-per-slide-template.test.ts`.
**Verification — THE HARD GATE:** 3 fixture suites GREEN at 45/45; `getTemplate('brand-kit')` returns `news-oracle` (new unit test). This is the highest-risk plan — keep `buildSlideElement` signature + call sites atomic.

### Plan 3 — AI prompts + style-from-reference (BKSHELVE-04, -06, -08)
`generation-form.tsx`, `carousel.ts`, `style-from-reference/actions.ts`, `style-from-reference-shell.tsx`, `spec-preview-panel.tsx`, `state-machine.ts`, comment-strips in `prompts.ts`/`style-spec-projector.ts`/`generate-from-style-spec.ts`. Delete `brand-kit-remix-toggle.tsx` + its test + `style-spec-brand-kit-merge.ts` + its test. Strip brand-kit from the style-from-reference + carousel + generation-form test files.
**Verification:** generation works without a brand-kit param; style-from-reference renders without the toggle; generation snapshot regression unchanged for no-brand-kit users (BKSHELVE-08); `tsc` clean.

### Plan 4 — Delete library + types + final type-check (BKSHELVE-09)
Relocate `BrandKitTextPosition` into `style-spec.ts`; fix `style-spec.ts` import + `style-spec.test.ts` T5/T10. Delete `src/lib/brand-kit/` + `src/lib/types/brand-kit.ts`. Resolve any last dangling import. Final `grep -RIl` for the 8 brand-kit tokens → should return only the documented false positives (or zero).
**Verification:** `npx tsc --noEmit` count ≤ 20 with no brand-kit-named file; full 3-suite parity run GREEN; `grep -RIl 'BrandKit\|synthesizeBrandKit\|mergeWithBrandKit\|BRAND_KIT_TEMPLATE_ID\|useBrandKitRemix' src/` → empty (the only acceptable remainders are the comment-only false positives + the `'brand-kit'` reserved username if kept).

**Cross-plan dependencies:** strictly P1 → P2 → P3 → P4. P4's library delete REQUIRES every consumer stripped (P1-P3). P2's `getTemplate()` fallback is independent of P1/P3 but conventionally lands with the render work. Plans are NOT parallelizable against each other (shared library is the chokepoint) — but tasks *within* a plan can parallelize where they touch disjoint files.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest 4.1.0` (verified live) |
| Config file | `vitest.config.*` at repo root (project uses standard vitest discovery) |
| Quick run command | `npx vitest run <path>` (single-file/dir, ~0.7s for 3 suites) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BKSHELVE-01 | Picker has no brand-kit tile | unit (component) | `npx vitest run src/__tests__/components/template-picker.test.tsx` | ✅ (edit) |
| BKSHELVE-02 | `/settings/brand-kit` 404 | manual / smoke | route-segment deletion — 404 is structural; manual Playwright check | ⚠️ manual |
| BKSHELVE-03 | `/api/v1/me/brand-kit` 404 | manual / smoke | dir deletion — 404 structural; manual check | ⚠️ manual |
| BKSHELVE-04 | Generation works w/o brand-kit param | unit | `npx vitest run src/lib/services/__tests__/carousel-from-references.test.ts src/components/slides/__tests__/generation-form-routing.test.tsx` | ✅ (edit) |
| BKSHELVE-05 | Render parity 45/45 | unit (fixture) | `npx vitest run src/__tests__/render/legacy-templates-byte-identical.test.ts src/__tests__/render/legacy-templates-regression.test.tsx src/__tests__/render/new-templates-parity.test.tsx` | ✅ (no edit — must stay green) |
| BKSHELVE-06 | Style-from-ref works w/o toggle | unit | `npx vitest run src/components/style-from-reference/__tests__/state-machine.test.ts src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx` | ✅ (edit) |
| BKSHELVE-07 | `getTemplate('brand-kit')` → `news-oracle` | unit | `npx vitest run src/lib/render/templates/__tests__/` (add a case) | ❌ Wave 0 — new test case for the fallback |
| BKSHELVE-08 | AI copy unchanged for no-brand-kit users | unit (snapshot/regression) | `npx vitest run src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx` + existing style-spec snapshots | ✅ (no edit) |
| BKSHELVE-09 | No dangling imports | type-check | `npx tsc --noEmit 2>&1 \| grep -cE 'error TS'` ≤ 20, no brand-kit file | ✅ baseline captured |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` on touched files + the nearest unit test (`npx vitest run <touched test>`).
- **Per wave merge:** the 3 BKSHELVE-05 fixture suites (`npx vitest run src/__tests__/render/legacy-templates-byte-identical.test.ts src/__tests__/render/legacy-templates-regression.test.tsx src/__tests__/render/new-templates-parity.test.tsx`) + full `npx tsc --noEmit` count.
- **Phase gate:** full `npx vitest run` (no NEW failures vs. the pre-existing baseline) + 3 fixture suites GREEN at 45/45 + `grep` footprint sweep empty.

### Wave 0 Gaps
- [ ] `src/lib/render/templates/__tests__/getTemplate-brand-kit-fallback.test.ts` (or add a case to an existing `templates/__tests__/` file) — asserts `getTemplate('brand-kit').id === 'news-oracle'` and `getTemplate('brand-kit')` does not throw. Covers BKSHELVE-07.
- [ ] No framework install needed — `vitest 4.1.0` already present.
- [ ] No shared fixtures needed — removal phase reuses existing fixtures; **no fixture regeneration allowed** (CONTEXT lock).

## Runtime State Inventory

This phase is a code refactor with the DB explicitly left dormant. Runtime-state check:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `projects.template_id === 'brand-kit'` rows MAY exist (unknowable from code — DB not read this phase). `brand_kit` table rows exist on accounts that configured a kit. | **No data migration** (CONTEXT lock — DB dormant). Code-side defensive fallback only: `getTemplate()` resolves `'brand-kit' → news-oracle`. |
| Live service config | None — no external service stores the string "brand-kit" in UI/runtime config. Supabase Storage bucket `brand-kit-logos` exists (referenced in the deleted `logo-upload-url/route.ts`). | Bucket left dormant (consistent with "DB dormant" — no orphan-bucket cleanup in scope). |
| OS-registered state | None — no Task Scheduler / cron / pm2 entry references brand-kit. | None. |
| Secrets / env vars | None — no env var or SOPS key named for brand-kit. | None. |
| Build artifacts / installed packages | None — no compiled artifact or npm package carries the name. Next.js `.next/` build cache will rebuild clean on next build. | None — standard rebuild. |

**Canonical question — "after every file is updated, what runtime systems still have the old string?":** Only the **DB** (`projects.template_id`, `brand_kit` table) and the **`brand-kit-logos` Storage bucket** — all three deliberately left dormant per the locked decision. The `getTemplate()` fallback is the sole defensive measure for the one DB value that flows into live code paths.

## Environment Availability

Phase is pure code/config change within the repo. External deps for *verification only*:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `vitest` | Test suites / parity gate | ✓ | 4.1.0 | — |
| `tsc` (typescript) | Type-check baseline | ✓ | (project-pinned) | — |
| Node / `npx` | Running tooling | ✓ | (project runtime) | — |

No missing dependencies. No new runtime/service needed.

## Security Domain

`security_enforcement` is not set to `false` in config (`.planning/config.json` has no key → treat as enabled). This is a **deletion** phase — it *reduces* attack surface (removes 2 API route handlers + a server-action module). No new code paths, no new input boundaries.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth code touched. |
| V3 Session Management | no | No session code touched. |
| V4 Access Control | minor | Deleting `/api/v1/me/brand-kit/*` removes authed endpoints — a *reduction*; ensure no other route still references them (verified: only `download/route.ts` matched, and that's a comment, not a call). |
| V5 Input Validation | minor | `openapi.ts` `BrandKit` request schema is removed — the public API no longer accepts the field (BKSHELVE-04 requirement). Confirm no validation layer references the removed schema `$ref`. |
| V6 Cryptography | no | None. |

| Threat Pattern | STRIDE | Mitigation |
|----------------|--------|------------|
| Dangling `$ref` to deleted `BrandKit` schema → openapi doc generation error | Denial of Service (minor) | Remove all `$ref: '#/components/schemas/BrandKit'` occurrences in the same edit as the schema deletion. |
| Legacy `template_id === 'brand-kit'` un-handled → render crash on a public published page | Denial of Service | `getTemplate()` defensive fallback (BKSHELVE-07). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `news-oracle` is a valid, present, picker-visible template id usable as the brand-kit fallback target. | Resolver fallback | LOW — verified `news-oracle` is in the registry array (`templates/index.ts` L201) and is a picker keeper (not in `HIDDEN_FROM_PICKER`). Confirmed, not really an assumption. |
| A2 | No production project actually has `template_id === 'brand-kit'`. | Resolver fallback | This is explicitly UNKNOWABLE from code — treated as "assume it exists" → defensive fallback required regardless. Not a blocking assumption (the fallback is mandatory either way). |
| A3 | `text-editor-panel-legacy.tsx` is dead/legacy and its `watermarkActive` brand-kit logic can be stripped without UX impact. | Bucket B | LOW-MEDIUM — file is named `-legacy`; verify it's not the active text panel before stripping. If still wired, the watermark-active indicator just disappears (acceptable for full removal). |
| A4 | `vitest.config` uses standard discovery; the full-suite command is `npx vitest run`. | Validation Architecture | LOW — vitest 4.1.0 confirmed running; exact config path not opened but `npx vitest run <path>` worked live. |

## Open Questions

1. **Keep `resolveWatermark` as a `null`-returning no-op, or delete it?**
   - What we know: brand-kit is its only data source; it already returns `null` for logo-less input; keeping it is zero parity risk.
   - What's unclear: whether the team wants the dead function gone for cleanliness.
   - Recommendation: **KEEP it**, callers pass `null`. Smaller diff, zero parity surface. Revisit deletion in a later cleanup quick-task if desired.

2. **Does `text-editor-panel-legacy.tsx` still render anywhere?**
   - What we know: it's named `-legacy` and carries a `brandKit`-derived `watermarkActive`.
   - What's unclear: whether any route still mounts it.
   - Recommendation: a quick `grep` for `text-editor-panel-legacy` import sites during Plan 2; if unused, it's a candidate for outright deletion (out of scope unless trivial) — otherwise just strip the brand-kit prop.

3. **`'brand-kit'` reserved username — keep or remove?**
   - What we know: `reserved-usernames.ts` L24 lists `'brand-kit'`.
   - Recommendation: harmless to keep (still a sensible reserved word); leave it unless the plan wants a clean sweep. Not requirement-blocking.

## Sources

### Primary (HIGH confidence)
- Working-tree `grep -RIl`/`grep -RIn` across `src/` for all 8 brand-kit tokens — the authoritative 79-file footprint, line-level.
- `src/lib/render/templates/index.ts` (read in full) — `getTemplate()` definition + registry.
- `src/lib/brand-kit/get-effective-template.ts` (read in full) — `mergeWithBrandKit` no-op confirmed.
- `src/lib/types/brand-kit.ts` (read in full) — `BrandKitTextPosition` alias.
- `src/lib/types/style-spec.ts` L60-115 + `src/lib/types/__tests__/style-spec.test.ts` L165-181 — the cross-module type coupling + T10 assertion.
- `npx tsc --noEmit` — live 20-error baseline.
- `npx vitest run` on the 3 fixture suites — live 45/45 GREEN baseline.
- `.planning/phases/89-.../89-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`.

### Secondary (MEDIUM confidence)
- None — no web research; this is a codebase-internal removal.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Footprint map: HIGH — every one of 79 files grepped at line level; buckets assigned from actual content.
- Parity risk analysis: HIGH — `mergeWithBrandKit` no-op verified by reading the source; 45/45 baseline run live.
- Resolver fallback: HIGH — `getTemplate()` is the single resolver, verified; `news-oracle` confirmed in registry.
- Plan breakdown: MEDIUM-HIGH — ordering is dependency-sound; exact task granularity is the planner's call.

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable — codebase-internal; re-verify the 79-file count + tsc baseline if other work lands on `src/` before planning).
