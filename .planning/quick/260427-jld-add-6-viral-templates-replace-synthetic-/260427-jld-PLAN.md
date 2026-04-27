---
quick_task: 260427-jld
type: execute
mode: quick
autonomous: true
files_modified:
  - src/lib/render/templates/index.ts
  - src/lib/render/templates/news-drop.ts
  - src/lib/render/templates/bold-minimal.ts
  - src/lib/render/templates/dark-gradient.ts
  - src/lib/render/templates/soft-pastel.ts
  - src/lib/render/templates/neon-pop.ts
  - src/lib/render/templates/clean-serif.ts
  - src/lib/render/templates/news-cyan.ts
  - src/lib/render/templates/highlight-bar.ts
  - src/lib/render/templates/magazine.ts
  - src/lib/render/templates/quote-card.ts
  - src/lib/render/templates/y2k-pop.ts
  - src/lib/render/templates/bold-yellow.ts
  - src/components/slides/template-picker.tsx
  - src/lib/ai/prompts.ts
  - src/app/(dashboard)/project/[id]/actions.ts
  - src/lib/services/carousel.ts

must_haves:
  truths:
    - "Template picker shows 12 templates (6 existing + 6 new viral styles)"
    - "Each picker tile renders a real mini SlidePreview at 9:16 with sample text — no more synthetic 'Aa' swatches"
    - "Picking 'News Cyan' generates carousels with cyan accent words via the same Gemini news prompt branch as News Drop"
    - "Picking 'Bold Yellow', 'Magazine', 'Quote Card', 'Y2K Pop', 'Highlight Bar' renders the styled headline + body in editor preview"
  artifacts:
    - path: "src/lib/render/templates/news-cyan.ts"
      provides: "News Cyan template (black bg, cyan accent)"
    - path: "src/lib/render/templates/highlight-bar.ts"
      provides: "Highlight Bar template (white bg, yellow highlight bars)"
    - path: "src/lib/render/templates/magazine.ts"
      provides: "Magazine template (Playfair serif, off-white bg)"
    - path: "src/lib/render/templates/quote-card.ts"
      provides: "Quote Card template (Lora italic on deep navy)"
    - path: "src/lib/render/templates/y2k-pop.ts"
      provides: "Y2K Pop template (pink→blue gradient, Righteous font)"
    - path: "src/lib/render/templates/bold-yellow.ts"
      provides: "Bold Yellow template (Bebas Neue on solid yellow)"
    - path: "src/lib/render/templates/index.ts"
      provides: "SlideTemplate.sample field + 12 templates registered"
    - path: "src/components/slides/template-picker.tsx"
      provides: "Mini SlidePreview thumbnails per tile (9:16)"
  key_links:
    - from: "src/components/slides/template-picker.tsx"
      to: "src/components/slides/slide-preview.tsx"
      via: "<SlidePreview slide={makeSampleSlide(template)} template={template} index={0} editable={false} />"
    - from: "src/lib/ai/prompts.ts"
      to: "src/lib/render/templates/news-cyan.ts"
      via: "NEWS_TEMPLATES set includes 'news-cyan' so news prompt branch fires"
    - from: "src/app/(dashboard)/project/[id]/actions.ts"
      to: "src/lib/render/templates/news-cyan.ts"
      via: "Same NEWS_TEMPLATES set guarding skip-default-effects branch"
    - from: "src/lib/services/carousel.ts"
      to: "src/lib/render/templates/news-cyan.ts"
      via: "Same NEWS_TEMPLATES set guarding skip-default-effects branch"
---

<objective>
Add 6 new viral-pattern templates (News Cyan, Highlight Bar, Magazine, Quote Card, Y2K Pop, Bold Yellow) and replace the picker's synthetic "Aa" swatches with real mini SlidePreview renders so users see exactly what they're picking.

Purpose: Today's 6 generic templates and identical-looking thumbnails make picking guesswork. Real viral creator styles + real previews = instant style match.
Output: 12 total templates registered; picker renders 9:16 mini SlidePreviews per tile; news prompt branch covers both News Drop and News Cyan.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/deeg/.claude/plans/okay-just-research-me-rosy-pinwheel.md
@src/lib/render/templates/index.ts
@src/lib/render/templates/news-drop.ts
@src/components/slides/template-picker.tsx
@src/components/slides/slide-preview.tsx
@src/lib/types/slide.ts
@src/lib/ai/prompts.ts
@src/lib/services/carousel.ts
@src/app/(dashboard)/project/[id]/actions.ts
@src/lib/fonts/font-catalog.ts

<interfaces>
<!-- Key contracts the executor needs. Use these directly — no codebase exploration needed. -->

