# Phase 57: Editor Controls + Palette Extraction - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** `--auto` (Claude-decided defaults grounded in v2.9 research synthesis + Phase 54/55/56 carry-forward + codebase audit)

<domain>
## Phase Boundary

Photo treatment becomes user-controllable per slide via a new right-rail
component (`photo-treatment-controls.tsx`) that mounts BELOW v2.8's
`SlideSettings` block in `text-editor-panel.tsx`. Per-slide controls are:
B&W toggle (radix Switch), duotone preset radio (Off / Cream / Cobalt),
and grain intensity radio (Off / Subtle / Medium / Heavy). All three
funnel to a single new server action — `updateSlideTreatment(projectId,
slideIndex, spec)` — co-located in
`src/app/(dashboard)/project/[id]/editor-actions.ts`. Treatment ALWAYS
re-treats from `slide.original_source_url` (Phase 55 schema field); if
that field is null on a legacy pre-Phase-55 slide, the action back-fills
it from `slide.background_url` BEFORE invoking `treatPhoto`. No
compounding ever.

`@vibrant/node@^4.0.3` ships as the one-and-only new dep. New module
`src/lib/photo-treatment/palette.ts` exports `extractPalette(treatedUrl)`
which returns named-role hex strings `{ Vibrant, DarkVibrant,
LightVibrant, Muted, DarkMuted, LightMuted }`. Extraction runs on a
sharp-resized ≤256×256 thumbnail (Vercel function memory budget,
PALETTE-04). The generation pipeline (`src/app/(dashboard)/project/
[id]/actions.ts`) writes the palette as an ordered hex array to
`slide.style_overrides.derived_palette`. Two existing Phase 56 templates
flip from `paletteMode: 'fixed'` to `paletteMode: 'palette-dominant'`
(`editorial-serif`, `notes-app-chic`) and consume `derived_palette` for
the page-counter chip (editorial-serif) and halftone-dot accent
(notes-app-chic) via new resolver helpers in `resolve-overlay.ts`
(TPLREND-05 parity invariant — no JSX duplicated across renderers).

The canvas editor (`src/components/editor/slide-canvas.tsx`) gains a
toggleable "IG grid preview" chip that overlays a 4:5 (1080×1350)
dashed-`outline` crop indicator at the top-of-frame anchor (Instagram
feed center-crop is top-aligned). CSS-only — Satori path untouched.

The Phase 54 `slide-backgrounds-treated` retention pg_cron job is
verified (likely no work) — Phase 56 grain PNGs live in
`public/textures/`, not in the bucket, so retention scope is unchanged.

**In scope:**
- New component: `src/components/editor/photo-treatment-controls.tsx`
  (client; mounts in `text-editor-panel.tsx` below `SlideSettings`)
- Wiring: `text-editor-panel.tsx` adds `<PhotoTreatmentControls />` as
  the LAST child in the main column (after `SlideSettings`, before the
  conditional `<CustomTextEditor>` block). Existing prop interface
  unchanged except for one new `onSlideTreatmentChange` callback OR an
  inline imported server-action invocation (D-08).
- New server action: `updateSlideTreatment(projectId, slideIndex, spec)`
  in `src/app/(dashboard)/project/[id]/editor-actions.ts`. Returns
  `{ success: true; slide: Slide } | { success: false; error: string }`.
- New module: `src/lib/photo-treatment/palette.ts` — exports
  `extractPalette(treatedUrl: string): Promise<NamedPalette>` where
  `NamedPalette = { Vibrant, DarkVibrant, LightVibrant, Muted, DarkMuted,
  LightMuted: string }`.
- New dep: `@vibrant/node@^4.0.3` (server-only — no client import).
- IG grid safe-zone overlay: new local toggle state inside
  `slide-canvas.tsx`; renders a `<div>` with dashed `outline` over the
  preview when ON. Toggle chip lives near the existing slide counter at
  the bottom of the canvas (alongside "Slide X / N").
- Resolver helpers for palette-aware fields in
  `src/lib/render/resolve-overlay.ts`: 1-2 small pure helpers that map
  `slide.style_overrides.derived_palette` + `template.paletteMode` to
  resolved accent color tokens (used by both renderers).
- Template flip: `editorial-serif.ts` and `notes-app-chic.ts` change
  `paletteMode: 'fixed'` → `paletteMode: 'palette-dominant'`.
  Page-counter chip (editorial-serif) and halftone-dot accent
  (notes-app-chic) consume `derived_palette[0]` (Vibrant) when
  available; otherwise fall back to current static accent.
