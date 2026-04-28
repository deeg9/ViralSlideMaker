---
phase: 260427-bkt
plan: 01
status: complete
subsystem: branding
tags: [brand-kit, template, customization, theme]
requires:
  - SlidePreview, SlideTemplate (already existed)
  - mergeWithBrandKit (already existed; extended with new fields)
provides:
  - "Brand kit as a first-class selectable template tile in the visual-style picker"
  - "7 new brand-kit fields: heading_font_family, body_font_family, accent_color, text_align, text_position, hook_style, overlay_opacity_pct"
  - "Live SlidePreview-based brand-kit form preview (single source of truth for what brand kit looks like)"
  - "synthesizeBrandKitTemplate(brandKit) for use across all 3 render paths"
affects:
  - supabase/migrations/20260427_brand_kit_template.sql
  - src/lib/types/brand-kit.ts
  - src/lib/brand-kit/get-effective-template.ts
  - src/lib/render/templates/index.ts
  - src/lib/render/render-slide-satori.tsx
  - src/components/slides/slide-preview.tsx
  - src/components/slides/template-picker.tsx
  - src/components/slides/generation-form.tsx
  - src/app/(dashboard)/project/[id]/page.tsx
  - src/app/api/render/route.ts
  - src/app/api/v1/projects/[id]/download/route.ts
  - src/components/editor/slide-editor.tsx
  - src/components/brand-kit/brand-kit-form.tsx
  - src/app/(dashboard)/settings/brand-kit/actions.ts
tech-stack:
  added: []
  patterns:
    - "Synthetic template at render time — brand kit IS the template, no static row"
    - "BRAND_KIT_TEMPLATE_ID constant shared across editor + 2 server render paths"
    - "Form preview uses the same SlidePreview component as the picker tile"
    - "Live form state synthesized into a virtual BrandKit object at render"
key-files:
  created:
    - supabase/migrations/20260427_brand_kit_template.sql
  modified:
    - src/lib/types/brand-kit.ts
    - src/lib/brand-kit/get-effective-template.ts
    - src/lib/render/templates/index.ts
    - src/lib/render/render-slide-satori.tsx
    - src/components/slides/slide-preview.tsx
    - src/components/slides/template-picker.tsx
    - src/components/slides/generation-form.tsx
    - src/app/(dashboard)/project/[id]/page.tsx
    - src/app/api/render/route.ts
    - src/app/api/v1/projects/[id]/download/route.ts
    - src/components/editor/slide-editor.tsx
    - src/components/brand-kit/brand-kit-form.tsx
    - src/app/(dashboard)/settings/brand-kit/actions.ts
decisions:
  - "Single brand kit per user (existing UNIQUE on user_id). Multi-kit deferred to a future Pro feature."
  - "Existing font_family column kept for backward compat; new code reads body_font_family/heading_font_family with fallback. Brand-kit form writes the same value to both font_family and body_font_family on save."
  - "Brand-kit template is SYNTHESIZED at render time, not stored as a static template row. Three render paths all branch on template_id === BRAND_KIT_TEMPLATE_ID and call synthesizeBrandKitTemplate(brandKit). Falls back to bold-minimal if brand kit was deleted after the project saved this id."
  - "Heading font is a NEW first-class concept on SlideTemplate (optional headingFontFamily). Built-in templates leave it undefined → no behavior change. Both render-slide-satori.tsx and slide-preview.tsx use template.headingFontFamily ?? template.fontFamily for the hook text."
  - "Brand-kit form's live preview uses the SAME <SlidePreview> component as the picker tile, ensuring perfect visual parity between 'what I'm setting up' and 'what gets generated'."
  - "Empty-state tile (when no brand kit configured) is a Link to /settings/brand-kit, NOT a button. Routes the user straight to setup without leaving the create flow."
metrics:
  duration: "~30 minutes"
  completed: "2026-04-27"
  tasks_completed: 5
  files_created: 1
  files_modified: 13
  commits: 5
---

# Quick Task 260427-bkt: Brand Kit as a Template

The brand kit is now a first-class selectable visual style alongside Bold
Minimal / Dark Gradient / etc. Users get a much richer customization
surface in `/settings/brand-kit` (heading + body font pairing, accent
color, text alignment, text position, hook style, overlay opacity) and
their saved brand kit appears as the FIRST tile in the visual-style
picker on project creation. Picking it generates slides using the user's
exact visual identity.

## What Changed

### 1. Schema migration (commit `14dca83`)

Added 7 columns to `brand_kits`: `heading_font_family`, `body_font_family`,
`accent_color`, `text_align`, `text_position`, `hook_style`,
`overlay_opacity_pct`. Four CHECK constraints enforce the enum domains
and the 0–100 opacity range. Backfill copies existing `font_family` into
both `body_font_family` and `heading_font_family` so existing brand kits
keep working unchanged. Migration applied via Supabase MCP.

### 2. synthesizeBrandKitTemplate + heading font (commit `199bbbc`)

