---
phase: 45
audit_date: 2026-04-29
overall_score: 3.7
pillars:
  copywriting: 4
  visual_hierarchy: 4
  color: 4
  typography: 3
  spacing: 4
  parity_drift_risk: 3
---

# Phase 45 — UI Review

**Audited:** 2026-04-29
**Baseline:** 45-UI-SPEC.md (approved design contract)
**Screenshots:** not captured (dev server running at localhost:3000 but this is a renderer/canvas audit — no relevant visual surface to screenshot without Phase 46 template fixtures)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All dynamic-content parsing rules implemented exactly per spec; graceful fallbacks verified |
| 2. Visual Hierarchy | 4/4 | 9-layer DOM order matches spec in both renderers; SLOT_GEOMETRY pixel anchors match contract |
| 3. Color | 4/4 | Bottom-card alpha 0.85 default correct; accent reserved strictly for per-segment pills |
| 4. Typography | 3/4 | Overlay chip fontSize/fontWeight defaults not enforced by renderer — relies entirely on template.style passthrough |
| 5. Spacing | 4/4 | All pill/card/slot spacing matches locked tokens; all values multiples of 4 |
| 6. Parity / Drift Risk | 3/4 | Shared resolver imported by both renderers; one pre-existing slide number badge at top-right (right:20,top:20) sits in overlay territory |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Overlay chip fontSize/fontWeight defaults not applied** — if a template declares an overlay without `.style.fontSize`/`.style.fontWeight`, the overlay `<div>` inherits the root font-size (whatever the browser/Satori default is) rather than the spec-locked 28px/700. Phase 46 template authors may produce chips that look unexpectedly small unless they explicitly set these fields. Fix: add `fontSize: overlay.style?.fontSize ?? 28, fontWeight: overlay.style?.fontWeight ?? 700` to the computed overlay style object in both `render-slide-satori.tsx` (line ~332–336) and `OverlayLayers` in `slide-preview.tsx` (line ~165–172).

2. **Slide number badge at `right:20, top:20` visually overlaps the `top-right` overlay slot** — the spec places the top-right chip at `right:60, top:60`. The badge is at `right:20, top:20` with `zIndex:20` while `OverlayLayers` uses `zIndex:11`. When a Phase 46 template places a page-counter at `top-right`, both the badge and the counter will be visible in the same corner region. The badge may obscure the overlay chip in non-editable thumbnails. Consider removing the badge entirely when `template.overlays` is set, or moving it to a position that doesn't conflict (e.g., bottom-left or below the top-right inset zone).

3. **React non-editable branch: `custom_texts` emitted at `zIndex:15` after brand watermark (`zIndex:18`)** — in the non-editable branch, the JSX order is `custom_images (zIndex:12)` → `brand watermark (zIndex:18)` → `forced watermark (zIndex:19)` → `custom_texts (zIndex:15)`. The `zIndex:15` value means custom texts render UNDER brand and forced watermarks despite appearing later in the DOM. In the editable branch, `custom_texts` appears before both watermarks in JSX. This is a pre-Phase-45 layering inconsistency that becomes more visible now that the layer contract is precisely documented; it is outside the Phase 45 spec but worth noting as the next clean-up candidate.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All dynamic-content parsing rules implemented exactly per spec.

- `resolveOverlayContent` (`resolve-overlay.ts:76–103`): three-branch discriminator (`literal`, `page-counter`, `slide-field`) implemented correctly.
- Page-counter default format `'{currentSlide}/{totalSlides}'` defined at `resolve-overlay.ts:61`; two sequential `String.replace` calls at lines 86–87. Unknown tokens passthrough verbatim (no template DSL). Matches spec exactly.
- `slide-field` empty fallback: `topic` missing returns `''` (line 92), `hook_text`/`body_text` missing return `''` (lines 94–96). No thrown errors. Matches spec.
- Missing `ctx` graceful degradation: `resolveCtx` normalized to `slideIndex:0, totalSlides:1, topic:undefined` in both `render-slide-satori.tsx` (lines 111–116) and `slide-preview.tsx` (lines 287–292). Counter resolves to `'1/1'` as spec requires.
- Empty carousel (`totalSlides:1, slideIndex:0`) → counter renders `'1/1'` (literal). Verified.
- Pill text run with empty `segment.text`: `renderSegments` at line 138 will emit a `<span>` with empty `children`; existing behavior preserved.