- Generation pipeline integration: in
  `src/app/(dashboard)/project/[id]/actions.ts`, after `treatPhoto()`
  returns and before slide is persisted, call `extractPalette` on the
  treated URL and write `slide.style_overrides.derived_palette` (ordered
  hex array). Best-effort try/catch — palette failure must NOT block
  slide creation (we already do this for treatPhoto per D-27/Phase 56).
- Snapshot test: `text-editor-panel.test.tsx` (new or extended) asserts
  the right-rail composition order: `LayerStrip → ActiveTextBoxCard →
  SlideSettings → PhotoTreatmentControls`. Required by EDITOR-04
  (no v2.8 layout regression).

**Out of scope (deferred or owned elsewhere):**
- Slide-role-aware AI generation + `match-photos-to-slides.ts` premium
  gating (Phase 58)
- Parity test harness `render-parity-grid.ts` (Phase 58)
- Brutalist-grid template flip to `palette-dominant` (stays `'fixed'`
  forever per its B&W + single-accent design language)
- ZIP export PNG metadata cleaning (Phase 58 — PARITY-05)
- AI diversity gate corpus (Phase 58 — AIROLE-02)
- New server-side photo-treatment presets beyond the 4 Phase 54 already
  shipped
- Editor UI for `template_id_override` / per-slide template picker
  (Phase 58 wiring)
- Treatment retention pg_cron RE-tuning (Phase 54 cron remains; Phase
  57 verifies only — no migration unless audit finds a gap)
- `paletteMode: 'palette-dominant'` for any non-Phase-56 template
- Any CSS filter-based "fast preview" path on the editor — D-04 below

</domain>

<decisions>
## Implementation Decisions

### Server action contract

- **D-01: New server action lives in `editor-actions.ts`, NOT
  `actions.ts`.** Same module that already hosts
  `regenerateSlideText` / `stylizeSlidePhoto` / `saveTemplateId`. Keeps
  treatment-override surface co-located with other per-slide editor
  surgery; `actions.ts` stays focused on whole-project lifecycle.

- **D-02: Action signature locked as
  `updateSlideTreatment(projectId: string, slideIndex: number, spec:
  { kind: 'bw' | 'duotone-cream' | 'duotone-cobalt' | 'none'; grain?:
  'subtle' | 'medium' | 'heavy' | 'off' })`.** Returns
  `{ success: true; slide: Slide } | { success: false; error: string }`.
  Reasoning: closed-string union mirrors `treat.ts` `TreatmentPreset`
  kinds. `'none'` is the explicit "remove all photo treatment" branch
  (resets `slide.background_url` to `slide.original_source_url`). Grain
  is decoupled because grain is template-renderer-controlled (not a
  sharp pre-bake) — see D-09.

- **D-03: Action algorithm (4 steps, all server-side):**
  1. Load project. If `slide.original_source_url` is null/missing,
     back-fill it from current `slide.background_url`. Persist.
  2. If `spec.kind === 'none'`: write
     `slide.background_url = slide.original_source_url`, clear
     `slide.style_overrides.treatment_applied`, clear
     `slide.style_overrides.derived_palette`. Skip to step 4.
  3. Otherwise, call `treatPhoto(slide.original_source_url, spec, userId)`
     → write returned `url` to `slide.background_url`, write
     `treatment_applied: <SHA-256 cache key suffix>`. Then call
     `extractPalette(url)` → write `derived_palette` ordered hex array.
     Both calls best-effort try/catch — palette failure leaves
     `derived_palette` unset; treat failure rolls back step 1 and
     returns `{ success: false }`.
  4. Persist updated `slides[]` to `projects.slide_data`. Set grain
     intensity into `slide.style_overrides.grain_intensity?:
     'subtle' | 'medium' | 'heavy' | 'off'` (NEW field — see D-10).
     Revalidate `/project/${projectId}`.

- **D-04: NO CSS-filter-based fast preview path.** The editor
  B&W/duotone toggles trigger server-side `treat.ts` calls only. The
  ~3-second cache-miss-then-hit cycle from EDITOR-02 success criterion
  is acceptable. Phase 54 D-21 explicitly forbade CSS filter for
  treatment, and Phase 55's `no-css-filter.test.ts` would fail if we
  added one. Toggle UI shows a "Treating..." spinner during the await.

