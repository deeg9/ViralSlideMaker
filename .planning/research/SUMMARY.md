# Research Synthesis — v2.10 Text Box Resize Handles

**Project:** TikTok Slideshow Creator
**Milestone:** v2.10 — Text Box Resize Handles
**Researched:** 2026-05-02
**Overall confidence:** HIGH on stack & pitfalls; MEDIUM on UX (opinionated synthesis between divergent recommendations).

---

## TL;DR

- **Stack:** Stay on `react-rnd@10.5.3`. Library already supports all 8 handles (proven in this codebase by the custom-image `<Rnd>` block at `slide-preview.tsx:1156-1182`). v2.10 is a 6-line `enableResizing` flip + a callback extension, not a library swap.
- **UX (picked direction):** **Canva-style hybrid — corner-drag scales font + width together by default; left/right side handles preserve today's width-only behavior; top/bottom handles are NOT shipped; Shift+corner = width-only escape hatch.** Matches 7-of-8 surveyed industry tools and the verbatim user ask ("crank the hook to fill the top half").
- **Schema (picked direction):** **No new field on `TextBoxPosition`.** Persist corner-drag results as `font_size: number` (already on `TextBox`) plus existing `position.width`. Auto-fit height stays. Zero schema diff, zero migration risk.
- **Three known disagreements between research files** were resolved by picking FEATURES.md's direction. ARCHITECTURE.md proposed `height?` and PITFALLS.md proposed `min_height?`; both add fields the picked UX makes dead weight. **One open question is surfaced for the roadmapper to validate with the user before phase locking** — see "Open questions" below.
- **Top risk:** TPLREND-05 parity drift. Resize handles must stay strictly inside the `editable={true}` branch of `slide-preview.tsx`; any leak into the non-editable branch breaks Satori PNG export.

---

## Stack additions

**No new dependencies.** `react-rnd@10.5.3` (already in `package.json:49`) supports every affordance v2.10 needs.

**Why settled (HIGH confidence):**
- All 8 handles already work under the same CSS-`transform: scale()` parent — proven empirically by the custom-image `<Rnd>` block.
- React 19.1 compatibility verified: `re-resizable@6.11.2` lists `^19.0.0` in peer deps; existing `<Rnd>` instances run cleanly with 756 tests green at v2.9.
- `react-moveable` rejected at 4.6 MB unpacked vs react-rnd's 87 kB.

