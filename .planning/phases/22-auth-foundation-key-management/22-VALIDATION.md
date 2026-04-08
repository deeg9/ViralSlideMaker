---
phase: 22
slug: auth-foundation-key-management
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-08
---

# Phase 22 -- Validation Strategy

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
| 22-01-01 | 01 | 1 | KEY-02 | T-22-05 | RLS policies + indexes on api_keys table | structural | `grep -q "ENABLE ROW LEVEL SECURITY" supabase/migrations/007_api_keys.sql && grep -q "api_keys_key_hash_idx" supabase/migrations/007_api_keys.sql` | n/a (grep) | pending |
| 22-01-02 | 01 | 1 | AUTH-01 | T-22-01 | Bearer token extracted and validated | unit | `npx vitest run src/__tests__/api/auth.test.ts` | W0 (created in 22-01 Task 2) | pending |
| 22-01-03 | 01 | 1 | AUTH-02 | T-22-02 | timingSafeEqual used for hash comparison | unit | `npx vitest run src/__tests__/api/auth.test.ts` | W0 (created in 22-01 Task 2) | pending |
| 22-01-04 | 01 | 1 | AUTH-03 | -- | Middleware skips session auth for /api/v1/* | unit | `npx vitest run src/__tests__/auth/middleware.test.ts` | W0 (created in 22-01 Task 3) | pending |
| 22-01-05 | 01 | 1 | AUTH-04 | T-22-03 | withApiAuth provides admin client | unit | `npx vitest run src/__tests__/api/with-api-auth.test.ts` | W0 (created in 22-01 Task 3) | pending |
| 22-02-01 | 02 | 2 | KEY-01 | T-22-07 | createApiKey returns vsl_ format, hash stored not plaintext | unit | `npx vitest run src/__tests__/api/api-keys.test.ts` | W0 (created in 22-02 Task 1) | pending |
| 22-02-02 | 02 | 2 | KEY-03 | T-22-09 | listApiKeys returns masked prefix, no key_hash | unit | `npx vitest run src/__tests__/api/api-keys.test.ts` | W0 (created in 22-02 Task 1) | pending |
| 22-02-03 | 02 | 2 | KEY-04 | T-22-06 | revokeApiKey deletes with user_id filter | unit | `npx vitest run src/__tests__/api/api-keys.test.ts` | W0 (created in 22-02 Task 1) | pending |
| 22-02-04 | 02 | 2 | KEY-05 | -- | Quick-start snippets shown after creation | manual | -- | -- | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `src/__tests__/api/auth.test.ts` -- created in Plan 22-01 Task 2 (TDD, AUTH-01, AUTH-02)
- [x] `src/__tests__/api/with-api-auth.test.ts` -- created in Plan 22-01 Task 3 (TDD, AUTH-04)
- [x] `src/__tests__/auth/middleware.test.ts` -- extended in Plan 22-01 Task 3 (AUTH-03)
- [x] `src/__tests__/api/api-keys.test.ts` -- created in Plan 22-02 Task 1 (TDD, KEY-01 through KEY-04)

*All test files created within their respective plan tasks (TDD pattern).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Key shown once after creation | KEY-01 | UI state transition in dialog | Create key in settings, verify full key displayed, close dialog, verify key not visible |
| Key list displays masked prefix | KEY-03 | Visual verification of table rendering | View API keys page, verify prefix format `vsl_abc1...` |
| Quick-start code snippets | KEY-05 | Visual verification of tabbed code blocks | Create key, verify curl/JS/Python tabs appear with key populated |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