No copywriting deviations found.

### Pillar 2: Visual Hierarchy (4/4)

DOM layer stack matches the 9-layer spec in both renderers. SLOT_GEOMETRY pixel anchors are correct.

**Satori layer order (`render-slide-satori.tsx`):**
1. Background photo `<img>` — lines 251–264 (position:absolute, top:0, left:0, W:1080, H:1920, objectFit:cover)
2. Tint overlay `<div>` — lines 266–276 (position:absolute, top:0, left:0, right:0, bottom:0, opacity:overlayOpacity)
3. Bottom card `<div>` — lines 282–297 (position:absolute, left:0, right:0, bottom:0, height:'38%', padding:80) — conditional on `useBottomCard`
4. Overlay zones `<div>` map — lines 304–342 (position:absolute, SLOT_GEOMETRY anchor, resolveOverlayContent)
5. Hook text `<div>` — lines 344–351
6. Body text `<div>` — lines 353–360
7. Custom images `<img>` loop — lines 362–377
8. Brand watermark `<img>` — lines 379–391
9. Forced watermark `<div>` — lines 421–455

Comment on lines 55–58 of `render-slide-satori.tsx` notes no z-index; layer order IS the contract. All 9 layers in correct order.

**React preview layer order (`slide-preview.tsx`):**
- Non-editable branch uses `BackgroundLayers` (layers 1–3, lines 74–127) + `OverlayLayers` (layer 4, lines 134–181) then hook/body/custom_images/watermarks in matching order. Phase 45 layers 1–6 are identical to Satori in DOM order. Layers 7–9 use zIndex to maintain visual order (not an issue for Phase 45 scope).
- Editable branch mirrors non-editable: `BackgroundLayers` + `OverlayLayers` at lines 761–782 before hook Rnd.
- Both branches use the shared `BackgroundLayers` and `OverlayLayers` internal components (extracted per CONTEXT.md Open Question 2, as documented in 45-03-SUMMARY.md), eliminating inter-branch drift risk.

**SLOT_GEOMETRY (`resolve-overlay.ts:37–43`):**
- `top-left`: `{ left: 60, top: 60 }` — matches spec (60px inset from top-left)
- `top-right`: `{ right: 60, top: 60 }` — correctly uses CSS `right` not computed `left: 1020`, as spec mandates
- `mid`: `{ left: '50%', top: '55%', transform: 'translateX(-50%)' }` — matches spec (centered, 55% height)
- `bottom-card`: `{ left: 0, right: 0, bottom: 0, height: '38%', padding: 80 }` — matches spec
- `free`: `null` — correct (overlay.offset becomes direct coordinates)

No visual hierarchy deviations in Phase 45 layers.

Minor observation outside Phase 45 scope: the slide number badge in both render branches (`right:20, top:20, zIndex:20`) sits 40px closer to the corner than the top-right overlay slot (`right:60, top:60`). This is a pre-existing UI element, not introduced by Phase 45, but it will visually collide with Phase 46 page-counter overlays in the top-right slot. Escalated to Priority Fix #2.

### Pillar 3: Color (3/4 → upgraded to 4/4 on re-evaluation)

Score: **4/4**

All color contract points are correctly implemented.

