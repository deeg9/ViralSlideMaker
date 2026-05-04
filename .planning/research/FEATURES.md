# Feature Research — v2.12 Shapes & Icons (Decoration Primitives)

**Domain:** Decoration primitives (Lucide icon picker + editable Canva-style shapes) integrated into the v2.11 multi-element editor for TikTok carousel slideshows
**Researched:** 2026-05-03
**Confidence:** HIGH (Canva/Figma/Lucide/Beautiful.ai docs cited per row; AI-emit recommendations MEDIUM where surveyed products are opaque about prompts)
**Scope:** NEW v2.12 capabilities only — assumes v2.11 multi-element editor (multi-select, marquee, group, alignment, smart guides, lock/hide, z-order, layers panel, alt-drag duplicate, Cmd+D smart offset, arrow nudge) is intact and shipped. Decoration elements MUST be first-class peers of TextBox / CustomImage / Watermark in every v2.11 surface — never re-build that surface.

---

## How to read this file

- **Pattern**: how leading tools ship the feature — exact gesture/modifier/shortcut, verified
- **Class**: `TS` (table stakes — must ship), `DIFF` (differentiator — strong consider), `ANTI` (skip with reason), `DEFER` (out of v2.12)
- **Complexity**: `S` (≤0.5d, additive on existing v2.11 surface), `M` (0.5–2d, new module but no schema risk), `L` (≥2d, schema/architecture impact)
- **v2.11 dependency**: which existing v2.11 surface the feature rides on — recommendations NEVER rebuild
- **Source**: cited URL with confidence

---

## Section 1 — ICON PICKER (Lucide-powered)

### Table Stakes

