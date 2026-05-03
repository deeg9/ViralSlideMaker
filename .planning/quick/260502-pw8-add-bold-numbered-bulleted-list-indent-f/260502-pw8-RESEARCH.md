---
quick: 260502-pw8
mode: quick-task
researched: 2026-05-02
domain: slide-editor / text-formatting / satori-renderer
confidence: HIGH (codebase) + HIGH (Satori constraints) + MEDIUM (Figma/Slate schema patterns — verified via official docs)
---

# Quick 260502-pw8 — Bold + Numbered/Bulleted Lists + Indent: Research

## Summary

Goal: add three text-formatting primitives to TikTokSlideshow's slide editor — Bold, numbered/bulleted lists, indent — that work in BOTH the React preview AND the Satori PNG export.

Two of the three asks are NOT cleanly equivalent in cost. Box-level Bold is **already shipped** (`ActiveTextBoxCard.tsx:199-214` toggles `text_box.font_weight: 700`, both renderers consume `font_weight`). Per-segment Bold is the additive extension and is one schema field + one renderSegments edit.

Lists and indent are the hard part because Satori's CSS subset has **no `display: list-item`, no `<ol>/<ul>/<li>`, no `::marker`, no `::before`** — confirmed by the Satori README. The canonical workaround is to render the marker as a **literal text prefix** on each line (`1. ` / `• `) inside a `flex-direction: column` container with one `<div>` per line.

Phase 60 collision check: **safe to land now**. Plan 60-05 (the only remaining Phase 60 plan) modifies `slide-preview.tsx` (adds union-AABB ring + click-empty + Shift-click extension) and `text-editor-panel.tsx` (branches on `selection.ids.length`), but the *text-rendering blocks* it touches do not include the inner segment-render path. We touch `resolve-overlay.ts` (renderSegments + new helper), the segment block of `render-slide-satori.tsx` (lines 437-451 + 511 + 446-451), the segment paragraph in `slide-preview.tsx` (lines 698-702 + 718-723 + ~840-855), and `ActiveTextBoxCard.tsx` (toolbar additions). Plan 60-05's edits to `slide-preview.tsx` are in the multi-select chrome layer (line ~877+ ring) and the canvas root onClick — different code regions. **Recommended sequencing: land 60-05 first** (it's the bigger merge surface in slide-preview.tsx) and then layer pw8 on top, OR coordinate with the 60-05 author to land pw8 in a separate PR after.

**Primary recommendation:** Ship as a **2-task quick** with the schema below. Per-segment `bold?: boolean` + paragraph-level `list_type?` and `list_indent?` on `TextBox`. Renderers split text on `\n` and prepend marker text. Editor toolbar additions go inline in `ActiveTextBoxCard.tsx`.

---

## PART 1 — Codebase Reconnaissance

### 1. Current schema for text styling

`src/lib/types/slide.ts:10-21` (verbatim):

```ts
export interface TextSegment {
  text: string
  accent?: boolean
  highlightColor?: string
  highlightStyle?: 'pill' | 'block'
  /** Phase 56 (TPL-07, D-21): per-segment font family for ransom-note hooks
      (notes-app-chic template). When set, renderer applies this fontFamily
      via inline style on the segment's <span>. Falls back to template
      fontFamily when undefined. The font loader walks all referenced
      segment fontFamily values and registers them with Satori at render time. */
  fontFamily?: string
}
```

`src/lib/types/slide.ts:95-113` (verbatim):

```ts
export interface TextBox {
  id: string                    // crypto.randomUUID()
  role: TextBoxRole
  text: string
  segments?: TextSegment[]
  font_family?: string
  font_size?: number            // px in 1080x1920 reference
  font_weight?: number
  font_style?: 'normal' | 'italic'
  color?: string
  text_align?: 'left' | 'center' | 'right'
  effects?: TextEffects
  /** Phase 60 (WMARK-01 / future GROUP/LOCK/HIDE): additive multi-select fields. */
  groupId?: string
  locked?: boolean
  hidden?: boolean
  position: TextBoxPosition
}
```

`src/lib/types/slide.ts:23-37` (CustomText, parallel structure):

```ts
export interface CustomText {
  id: string
  text: string
  x: number; y: number; width: number
  font_family?: string
  font_size?: number
  font_weight?: number
  font_style?: 'normal' | 'italic'
  color?: string
  text_align?: 'left' | 'center' | 'right'
  text_effects?: TextEffects
  segments?: TextSegment[]
}
```

