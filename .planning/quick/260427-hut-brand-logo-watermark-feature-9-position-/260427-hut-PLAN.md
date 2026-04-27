---
phase: 260427-hut
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/types/brand-kit.ts
  - src/lib/types/slide.ts
  - supabase/migrations/20260427_brand_kit_watermark.sql
  - src/app/(dashboard)/settings/brand-kit/actions.ts
  - src/components/brand-kit/brand-kit-form.tsx
  - src/lib/render/resolve-watermark.ts
  - src/lib/render/render-slide.ts
  - src/lib/render/render-slide-satori.tsx
  - src/components/slides/slide-preview.tsx
  - src/app/api/render/route.ts
  - src/app/api/v1/projects/[id]/download/route.ts
  - src/app/(dashboard)/project/[id]/page.tsx
  - src/components/editor/slide-editor.tsx
  - src/components/editor/text-editor-panel.tsx
autonomous: true
requirements: [WATERMARK-01]
must_haves:
  truths:
    - "User can pick 1 of 9 positions for their brand logo in Brand Kit settings"
    - "User can adjust logo size (4-20% of width) and opacity (10-100%) with sliders"
    - "Logo auto-renders on every slide in the live editor canvas, thumbnails, Satori PNG export, and ZIP download"
    - "User can hide the watermark on a specific slide via a toggle in the editor panel"
    - "If logo_url is empty or logo_position is null, no watermark renders anywhere"
  artifacts:
    - path: "supabase/migrations/20260427_brand_kit_watermark.sql"
      provides: "Adds logo_position, logo_size_pct, logo_opacity_pct columns to brand_kits"
    - path: "src/lib/render/resolve-watermark.ts"
      provides: "resolveWatermark(brandKit, slide) -> {url,x,y,width,opacity} | null"
    - path: "src/components/brand-kit/brand-kit-form.tsx"
      provides: "9-grid position picker + size/opacity sliders + live preview tile"
  key_links:
    - from: "src/app/(dashboard)/project/[id]/page.tsx"
      to: "src/components/editor/slide-editor.tsx"
      via: "brandKit prop loaded via getBrandKit()"
      pattern: "brandKit=\\{"
    - from: "src/components/slides/slide-preview.tsx"
      to: "src/lib/render/resolve-watermark.ts"
      via: "resolveWatermark() call in render branches"
      pattern: "resolveWatermark\\("
    - from: "src/app/api/render/route.ts"
      to: "src/lib/render/render-slide-satori.tsx"
      via: "buildSlideElement(slide, template, brandKit)"
      pattern: "buildSlideElement.*brandKit"
---

<objective>
Implement brand logo watermark feature: 9-position grid picker, size/opacity sliders in Brand Kit settings, auto-apply across all render paths (live editor, Satori PNG, ZIP download), and a per-slide hide toggle. The brand-kit upload pipeline already exists and writes to Supabase Storage; this plan adds the missing render layer and configuration UI.

Purpose: Close the dead-end loop where uploaded logos are stored but never rendered onto slides. Match the standard creator-tool pattern (CapCut, VEED, Inshot, Buffer, Riverside).
Output: Watermark visible on every slide in editor + exports, configurable from Brand Kit, hideable per-slide.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/deeg/.claude/plans/okay-just-research-me-rosy-pinwheel.md

