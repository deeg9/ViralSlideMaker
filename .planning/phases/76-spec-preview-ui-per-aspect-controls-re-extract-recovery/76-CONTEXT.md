# Phase 76: Spec Preview UI + Per-Aspect Controls + Re-Extract + Recovery - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Smart-discuss — UX shape locked in research/FEATURES.md (Swipe Carousel pattern); locked decisions cover most grey areas

<domain>
## Phase Boundary

Stand the mandatory non-skippable spec-preview panel between extraction and emit so users see exactly what will be applied, can toggle aspects off, and have a recovery path when references are flagged or blocked. Includes the new dashboard route that embeds the Phase 74 `<ReferenceImageUploader>` and the new spec-preview surface that consumes the Phase 75 `extractStyleSpec` Server Action.

12 reqs in scope: PREVIEW-01..12. Phase 76 is the **UI phase** of v2.13. Phase 77 (emit integration) wires the "Generate" CTA from this preview to the slide-emit pipeline.

**The mandatory non-skippable spec-preview (PREVIEW-01) is THE single biggest UX defense** — without it, "I uploaded my friend's slideshow and got something nothing like it" is unrecoverable; with it, the user sees the extracted spec BEFORE generation and can re-extract or adjust before consuming credits on emit.

</domain>

<decisions>
## Implementation Decisions

### Locked specs (from REQUIREMENTS.md + research)
- **Mandatory non-skippable preview (PREVIEW-01):** spec-preview panel renders BETWEEN extraction-complete and emit-trigger; user MUST see it before generating. No "skip preview" toggle.
- **Per-aspect checkboxes (PREVIEW-06):** user toggles `palette / typography / layout / decorations` independently; emit only applies CHECKED aspects (Phase 77 reads these toggles)
- **Re-extract free retries (PREVIEW-07):** 2 free retries per generation; 3rd attempt requires fresh upload OR consumes a credit
- **Brand kit toggle (PREVIEW-08):** "Remix with Brand Kit" — visible only when user has a brand kit configured; per-field merge (extracted color × brand kit color → brand kit wins for that field if toggled)
- **Sticky reference thumbnails (PREVIEW-09):** uploaded references stay visible throughout the spec-preview + emit flow as a top strip
- **Inline refusal warning (PREVIEW-10):** when EXTRACT-05 flags logo/face/watermark, render an inline warning with "Inspired by"-framing copy + confirm-and-continue
- **Visible credit cost (PREVIEW-11):** UI shows "Generating will use N credits" before the user clicks Generate
- **Safety-block recovery UI (PREVIEW-12):** when extract returns `safety_blocked`, render specific guidance ("Try cropping high-skin areas / try a different image / describe the style in text instead")
- **Spec preview UI elements (PREVIEW-02..05):** palette swatches (4–6 colors with hex labels), font category badges, layout sketch (schematic), sanitized voice_note caption