From src/lib/render/templates/index.ts:
```typescript
export interface SlideTemplate {
  id: string
  name: string
  thumbnail: string
  fontFamily: string
  hookFontSize: string
  bodyFontSize: string
  textColor: string
  backgroundColor: string
  overlayColor: string
  overlayOpacity: number
  textAlign: 'left' | 'center' | 'right'
  textPosition: 'top' | 'center' | 'bottom'
  hookStyle: 'uppercase' | 'normal' | 'italic'
  accentColor?: string
}
export const templates: SlideTemplate[]
export function getTemplate(id: string): SlideTemplate
```

From src/lib/types/slide.ts:
```typescript
export interface TextSegment { text: string; accent?: boolean }
export interface Slide {
  hook_text: string
  body_text: string
  hook_segments?: TextSegment[]
  body_segments?: TextSegment[]
  image_query: string
  is_cta: boolean
  background_url: string | null
  pexels_photo_id: number | null
  style_overrides?: SlideStyleOverrides
  custom_texts?: CustomText[]
  custom_images?: CustomImage[]
}
export interface SlideStyleOverrides {
  layout?: 'cover' | 'body'
  // ...other fields
}
```

From src/components/slides/slide-preview.tsx:
```typescript
// SlidePreview renders any Slide+SlideTemplate at 1080x1920 then scales via transform.
// Set editable={false} to skip Rnd interactions. background_url=null skips remote loads.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend SlideTemplate with sample field, add 6 new template files, populate samples for all 12</name>
  <files>
    src/lib/render/templates/index.ts,
    src/lib/render/templates/news-drop.ts,
    src/lib/render/templates/bold-minimal.ts,
    src/lib/render/templates/dark-gradient.ts,
    src/lib/render/templates/soft-pastel.ts,
    src/lib/render/templates/neon-pop.ts,
    src/lib/render/templates/clean-serif.ts,
    src/lib/render/templates/news-cyan.ts,
    src/lib/render/templates/highlight-bar.ts,
    src/lib/render/templates/magazine.ts,
    src/lib/render/templates/quote-card.ts,
    src/lib/render/templates/y2k-pop.ts,
    src/lib/render/templates/bold-yellow.ts
  </files>
  <action>
1. **Edit `src/lib/render/templates/index.ts`** — extend `SlideTemplate` with optional `sample` field (import `TextSegment` from `@/lib/types/slide`):
```typescript
import type { TextSegment } from '@/lib/types/slide'

export interface SlideTemplate {
  // ... existing fields ...
  accentColor?: string
  sample?: {
    hook_text: string
    body_text: string
    hook_segments?: TextSegment[]
    layout?: 'cover' | 'body'
  }
}
```
Then import all 12 templates and register them in the `templates` array (preserve existing order, append the 6 new ones at the end):
```typescript
import { newsCyan } from './news-cyan'
import { highlightBar } from './highlight-bar'
import { magazine } from './magazine'
import { quoteCard } from './quote-card'
import { y2kPop } from './y2k-pop'
import { boldYellow } from './bold-yellow'

