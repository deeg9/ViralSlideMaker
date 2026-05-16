---
phase: quick-260515-nhf
plan: 01
subsystem: ui
tags: [render, slide-template, typography, tplrend-05, satori, parity]

requires:
  - phase: quick-260515-epn
    provides: resolvePerSlideTemplate single-source-of-truth in all render paths
provides:
  - resolveHookTypography shared resolver (hook casing / font-family / italic precedence)
  - text_transform field on TextBox + hook_text_transform on SlideStyleOverrides
  - hook Uppercase toggle in the editor inspector (ActiveTextBoxCard)
  - Satori PNG export now honors per-TextBox hook font family (export-parity bug fix)
affects: [style-from-reference projector, future template-typography work]

tech-stack:
  added: []
  patterns:
    - "Shared per-axis typography resolver in resolve-overlay.ts (mirrors resolveCaptionBar / alignToJustifyContent precedent)"
    - "No-override branch returns template values verbatim → TPLREND-05 byte-identity by construction"

key-files:
  created:
    - src/lib/render/__tests__/resolve-hook-typography.test.ts
    - src/lib/render/__tests__/hook-typography-render-parity.test.tsx
  modified:
    - src/lib/types/slide.ts
    - src/lib/render/resolve-overlay.ts
    - src/lib/editor/text-box-adapter.ts
    - src/components/slides/slide-preview.tsx
    - src/lib/render/render-slide-satori.tsx
    - src/lib/render/render-slide.ts
    - src/components/editor/text-rail/ActiveTextBoxCard.tsx
    - src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx

key-decisions:
  - "Hook font SIZE deliberately excluded from resolveHookTypography (entangled with hook-fit clamp; size already resolves correctly)"
  - "render-slide.ts HTML path emits an explicit hook font-family ONLY on user override, so legacy slides keep inheriting template.fontFamily (byte-identity)"
  - "Satori/slide-preview emit textTransform only when 'uppercase' (never 'none') to avoid changing serialized output for legacy slides"
  - "124 pre-existing parity.* stale snapshots (from quick-260514-l9q) are out of scope — logged to deferred-items.md, NOT regenerated"

patterns-established:
  - "resolveHookTypography: explicit override > per-TextBox field > template default precedence; closed-union text_transform degrades malformed payloads to template default (threat T-nhf-01)"

requirements-completed: [BUGFIX-NHF-01]

duration: 18min
completed: 2026-05-15
---

# Phase quick-260515-nhf: Fix Text Box Forced All-Caps + Font-Size Mismatch Summary

**Added a shared `resolveHookTypography` resolver + `text_transform` data-model field so users can escape a template's hardcoded ALL CAPS, and fixed the Satori PNG export silently reverting user hook fonts — all three render paths now agree (TPLREND-05).**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-15T17:02:00Z
- **Completed:** 2026-05-15T17:14:00Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 8 (6 modified, 2 test files created)

## Accomplishments

- New `resolveHookTypography` helper in `resolve-overlay.ts` — the single source of truth for hook casing / font-family / italic-style precedence, mirroring the existing `resolveCaptionBar` / `alignToJustifyContent` shared-resolver pattern.
- New `text_transform` field on `TextBox` and `hook_text_transform` on `SlideStyleOverrides`, dual-written both directions by `text-box-adapter.ts`.
- All three render paths (editor preview `slide-preview.tsx`, Satori PNG export `render-slide-satori.tsx`, HTML export `render-slide.ts`) now resolve hook casing/font through the shared helper.
- **Export-parity bug fixed:** the Satori PNG export previously hardcoded `template.headingFontFamily ?? template.fontFamily` and ignored `overrides.hook_font_family` — a user's hook-font pick survived on the editor canvas but reverted in the exported PNG. Now both agree.
- New hook-only "Uppercase" toggle in the editor inspector (`ActiveTextBoxCard`) — lets the user un-cap a template-locked ALL CAPS hook (the originally-reported bug: the user genuinely had no escape hatch).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Add text_transform to data model + dual-write + shared resolveHookTypography helper**
   - `510945c` (test) — RED: failing tests + data-model fields
   - `f9e3a80` (feat) — GREEN: resolveHookTypography helper + adapter dual-write
2. **Task 2: Route all three render paths + the inspector through resolveHookTypography**
   - `b2309d4` (feat) — wiring of slide-preview / Satori / HTML + ActiveTextBoxCard Uppercase toggle + parity/toggle tests

_Plan metadata (SUMMARY/STATE) committed separately by the orchestrator._

## Files Created/Modified

- `src/lib/types/slide.ts` — added `TextBox.text_transform` + `SlideStyleOverrides.hook_text_transform` (both closed union `'uppercase' | 'none'`)
- `src/lib/render/resolve-overlay.ts` — new `resolveHookTypography` resolver + `ResolvedHookTypography` interface
- `src/lib/editor/text-box-adapter.ts` — dual-write `hookBox.text_transform` ⇄ `overrides.hook_text_transform`
- `src/components/slides/slide-preview.tsx` — hook `textTransform`/`fontFamily`/italic-fallback now from the helper
- `src/lib/render/render-slide-satori.tsx` — hook `fontFamily` honors `overrides.hook_font_family`; casing/style from the helper
- `src/lib/render/render-slide.ts` — hook `text-transform`/`font-style` from the helper; explicit `font-family` emitted only on user override
- `src/components/editor/text-rail/ActiveTextBoxCard.tsx` — new hook-only Uppercase toggle (`data-testid="active-text-box-uppercase"`)
- `src/lib/render/__tests__/resolve-hook-typography.test.ts` — 11 unit tests (precedence + byte-identity + adapter round-trip)
- `src/lib/render/__tests__/hook-typography-render-parity.test.tsx` — 7 render-path parity tests (Satori + HTML honor overrides; legacy byte-identity)
- `src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx` — 6 new Uppercase-toggle tests

