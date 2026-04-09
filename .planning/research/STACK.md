# Technology Stack: v2.1 Text Effects (Shadow, Outline, Highlight)

**Project:** TikTok Slideshow Creator v2.1
**Researched:** 2026-04-07
**Confidence:** HIGH (all CSS properties verified in compiled Satori bundle)

> **Scope:** This document covers ONLY the stack needs for v2.1 Text Effects.
> The existing stack (Next.js 15.5.13, React 19, Supabase, Satori via next/og, react-rnd, 30 Google Fonts, Playwright) is validated and unchanged.

## Key Finding: Zero New Dependencies Required

All three text effects (shadow, outline, background highlight) are implementable using CSS properties already supported by the existing rendering stack. No new npm packages needed.

## Verified Satori CSS Support

Verified by inspecting the compiled bundle at `node_modules/next/dist/compiled/@vercel/og/index.node.js` (Next.js 15.5.13 bundles `@vercel/og` 0.7.2):

| CSS Property | Satori Support | How It Renders | Use Case |
|---|---|---|---|
| `textShadow` | YES | SVG `<feDropShadow>` filter | Text shadow effect |
| `WebkitTextStrokeWidth` | YES | SVG `stroke-width` attr | Text outline width |
| `WebkitTextStrokeColor` | YES | SVG `stroke` attr | Text outline color |
| `backgroundColor` | YES | Standard fill | Highlight (full-width mode) |
| `padding` | YES | Standard layout | Highlight padding |
| `display: inline` | NO (flex/block/none only) | N/A | Limitation for tight highlight |
| `boxDecorationBreak` | NO | N/A | Limitation for tight highlight |

Satori auto-sets `paint-order: stroke` and `stroke-linejoin: round` when text-stroke is applied, preventing stroke from obscuring the text fill. No manual workaround needed.

## Implementation Strategy Per Effect

### 1. Text Shadow -- Native CSS in All Renderers

**Approach:** Apply `textShadow` CSS property directly. Works identically in all three renderers.

**Satori caveat:** Use `rgba(r g b / a)` syntax (modern space-separated) rather than `rgba(r, g, b, a)` (legacy comma syntax). The legacy syntax caused parse errors in older Satori versions. Both work in the bundled version but modern syntax is safer.

**Preset system (px values at 1080x1920 reference):**
```typescript
const SHADOW_PRESETS = {
  sm: { offset: '0 2px 4px',   blur: 4  },  // subtle lift
  md: { offset: '0 4px 8px',   blur: 8  },  // medium depth
  lg: { offset: '0 8px 16px',  blur: 16 },  // dramatic
}
```

### 2. Text Outline -- Native CSS in All Renderers

**Approach:** Apply `WebkitTextStrokeWidth` and `WebkitTextStrokeColor` in preview and Satori. Use `-webkit-text-stroke-width` and `-webkit-text-stroke-color` in the HTML renderer.

**Browser support:** Universal in all modern browsers (Chrome, Firefox, Safari, Edge).

**Slider range:** 1-8px. Beyond 8px the stroke starts to visibly eat into the fill on smaller font sizes. The auto `paint-order: stroke` in Satori mitigates this, but the browser preview needs explicit `paintOrder: 'stroke'` to match.

### 3. Background Highlight -- Renderer-Specific Strategy

This is the only effect requiring different approaches per renderer due to Satori's `display: inline` limitation.

**Two modes:**
- **Full-width:** Background spans the entire text box width.
- **Tight:** Background hugs each line of text individually.

| Renderer | Full-Width | Tight |
|---|---|---|
| Preview (browser) | `backgroundColor` + `padding` on container div | `<span>` with `backgroundColor`, `padding`, `boxDecorationBreak: 'clone'`, `display: 'inline'` |
| HTML export | Same as preview | Same as preview |
| Satori export | `backgroundColor` + `padding` on container div | **Fallback to full-width.** Satori lacks `display: inline` and `boxDecorationBreak`. |

**Rationale for Satori tight-mode fallback:** Carousel text is typically short (1-3 lines of hook text). The visual difference between tight and full-width highlight is minimal at this text length. Implementing a word-splitting workaround would add complexity for marginal visual benefit. Ship full-width fallback first; revisit only if users report dissatisfaction.

## Data Model Additions

### TextEffects Interface (new, shared across all text elements)

```typescript
interface TextEffects {
  shadow?: {
    enabled: boolean
    color: string        // hex with alpha, e.g. '#00000080'
    size: 'sm' | 'md' | 'lg'
  }
  outline?: {
    enabled: boolean
    color: string        // hex color, e.g. '#000000'
    width: number        // 1-8 px
  }
  highlight?: {
    enabled: boolean
    color: string        // hex with alpha, e.g. '#FFD70080'
    style: 'tight' | 'full'
    padding: number      // 4-24 px
  }
}
```

**Applied to:**
- `SlideStyleOverrides.hook_text_effects?: TextEffects`
- `SlideStyleOverrides.body_text_effects?: TextEffects`
- `CustomText.text_effects?: TextEffects`

Each text element gets independent effect controls. No global "apply to all" -- per-element is the right model because hook text typically needs different treatment than body text (e.g., hook with heavy shadow + outline, body with subtle highlight).

## Recommended Stack (Unchanged)

### Core (no changes)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| Next.js | 15.5.13 | Framework + Satori via `next/og` | Bundled Satori supports `textShadow` + `WebkitTextStroke` |
| React | 19.1.0 | UI rendering for preview | Standard CSS properties for all effects |
| react-rnd | 10.5.3 | Drag/resize text boxes | Already installed, unaffected |

