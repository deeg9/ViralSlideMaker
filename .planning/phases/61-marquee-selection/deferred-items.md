# Phase 61 — Deferred Items

Out-of-scope discoveries logged during plan execution. Each item lists the
discovering plan, the file/area, what was found, and which downstream plan
should pick it up.

## Plan 61-01

**61-01.D-1 — Stale repo-root PNGs unrelated to Phase 61**
- Discovered: 2026-05-02 during 61-01 self-check (`git status --short`)
- Files: `dashboard-after.png`, `dashboard-hover.png`, `dashboard-lazy.png`,
  `dashboard-slide2.png`, `editor-list-toolbar.png`, `editor-numbered-fixed.png`,
  `editor-numbered-list.png`
- Issue: Untracked PNGs at repo root predate Phase 61 (visible in pre-existing
  `4ed5454 PNGs and TypeScript files` commit context). Likely manual screenshots
  used during prior debugging.
- Owner: housekeeping pass (out of scope for marquee phase). Either commit to a
  `screenshots/` folder or add to `.gitignore` if they're scratch artifacts.

**61-01.D-2 — TextBox height resolution still DOM-dependent**
- Discovered: Plan 61-01 (Task 2 module header)
- File: `src/lib/editor/transforms/element-rect-intersect.ts`
- Issue: `elementsInRect` uses a 1-px-strip approximation (h=1) for TextBoxes
  with anchor='custom' because the schema does not carry an explicit height —
  it's text-driven via DOM ref (same constraint Plan 60-05 selection-bounds.ts
  faces with `height=0`).
- Owner: Phase 63 alignment. When Phase 63 introduces a shared height resolver
  (rendered-height observer at slide-preview.tsx:589-637), both this helper and
  selection-bounds.ts should consume it. Until then, the 1-px-strip is
  conservative — false negatives only when the marquee misses the strip but
  would have hit the rendered text box body. Acceptable for Phase 61 because
  most realistic marquee drags span larger areas than the strip's miss zone.