# Pre-approved design — DO NOT redesign. Implement exactly as specified.
# Reusable building blocks already in repo:
#   - uploadLogo() at src/app/(dashboard)/settings/brand-kit/actions.ts:72
#   - getBrandKit() at src/app/(dashboard)/settings/brand-kit/actions.ts:7
#   - mergeWithBrandKit() at src/lib/brand-kit/get-effective-template.ts (leave alone)
#   - Canvas constants W=1080, H=1920 in renderers
#   - CustomImage absolute-positioning CSS shape (mirror it for the watermark)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Data model, migration, settings UI (9-grid + sliders + preview tile)</name>
  <files>
    src/lib/types/brand-kit.ts,
    src/lib/types/slide.ts,
    supabase/migrations/20260427_brand_kit_watermark.sql,
    src/app/(dashboard)/settings/brand-kit/actions.ts,
    src/components/brand-kit/brand-kit-form.tsx
  </files>
  <action>
    1. **`src/lib/types/brand-kit.ts`** — extend the `BrandKit` type with three nullable fields:
       - `logo_position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | null`
       - `logo_size_pct: number | null` (4–20, default 10)
       - `logo_opacity_pct: number | null` (10–100, default 60)

    2. **`src/lib/types/slide.ts`** — add `hide_watermark?: boolean` to the `SlideStyleOverrides` interface.

    3. **`supabase/migrations/20260427_brand_kit_watermark.sql`** (NEW) — append three columns to `brand_kits`:
       ```sql
       ALTER TABLE brand_kits
         ADD COLUMN IF NOT EXISTS logo_position text,
         ADD COLUMN IF NOT EXISTS logo_size_pct integer,
         ADD COLUMN IF NOT EXISTS logo_opacity_pct integer;

       ALTER TABLE brand_kits
         ADD CONSTRAINT brand_kits_logo_position_check
         CHECK (logo_position IS NULL OR logo_position IN (
           'top-left','top-center','top-right',
           'middle-left','middle-center','middle-right',
           'bottom-left','bottom-center','bottom-right'
         ));

       ALTER TABLE brand_kits
         ADD CONSTRAINT brand_kits_logo_size_pct_check
         CHECK (logo_size_pct IS NULL OR (logo_size_pct BETWEEN 4 AND 20));

       ALTER TABLE brand_kits
         ADD CONSTRAINT brand_kits_logo_opacity_pct_check
         CHECK (logo_opacity_pct IS NULL OR (logo_opacity_pct BETWEEN 10 AND 100));
       ```

    4. **`src/app/(dashboard)/settings/brand-kit/actions.ts`** — `saveBrandKit` reads three new FormData fields (`logo_position`, `logo_size_pct`, `logo_opacity_pct`), coerces to expected types (string | null, integer | null), and includes them in the upsert payload. Treat empty string and the literal "null" as null. Clamp size to 4–20 and opacity to 10–100 server-side as a defense.

    5. **`src/components/brand-kit/brand-kit-form.tsx`** — replace the existing minimalist Logo section (lines 154-174) with a "Logo & Watermark" card containing:
       - Existing logo preview + Upload button (keep wiring intact).
       - **9-button grid picker** for position. Use a 3x3 CSS grid of square buttons; selected cell highlighted (e.g. ring-2 ring-primary). Clicking a cell sets `logo_position` form state. Include a 10th "None" affordance (e.g. "Hide watermark on all slides" checkbox) that sets position to null.
       - **Size slider**: 4–20, step 1, default 10, label `"Size: {value}% of width"`.
       - **Opacity slider**: 10–100, step 5, default 60, label `"Opacity: {value}%"`.
       - **Live preview tile**: a 9:16 mini-canvas (e.g. 90x160 px) with a neutral checkered or gradient background and the logo positioned + scaled per current form state. Updates instantly on slider/grid change. Use the same percentage math the renderer will use (4% safe margin from each edge; size = % of mini-canvas width). If `logo_url` is empty, show placeholder text "Upload a logo to preview".
       - All three new fields posted via FormData on save. Use sensible defaults when no prior value exists (position=`bottom-right`, size=10, opacity=60) once a logo is uploaded; until then keep position=null so nothing renders.

    Defaults policy: when the user uploads a logo for the first time and `logo_position` is still null, do NOT auto-set it server-side — leave that to an explicit user click on the grid. The form may pre-select bottom-right visually for guidance but only persist on save.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "(brand-kit|slide\.ts|brand-kit-form|actions\.ts)" || echo "OK: no type errors in touched files"</automated>
  </verify>
  <done>
    BrandKit type has the 3 new fields; SlideStyleOverrides has hide_watermark; migration file exists with column adds + CHECK constraints; saveBrandKit persists the 3 fields with clamping; brand-kit-form renders a 9-grid picker, two sliders, and a live preview tile that updates on input.
  </done>
</task>