### `@vibrant/node` integration

- **D-05: `palette.ts` is server-only.** Ships at
  `src/lib/photo-treatment/palette.ts`. Imports `node-vibrant/node`
  (the package's `/node` subpath, which avoids the browser shim that
  pulls in `canvas`). NEVER imported from any client component. To
  guard, the file's first line is a comment marker
  `// SERVER-ONLY: do not import from client components` and no
  `'use client'` file references it.

- **D-06: Extraction algorithm:**
  1. Resize `treatedUrl` via sharp to ≤256×256 (PALETTE-04 budget) — fit
     `'inside'`, no upscale, output PNG buffer.
  2. Pass buffer to `Vibrant.from(buffer).getPalette()` (the
     v4 buffer-input API).
  3. Map each role to its `.hex` property; for any role Vibrant returns
     `null`, fall back to the next-most-saturated role's hex (cascade:
     Vibrant → DarkVibrant → Muted → DarkMuted → LightVibrant →
     LightMuted), guaranteeing all 6 keys are non-null hex strings.
  4. Return `NamedPalette`. Pure function — no caching at this layer
     (caching is at the `treatPhoto` SHA-256 layer; if treated URL
     changed, palette must re-extract).

- **D-07: `derived_palette` storage shape is the ordered hex array,
  NOT the named-role object.** Phase 55 schema locked
  `style_overrides.derived_palette?: string[]`. Order is fixed:
  `[Vibrant, DarkVibrant, LightVibrant, Muted, DarkMuted, LightMuted]`.
  Resolver helpers consume by index: `derived_palette[0]` = Vibrant,
  `derived_palette[3]` = Muted, etc. Two-line getter helpers in
  `resolve-overlay.ts` (`getVibrant(slide)`, `getDarkMuted(slide)`)
  centralize the index-to-role mapping. Rationale: keeps the JSONB blob
  small and matches the Phase 55 schema contract (`string[]`, not
  object).

### UI composition (right-rail)

- **D-08: PhotoTreatmentControls receives `slide`, `template`, and
  `onTreatmentChange` callback as props.** It does NOT call the server
  action directly. Parent (`text-editor-panel.tsx`) wires
  `onTreatmentChange` to a function that invokes `updateSlideTreatment`
  via React's `useTransition` so the spinner state is co-located with
  the surrounding editor. This matches the existing component
  contract (`onUpdate` flow). The grandparent (`slide-editor.tsx`)
  receives a new optional `onSlideTreatmentChange?: (slideIndex,
  spec) => Promise<void>` prop and forwards through.

- **D-09: Grain control writes to
  `slide.style_overrides.grain_intensity` (NEW field on
  `style_overrides` blob — schema-additive, optional, no migration).**
  Grain rendering is already template-driven (Phase 56's `renderGrain`
  helper in `resolve-overlay.ts` reads `template.grainMode`). Phase 57
  adds the per-slide override: when `slide.style_overrides.grain_intensity`
  is set, both renderers read it via a new resolver helper
  `resolveGrainIntensity(slide, template)` and pass to `renderGrain`.
  `'off'` short-circuits to no grain layer. This is a renderer change,
  NOT a sharp pre-bake — distinct from B&W/duotone treatment which IS a
  pre-bake.

- **D-10: `style_overrides.grain_intensity` is not added to the
  Phase 55 schema migration** (Phase 55 already shipped). It is a NEW
  optional `style_overrides` JSONB field added in Phase 57. Update
  `src/lib/types/slide.ts` `Slide['style_overrides']` typing and
  schema-boundary tests; no DB migration (JSONB column accepts new
  keys). Document in 57-VERIFICATION.md.

- **D-11: Mount order in `text-editor-panel.tsx` main column:**
  `LayerStrip → ActiveTextBoxCard → SlideSettings →
  PhotoTreatmentControls`. The optional `<CustomTextEditor>` block
  remains conditional below. Snapshot test pins this order
  (EDITOR-04). PhotoTreatmentControls uses the same outer container
  styling pattern as `SlideSettings` (border-top divider, p-6 padding,
  10px uppercase tracking-widest section labels, `#fff0f0` panel bg)
  to avoid visual regression.