### Claude's Discretion
- **Route location:** new `/dashboard/style-from-reference/new` route page (cleaner deep-link future) — NOT a modal. Modal would be faster to ship but blocks future "share this style spec" deep links
- **State machine:** explicit state transitions: `upload → extracting → preview → confirming → generating → done` (or error states `cap_reached / safety_blocked / extraction_failed`); recommend zustand or useReducer for explicit-state-machine pattern (mirror existing editor reducer)
- **Layout sketch (PREVIEW-04):** simple SVG schematic showing hook position on a 9:16 frame (top/middle/bottom × left/center/right grid) + 1-line indicator for body density (sparse/medium/dense) + small icons for decoration density. NOT a full slide preview render.
- **Per-aspect toggle defaults:** all 4 aspects checked by default (high-fidelity intent matches user's explicit "Extract style" click)
- **Re-extract counter UI:** "2 retries remaining" badge near the re-extract button; updates on click
- **Brand kit toggle position:** beside the per-aspect checkboxes (visually grouped with "what to apply" controls)
- **Refusal warning placement:** inline next to the flagged reference thumbnail in the sticky strip, NOT a separate banner
- **Recovery UI placement:** replaces the spec-preview panel when extract returns `safety_blocked`; shows specific guidance + "try different image" CTA + "describe in text" alternative path (alternative path defers to Phase 77 emit's user-copy mode)
- **Credit cost display:** shown next to the Generate CTA: `Generate (1 credit)` with a tooltip explaining the cost model
- **Component organization:** `src/components/style-from-reference/` directory containing `<SpecPreviewPanel>`, `<RefusalWarning>`, `<SafetyBlockRecovery>`, `<PerAspectToggles>`, `<PaletteSwatches>`, `<FontCategoryBadges>`, `<LayoutSketch>`. Page in `src/app/(dashboard)/style-from-reference/new/page.tsx` composes these.
- **Server Action:** `src/app/(dashboard)/style-from-reference/actions.ts` exports `extractStyleSpecAction` (calls Phase 75 `extractStyleSpec`) and `regenerateAction` (Phase 77 hook for later)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<ReferenceImageUploader>` from Phase 74-03 (ships drag-drop + onUploadComplete + onExtractRequested callbacks) — already integrated, just embed in the new page
- Phase 75 `extractStyleSpec({projectId, references})` Server-callable; Phase 76 wraps in Server Action with auth + Storage URL → Buffer fetch
- `src/lib/types/style-spec.ts` `StyleSpec` type for typing the preview surface
- `src/components/dashboard/published-list.tsx` (likely) — existing dashboard list pattern
- Brand kit settings under `src/app/(dashboard)/settings/brand-kit/` — read brand kit via existing pattern; expose to PerAspectToggles
- Existing UI primitives — shadcn/ui buttons, cards, etc. (verify via grep)

### Established Patterns
- Dashboard pages live under `src/app/(dashboard)/<feature>/page.tsx` with optional `actions.ts` for Server Actions
- Components organized by feature (`src/components/<feature>/`)
- shadcn/ui as the base UI library
- Tailwind for styling
- React Server Components by default; client components opt-in with `"use client"`

### Integration Points
- New route: `src/app/(dashboard)/style-from-reference/new/page.tsx`
- New actions: `src/app/(dashboard)/style-from-reference/actions.ts`
- New components: `src/components/style-from-reference/*.tsx`
- Reads: existing brand kit accessor (find via grep at planning time)
- Writes: extracted spec + reference_assets (via existing project update path) — Phase 77 owns the actual generate; Phase 76 saves the spec only

### Dashboard CTA
- Add a "From references" CTA on the existing `/dashboard` route (or wherever Create Project lives) that links to `/dashboard/style-from-reference/new` — small wiring task

</code_context>

<specifics>
## Specific Ideas

- The state machine is the load-bearing design — explicit transitions defend against bugs like "extract called twice" or "Generate fired without preview shown"
- Re-extract uses the same uploaded references — no re-upload required; the 2-retry counter resets on fresh upload set
- Brand kit toggle previews the merged palette next to the extracted palette (small UI: "Extracted vs Brand Kit" two-column swatches when toggle is ON)
- "Generate" CTA is disabled until at least one per-aspect toggle is checked (otherwise emit has nothing to apply)
- Layout sketch is a quick illustration, not a render — accepts the spec's hook_position + body_density + decoration_density, draws a 9:16 frame with placeholder boxes
- Sticky reference thumbnails serve a second purpose: they preserve the link between the user's input and the extracted spec — defends against the "I forgot what I uploaded" UX trap
- All UI text uses "Inspired by" framing per Phase 79 LEGAL-03 (which Phase 79 enforces via grep gate later) — avoid "exactly like / clone / copy / duplicate"

</specifics>

<deferred>
## Deferred Ideas

- Save extracted spec as a personal "Style" — defer to v2.14 P2
- "Try this style" preset gallery — defer to v2.14 P2
- Generate N variants from one spec — defer to v2.14 P2
- Read-only spec JSON viewer — defer to v2.15+
- Per-slide style mapping UI — defer to v2.14 P2 (blocked on Phase 75 extraction supporting per-slide roles)
- Per-image weighted blend slider — anti-feature per FEATURES.md
- Real-time spec preview as user uploads — anti-feature (cost + UX confusion)
- JSON-textbox spec editor — defer to v2.15+

</deferred>