**Findings:**

- **Box-level bold already exists** as `font_weight?: number` on `TextBox` (and `CustomText`). Default `400`. Bold = `700`. Hook default is `900` — set in `render-slide-satori.tsx:234` (`fontWeight: 900` hardcoded into hookStyle), and in the React preview at `slide-preview.tsx:409` (`overrides.hook_font_weight ?? 900`). [VERIFIED: codebase grep]
- **Per-segment bold does NOT exist.** `TextSegment` has only `accent`, `highlightColor`, `highlightStyle`, `fontFamily`. No `bold` field. [VERIFIED: codebase, full file read]
- **Zero list-related concept in the schema.** No `list_type`, `bullet_style`, `indent`, `listType`, `listLevel` anywhere in `slide.ts` or anywhere in `src/lib/types/`. [VERIFIED: codebase grep `list_type|bullet|indent` returned no schema hits]
- **`text` is a flat string today.** No paragraph array; no per-line metadata. The text already contains literal `\n` newlines (the textarea at `ActiveTextBoxCard.tsx:176-184` accepts multiline input), but the renderers currently do not split on it — the `renderSegments` helper in `resolve-overlay.ts:162` returns the bare string when there are no segments, and Satori naturally wraps based on `flex-wrap: wrap` (`render-slide-satori.tsx:231`). Any newline in `text` collapses to whitespace inside flex layout.

### 2. Current Satori render of text segments

`src/lib/render/render-slide-satori.tsx:50-57` (verbatim):

```tsx
function renderSegmentChildren(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  return renderSegmentsShared(text, segments, baseColor, accentColor)
}
```

`src/lib/render/render-slide-satori.tsx:225-237` (hook container — verbatim):

```tsx
const hookStyle: React.CSSProperties = {
  position: 'absolute',
  left: pxX(hookX),
  top: pxY(hookY),
  width: hookTextWidth,
  display: 'flex',
  flexWrap: 'wrap',
  textAlign: hookTextAlign,
  fontSize: hookFontSize,
  fontWeight: 900,
  lineHeight: 1.1,
  fontFamily: template.headingFontFamily ?? template.fontFamily,
}
```

`src/lib/render/render-slide-satori.tsx:436-452` (hook + body render — verbatim):

```tsx
{/* Hook text */}
<div style={hookStyle}>
  {renderSegmentChildren(
    slide.hook_text,
    slide.hook_segments,
    isColorOnlyTemplate ? textColor : overrides.hook_text_color ?? textColor,
    accentColor,
  )}
</div>
{/* Body text */}
<div style={bodyStyle}>
  {renderSegmentChildren(
    slide.body_text,
    slide.body_segments,
    isColorOnlyTemplate ? textColor : overrides.body_text_color ?? textColor,
    accentColor,
  )}
</div>
```

`src/lib/render/resolve-overlay.ts:162-225` (renderSegments helper — verbatim, key part):

```ts
export function renderSegments(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  if (!segments || segments.length === 0) return text
  return segments.map((seg, i) => {
    const baseSegmentColor = seg.accent ? accentColor : baseColor
    // ... pill highlight branch ...
    // plain span: NBSP separator between segments, normalize whitespace
    const normalized = seg.text.replace(/\s+/g, ' ')
    const children = isLast ? normalized : `${normalized} `
    return React.createElement('span', { ... }, children)
  })
}
```

**Satori CSS subset constraints (verified):**

- `display` supports only `flex`, `contents`, `none` (defaults to `flex`). [CITED: github.com/vercel/satori README; cross-verified via deepwiki.com/vercel/satori/6.3-text-layout-features]
- **No `<ol>` / `<ul>` / `<li>`** — these aren't in the supported HTML element list.
- **No `::marker`, `::before`, `::after`** pseudo-elements.
- **No `display: list-item`**, no `list-style-type`, no `list-style-position`.
- Existing flex container with `flex-wrap: wrap` packs all children inline. To get one-line-per-list-item we MUST switch to `flex-direction: column` (each child = one row).
- Multi-segment hook already uses flex children (`<span>` siblings); the renderSegments helper normalizes `\s+` to single space (line 204) and emits NBSP separators — meaning **literal `\n` in `text` is currently collapsed**. Lists must therefore opt in via a paragraph-level switch and split text BEFORE handing to renderSegments.

### 3. Current editor toolbar / inspector UI

