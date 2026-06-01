---
phase: 93-editor-mobile-layout-rework
milestone: v2.17
branch: feat/carousel-output-format
requirements: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06]
new_dependencies: 0
baseline_tsc: 20 errors (all *.test.ts(x))
baseline_slide_tests: 121/121
device_gate: true
---

# Phase 93 — Editor Mobile Layout Rework · PLAN

Atomic commit per requirement. Re-host, don't rewrite. Gate every change behind mobile breakpoints.

<task id="93-T1" requirement="EDIT-01" commit="fix(editor): gesture-synchronous single-tap-to-edit text on touch + keyboard occlusion handling">
  <read_first>
    - src/components/slides/slide-preview.tsx (hook :2330-2501, body :2660-2820, custom-text :3090-3180; focus effect :1107-1129; rAF focus :3127; edit state :718/:724)
    - src/app/layout.tsx (viewport export :24)
    - .planning/phases/92-editor-touch-edit-validation-gate/92-SUMMARY.md (diagnosis #2,#3,#4)
  </read_first>
  <implement>
    - NEW helper src/lib/editor/touch-edit.ts: focusEditableSynchronously(host, onScrollIntoView) — finds the [contenteditable] child (or the host), sets contentEditable=true imperatively, .focus(), places caret at end, scrollIntoView({block:'center'}). Plus a tap-vs-drag tracker (pointerdown coords, TAP_THRESHOLD_PX=10).
    - Wire a touch-only onPointerDown/onPointerUp on the 3 editable wrappers (hook, body, custom-text). On pointerType==='touch' tap (<10px move): setEditing*Id(id) AND synchronously focus the inner editable in the SAME gesture. On move>=10px: do nothing (react-rnd drags).
    - Keep the existing useEffect/rAF focus as a desktop/fallback path (mouse double-click still routes through setState→effect).
    - layout.tsx viewport: add interactiveWidth/interactiveWidget:'resizes-visual'.
  </implement>
  <acceptance_criteria>
    - On touch, a single tap on hook/body/custom-text enters edit mode with focus fired inside the gesture (verifiable: focus call is in the pointerup handler, not an effect).
    - A >=10px drag still moves the element (react-rnd path), no edit.
    - scrollIntoView called on focus; viewport exports interactiveWidget.
    - Desktop mouse double-click-to-edit path unchanged.
  </acceptance_criteria>
  <must_haves>
    - Page pinch-zoom preserved (no user-scalable=no).
    - tsc no new errors; slide tests 121/121.
    - Touch path gated on pointerType==='touch' so desktop is byte-identical.
  </must_haves>
</task>

<task id="93-T2" requirement="EDIT-03" commit="feat(ui): bottom Sheet primitive on @radix-ui/react-dialog">
  <read_first>
    - src/components/ui/dialog.tsx (mirror structure)
    - .planning/research/ARCHITECTURE.md Q5
  </read_first>
  <implement>
    - NEW src/components/ui/sheet.tsx: Sheet/SheetTrigger/SheetClose/SheetContent (side=bottom, rounded-t-2xl, max-h-[85dvh], pb-[max(1rem,env(safe-area-inset-bottom))], slide-up anim, grab-handle pill, 44px close)/SheetHeader/SheetTitle/SheetDescription. Modal by default.
  </implement>
  <acceptance_criteria>
    - Built on @radix-ui/react-dialog (no new dep).
    - Bottom-anchored, safe-area padded, max-h-[85dvh].
  </acceptance_criteria>
  <must_haves>
    - tsc clean; mirrors dialog.tsx conventions.
  </must_haves>
</task>

<task id="93-T3" requirement="EDIT-02,EDIT-03,EDIT-04,EDIT-06" commit="feat(editor): canvas-first mobile layout — filmstrip strip, tool sheet, bottom action bar">
  <read_first>
    - src/components/editor/slide-editor.tsx (render :1497-2092; state :152-153; requestPanelFocus :210)
    - src/components/editor/slide-list.tsx
  </read_first>
  <implement>
    - useMediaQuery('(min-width:1024px)') → isDesktop. Desktop render path unchanged.
    - Mobile branch (below lg): slim top bar (back/title/saved + layers toggle); SlideCanvas flex-1 dominant; thin filmstrip (SlideList) with edge-fade + counter; tab buttons open the Sheet hosting TextEditorPanel/ElementsPanel/ImagePickerPanel (reused); persistent bottom action bar (add/undo/redo/Public/Export) safe-area padded.
    - LayersPanel demoted to on-demand sheet on mobile.
    - SlideList: add mobile filmstrip affordance (edge-fade mask) without breaking desktop vertical list.
  </implement>
  <acceptance_criteria>
    - EDIT-02: canvas dominant on mobile (flex-1, siblings collapsed).
    - EDIT-03: Text/Elements/Images reachable via bottom sheet reusing existing panels.
    - EDIT-04: filmstrip has visible scroll/selection affordance + counter.
    - EDIT-06: Export/add/undo/redo/Public in persistent safe-area bottom bar.
    - Desktop lg: layout byte-identical.
  </acceptance_criteria>
  <must_haves>
    - Panels re-hosted, not rebuilt (same props).
    - tsc no new errors; slide tests 121/121.
  </must_haves>
</task>

<task id="93-T4" requirement="EDIT-05" commit="fix(editor): confirm destructive slide delete + space away from primary targets">
  <read_first>
    - src/components/editor/slide-editor.tsx (REMOVE_SLIDE :1553; mobile bar from T3)
  </read_first>
  <implement>
    - Mobile delete-slide routes through a confirm dialog (reuse Dialog) before REMOVE_SLIDE.
    - Place delete in the Layers/overflow sheet, NOT adjacent to add/export primaries in the bottom bar.
    - Surface undo prominently in the bottom bar (already present) — mis-tap is reversible.
  </implement>
  <acceptance_criteria>
    - Deleting a slide on mobile requires confirmation.
    - Delete control physically separated (>=44px gap, different surface) from add/export.
  </acceptance_criteria>
  <must_haves>
    - Desktop delete behavior unchanged (or also gains confirm without regression).
    - tsc/tests green.
  </must_haves>
</task>

## Verification
- `npx tsc --noEmit` → no new errors vs 20 baseline.
- `npx vitest run src/components/slides` → 121/121.
- Self code-review pass.
- VERIFICATION status `human_needed` — consolidated iPhone checklist (EDIT-01..06 + FOUND-01/02).
</content>