export const templates: SlideTemplate[] = [
  boldMinimal, darkGradient, softPastel, neonPop, cleanSerif, newsDrop,
  newsCyan, highlightBar, magazine, quoteCard, y2kPop, boldYellow,
]
```

2. **Add `sample` to all 6 existing templates** (`news-drop.ts`, `bold-minimal.ts`, `dark-gradient.ts`, `soft-pastel.ts`, `neon-pop.ts`, `clean-serif.ts`). For `news-drop.ts` use segments + `layout: 'cover'`:
```typescript
sample: {
  hook_text: 'OPENAI WINS LANDMARK COPYRIGHT CASE',
  body_text: 'Federal court rules training on public data is fair use.',
  hook_segments: [
    { text: 'OPENAI', accent: true },
    { text: 'WINS' },
    { text: 'LANDMARK' },
    { text: 'COPYRIGHT', accent: true },
    { text: 'CASE' },
  ],
  layout: 'cover',
}
```
For the other 5 existing templates, pick representative `hook_text` + `body_text` matching their style (e.g. `bold-minimal`: "STOP DOING THIS" / "Your morning routine is broken."; `clean-serif`: "The Quiet Power of Routine" / "Why high performers protect their mornings."; `soft-pastel`: "Glow Up Your Mornings" / "5 habits to start tomorrow."; `neon-pop`: "LEVEL UP" / "Productivity hacks that actually work."; `dark-gradient`: "Future of AI" / "What changes in 2026.").

3. **Create the 6 new template files** following the field table from the design doc. Each is a single-export file matching `news-drop.ts` shape:

- `src/lib/render/templates/news-cyan.ts`: clone `news-drop.ts` shape with `id: 'news-cyan'`, `name: 'News Cyan'`, `thumbnail: '/templates/news-cyan.png'`, `accentColor: '#00E5FF'`. Sample: `hook_text: 'AMAZON FACES PRICE-FIXING ALLEGATIONS'` with segments accenting `AMAZON` and `PRICE-FIXING`, `body_text: 'FTC opens formal probe into marketplace fee structure.'`, `layout: 'cover'`.

- `src/lib/render/templates/highlight-bar.ts`: `id: 'highlight-bar'`, `name: 'Highlight Bar'`, `fontFamily: "'Inter', sans-serif"`, `hookFontSize: '96px'`, `bodyFontSize: '36px'`, `textColor: '#000000'`, `backgroundColor: '#ffffff'`, `overlayColor: '#FFD600'`, `overlayOpacity: 0`, `textAlign: 'left'`, `textPosition: 'center'`, `hookStyle: 'uppercase'`, `accentColor: '#FFD600'`. Sample: `hook_text: 'HOW I GAINED 50K FOLLOWERS'`, `body_text: 'In 30 days using only carousel posts.'`.

- `src/lib/render/templates/magazine.ts`: `id: 'magazine'`, `name: 'Magazine'`, `fontFamily: "'Playfair Display', serif"`, `hookFontSize: '92px'`, `bodyFontSize: '34px'`, `textColor: '#1a1a1a'`, `backgroundColor: '#fffbf5'`, `overlayColor: '#1a1a1a'`, `overlayOpacity: 0`, `textAlign: 'left'`, `textPosition: 'center'`, `hookStyle: 'normal'`. Sample: `hook_text: 'The Quiet Power of Routine'`, `body_text: 'Why the highest-performing people protect their mornings.'`.

- `src/lib/render/templates/quote-card.ts`: `id: 'quote-card'`, `name: 'Quote Card'`, `fontFamily: "'Lora', serif"`, `hookFontSize: '78px'`, `bodyFontSize: '32px'`, `textColor: '#f5f5f5'`, `backgroundColor: '#1a1a2e'`, `overlayColor: '#1a1a2e'`, `overlayOpacity: 0`, `textAlign: 'center'`, `textPosition: 'center'`, `hookStyle: 'italic'`. Sample: `hook_text: 'Be so good they can’t ignore you.'`, `body_text: '— Steve Martin'`.

- `src/lib/render/templates/y2k-pop.ts`: `id: 'y2k-pop'`, `name: 'Y2K Pop'`, `fontFamily: "'Righteous', sans-serif"` (Bungee fallback per design — Righteous already in font catalog), `hookFontSize: '104px'`, `bodyFontSize: '36px'`, `textColor: '#ffffff'`, `backgroundColor: '#FF1493'` (solid pink — gradient handled at render layer if/when supported; solid is acceptable v1), `overlayColor: '#00BFFF'`, `overlayOpacity: 0`, `textAlign: 'center'`, `textPosition: 'center'`, `hookStyle: 'uppercase'`. Sample: `hook_text: 'TOTALLY ICONIC'`, `body_text: '5 Y2K trends back in 2026.'`.

- `src/lib/render/templates/bold-yellow.ts`: `id: 'bold-yellow'`, `name: 'Bold Yellow'`, `fontFamily: "'Bebas Neue', sans-serif"`, `hookFontSize: '120px'`, `bodyFontSize: '38px'`, `textColor: '#000000'`, `backgroundColor: '#FFD600'`, `overlayColor: '#000000'`, `overlayOpacity: 0`, `textAlign: 'left'`, `textPosition: 'center'`, `hookStyle: 'uppercase'`. Sample: `hook_text: 'STOP SCROLLING'`, `body_text: 'This will change how you post forever.'`.

Each file follows the `news-drop.ts` import pattern: `import type { SlideTemplate } from './index'` then `export const xName: SlideTemplate = { ... }`.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "templates|template-picker" | head -30 || echo "no template-related TS errors"</automated>
  </verify>
  <done>12 templates exported from `templates` array; `SlideTemplate.sample` field defined; all 12 templates have a `sample`; tsc shows no errors in templates/* files.</done>
</task>

<task type="auto">
  <name>Task 2: Replace synthetic "Aa" thumbnails with real mini SlidePreview renders in template-picker</name>
  <files>src/components/slides/template-picker.tsx</files>
  <action>
Rewrite `src/components/slides/template-picker.tsx` to render a real `<SlidePreview>` per tile:

1. Add imports:
```typescript
import { SlidePreview } from './slide-preview'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
```

2. Add a `makeSampleSlide` helper near the top of the file:
```typescript
function makeSampleSlide(template: SlideTemplate): Slide {
  const sample = template.sample
  return {
    hook_text: sample?.hook_text ?? 'Sample headline',
    body_text: sample?.body_text ?? 'Sample body text.',
    hook_segments: sample?.hook_segments,
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: sample?.layout ? { layout: sample.layout } : {},
  }
}
```

3. Replace the inner tile content. Change the outer button width from `w-48` to `w-40` and the inner div from `aspect-[4/3]` to `aspect-[9/16]`. Replace the synthetic `Aa` markup (lines ~29-49) with:
```tsx
<div
  className={`aspect-[9/16] rounded-xl overflow-hidden mb-3 border-2 transition-all relative ${
    isSelected
      ? 'border-[#3d0000]'
      : 'border-transparent group-hover:border-[#dbc1bc]'
  }`}
