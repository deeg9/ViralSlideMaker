# Phase 89: Brand-Kit Shelving (Full Removal) - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — user chose ROADMAP as spec)

<domain>
## Phase Boundary

Fully remove the brand-kit feature from the user-facing app, types, render/publish/download wiring, AI prompts, and style-from-reference flow — without breaking v2.13/v2.14/v2.15 render or generation parity. The DB schema is left dormant (NOT migrated).

Maps requirements BKSHELVE-01 through BKSHELVE-09 (see `.planning/REQUIREMENTS.md`).

</domain>

<decisions>
## Implementation Decisions

These are LOCKED from `.planning/REQUIREMENTS.md` "Locked Decisions" and the milestone scope — do not revisit:

### Brand-kit DB data is left dormant
No forward migration drops `brand_kit` columns or rows. The `20260427_brand_kit_template.sql` migration is marked SHELVED (a comment/doc note — not rolled back). Brand-kit DB rows stay dormant on existing accounts. Reversibility is the priority.

### Removal is full and forward-only
No feature flag, no compatibility shim. Delete the code outright. A future revival rebuilds against the same schema rather than toggling old code back on. This means: delete `src/lib/brand-kit/` and `src/lib/types/brand-kit.ts` entirely; remove all imports; remove brand-kit props/params/type-union members from every consumer.

### Existing `template_id === 'brand-kit'` projects fall back gracefully
Any project whose stored `template_id` is the brand-kit sentinel (`BRAND_KIT_TEMPLATE_ID`) must resolve to a sensible default template — **`news-oracle`** — at template-resolution time. It must NOT crash render, publish, fork, or download. The resolver (`resolveTemplate` / `getTemplate`) is the natural place for this fallback.

### Render parity is the hard gate (BKSHELVE-05)
Byte-identity must be preserved for all 13 code templates + the live DB-backed templates currently in the `templates` table. The 3 fixture suites (`legacy-templates-byte-identical`, `legacy-templates-regression`, `new-templates-parity`) MUST stay GREEN at 45/45. No new fixture regeneration is allowed — if removal changes a rendered byte, that is a regression to fix, not a fixture to re-bless.

### Claude's Discretion
All other implementation choices — the exact ordering of file deletions, how to thread the removal through the ~79-file footprint, whether to keep or inline the `BRAND_KIT_TEMPLATE_ID` constant for the fallback check, how to update or delete brand-kit-specific tests — are at Claude's discretion. Use the ROADMAP phase goal, success criteria, REQUIREMENTS.md, and existing codebase conventions.

</decisions>

<code_context>
## Existing Code Insights

Known footprint (from milestone scoping — verify and expand during plan-phase research):

- **Picker:** `src/components/slides/template-picker.tsx` (lines ~72–130 hold the configured tile + empty-state CTA), `src/components/slides/template-tile-preview.tsx` (passes `brandKit` to `<SlidePreview>`).
- **Brand-kit library:** `src/lib/brand-kit/get-effective-template.ts` (`synthesizeBrandKitTemplate`, `mergeWithBrandKit`, `BRAND_KIT_TEMPLATE_ID`), `src/lib/brand-kit/get-effective-template.test.ts`, `src/lib/types/brand-kit.ts`.
- **Settings:** `src/app/(dashboard)/settings/brand-kit/page.tsx` + `actions.ts`, nav entry in `src/app/(dashboard)/settings/layout.tsx`, `src/components/brand-kit/brand-kit-form.tsx`.
- **API:** `src/app/api/v1/me/brand-kit/route.ts`, `src/app/api/v1/me/brand-kit/logo-upload-url/route.ts`, `/api/v1/me/brand-kit` schema in `src/lib/api/openapi.ts`.
- **Render/publish/download:** `src/app/api/render/route.ts`, `src/app/api/v1/projects/[id]/download/route.ts`, `src/app/(dashboard)/project/[id]/publish-actions.ts`, `src/lib/services/publish.ts`, `src/lib/render/render-slide.ts`, `src/lib/render/render-slide-satori.tsx`, `src/lib/render/resolve-per-slide-template.ts`, `src/lib/render/resolve-watermark.ts`.
- **AI:** `src/lib/ai/style-spec-brand-kit-merge.ts` + its test, `src/lib/ai/prompts.ts`, `src/lib/ai/style-spec-projector.ts`, `src/lib/ai/generate-from-style-spec.ts`.
- **Style-from-reference:** `src/components/style-from-reference/brand-kit-remix-toggle.tsx` + its test, `state-machine.ts`, `style-from-reference-shell.tsx`, `spec-preview-panel.tsx`.
- **Generation:** `src/components/slides/generation-form.tsx`, `src/app/(dashboard)/project/[id]/actions.ts`, `src/lib/services/carousel.ts`.
- ~79 files total reference `BrandKit` / `brand-kit` / `brandKit` — `grep -RIl` is the source of truth; plan research must enumerate them precisely.

The codebase pattern-mapper / phase-researcher will produce the authoritative file list during plan-phase.

</code_context>

<specifics>
## Specific Ideas

- Approach the removal in dependency order: leaf consumers and UI first (picker tile, settings page, API routes), then the shared library (`src/lib/brand-kit/`, types), so no import dangles mid-removal.
- The `BRAND_KIT_TEMPLATE_ID` sentinel value is still needed for the `template_id === 'brand-kit'` graceful-fallback check in the resolver — even after the library is deleted. Decide whether to inline the literal `'brand-kit'` string at the resolver or keep a tiny constant. Either is fine; do not keep the whole `get-effective-template.ts` module alive just for the constant.
- `tsc --noEmit` must be clean on touched files. Full type-check after removal is the integration proof that no import dangles.
- The 3 render-parity fixture suites are the BKSHELVE-05 hard gate — run them explicitly after removal.

</specifics>

<deferred>
## Deferred Ideas

- Dropping the brand-kit DB columns/rows — explicitly OUT of scope (left dormant).
- Rolling back the `20260427_brand_kit_template.sql` migration — out of scope.
- Any brand-kit revival / feature-flag — out of scope (removal is forward-only).

</deferred>