<task type="auto">
  <name>Task 2: Watermark resolver + render in all 3 paths + thread brandKit through editor</name>
  <files>
    src/lib/render/resolve-watermark.ts,
    src/lib/render/render-slide.ts,
    src/lib/render/render-slide-satori.tsx,
    src/components/slides/slide-preview.tsx,
    src/app/api/render/route.ts,
    src/app/api/v1/projects/[id]/download/route.ts,
    src/app/(dashboard)/project/[id]/page.tsx,
    src/components/editor/slide-editor.tsx
  </files>
  <action>
    1. **`src/lib/render/resolve-watermark.ts`** (NEW) — pure function:
       ```ts
       export interface ResolvedWatermark {
         url: string;
         x: number;       // px from left
         y: number;       // px from top
         width: number;   // px
         height?: number; // optional, intrinsic if omitted
         opacity: number; // 0–1
       }

       export function resolveWatermark(
         brandKit: { logo_url?: string | null; logo_position?: string | null; logo_size_pct?: number | null; logo_opacity_pct?: number | null } | null | undefined,
         slide: { style_overrides?: { hide_watermark?: boolean } | null } | null | undefined,
         canvas: { width: number; height: number } = { width: 1080, height: 1920 }
       ): ResolvedWatermark | null
       ```
       - Returns null when: brandKit missing, logo_url falsy, logo_position null, OR slide.style_overrides.hide_watermark === true.
       - Otherwise compute: width = canvas.width * (logo_size_pct ?? 10) / 100; opacity = (logo_opacity_pct ?? 60) / 100; safe margin = canvas.width * 0.04.
       - x/y from 9-position grid: top/middle/bottom = y in {margin, (canvas.height - estimatedHeight)/2, canvas.height - margin - estimatedHeight}; left/center/right = x in {margin, (canvas.width - width)/2, canvas.width - margin - width}.
       - Use a square assumption (height=width) for positioning math — height field returned as same value; CSS will preserve aspect ratio via `height: auto` at render time, but bounding box for placement uses the square approximation.

    2. **`src/lib/render/render-slide.ts`** — add `brandKit?: BrandKit | null` to the function signature (e.g. `buildSlideElement` / equivalent). After rendering `customImageHtml` (~lines 161+), call `resolveWatermark(brandKit, slide)`; if non-null, append an `<img>` tag with inline styles `position:absolute; left:{x}px; top:{y}px; width:{width}px; height:auto; opacity:{opacity}; z-index:5; pointer-events:none;` and `src={url}`.

    3. **`src/lib/render/render-slide-satori.tsx`** — same signature change; after the custom_images map (~lines 220+), if `resolveWatermark(...)` returns non-null, render `<img src={url} style={{ position:'absolute', left:x, top:y, width, height:'auto', opacity }} />`. Satori has no z-index — placing it AFTER custom_images in JSX order is sufficient.

    4. **`src/components/slides/slide-preview.tsx`** — add `brandKit?: BrandKit | null` prop. In BOTH the editable branch (~line 318+) and the non-editable branch (~line 685+), after the custom_images render block, compute `const watermark = resolveWatermark(brandKit, slide, { width: containerWidth, height: containerHeight })`; if non-null, render a non-interactive `<img>` (NO Rnd wrapper) with the resolved coords scaled to the preview container. Use the same percentage scaling pattern that custom_images already uses for editor coordinates, so positioning is consistent across canvas sizes.

    5. **`src/app/api/render/route.ts`** (lines 79-86) — already loads `brandKit`. Pass it as the new param to `buildSlideElement(slide, template, brandKit)`.

    6. **`src/app/api/v1/projects/[id]/download/route.ts`** (line 58) — same change: pass loaded `brandKit` to the renderer call.

    7. **`src/app/(dashboard)/project/[id]/page.tsx`** — server component. Add `const brandKit = await getBrandKit()` alongside the existing project load, then pass `<SlideEditor ... brandKit={brandKit} />`.

    8. **`src/components/editor/slide-editor.tsx`** — accept `brandKit?: BrandKit | null` prop. Pass it through to every `<SlidePreview brandKit={brandKit} ... />` instance (main canvas + thumbnail list).
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "(resolve-watermark|render-slide|slide-preview|slide-editor|render/route|download/route|project/\\[id\\])" || echo "OK: no type errors in touched files"</automated>
  </verify>
  <done>
    `resolveWatermark()` exists and returns null on the 4 documented short-circuits, otherwise correct coords for each of the 9 positions; all three renderers accept `brandKit` and emit a watermark `<img>` layer above custom_images when resolveWatermark returns non-null; brandKit is loaded in the project page and threaded through SlideEditor → SlidePreview; both API render routes pass brandKit to their renderer.
  </done>
