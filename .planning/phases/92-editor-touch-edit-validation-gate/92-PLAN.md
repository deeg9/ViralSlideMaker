---
plan_id: 92-1
phase: 92
title: Editor touch text-edit validation gate — diagnose, conservative repair, device checklist
wave: 1
depends_on: []
files_modified:
  - src/components/slides/slide-preview.tsx
requirements:
  - EDIT-01
autonomous: true
gate: true
device_validation_required: true
---

# Plan 92-1 — Editor Touch-Edit Validation Gate

**Goal:** Statically diagnose the tap-to-edit-text touch path for iOS-correctness with file:line
evidence, apply only clear-cut conservative iOS-correctness repairs (no editor restructuring,
zero new deps), and produce the on-device test checklist that is the actual EDIT-01 gate. This is
verify-and-repair, not construction. The keyboard/gesture-origin behaviors can only be signed off
on a physical iPhone 15.

**Requirement covered:** EDIT-01 (GATE) — code-ready, awaiting device sign-off (NOT fully complete here).

---

<task id="92-1-1" type="diagnose">
<title>Trace the tap → select → edit → focus → type → persist touch path</title>
<read_first>
- src/components/slides/slide-preview.tsx (selection on onMouseDown ~L2330/2726/3036; edit-entry on onDoubleClick ~L2389/2729/3154; edit-state setEditingHookBodyId/setEditingCustomTextId; focus effect L1107-1129; rAF focus L3113-3118; contentEditable surfaces L2470/2792/3155; onBlur commit L2478/2800/3157)
- src/components/editor/slide-editor.tsx (onTextBoxSelect L1629 → requestPanelFocus('text') L1635; onTextBoxTextEdit L1644 → UPDATE_TEXT_BOX dispatch; requestPanelFocus L210-224)
- src/components/editor/slide-canvas.tsx (canvas host — no touch-action)
- .planning/research/PITFALLS.md Pitfall 3 (focus synchrony), 4 (keyboard occlusion), 9 (gestures)
</read_first>
<action>
Determine, with file:line evidence, the verdict for each of the 5 gate checks: (1) selection-on-tap
mirrors into the rail; (2) `.focus()` synchrony inside the gesture (THE critical iOS check);
(3) tap-vs-drag disambiguation + whether react-rnd/marquee swallow the tap; (4) keyboard-occlusion
scroll-into-view; (5) persistence on blur. Record findings in 92-SUMMARY.md / 92-VERIFICATION.md.
</action>
<acceptance_criteria>
- Each of the 5 checks has a file:line-backed verdict (iOS-correct vs likely-broken).
- The critical focus-synchrony finding is explicit: edit-entry is onDoubleClick → setState → focus
  deferred to a useEffect (hook/body, L1107-1129) or requestAnimationFrame (custom-text, L3117),
  i.e. focus is NOT synchronous in the gesture (iOS keyboard-summon risk).
- Tap-vs-drag finding is explicit: react-rnd owns the pointer until `disableDragging` flips
  (only true once `hookEditing`, L2082); no movement-threshold; no touch-action on the drag surface.
</acceptance_criteria>
<must_haves>
- file:line evidence for all 5 checks
- explicit identification of the deferred-focus iOS break and the trigger (onDoubleClick)
</must_haves>
</task>

<task id="92-1-2" type="execute">
<title>Apply the one clear-cut conservative repair: touch-action:manipulation on editable wrappers</title>
<read_first>
- src/components/slides/slide-preview.tsx hook wrapper (~L2427), body wrapper (~L2756), custom-text wrapper (~L3120) — the inner div carrying `cursor: editing ? 'text' : 'grab'`
- .planning/research/PITFALLS.md Pitfall 9 (touch-action:manipulation kills 300ms delay + double-tap-zoom while keeping page pinch-zoom — WCAG-safe)
</read_first>
<action>
Add `touchAction: 'manipulation'` to the inline style of each of the three editable text wrapper divs
(hook / body / custom-text). This is the exact mitigation for the iOS double-tap-zoom + 300ms tap delay
that fights the double-tap-to-edit gesture. Do NOT change the edit-entry trigger, the focus deferral,
the react-rnd config, or any other interaction. Do NOT add touch-action:none to the drag surface
(that is Phase 93's gesture pass — out of scope here). Zero new dependencies.
</action>
<acceptance_criteria>
- 3× `touchAction: 'manipulation'` present in slide-preview.tsx (hook, body, custom-text wrappers)
- No change to onDoubleClick handlers, edit-state setters, the focus effect, or the rAF focus
- No new dependency; `npx tsc --noEmit` stays at the 20-error test-file baseline (0 new errors)
</acceptance_criteria>
<must_haves>
- conservative: page pinch-zoom preserved (manipulation, not none/no-zoom)
- no editor restructuring
- tsc baseline-clean
</must_haves>
</task>

<task id="92-1-3" type="execute">
<title>Produce the on-device EDIT-01 test checklist (the actual gate) + fold in deferred Phase-91 checks</title>
<read_first>
- ROADMAP Phase 92 success criteria (3); .planning/phases/91*/91-VERIFICATION.md human-verification section (FOUND-01, FOUND-02)
</read_first>
<action>
Write the tap-by-tap on-device checklist into 92-VERIFICATION.md (status: human_needed). Cover the 3
EDIT-01 success criteria as concrete actions with expected results, plus the two carried Phase-91
device checks (FOUND-01 safe-area clearance, FOUND-02 dvh/URL-bar collapse). This checklist gates the
whole editor track.
</action>
<acceptance_criteria>
- 92-VERIFICATION.md status: human_needed
- checklist covers all 3 EDIT-01 criteria + FOUND-01 + FOUND-02 as tap-by-tap steps with expected results
- ROADMAP/REQUIREMENTS EDIT-01 marked "code-ready, awaiting device sign-off" (NOT fully complete)
</acceptance_criteria>
<must_haves>
- human_needed status
- device checklist is self-contained and actionable on a physical iPhone 15
</must_haves>
</task>
