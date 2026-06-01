---
phase: 93-editor-mobile-layout-rework
verified: 2026-05-31
status: human_needed
requirements: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06]
also_gates: [FOUND-01, FOUND-02]
new_dependencies: 0
tsc: 20 errors (baseline, all *.test.ts(x); 0 new)
slide_tests: 121/121
editor_tests: 16 failures = pre-existing baseline (stash-verified; 0 new)
build: next build succeeds
---

# Phase 93 — Editor Mobile Layout Rework · VERIFICATION

**Status: `human_needed`.** All code-level gates pass (below). The user-facing
behavior (iOS keyboard summon, real touch tap-vs-drag, safe-area/dvh, keyboard
occlusion, sheet+keyboard coexistence) can ONLY be confirmed on the physical
iPhone 15 — Playwright cannot reproduce any of them. This is **THE single
consolidated on-device test that gates the whole editor track** (EDIT-01..06
PLUS the carried-forward FOUND-01/02 from Phase 91).

## Code-level checks (automated — PASS)
| Check | Result | Evidence |
|-------|--------|----------|
| `npx tsc --noEmit` no NEW errors | PASS | 20 errors, identical to baseline; all in `*.test.ts(x)`. |
| Slide render parity | PASS | `vitest run src/components/slides` → 121/121. |
| Editor suite no NEW failures | PASS | 16 failures = baseline (stash-compare: identical with changes stashed). |
| Production build | PASS | `next build` succeeds; `/project/[id]` editor route compiles. |
| Zero new dependencies | PASS | `package.json` unchanged; sheet built on existing `@radix-ui/react-dialog`. |
| Desktop render path unchanged | PASS | both asides `hidden lg:flex`, mobile chrome `lg:hidden`, grid untouched; desktop tabs/panels/portlet reuse the SAME extracted consts. |
| Focus call is gesture-synchronous | PASS (code) | `.focus()` is inside `onPointerUp` (slide-preview.tsx) not an effect — device confirms keyboard summon. |
| Drag threshold present | PASS | `TAP_THRESHOLD_PX=10` in `src/lib/editor/touch-edit.ts`. |
| Keyboard occlusion mitigations present | PASS | `scrollIntoView` on focus + `interactiveWidget:'resizes-visual'` in viewport export. |

---

# HUMAN VERIFICATION — physical iPhone 15, iOS Safari (THE COMBINED GATE)

> Open the app on the iPhone 15, sign in, open a carousel at `/project/[id]` so
> the editor shows the 9:16 canvas with at least one hook + body text element
> and 4+ slides. Use the REAL device — the simulator does not exercise the soft
> keyboard the same way.

## EDIT-01 · tap-to-edit-text (the folded gate — most important)
1. **Single-tap** the hook (headline) text.
   - **Expect:** the iOS keyboard slides up, a caret appears in the hook, you can type and see characters update on the canvas. (Selection ring also appears.)
   - **If the keyboard does NOT open:** the gesture-synchronous focus didn't land on this device — record it (likely react-rnd consuming the pointer; the `onPointerUp` fix is in `slide-preview.tsx`).
2. With the keyboard up, confirm the **edited field is visible ABOVE the keyboard** (not hidden behind it). Repeat for the **body** text and any **custom text positioned LOW on the canvas** (most occlusion-prone).
   - **If a low field is hidden behind the keyboard:** the `scrollIntoView` + `interactiveWidget:'resizes-visual'` didn't fully clear it — record which element + position.
3. **Single-finger drag** the hook a short distance and lift.
   - **Expect:** the box MOVES; it does NOT enter edit mode and the keyboard does NOT open (10px tap-vs-drag threshold).
4. Edit the hook, then tap empty canvas to blur. Switch slides and back.
   - **Expect:** the new text persists (no silent revert).
5. Double-tap the editable text.
   - **Expect:** NO page zoom (the `touch-action:manipulation` from Phase 92). Two-finger pinch-zoom elsewhere still works.