The editor uses a **right-rail Inspector** (`text-editor-panel.tsx`, 159 lines), composed of `LayerStrip` → `ActiveTextBoxCard` → `SlideSettings` → photo/watermark controls. The active-text-box card (`ActiveTextBoxCard.tsx`, 604 lines) is where every per-textbox property lives.

**Existing controls in `ActiveTextBoxCard.tsx`:**

- Textarea (line 176-184) — multiline, segments cleared on edit
- FontPicker (line 188-192) — `font_family`
- **Bold button** (line 199-214) — toggles `font_weight` between 400 ↔ 700
- **Italic button** (line 215-230) — toggles `font_style` between 'normal' ↔ 'italic'
- AccentWordsDisclosure (line 235-241) — per-segment `accent: true` toggle, collapsed by default
- Size slider (line 244-264) — `font_size`
- Color swatches (line 267-280)
- (Below: align row, effects sub-section with shadow/outline/highlight EffectRows)

**Verbatim Bold button code at `ActiveTextBoxCard.tsx:199-214`:**

```tsx
<button
  type="button"
  data-testid="active-text-box-bold"
  data-active={isBold ? 'true' : 'false'}
  onClick={() => onUpdate({ font_weight: isBold ? 400 : 700 })}
  className={`p-2 rounded-lg transition-all ${FOCUS_RING} ${
    isBold
      ? 'bg-[#3d0000] text-white'
      : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
  }`}
  aria-label="Bold"
  aria-pressed={isBold}
  title="Bold"
>
  <Icon name="format_bold" size="sm" />
</button>
```

The Bold button operates at the **whole-text-box** level. There is no per-word/per-selection bold UI. There is no `editor-toolbar.tsx` floating toolbar — the file `editor-toolbar.tsx` exists (Bash listing shows it) but inspection of the tree shows the rail-Inspector pattern is the canonical surface.

**No List or Indent control anywhere.** Grepped `listType|list_type|bullet|format_list` across `src/components/editor/` — zero hits. [VERIFIED: codebase grep]

### 4. Phase 60 collision check

**60-05-PLAN.md** (the only outstanding Phase 60 plan) modifies these files:

| File | What 60-05 touches |
|---|---|
| `src/lib/editor/transforms/selection-bounds.ts` (NEW) | pure helper |
| `src/components/editor/multi-select-type-bar.tsx` (NEW) | new component |
| `src/components/editor/text-editor-panel.tsx` | adds branch ternary on `selection.ids.length`: N>=2 → MultiSelectTypeBar; N=1 → ActiveTextBoxCard; N=0 → SlideSettings |
| `src/components/slides/slide-preview.tsx` | union-AABB ring (line ~877+ inside editable=true branch); canvas root onClick at line 952-960; per-element onMouseDown at line 1062-1071 (and parallel sites for body/custom_text/custom_image) |
| `src/lib/render/__tests__/parity.test.tsx` | extends PARITY-01 |

**pw8 (this work) wants to touch:**

| File | What pw8 touches |
|---|---|
| `src/lib/types/slide.ts` | additive: `bold?: boolean` on `TextSegment`; `list_type?` + `list_indent?` on `TextBox` |
| `src/lib/render/resolve-overlay.ts` | renderSegments helper → adds `bold` branch; new `renderTextBlock` helper that splits on `\n` + prepends list markers |
| `src/lib/render/render-slide-satori.tsx` | hook + body + custom_texts segment render sites (5 callsites) — replace `renderSegmentChildren` with new `renderTextBlock`-aware path |
| `src/components/slides/slide-preview.tsx` | hook + body + custom_text segment render sites (lines 698-723 + 1089-1098 + 1191-1200 + 1336-1361) — same pattern as Satori |
| `src/components/editor/text-rail/ActiveTextBoxCard.tsx` | adds Bold-segment toggle, List-Type buttons, Indent buttons in the existing toolbar |

**Collision analysis:**

- `text-editor-panel.tsx`: 60-05 wraps the whole `<ActiveTextBoxCard ... />` JSX in a ternary. pw8 doesn't touch this file directly. **No collision.**
- `slide-preview.tsx`: 60-05 modifies the editable=true branch chrome (line ~877 ring) + canvas root onClick (line 952-960) + onMouseDown handlers (line 1062+). pw8 modifies the segment render `<p>` blocks at lines 698-723 + 1089-1200 + 1336-1361 (different code regions, both branches editable AND non-editable since the segment block is shared). **Light collision risk** — both plans modify the same file but in non-overlapping regions. Land sequentially.
- `render-slide-satori.tsx`: 60-05 doesn't touch (the parity gate explicitly enforces the Satori source contains no editor chrome substrings — line 461-462 of 60-05 plan). pw8 modifies hook+body+custom_text segment render. **No collision.**
- `parity.test.tsx`: 60-05 extends PARITY-01 with the multi-selection-ring scan. pw8 should add a parity assertion for list/marker output identity but that's additive. **No collision.**