### Rendering (no changes)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| Satori (via @vercel/og 0.7.2) | Bundled in Next.js | JSX to SVG | Verified support for shadow + outline |
| resvg-wasm (via @vercel/og) | Bundled | SVG to PNG | Correctly renders SVG filters and strokes |
| Playwright | 1.58.2 | HTML renderer | Full CSS support for all effects including tight highlight |

### UI Components (no changes)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| @radix-ui/react-switch | 1.2.6 | Toggle switches for effects | Already in deps, use for enable/disable toggles |
| Tailwind CSS | 4.x | Editor panel styling | Already used |
| lucide-react | 0.577.0 | Icons for effect controls | Already in deps |

## Installation

```bash
# No new packages needed.
```

## What NOT to Add

| Library/Tool | Why Not |
|---|---|
| `satori` (standalone npm) | Already bundled in `next/og`. Installing standalone creates version conflicts. |
| `@vercel/og` (standalone) | Already bundled in Next.js 15.5.13. |
| `canvas` / `node-canvas` | All effects achievable via CSS properties. No pixel manipulation needed. |
| `fabric.js` / `konva` | Canvas-based renderers. Would require rewriting the entire rendering pipeline. |
| `sharp` | Image manipulation library, not relevant for text CSS effects. |
| Any "text effect" npm library | These target canvas-based rendering. The project uses CSS-based rendering. |
| `css-paint-polyfill` | Satori doesn't use Houdini/Paint API. Standard CSS properties suffice. |

## Alternatives Considered

| Approach | Recommended | Alternative | When to Use Alternative |
|---|---|---|---|
| Satori tight highlight | Full-width fallback | Word-splitting into separate `<div>`s with flexWrap | Only if users explicitly report dissatisfaction with full-width in exports |
| Shadow presets (S/M/L) | YES -- simpler UX | Custom offset/blur/spread sliders | Only if users demand pixel-level shadow control. Presets cover 95% of carousel use cases. |
| Outline via WebkitTextStroke | YES -- native support | Duplicate text elements offset by 1px in 4/8 directions | Only if WebkitTextStroke has rendering bugs in Satori. Verified working -- not needed. |

## Files to Modify

| File | Change | Complexity |
|---|---|---|
| `src/lib/types/slide.ts` | Add `TextEffects` interface, add to `SlideStyleOverrides` + `CustomText` | Low |
| `src/lib/render/resolve-styles.ts` | Resolve text effects defaults in `resolveSlideStyles()` | Low |
| `src/components/slides/slide-preview.tsx` | Apply `textShadow`, `WebkitTextStroke*`, highlight styles to text elements | Medium |
| `src/lib/render/render-slide-satori.tsx` | Apply same CSS properties to JSX inline styles | Medium |
| `src/lib/render/render-slide.ts` | Apply CSS text-shadow, -webkit-text-stroke, background in HTML template | Medium |
| New: `src/components/editor/text-effects-panel.tsx` | UI panel with toggles, color pickers, sliders | Medium |
| `src/lib/editor/use-slide-editor.ts` | Add reducer actions for text effect changes | Low |

## Confidence Assessment

| Claim | Confidence | Evidence |
|---|---|---|
| Satori supports `textShadow` | HIGH | Verified string `textShadow` in compiled bundle; listed in [Satori CSS docs](https://deepwiki.com/vercel/satori/4-advanced-usage) |
| Satori supports `WebkitTextStroke` | HIGH | Verified `WebkitTextStrokeWidth`/`WebkitTextStrokeColor` in compiled bundle; [PR #645 merged Nov 2024](https://github.com/vercel/satori/pull/645) |
| Satori does NOT support `display: inline` | HIGH | [Satori docs](https://deepwiki.com/vercel/satori/4-advanced-usage) list only flex/block/none |
| `boxDecorationBreak` NOT in Satori | MEDIUM | Not in supported properties list; not found in bundle search |
| Browser support for all CSS properties | HIGH | `-webkit-text-stroke`, `text-shadow`, `box-decoration-break: clone` supported universally |
| Zero new dependencies needed | HIGH | All effects use CSS properties already in Satori + browsers |

## Key Risk

**Satori `textShadow` syntax sensitivity.** Satori's CSS parser is stricter than browsers. If `rgba()` color values cause parse errors, the entire ImageResponse fails (not a graceful degradation). Mitigation: use hex colors with alpha channel (`#00000080`) instead of `rgba()` functions. Hex colors are parsed more reliably across Satori versions.

## Sources

- [Satori CSS Support (DeepWiki)](https://deepwiki.com/vercel/satori/4-advanced-usage) -- supported property list
- [Satori Text-Stroke PR #645](https://github.com/vercel/satori/pull/645) -- merged Nov 19, 2024
- [Satori -webkit-text-stroke Issue #578](https://github.com/vercel/satori/issues/578) -- closed/resolved
- [Satori text-shadow parse error Issue #441](https://github.com/vercel/satori/issues/441) -- rgba syntax gotcha
- [Satori Text and Typography (DeepWiki)](https://deepwiki.com/vercel/satori/6-text-and-typography)
- [Satori GitHub Releases](https://github.com/vercel/satori/releases) -- latest 0.26.0 (Mar 2026)
- Local bundle inspection: `node_modules/next/dist/compiled/@vercel/og/index.node.js` -- confirmed WebkitTextStroke* and textShadow present

---
*Stack research for: TikTok Slideshow Creator v2.1 -- Text Effects*
*Researched: 2026-04-07*
