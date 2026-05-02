---
milestone: v2.10
milestone_name: Text Box Resize Handles
created: 2026-05-02
---

# v2.10 Requirements — Text Box Resize Handles

**Goal:** Corner + side resize handles on text boxes, with corner-drag scaling font size + box width together (Canva-style). No top/bottom handles, no new schema field, zero migration. Builds on v2.8's TextBox-driven editor.

**Locked decisions** (from `.planning/research/SUMMARY.md` + user confirmation 2026-05-02):
- Canva-style hybrid: corner = scale font + width; side = width only; no top/bottom; Shift+corner = width-only escape.
- Persistence: explicit `font_size` (already on `TextBox`), no new schema field.
- Past-the-cap: box keeps growing, font caps at 240 (hook) / 120 (body).
- Library: `react-rnd@10.5.3` (already installed).

---

## Active Requirements

### Resize Handles (RESIZE)

- [ ] **RESIZE-01**: User can grab any of 4 corner handles (top-left, top-right, bottom-left, bottom-right) on a text box (hook, body, or custom) and drag to resize it.
- [ ] **RESIZE-02**: Existing left + right side handles remain functional — drag adjusts width only, font size unchanged. Muscle memory preserved.
- [ ] **RESIZE-03**: Top + bottom handles are explicitly disabled. The `<Rnd>` `enableResizing` config has `top: false, bottom: false`.
- [ ] **RESIZE-04**: While holding `Shift` during corner-drag, font size does NOT change — the corner behaves as a width-only escape hatch (matches side-handle behavior).

### Font-Scale on Corner-Drag (FONTSCALE)

- [ ] **FONTSCALE-01**: Corner-drag scales `font_size` proportionally to the width change in the same drag stroke. Formula: `new_size = clamp(round(old_size × (new_width_pct / old_width_pct)), role_min, role_max)`.
- [ ] **FONTSCALE-02**: When font size hits the role cap (240 for hooks, 120 for body), the box continues to grow on further drag, but the font stops scaling. Forgiving past-the-cap behavior.
- [ ] **FONTSCALE-03**: After corner-drag commits (`onResizeStop`), the right-rail font-size slider reflects the new value within one render frame. Slider and box stay in sync as a single source of truth.
- [ ] **FONTSCALE-04**: Manual `font_size` set via corner-drag overrides the `hook-fit.ts` auto-shrink registry — existing precedence (`overrides.hook_font_size ?? autoFitHookSize ?? baseHookSize` at `slide-preview.tsx:313`) is preserved and verified by regression test.

### Renderer Parity (PARITY)

- [ ] **PARITY-01**: A slide with corner-dragged `font_size` + `position.width` values renders byte-identical across `slide-preview.tsx` (non-editable branch), `render-slide.ts` (HTML), and `render-slide-satori.tsx` (Satori PNG). Locked by `parity.test.tsx`.
- [ ] **PARITY-02**: Resize handles, corner dots, and any visual affordance for resizing render in the editor only. The `editable={true}` gate ensures Satori PNG output is byte-identical to today's export. New regression test pins this.

### Undo / History (UNDO)

- [ ] **UNDO-01**: A single corner-drag or side-drag gesture produces exactly one undo entry, regardless of pointer-tick count. Dispatch happens on `onResizeStop` only, not `onResize`. Test: 60 simulated `onResize` ticks during a drag → reducer history length = 1 after `onResizeStop`.

### Touch Accessibility (A11Y)

- [ ] **A11Y-01**: All resize handles (corner + side) meet WCAG 2.5.8 AA minimum touch target size: hit zone is at least 24×24 CSS px. Visual handle stays small (12×12) — hit zone padded via wrapper or `inset: -10px`. Manually verified on iPhone Safari.
- [ ] **A11Y-02**: Cursor changes to `nwse-resize` (TL/BR) or `nesw-resize` (TR/BL) on corner hover so users discover the handle is interactive. Side handles keep their existing `ew-resize` cursor.

---

## Future Requirements (deferred)

| REQ-ID | Idea | Reason deferred |
|---|---|---|
| RESIZE-05 | Top + bottom handles with explicit `height` field | Anti-feature for auto-fit text; would force vertical-alignment decisions with no good default. Defer until a real use case arises. |
| GUIDES-01 | Snap-to-alignment-guides during corner-resize | `useAlignmentGuides` runs on `onDrag` only today. v2.11 candidate. |
| ROTATE-01 | Rotation handles | Out of scope for v2.10. Defer to v3.0+ if ever. |
| ASPECT-01 | Aspect-ratio-lock toggle in right rail | Shift modifier (RESIZE-04) covers the 1% who need it. |
| ONBOARD-01 | First-use toast teaching the corner-drag gesture | Pre-PMF: cursor change is enough discoverability. Add post-launch if user feedback shows confusion. |
| CLEANUP-01 | Custom-text resize dispatches `UPDATE_TEXT_BOX` (not legacy `UPDATE_CUSTOM_TEXT`) | 5-line refactor opportunity flagged by ARCHITECTURE.md. Punt to a future cleanup quick. |

---

## Out of Scope

| REQ-ID | Idea | Reason out of scope |
|---|---|---|
| MULTISELECT-01 | Multi-select group resize | Reverses v2.8's single-element right-rail design. |
| SKEW-01 | Skew / shear handles | Anti-feature for social-content layouts. |
| AUTOFIT-01 | Auto-fit-text-to-box-on-type (Keynote "Shrink to fit") | Conflicts with explicit slider model and v2.9's parity discipline. |
| HEIGHT-01 | Explicit `height: number` on `TextBoxPosition` | Anti-feature: the auto-fit-text design is the right choice for short bold hooks. ARCHITECTURE.md proposed it; rejected after FEATURES survey. |
| MIN_HEIGHT-01 | `min_height: number` on `TextBoxPosition` | Same — only earns its keep if top/bottom handles existed, which they don't. PITFALLS.md proposed it; rejected. |

---

## Traceability

| REQ-ID | Phase | Status |
|---|---|---|
| RESIZE-01 | TBD | not started |
| RESIZE-02 | TBD | not started |
| RESIZE-03 | TBD | not started |
| RESIZE-04 | TBD | not started |
| FONTSCALE-01 | TBD | not started |
| FONTSCALE-02 | TBD | not started |
| FONTSCALE-03 | TBD | not started |
| FONTSCALE-04 | TBD | not started |
| PARITY-01 | TBD | not started |
| PARITY-02 | TBD | not started |
| UNDO-01 | TBD | not started |
| A11Y-01 | TBD | not started |
| A11Y-02 | TBD | not started |

(Phase column populated by roadmapper in next step.)