**Verdict: ship pw8 AFTER 60-05 lands.** 60-05 is in active development as the only outstanding Phase 60 plan; merging pw8 first creates a 3-way merge in `slide-preview.tsx` for the 60-05 author. Wait for 60-05 then layer pw8 cleanly. Alternative: ship pw8 NOW only if 60-05 is paused; coordinate via STATE.md pending-todos.

---

## PART 2 — External Research

### 5. Schema patterns in design tools and rich-text editors

**Figma — `TextListOptions` and `setRangeIndentation`:**

Figma's text node distinguishes per-range (character-level) marks from per-paragraph (line-level) settings. List type is **paragraph-level**:

```ts
type TextListOptions = {
  type: "ORDERED" | "UNORDERED" | "NONE"
}
```

[CITED: developers.figma.com/docs/plugins/api/TextListOptions/]

Indentation is a separate API: `getRangeIndentation` / `setRangeIndentation`, with up to 5 levels supported. [CITED: developers.figma.com/docs/plugins/api/TextNode/]

**TipTap (ProseMirror under the hood) — Marks vs Nodes:**

> "Nodes are like blocks of content, for example paragraphs, headings, code blocks, blockquotes... Marks can be applied to specific parts of a node. That's the case for bold, italic..."

Bold is a **mark** (inline annotation on a leaf). `bullet_list` and `ordered_list` are **block nodes** that wrap `list_item` block nodes. Indent in TipTap's `BulletList`/`OrderedList` extensions is not a numeric field — it's structural (nested list nodes). [CITED: tiptap.dev/docs/editor/core-concepts/schema; tiptap.dev/docs/editor/extensions/nodes/bullet-list]

**Slate.js — Marks vs Block Elements:**

> "marks — annotations placed on the text, such as marking text as bold or italic, and block level elements — the domain-specific 'chunks' that make up your documents, like paragraphs, code blocks and lists"

[CITED: kitemaker.co/blog/building-a-rich-text-editor-in-react-with-slatejs]

**Pattern across all three:**

| Concern | Inline (per-run/per-segment) | Block (per-paragraph/per-line) |
|---|---|---|
| Bold | YES — Slate mark, TipTap mark, Figma per-range | NO |
| Italic | YES — same | NO |
| Color | YES — same | NO |
| **List type** | NO | **YES — paragraph-level** |
| **Indent** | NO | **YES — paragraph-level** |
| Alignment | NO | YES — paragraph-level |

This maps cleanly to our codebase: our `TextSegment` is the inline run, our `TextBox` is the block container.

### 6. Bold-only schemas in segment-based renderers

Slate's bold mark on a leaf:

```ts
{ text: 'Hello', bold: true }
```

[CITED: github.com/ianstormtaylor/slate]

