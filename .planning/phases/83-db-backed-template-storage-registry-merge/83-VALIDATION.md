---
phase: 83
slug: db-backed-template-storage-registry-merge
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
---

# Phase 83 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively from phase
> artifacts (PLAN/SUMMARY/VERIFICATION) — phase was executed and verified
> `passed` before this validation audit ran.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <test-file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1s (phase 83 files) / ~3min (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the task's `npx vitest run <file>`
- **After every plan wave:** Run `npx vitest run src/__tests__/render src/lib/render/templates`
- **Before `/gsd-verify-work`:** Full suite must hold at the established baseline
- **Max feedback latency:** ~2 seconds (per-file)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 83-01 | 01 | 1 | TSTORE-01 | — | Additive `public.templates` table; RLS deny-by-default writes (1 SELECT policy, 0 write policies); `templates_category_allowed` CHECK on closed enum | migration / integration | `npx vitest run src/lib/render/templates/__tests__/registry-merge.test.ts` | ✅ | ✅ green |
| 83-02 | 02 | 1 | TSTORE-02 | — | Hybrid registry merges code + DB templates; code template wins on id collision; never throws on DB outage (graceful degradation) | unit | `npx vitest run src/lib/render/templates/__tests__/registry-merge.test.ts` | ✅ | ✅ green |
| 83-03 | 03 | 2 | TSTORE-03 | — | DB template renders consistently across canvas / Satori PNG / HTML, identical to its code-template equivalent | render / integration | `npx vitest run src/__tests__/render/db-template-parity.test.tsx` | ✅ | ✅ green |
| 83-03 | 03 | 2 | TSTORE-04 | — | All 13 code templates render sha256-identical via async `resolveTemplate` vs sync `getTemplate`; registry never mutates `templates[]` | render / regression | `npx vitest run src/__tests__/render/legacy-byte-identity-after-storage.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage:** 16/16 tests across 3 files pass — `registry-merge.test.ts` (8),
`db-template-parity.test.tsx` (5), `legacy-byte-identity-after-storage.test.ts` (3).

---

## Wave 0 Requirements

Existing infrastructure (vitest + `vitest.config.ts`) covers all phase
requirements. No framework install or stub scaffolding was required. All four
TSTORE requirements were delivered with dedicated, hermetic test suites
(fixture DB rows injected via the `__setDbTemplateFetcher` test seam — no live
DB connection in tests).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applied live to the shared prod Supabase project | TSTORE-01 | Schema change to a remote, shared Supabase project — not reproducible in a unit test. Confirmed at execution time via Supabase MCP `apply_migration` + `execute_sql`. | Run `execute_sql` against the project: confirm `public.templates` exists with 9 columns, RLS enabled, exactly 1 SELECT policy and 0 write policies, `templates_category_allowed` CHECK present. |
| New DB row surfaces in the picker within ~60s with no deploy | TSTORE-02 | End-to-end TTL-cache behavior against a live DB + running app. The ~60s TTL cache logic itself IS unit-tested (registry-merge test 7); only the live-deploy-free surfacing is manual. | Insert a row into `public.templates`; within ~60s confirm it appears via `getPickerTemplates()` in a running instance with no code deploy. |

---

## Validation Sign-Off

- [x] All tasks have automated verify (no Wave 0 dependencies needed)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — no gaps found)
- [x] No watch-mode flags
- [x] Feedback latency < 5s (per-file)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-18

---

## Validation Audit 2026-05-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Retroactive audit (State B — reconstructed from artifacts). All 4 phase
requirements (TSTORE-01..04) were already COVERED by dedicated test files
delivered during execution. Phase 83's 4 test files re-run green (16/16) at
audit time. No gaps to fill; no test files generated. Two behaviors are
inherently manual-only (live Supabase migration apply; live deploy-free DB-row
surfacing) and are recorded above — both have their unit-testable cores
already covered.
