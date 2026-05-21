---
phase: 89
slug: brand-kit-shelving-full-removal
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-20
---

# Phase 89 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `89-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 (verified live) |
| **Config file** | `vitest.config.ts` at repo root |
| **Quick run command** | `npx vitest run <path>` (single-file/dir) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~0.7s for the 3 BKSHELVE-05 fixture suites; full suite ~minutes |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` on touched files + the nearest unit test (`npx vitest run <touched test>`)
- **After every plan wave:** the 3 BKSHELVE-05 fixture suites + full `npx tsc --noEmit` error count
- **Before `/gsd-verify-work`:** full `npx vitest run` — no NEW failures vs. the pre-existing baseline (20 tsc errors, all test-file noise, none brand-kit)
- **Max feedback latency:** ~60 seconds

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| BKSHELVE-01 | Picker has no brand-kit tile | unit (component) | `npx vitest run src/__tests__/components/template-picker.test.tsx` | ✅ edit | ⬜ pending |
| BKSHELVE-02 | `/settings/brand-kit` returns 404 | manual / smoke | route-segment deletion — 404 is structural; manual Playwright check | ⚠️ manual | ⬜ pending |
| BKSHELVE-03 | `/api/v1/me/brand-kit` returns 404 | manual / smoke | dir deletion — 404 structural; manual check | ⚠️ manual | ⬜ pending |
| BKSHELVE-04 | Generation works w/o brand-kit param | unit | `npx vitest run src/lib/services/__tests__/carousel-from-references.test.ts src/components/slides/__tests__/generation-form-routing.test.tsx` | ✅ edit | ⬜ pending |
| BKSHELVE-05 | Render parity 45/45 (HARD GATE) | unit (fixture) | `npx vitest run src/__tests__/render/legacy-templates-byte-identical.test.ts src/__tests__/render/legacy-templates-regression.test.tsx src/__tests__/render/new-templates-parity.test.tsx` | ✅ no edit — must stay green | ⬜ pending |
| BKSHELVE-06 | Style-from-ref works w/o remix toggle | unit | `npx vitest run src/components/style-from-reference/__tests__/state-machine.test.ts src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx` | ✅ edit | ⬜ pending |
| BKSHELVE-07 | `getTemplate('brand-kit')` → `news-oracle` | unit | `npx vitest run src/lib/render/templates/__tests__/` (new case) | ❌ Wave 0 | ⬜ pending |
| BKSHELVE-08 | AI copy unchanged for no-brand-kit users | unit (snapshot/regression) | `npx vitest run src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx` + existing style-spec snapshots | ✅ no edit | ⬜ pending |
| BKSHELVE-09 | No dangling imports | type-check | `npx tsc --noEmit 2>&1 \| grep -cE 'error TS'` ≤ 20, none in a brand-kit file | ✅ baseline captured | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/render/templates/__tests__/getTemplate-brand-kit-fallback.test.ts` (or a new case in an existing `templates/__tests__/` file) — asserts `getTemplate('brand-kit').id === 'news-oracle'` and that `getTemplate('brand-kit')` does not throw. Covers BKSHELVE-07.
- [ ] No framework install needed — vitest 4.1.0 already present.
- [ ] No shared fixtures needed — removal phase reuses existing fixtures. **No fixture regeneration allowed** (CONTEXT lock — BKSHELVE-05).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/settings/brand-kit` → 404 | BKSHELVE-02 | Route-segment deletion; 404 is structural, no unit harness for Next.js route absence | Run dev server, navigate to `/settings/brand-kit`, confirm 404 |
| `/api/v1/me/brand-kit` → 404 | BKSHELVE-03 | API route-dir deletion; 404 structural | `curl localhost:3000/api/v1/me/brand-kit` → 404 |

---

## Validation Sign-Off

- [ ] All requirements have an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the BKSHELVE-07 fallback test
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after planning

**Approval:** pending