New `synthesizeBrandKitTemplate(brandKit)` in `get-effective-template.ts`
builds a fully-resolved `SlideTemplate` from a brand kit row. Used when
`project.template_id === BRAND_KIT_TEMPLATE_ID` ('brand-kit') —
the brand kit IS the template, with neutral defaults for unset fields.

`mergeWithBrandKit` now also honors the new fields when applied to
non-brand-kit templates (so users who pick "Bold Minimal" but have a
brand kit get accent / alignment / position / hook style on top).

`SlideTemplate.headingFontFamily` is a new optional field. Built-in
templates leave it undefined → no behavior change. `render-slide-satori.tsx`
(Satori PNG export) and `slide-preview.tsx` (live editor) both use
`template.headingFontFamily ?? template.fontFamily` for the hook text.

### 3. Picker tile + empty state (commit `efb0312`)

`TemplatePicker` accepts an optional `brandKit` prop. When the brand kit
is "configured enough" (has colors and/or a font), prepend a `Your Brand
Kit` tile at index 0 — rendered via a real `SlidePreview` synthesized
from the brand-kit row. Selecting it sets `templateId='brand-kit'`.

When no brand kit is configured, prepend a `Build your brand kit`
empty-state tile — dotted border + plus icon, links to
`/settings/brand-kit`.

`brandKit` flows from project page → `GenerationForm` → `TemplatePicker`.

### 4. Render-path resolution (commit `a8c81f9`)

All three render paths now branch on `template_id`:
- `/api/render` (per-slide PNG via Satori)
- `/api/v1/projects/[id]/download` (server-side ZIP)
- `slide-editor.tsx` (editor live preview)

```ts
const template = template_id === BRAND_KIT_TEMPLATE_ID && brandKit
  ? synthesizeBrandKitTemplate(brandKit)
  : getTemplate(template_id ?? 'bold-minimal')
```

Falls back to bold-minimal if the project's `template_id='brand-kit'`
but no brand kit exists (brand kit deleted after project save).

### 5. Form UI + server validation (commit `490e0e7`)

Added new sections to `/settings/brand-kit`:

- **Colors**: 5th `Accent` slot
- **Typography**: separate Heading Font + Body Font selects, Hook Style 3-button row (Uppercase / Normal / Italic)
- **Layout**: Text Align 3-button row (Left/Center/Right), Text Position 3-button row (Top/Center/Bottom), Overlay Opacity slider (0–100%)
- **Live preview**: replaced the old swatch with a real `<SlidePreview>` tile rendered from the live form state via `synthesizeBrandKitTemplate(currentForm)` — same component as the picker tile, so users see EXACTLY what their brand kit will produce.

Server `saveBrandKit` parses + validates the 7 new fields against the SQL CHECK constraints (enum allowlists + 0–100 opacity). Heading font also writes back to legacy `font_family` so old code stays consistent; `body_font_family` is canonical for the body font going forward.

## Verification

- ✅ Schema migration applied via Supabase MCP (`{"success":true}`)
- ✅ Form renders all new sections correctly — confirmed via Playwright screenshot at `test-brand-kit-form-after.png`. Live preview shows "MY BRAND" mockup with dark theme + center-aligned text + uppercase hook style as expected from defaults.
- ✅ TypeScript clean for all 13 modified files (`npx tsc --noEmit` shows no new errors in any of the touched files; pre-existing TS errors in unrelated test files only)
- ⚠️ Live picker test on the user's session blocked by Playwright auth context (404s on RLS-protected projects). User can verify by:
  1. Save a brand kit at `/settings/brand-kit` (any defaults)
  2. Create a fresh project from `/dashboard?new=1`
  3. Confirm `Your Brand Kit` appears as the FIRST tile with their brand-kit values rendered into the preview
- Server render paths verified by inspection — pattern matches the (also-shipped, also-verified) forced-watermark `tier`/`origin` plumbing.

## Out of Scope (deferred)

- Multiple brand kits per user (Canva-style up to 100) — Pro feature later
- "Brand Kit Builder" extracting colors/fonts from URL or PDF (Canva 2026)
- Photos / icons / graphics asset management
- Brand guidelines text / usage notes
- Per-template hook/body font sizes in brand kit (defaults stay 72/36)

## Self-Check: PASSED

- FOUND: supabase/migrations/20260427_brand_kit_template.sql (created, applied)
- FOUND: synthesizeBrandKitTemplate, BRAND_KIT_TEMPLATE_ID exports
- FOUND: BrandKit type extended with 7 new fields
- FOUND: TemplatePicker brand-kit tile + empty-state fallback
- FOUND: All 3 render paths resolve brand-kit id
- FOUND: Form has Accent color, Typography section, Layout section, real SlidePreview preview
- FOUND: Server actions parse + validate new fields
- VERIFIED: Form renders correctly via Playwright
- TYPECHECK CLEAN: no new TS errors in modified files
- COMMITS: 14dca83, 199bbbc, efb0312, a8c81f9, 490e0e7
