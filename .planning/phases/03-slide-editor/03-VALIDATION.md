---
phase: 03
slug: slide-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (exists, jsdom environment) |
| **Quick run command** | `npx vitest run src/__tests__/editor/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/editor/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | EDIT-01 | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "ADD_SLIDE"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | EDIT-02 | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "REMOVE_SLIDE"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | EDIT-03 | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "REORDER"` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | EDIT-04 | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "DUPLICATE"` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | EDIT-05 | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "UPDATE_SLIDE"` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 1 | EDIT-06 | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "style"` | ❌ W0 | ⬜ pending |
| 03-01-07 | 01 | 1 | EDIT-09 | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "UNDO"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | EDIT-07 | unit | `npx vitest run src/__tests__/editor/image-search.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | EDIT-08 | unit | `npx vitest run src/__tests__/editor/upload.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | AIGEN-04 | unit | `npx vitest run src/__tests__/editor/regenerate.test.ts -t "text"` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | AIGEN-05 | unit | `npx vitest run src/__tests__/editor/regenerate.test.ts -t "image"` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | EDIT-10 | integration | `npx vitest run src/__tests__/editor/slide-preview.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | UIUX-02 | integration | `npx vitest run src/__tests__/editor/responsive.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/editor/reducer.test.ts` — covers EDIT-01 through EDIT-06, EDIT-09
- [ ] `src/__tests__/editor/image-search.test.ts` — covers EDIT-07
- [ ] `src/__tests__/editor/upload.test.ts` — covers EDIT-08
- [ ] `src/__tests__/editor/regenerate.test.ts` — covers AIGEN-04, AIGEN-05
- [ ] `src/__tests__/editor/slide-preview.test.tsx` — covers EDIT-10
- [ ] `src/__tests__/editor/responsive.test.tsx` — covers UIUX-02
- [ ] Framework install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [ ] Supabase Storage bucket `slide-backgrounds` creation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop UX feel | EDIT-03 | Requires mouse interaction | Drag slides in editor, verify smooth reorder |
| Text position visual accuracy | EDIT-06 | Visual inspection | Edit text position, verify overlay placement |
| Image upload end-to-end | EDIT-08 | Requires real Supabase Storage | Upload image, verify it appears as slide background |
| Responsive layout on tablet | UIUX-02 | Requires viewport testing | Resize to tablet width, verify usable layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