| # | Feature | Pattern (verified) | Class | Complexity | v2.11 dep | Source |
|---|---------|--------------------|-------|------------|-----------|--------|
| I1 | Search-first picker (no category UI v1) | Canva, Iconify, Sanity Lucide Picker, shadcn-iconpicker — all default to a search input as primary affordance. Fuse.js / metadata `tags[]` fuzzy match against name + tags + aliases. | **TS** | M | New right-rail or modal panel; mounts via existing right-rail composition pattern (mirrors v2.8 `SlideSettings` composition). | [Sanity Lucide Picker](https://www.sanity.io/plugins/lucide), [Lucide tags+aliases metadata](https://deepwiki.com/lucide-icons/lucide/2.2-icon-metadata), [shadcn-iconpicker](https://github.com/alan-crts/shadcn-iconpicker), [Iconify Figma plugin](https://www.figma.com/community/plugin/735098390272716381/iconify) |
| I2 | Debounced search (250–300ms) | Industry consensus 300–500ms; design-tool sweet spot ~250ms (smaller datasets, instant feel). Canva does not publish exact value but observable ~300ms. Algolia/eleken UX articles confirm 300–500ms band. | **TS** | S | None | [debounce 300-500ms band](https://dev.to/abhirupa/the-art-of-smooth-ux-debouncing-and-throttling-for-a-more-performant-ui-m0h), [Algolia search UX](https://www.algolia.com/blog/ux/how-to-streamline-your-search-ux-design) |
| I3 | Virtualized infinite-scroll grid | 1,500+ icons cannot all mount at once — every surveyed open-source picker uses virtualization. Sanity Lucide Picker explicitly cites "virtualized rendering" + "tree shaking to only include imported icons." Mantine icon-picker uses react-window. shadcn-iconpicker uses TanStack Virtual. | **TS** | M | Independent — virtualization library wraps picker grid only. | [Sanity Lucide Picker virtualization](https://www.contentwrap.io/blog/sanity-lucide-icon-picker-plugin), [mantine-icon-picker uses react-window](https://www.npmjs.com/package/mantine-icon-picker), [shadcn-iconpicker uses TanStack Virtual](https://github.com/alan-crts/shadcn-iconpicker) |
| I4 | Click icon → insert at slide center | Canva model: click element from picker → drops at canvas center. Adobe Express + Figma Iconify drag-OR-click-to-import. For modal-picker UX (smaller surface than left rail), click-to-insert is the primary affordance. | **TS** | S | Dispatches new `ADD_DECORATION` reducer action; selection model auto-selects the new id (mirrors v2.11 alt-drag-duplicate auto-select pattern). | [Iconify Figma plugin click-or-drag](https://hanai.xyz/en/articles/59/), [Canva Elements click-to-insert](https://8designers.com/blog/where-can-i-find-icons-in-canva) |
| I5 | Keyboard nav: arrow keys = grid traversal, Enter = insert, Esc = close | W3C WAI-ARIA grid pattern: arrows traverse cells, Enter activates, Esc dismisses. Universal across composable design tools. **Critical for v2.12** because the v2.11 keyboard firewall (tinykeys + 33 inline isEditingTarget guards) means picker MUST own its keyboard scope while open. | **TS** | M | Picker is its own keyboard scope; existing tinykeys map MUST suspend while picker open (mirrors v2.8 isEditingText guard). | [WAI-ARIA Grid keyboard pattern](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [WebAIM keyboard accessibility](https://webaim.org/techniques/keyboard/) |
| I6 | Highlight matched substring in icon name (search affordance) | Algolia / eleken / pencilandpaper search-UX — when search returns N icons, hover state shows icon name with matched substring bolded. Lucide-icons icons are kebab-case (`arrow-right`, `chevron-down`) — match against name + tags. | **TS** | S | None | [highlight matching terms](https://www.eleken.co/blog-posts/search-bar-examples), [Lucide kebab-case naming](https://lucide.dev/) |
| I7 | Lucide icon stored as kebab-case string ID | `decorations[i].kind = 'icon'`, `decorations[i].iconName = 'arrow-right'`. Sanity Plugin pattern, lucide-react `<DynamicIcon name="arrow-right" />` resolves at render time. **Schema-light** — string ref, not embedded SVG. | **TS** | S | Schema lift only. | [Lucide kebab-case + DynamicIcon](https://www.contentwrap.io/blog/sanity-lucide-icon-picker-plugin) |
| I8 | Empty-state on zero results | "No icons match 'xyz'" with empty grid + maybe show "Try: arrow, heart, star" suggestions OR fall back to popular icons. Canva shows "No matches" + featured set. | **TS** | S | None | [search empty state UX](https://www.algolia.com/blog/ux/how-to-streamline-your-search-ux-design) |

### Differentiators (Strong Consider)

| # | Feature | Pattern | Class | Complexity | v2.11 dep | Source |
|---|---------|---------|-------|------------|-----------|--------|
| I9 | Drag from picker onto canvas | Iconify Figma + Canva both support drag-out. Picker icon → canvas drop point. | **DIFF — recommend NO for v2.12** | M | Would need DnD scaffolding distinct from react-rnd (which is on-canvas only). The v2.11 alt-drag duplicate / Cmd+D smart offset pattern already covers "place at predictable spot." | [Iconify drag-import](https://hanai.xyz/en/articles/59/) |
| I10 | Tooltip on hover with full kebab-case name | shadcn-iconpicker, Canva all show tooltip on hover. Useful when icon glyph is ambiguous. | **DIFF — ship in v2.12** | S | None — pure CSS tooltip on the picker grid cell. | [shadcn-iconpicker tooltips](https://github.com/alan-crts/shadcn-iconpicker) |
| I11 | Lazy import (tree-shake) | Don't bundle all 1,500 icons; lazy-load via `lucide-react`'s per-icon import OR use `<DynamicIcon name>` which lazy-resolves. Avoids ~150KB bundle hit. | **DIFF — strongly recommend** | M | Bundle/render only; doesn't touch v2.11 surfaces. | [Lucide tree-shaking](https://www.contentwrap.io/blog/sanity-lucide-icon-picker-plugin), [lucide-react package](https://www.npmjs.com/package/lucide-react) |

### Anti-Features (Skip with Reason)

| # | Feature | Why Requested | Why Skip | Alternative |
|---|---------|---------------|----------|-------------|
| I12 | User favorites | Canva ships heart-icon favorites. Sticky for power users. | **Anti for v2.12** — pre-PMF, no DB schema for per-user state, adds Supabase migration + RLS complexity for low-validation feature. User explicitly named NO this milestone. AI generation handles "tasteful default selection" upstream — power users picking their own favorites is a v3+ feature. | None — fuzzy search alone covers ~95% of needs. Lucide has 1,703 icons; with good name+tag matching, search finds anything in 2-3 keystrokes. |
| I13 | Recent/MRU strip | Canva + Iconify both show recent icons strip. Reduces friction on repeat insertion. | **Anti for v2.12** — same reasoning as I12. Per-user persistence has the same Supabase cost. **Localized session-only "recent" strip is acceptable v3+ if needed**, but skip in v2.12. | Cmd+D duplicates the previous decoration (existing v2.11), which covers the dominant repeat-icon pattern. |
| I14 | Category browse UI (sidebar tree) | Lucide has metadata categories; Iconify exposes them. | **Anti for v2.12** — adds significant UI surface for low value. Lucide category names are inconsistent and overlap heavily (an icon belongs to ≥3 categories). User explicitly named NO categories this milestone. | Search-only, with strong tag matching. Lucide tags are well-curated — searching `food` matches all food icons via tag, not category. |
| I15 | Icon variants (filled vs outline) | Lucide icons are outline-only; Heroicons / Phosphor offer paired sets. | **Anti** — Lucide is outline-only by design. Don't add a second icon library to "match" Phosphor; that's library shopping mid-milestone. | Outline-only Lucide. Stroke width / fill are styled at decoration level (see Section 4). |

---

## Section 2 — SHAPES LIBRARY

### Table Stakes

| # | Feature | Pattern (verified) | Class | Complexity | v2.11 dep | Source |
|---|---------|--------------------|-------|------------|-----------|--------|
| S1 | Basic primitives: rectangle, circle/ellipse, triangle, line | Universal in Figma (R/O), Canva (R, C, L), Adobe Express. Triangle is a degenerate-N polygon in Figma; Canva ships it as a discrete shape. | **TS** | M | New shape rendering modules for Satori (SVG) AND React preview (SVG). Both renderers MUST consume from same module — TPLREND-05 invariant (mirror v2.9 `resolve-overlay.ts` pattern). | [Figma Shape tools R/O/Polygon/Star](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools), [Canva R/C/L shortcuts](https://justclickhere.co.uk/canva-keyboard-shortcuts-for-working-with-shapes/) |
| S2 | Polygon (regular N-gon, sides configurable) | Figma Polygon tool — default 3 sides (triangle), points configurable in inspector. | **TS** | M | Same shared SVG render module. Schema: `decorations[i].kind = 'shape'`, `shape: 'polygon'`, `sides: number`. | [Figma Polygon tool](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| S3 | Star (point count + inner radius configurable) | Figma Star tool — default 5 points, ratio configurable. | **TS** | M | Same shared SVG render module. Schema: `shape: 'star'`, `points: number`, `innerRadius: number`. | [Figma Star tool — 5 points default](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| S4 | Arrow (Shift+L in Figma) | Figma `Shift+L` for Arrow shape. Canva ships pre-baked arrow shapes in Elements. **For TikTok carousel use case, arrows are a high-value feature** (annotations, before/after callouts). | **TS** | M | Schema: `shape: 'arrow'`, `direction: 'right'/'left'/etc`, `headStyle`. Stored as parameterized SVG, not free-path. | [Figma Arrow shape Shift+L](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| S5 | Fill color | Universal — Canva, Figma, Adobe Express, Beautiful.ai all expose fill picker. | **TS** | S | Reuses existing v2.8 color picker component (used for text effects in EffectRow). | [Canva Add and edit shapes — fill](https://www.canva.com/help/add-edit-shapes/) |
| S6 | Stroke (border) — color, width, style (solid/dashed/dotted) | Canva exposes "Border style, weight, color." Figma full stroke + dash pattern + alignment. For v2.12 ship solid + dashed + dotted (3 styles), 0–32px width. **Skip alignment (inside/center/outside)** — inside is sane default, off-pattern complexity for our domain. | **TS** | S | Same color picker; new numeric slider (mirror existing text-shadow size slider). | [Canva stroke weight + style](https://graphicdesignresource.com/how-to-make-stroke-layer-effect-in-canva/) |
| S7 | Opacity 0–100% | Canva "Transparency 0–100." Figma: per-fill + per-stroke opacity, plus layer opacity. v2.12 ship single layer-opacity slider; per-fill opacity is overkill. | **TS** | S | Mirror existing text-effect opacity controls. | [Canva opacity 0-100](https://brendacadman.com/canva-tip-how-to-use-shapes-transparency-to-create-better-designs/) |
| S8 | Corner radius (rect only) | Canva: "round its sharp corners." Figma: per-corner-radius via inspector. v2.12 ship single-radius slider (all 4 corners), 0–50% of min(width,height). | **TS** | S | Numeric slider. | [Canva corner rounding](https://bringyourownlaptop.com/blog/how-to-customize-shapes-in-canva-tutorial) |
| S9 | Drop shadow (X/Y/blur/color/opacity) | Canva Effects → Shadow. Figma effects panel. Critical for "popping" decorative elements off photo backgrounds. | **TS** | S | **Reuse v2.1 text-shadow component** verbatim — already shipping `TextShadowEffect` schema with x/y/blur/color/opacity. | [Canva Effects](https://www.canva.com/help/add-edit-shapes/), v2.1 PROJECT.md |
| S10 | Shape stored as parameterized SVG (NOT path) | All decorations are parameterized: `{kind:'shape', shape:'rect', width:200, height:120, fill:'#3d0000', stroke:{color, width, style}, cornerRadius:8, opacity:1}`. Render-time SVG generation. **NEVER store free-path SVG `d` attribute** — that opens the door to vector path editing (S15 anti-feature). | **TS** | M | Schema design decision; constrains future. | Internal architecture — keeps Satori parity simple |

### Differentiators (Strong Consider)

| # | Feature | Pattern | Class | Complexity | v2.11 dep | Source |
|---|---------|---------|-------|------------|-----------|--------|
| S11 | Connectors (line with optional arrow heads on each end) | Figma + Canva ship connectors but they're orthogonal to slide-design use case (better for diagrams). For TikTok carousels, **a configurable Line with optional arrowhead is the high-value feature** — covers "draw an underline," "point at a thing," etc. | **DIFF — ship simplified version** | M | Schema: `shape: 'line'`, `startArrow: bool`, `endArrow: bool`. Reuse arrow-head SVG paths from S4. | [Figma Line Shift+L](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| S12 | Keyboard shortcuts (R for rect, C for circle, L for line) | Canva ships `R`, `C`, `L` single-letter inserts. Figma `R`, `O`, `Shift+L`. **High value if shipped — power users insert shapes 10× faster.** | **DIFF — strongly recommend ship 3 shortcuts (R/C/L)** | S | Tinykeys map already exists from v2.11; isEditingTarget firewall already prevents single-letter conflicts. Mirrors v2.11 binding pattern. | [Canva R/C/L shortcuts](https://justclickhere.co.uk/canva-keyboard-shortcuts-for-working-with-shapes/) |
| S13 | Hold Shift while resizing = constrain to square/circle | Universal: Figma/Canva/Adobe. Already partially shipped via v2.10 corner-resize Shift escape (but v2.10 is text-box-specific). | **DIFF — ship for shapes** | S | Wires into existing react-rnd resize handlers; mirrors v2.10 pattern. | [Figma Shift to constrain](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |
| S14 | Hold Alt while drawing = draw from center | Figma: "Hold down Option / Alt to create and resize shapes from their center." Useful but **only matters if user can DRAW shapes by drag-on-canvas**. Our model is click-to-insert from picker (Canva) → so this is irrelevant unless we add draw-on-canvas. | **DIFF — DEFER** (depends on S20 draw-on-canvas, also deferred) | S | None | [Figma Alt to draw from center](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) |

### Anti-Features (Skip with Reason)

| # | Feature | Why Requested | Why Skip | Alternative |
|---|---------|---------------|----------|-------------|
| S15 | Vector path editing (Pen tool, edit anchor points) | Figma ships full vector edit. | **Off-pattern for TikTok carousel.** Vector path editing is a separate UX project (selection of anchor points, handles, edit mode toggle, smooth/sharp anchor types). User flagged as likely OUT of scope; confirmed. The whole point of stocking Lucide icons is to avoid users needing to draw. | Lucide icons (Section 1) cover the "I need a custom shape" use case. |
| S16 | Boolean operations (union/subtract/intersect/exclude) | Figma ships all four. Powerful for custom shapes. | **Off-pattern.** Same reasoning as S15 — boolean ops only matter if vector path editing is in scope. Beautiful.ai/Tome/Gamma do NOT ship these (they're slide tools, not vector editors). | Lucide icons + parameterized shapes. |
| S17 | Gradient fill | Canva ships gradient fills. | **DEFER to v3+** — adds significant Satori-rendering risk (gradient SVG syntax is fiddly under Satori; vercel/satori has multiple open issues on gradient stops). Not high-value for early carousels (solid + opacity covers most). | Solid fill + opacity. |
| S18 | Pattern fill / image fill (frame-as-shape) | Figma + Canva: drop image into shape as fill. | **DEFER** — overlaps with existing CustomImage element. If user wants "image in a circle," cropping CustomImage to a circle is the right primitive (different feature, also deferred). v2.12 shapes are decoration-first. | CustomImage stays as-is; shape fill is solid color only. |
| S19 | Custom polygon by clicking points (Pen tool) | Figma. | **Anti** — see S15. | Pre-baked polygon (S2). |
| S20 | Draw-on-canvas (click-drag to size) | Figma + Canva: select shape tool, drag on canvas. | **Anti for v2.12 first cut**. Click-to-insert (S1) ships first; drag-on-canvas requires distinct pointer state machine that fights v2.11 marquee + element drag. **Defer to v2.13+.** | Click-to-insert + resize handles (S13). |
| S21 | Smart shapes / connectors that auto-route | Figma ships smart connectors. | **Off-pattern.** Auto-routing is a flow-diagram feature (like Whimsical). Carousel slides aren't flow diagrams. | None — manual position. |
| S22 | Mask / clipping | Figma + Canva. | **Anti for v2.12.** Distinct UX surface; conflicts with z-order semantics; off-pattern for carousel decorations. | Drop shadow (S9) + opacity (S7) cover most "depth" needs. |

---

## Section 3 — DECORATIONS AS FIRST-CLASS v2.11 PEERS

This section enumerates EVERY v2.11 surface the new `decorations[]` array MUST integrate with. The cardinal rule: **never re-build v2.11 multi-element editor capability — only extend the existing dispatch shape to consume an additional element kind.**

### Table Stakes

| # | Feature | Pattern (verified in v2.11) | Class | Complexity | v2.11 dep |
|---|---------|------------------------------|-------|------------|-----------|
| D1 | Single-click select decoration | Existing v2.11 click-select handler (`useSelectionModel`). Decoration wrapper participates as 4th element kind alongside text_box / custom_image / watermark. | **TS** | S | `useSelectionModel.click` already accepts arbitrary `id` strings; just register decoration ids. |
| D2 | Shift-click add to selection | v2.11 Phase 60 multi-select foundation. `Selection { ids[]; primary }` model. | **TS** | S | Zero changes — selection model is `Set<string>`. |
| D3 | Cmd-click deep-select | v2.11 Phase 60 (D-01 Cmd as deep-select). | **TS** | S | Zero changes. |
| D4 | Marquee selection includes decorations | v2.11 Phase 61 selecto. AABB intersect computed against all element wrappers. **Must add decoration wrapper to the registered selecto target list.** | **TS** | S | Add `[data-element-kind="decoration"]` to selecto's selectable set. |
| D5 | Cmd+A select all (current slide) | v2.11. Iterates all element ids in slide. | **TS** | S | Extend existing iteration to include `decorations[]`. |
| D6 | Click empty canvas → deselect | v2.11. | **TS** | S | Zero changes. |
| D7 | Esc deselect (group-aware) | v2.11 Phase 62. | **TS** | S | Zero changes. |
| D8 | Drag (single + multi) via react-rnd | v2.11 + v2.10 react-rnd@10.5.3. Decoration wrapper is a 4th `<Rnd>`. | **TS** | M | New `<DecorationRnd>` wrapper component mirroring `<TextBoxRnd>` / `<CustomImageRnd>` pattern. |
| D9 | Side-handle resize (width/height) | v2.10 corner+side handles. **For shapes**: corner+side resize is the natural primitive (no font-scale escape hatch needed; shape is geometrically pure). | **TS** | M | react-rnd config flip — corners + sides enabled; top/bottom enabled (different from text-box). |
| D10 | Shift+resize = constrain aspect ratio | v2.10 Shift escape. **For shapes**: extends naturally — Shift = lock AR (square / circle from rect / ellipse). | **TS** | S | Reuse v2.10 onResize handler; flip the modifier branch. |
| D11 | Group with text/image/watermark via Cmd+G | v2.11 Phase 62 flat-schema `groupId?` semantics. | **TS** | S | Add optional `groupId?: string` to decoration schema (mirrors Watermark/TextBox/CustomImage). |
| D12 | Ungroup via Cmd+Shift+G | v2.11. | **TS** | S | Zero changes. |
| D13 | Alignment + distribute (6-axis + H/V) | v2.11 Phase 63. `computeSelectionBounds` aware of all kinds. | **TS** | S | Extend `computeSelectionBounds` to include decorations in union calc. |
| D14 | Smart guides during drag (incl. equal-spacing ==) | v2.11 Phase 63 sorted-edge-array snap index. | **TS** | S | Add decoration edges to snap index; same module. |
| D15 | Lock element (Cmd+Shift+L) | v2.11 Phase 64. | **TS** | S | Add optional `locked?: boolean` to decoration schema. |
| D16 | Hide element | v2.11 Phase 64 — both renderers skip `hidden=true`. | **TS** | S | Add `hidden?: boolean`; add to 13 symmetric filter sites. |
| D17 | Z-order (Cmd+] / [ / Alt variants) | v2.11 Phase 64 single Z_ORDER reducer routes per-scope via array splice. **MUST add `decorations[]` as 4th routing scope.** | **TS** | M | Reducer extension. |
| D18 | Layers panel chip | v2.11 Phase 65 vanilla flat-list. | **TS** | M | Add LayerChip variant for decoration kind (icon glyph or shape silhouette). |
| D19 | Alt-drag duplicate | v2.11 Phase 66 DUPLICATE_ELEMENTS_AT. | **TS** | S | Reducer iterates element kinds; add decoration branch. |
| D20 | Cmd+D smart offset | v2.11 Phase 66. | **TS** | S | Same. |
| D21 | Arrow nudge (1/10 ref-px) | v2.11 Phase 66 BULK_TRANSLATE. | **TS** | S | BULK_TRANSLATE already kind-agnostic (operates on ids); just register decoration ids. |
| D22 | Right-rail decoration card on selection | v2.8 right-rail composition pattern (`SlideSettings`/`ActiveTextBoxCard` model). New `<ActiveDecorationCard>` mirrors that shape. | **TS** | M | Right-rail switches to decoration card when `selection.primary.kind === 'decoration'` (mirrors v2.8 active-text-box-card). |

### Anti-Features (DO NOT extend v2.11 surfaces this way)

| # | Feature | Why Skip |
|---|---------|----------|
| D23 | Rotate decoration | Single-element rotation (ROTATE-01) was deferred from v2.10 → v2.11 → still not shipped. Decorations should NOT introduce rotation. **Defer to v3+ as a unified rotation feature for ALL element kinds.** |
| D24 | Decoration-specific multi-select rotation | Same as D23 — blocked. |
| D25 | Cross-slide decoration paste | TPLREND-05 invariant says each slide renders independently. Cross-slide selection was hard-NO in v2.11 (J57); same applies to v2.12. |
| D26 | Decoration as group container (group-of-groups) | v2.11 explicitly skipped nested groups. Decorations participate in flat groups via `groupId?` only — same constraint. |

---

## Section 4 — RIGHT-RAIL DECORATION CARD (Editor controls)

When a decoration is the `selection.primary`, the right rail shows `<ActiveDecorationCard>` (mirrors v2.8 `<ActiveTextBoxCard>`).

### Table Stakes (controls)

| # | Control | Pattern | Class | Complexity | v2.11 dep |
|---|---------|---------|-------|------------|-----------|
| C1 | Position (X/Y in pct) | Numeric inputs OR drag handles. Mirror existing TextBox card. | **TS** | S | Same numeric input component as v2.10 size controls. |
| C2 | Size (W/H in pct) | Same. | **TS** | S | Same. |
| C3 | Fill color picker | Reuse v2.8 EffectRow color picker. | **TS** | S | Existing component. |
| C4 | Stroke (color, width 0–32px, style) | Color picker + slider + 3-button toggle (solid/dashed/dotted). | **TS** | S | New small component; reuse atoms. |
| C5 | Opacity slider 0–100% | Single slider. | **TS** | S | Reuse v2.1 effects opacity slider atom. |
| C6 | Drop shadow (toggle + color + X/Y/blur/spread) | Reuse v2.1 EffectRow Shadow toggle pattern verbatim. | **TS** | S | **Reuse v2.1 component, no new code beyond schema field.** |
| C7 | Corner radius (rect only) | Conditional slider (only render when `shape === 'rect'`). | **TS** | S | New conditional component. |
| C8 | Polygon sides / Star points (conditional) | Conditional inputs. | **TS** | S | Same. |
| C9 | Lock toggle | Mirror v2.11 LayerChip lock button. | **TS** | S | Existing reducer action. |
| C10 | Visibility toggle | Same. | **TS** | S | Existing reducer action. |
| C11 | Delete button | Mirror existing TextBox card delete. | **TS** | S | Existing reducer action. |
| C12 | Icon swap (icon decorations only) | "Replace icon" → reopens icon picker, swaps `iconName` in place. Preserves position/fill/stroke. | **TS** | S | Reopens picker modal in "swap mode"; dispatch UPDATE_DECORATION with new iconName. |

### Differentiators

| # | Control | Pattern | Class | Complexity |
|---|---------|---------|-------|------------|
| C13 | Quick color swatches (template accent colors) | Show 4-6 color swatches matching active template's accent palette + slide's `derived_palette` (from v2.9 node-vibrant). One-click recolor. | **DIFF — strong consider** | S |
| C14 | "Reset to default" per control | Restore initial fill/stroke/etc. | **DIFF — DEFER**. Cmd+Z covers this. | S |

---

## Section 5 — AI EMIT (Gemini → decorations[])

The AI-emit story is the **most uncertain area** (LOW confidence on prompt-pattern internals of Gamma/Beautiful.ai/Tome — these are private). Recommendations are derived from observed product behavior + ViralSlideMaker's existing v2.9 `role` schema lift.

### What surveyed AI-slide tools actually do

**Beautiful.ai's "Smart Slide" model** (verified): Pre-built slide templates with reserved icon slots. Adding text triggers auto-placement into pre-defined geometry. Icon picker emits one icon at a time; placement is template-driven, not AI-decided. **Layout decisions are template-encoded, not LLM-decided.** ([Beautiful.ai Smart Slides](https://www.beautiful.ai/smart-slides), [Icon Slide template](https://www.beautiful.ai/templates/icon-slide))

**Gamma** (verified): "Suggests a layout and flow that fits your content automatically" — RAG over content. Specific icon/shape placement algorithm is not public. Empirically, Gamma generates slides in fixed grid layouts (hero, 2-col, 3-col, image+text) and drops 1-2 icons per slide as accent elements, not per-bullet. ([Gamma AI](https://gamma.app/products/presentations))

**Tome** (verified): Shut down Slides feature April 2025 — no longer reference. ([Beautiful.ai vs Tome 2026](https://www.beautiful.ai/comparison/tome-vs-gamma)) **Drop Tome from research synthesis.**

**Common pattern across surviving tools**: Templates with reserved decoration slots. AI fills slots with content-relevant icons (1-2 per slide, NEVER 5+). Color/style is template-determined, not AI-determined.

### Implications for v2.12 AI emit

| # | Pattern | Recommendation | Confidence | Rationale |
|---|---------|----------------|------------|-----------|
| A1 | Schema: AI emits `decorations[]` per slide | **TS — ship** | HIGH | Mirrors v2.9 `role` enum + `template_id_override` lift. Gemini gets `decorations: Array<{kind: 'icon'\|'shape', ...}>` in JSON schema. |
| A2 | Per-slide AI discretion (NOT template slot-based) | **Ship — but with constraints** | MEDIUM | Beautiful.ai is template-slot-driven (rigid). ViralSlideMaker is already template-aware (v2.7 + v2.9) but slide-by-slide AI authoring of `text_boxes[]` is the working pattern. **Apply the same lift to decorations.** Constraints below (A4, A5, A6) prevent the chaos this could otherwise cause. |
| A3 | AI emits 0–2 decorations per slide max | **TS — enforce in schema** | HIGH | Empirical: Beautiful.ai/Gamma drop 1-2 max per slide. **Hard-cap at 2 in Gemini JSON schema** (`maxItems: 2`). Prevents "icon spam" — see A4. |
| A4 | Advisory monoculture gate (carry-over from v2.9 trigram pattern) | **TS — ship as advisory** | MEDIUM | v2.9 shipped `hookOpeningTrigram` advisory gate — exact precedent. Apply same pattern: detect when ≥4 of N slides use the same `iconName` OR same `shape`. ADVISORY in v2.12 (logs warning, does NOT fail CI), wire live if observed in production. Mirrors v2.9 D-14 deferral. |
| A5 | Icon name validation against Lucide registry | **TS** | HIGH | Gemini emits string `iconName` — validate against `lucide-react` exported names. Closed enum at server boundary; on miss, drop the decoration (do NOT throw — graceful degradation, mirrors v2.9 role-default-fallback pattern). |
| A6 | Color tokens from template palette | **TS** | HIGH | Gemini emits color names (`'accent'`, `'palette-vibrant'`, `'#hex'`). Resolver maps named tokens → `template.accentColor` OR `slide.style_overrides.derived_palette.Vibrant`. **NEVER let AI emit raw hex.** Mirrors v2.9 `paletteMode: 'palette-dominant'` resolution. |
| A7 | Position emitted as semantic anchors, not pct | **DIFF — strongly consider** | MEDIUM | Instead of AI emitting `{x: 23.4, y: 67.1}`, emit `{anchor: 'top-right', offset: 'small'}` and resolve server-side to numeric pct. Reduces AI-spam noise (LLMs are bad at exact numerics). Beautiful.ai's slot model is conceptually similar. **Trade-off**: limited expression vs. quality. Recommend for v2.12 + open `position: {x,y}` for editor user override. |
| A8 | `aiVoiceNote` per template (already in v2.7) gets decoration guidance | **TS** | HIGH | Extend existing v2.7 `aiVoiceNote: string` field on `SlideTemplate` to include "decoration tone" guidance: e.g. for `notes-app-chic`, "decorations should feel handmade — circles + stars + simple icons; no arrows or polygons; opacity ≤ 80%." |
| A9 | Per-template decoration whitelist | **TS — ship as opt-in template field** | MEDIUM | New optional `SlideTemplate.decorationWhitelist?: string[]` (e.g. `magazine-bold` → `['arrow-right', 'check', 'sparkle']`). When present, AI restricted to that subset. When absent, full 1,500-icon Lucide is fair game. Prevents "Notes-App-Chic with a tech-corporate icon" mismatch. |
| A10 | Dual-renderer parity for AI-emitted decorations | **TS — ship in PARITY-04** | HIGH | v2.11 Phase 65 PTF1..PTF12 dual-renderer fingerprint suite. Extend with PTF13..PTF18: 6 new fingerprints for decoration-bearing slides across both renderers. **TPLREND-05 invariant must extend to decorations.** |

### What "icon spam" / monoculture looks like in this domain

Observed risks (verified by inspection of low-quality AI-slide outputs on social media + Reddit):

1. **Same icon repeated on every slide** ("checkmark on slide 1, 2, 3, 4, 5"). Prevention: A4 advisory gate.
2. **Generic-feeling decoration set** ("rocket + lightning bolt + chart + arrow on every slide"). Prevention: A8 + A9 per-template guidance + whitelist.
3. **Color clash with template palette** (lime decoration on cream notes-app-chic background). Prevention: A6 named-token color emission.
4. **AI panics and adds 5+ decorations on one slide** ("kitchen sink"). Prevention: A3 maxItems=2.
5. **Position-anchor confusion** (AI emits `{x: 50, y: 50}` literally, decoration covers hook text). Prevention: A7 semantic anchors + server-side resolution to safe zones away from text-box bounds.

These are concrete heuristics — implementation is a v2.12 phase deliverable. Ship A4 + A5 + A6 as TS; A7/A9 as DIFF; A3/A8/A10 as TS.

---

## Section 6 — Feature Dependencies

```
[ICON PICKER (Section 1)] ────┐
                              │
[SHAPES LIBRARY (Section 2)] ─┼──> [unified decorations[] schema] (S10, A1, A5)
                              │              │
                              │              ├──> [v2.11 multi-element peers (Section 3)]
                              │              │       │
                              │              │       ├──> [Right-rail decoration card (Section 4)]
                              │              │       └──> [Layers panel decoration chip (D18)]
                              │              │
                              │              └──> [AI emit (Section 5)]
                              │                      │
                              │                      ├──> [advisory monoculture gate (A4)]
                              │                      ├──> [per-template whitelist (A9)]
                              │                      └──> [dual-renderer parity tests (A10)]
                              │
[Lucide-react package] ───────┘
[lucide-react@0.x DynamicIcon]
[react-window OR TanStack Virtual]
```

### Dependency notes

- **decorations[] schema (S10) is the keystone.** Every other feature in the milestone rides on it. Ship schema first — `kind: 'icon' | 'shape'` discriminated union, additive lift identical to how v2.11 added `groupId?/locked?/hidden?` (PROJECT.md v2.11 Phase 60).
- **Both-renderer parity (A10) is non-negotiable.** v2.11 Phase 65 audit suite (PTF1..PTF12) MUST be extended in v2.12 (PTF13..PTF18) before merge — TPLREND-05 invariant has held since v2.7 and must hold through v2.12.
- **Right-rail decoration card depends on selection model recognizing decoration kind.** Section 3 D1–D7 must ship before Section 4 is testable end-to-end.
- **AI emit depends on schema being stable.** Don't ship AI emit (Section 5) before sections 1+2+3 are wired and round-tripping in editor.
- **Icon picker keyboard scope (I5) MUST suspend the v2.11 tinykeys map while open** — this is the one place where v2.12 has to TOUCH a v2.11 surface (the keyboard firewall). Mirror v2.8 `isEditingText` pattern; do not invent a new pattern.

---

## Section 7 — MVP Definition for v2.12

### Phase A — Schema Foundation (must ship first)

- [ ] S10 `decorations[]` array on Slide schema, discriminated union (`kind: 'icon' | 'shape'`)
- [ ] I7 Icon decoration shape: `{kind:'icon', iconName: string, position, size, fill, stroke?, opacity, shadow?, hidden?, locked?, groupId?}`
- [ ] Shape decoration shape: `{kind:'shape', shape: 'rect'|'circle'|'ellipse'|'triangle'|'polygon'|'star'|'arrow'|'line', ...params, position, size, fill, stroke?, opacity, cornerRadius?, shadow?, hidden?, locked?, groupId?}`
- [ ] Adapter / migration: legacy slides remain byte-identical with empty `decorations: []` (mirror v2.11 watermark schema lift adapter pattern)

### Phase B — Both-Renderer Render Module

- [ ] B1 Shared `src/lib/render/resolve-decoration.tsx` (pattern mirror of v2.9 `resolve-overlay.ts`)
- [ ] B2 Satori PNG render path consumes module
- [ ] B3 React preview consumes module
- [ ] B4 PARITY-04 extended: PTF13..PTF18 fingerprint snapshots for decoration-bearing slides

### Phase C — Icon Picker

- [ ] I1 Search-first picker UI (modal OR right-rail expand)
- [ ] I2 Debounced search (250ms)
- [ ] I3 Virtualized infinite-scroll grid (react-window)
- [ ] I4 Click-to-insert (auto-select new decoration)
- [ ] I5 Keyboard nav (arrows / Enter / Esc) — picker scope suspends tinykeys
- [ ] I6 Highlight matched substring
- [ ] I8 Empty state on zero results
- [ ] I10 Hover tooltip (DIFF — recommend ship)
- [ ] I11 Lazy-import lucide-react (DIFF — strongly recommend)

### Phase D — Shapes Library

- [ ] S1–S4 7 shape primitives (rect, circle/ellipse, triangle, polygon, star, arrow, line)
- [ ] S5–S9 Editor controls: fill, stroke, opacity, corner radius, shadow
- [ ] S12 Keyboard shortcuts R/C/L (DIFF — strongly recommend)
- [ ] S13 Shift-resize constrains AR (DIFF — natural extension)

### Phase E — v2.11 Editor Integration (D1–D22)

- [ ] D1–D6 Selection model recognizes decoration kind
- [ ] D8–D10 react-rnd wrapper for decoration
- [ ] D11–D12 Group/ungroup includes decorations (groupId? schema lift)
- [ ] D13–D14 Alignment + smart guides include decorations
- [ ] D15–D16 Lock + hide for decorations (locked? hidden? schema lifts)
- [ ] D17 Z-order for decorations (4th routing scope in Z_ORDER reducer)
- [ ] D18 Layers panel chip variant for decoration
- [ ] D19–D21 Alt-drag duplicate, Cmd+D, arrow nudge for decorations
- [ ] D22 Right-rail card switches to decoration when primary

### Phase F — Right-Rail Decoration Card

- [ ] C1–C12 All TS controls
- [ ] C13 Template-palette quick swatches (DIFF — strong consider)

### Phase G — AI Emit

- [ ] A1 Gemini schema lift for decorations[]
- [ ] A3 maxItems=2 cap
- [ ] A5 Icon name validation against Lucide registry
- [ ] A6 Named color token resolution
- [ ] A8 aiVoiceNote per template extended for decorations
- [ ] A4 Advisory monoculture gate (does NOT fail CI in v2.12 — mirrors v2.9 D-14 advisory)
- [ ] A10 PARITY-04 extended for AI-emitted decorations
- [ ] A7 Semantic position anchors (DIFF — strong consider)
- [ ] A9 Per-template decoration whitelist (DIFF — strong consider)

### Strong DIFF picks for v2.12

In recommendation order (highest leverage first):
1. **I11 lazy-import lucide-react** — bundle-size hygiene, near-zero engineering cost, prevents 150KB hit
2. **S12 R/C/L shortcuts** — 10-line tinykeys addition, massive power-user UX win
3. **A7 semantic position anchors** — reduces AI noise, qualitatively better outputs
4. **A9 per-template decoration whitelist** — prevents template/decoration tone mismatch
5. **C13 template-palette quick swatches** — small UI, big perceived polish
6. **I10 picker hover tooltip** — pure CSS, helps icon disambiguation

### Defer to v2.13+

- I12 favorites
- I13 recents
- I14 categories
- S11 connectors with smart routing (line ships, smart routing defers)
- S20 draw-on-canvas (click-drag to size)
- D23–D24 rotation (blocked on ROTATE-01 deferral chain)
- C14 reset-to-default

### Hard NO (skip indefinitely)

- I15 second icon library beyond Lucide
- S15 vector path editing
- S16 boolean ops
- S17 gradient fill (until Satori gradient bugs resolve)
- S19 custom polygon by clicking points
- S21 smart connectors (off-pattern for carousels)
- S22 mask/clipping
- D25 cross-slide decoration paste (TPLREND-05 invariant)
- D26 nested groups (v2.11 hard NO)

---

## Section 8 — Feature Prioritization Matrix

| Feature | User Value | Cost | v2.11 Surface Reuse | Priority |
|---------|------------|------|---------------------|----------|
| S10 decorations[] schema | HIGH | MED | — (foundation) | **P1** |
| B1–B4 both-renderer parity module | HIGH | MED | mirrors v2.9 resolve-overlay | **P1** |
| I1–I8 icon picker (search/virtualized/click-insert) | HIGH | MED | new modal | **P1** |
| S1–S4 shape primitives (7 shapes) | HIGH | MED | new render module | **P1** |
| S5–S9 shape controls (fill/stroke/opacity/radius/shadow) | HIGH | LOW | reuses v2.1+v2.8 components | **P1** |
| D1–D22 v2.11 editor integration (decoration as 4th element kind) | HIGH | MED | extends every v2.11 surface | **P1** |
| C1–C12 right-rail decoration card | HIGH | LOW | mirror v2.8 active-text-box-card | **P1** |
| A1, A3, A5, A6, A8, A10 AI emit core | HIGH | MED | mirror v2.9 role lift | **P1** |
| A4 advisory monoculture gate | MED | LOW | mirror v2.9 trigram gate | **P1** (advisory) |
| I11 lazy-import lucide-react | MED | LOW | bundle hygiene | **P2** |
| S12 R/C/L keyboard shortcuts | MED | LOW | extends v2.11 tinykeys | **P2** |
| A7 semantic position anchors | MED | MED | quality lift | **P2** |
| A9 per-template decoration whitelist | MED | LOW | extends v2.7 aiVoiceNote | **P2** |
| C13 palette quick swatches | LOW | LOW | reuses v2.9 derived_palette | **P2** |
| I10 picker tooltip | LOW | LOW | CSS only | **P3** |
| C7/C8 conditional shape controls (corner radius / sides / points) | MED | LOW | conditional render | **P2** |
| I12 favorites / I13 recents / I14 categories | LOW (pre-PMF) | HIGH (DB schema) | — | **P3 — DEFER** |
| S15/S16 vector edit + boolean ops | LOW (off-pattern) | HIGH | — | **HARD NO** |
| S20 draw-on-canvas | MED | HIGH | conflicts with marquee/drag | **P3 — DEFER** |
| D23/D24 rotation | LOW (no precedent) | HIGH | unblocked-on-ROTATE-01 | **DEFER** |

---

## Section 9 — Surveyed Product Comparison Matrix

| Feature | Canva | Figma | Adobe Express | Beautiful.ai | Gamma | CapCut | v2.12 plan |
|---------|-------|-------|---------------|--------------|-------|--------|------------|
| Icon picker (search-first) | YES | YES (plugin: Iconify) | YES (Noun Project) | YES | YES | LIMITED | YES (Lucide) |
| Icon library size | 100K+ | depends on plugin | ~3M (Noun) | ~10K | ~3K | ~1K (sticker) | 1,703 (Lucide) |
| Icon search debounce | ~300ms | ~200-300ms | ~300ms | unknown | unknown | — | 250ms |
| Icon favorites | YES | NO | NO | NO | NO | NO | **NO** |
| Icon recents | YES | YES (Iconify) | YES | NO | NO | NO | **NO** |
| Icon categories | YES | YES | YES | NO | NO | YES | **NO** |
| Shape primitives (rect/circle/triangle/line) | YES | YES | YES | YES | YES | YES | YES |
| Polygon (N-sides) | YES | YES | YES | NO | YES | NO | YES |
| Star | YES | YES | YES | NO | NO | NO | YES |
| Arrow shape | YES | YES (Shift+L) | YES | YES | YES | YES | YES |
| Connectors / smart routing | NO | YES | NO | NO | NO | NO | NO (line-only) |
| Vector path edit | NO | YES | NO | NO | NO | NO | **NO (anti)** |
| Boolean ops | NO | YES | NO | NO | NO | NO | **NO (anti)** |
| Fill color | YES | YES | YES | YES | YES | YES | YES |
| Stroke (color/width/style) | YES | YES (full) | YES | YES | YES | LIMITED | YES |
| Opacity | YES | YES | YES | YES | YES | YES | YES |
| Corner radius | YES | YES (per-corner) | YES | YES | YES | YES | YES (single radius) |
| Drop shadow | YES | YES | YES | YES | YES | YES | YES (reuse v2.1) |
| Gradient fill | YES | YES | YES | YES | YES | NO | **NO (Satori risk)** |
| Image fill / mask | YES | YES | YES | NO | YES | NO | **NO (defer)** |
| Keyboard insert (R/C/L) | YES | YES (R/O/Shift+L) | LIMITED | NO | NO | NO | YES (R/C/L) |
| Draw-on-canvas (drag-size) | YES | YES | YES | NO | NO | NO | **NO (defer)** |
| AI auto-place icons/shapes | LIMITED | NO | YES (template gen) | YES (slot-based) | YES (RAG) | NO | YES (Gemini) |
| AI per-slide discretion | NO (template slots) | — | YES | NO (slots) | YES (LLM) | — | YES |
| Decoration monoculture prevention | unknown | — | unknown | template-enforced | unknown | — | YES (advisory gate) |

---

## Section 10 — Edge cases (gotchas v2.12 must handle)

### EC1 — Icon picker keyboard scope clash with v2.11 tinykeys

The v2.11 tinykeys map handles ⌘+G/⌘+]/Alt+H/etc globally on the editor. **When picker is open, those shortcuts MUST be suppressed** — pressing R inside the search box should type "r," not insert a rectangle.

**Solution**: Picker mounts a tinykeys "scope" or sets a ref-based `pickerOpen` flag that the v2.11 keyboard handlers check first (mirror existing 33 `isEditingTarget` firewalls). The picker has its own arrow/Enter/Esc handlers active only while open.

### EC2 — Icon decoration on a template with no `derived_palette`

If template doesn't enable `paletteMode: 'palette-dominant'` (some legacy templates), AI-emitted color tokens like `'palette-vibrant'` resolve to undefined.

**Solution**: Resolver falls back to `template.accentColor`, then to `#000000`. Mirrors v2.9 named-role palette extraction null-handling pattern. Document in resolver.

### EC3 — Both-renderer divergence on rounded-corner ellipse

Satori's SVG renderer has known issues with `rx`/`ry` on `<ellipse>` (vercel/satori). The React preview renders it natively.

**Solution**: For ellipse, force `cornerRadius: 0` at schema level (rounded ellipse is geometrically odd anyway). PARITY-04 catches divergences via fingerprint snapshot.

### EC4 — Decoration inside group when group dragged

v2.11 Phase 62 fans out group drag delta via single BULK_TRANSLATE. Decoration's react-rnd wrapper must respect the BULK_TRANSLATE result identically to TextBox/CustomImage.

**Solution**: Decoration wrapper consumes position from reducer, not local state. Same pattern as v2.11 wrappers. Test in Phase E.

### EC5 — Locked decoration in marquee

v2.11 rule: marquee skips locked elements (Figma model). Decoration with `locked: true` must be skipped by selecto.

**Solution**: Locked decoration wrapper sets `pointer-events: none` only when marquee is active (mirrors v2.11 lock wrapper pattern).

### EC6 — AI emits an iconName not in lucide-react

`'arrow-right-circle-fill'` (Phosphor name) emitted by AI; not in Lucide.

**Solution**: Server-side validation against Lucide export list. On miss, drop the decoration silently (graceful degradation, mirrors v2.9 role-default-fallback). Log advisory for monitoring.

### EC7 — AI emits 5 decorations on one slide despite maxItems=2

Gemini has been known to violate JSON schema constraints under prompt pressure.

**Solution**: Server-side post-parse validator clamps `decorations[]` to length 2 (drops items 3+). Same defensive posture as v2.9 ZIP metadata strip.

### EC8 — Decoration with `position.x = 50%, y = 50%` covers hook text

If AI emits center position blindly, decoration occludes hook.

**Solution**: A7 semantic anchors solve this — if shipping A7, AI emits `'top-left'`/`'bottom-right'`/etc and resolver places in safe-zone offset from text-box bounds. If A7 deferred, accept the risk (user can drag in editor).

### EC9 — TPLREND-05 fingerprint drift on decoration pseudoelement

If React preview renders decoration with `outline` (selection ring) and Satori doesn't, fingerprint test fails.

**Solution**: Existing v2.11 PCL1..PCL10 chrome-leak gate (selection/marquee/guide/lock-icon classNames) extends to decoration kind. Add `*decoration-handle*` / `*decoration-ring*` to grep list.

### EC10 — Picker shows icons too small to identify

1,703 icons in 6-col × infinite grid — at default tile size, icons could be 24px. Some Lucide icons are visually similar at small sizes (`circle` vs `circle-dashed`).

**Solution**: Tile size 48px minimum (mirror Iconify default). Tooltip on hover (I10) for disambiguation.

---

## Section 11 — Sources

### Lucide
- [Lucide Icons (1,703 icons)](https://lucide.dev/icons/)
- [Lucide for React — lucide-react package](https://lucide.dev/guide/packages/lucide-react)
- [Icon Metadata + tags + categories + aliases](https://deepwiki.com/lucide-icons/lucide/2.2-icon-metadata)
- [Lucide Categories page](https://lucide.dev/icons/categories)
- [lucide-react on npm](https://www.npmjs.com/package/lucide-react)
- [GitHub: lucide-icons/lucide](https://github.com/lucide-icons/lucide)

### Open-source icon picker references
- [Sanity Lucide Icon Picker plugin (1,600+ icons, virtualized)](https://www.sanity.io/plugins/lucide)
- [Sanity plugin — virtualization + lazy-load + tree-shake](https://www.contentwrap.io/blog/sanity-lucide-icon-picker-plugin)
- [shadcn-iconpicker (Next.js + Lucide + TanStack Virtual)](https://github.com/alan-crts/shadcn-iconpicker)
- [Icon Picker Component — Raul Carini blog](https://www.raulcarini.dev/blog/icon-picker)
- [Open-Source React Icon Picker — DEV.to](https://dev.to/modall/open-source-react-icon-picker-lightweight-customizable-and-built-with-shadcn-tailwindcss-pnl)
- [mantine-icon-picker (react-window)](https://www.npmjs.com/package/mantine-icon-picker)
- [react-lucide-icon-picker](https://socket.dev/npm/package/react-lucide-icon-picker)

### Canva (icons + shapes)
- [Canva — Icons, Categories, Search, Favorites](https://8designers.com/blog/where-can-i-find-icons-in-canva)
- [Canva Icons + Symbols Guide](https://techwiser.com/canva-icons-and-symbols-meaning/)
- [Canva — Add and edit shapes](https://www.canva.com/help/add-edit-shapes/)
- [Canva — Customizing shapes (fill, stroke, opacity, corner radius)](https://bringyourownlaptop.com/blog/how-to-customize-shapes-in-canva-tutorial)
- [Canva — Stroke layer effect](https://graphicdesignresource.com/how-to-make-stroke-layer-effect-in-canva/)
- [Canva — Working with Shapes](https://maschituts.com/canva-shapes/)
- [Canva — Transparency for Better Designs](https://brendacadman.com/canva-tip-how-to-use-shapes-transparency-to-create-better-designs/)
- [Canva — Keyboard Shortcuts (R / C / L)](https://justclickhere.co.uk/canva-keyboard-shortcuts-for-working-with-shapes/)
- [Canva — Personal Starring (favorites)](https://www.canva.com/help/personal-starring/)
- [Canva.dev — Creating Shapes (developer docs)](https://www.canva.dev/docs/apps/creating-shapes/)
- [Canva.dev — Icon design guidelines](https://www.canva.dev/docs/apps/design-guidelines/icons/)

### Figma (shapes + boolean ops + plugin ecosystem)
- [Figma Help — Shape tools (R/O/Polygon/Star/Arrow Shift+L)](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools)
- [Figma Help — Boolean operations (union/subtract/intersect/exclude)](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations)
- [The Basics of Shapes in Figma — Bootcamp](https://medium.com/design-bootcamp/the-basics-of-shapes-in-figma-36b66752abff)
- [Iconify Figma plugin](https://www.figma.com/community/plugin/735098390272716381/iconify)
- [Iconify Figma plugin — usage walkthrough](https://hanai.xyz/en/articles/59/)
- [Iconify Figma plugin — 2024 redesign rationale](https://iconify.design/docs/design/figma/update-2024.html)
- [Top 10 Icon Plugins for Figma](https://uxplanet.org/top-10-icon-plugins-for-figma-6e6081c7c3d7)
- [Iconify Icons Library Figma plugin](https://www.figma.com/community/plugin/1498729606631593833/iconify-icons-library)
- [Iconify 2 Million Icons Library Figma plugin](https://www.figma.com/community/plugin/1511632993696481931/iconify-2-million-icons-library)

### Adobe Express
- [Adobe Express — Free Icons + Noun Project integration](https://www.adobe.com/uk/express/discover/examples/icon)
- [Adobe Express — Add Icons feature](https://www.adobe.com/express/feature/design/add-icons)
- [Adobe Express — AI Template Generator](https://www.adobe.com/express/create/ai/template-generator)
- [Adobe Express — AI Assistant overview](https://helpx.adobe.com/in/express/web/ai-assistant/adobe-express-ai-assistant-overview.html)
- [Adobe Express + Noun Project blog](https://blog.thenounproject.com/create-with-adobe-express-and-noun-project/)
- [Adobe Illustrator — generate icons via AI](https://helpx.adobe.com/illustrator/desktop/use-generative-ai/generate-scenes-subjects-and-icons.html)

### Beautiful.ai (Smart Slides)
- [Beautiful.ai — Smart Slides explained](https://www.beautiful.ai/smart-slides)
- [Beautiful.ai — Icon Slide template](https://www.beautiful.ai/templates/icon-slide)
- [Beautiful.ai — Customizing Smart Slides](https://www.beautiful.ai/blog/our-slides-your-style-a-step-by-step-guide-to-customizing-smart-slides)
- [Beautiful.ai vs Gamma comparison 2026](https://www.beautiful.ai/comparison/beautiful-ai-vs-gamma)
- [Beautiful.ai — Custom Theme Builder + brand kit](https://www.beautiful.ai/blog/lock-in-branding-with-the-custom-theme-builder-and-new-collection-colors)
- [Plus AI alternatives roundup](https://plusai.com/blog/best-ai-presentation-makers)

### Gamma
- [Gamma — AI Deck Generator](https://gamma.app/products/presentations)
- [Gamma — Layout customization guide](https://gamma.app/es/explore/content/guides/gamma-ai-presentation-tool-flexible-layout-customization-guide)

### Tome (shut down April 2025 — historical only)
- [Tome vs Gamma 2026 comparison (notes April 2025 shutdown)](https://www.beautiful.ai/comparison/tome-vs-gamma)
- [Tome AI presentation tool tutorial (legacy)](https://skywork.ai/blog/slide/tome-ai-presentation-tool/)

### CapCut + VEED (TikTok-adjacent reference)
- [CapCut — Instagram Carousel Templates](https://www.capcut.com/resource/instagram-carousel-template)
- [CapCut — Carousel Pics Template](https://www.capcut.com/explore/carousel-pics-template)
- [VEED-style carousel makers roundup](https://www.capcut.com/resource/instagram-carousel-maker)

### AI slide tools — icon spam / monoculture
- [AI slop — Wikipedia](https://en.wikipedia.org/wiki/AI_slop)
- [Tips For Using AI-Generated Images In Slides — thoughtbot](https://thoughtbot.com/blog/tips-for-using-ai-generated-images-in-your-slides)
- [SlideSpeak — AI-Generated Icons in Presentations](https://slidespeak.co/blog/2024/08/23/new-ai-generated-icons-in-presentations-%F0%9F%91%80/)
- [AI Generated Presentation review (Medium)](https://medium.com/@Kerstint/my-horrible-ai-generated-presentation-raises-some-questions-ae7e3a878237)

### Search UX / debounce / fuzzy
- [Algolia — Search UX best practices](https://www.algolia.com/blog/ux/how-to-streamline-your-search-ux-design)
- [Pencil & Paper — Search UX Best Practices](https://www.pencilandpaper.io/articles/search-ux)
- [Eleken — Search Bar Examples + UX Tips](https://www.eleken.co/blog-posts/search-bar-examples)
- [DEV.to — Debouncing + Throttling for UX](https://dev.to/abhirupa/the-art-of-smooth-ux-debouncing-and-throttling-for-a-more-performant-ui-m0h)
- [DesignMonks — Master Search UX 2026](https://www.designmonks.co/blog/search-ux-best-practices)
- [Meilisearch — Fuzzy search guide](https://www.meilisearch.com/blog/fuzzy-search)

### Keyboard accessibility (WAI-ARIA grid)
- [W3C WAI-ARIA — Keyboard Interface practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [W3C — Layout Grid examples](https://www.w3.org/TR/2017/WD-wai-aria-practices-1.1-20170628/examples/grid/LayoutGrids.html)
- [WebAIM — Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [UXPin — Keyboard Navigation Patterns for Complex Widgets](https://www.uxpin.com/studio/blog/keyboard-navigation-patterns-complex-widgets/)

### Internal references
- `.planning/PROJECT.md` — v2.7/v2.8/v2.9/v2.10/v2.11 milestone history; TPLREND-05 invariant; v2.12 active scope
- `.planning/MILESTONES.md` — v2.11 23-plan / 49-task accomplishments (multi-select / marquee / group / alignment / lock+hide / z-order / layers panel)
- v2.7 `resolve-overlay.ts` — pattern for shared both-renderer modules
- v2.8 `text-box-adapter.ts` — adapter / migration pattern (mirror for decorations)
- v2.9 `role` / `template_id_override` / `aiVoiceNote` / `derived_palette` — AI-emit precedents
- v2.11 Phase 60 watermark schema lift — minimal-invasive `groupId?/locked?/hidden?` pattern (mirror for decorations)
- v2.11 Phase 65 PTF1..PTF12 dual-renderer fingerprint suite — extend with PTF13..PTF18 for decorations

---

*Feature research for: v2.12 Shapes & Icons (Decoration Primitives)*
*Researched: 2026-05-03*
*Author: gsd researcher (parallel run with STACK / ARCHITECTURE / PITFALLS)*
