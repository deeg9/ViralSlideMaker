# Phase 92 — Editor Touch-Edit Validation Gate · CONTEXT

**Milestone:** v2.17 Mobile Optimization
**Requirement:** EDIT-01 (GATE)
**Branch:** `feat/carousel-output-format`
**Type:** VERIFY-AND-REPAIR GATE — not a construction phase.
**Date:** 2026-05-31

## Phase boundary

**In scope:**
- Static-diagnose the tap→select→edit→keyboard→type→blur/persist touch path for iOS-correctness, with file:line evidence.
- Apply ONLY clear-cut, conservative, zero-dependency iOS-correctness repairs that do not restructure the editor.
- Produce the on-device test checklist (the actual gate — EDIT-01 can only pass on a physical iPhone).
- Carry forward the two deferred Phase-91 device checks (FOUND-01 safe-area, FOUND-02 dvh) into the same device pass.

**Out of scope (deferred to Phase 93):**
- Bottom-sheet primitive, chrome-collapse, canvas-dominant re-host.
- Changing the edit-entry interaction model (e.g. double-tap → single-tap-when-selected), keeping `contentEditable` always-mounted, or any tap-state-machine — these are restructuring and are explicitly Phase 93 / EDIT-02/03 territory.
- `interactiveWidget: 'resizes-visual'` (keyboard-occlusion layout fix) — deferred to Phase 93 per Phase-91 plan note.

## Key decisions

1. **The flow is NOT iOS-correct, but the full repair is restructuring → gate it on device, don't half-fix.** The edit-entry path (`onDoubleClick` → `setState` → focus deferred to a `useEffect`/`requestAnimationFrame`) violates iOS's "focus must be synchronous inside the user gesture" rule. The correct repair (always-mounted contentEditable or a synchronous tap-state-machine) is exactly the "MEDIUM-HIGH, may require reworking event ordering with react-rnd" case the research flags, and would restructure the editor. Per the conservative mandate, we do NOT ship a speculative half-fix that won't actually summon the keyboard; we document the precise required repair and let the device test decide whether iOS 17+ already tolerates the deferred focus.

2. **One genuinely-safe repair IS applied: `touch-action: manipulation` on the 3 editable text wrappers (hook/body/custom-text).** This is the exact Pitfall-9 mitigation for the iOS 300ms tap delay + double-tap-to-zoom that directly fights the double-tap-to-edit gesture. It is clearly-correct, zero-dependency, non-restructuring, reversible, and preserves page pinch-zoom (WCAG). It measurably improves the chance the double-tap registers as edit rather than zoom — without touching the interaction model or the focus deferral.

3. **VERIFICATION status = `human_needed` by definition.** EDIT-01 is a real-device gate; Playwright cannot summon the iOS soft keyboard, reproduce the gesture-origin focus rule, or render keyboard occlusion. ROADMAP/REQUIREMENTS tick EDIT-01 only as "code-ready, awaiting device sign-off" — NOT fully complete.

## Evidence base (read directly)
- `src/components/slides/slide-preview.tsx` — the canvas + editable text elements (hook/body/custom-text `<Rnd>` wrappers, contentEditable surfaces, edit-state, focus effect).
- `src/components/editor/slide-editor.tsx` — `onTextBoxSelect`/`onTextBoxTextEdit`/`requestPanelFocus` wiring.
- `src/components/editor/slide-canvas.tsx` — canvas host (no touch-action).
- `.planning/research/PITFALLS.md` Pitfall 3/4/9; `.planning/research/ARCHITECTURE.md` Q2.
