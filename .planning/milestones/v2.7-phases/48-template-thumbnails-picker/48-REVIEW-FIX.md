---
phase: 48
fixed_at: 2026-04-29T21:55:00Z
review_path: .planning/phases/48-template-thumbnails-picker/48-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 48: Code Review Fix Report

**Fixed at:** 2026-04-29T21:55:00Z
**Source review:** .planning/phases/48-template-thumbnails-picker/48-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 high, 1 medium, 2 low)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### HR-01: custom_texts divs missing display:flex — same Satori crash vector as hook/body

**Files modified:** `src/lib/render/render-slide-satori.tsx`
**Commit:** `8cad3b4`
**Applied fix:** Added `display: 'flex'` and `flexWrap: 'wrap'` to the custom_texts div style object immediately after `width: pxX(ct.width)`, matching the pattern already present on `hookStyle` (line 195) and `bodyStyle` (line 223). Prevents Satori from throwing "Children with multiple elements must use display:flex" when a custom text box has more than one TextSegment.

### MR-01: Picker test hardcodes count as bare integer — drifts silently from templates.length

**Files modified:** `src/__tests__/components/template-picker.test.tsx`
**Commit:** `af5e252`
**Applied fix:** Replaced `expect(previews.length).toBe(8)` with `expect(previews.length).toBe(templates.length)` in test 1, and `expect(previews.length).toBe(9)` with `expect(previews.length).toBe(templates.length + 1)` in test 2. The `import { templates }` was already present at line 4. The schema invariant assertion `expect(templates.length).toBe(8)` was preserved as a pinned guard.

### LR-01: Dead conditional in template name class — both branches identical

**Files modified:** `src/components/slides/template-picker.tsx`
**Commit:** `95ad4a4`
**Applied fix:** Replaced `className={\`block text-sm font-semibold ${isSelected ? 'text-[#3d0000]' : 'text-[#3d0000]'}\`}` with static `className="block text-sm font-semibold text-[#3d0000]"`. Chose Option A (collapse to static) to preserve current visual behavior without introducing unintended style changes.

### LR-02: template.id used in file path with no sanitization in thumbnail script

**Files modified:** `scripts/generate-template-thumbnails.ts`
**Commit:** `c1dedac`
**Applied fix:** Added a guard at the top of the `for...of` loop body that throws `Error("[thumbs] Unsafe template id '...' — must match [a-z0-9-]+")` if `template.id` does not match `/^[a-z0-9-]+$/`. The check runs before `makeSampleSlide` and before `template.id` is used as a path component, so any future out-of-spec ID aborts the script on the offending template rather than writing to an unexpected path.

---

**Test results (post-fix):**
`npx vitest run src/__tests__/render/ src/__tests__/components/template-picker.test.tsx`
- 7 test files, 33 tests — all passed, zero regressions.

**Build result:**
`npm run build` — compiled successfully, 38/38 static pages generated, no new errors (pre-existing lint warnings only, unrelated to these fixes).

---

_Fixed: 2026-04-29T21:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
