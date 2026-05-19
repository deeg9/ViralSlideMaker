---
phase: 86
slug: admin-save-as-template-flow-previews
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
---

# Phase 86 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively from phase
> artifacts (PLAN/SUMMARY/VERIFICATION/UI-REVIEW) — phase was executed and
> verified `passed` (ADMIN-01, ADMIN-02) before this validation audit ran.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <test-file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1.5s (phase 86 files) / ~3min (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the task's `npx vitest run <file>`
- **After every plan wave:** Run `npx vitest run src/lib/auth src/lib/templates src/lib/render src/components/slides 'src/app/api/admin'`
- **Before `/gsd-verify-work`:** Full suite must hold at the established baseline
- **Max feedback latency:** ~2 seconds (per-file)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 86-01 | 01 | 1 | ADMIN-01 | T-authz / T-fail-open | `isAdminUser` / `requireAdmin` single reusable admin gate; FAIL-SAFE-CLOSED when `ADMIN_USER_IDS` unset/empty; session-cookie check only (no bearer token); never throws | unit | `npx vitest run src/lib/auth/__tests__/admin.test.ts` | ✅ | ✅ green |
| 86-01 | 01 | 1 | ADMIN-02 | — | `renderCoverPreviewPng` renders slide 0 to a 1080x1920 PNG via the existing Satori pipeline — no new render fields, render parity (TPLREND-05) preserved | unit | `npx vitest run src/lib/render/__tests__/preview-render.test.ts` | ✅ | ✅ green |
| 86-02 | 02 | 2 | ADMIN-01 | T-collision | `templateSlug` deterministic + `withSuffix` collision-safe id — never shadows a code-template id (`TEMPLATE_IDS`) | unit | `npx vitest run src/lib/templates/__tests__/slug.test.ts` | ✅ | ✅ green |
| 86-02 | 02 | 2 | ADMIN-01 | T-authz / T-injection | **Hard gate** — `POST /api/admin/templates` re-checks `requireAdmin` → 403 for non-admin AND no-session; `category` validated against closed `CONTENT_CATEGORIES` → 400; full row written in one service-role insert; collision-suffixed id | integration | `npx vitest run src/app/api/admin/templates/__tests__/route.test.ts` | ✅ | ✅ green |
| 86-03 | 03 | 3 | ADMIN-02 | — | `dbRowToSlideTemplate` carries `row.preview` onto `SlideTemplate.preview` (`null` → `undefined`); id/name still win, required-field backfill intact | unit | `npx vitest run src/lib/render/templates/__tests__/db-template-row-preview.test.ts` | ✅ | ✅ green |
| 86-03 | 03 | 3 | ADMIN-02 | — | Picker tile renders the `preview` PNG `<img>` (descriptive `alt`) when present; falls back to byte-identical live `<SlidePreview>` otherwise — code-template render parity preserved | unit / component | `npx vitest run src/components/slides/__tests__/template-tile-preview.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage:** 31/31 tests across 6 files pass — `admin.test.ts` (9),
`preview-render.test.ts` (3), `slug.test.ts` (7), `route.test.ts` (6),
`db-template-row-preview.test.ts` (3), `template-tile-preview.test.tsx` (3).

---

## Wave 0 Requirements

Existing infrastructure (vitest + `vitest.config.ts`) covers all phase
requirements. No framework install or stub scaffolding was required. The
admin endpoint test mocks the Supabase client and the Satori render boundary;
the auth gate, slug, mapper, and tile-preview switch are all pure /
component-level and run in-process with no live DB and no network.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `(admin)/layout.tsx` server-side redirects a non-admin / unauthenticated visitor to `/dashboard` | ADMIN-01 | The route-group layout gate is a Next.js Server Component `redirect()` — exercised end-to-end only against a running app. Its underlying logic IS automated: the layout calls the same `requireAdmin` helper covered by `admin.test.ts` (single source of truth), and the endpoint re-check is automated in `route.test.ts`. | As a non-admin (or signed-out), navigate to `/templates/save`; confirm an immediate server-side redirect to `/dashboard` with no admin UI flash. |
| `template-previews` storage bucket created live on the shared Supabase project | ADMIN-02 | Storage-bucket creation is a remote change to a shared Supabase project — not reproducible in a unit test. Migration file is additive + reversible, service-role-only writes. | Apply `supabase/migrations/20260519_phase86_template_previews_bucket.sql`; confirm the public `template-previews` bucket exists with a public SELECT policy and no authenticated write policy. |
| New DB template appears in every user's picker within the ≤60s registry TTL window after an admin save | ADMIN-01 | End-to-end TTL behavior against a live DB + running app. The TTL cache itself is unit-tested in Phase 83; the endpoint insert is automated in `route.test.ts`. Only the live deploy-free surfacing is manual. | After a successful admin Save-as-Template, within ~60s confirm the new template appears in the picker for a non-admin user with no code deploy. |

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

Retroactive audit (State B — reconstructed from artifacts). Both phase
requirements (ADMIN-01, ADMIN-02) — including the ADMIN-01 hard gate (admin
authz at the endpoint) — were already COVERED by dedicated test files
delivered during execution. Phase 86's 6 test files re-run green (31/31) at
audit time. No gaps to fill; no test files generated. Three behaviors are
inherently manual-only (Server-Component layout redirect; live Supabase
storage-bucket creation; live deploy-free template surfacing) and are recorded
above — each has its automatable core already covered.
