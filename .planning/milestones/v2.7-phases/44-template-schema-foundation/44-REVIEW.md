---
phase: 44
status: clean
reviewed: 2026-04-29
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/render/templates/index.ts
  - src/lib/render/templates/validate.ts
  - src/lib/render/templates/validate.test.ts
  - src/lib/types/slide.ts
  - src/__tests__/render/templates.test.ts
findings_total: 0
findings_by_severity:
  critical: 0
  high: 0
  medium: 0
  low: 0
  nit: 0
---

# Phase 44: Template Schema Foundation — Code Review

**Reviewed:** 2026-04-29
**Depth:** standard
**Files Reviewed:** 5
**Status:** clean

## Summary

Phase 44 ships a tightly-scoped, type-only TypeScript schema extension plus a 71-line hand-rolled module-load validator. The diff is minimal, additive, and covered by a 7-test RED→GREEN suite plus one backwards-compat assertion in the existing registry tests.

I checked all eight focus areas from the review brief and found no actionable issues at any severity level. Specifically:

- **Discriminated union correctness** — `OverlayContent` narrows correctly on `type` at every call site I traced. No `any` widening, no inadvertent type holes. The `as never` casts in `validate.ts` are confined to the runtime-defensive narrowing path (where input is intentionally typed wider than the union to support `as never` test fixtures) and never leak into a public surface.
- **Validator completeness** — All four documented failure cases are implemented and tested with assertions on the exact message substrings:
  - bad slot → `validateOverlay` line 47-49 (`fixture-bad-slot` test)
  - bad slide-field → `validateContent` lines 36-41 (`fixture-bad-field` test)
  - extraneous page-counter key → `validateContent` lines 28-34 (`fixture-bad-counter` test)
  - duplicate non-`free` slot → `validateTemplateRegistry` lines 63-68 (`fixture-dup-slot` test)
  Plus two extras that exceed the spec (and are harmless): unknown `type` discriminator (line 43) and `literal` content with non-string `text` (line 23). The `free`-slot exemption is asserted negatively by `fixture-two-free`.
- **Backwards compatibility** — `TextSegment` keeps `accent?` first; `highlightColor`/`highlightStyle` are appended as optional. `SlideTemplate.overlays?` and `backgroundMode?` are appended after `sample?`. All five existing template files have zero diff (confirmed in 44-VERIFICATION.md). No risk of breaking the `accent?` two-color news templates.
- **Module-load safety** — `validateTemplateRegistry(templates)` is a single synchronous top-level call placed AFTER the `templates` array literal and BEFORE `getTemplate`. No async, no I/O, no `console`, no global state mutation. The only side effect is a throw on misconfig — exactly what's specified. Import order is import-driven (validate.ts has no top-level side effects of its own), so it cannot break test bootstrapping or hot-reload.
- **Error message format consistency** — All five throw sites route through the single `fail()` helper at `validate.ts:14-16`, so the format `[template-registry] Template '${templateId}' overlay[${overlayIndex}]: ${reason}` is structurally guaranteed. Both `templateId` and `overlayIndex` are present in every error.
- **Test thoroughness** — RED tests are real RED tests: 7 `await import` calls keep the validator-import lazy so the file fails the right way (module-not-found) before validate.ts exists. Each failure assertion uses a regex that pins the templateId AND `overlay[N]` AND the offending value — so a regression that drops either piece would surface immediately. The `fixture-dup-slot` test specifically asserts `overlay[1]` (the SECOND overlay's index) — proving the duplicate detection reports the offending entry, not the first occurrence.
- **Closed enum coverage** — `VALID_SLIDE_FIELDS` literal `['topic', 'hook_text', 'body_text']` exactly matches the union in `OverlayContent`. Cross-checked: `Slide.hook_text` (slide.ts:102), `Slide.body_text` (slide.ts:103), `Project.topic` (project.ts:10) all exist as actual fields, so the closed enum has zero drift from the data model it references.
- **Type/runtime drift** — `VALID_SLOTS` ↔ `OverlaySlot` type union: identical (5 members). `VALID_SLIDE_FIELDS` ↔ slide-field branch: identical (3 members). `PAGE_COUNTER_ALLOWED_KEYS` ↔ `{ type, format }` type: identical (2 members). The only allowed-keys set is `page-counter`'s; the validator does not reject extras on `literal` or `slide-field` (intentionally, since those are not in the documented threat list).

## Notes

Positive observations that came up during review (not findings):

1. **Centralized `fail()` helper** — every error message is structurally identical because all five throw sites go through one helper. This is the right shape for a contract that downstream phases will grep against.
2. **`ReadonlyArray<SlideTemplate>` signature** — `validateTemplateRegistry(registry: ReadonlyArray<SlideTemplate>)` correctly conveys non-mutation. Defensive and clear.
3. **`Object.keys(content)` on `page-counter`** — uses the well-typed allowlist set rather than open-ended type coercion. This is the only branch where extras are checked, which matches the spec exactly.
4. **`TextHighlightEffect` deliberately untouched** — the new per-segment `highlightStyle: 'pill' | 'block'` uses different value names than `TextHighlightEffect.style: 'tight' | 'full'`, which prevents the two sibling concepts from being conflated. The Phase 44 comment block on `TextSegment` (slide.ts:6-9) explicitly calls out this distinction — useful for future readers.
5. **Test fixture pattern (`as never`)** — the validate.test.ts fixtures bypass typecheck via `as never` to test runtime behavior on intentionally-malformed shapes. This is the correct vitest pattern for a runtime validator and avoids contaminating the production types.
6. **Free-slot exemption is verified negatively** — the `fixture-two-free` test guards against a future regression where someone "tightens" the duplicate check and breaks the documented free-slot exemption. Good defense.
7. **The `validateOverlay` ordering** — slot check runs before content check, so a bad slot reports `invalid slot` rather than masking it under a content error. Reasonable failure-priority choice.
8. **No new threat surface** — confirmed against the threat model in 44-02-PLAN.md: no user-controlled data flows into `validateTemplateRegistry`. Inputs are developer-authored template configs at module load.

Items I considered but explicitly did NOT flag (per the focus_areas out-of-scope list):

- Renderer wiring for `overlays` / `backgroundMode` (that's Phase 45)
- Any new templates that exercise the schema (that's Phase 46)
- Theme-aware highlight color refactor (deferred per CONTEXT.md)
- Pre-existing baseline tsc errors in unrelated test files (already in deferred-items.md)
- `literal` and `slide-field` extraneous-key checks not being symmetric with `page-counter` — only `page-counter` extras are documented as a failure case in CONTEXT.md, so the asymmetry is intentional and matches the spec

## REVIEW CLEAN

No findings at any severity. Phase 44 is clean and ready to ship as-is.

---

_Reviewed: 2026-04-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
