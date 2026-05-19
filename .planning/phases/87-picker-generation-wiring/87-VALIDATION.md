---
phase: 87
slug: picker-generation-wiring
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-19
validated: 2026-05-19
---

# Phase 87 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

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
  41-failure baseline (3238 passing / 41 failing after Phase 86).
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 87-01-* | 01 | 1 | WIRE-01 | — | Picker shows DB templates of the matching category, DB-first | component | `npx vitest run src/__tests__/components/template-picker.test.tsx src/lib/render/templates/__tests__/registry-merge.test.ts` | ✅ | ✅ green |
| 87-02-* | 02 | 2 | WIRE-02 | — | Snap keeps a DB id whose category matches; unknown id → 400 | unit | `npx vitest run src/app/api/v1/carousel/__tests__/route.test.ts src/lib/render/templates/__tests__/registry-merge.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The registry test seam
(`__setDbTemplateFetcher` / `__resetDbTemplateRegistry`) already exists from
Phase 83 — DB templates are injected as fixtures, no live DB. No new framework
or shared fixture install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end: admin saves a template → it appears in the live picker | WIRE-01 | Requires `ADMIN_USER_IDS` + the `template-previews` bucket migration (both outstanding v2.14 tech debt) | After both user-setup items are applied: save a template via the admin flow, open the generation form, confirm the DB tile shows under its category. |

*All automated-verifiable behaviors have automated coverage; the end-to-end
manual check is gated only on outstanding v2.14 operational setup.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-05-19 — both requirements have green automated
coverage; nyquist-compliant.

---

## Validation Audit 2026-05-19

State A audit (VALIDATION.md already present, `draft`). Cross-referenced the
two requirements against the committed Phase 87 test suites and re-ran them.

| Metric | Count |
|--------|-------|
| Requirements audited | 2 (WIRE-01, WIRE-02) |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

- WIRE-01 — COVERED. `template-picker.test.tsx` (WIRE-01 DB-template-merge
  block) + `registry-merge.test.ts` (`getPickerDbTemplates`, `templateCategory`).
- WIRE-02 — COVERED. `route.test.ts` (unknown id → 400; code/DB id accepted) +
  `carousel-recipe-generation.test.ts` / `actions-recipe-generation.test.ts`
  WIRE-02 blocks (snap preserves matching-category DB id) + `registry-merge`.
- Re-run result: 28 passed / 1 failed across the 3 audited files. The single
  failure is the pre-existing Phase 56 `editorial-serif`/`notes-app-chic`
  template-name baseline test (`260518-jhg` fixture-regen debt) — verified red
  with Phase 87 stashed; NOT a Phase 87 regression and NOT a coverage gap.
- No new tests generated — coverage was already complete; statuses promoted
  `⬜ pending → ✅ green`.
