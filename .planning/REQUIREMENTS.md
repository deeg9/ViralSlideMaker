# Requirements: v2.8 Text Editor Right-Rail Redesign

**Milestone goal:** Replace the cluttered, dual-slot ("Hook" + "Body") text editing panel with a selection-driven, single-element right rail that supports an arbitrary number of text boxes per slide and stacks Shadow / Outline / Highlight as independent toggleable effects.

**Research grounding:** Industry-standard pattern from Figma, Canva (post-Glow Up 2025), CapCut, VEED, Adobe Express, Photoshop, Illustrator. NN/g guidance on accordion vs. always-visible sections in design-tool inspectors. Plan file: `~/.claude/plans/users-deeg-desktop-screenshot-2026-04-3-replicated-seal.md`.

---

## Categories

- **SCHEMA** — Data model unification (`hook_text` + `body_text` → `text_boxes: TextBox[]`)
- **TEDIT** — Text editor right-rail UX (selection-driven panel, layer strip, effect rows)
- **AIGEN** — AI generation prompt rewrite to emit `text_boxes[]`
- **CANVAS** — Canvas-side selection ring, click-to-select, keyboard shortcuts
- **MIG** — Migration / backfill / rollback safety

---

## SCHEMA — Schema unification

- [ ] **SCHEMA-01** — `TextBox` interface in `src/lib/types/slide.ts` with fields: `id`, `text`, `segments?: TextSegment[]`, `font`, `size`, `color`, `align`, `effects: TextEffects`, `position: { anchor: 'top'|'center'|'bottom'|'custom', x?, y?, width? }`, `role: 'hook' | 'body' | 'custom'`.
- [ ] **SCHEMA-02** — `Slide.text_boxes: TextBox[]` field added; legacy `hook_text` / `body_text` / `hook_segments` / `body_segments` / `custom_texts` retained and marked `@deprecated` (sunset target: v2.9).
- [ ] **SCHEMA-03** — Virtual adapter: when loading a slide that lacks `text_boxes`, derive it from legacy fields. Unit-tested round-trip parity for at least 5 representative legacy slide shapes (hook+body only, hook+body+1 custom, hook+body+effects, news-template with segments, magazine-bold with overlays).
- [ ] **SCHEMA-04** — Dual-write: when saving, populate both `text_boxes` AND legacy fields. Legacy readers (older clients, exports, cron jobs) must continue to function unchanged.
- [ ] **SCHEMA-05** — Editor reducer (`src/lib/editor/editor-reducer.ts`) handles new actions: `ADD_TEXT_BOX`, `REMOVE_TEXT_BOX`, `UPDATE_TEXT_BOX`, `SET_ACTIVE_TEXT_BOX_ID`. Each action funnels through `pushHistory()` so undo/redo Just Works.
- [ ] **SCHEMA-06** — TypeScript types regenerated from Supabase via `mcp__supabase__generate_typescript_types`; `npx tsc --noEmit` clean.

## TEDIT — Right-rail panel UX

- [ ] **TEDIT-01** — Top of right rail renders a horizontal **layer strip**: one chip per text box (preview snippet ≤24 chars + role icon), trailing "+ Add Text Box" chip. Active chip visually highlighted (`bg-[#3d0000] text-white`).
- [ ] **TEDIT-02** — Clicking a chip updates `selectedTextBoxId` in editor state and the panel below swaps to that text box's properties.
- [ ] **TEDIT-03** — Below the layer strip: a single **active-box card** with darker `bg-white border-2 border-[#3d0000]/20 focus-within:border-[#3d0000]` framing so the editable surface visually pops from the cream panel background.
- [ ] **TEDIT-04** — Active-box card content (top-to-bottom): textarea for the box's text, then flat always-visible labeled sections — Font / Size / Color / Align — followed by an "Effects" subhead.
- [ ] **TEDIT-05** — Effects section renders three independent toggle rows: Shadow, Outline, Highlight. Each row = label + Switch (`@radix-ui/react-switch` already a dep). Switch on → sliders + color swatches reveal inline beneath. Switch off → controls collapse.
- [ ] **TEDIT-06** — All three effect toggles can be on simultaneously (Shadow + Outline + Highlight stack). Rendering parity verified across React preview, Satori PNG export, and HTML export.
- [ ] **TEDIT-07** — Accent Words moves inside the active-box card, collapsed under a "Highlight words" disclosure (caret + "N highlighted" badge). Chip wall only renders when expanded.
- [ ] **TEDIT-08** — Slide-level controls (Overlay opacity, News Layout cover/body) move out of the per-text-box card into a small "Slide settings" section below. They are not per-text-box.
- [ ] **TEDIT-09** — Bottom toolbar preserved: undo/redo, Privacy dropdown, Export, Generate Captions, Save Changes — wired to existing entry points (`doSave`, `downloadSlidesAsZip`, undo/redo dispatch).
- [ ] **TEDIT-10** — Visual regression: render the same slide before/after redesign with identical `text_boxes` data → exported PNG byte-identical (legacy slides forced through the new render path).

## AIGEN — AI prompt rewrite

