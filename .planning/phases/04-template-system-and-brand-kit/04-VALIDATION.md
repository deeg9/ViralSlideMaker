---
phase: 04
slug: template-system-and-brand-kit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 12 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TMPL-03 | unit | `npx vitest run src/__tests__/editor/template-switch.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | TMPL-04 | unit | `npx vitest run src/__tests__/brand-kit/crud.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | TMPL-04 | unit | `npx vitest run src/__tests__/brand-kit/form.test.tsx` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | TMPL-05 | unit | `npx vitest run src/__tests__/brand-kit/merge.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | TMPL-05 | unit | `npx vitest run src/__tests__/brand-kit/generation.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/editor/template-switch.test.ts` — covers TMPL-03
- [ ] `src/__tests__/brand-kit/crud.test.ts` — covers TMPL-04 server actions
- [ ] `src/__tests__/brand-kit/form.test.tsx` — covers TMPL-04 UI
- [ ] `src/__tests__/brand-kit/merge.test.ts` — covers TMPL-05 merge logic
- [ ] `src/__tests__/brand-kit/generation.test.ts` — covers TMPL-05 auto-apply

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Template visual switch | TMPL-03 | Visual inspection | Switch template in editor, verify slide style changes |
| Brand kit logo display | TMPL-04 | Visual inspection | Upload logo, verify it appears on slides |
| Brand kit auto-apply on new gen | TMPL-05 | End-to-end flow | Save brand kit, generate new carousel, verify brand colors/fonts applied |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 12s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