## Decisions Made

- **Hook font SIZE excluded from the helper** — per the plan, size already resolves correctly via `overrides.hook_font_size ?? ...` and is entangled with the hook-fit auto-shrink clamp; folding it in risked that interaction. The helper owns casing + family + italic-style only.
- **render-slide.ts (HTML path) emits an explicit hook `font-family` ONLY when the user actually overrode it.** This is a byte-identity refinement of the plan's action step 3: today the `.hook` CSS rule has no `font-family` and inherits `template.fontFamily` from `<body>`. Seven templates declare a `headingFontFamily` that the HTML path historically never used for the hook. Emitting `helper.fontFamily` unconditionally would have changed legacy output for those 7 templates. Emitting it conditionally preserves exact legacy behavior (confirmed: `templates.test.ts` paper-essay test, which explicitly documents "headingFontFamily is only emitted via the text_boxes renderer path; this path inherits template.fontFamily", still passes).
- **`textTransform` is set only when `'uppercase'`** in slide-preview + Satori — emitting `textTransform: 'none'` where today nothing is emitted would change the serialized DOM/SVG for legacy slides.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Byte-identity correctness] render-slide.ts hook font-family made conditional**
- **Found during:** Task 2 (render-slide.ts wiring)
- **Issue:** The plan's action step 3 said to "emit an explicit `font-family` on the hook div" from the helper. But the legacy HTML hook inherits `template.fontFamily` (NOT `headingFontFamily`), and 7 templates declare a `headingFontFamily`. Emitting `helper.fontFamily` (which is `headingFontFamily ?? fontFamily`) unconditionally would have silently changed the exported HTML for every legacy slide on those 7 templates — a TPLREND-05 violation.
- **Fix:** Emit the explicit hook `font-family` ONLY when `overrides.hook_font_family` is set. No-override slides keep emitting no hook `font-family` and inherit `template.fontFamily` exactly as before.
- **Files modified:** `src/lib/render/render-slide.ts`
- **Verification:** `templates.test.ts` (which pins this exact paper-essay legacy behavior) + `render-slide.test.ts` both pass; new `hook-typography-render-parity.test.tsx` asserts the no-override `.hook` rule has no `font-family`.
- **Committed in:** `b2309d4`

---

**Total deviations:** 1 auto-fixed (Rule 1 — byte-identity correctness).
**Impact on plan:** The deviation strengthens the plan's own TPLREND-05 invariant; the plan's intent ("legacy slides byte-identical") is honored more precisely. No scope creep.

## Issues Encountered

- **124 pre-existing `parity.*` stale snapshots.** The Task 2 verify run surfaced 124 failing snapshots across 3 files (`parity.template-fingerprint.test.tsx`, `parity.template-fingerprint-decorations-undefined.test.tsx`, `parity.style-spec-absent-baseline.test.tsx`). Diagnosis: these snapshots predate quick task `260514-l9q` (commit `de338e2`), which added `justify-content` to the Satori hook/body styles but never regenerated these snapshots. **Proven pre-existing and NOT caused by this task:** running the identical test set with the nhf changes `git stash`ed produces the exact same 124-failed / 496-passed result — the nhf hook-typography rewiring introduces ZERO new snapshot divergence. That 124→124 invariant is itself the TPLREND-05 byte-identity proof for legacy no-override slides. Per the SCOPE BOUNDARY rule, these out-of-scope failures were logged to `deferred-items.md` and NOT regenerated (regenerating would conflate the l9q `justify-content` diff with this task's history). Recommended follow-up quick task documented in `deferred-items.md`.

## Verification Results

- `resolve-hook-typography.test.ts` — 11/11 pass (precedence, byte-identity, threat T-nhf-01, adapter round-trip)
- `hook-typography-render-parity.test.tsx` — 7/7 pass (Satori + HTML honor `hook_font_family`/`hook_text_transform`; legacy byte-identity)
- `ActiveTextBoxCard.test.tsx` — 28/28 pass (22 existing + 6 new Uppercase-toggle)
- `src/lib/editor` (text-box-adapter) — 583/583 pass (dual-write regression-free)
- `src/__tests__/render` HTML render — 12/12 pass (legacy hook byte-identity)
- `npx tsc --noEmit` — 19 errors (baseline preserved, zero new)
- `eslint` on all modified files — 0 errors (warnings all pre-existing)

## Known Stubs

None. The Uppercase toggle is fully wired (`onUpdate` → `UPDATE_TEXT_BOX` dual-write → all three render paths).

## Threat Flags

None. The plan's `<threat_model>` (T-nhf-01 tampering, T-nhf-02 DoS) is fully mitigated: `text_transform` is the closed union `'uppercase' | 'none'`; `resolveHookTypography` falls through to the template default for any other value (no `eval`, no dynamic CSS) — verified by the "malformed text_transform" test case.

## Self-Check: PASSED

- Created files verified present: `resolve-hook-typography.test.ts`, `hook-typography-render-parity.test.tsx`, `resolveHookTypography` exported (1 match in `resolve-overlay.ts`).
- Commits verified in `git log`: `510945c`, `f9e3a80`, `b2309d4`.

## Next Phase Readiness

- The hook-typography resolution gap is closed. Editor canvas, Satori PNG export, and HTML render now agree on hook casing + font family for every slide; the user can toggle ALL CAPS off from the inspector.
- Follow-up (non-blocking): regenerate the 124 pre-existing `parity.*` stale snapshots from quick-260514-l9q — see `deferred-items.md`.

---
*Phase: quick-260515-nhf*
*Completed: 2026-05-15*
