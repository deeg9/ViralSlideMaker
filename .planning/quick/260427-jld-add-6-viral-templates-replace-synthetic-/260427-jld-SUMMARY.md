---
quick_task: 260427-jld
type: summary
status: complete
tasks_completed: 3
tasks_total: 3
commits:
  - hash: 99c111a
    type: feat
    scope: 12 templates registered, SlideTemplate.sample field added
  - hash: be79827
    type: feat
    scope: real mini SlidePreview rendered per picker tile
  - hash: f083c5c
    type: feat
    scope: NEWS_TEMPLATES set generalizes news-drop branch
files_created:
  - src/lib/render/templates/news-cyan.ts
  - src/lib/render/templates/highlight-bar.ts
  - src/lib/render/templates/magazine.ts
  - src/lib/render/templates/quote-card.ts
  - src/lib/render/templates/y2k-pop.ts
  - src/lib/render/templates/bold-yellow.ts
files_modified:
  - src/lib/render/templates/index.ts
  - src/lib/render/templates/news-drop.ts
  - src/lib/render/templates/bold-minimal.ts
  - src/lib/render/templates/dark-gradient.ts
  - src/lib/render/templates/soft-pastel.ts
  - src/lib/render/templates/neon-pop.ts
  - src/lib/render/templates/clean-serif.ts
  - src/components/slides/template-picker.tsx
  - src/lib/ai/prompts.ts
  - src/lib/services/carousel.ts
  - src/app/(dashboard)/project/[id]/actions.ts
  - src/__tests__/render/templates.test.ts
---

# Quick Task 260427-jld: 6 Viral Templates + Real Slide Previews

Doubled the template library from 6 to 12 with real viral-creator patterns and
replaced the picker's synthetic "Aa" swatches with live mini SlidePreview tiles
so users see exactly what each style produces before generating.

## What shipped

### 1. Six new templates (12 total)

Each file is a single-export `SlideTemplate` object matching the existing
`news-drop.ts` shape. All use fonts already in `font-catalog.ts`.

| ID | Name | Style |
|---|---|---|
| `news-cyan` | News Cyan | Black bg, Anton, cyan (#00E5FF) accent, cover/body layout |
| `highlight-bar` | Highlight Bar | White bg, Inter, yellow (#FFD600) highlight |
| `magazine` | Magazine | Off-white, Playfair Display, editorial vibe |
| `quote-card` | Quote Card | Deep navy, Lora italic, centered pull quote |
| `y2k-pop` | Y2K Pop | Hot pink, Righteous (Bungee fallback per design) |
| `bold-yellow` | Bold Yellow | Solid yellow, Bebas Neue, black headline |

### 2. `SlideTemplate.sample` field

Extended the interface with an optional `sample?: { hook_text, body_text,
hook_segments?, layout? }`. Populated for **all 12** templates so the picker
always renders a representative preview.

`hook_segments` and `layout: 'cover'` flow through to news-style previews so
the cyan/lime accent words and cover/body image-vs-text layout render in the
mini tile exactly as they will in production.

### 3. Picker rewrite (`template-picker.tsx`)

- Replaced the `Aa` swatch markup with `<SlidePreview slide={makeSampleSlide(template)} template={template} index={0} editable={false} />`.
- Tile aspect changed from `aspect-[4/3]` to `aspect-[9/16]` (true TikTok/IG ratio).
- Tile width bumped from `w-48` to `w-40` to fit 12 tiles in the horizontal scroll row.
- `pointer-events-none` wrapper preserved so clicks still bubble to the parent button.
- `makeSampleSlide` builds a minimal Slide with `background_url: null` to avoid remote-image fetches in the picker.

### 4. News-template branch generalized

Replaced three hard-coded `templateId === 'news-drop'` checks with a shared
`NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan'])` membership test in:

- `src/lib/ai/prompts.ts` — Gemini news-prompt addendum now fires for both.
- `src/lib/services/carousel.ts` — skip-default-effects branch covers both.
- `src/app/(dashboard)/project/[id]/actions.ts` — same skip branch.

Also bumped `src/__tests__/render/templates.test.ts` count assertion from 6
to 12 so the test suite reflects the new library size.

## Verification

- `npx tsc --noEmit 2>&1 | grep -E "templates|template-picker|prompts|carousel|actions"` — clean (no errors in any touched file).
- `npx vitest run src/__tests__/render` — **3 files, 10 tests passed** (including the bumped templates count assertion).
- `grep -rn "templateId === 'news-drop'" src/` — no stale equality checks remain.
- News Cyan now reuses the entire News Drop pipeline: same Gemini prompt branch (segments + cover/body layouts), same skip-default-effects rendering — only `accentColor` differs.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files created (verified via filesystem):
- src/lib/render/templates/news-cyan.ts — FOUND
- src/lib/render/templates/highlight-bar.ts — FOUND
- src/lib/render/templates/magazine.ts — FOUND
- src/lib/render/templates/quote-card.ts — FOUND
- src/lib/render/templates/y2k-pop.ts — FOUND
- src/lib/render/templates/bold-yellow.ts — FOUND

Commits (verified via `git log`):
- 99c111a — FOUND
- be79827 — FOUND
- f083c5c — FOUND
