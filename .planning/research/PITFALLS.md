# Pitfalls Research: Text Effects (v2.1)

**Domain:** Adding text shadow, outline, and background highlight to Satori-based carousel slide rendering
**Researched:** 2026-04-07
**Confidence:** HIGH (codebase verified, Satori docs and GitHub issues checked)

---

## Critical Pitfalls

### Pitfall 1: Using Duplicate Elements When Satori Supports Native CSS

**What goes wrong:**
The design doc prescribes duplicate text elements for shadow (1 copy offset behind) and outline (4 cardinal-direction copies). But Satori actually supports `text-shadow` natively (renders via SVG `buildDropShadow` filters) and `-webkit-text-stroke` was merged in PR #645 (Nov 2024, satori main). The project uses Next.js 15.5.13 whose bundled satori version (post-0.15.x, likely 0.20+) almost certainly includes both features. Building the duplicate-element workaround adds complexity, DOM bloat, and visual inconsistency for no reason if native CSS works.

**Why it happens:**
The design doc was written based on older Satori limitations. Satori has rapidly evolved (0.10.x to 0.26.x in recent months) and the CSS subset has expanded significantly. Developers assume Satori "doesn't support X" without checking the current bundled version.

**How to avoid:**
Before writing a single line of duplicate-element code, run a 30-minute spike: create a test `buildSlideElement` with `textShadow: '0 4px 8px rgba(0,0,0,0.6)'` and `WebkitTextStrokeWidth: '2px'` / `WebkitTextStrokeColor: '#000'` set directly on the text div, render it via the `/api/render` route, and inspect the output PNG. If native properties work, use them in all three renderers and skip the duplicate approach entirely. This collapses the Satori renderer, preview, and HTML export to nearly identical CSS -- massively simpler.

**Warning signs:**
- Writing helper functions like `buildShadowDuplicates()` or `buildOutlineDuplicates()` before testing native support
- The Satori renderer code is 3x longer than the preview code for the same effect
- You are counting cardinal directions

**Phase to address:**
Phase 1 -- validation spike before any implementation.

---

### Pitfall 2: Three Renderers Drifting Out of Sync

**What goes wrong:**
The project has three rendering paths that must produce visually identical output:
1. **React preview** (`slide-preview.tsx`) -- browser CSS, uses `className`, `Rnd` wrappers, `%`-based positioning, has `z-index`
2. **Satori export** (`render-slide-satori.tsx`) -- inline styles, `px`-based positioning via `pxX()`/`pxY()`, no z-index (DOM order = layer order)
3. **HTML export** (`render-slide.ts`) -- if it exists, full CSS

When effects are added, a change in one renderer is easily missed in another. The preview shows a shadow, the exported PNG has no shadow, and the user blames the product.

**Why it happens:**
The renderers are physically separate files with completely different style APIs. There is no shared abstraction for "apply text effects to this element." Each renderer independently interprets the `TextEffects` data model.

**How to avoid:**
Create a single shared utility: `buildEffectStyles(effects: TextEffects): React.CSSProperties` that returns the CSS properties for text effects. If native Satori CSS works (see Pitfall 1), this function returns the SAME object for all three renderers -- the three-renderer problem disappears for effects. Both the preview (`slide-preview.tsx` line 147-161 hookTextStyle/bodyTextStyle) and Satori renderer (`render-slide-satori.tsx` line 89-117) should merge in the effect styles from this shared utility.

Write a visual regression check: render a slide with all effects via `/api/render`, compare to preview at same dimensions.

**Warning signs:**
- Effect looks different in preview vs. exported PNG
- Bug fix applied to one renderer but not the others
- Text effects code copy-pasted between files with slight variations

**Phase to address:**
Phase 1 -- the shared utility must exist before effects are added to any renderer.

---

### Pitfall 3: Outline Duplicate Elements Misaligned on Multi-Line Text

**What goes wrong:**
If the duplicate-element approach is used for outlines (4+ copies offset in cardinal directions), the duplicates may not line-break at the same points as the original when the text wraps. Satori's text layout engine may compute slightly different line breaks for offset duplicates if their container position differs by even 1px. The result is visible artifacts at line boundaries -- stray outline fragments.

Additionally, a fixed-pixel outline (e.g., 2px) looks disproportionately thick on 32px body text compared to 64px hook text.

**Why it happens:**
The outline thickness is absolute pixels, but readability depends on the font-size-to-thickness ratio. Multi-line text compounds the problem because Satori computes layout per-element.

**How to avoid:**
If `-webkit-text-stroke` works natively (see Pitfall 1), this entire problem vanishes -- the stroke is applied per-glyph at the SVG path level and handles wrapping perfectly. If stuck with duplicates: (a) use 8 directions (N/NE/E/SE/S/SW/W/NW) for smoother corners, (b) ensure all duplicates share the exact same container dimensions (only vary `left`/`top`), and (c) cap outline thickness relative to font size.

**Warning signs:**
- Outline gaps at text-wrap boundaries
- Outline "doubles up" at overlap points between copies
- Outline looks wrong at extreme font sizes