- [ ] **AIGEN-01** — Gemini slide-text generation prompt emits `text_boxes: [{ role: 'hook', text: '...' }, { role: 'body', text: '...' }]` instead of `{ hook_text, body_text }`. Schema validation + repair pipeline updated.
- [ ] **AIGEN-02** — `regenerateSlideText` (referenced in `src/components/editor/slide-editor.tsx:19`) round-trips the new shape; existing per-field regeneration UX preserved.
- [ ] **AIGEN-03** — Template seeding logic produces `text_boxes[]` with template-appropriate defaults instead of two strings. News templates default to two boxes (hook + body); future templates may emit 3+.
- [ ] **AIGEN-04** — Server-side validator auto-corrects malformed `text_boxes[]` to a 2-box default if Gemini output drifts. Never throws — the user always gets a usable carousel.
- [ ] **AIGEN-05** — Existing premium-tier guardrails (length caps, typo gate, voice notes) preserved through the rewrite. v2.7 audit baseline (19/19 reqs) re-verified after prompt change.

## CANVAS — Canvas selection improvements

- [ ] **CANVAS-01** — Active text box on the canvas shows a visible selection ring + 8 drag handles (corners + midpoints).
- [ ] **CANVAS-02** — Clicking a text box on canvas updates `selectedTextBoxId` and the right rail mirrors instantly.
- [ ] **CANVAS-03** — Floating "Layers" mini-list (collapsed by default) lets users select boxes that are visually behind others — solves the "I can't click the text behind another text" problem.
- [ ] **CANVAS-04** — Keyboard shortcuts (when canvas focused, NOT inside textarea): ⌘1/⌘2/⌘3 to switch active text box, ⌘D to duplicate active, Delete/Backspace to remove.
- [ ] **CANVAS-05** — Drag-to-reposition continues to work; resize handles continue to call existing react-rnd resize plumbing from v1.3.

## MIG — Migration & rollback

- [ ] **MIG-01** — Idempotent backfill script populates `text_boxes` for existing rows in `public.projects.slide_data` from legacy fields. Run via `mcp__supabase__apply_migration`. Re-runnable with no double-effect.
- [ ] **MIG-02** — Feature flag `text_boxes_v2_read` gates the read path. Flag off → legacy fields drive rendering. Flag on → `text_boxes[]` drives rendering with legacy as fallback.
- [ ] **MIG-03** — E2E smoke: open 5 representative existing projects (legacy data), verify all text + styles render byte-identical to pre-migration; create new project, verify N text boxes work end-to-end through Save → Export → Re-load.
- [ ] **MIG-04** — Undo/redo verified across the schema boundary: a sequence of (legacy edit → new edit → undo → redo) leaves no orphaned state.
- [ ] **MIG-05** — `downloadSlidesAsZip` produces correct PNGs given the new shape across all 8 templates (5 legacy + 3 premium).
- [ ] **MIG-06** — Sunset plan documented for legacy fields with target milestone v2.9 and concrete removal checklist (codebase grep, type cleanup, OpenAPI spec update, AI prompt update, test removal).

---

## Out of Scope

| Feature | Reason |
|---|---|
| Animation timeline / motion | Static carousels only; CapCut has it, we don't need it |
| Multi-select editing (edit shared properties of 2+ boxes) | Defer to future milestone if user demand emerges |
| Text-on-curve / text-on-path | Canva-only feature, not in user's stated needs |
| iOS / React Native port of the new panel | Web-first remains priority; iOS phase deferred |
| Right-rail tabs (Style / Animate / Effects) | Premature — only Style + Effects content exists today |
| Drag-and-drop reorder of layer strip chips | Nice-to-have, defer until user asks |

---

## Locked Decisions

- **Selection-only panel model** chosen over stack-of-accordion-cards. Matches Figma, Canva, CapCut, VEED. (User decision during planning, 2026-04-30.)
- **Independent effect toggles** chosen over mutually-exclusive preset radios. Matches CapCut/VEED; lets Shadow + Outline + Highlight stack — the killer feature for busy backgrounds. (User decision during planning.)
- **Always-visible labeled sections** inside the active-box card (no nested accordions for Font / Size / Color / Align). NN/g guidance for design tools where users jump between fields constantly.
- **Dual-write schema migration** (write both legacy + new fields one milestone) chosen over hard cutover. Lets older clients/exports/cron jobs keep functioning during transition; sunset target v2.9.
- **Layer strip above the panel** (horizontal chip row), not a left rail or floating list. Matches the existing right-rail-dominant editor layout.
- **Active-box visual signal lives on canvas** (selection ring) AND in the right rail (darker editable surface framing). Two-layer affordance.

---

## Traceability

| Requirement | Phase |
|---|---|
| SCHEMA-01..06 | Phase 49 |
| TEDIT-01..10 | Phase 50 |
| AIGEN-01..05 | Phase 51 |
| CANVAS-01..05 | Phase 52 |
| MIG-01..06 | Phase 53 |

Phase plans live under `.planning/phases/49/` … `.planning/phases/53/`. Run `/gsd-plan-phase 49` to start.