Our existing `TextSegment` already mirrors this exactly with `accent: true`, `highlightColor: '#mintgreen'` etc. as boolean/string flags on the leaf. **Adding `bold?: boolean` is the textbook extension** of the same pattern. No fontWeight numeric on the segment; just a boolean — let the renderer translate to the desired weight (700 by default; the segment renderer reads the box's `font_weight` as base and bumps to 700 when `bold: true`).

### 7. Rendering numbered/bulleted lists in CSS-subset renderers (Satori)

Satori's supported `display` values are **only `flex`, `contents`, `none`** (default `flex`). [CITED: github.com/vercel/satori README; deepwiki.com/vercel/satori/3.3-text-and-fonts]

**`display: list-item` is not supported. `<ol>` / `<ul>` / `<li>` are not in the supported element list. `::marker` / `::before` / `::after` are not supported.**

The canonical workaround for bullets/numbers in CSS-subset renderers is to **embed the marker as literal text** on each line. Search across Satori's issue tracker (#41 supported-properties tracker) and deepwiki's Text and Typography section confirms this: "alternative approaches may involve using text prefixes manually instead of relying on CSS list styling." [CITED: github.com/vercel/satori/issues/41; deepwiki.com/vercel/satori/6-text-and-typography]

Layout pattern:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
  <div style={{ display: 'flex', flexDirection: 'row' }}>
    <span style={{ width: 40, flexShrink: 0 }}>1.</span>
    <span>First item text</span>
  </div>
  <div style={{ display: 'flex', flexDirection: 'row' }}>
    <span style={{ width: 40, flexShrink: 0 }}>2.</span>
    <span>Second item text</span>
  </div>
</div>
```

Indent = the marker column's `width` (or an extra `paddingLeft` on the row container).

This is the same approach used by react-pdf and other CSS-subset renderers. [ASSUMED — common pattern; verified for Satori specifically above]

---

## PART 3 — Recommendation

### 8. Concrete schema proposal

```ts
// src/lib/types/slide.ts

export interface TextSegment {
  text: string
  accent?: boolean
  bold?: boolean              // NEW (pw8): per-segment bold mark.
  highlightColor?: string
  highlightStyle?: 'pill' | 'block'
  fontFamily?: string
}

export interface TextBox {
  id: string
  role: TextBoxRole
  text: string
  segments?: TextSegment[]
  font_family?: string
  font_size?: number
  font_weight?: number
  font_style?: 'normal' | 'italic'
  color?: string
  text_align?: 'left' | 'center' | 'right'
  effects?: TextEffects
  // NEW (pw8) — paragraph-level (Figma + Slate + TipTap pattern):
  list_type?: 'none' | 'numbered' | 'bulleted'   // default: 'none'
  list_indent?: number                            // 0|1|2 indent levels; default 0
  groupId?: string
  locked?: boolean
  hidden?: boolean
  position: TextBoxPosition
}

// Same additions to CustomText for parallel completeness:
export interface CustomText {
  // ...existing...
  list_type?: 'none' | 'numbered' | 'bulleted'
  list_indent?: number
}
```

**Rationale:**

- `bold?: boolean` on `TextSegment` mirrors `accent?: boolean` exactly. Renderer maps `true` → font-weight 700, falling back to box-level `font_weight` when `false`/`undefined`. No migration; default behavior unchanged.
- `list_type` on `TextBox` (NOT segment) — paragraph-level per Figma's `TextListOptions` and ProseMirror's `bullet_list`/`ordered_list` block nodes. A union string keeps it grep-friendly.
- `list_indent` is a small integer (0/1/2) — sufficient for carousel slides per the user's "not long-form documents" framing. Figma supports 5 levels; we ship 3.
- `list_indent` is in indent-LEVELS, NOT px/em. Renderer multiplies by a constant (`INDENT_PX_PER_LEVEL = 32`) so visual scale stays consistent across templates.
- All three fields are **additive optionals**. No migration. Legacy slides render byte-identical (TPLREND-05 preserved by default-when-absent contract).

**Lines split on `\n`.** Each line of `text_box.text.split('\n')` becomes one list item when `list_type !== 'none' && list_type !== undefined`. When `list_type === 'none'` (or undefined), text renders as it does today (single flex container, segments inline) — identical pre/post pw8 for all existing slides.

### 9. Renderer changes (Satori + browser)

Both `render-slide-satori.tsx` and `slide-preview.tsx` consume the shared `renderSegments` helper from `resolve-overlay.ts`. Add a NEW shared helper `renderTextBlock` that handles list-type + multi-line. Both renderers call it; TPLREND-05 parity preserved by single source of truth.

```ts
// src/lib/render/resolve-overlay.ts — NEW helper

const INDENT_PX_PER_LEVEL = 32
const MARKER_WIDTH_PX = 48

export function renderTextBlock(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
  opts: {
    listType?: 'none' | 'numbered' | 'bulleted'
    listIndent?: number
  } = {},
): React.ReactNode {
  const { listType = 'none', listIndent = 0 } = opts

  // Path A: no list — preserve current behavior exactly (renderSegments)
  if (listType === 'none' || !listType) {
    return renderSegments(text, segments, baseColor, accentColor)
  }

  // Path B: list — split on \n, one row per line, marker prefix in own span
  const lines = text.split('\n')
  const indentPx = listIndent * INDENT_PX_PER_LEVEL

  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        paddingLeft: indentPx,
        width: '100%',
      },
    },
    ...lines.map((line, i) => {
      const marker = listType === 'numbered' ? `${i + 1}.` : '•'
      // Slice segments per-line is non-trivial; for v1 ship the simple model:
      // each line renders without per-segment styling (one per-line plain span).
      // Per-segment styling within a list line is a v2 follow-up.
      return React.createElement(
        'div',
        { key: `line-${i}`, style: { display: 'flex', flexDirection: 'row' } },
        React.createElement(
          'span',
          { style: { width: MARKER_WIDTH_PX, flexShrink: 0, color: baseColor } },
          marker,
        ),
        React.createElement('span', { style: { color: baseColor } }, line),
      )
    }),
  )
}
```

**Per-segment Bold** in renderSegments: extend the existing inline span style:

```ts
// inside renderSegments, where the plain-span branch builds style:
style: {
  color: baseSegmentColor,
  ...(seg.bold ? { fontWeight: 700 } : {}),  // NEW
  maxWidth: '100%',
  overflowWrap: 'break-word',
  ...segmentFontFamily,
}
```

Pill branch: same — append `fontWeight: 700` when `seg.bold === true`.

**Caller wiring (5 sites in Satori, 4 in slide-preview):**

Replace each call to `renderSegments(text, segments, baseColor, accentColor)` with `renderTextBlock(text, segments, baseColor, accentColor, { listType: tb.list_type, listIndent: tb.list_indent })`.

For the legacy hook/body fields (`slide.hook_text` + `slide.hook_segments`), call sites in Satori use the legacy fields — those don't carry list_type. Look up the matching text_box first:

```ts
const hookBox = (slide.text_boxes ?? []).find(tb => tb.role === 'hook')
const listOpts = hookBox ? { listType: hookBox.list_type, listIndent: hookBox.list_indent } : {}
renderTextBlock(slide.hook_text, slide.hook_segments, hookTextColor, accentColor, listOpts)
```

The dual-write pattern (`applyDualWrite`) from Phase 50 keeps `slide.text_boxes[]` and the legacy `slide.hook_text` mirrored, so this lookup always succeeds.

**Critical Satori constraint to test:** when a `<div>` has `flex-direction: column`, every child is a row. Existing flex-wrap inline behavior is preserved by the `listType === 'none'` Path A short-circuit — zero behavior change for non-list slides. Verify with a parity test rendering a 2-segment hook with `list_type === 'none'` produces byte-identical output pre/post.

### 10. Editor UI

Add a **List Type segmented control** + **Indent buttons** to `ActiveTextBoxCard.tsx`, in a new "List" row immediately below the existing Style row (Bold/Italic at line 194-231) and before the AccentWordsDisclosure section:

```tsx
{/* List row — pw8 */}
<div className="flex gap-2 items-center">
  <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mr-1">
    List
  </span>
  {/* None / Bulleted / Numbered tri-state */}
  <button onClick={() => onUpdate({ list_type: 'none' })} aria-label="No list" ...>
    <Icon name="format_clear" size="sm" />
  </button>
  <button onClick={() => onUpdate({ list_type: 'bulleted' })} aria-label="Bulleted list" ...>
    <Icon name="format_list_bulleted" size="sm" />
  </button>
  <button onClick={() => onUpdate({ list_type: 'numbered' })} aria-label="Numbered list" ...>
    <Icon name="format_list_numbered" size="sm" />
  </button>
  {/* Indent (only when list_type !== 'none') */}
  {textBox.list_type && textBox.list_type !== 'none' && (
    <>
      <button onClick={() => onUpdate({ list_indent: Math.max(0, (textBox.list_indent ?? 0) - 1) })}
              aria-label="Decrease indent" ...>
        <Icon name="format_indent_decrease" size="sm" />
      </button>
      <button onClick={() => onUpdate({ list_indent: Math.min(2, (textBox.list_indent ?? 0) + 1) })}
              aria-label="Increase indent" ...>
        <Icon name="format_indent_increase" size="sm" />
      </button>
    </>
  )}