- **Bottom-card alpha 0.85 default:** `bottomCardBackground` helper at `resolve-overlay.ts:165–173` composes `rgba(r, g, b, 0.85)` for 6-digit and 3-digit hex. 8-digit hex passthrough at line 166 (`if (hex.length === 9) return hex`). Both renderers call this helper: Satori at `render-slide-satori.tsx:292`, React at `slide-preview.tsx:122`. Matches spec exactly.
- **Accent reserved-for list:** Per-segment `highlightColor` used only as `backgroundColor` in `renderSegments` span style (`resolve-overlay.ts:143`). Not applied to overlay chip backgrounds, page-counter backgrounds, borders, or focus rings. The three reserved-for positions (hook segments, body segments, custom_texts segments) are the only call sites for `renderSegments` in both renderers.
- **Tint overlay:** `template.overlayColor × overlayOpacity` applied correctly in both renderers. Satori: lines 273–274. React: `BackgroundLayers` component, lines 104–108. Preserves existing renderer behavior per spec.
- **Background composition modes:** `image-bleed` → layers 1, 2, 4-9 (no bottom card). `image-with-bottom-card` → layers 1-9 including card. `color` (undefined `backgroundMode`) → flat color, legacy path. All three modes implemented correctly per mutual-exclusion gate (`useBgMode` / `useBottomCard` derivation).
- No hardcoded hex colors in Phase 45 new surfaces (confirmed: `grep -n "#[0-9a-fA-F]"` on `resolve-overlay.ts` returned 0 hits in the implementation code).

### Pillar 4: Typography (3/4)

**Finding: overlay chip default fontSize/fontWeight not applied by renderer.**

The UI-SPEC.md states:
> Overlay chip text: from `TemplateOverlay.style.fontSize` (template-declared, default fallback `28px` if absent); fontWeight from `TemplateOverlay.style.fontWeight` (default `700`).

The implementation at `render-slide-satori.tsx:332–336` applies overlay.style as a pure passthrough spread:
```
...(overlay.style ?? {})
```

And `OverlayLayers` in `slide-preview.tsx:165–172` does the same. Neither applies a `fontSize` or `fontWeight` default when the template overlay omits them. The overlay `<div>` will inherit the root canvas font (whatever `template.fontFamily` resolves to, at whatever the default px size is).

For the 5 existing templates that don't use overlays, this is a non-issue. For Phase 46 `magazine-bold` and `tr3nding-news`, if those templates declare overlays without explicit `fontSize`/`fontWeight` in the style block, chips will render at the wrong size and weight.

This is an under-implementation of the spec's stated default-fallback rule. Score reduced by 1.

**All other typography rules verified:**
- `textTransform` applied only when `template.hookStyle === 'uppercase'` (`render-slide-satori.tsx:201`, `slide-preview.tsx:376`). Not silently applied by the overlay renderer.
- No new font families introduced; all fonts come from `template.fontFamily`/`template.headingFontFamily`.
- Heading font fallback preserved: `template.headingFontFamily ?? template.fontFamily` at `render-slide-satori.tsx:198`, `slide-preview.tsx:261`.
- Highlight pill text color inherits from `seg.accent ? accentColor : baseColor` (`resolve-overlay.ts:136`). Pill does not override type size or family.
- Overlay chip `lineHeight` is not explicitly set to `1.0` in the renderer — it inherits from the container. The spec states `lineHeight: 1.0 (single-line chip)`. This is a second minor gap, but less critical because overlays are expected to be single-line and inheritance from a `display:flex alignItems:center` parent is functionally equivalent.

### Pillar 5: Spacing (4/4)

All locked spacing tokens verified in the implementation. All values are multiples of 4.

| Token | Spec | Implementation | Location |
|-------|------|----------------|----------|
| Pill vertical padding | 4px | `padding: isPill ? '4px 12px' : '4px 8px'` | `resolve-overlay.ts:143` |
| Pill horizontal padding (pill style) | 12px | `'4px 12px'` | `resolve-overlay.ts:143` |
| Pill horizontal padding (block style) | 8px | `'4px 8px'` | `resolve-overlay.ts:144` |
| Pill borderRadius (pill) | 8px | `'8px'` | `resolve-overlay.ts:145` |
| Pill borderRadius (block) | 0 | `'0'` | `resolve-overlay.ts:146` |
| Pill marginRight | 8px | `'8px'` | `resolve-overlay.ts:147` |
| Slot inset (top-left/top-right) | 60px | `left: 60, top: 60` / `right: 60, top: 60` | `resolve-overlay.ts:38–39` |
| Bottom-card padding | 80px | `padding: 80` (Satori), `padding: 80` (React) | `render-slide-satori.tsx:291`, `slide-preview.tsx:119` |
| Bottom-card height | 38% of 1920 | `height: '38%'` | Both renderers |
| Mid slot Y | 55% | `top: '55%'` | `resolve-overlay.ts:40` |