- **D-12: Each control sub-section is conditionally rendered based on
  slide capability:**
  - B&W toggle + duotone radio: ALWAYS shown (treatment is per-slide
    universal).
  - Grain intensity radio: ALWAYS shown.
  - If `slide.original_source_url` is null AND `slide.background_url`
    is null (no photo at all), render a disabled-state stub: "Add a
    photo to apply treatments." (Defensive — happens on text-only
    slides.)

### Templates: paletteMode flip

- **D-13: `editorial-serif` and `notes-app-chic` flip from `'fixed'`
  to `'palette-dominant'`.** No structural template changes beyond
  this single field. Per-template consumer logic (which palette index
  to use where) lives in resolver helpers, NOT in the template file.

- **D-14: editorial-serif palette consumption:** page-counter chip
  background (currently `#F5EFE6` cream) becomes `derived_palette[0]`
  (Vibrant) WHEN available. Cream stays as fallback if
  `derived_palette` unset. Page-counter chip text color picks DarkMuted
  (`derived_palette[4]`) for legibility on Vibrant background, OR
  defaults to `#3d0000` deep brown (current) on cream fallback.
  Resolver helper: `getEditorialSerifChipColors(slide, template)`
  returns `{ background, text }` tuple.

- **D-15: notes-app-chic palette consumption:** halftone-dot accent
  overlay color is currently a hardcoded SVG fill in the
  `halftone-dots-light.png` asset (Phase 56). The Phase 56 asset is
  monochrome dot pattern — we don't recolor PNGs. Instead, palette
  consumption applies to the **sticky-yellow tape strip** decorative
  overlay tint via a CSS `filter: hue-rotate` — but D-04 forbids CSS
  filter for treatment. Resolution: ship Phase 57 with a NEW SVG asset
  `sticky-note-accent.svg` (added to `public/overlays/`) where the fill
  color is parameterized via inline `<svg fill="..." ...>` and the
  resolver helper `renderDecorativeOverlay` (Phase 56) gains an
  optional `tintColor?: string` arg. When set, it replaces the asset's
  `currentColor` fill. notes-app-chic passes `derived_palette[0]`
  (Vibrant) as `tintColor`. Default fallback if `derived_palette`
  unset: existing sticky-yellow `#FFE066`. THIS IS A SVG-LEVEL
  recolor, NOT a CSS filter — guard rail intact.

- **D-16: Resolver helpers ship in `src/lib/render/resolve-overlay.ts`
  (TPLREND-05 parity invariant).** Both `render-slide-satori.tsx` and
  `slide-preview.tsx` import from the same module. New helpers:
  `getVibrant(slide)`, `getDarkMuted(slide)`,
  `getEditorialSerifChipColors(slide, template)`,
  `getNotesAppChicAccentColor(slide, template)`. Each is a pure
  function over `(slide, template)` → string|tuple; never branches on
  rendering context.

### Generation pipeline integration

- **D-17: Palette extraction runs in `actions.ts` immediately AFTER
  `treatPhoto()` succeeds, BEFORE the slide row is persisted.**
  Best-effort try/catch — `extractPalette` failure leaves
  `derived_palette` unset (templates fall back to fixed accent).
  Failure must NOT block slide creation. Mirrors Phase 56 D-27 pattern
  for treatPhoto integration.

- **D-18: Palette extraction is skipped for slides whose template's
  `paletteMode === 'fixed'` (or undefined).** Optimization: avoids the
  ≤256×256 sharp resize + Vibrant call for the 9 templates that don't
  consume palette (legacy 5 + 3 premium + brutalist-grid). Only the 2
  palette-dominant templates pay the cost.

- **D-19: On editor treatment override (`updateSlideTreatment`),
  palette is re-extracted REGARDLESS of template paletteMode** — user
  may change template later, and re-extracting on every treat call is
  cheap (~256×256 sharp). Single source of truth: the slide's current
  `background_url` (which is the treated URL after this action runs).

### IG grid safe-zone overlay

- **D-20: Overlay is CSS-only — uses `outline` (not `border`) so it
  doesn't shift layout.** Renders as an absolutely-positioned `<div>`
  inside `slide-canvas.tsx` over the SlidePreview. The `outline` is
  `2px dashed rgba(255, 255, 255, 0.85)`, positioned at top-of-frame,
  spanning the 4:5 (1080×1350 of the 1080×1920 slide) IG feed crop.
  In SlidePreview's scaled coordinate space, the overlay is a `div`
  with `top: 0; bottom: 28.125%; left: 0; right: 0` (1350/1920 = 70.3%
  of height visible from top, so bottom 29.7% is cropped). The dashed
  outline draws on this div's box.

