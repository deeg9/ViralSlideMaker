---
phase: 22
slug: auth-foundation-key-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | KEY-02 | T-22-01 | SHA-256 hash stored, not plaintext | unit | `npx vitest run src/__tests__/api/api-keys.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | AUTH-01 | T-22-02 | Bearer token extracted and validated | unit | `npx vitest run src/__tests__/api/auth.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 1 | AUTH-02 | T-22-03 | timingSafeEqual used for hash comparison | unit | `npx vitest run src/__tests__/api/auth.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | KEY-01 | — | Key shown once, not retrievable | manual | — | — | ⬜ pending |
| 22-02-02 | 02 | 2 | KEY-03 | — | Key list shows masked prefix | manual | — | — | ⬜ pending |
| 22-02-03 | 02 | 2 | KEY-04 | — | Revoked key returns 401 | integration | `curl -H "Authorization: Bearer vsl_..." /api/v1/templates` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/api/api-keys.test.ts` — stubs for KEY-02 (hash verification)
- [ ] `src/__tests__/api/auth.test.ts` — stubs for AUTH-01, AUTH-02 (bearer auth, timing-safe comparison)

*Existing infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Key shown once after creation | KEY-01 | UI state transition, not testable in unit tests | Create key in settings, verify full key displayed, close dialog, verify key not visible |
| Key list displays masked prefix | KEY-03 | Visual verification of table rendering | View API keys page, verify prefix format `vsl_abc1...` |
| Quick-start code snippets | KEY-05 | Visual verification of tabbed code blocks | Create key, verify curl/JS/Python tabs appear with key populated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