</div>
```

**Per-segment Bold:** The existing AccentWordsDisclosure pattern is the right home — segments-as-chips toggling per-word state. v1 of pw8 ships paragraph-level Bold (already exists). Per-segment Bold is a separate sub-feature; if shipping, mirror AccentWordsDisclosure into a new `BoldWordsDisclosure` component that toggles `seg.bold`. **Recommendation: defer per-segment bold to a follow-up.** v1 ships only paragraph-level Bold (already wired) + List + Indent.

Material Icons used (`format_bold`, `format_italic`, `format_align_*` already in the codebase): `format_list_bulleted`, `format_list_numbered`, `format_indent_increase`, `format_indent_decrease`, `format_clear` — all standard Material Symbols, already available since `font-picker.tsx` uses the same icon set.

### 11. Phase 60 coordination

**Sequencing recommendation:** land 60-05 first, pw8 second.

- 60-05 modifies `slide-preview.tsx` in the editor-chrome layer (line ~877 ring; 952-960 onClick; 1062+ onMouseDown). pw8 modifies `slide-preview.tsx` in the text-render layer (lines 698-723; 1089-1200; 1336-1361). Different regions but same file.
- If pw8 lands first, the 60-05 author hits a conflict-free merge at the chrome layer but a textual conflict in the text-render blocks IF the line numbers shift much (~50 LOC of new ternary wrappers per text-render site = ~250 LOC total = real shift).
- If 60-05 lands first, pw8's text-render edits sit cleanly on top with no conflict.

**Hard guarantee:** pw8 does NOT touch any of these 60-05 files: `selection-bounds.ts` (new), `multi-select-type-bar.tsx` (new), `parity.test.tsx` (60-05 extends one test; pw8 adds a separate test). And pw8 does NOT touch the segments of `slide-preview.tsx` that 60-05 modifies (chrome / event handlers).

### 12. Scope verdict

**Quick task — 2 atomic tasks. Ship-now bias is correct.**

Cost breakdown:
- Schema additions: 3 fields (1 segment + 2 box) — ~6 LOC in `slide.ts`
- New helper `renderTextBlock` in `resolve-overlay.ts`: ~40 LOC
- Per-segment bold in `renderSegments`: ~2 LOC
- Renderer wiring (5 Satori sites + 4 preview sites): ~30 LOC of replace-call edits
- Editor UI (List Type + Indent buttons in `ActiveTextBoxCard.tsx`): ~40 LOC
- Tests: parity test for byte-identity when list_type='none' (10 LOC); list-render markup test (15 LOC); per-segment bold render test (10 LOC) — ~35 LOC

**Total: ~150 LOC across ~5 files.** Below the threshold for a phase. Below the threshold for splitting into 3+ tasks.

**Suggested 2-task split:**

| Task | Scope |
|---|---|
| **Task 1** — Schema + Renderer | Add `bold?` to `TextSegment`; add `list_type?` + `list_indent?` to `TextBox` + `CustomText`. Add `renderTextBlock` helper to `resolve-overlay.ts`. Add `bold` branch to `renderSegments`. Replace all 9 callsites (5 Satori, 4 preview). Add 2 parity tests (none-list byte-identity + list-markup-presence). |
| **Task 2** — Editor UI | Add "List" row to `ActiveTextBoxCard.tsx` with bulleted/numbered/none tri-state + indent +/- buttons. Wire to `onUpdate({ list_type, list_indent })`. Component test for the buttons. |

**Sequencing inside the quick task:** Task 1 first (schema + renderer ships behind no UI — invisible until used). Task 2 wires the UI to the already-shipped renderer. Each task ships green independently.

**Out of scope for v1 of this quick task** (deferrable):
- Per-segment Bold UI (paragraph-level Bold already exists at `font_weight` toggle)
- Per-line segments inside a list item (lists render plain text per-line; pills/highlights inside list lines is v2)
- Tab key in textarea to indent (keyboard shortcut — add later)
- Nested lists (we ship 3-level indent, not nested ol-in-ol)
- Text-wrap inside a list line (relies on Satori flex layout — should "just work" but verify in Task 1's tests)

---

## Phase 60 Constraint Compliance

| Cross-phase constraint | How pw8 honors it |
|---|---|
| `onDragStop` / `onResizeStop` only | N/A — no drag handlers added |
| `isEditing` keyboard guard | N/A — no keyboard shortcuts added (Tab-to-indent deferred) |
| `pushHistory` once per gesture | YES — toolbar button click = single dispatch via existing `onUpdate` → `UPDATE_TEXT_BOX` reducer action |
| Editor chrome gates `editable={true}` | N/A in the negative direction — list rendering is content, NOT chrome. Lists must render in BOTH editable=true AND editable=false branches AND Satori (TPLREND-05 parity). The renderTextBlock helper sits in `resolve-overlay.ts` consumed by both — single source of truth. |
| Z-order = array splice | N/A |
| Selection state outside reducer history | N/A |
| **TPLREND-05 parity invariant** | YES — single shared helper `renderTextBlock` consumed by Satori AND React preview AND HTML export. Parity test verifies byte-identical markup for list_type === 'none' (back-compat) AND structurally-identical markup for list_type !== 'none'. |

---

## Open Questions

1. **Per-segment Bold UI surface.** Box-level Bold already exists. Per-segment Bold is the natural extension of `accent?: boolean` → mirror AccentWordsDisclosure into `BoldWordsDisclosure`. Defer to v2 unless the user explicitly asks for it.
2. **Hook box list rendering.** The hook is hardcoded to `fontWeight: 900` in Satori (`render-slide-satori.tsx:234`) and `flex-wrap: wrap`. Switching to `flex-direction: column` for a hook list is a behavior change for one specific text role. **Recommendation: allow lists on body + custom text boxes only in v1; gate `list_type` UI to non-hook roles.** Hooks are typically 1-line headlines; carousel "list slides" use the body or a dedicated custom text box.
3. **Multi-line text in non-list mode.** Today, `\n` in `text` is collapsed by Satori's flex layout. Adding `\n`-aware rendering even when `list_type === 'none'` is a UX improvement (currently users can't make a 2-line body — they have to live with auto-wrap). **Out of scope for pw8** — but worth flagging.
4. **`\n` editing UX.** The textarea at `ActiveTextBoxCard.tsx:176-184` accepts Enter for newlines today. With list_type set, Enter = new list item. Verify that `e.target.value` from the textarea preserves `\n` (it does — standard HTMLTextAreaElement behavior). No special handler needed.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/types/slide.ts` — full TextSegment / TextBox / CustomText / Slide schema
- `src/lib/render/render-slide-satori.tsx` — Satori render path with verbatim hook + body block quotes
- `src/lib/render/resolve-overlay.ts:162-225` — renderSegments helper, the canonical segment-render module shared between Satori and React preview
- `src/components/editor/text-rail/ActiveTextBoxCard.tsx:194-231` — verbatim Bold/Italic toolbar
- `src/components/editor/text-editor-panel.tsx` — composition shell, 159 lines
- `.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-05-PLAN.md` — verbatim file-touch list and parity gate enforcement
- [Satori README + supported CSS](https://github.com/vercel/satori) — verified `display` supports only `flex | contents | none`
- [Satori Text and Typography (deepwiki)](https://deepwiki.com/vercel/satori/6-text-and-typography) — text-prefix workaround reference
- [Figma TextListOptions](https://developers.figma.com/docs/plugins/api/TextListOptions/) — `type: "ORDERED" | "UNORDERED" | "NONE"` schema verbatim
- [Figma TextNode setRangeIndentation](https://www.figma.com/plugin-docs/api/TextNode/) — 5 indent levels supported

### Secondary (MEDIUM confidence)
- [TipTap Schema docs](https://tiptap.dev/docs/editor/core-concepts/schema) — Marks vs Nodes distinction
- [TipTap BulletList](https://tiptap.dev/docs/editor/extensions/nodes/bullet-list) — block-node list pattern
- [Slate.js README](https://github.com/ianstormtaylor/slate) — leaf marks vs block elements
- [Kitemaker SlateJS guide](https://kitemaker.co/blog/building-a-rich-text-editor-in-react-with-slatejs) — marks-as-annotations quote
- [Satori issue #41](https://github.com/vercel/satori/issues/41) — supported-properties tracker (referenced for "list-style not implemented")

### Tertiary (LOW confidence — flagged)
- The "text-prefix workaround" for Satori lists is widely the canonical approach but I did not find a single authoritative quote from Vercel docs explicitly recommending it. The structural confirmation (display: flex-only + no list-item) is HIGH; the recommended workaround is INFERRED from those constraints + community usage. [ASSUMED]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | "Indent in indent-LEVELS (0/1/2) is sufficient for carousel use" | §8 schema | Low — easy to extend to numeric px later if 3 levels insufficient |
| A2 | "Satori's flex-column with one div per line will wrap text within each line correctly" | §9 renderer | Medium — needs Task 1 test to verify; if wrap fails, we'd need explicit `width: '100%'` on the line span |
| A3 | "Per-segment styling within a list line can be deferred to v2 (lines render plain)" | §9 renderer | Low — explicit scope-out, not a hidden assumption |
| A4 | "Hook text boxes should NOT support list_type (gate UI to body + custom)" | §Open Q2 | Low — UI gate is trivial to add or remove |

---

## RESEARCH COMPLETE

`.planning/quick/260502-pw8-add-bold-numbered-bulleted-list-indent-f/260502-pw8-RESEARCH.md`