**Phase to address:**
Phase 1 spike determines if this pitfall is relevant at all.

---

### Pitfall 4: "Tight" Highlight Breaks on Multi-Line Text in Satori

**What goes wrong:**
The "tight" highlight effect (background color hugging each line like a highlighter marker) requires `box-decoration-break: clone` in CSS so the background repeats per line. Satori's documented CSS subset does NOT include `box-decoration-break`. A `<span>` with `backgroundColor` in Satori will produce a single rectangle behind all lines, not the per-line highlight effect. The preview will look correct (browsers support `box-decoration-break: clone`) but the Satori export will render a full-width block.

**Why it happens:**
The design doc says "Satori supports inline backgrounds" but does not distinguish between block-level backgrounds (supported) and inline-fragmented backgrounds (requires `box-decoration-break: clone`, not supported). Testing with single-line text hides the problem.

**How to avoid:**
For tight highlights in Satori, either: (a) split multi-line text into individual `<div>`s per line, each with its own background (requires pre-computing line breaks -- hard), or (b) use `display: flex; flexDirection: column; alignItems: flex-start` with the text as a child span that has `backgroundColor` (may work for short text), or (c) accept that tight highlight in Satori renders as full-width and document this as a known limitation. Option (c) is pragmatic -- users see the correct result in preview, and the exported image has a slightly wider highlight. Test option (b) first.

**Warning signs:**
- Tight highlight looks perfect in preview but becomes a full-width block in the exported PNG
- Only tested with single-line text

**Phase to address:**
Highlight implementation phase. Test with multi-line body text specifically. Consider making "full-width" the default.

---

### Pitfall 5: Effects Implemented for Hook/Body But Not Custom Text Boxes

**What goes wrong:**
The codebase has three text element types: hook, body, and custom text boxes (array in `slide.custom_texts`). Each has a different code path in all renderers. Effects get implemented for hook and body first (they are in `SlideStyleOverrides`), and custom texts are forgotten or wired differently. User adds a custom text box, enables shadow, nothing happens.

**Why it happens:**
Hook/body are top-level slide properties with dedicated style resolution (overrides + template fallback). Custom texts are array items with their own `CustomText` interface. The code paths are physically separate: hook/body styles resolved from `overrides.hook_font_size ?? template.hookFontSize`, custom text from `ct.font_size ?? 48`. Easy to add `hook_text_effects` to overrides and forget `text_effects` on `CustomText`.

**How to avoid:**
Implement effects for all three text types in the same phase. The design doc correctly specifies `text_effects?: TextEffects` on `CustomText`. Use the shared `buildEffectStyles` utility for all three types so adding effects to a new text type is a one-line call.

**Warning signs:**
- Effects panel only appears for hook/body, not selected custom text
- `render-slide-satori.tsx` custom text map (line 156-175) does not reference `text_effects`
- Tests only verify hook/body

