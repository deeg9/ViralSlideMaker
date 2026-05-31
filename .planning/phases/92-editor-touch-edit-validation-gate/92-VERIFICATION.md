---
phase: 92-editor-touch-edit-validation-gate
verified: 2026-05-31
status: human_needed
requirement: EDIT-01
gate: true
score: diagnosis complete; 1 conservative repair applied; EDIT-01 can ONLY pass on a physical iPhone 15
must_have_pass_count: n/a (device gate)
new_dependencies: 0
tsc: 20 errors (baseline, all in *.test.ts(x); 0 new)
---

# Phase 92 — Editor Touch-Edit Validation Gate · VERIFICATION

**Status: `human_needed`.** EDIT-01 is a real-device gate. Playwright cannot summon the iOS soft
keyboard, cannot reproduce iOS's "focus must be synchronous in the user gesture" rule, and cannot render
keyboard occlusion or safe-area insets. The diagnosis and the one conservative repair are code-complete;
the gate itself is the physical-iPhone checklist below.

## Code-level checks (automated — PASS)
| Check | Result | Evidence |
|-------|--------|----------|
| `npx tsc --noEmit` no NEW errors | PASS | 20 errors, identical to baseline; all in `*.test.ts(x)`. |
| Repair present (3× editable wrappers) | PASS | `grep -c "touchAction: 'manipulation'" slide-preview.tsx` → 3 (hook/body/custom-text). |
| Page pinch-zoom preserved (WCAG) | PASS | `manipulation` (not `none`/`user-scalable=no`); no viewport zoom-disable introduced. |
| No editor restructuring | PASS | Only inline-style additions; no change to triggers, edit-state, focus effect, or react-rnd config. |
| Zero new dependencies | PASS | `package.json` unchanged. |

## Diagnosis verdict (carried from 92-SUMMARY)
- #1 Selection-on-tap: likely OK but mouse-era (`onMouseDown`) — **device-confirm**.
- #2 Focus synchrony: **likely BROKEN** — focus deferred behind setState→useEffect (`:1107-1129`) / rAF (`:3117`), outside the gesture. iOS may refuse the keyboard. **THE critical device check.**
- #3 Tap-vs-drag: weak — react-rnd owns the pointer pre-edit, no movement threshold — **device-confirm**.
- #4 Keyboard occlusion: **BROKEN/none** — no `scrollIntoView`/`visualViewport` in a `fixed inset-0` shell — **device-confirm**.
- #5 Persistence on blur: OK (commit-on-blur → `UPDATE_TEXT_BOX`).

---

# HUMAN VERIFICATION — physical iPhone 15, iOS Safari (THE GATE)

> Open the app on the iPhone 15, sign in, open a carousel with slides at `/project/[id]` so the editor
> (`SlideEditor`) is showing the 9:16 canvas with at least one hook + body text element. Do NOT use the
> simulator screenshots — these require the real soft keyboard.

## EDIT-01 · Criterion 1 — tap a text element selects it and mirrors into the rail
1. **Single-tap** the hook (headline) text on the slide.
   - **Expect:** a dashed selection ring appears around the text box, AND the right rail switches to the **Text** tab showing that text box's properties (ActiveTextBoxCard). If the rail is already on Text, the active-box card should reflect the tapped box.
2. Single-tap the body text.
   - **Expect:** selection ring moves to the body box; rail Text tab now reflects the body box.
3. Single-tap empty canvas (the photo background, away from any element).
   - **Expect:** selection clears (ring disappears).
   - **If selection does NOT mirror / ring doesn't appear:** report which element — this is the mouse-era `onMouseDown` select racing react-rnd on touch (diagnosis #1/#3).