## EDIT-02 · canvas is dominant on a phone
6. Look at the editor at rest (no keyboard).
   - **Expect:** the 9:16 canvas fills most of the screen. The chrome is a slim top bar (back/title/⋯) + a thin slide filmstrip + a bottom action bar — NOT a stack of filmstrip+Layers+tabs+rail+bars squeezing the canvas.

## EDIT-03 · tool panels via bottom sheet
7. Tap **Text**, then **Elements**, then **Images** in the bottom area.
   - **Expect:** each opens a bottom sheet from the bottom edge hosting that tool panel (the same controls as desktop), `≤85%` of the screen height, scrollable inside, content clears the home indicator. Tapping the grab-handle area / X / backdrop dismisses back to the canvas.
8. In the **Text** sheet, focus a text input (e.g. rename / a value field).
   - **Expect:** the iOS keyboard appears and the focused field stays visible above it (sheet + keyboard coexist; the field is not hidden).

## EDIT-04 · filmstrip scroll/selection affordance
9. Look at the filmstrip; confirm the **"n / total" counter** and the **right edge-fade** when there are more slides than fit.
   - **Expect:** it is obvious more slides exist off the right edge; scroll the strip horizontally; tap a thumbnail selects that slide (canvas updates, ring on the selected thumb). No silently-hidden scroll.

## EDIT-05 · destructive delete safety
10. Open the **⋯ (layers)** sheet from the top bar. Find **"Delete this slide"** at the BOTTOM (full-width red), well away from add/duplicate/export.
    - Tap it → **Expect:** a confirmation dialog ("Delete this slide?") with Cancel / Delete. Cancel keeps the slide. Confirm removes it. After deleting, tap **Undo** in the bottom bar → the slide returns.
    - **Expect:** there is NO way to delete a slide with a single mis-tap adjacent to a primary action (add/export are in the separate bottom bar).

## EDIT-06 · persistent bottom action bar
11. Confirm the bottom action bar is **always visible** (add slide, undo, redo, Public toggle, Export) and **thumb-reachable**.
    - **Expect:** it sits above the iOS home indicator (safe-area padded — not under it). Tap **Export** → the format dialog opens. Tap the **Public** control → visibility toggles.

## CARRIED-FORWARD Phase-91 device checks (run in the same pass)

### FOUND-01 — safe-area / home-indicator clearance
12. Confirm the bottom action bar and (on a scrolling non-editor page) the bottom tab nav are **not obscured by or colliding** with the home indicator / Dynamic Island. `env(safe-area-inset-*)` padding visibly lifts them clear.
    - **Why human:** insets read `0` in Playwright; only a real device with `viewport-fit=cover` renders them.

### FOUND-02 — dvh / iOS URL-bar collapse (no cutoff)
13. Fresh-load the editor with the Safari address bar visible; confirm the bottom action bar is fully visible (not cut off behind the toolbar). Scroll to collapse the address bar; confirm the layout re-fills cleanly, nothing cut off, no jump.
    - **Why human:** Playwright's viewport is static; the iOS URL bar never collapses there.

---

## Outcome routing
- **All 13 pass →** EDIT-01..06 confirmed; FOUND-01/02 confirmed; tick all in ROADMAP/REQUIREMENTS as satisfied. The editor track is done; Phase 94 (app-wide polish) is independent and can proceed.
- **Step 1/2 fail (no keyboard / occluded) →** the gesture-synchronous focus or scroll-into-view needs device-specific iteration (react-rnd pointer-capture interaction). The layout (EDIT-02..06) still stands; only EDIT-01 reopens.
- **Step 3 fails (drag enters edit) →** raise `TAP_THRESHOLD_PX` above 10 in `src/lib/editor/touch-edit.ts`.
- **Step 8 fails (sheet hides field under keyboard) →** reduce `max-h-[85dvh]` or add a focus-driven scroll inside `SheetBody`.

*Verified (code/build): 2026-05-31 · Verifier: Claude (subagent) · Gate: physical iPhone 15 (single combined editor-track pass)*
</content>