**Phase to address:**
Same phase as hook/body effects -- do not ship without custom text support.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Duplicate elements for shadow/outline without testing native CSS | Avoids uncertainty | 5x more rendering code, visual inconsistencies, maintenance burden | Never -- 30 min spike eliminates uncertainty |
| Hardcoded shadow offsets (S=2px/M=4px/L=6px) without font-size awareness | Simple presets | Shadows look wrong at 16px vs 128px | MVP -- refine later with font-relative offsets |
| Separate effect logic per renderer | Quick to ship one renderer | Three places to update per effect change | Never -- shared utility is ~1 hour upfront |
| Storing effect colors without alpha | Simpler color picker | Cannot control transparency independently | Never -- design doc already specifies hex+alpha |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Satori `textShadow` | Using rgba with percentage alpha like `rgba(0,0,0,50%)` which triggers parsing bug (Issue #441) | Use decimal alpha: `rgba(0,0,0,0.5)` or 8-digit hex `#00000080` |
| Satori `WebkitTextStroke` | Using lowercase `webkitTextStroke` | Must be capital W: `WebkitTextStrokeWidth` and `WebkitTextStrokeColor` (React convention for vendor prefixes) |
| Next.js bundled satori version | Assuming latest satori features are available | Next.js 15.5.13 bundles a specific satori version. Must verify text-stroke support with actual render test. If too old, install satori directly as standalone. |
| Color picker alpha | Returning 6-digit hex (#RRGGBB) for shadow/highlight that need transparency | Use 8-digit hex (#RRGGBBAA) or rgba(). Design doc defaults to `#00000099`. |
| Existing `loadFontBuffersForSlide` | Assuming font loading handles all variants for duplicate elements | Font loading already works for single elements. But if using duplicates, verify the font buffers are shared (they are -- loaded once per render call). |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Duplicate elements per text (4-8 copies for outline) | Satori render time increases, especially with many text boxes | Use native `-webkit-text-stroke`. If duplicates needed, limit to slides with <10 text elements. | Noticeable with 5+ outlined text boxes |
| Slider onChange fires on every pixel | Highlight padding or outline thickness slider causes 60+ re-renders/sec, laggy preview | Debounce slider onChange (150ms) or use onPointerUp/onChangeEnd to commit values | Immediately -- laggy slider UX |
| Color picker onChange fires continuously | Shadow/highlight color change on every mouse move in picker | Debounce or use onChangeComplete callback. Current undo stack limit (MAX_HISTORY=50) also fills instantly. | Immediately -- undo history flooded |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing all effect controls expanded | 9+ controls visible per text element, overwhelming panel | Collapse sub-controls by default, show only when toggle is on (design doc specifies this -- enforce it) |
| Shadow defaults invisible on dark templates | Default `#00000099` shadow on dark overlays is black-on-black | Test defaults on all templates. Auto-adjust: use white shadow (`#FFFFFF80`) when template overlay is dark. Or let the spike determine reasonable defaults per template palette. |
| No live preview during adjustment | User adjusts slider but preview updates with delay | Ensure state updates propagate immediately to preview. React CSS properties (textShadow, etc.) update instantly in browser -- just verify no batching/debounce on the preview path (debounce the undo push, not the preview). |
| No "reset all effects" action | User experiments, wants to undo all at once | Add "Clear effects" button at bottom of effects panel. One click sets all `_enabled` to false. |
| Per-element effects without per-slide propagation | User styles effects on slide 1 hook, must repeat 9 more times | Existing gap (affects all text styles). Flag as follow-up: "Apply text style to all slides" button. |

## "Looks Done But Isn't" Checklist

- [ ] **Shadow:** Tested with light AND dark template backgrounds
- [ ] **Shadow:** Exported PNG matches browser preview visually
- [ ] **Shadow in Satori:** No `rgba()` percentage-alpha format used (triggers Issue #441)
- [ ] **Outline:** Tested with multi-line wrapping text (3+ lines body text)
- [ ] **Outline:** Tested at extreme font sizes (24px and 96px+)
- [ ] **Highlight tight:** Tested with multi-line text in Satori export (not just browser)
- [ ] **Highlight full-width:** Padding renders correctly in Satori (padding is supported, but verify)
- [ ] **Custom text boxes:** All three effects work on custom text, not just hook/body
- [ ] **Existing slides:** Slides without effects render unchanged (all fields optional with `_enabled: false` default)
- [ ] **All templates:** Effects render correctly across all 5-10 templates
- [ ] **Combined effects:** Shadow + outline + highlight simultaneously on same element
- [ ] **Mobile thumbnails:** Effects visible at small preview scale in sidebar

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Built duplicate-element system when native CSS works | MEDIUM (2-4 hrs) | Remove duplicate helpers, replace with native CSS on existing elements |
| Renderers out of sync | LOW-MEDIUM (1-2 hrs/renderer) | Create shared utility, refactor each renderer |
| Custom text boxes missing effects | LOW (1-2 hrs) | Wire `text_effects` into custom text rendering + editor panel |
| Tight highlight broken in Satori | LOW (30 min) | Fall back to full-width in Satori, keep tight in browser preview |
| Slider/color picker performance | LOW (30 min) | Add debounce to onChange, use onChangeComplete |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Native CSS vs duplicates | Phase 1 (spike) | Render test image with textShadow + WebkitTextStroke, inspect PNG |
| Renderer drift | Phase 1 (shared utility) | Side-by-side preview vs. exported PNG for each effect |
| Outline multi-line alignment | Phase implementing outline | Test with 3-line body text at multiple font sizes |
| Tight highlight multi-line | Phase implementing highlight | Render 4-line body with tight highlight in Satori |
| Custom text forgotten | All effect phases | Verify effects panel for selected custom text + exported PNG |
| Defaults on dark templates | UI phase | Test all templates, adjust shadow default per palette |
| Slider performance | UI phase | Test with DevTools 6x CPU throttling, check for jank |

## Sources

- [Satori README -- supported CSS properties including text-shadow, WebkitTextStroke, filter](https://github.com/vercel/satori/blob/main/README.md)
- [Satori PR #645 -- text stroke support (merged Nov 19, 2024)](https://github.com/vercel/satori/pull/645)
- [Satori Issue #578 -- webkit-text-stroke feature request](https://github.com/vercel/satori/issues/578)
- [Satori Issue #441 -- text-shadow parsing bug with rgba percentage alpha](https://github.com/vercel/satori/issues/441)
- [Satori releases -- 0.19.2 through 0.26.0 (Feb-Mar 2026)](https://github.com/vercel/satori/releases)
- [Next.js Issue #72940 -- satori version in next/og updated Nov 2024](https://github.com/vercel/next.js/issues/72940)
- [Satori DeepWiki -- CSS support reference](https://deepwiki.com/vercel/satori/4-advanced-usage)
- Codebase: `src/lib/render/render-slide-satori.tsx` (Satori renderer, 178 lines)
- Codebase: `src/components/slides/slide-preview.tsx` (React preview, 823 lines)
- Codebase: `src/lib/types/slide.ts` (data model, 69 lines)
- Codebase: `src/app/api/render/route.ts` (render API, uses `next/og` ImageResponse)
- Codebase: `docs/plans/2026-04-07-text-effects-design.md` (design doc)