>
  <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-500 pointer-events-none">
    <SlidePreview
      slide={makeSampleSlide(template)}
      template={template}
      index={0}
      editable={false}
    />
  </div>
</div>
```

If `SlidePreview` requires additional props (brandKit, etc.), pass minimal/undefined values to keep it non-interactive — match the prop shape from existing call sites. Confirm by grepping `<SlidePreview` in src/ for an existing non-editable call to mirror its prop set.

4. Keep the label/style line below the tile unchanged.

Keep the `pointer-events-none` wrapper so click events go to the parent button.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "template-picker" | head -20 || echo "no template-picker TS errors"</automated>
  </verify>
  <done>template-picker.tsx imports SlidePreview, renders 12 mini 9:16 previews each with real sample text; no synthetic "Aa" markup remains; tsc clean for this file.</done>
</task>

<task type="auto">
  <name>Task 3: Extend news-template branch to include news-cyan in prompts and skip-defaults logic</name>
  <files>src/lib/ai/prompts.ts, src/app/(dashboard)/project/[id]/actions.ts, src/lib/services/carousel.ts</files>
  <action>
In each of the three files, find the existing check for `templateId === 'news-drop'` (or equivalent string compare) and replace with a shared set membership check.

1. **`src/lib/ai/prompts.ts`** — at module scope (or near the existing news branch), add:
```typescript
const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan'])
```
Change `if (templateId === 'news-drop')` → `if (NEWS_TEMPLATES.has(templateId))`. If there are multiple occurrences, update all.

2. **`src/app/(dashboard)/project/[id]/actions.ts`** — same replacement. If `NEWS_TEMPLATES` constant lives in a shared util already, import from there instead of redeclaring; otherwise declare a local `const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan'])` near the news branch.

3. **`src/lib/services/carousel.ts`** — same replacement.

If you find the news-template check is already abstracted into a helper (e.g. `isNewsTemplate(id)`), update only the helper instead of all three files.

After edit, grep to confirm no stale `'news-drop'` string-equals checks remain that should also accept `'news-cyan'`:
```
grep -rn "news-drop" src/lib/ai src/app/\(dashboard\)/project src/lib/services
```
Any remaining occurrence should be reviewed — preserve only display strings (e.g. fallback labels), update logic checks.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "prompts|actions|carousel" | head -20 || echo "no TS errors in modified files" ; echo "---" ; grep -rn "templateId === 'news-drop'" src/ 2>/dev/null && echo "STILL HAS STALE EQUALITY CHECK" || echo "all news-drop equality checks updated"</automated>
  </verify>
  <done>All three files use a `NEWS_TEMPLATES` set check covering both `news-drop` and `news-cyan`; no stale `templateId === 'news-drop'` equality checks remain in logic paths; tsc clean.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes (or only shows pre-existing errors unrelated to this task).
2. Dev server starts; project page template picker shows 12 tiles, each a real 9:16 mini SlidePreview with sample text, no `Aa` placeholders.
3. Pick "News Cyan", generate a topic — Gemini emits accent segments + cover/body layouts identical to News Drop, but the editor preview shows cyan accent words.
4. Pick "Bold Yellow", "Magazine", "Quote Card" — each renders correctly in the editor preview with the right font + bg + accent colors.
5. Existing News Drop flow still works (regression check).
</verification>

<success_criteria>
- 12 templates registered in `src/lib/render/templates/index.ts`.
- `SlideTemplate.sample` field exists and is populated for all 12 templates.
- Template picker renders mini `<SlidePreview>` per tile at 9:16 aspect; no synthetic "Aa" rendering remains.
- News template branch in prompts/actions/carousel covers both `news-drop` and `news-cyan`.
- `npx tsc --noEmit` clean for all modified files.
</success_criteria>

<output>
After completion, create `.planning/quick/260427-jld-add-6-viral-templates-replace-synthetic-/260427-jld-SUMMARY.md` documenting the new templates, the picker rewrite, and the news-branch generalization.
</output>
