---
phase: 82
slug: category-driven-generation-headline-first-copy-engine-conten
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-17
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (jsdom env, globals) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <path>` (single file) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60-90 seconds (256 test files) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` scoped to the touched test file(s)
- **After every plan wave:** Run `npx vitest run` (full suite) + `npm run lint:gates`
- **Before `/gsd-verify-work`:** Full suite + render-parity suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 82-01-* | 01 | 1 | R4, R5 | — | Optional body_text + accessory_label do not widen the AI-ingest trust boundary | unit | `npx vitest run src/lib/ai/__tests__/` | ❌ W0 | ⬜ pending |
| 82-02-* | 02 | 1 | R1, R2, R3 | — | Category modules are static prompt text — no untrusted input reaches prompt assembly | unit | `npx vitest run src/lib/ai/categories/__tests__/` | ❌ W0 | ⬜ pending |
| 82-03-* | 03 | 2 | R1, R6, R7 | — | `category` is a closed enum; API rejects unknown category values | unit | `npx vitest run src/lib/ai/categories/__tests__/` | ✅ | ⬜ pending |
| 82-04-* | 04 | 2 | R7, R8, R9 | — | Culled templates hidden from picker only; renderer retained (no privilege change) | unit | `npx vitest run src/lib/render/templates/__tests__/` | ✅ | ⬜ pending |
| 82-05-* | 05 | 3 | R10 | — | Structural suite proves category routing + headline-only + keeper-only picker | unit | `npx vitest run src/lib/ai/__tests__/category-generation.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/ai/categories/__tests__/` — directory created by Plan 02 (category registry tests)
- [ ] `src/lib/ai/__tests__/category-generation.test.ts` — structural suite created by Plan 05
- [ ] No new framework install — vitest 4.x already present

*Existing infrastructure (vitest, jsdom, 256 test files) covers all phase requirements; only the new test files above are added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Keeper-list approval | R9 | A human curation decision — which ~4-6 templates survive — cannot be auto-derived | Plan 04 presents the proposed keeper list (per-template reasoning + category coverage) to the user via AskUserQuestion BEFORE committing the curation change |
| Visual sign-off of sample News + Facts carousels | R10 | "Matches the reference style" is a subjective visual judgment | Plan 05 generates sample News + Facts carousels on a fixed test-topic set; the user visually confirms they match the reference screenshots. Surfaces as a `human_needed` verification item |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-17
