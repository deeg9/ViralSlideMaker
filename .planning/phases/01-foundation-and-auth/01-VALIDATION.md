---
phase: 1
slug: foundation-and-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | AUTH-03 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | PROJ-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | PROJ-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | PROJ-03 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | PROJ-04 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-05 | 02 | 1 | UIUX-01 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@testing-library/react` — install test framework
- [ ] `vitest.config.ts` — configure for Next.js + React
- [ ] `tests/setup.ts` — shared test setup (Supabase mocks, etc.)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clean minimal design aesthetic | UIUX-01 | Visual/subjective assessment | Review all pages for consistent styling, whitespace, typography |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
