---
phase: 5
slug: credit-ledger-usage-limits
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing project setup) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CRED-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | CRED-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | CRED-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | CRED-02 | manual | Browser check | N/A | ⬜ pending |
| 05-02-02 | 02 | 2 | CRED-05 | manual | Browser check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for credit deduction RPC logic
- [ ] Test stubs for usage limit checking functions
- [ ] Vitest config verified working

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Credit balance in navbar | CRED-02 | UI rendering check | Log in as Pro user, verify credit count visible in navbar |
| Usage limit prompt | STRIPE-04 | UI flow check | Log in as free user, create projects until limit, verify prompt appears |
| Credit history page | CRED-05 | UI rendering check | Navigate to usage history, verify transactions listed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
