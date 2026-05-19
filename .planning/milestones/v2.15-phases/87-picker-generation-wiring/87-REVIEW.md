---
phase: 87-picker-generation-wiring
status: clean
date: 2026-05-19
depth: standard
files_reviewed: 6
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
---

# Phase 87 Code Review — Picker + Generation Wiring

**Depth:** standard. **Scope:** the 6 production source files changed in Phase 87
(the 6 test files are excluded from defect review — they are verification
artifacts, all green).

Files reviewed:
- `src/lib/render/templates/registry.ts`
- `src/components/slides/template-picker.tsx`
- `src/components/slides/generation-form.tsx`
- `src/app/(dashboard)/project/[id]/page.tsx`
- `src/app/(dashboard)/project/[id]/actions.ts`
- `src/lib/services/carousel.ts`
- `src/app/api/v1/carousel/route.ts`

## Findings

### INFO-01 — `actions.ts` sync `getTemplate` calls now reachable by a DB id (documented Phase 88 scope)

`src/app/(dashboard)/project/[id]/actions.ts` — the Phase 87 DB-aware snap
lets a DB `effectiveTemplateId` flow into the file's two remaining sync
`getTemplate(effectiveTemplateId)` calls (`photoTreatment`/`paletteMode` at
~L233, `backgroundMode` at ~L320). `getTemplate` returns `templates[0]` for an
unknown id (never throws — verified contract), so a DB id reads the *code*
`templates[0]`'s photo-treatment fields rather than its own.

**Not a defect — intentional and bounded.** CONTEXT.md / DB-TEMPLATE-WIRING-SPEC.md
explicitly scope the sync→async `getTemplate`→`resolveTemplate` conversion of
these render-shaping call sites to Phase 88 (WIRE-03). Phase 87's contract is
that a DB-template generation SAVES the correct `template_id`; the carousel
still persists `template_id = the DB id` correctly (proven by both WIRE-02
generation tests). Only the photo-treatment shaping uses the code fallback
until Phase 88. `carousel.ts`'s analogous `backgroundMode` read WAS converted
this phase (it is the one call site CONTEXT.md named). No action required —
recorded for Phase 88 traceability.

## Assessment

- **Snap logic** (`generation-form.tsx`, `actions.ts`, `carousel.ts`): correct.
  The three sites share the same "code id in category OR DB id whose category
  matches, else snap to default" rule. The client predicate `idBelongsToCategory`
  is defined before its first use (the `useState` initializer), closing over
  `dbTemplates` — a plain function, correctly NOT a hook.
- **Registry helpers** (`getPickerDbTemplates`, `templateCategory`): reuse the
  existing `getDbRows` / `CODE_TEMPLATE_ID_SET` / `dbRowToSlideTemplate`; never
  throw (degrade to `[]` / `null`); preserve the fetcher's newest-first order.
- **Picker merge** (`template-picker.tsx`): DB-first ordering correct; the
  no-category fallback (`categoryDbTemplates = []`) preserves the pre-Phase-87
  behavior exactly; `SlideTemplate` was not widened. The Brand Kit tile block
  is unchanged.
- **Server fetch** (`page.tsx`): `getPickerDbTemplates()` runs after the
  `hasSlides` editor branch — not fetched on the editor path; no client fetch,
  no new API route.
- **API guard** (`route.ts`): `isKnownTemplateId` runs after the string check,
  before credit deduction (fail-fast); a bad id cannot strand credits.
- **Public-by-default:** `autoPublishOnGenerate` call sites untouched on both
  paths; re-asserted by the WIRE-02 tests.
- **Closed-enum invariant:** the picker filters DB templates by string-equality
  of `row.category` against the selected category — no enum widening; a `null`
  or unknown category never matches.
- No `any`, no unhandled promise, no security regression (the registry's anon
  RLS read is unchanged). The now-unused `getTemplate` import was removed from
  `carousel.ts`.

## Verdict

**CLEAN** — no Critical or Warning findings. 1 Info note (a documented Phase 88
boundary, not a defect). Full suite holds at the 41-failure baseline with zero
new failures.