</task>

<task type="auto">
  <name>Task 3: Per-slide hide toggle + resolveWatermark unit tests</name>
  <files>
    src/components/editor/text-editor-panel.tsx,
    src/lib/render/resolve-watermark.test.ts
  </files>
  <action>
    1. **`src/components/editor/text-editor-panel.tsx`** — at the bottom of the panel, conditionally render a small toggle button (only when `brandKit?.logo_url` is truthy AND `brandKit?.logo_position` is non-null — pass brandKit down as a prop if not already available; if the panel does not currently receive brandKit, plumb it through from slide-editor.tsx). Label: `"Hide brand logo on this slide"` when off, `"Show brand logo on this slide"` when on. Clicking it toggles `slide.style_overrides.hide_watermark` between `true` and `undefined` (use undefined to keep the override object minimal) on the active slide via the existing slide-update mechanism.

    2. **`src/lib/render/resolve-watermark.test.ts`** (NEW) — vitest suite covering:
       - Returns null when `brandKit` is null.
       - Returns null when `brandKit.logo_url` is empty string or undefined.
       - Returns null when `brandKit.logo_position` is null.
       - Returns null when `slide.style_overrides.hide_watermark === true`.
       - For a known canvas (1080x1920), logo_size_pct=10, opacity=60, asserts correct x/y for each of the 9 positions (margin = 43.2; width = 108).
         - top-left → x≈43.2, y≈43.2
         - top-center → x≈486, y≈43.2
         - top-right → x≈928.8, y≈43.2
         - middle-left → x≈43.2, y≈906
         - middle-center → x≈486, y≈906
         - middle-right → x≈928.8, y≈906
         - bottom-left → x≈43.2, y≈1768.8
         - bottom-center → x≈486, y≈1768.8
         - bottom-right → x≈928.8, y≈1768.8
       - Opacity returned as 0.6 (not 60).
       - Defaults applied when logo_size_pct/opacity_pct are null (10% and 60%).

       Use `expect.closeTo(value, 1)` or rounding to 1 decimal for float coord comparisons.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx vitest run src/lib/render/resolve-watermark.test.ts</automated>
  </verify>
  <done>
    Panel shows hide/show toggle when brand kit has an active watermark; toggling it flips `style_overrides.hide_watermark` on the active slide and the watermark appears/disappears in the live preview; `resolve-watermark.test.ts` passes with all 9-position coordinate assertions and the 4 short-circuit cases.
  </done>
</task>

</tasks>

<verification>
End-to-end manual smoke (after `supabase migration up`):
1. Settings → Brand Kit: upload logo, click bottom-right cell, size 10, opacity 60. Live preview tile updates instantly. Save.
2. Open an existing project. Watermark renders in editor canvas + every thumbnail at bottom-right, ~10% width, ~60% opacity.
3. On slide 1, click "Hide brand logo on this slide" in the right panel. Watermark disappears from slide 1 only.
4. Click Download. Open the resulting PNGs in the ZIP — every slide except slide 1 shows the logo at the chosen corner/size/opacity.
5. Hit `/api/render?projectId=...&slide=2` directly — Satori PNG includes the watermark.
6. Clear `logo_position` (toggle "Hide watermark on all slides") and re-test — watermark gone everywhere.
</verification>

<success_criteria>
- Migration applied; `brand_kits` table has `logo_position`, `logo_size_pct`, `logo_opacity_pct`.
- Brand Kit settings UI shows 9-grid + size + opacity + live preview tile, persists on save.
- All 3 render paths (DOM live preview, Satori PNG, download ZIP) include the watermark when `resolveWatermark()` returns non-null, and omit it otherwise.
- Per-slide hide toggle works in the editor panel.
- `npx vitest run src/lib/render/resolve-watermark.test.ts` is green.
- No regressions: existing `npx vitest run src/lib/render` suite still passes.
</success_criteria>

<output>
After completion, create `.planning/quick/260427-hut-brand-logo-watermark-feature-9-position-/260427-hut-SUMMARY.md` summarizing files touched, migration applied, and any deviations from the locked design.
</output>
