---
phase: 88
slug: render-paths-per-slide-override-publish-fork
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-19
validated: 2026-05-19
---

# Phase 88 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed retroactively from phase artifacts (State B) on 2026-05-19.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~120 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the relevant changed test file.
- **After every plan wave:** Run `npx vitest run` (full suite).
- **Before `/gsd-verify-work`:** Full suite must show no NEW failures vs the
  41-failure baseline (3238 passing / 41 failing after Phase 86; 47 failing in
  CI-mode counts — same baseline, different counter).
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 88-01-* | 01 | 1 | WIRE-03 | — | All three render paths resolve a DB `template_id` via async `resolveTemplate` — no silent `highlight-bar` fallback; DB template renders byte-identically to its code equivalent | unit/render | `npx vitest run src/__tests__/render/wire-async-resolution-byte-identity.test.ts src/__tests__/render/db-template-parity.test.tsx` | ✅ | ✅ green |
| 88-02-* | 02 | 2 | WIRE-04 | — | A per-slide `template_id_override` set to a DB id resolves through HTML + Satori via the optional sync DB-template map; STYLESPEC-10 fallback preserved for unknown ids | unit/render | `npx vitest run src/lib/render/__tests__/resolve-per-slide-template.test.ts src/__tests__/render/db-template-parity.test.tsx` | ✅ | ✅ green |
| 88-02-* | 02 | 2 | WIRE-05 | — | Publish keeps the DB `template_id`; fork inherits it (TS route + RPC COALESCE); NULL → `bold-minimal` fallback | unit/api | `npx vitest run src/__tests__/api/fork-inherits-template-id.test.ts` | ✅ | ✅ green |
| 88-03-* | 03 | 3 | WIRE-06 | — | The 13 code templates + ~82 existing carousels stay byte-identical; sync `getTemplate` vs async `resolveTemplate` is byte-identical for all 13 code ids; 3 fixture suites green at 45/45 | regression | `npx vitest run src/__tests__/render/wire-async-resolution-byte-identity.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The registry test seam
(`__setDbTemplateFetcher` / `__resetDbTemplateRegistry`) and the 3 fixture
suites (`legacy-templates-byte-identical`, `legacy-templates-regression`,
`new-templates-parity`) already exist from prior milestones — DB templates are
injected as fixtures, no live DB. No new framework or shared fixture install
needed.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end dry-run: admin save → picker → generate → render → publish → fork | WIRE-03..06 | Full live loop spanning auth, Supabase, picker UI, generation, render, publish, fork — exercised via Playwright, not unit tests | Sign in as admin, Save as Template, confirm the tile in the picker, generate on it, verify `template_id` persists + renders in all three paths, publish, fork. **COMPLETED by orchestrator 2026-05-19 — PASSED** (see 88-VERIFICATION.md "Human verification"). |

*Every automated-verifiable layer has automated coverage (SC1–SC4); the live
full-loop dry-run (SC5) was driven via Playwright and PASSED.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-05-19

---

## Validation Audit 2026-05-19

State B reconstruction (no VALIDATION.md present; 3 SUMMARY files present).
Built the requirement→task map from `88-0{1,2,3}-PLAN.md` / `-SUMMARY.md`,
cross-referenced each of WIRE-03..06 against the committed Phase 88 test files,
and re-ran them.

| Metric | Count |
|--------|-------|
| Requirements audited | 4 (WIRE-03, WIRE-04, WIRE-05, WIRE-06) |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

- WIRE-03 — COVERED. `wire-async-resolution-byte-identity.test.ts` (3) +
  `db-template-parity.test.tsx` (DB↔code render parity).
- WIRE-04 — COVERED. `resolve-per-slide-template.test.ts` WIRE-04 block (6) +
  `db-template-parity.test.tsx` WIRE-04 block (3).
- WIRE-05 — COVERED. `fork-inherits-template-id.test.ts` (3 — code id, DB id,
  NULL→`bold-minimal`).
- WIRE-06 — COVERED. `wire-async-resolution-byte-identity.test.ts` byte-identity
  guard for all 13 code ids; the 3 fixture suites stay green at 45/45.
- Re-run result: 4 test files, 28 passed / 0 failed.
- No new tests generated — Phase 88 shipped 15 new passing tests with execution;
  coverage was already complete. Statuses recorded `✅ green`.
