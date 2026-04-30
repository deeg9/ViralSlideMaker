# Phase 49 Discussion Log

**Mode:** `--auto` (autonomous, single-pass, recommended defaults)
**Date:** 2026-04-30
**Areas auto-resolved:** 4

---

## Area 1: Type design (TextBox shape)

**Auto-selected:**
- D-01 ID: `nanoid(8)` (recommended — collision-resistant, indexable, URL-safe)
- D-02 Field naming: `text_boxes` snake_case (matches existing `hook_text`, `body_text`, `custom_texts`)
- D-03 Effects: reuse existing `TextEffects` shape from `src/lib/types/slide.ts:44-68`
- D-04 Position: reuse existing `{ anchor, x?, y?, width? }` model
- D-05 Role: keep `'hook' | 'body' | 'custom'` for AI mapping + template seeding
- D-06 Segments: carry forward existing `TextSegment` shape

## Area 2: Adapter & migration strategy

**Auto-selected:**
- D-07 Location: dedicated `src/lib/editor/text-box-adapter.ts` module (pure functions, easily testable)
- D-08 Timing: eager-on-load (UI works on new shape only)
- D-09 Save: dual-write both legacy + new (lossless backward compat)
- D-10 CustomText mapping: legacy `CustomText` ↔ TextBox with `role='custom'`
- D-11 Order: index 0 = hook, index 1 = body, then custom in order
- D-12 Round-trip parity: 5 representative legacy shapes covered by unit tests (per SCHEMA-03)

## Area 3: Reducer & action surface

**Auto-selected:**
- D-13 Add 4 new actions: `ADD_TEXT_BOX`, `REMOVE_TEXT_BOX`, `UPDATE_TEXT_BOX`, `SET_ACTIVE_TEXT_BOX_ID`
- D-14 Preserve `UPDATE_SLIDE` for non-text-box slide state
- D-15 Selection changes do NOT push history (matches Figma/Canva)
- D-16 `selectedTextBoxId: string | null` lives in editor history's `present` shape

## Area 4: Tests & verification

**Auto-selected:**
- D-17 Adapter unit tests + reducer unit tests + 1 integration test (no E2E in this phase — Phase 53 owns cross-template QA)
- D-18 `mcp__supabase__generate_typescript_types` regen after schema lands; hand-extend `slide.ts` with TextBox

---

## Deferred (out of scope)

- Broader rename to `text_elements` / `layers`: defer to v2.9+
- Per-text-box z-index: defer until user demand
- Animation timeline: out of scope for v2.8
- Multi-select editing: defer

## Notes

- No `.continue-here.md` blocking anti-patterns found.
- No prior phase CONTEXT.md files conflict (closest precedent: v1.3 Phase 13 react-rnd resize plumbing — reused in D-04).
- No matching todos from `gsd-sdk query todo.match-phase 49`.
- All decisions ground in the milestone plan at `~/.claude/plans/users-deeg-desktop-screenshot-2026-04-3-replicated-seal.md` and the user's explicit answers during plan mode (selection-only panel, independent effect toggles, full redesign scope).