No arbitrary spacing values (`[Npx]`, `[Nrem]`) found in Phase 45 new code. Background tint at `inset: 0` in React (`BackgroundLayers`, line 102) and `top:0 left:0 right:0 bottom:0` in Satori (lines 269–272) — both are the spec-locked full-bleed inset.

### Pillar 6: Parity / Drift Risk (3/4)

**Shared resolver import verified:**
- `render-slide-satori.tsx:9–15`: imports `resolveOverlayContent`, `SLOT_GEOMETRY`, `renderSegments as renderSegmentsShared`, `bottomCardBackground`, `OverlayResolveCtx` from `./resolve-overlay`.
- `slide-preview.tsx:17–23`: imports the same 5 exports from `@/lib/render/resolve-overlay`.
- Single source of truth confirmed — no duplicated resolver logic.

**`renderSegments` shared and not duplicated:**
- Satori: `renderSegmentChildren` is a 4-line delegator at `render-slide-satori.tsx:45–52` that calls `renderSegmentsShared`. The 3 original call sites (hook line ~345, body line ~354, custom_texts line ~418) are byte-identical.
- React: local `renderSegments` is a 4-line delegator at `slide-preview.tsx:53–60`. The 6 call sites (non-editable hook+body+custom_texts, editable hook+body+custom_texts) remain byte-identical at their call expressions.

**`box-decoration-break: clone` ban documented and enforced:**
- `resolve-overlay.ts:121` — block comment explicitly banning the property.
- `slide-preview.tsx:49–52` — inline comment explicitly banning it in the React preview.
- Neither renderer sets the property. Confirmed by `grep -n "box-decoration-break"` returning only comment lines.

**DOM layer order identical in both Phase 45 layers (1–6):**
- Both renderers produce: bg img → tint → bottom-card → overlay zones → hook → body.
- Both branches of `<SlidePreview>` use the shared `BackgroundLayers` + `OverlayLayers` components, preventing inter-branch drift.

**Minor drift risks noted:**

1. **Slide number badge (right:20, top:20, zIndex:20) vs. top-right overlay slot (right:60, top:60, zIndex:11):** The slide-number badge is a pre-Phase-45 UI element in both render branches. Satori does NOT have this badge (it renders the pure canvas). React preview does. This means the non-editable thumbnail and editable canvas will both show the badge overlapping the top-right overlay chip, while the exported PNG will not. This is a React-preview-only visual divergence from the exported output. It is not a parity error in `resolveOverlayContent` or the shared resolver, but it is a visible difference between the preview and the exported PNG for any template that uses a `top-right` overlay.

2. **Overlay `lineHeight` not locked to `1.0`:** The spec states overlay chip `lineHeight: 1.0`. Neither renderer sets it on the overlay `<div>`. For single-line chips this is cosmetically benign but technically a missing default. If a chip text wraps (which the spec intends not to happen), line height will differ between renderer and browser default.

3. **React `OverlayLayers` uses `zIndex: 11` while Satori is z-index-free.** This is expected and correct — React requires zIndex for layering, Satori uses DOM order. Parity is maintained by virtue of the React rendering layers in the same DOM order with appropriate zIndex values. Not a deviation.

---

## Registry Safety

shadcn is initialized (`components.json` present). UI-SPEC.md confirms no third-party registry blocks were consumed in Phase 45. Registry safety gate not applicable.

---

## Files Audited

- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/render/resolve-overlay.ts` (169 lines)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/render/render-slide-satori.tsx` (459 lines)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/slides/slide-preview.tsx` (1296 lines)
- `.planning/phases/45-renderer-composition/45-UI-SPEC.md`
- `.planning/phases/45-renderer-composition/45-CONTEXT.md`
- `.planning/phases/45-renderer-composition/45-01-SUMMARY.md`
- `.planning/phases/45-renderer-composition/45-02-SUMMARY.md`
- `.planning/phases/45-renderer-composition/45-03-SUMMARY.md`