- **D-21: Toggle UI lives inside `slide-canvas.tsx` next to the
  bottom slide counter pill.** A new chip-button "IG GRID" that
  flips local React state (`useState`). State is component-local — not
  persisted to project, not lifted to `slide-editor.tsx`. Per-session
  toggle. No props change to SlideCanvas (additive internal state).

- **D-22: Overlay only renders in editable canvas (`editable={true}`
  branch of SlidePreview).** Static `<SlidePreview>` consumers
  (template picker, /explore page) don't get the overlay. This is
  enforced by keeping the overlay rendering in `slide-canvas.tsx`,
  NOT inside `slide-preview.tsx` itself.

- **D-23: Crop bounds visualize the FEED 4:5 crop (1080×1350), NOT
  the IG profile-grid 1:1 crop.** Phase 57 ROADMAP says "the IG feed
  thumbnail crop" — feed is the use case (carousels render on feed,
  not on profile grid). Top-aligned because IG feed center-crops to
  top-aligned for portrait media. Single overlay; no toggle for
  alternate aspect ratios in v2.9.

### Retention policy verification

- **D-24: Phase 54 pg_cron job verification is read-only.** Run
  `mcp__supabase__execute_sql`:
  `SELECT jobname, schedule, command, last_run_start, last_run_end
   FROM cron.job_run_details
   WHERE jobname = 'cleanup_orphan_treated_backgrounds_daily'
   ORDER BY last_run_start DESC LIMIT 5;`
  to confirm it ran in the last 24 hours and didn't error. If it
  errored OR Phase 56 `public/textures/` PNGs accidentally got
  uploaded to the bucket (which would mean retention deletes them —
  it shouldn't, but verify), fix in this phase. Otherwise no-op.
  Document result in 57-VERIFICATION.md.

### Hard constraints (carry-forward)

- **D-25: TPLREND-05 parity invariant.** Every palette-aware rendering
  path goes through `resolve-overlay.ts`. No JSX duplicated across
  renderers. Test: grep both renderer files for the new resolver
  helpers and assert the import path is `@/lib/render/resolve-overlay`.

- **D-26: One new dep only — `@vibrant/node@^4.0.3`.** No transitive
  bloat allowed via lockfile audit (npm ls --depth=2). The package's
  /node export is preferred to avoid the canvas/jsdom deps from the
  default browser path.

- **D-27: Treatment ALWAYS re-treats from
  `slide.original_source_url`.** Never compounds. Back-fill from
  `slide.background_url` if null. Document back-fill in
  57-VERIFICATION.md and inline in `editor-actions.ts`.

- **D-28: Editor controls placement constraint.** Mount BELOW v2.8's
  `SlideSettings`. Snapshot test required (EDITOR-04). Do NOT touch
  TextEditorPanel's text-box-selection logic (Phase 50 D-16).

- **D-29: No TextEditorPanel API breaks.** Adding the new control
  surface MUST NOT change the existing `TextEditorPanelProps`
  interface in a way that breaks v2.8 callers. Solution: add the new
  `onSlideTreatmentChange?` as OPTIONAL — when omitted, the
  PhotoTreatmentControls section renders in a read-only/disabled
  state. Default behavior in production wires it through; tests can
  exercise the omitted path.

</decisions>

<open_questions>
None — all gray areas resolved via --auto defaults grounded in:
- Phase 54 carry-forward (treat.ts API + cache + bucket retention)
- Phase 55 schema (`original_source_url`, `derived_palette`,
  `treatment_applied`, `paletteMode`)
- Phase 56 carry-forward (renderDecorativeOverlay, fixed paletteMode
  on the 2 templates that flip in this phase)
- Research SUMMARY.md Conflict #4 (sharp.stats now / @vibrant/node here)
- ROADMAP.md Phase 57 success criteria (5/5)
- REQUIREMENTS.md EDITOR-01..04 + PALETTE-01..04 (8/8)

</open_questions>

## Next Steps

Run `/gsd-ui-phase 57` next — this phase has UI hint=yes (right-rail
treatment controls + IG grid overlay chip). After UI-SPEC ships, run
`/gsd-plan-phase 57 --skip-research` to draft the 2-3 plans.