## EDIT-01 · Criterion 2 — tapping (not dragging) opens the keyboard and lets you edit, keyboard NOT covering the field
4. **Double-tap** the hook text (the current edit-entry gesture).
   - **Expect (the decisive check):** the iOS on-screen keyboard slides up AND a text caret appears in the hook text. You can type and see characters appear in the headline on the canvas.
   - **If the keyboard does NOT appear** (text just selects, or the page zooms, or nothing happens): this is the deferred-`.focus()` iOS break (diagnosis #2) — record it; the Phase-93 fix is gesture-synchronous focus (see 92-SUMMARY "Repair deliberately NOT applied").
5. With the keyboard open, look at WHERE the hook field is.
   - **Expect:** the field being edited is visible ABOVE the keyboard.
   - **If the field is hidden behind the keyboard:** this is the occlusion gap (diagnosis #4) — record it; Phase-93 adds `scrollIntoView` + `interactiveWidget:'resizes-visual'`.
6. Repeat steps 4–5 for the **body** text, then for any **custom text** element if present (e.g. a kicker/label added via Elements). Note especially a text element positioned **low on the canvas** (most likely to be occluded).
7. Repeat the double-tap-to-edit test (step 4) and watch for **double-tap-to-zoom**: the page should NOT zoom when you double-tap the text.
   - **Expect:** no page zoom on double-tap of the editable text (this is what the `touch-action:manipulation` repair targets). Page pinch-zoom with two fingers should still work normally elsewhere.

## EDIT-01 · Criterion 3 — edits persist on blur; a short drag still moves (not edits)
8. While editing the hook (keyboard up), change the text, then **tap elsewhere** (empty canvas) to blur.
   - **Expect:** the new text is committed and stays (no silent revert to the old text). Switch slides and back — text still updated.
9. Single-finger **drag** the hook text a short distance and lift.
   - **Expect:** the box MOVES; it does NOT enter edit mode and the keyboard does NOT open.
   - **If a short drag opens the keyboard / a tap-to-edit triggers a drag instead:** report — this is the tap-vs-drag threshold gap (diagnosis #3); Phase-93 adds a movement threshold.
10. Drag the hook text near the **left screen edge** and downward from the top.
    - **Expect:** dragging does NOT trigger iOS back-swipe (navigate away, losing edits) or pull-to-refresh (reload). (Note any occurrence — Phase-93 gesture pass adds `touch-action:none` / `overscroll-contain`.)

---

# CARRIED-FORWARD DEFERRED PHASE-91 DEVICE CHECKS (run in the same pass)

## FOUND-01 — safe-area / home-indicator clearance
11. View the **bottom tab nav** on a scrolling (non-editor) page, then open the editor and view the **pinned Undo/Redo/Public/Export action portlet**.
    - **Expect:** neither bar is obscured by or colliding with the home indicator / notch / Dynamic Island; `env(safe-area-inset-*)` padding visibly lifts the bars clear.
    - **Why human:** insets always read `0` in Playwright/devtools; only a real iOS device with `viewport-fit=cover` renders them non-zero.

## FOUND-02 — dvh / iOS URL-bar collapse (no cutoff)
12. Open the editor with the Safari **address bar visible** (fresh load). Confirm the editor bottom region (Export/action bar) is fully visible — not cut off behind the toolbar. Then **scroll to collapse the address bar** and confirm the layout re-fills cleanly with no jump and nothing cut off.
    - **Expect:** no content cut off under the collapsing URL bar at any address-bar state; `100dvh` tracks the live viewport; fixed bars don't leap.
    - **Why human:** Playwright uses a static viewport; the iOS URL bar never collapses there.

---

## Outcome routing
- **All 12 pass →** EDIT-01 passes; tick EDIT-01 fully and FOUND-01/FOUND-02 confirmed; Phase 93 may build on the verified tap-to-edit.
- **Steps 4/5 fail (no keyboard / occluded) →** EDIT-01 fails the gate; Phase 93 must land the gesture-synchronous focus + scroll-into-view + `interactiveWidget` fix BEFORE the bottom-sheet TEXT tab is meaningful (the sheet's TEXT panel is worthless if on-canvas edit can't summon the keyboard).
- **Steps 1–3 / 9 fail →** selection or tap-vs-drag repair folds into the Phase-93 editor rework.

*Verified (code/diagnosis): 2026-05-31 · Verifier: Claude (subagent) · Gate: physical iPhone 15*