**Paste-ready config** (replaces today's left/right-only `enableResizing` at `slide-preview.tsx` ~line 801):

```tsx
const enableResizing = {
  left: true,  right: true,
  top: false,  bottom: false,
  topLeft: true, topRight: true,
  bottomLeft: true, bottomRight: true,
}
```

**Critical preservations:**
1. `scale={scale}` on every `<Rnd>` — patches CSS-transform parent math (react-rnd #110).
2. `editable={true}` gate before any `<Rnd>` mounts — Satori never sees handle DOM.
3. `lockAspectRatio={false}` on text boxes (custom-image's `lockAspectRatio={true}` is image-only).

Detail: `STACK.md`.

---

## Feature table stakes

The synthesizer commits to the **Canva-style hybrid** UX. Empirical: 7 of 8 surveyed tools (Canva, Figma default, Figma Scale, CapCut, Keynote-with-shrink-on, Pages, Adobe Express, VEED) scale font on corner-drag by default; only Photoshop is the holdout.

### Corner-drag (no modifier) — DEFAULT

- **Scales `font_size` AND `position.width` together by the same ratio.**
  - `new_font_size = clamp(round(old_font_size * (new_width_pct / old_width_pct)), role_min, role_max)`
  - Hook bounds: `[16, 240]`. Body bounds: `[14, 120]`.
- **Past the cap, the box keeps growing but the font stops.** Forgiving > honest.
- **Auto-fit height stays.** No `height` field; text box reflows to content.

### Side-drag (left / right) — PRESERVED

Width-only, font unchanged. Identical to today's behavior.

### Top/bottom handles — DELIBERATELY OMITTED

TextBox is auto-fit-height. Vertical handles force one of three bad outcomes: vertical-only font scale (distorts), explicit `height` field (no good vertical-alignment default), or text clipping. All three rejected.

### Shift modifier — width-only escape

Holding `Shift` during corner-drag disables font scaling. ~30 min of code; ship if scope permits.

### Persistence model — explicit `font_size`, NOT scale factor

| Question | Explicit `font_size` | Scale factor |
|---|---|---|
| Slider reflects drag in real time? | Yes | No |
| Satori export works unchanged? | Yes | No |
| AI generation works? | Yes | No |
| TPLREND-05 parity holds? | Yes | No (3 places to drift) |

### Shipping checklist

1. Corner handles on hook + body + custom text boxes, scaling font + width together.
2. Side handles preserved (left + right).
3. Right-rail font-size slider reflects new value within 1 frame of `onResizeStop`.
4. Clamp to existing slider bounds.
5. Renderer parity across all 3 paths.
6. Single undo entry per gesture (dispatch on `onResizeStop`).
7. Cursor changes to diagonal-arrow on corner hover.

### Anti-features

1. Rotation (defer to v3.0+).
2. Skew / shear.
3. Top/bottom vertical-only scaling.
4. Multi-select group resize.
5. Aspect-ratio-lock as a persisted toggle.
6. Auto-fit-text-to-box-on-type.
7. Explicit `height` field on `TextBoxPosition`. **KEY DEPARTURE from ARCHITECTURE.md/PITFALLS.md**.

Detail: `FEATURES.md`.

---

## Architecture

The synthesizer commits to the **no-new-schema-field** path.

### Schema decision

**No change to `TextBoxPosition`.** Today's shape (`anchor`, `x?`, `y?`, `width?`) is sufficient.

Two writes per corner-drag:
- `text_boxes[i].position.width` (`applyDualWrite` already mirrors to legacy `hook_width`/`body_width`)
- `text_boxes[i].font_size` (already at `slide.ts:97`; no dual-write needed)

**Migration:** zero.

### Renderer touch list

| File | Change | Risk |
|---|---|---|
| `slide-preview.tsx` ~801 | Flip `enableResizing` (corners on, top/bottom off). Extend handle styles. Read `e.shiftKey`. | MEDIUM |
| `slide-preview.tsx` 889/964/1062 | `onResizeStop` computes `widthRatio`, dispatches `font_size` alongside `width` on corner. | MEDIUM |
| `slide-editor.tsx` ~433 | Extend `handleWidthChange` to also write `style_overrides.{hook,body}_font_size`. | LOW |
| `render-slide.ts` | NONE | None |
| `render-slide-satori.tsx` | NONE | None |
| `slide.ts` | NONE | None |
| `editor-reducer.ts` | NONE | None |
| `text-box-adapter.ts` | NONE | None |
| `slide-preview.test.tsx` (+30 LoC) | New test cases | LOW |
| `parity.test.tsx` (+20 LoC) | Cross-renderer parity | LOW |
| `editor-reducer.test.ts` (+15 LoC) | History stack length | LOW |

**Total estimated LOC:** ~150-200 across 4-5 files.

### Build order — single phase, 4 commits

| Commit | What |
|---|---|
| C1 | Flip `enableResizing`. Capture `oldWidthPx` + `oldFontSize` in `onResizeStart`. No font-scale yet. |
| C2 | Dispatch `font_size` alongside `width` on corner `onResizeStop`. |
| C3 | Single-history-entry test + clamp + cursor affordance + WCAG 24×24 hit zone. |
| C4 | (Optional) Shift+corner = width-only escape. |

Detail: `ARCHITECTURE.md` (its `height?` recommendation rejected here).

---

## Watch out for

Top 5 pitfalls ranked by severity:

1. **Three-renderer parity (TPLREND-05).** v2.7 commit `e96fd3a` precedent. **Mitigation:** add 1 case to `parity.test.tsx`; renderer surface is small (no schema change).
2. **Undo/redo per pointer-tick.** Dispatching on `onResize` → 60 history entries per drag. **Mitigation:** dispatch ONLY on `onResizeStop`. Test: 60-tick drag → history length = 1.
3. **Auto-shrink registry interaction (`hook-fit.ts`).** Today's precedence at `slide-preview.tsx:313`: `overrides.hook_font_size ?? autoFitHookSize ?? baseHookSize`. **Mitigation:** route through existing `style_overrides.hook_font_size`. Regression test: corner-drag on `news-drop`.
4. **CSS-transform scale + react-rnd handle math.** Without `scale={scale}`, drag deltas are 1.5–2.5× too fast. **Mitigation:** every existing `<Rnd>` already passes `scale={scale}` — PRESERVE.
5. **Touch hit targets — WCAG 2.5.8 minimum 24×24.** Existing image handles 8×8 too small for touch. **Mitigation:** 12×12 visual, 24×24 hit zone via wrapper. Manual touch test on iPhone Safari before phase close.

Detail: `PITFALLS.md`.

---

## Open questions for the roadmapper

### 1. SCHEMA / UX VALIDATION (MUST ASK USER)

Roadmapper must confirm with the user:

> "v2.10 will add corner handles that scale font size + box width together (Canva-style). No top/bottom handles. No new schema field. The hook will literally grow to fill the top part when you drag a corner. Sound right? — or do you want top/bottom handles too, even though that means adding a height field and deciding what 'empty space below the text' looks like?"

If the user says "I want top/bottom handles too," the call inverts and we follow ARCHITECTURE.md's `height?` path. **Only fork worth flagging.**

### 2. Past-the-cap behavior

(a) Stop scaling font at the cap, keep growing the box (recommended); or (b) stop the entire drag at the cap.

### 3. Shift = width-only escape — ship in v2.10 or defer?

### 4. Custom-text dispatch path inconsistency

`slide-preview.tsx:1062` dispatches `UPDATE_CUSTOM_TEXT` not `UPDATE_TEXT_BOX`. 5-line cleanup. Include or punt?

### 5. Snap-to-alignment-guides during corner-resize?

Today only on `onDrag`. Punting fine for v2.10.

### 6. Cursor affordance discoverability

Toast on first text-box selection? Pre-PMF, "no toast, cursor change only" recommended.

---

## Research-grounded decisions made

The synthesizer commits to these without re-asking:

1. Stay on `react-rnd@10.5.3` — no library swap. HIGH confidence.
2. Persist `font_size` as explicit number, NOT scale factor. HIGH confidence.
3. Single-phase milestone, 4 commits internally. HIGH confidence.
4. Reject ARCHITECTURE.md's `resolveTextBoxBounds` helper. MEDIUM confidence.
5. Reject PITFALLS.md's `min_height?` schema field. HIGH confidence.
6. Cursor changes to `nwse-resize` / `nesw-resize`; no onboarding toast. MEDIUM confidence.
7. Touch hit-target padding to 24×24 (WCAG 2.5.8 AA). HIGH confidence.

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Verified via type defs, npm metadata, in-codebase precedent. |
| Features (Canva-style) | MEDIUM-HIGH | 7-of-8 tools surveyed; opinionated synthesis. Validated in Open Q #1. |
| Architecture (no-schema-change) | HIGH | Smaller surface than ARCHITECTURE.md; zero migration. |
| Pitfalls | HIGH | All 14 in-scope pitfalls have grounded prevention strategies. |

**Overall:** HIGH on engineering shape; MEDIUM on UX call. Roadmapper validates Open Q #1 before phase planning.

### Gaps to address during planning

- Verify with user that Canva-style hybrid is desired UX.
- `hook-fit.ts` interaction regression test must land in v2.10.
- Touch QA on iPhone Safari is a phase-close gate.

---

## Sources

### Primary (HIGH)
- Installed `node_modules/react-rnd@10.5.3`.
- npm registry: `react-rnd@10.5.3` + `re-resizable@6.11.2`.
- In-codebase: `slide-preview.tsx:1156-1182` (custom-image `<Rnd>` with all 8 handles).
- [Canva — Resize text boxes](https://www.canva.com/help/wrap-text/).
- [Figma — Adjust text dimensions](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing).
- [WCAG 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

### Secondary (MEDIUM)
- [react-rnd #110](https://github.com/bokuweb/react-rnd/issues/110), [#766](https://github.com/bokuweb/react-rnd/issues/766).
- [vercel/satori README](https://github.com/vercel/satori).
- CapCut, Keynote, Pages, Adobe Express, VEED tool surveys.

### In-codebase precedent
- `slide-preview.tsx:553` — `editable === false` early-return.
- `slide-preview.tsx:313` — font-size precedence chain.
- `editor-reducer.ts:22-55` — `applyDualWrite` mirrors `position.width`.
- v2.7 commit `e96fd3a` — Satori `display: flex` parity bug precedent.
- v2.8 BL-01 — `applyDualWrite` reducer precedent.

---
*Synthesis completed 2026-05-02. Ready for roadmap pending Open Q #1 validation.*
