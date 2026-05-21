# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.14 — Save as Template

**Shipped:** 2026-05-19
**Phases:** 4 (83–86) | **Plans:** 12 | **Sessions:** 1 (single-day execution, 2026-05-18)

### What Was Built
- DB-backed template storage — additive, reversible `public.templates` migration applied live to the shared Supabase project, plus an async hybrid registry that merges the 13 code templates with DB rows (code-wins collision rule, ~60s TTL cache), so a new template appears in the picker with no code deploy.
- A typed, role-keyed `LayoutRecipe` model (cover/body/cta archetypes, closed-enum tuples, scales 1–10 slides) with a `parseLayoutRecipeSafe` two-phase zod firewall, plus pure deterministic `extractLayoutRecipe` that turns a source carousel's `slide_data` into a recipe + flat style with no new AI call.
- Recipe-driven generation — `applyLayoutRecipe` projects a recipe into `SlideStyleOverrides`, wired into both `generateCarousel` paths so a carousel generated on a recipe-carrying template comes out pre-shaped.
- An admin Save-as-Template flow — server-enforced admin gate (`requireAdmin`, fail-safe-closed), `POST /api/admin/templates` endpoint, `(admin)` route group + authoring page, and DB-template cover-snapshot preview PNGs in the picker.

### What Worked
- Mirroring established patterns kept the work fast and low-risk: `LayoutRecipe` mirrored `StyleSpec`, `parseLayoutRecipeSafe` mirrored `parseStyleSpecSafe`, `extractLayoutRecipe` mirrored `projectStyleSpecToSlideOverrides`, and the admin gate modeled on the existing `seed-explore` route. No pattern was reinvented.
- Additive-only architecture protected back-compat throughout — the DB registry merge left `index.ts` and the `templates[]` array byte-identical, so the byte-identity suites needed no fixture regeneration. TPLREND-05 render parity held across all 3 render paths.
- The closed-enum invariant plus a two-phase validation firewall (silent-drop / range-clamp / unknown-key strip) gave a hardened schema and prompt-injection surface for the new recipe model from day one.
- The highest-blast-radius phase (85, recipe-driven generation) was de-risked with explicit hard gates — SC3 byte-identical no-recipe back-compat and SC4 public-by-default (`autoPublishOnGenerate`) — proven by verification tests before close.
- Phase dependency ordering (83 → 84 → 85, 86 depends on 83) was clean and the whole milestone executed in a single day with all 4 phase REVIEWs clean.

### What Was Inefficient
- The `gsd-sdk query milestone.complete` auto-extracted MILESTONES.md accomplishments were near-useless ("Phase 1 — `cleanRecipe(input, counter)` pre-clean walker", "[Rule 1 - Bug] extractLayoutRecipe second-arg type") — they pulled arbitrary lines from SUMMARY bodies rather than the one-liner field, so the entry had to be hand-rewritten. `summary-extract --pick one_liner` returned `null` for most v2.14 SUMMARY files because they lack a one-liner field.
- REQUIREMENTS.md traceability checkboxes stayed `[ ]`/Pending for all 9 requirements through the entire milestone despite every phase verifying PASS — a known checkbox-lag that the milestone audit had to call out explicitly and the close step had to true up cosmetically.
- Two operational user-setup items (`ADMIN_USER_IDS`, the `template-previews` bucket migration) shipped as deferred tech debt — the v2.14 admin feature is code-complete but operationally dark in production until they are applied.
- A pre-existing 6-test fixture-regen failure (from quick task `260518-jhg` adding the 13th code template) was carried into and through the milestone without being fixed — it muddied every full-suite run with phantom red.

### Patterns Established
- DB-backed-as-additive-layer: when introducing a database-backed alternative to a code construct, merge via a registry that resolves both with a code-wins rule, rather than migrating the code construct — preserves byte-identity back-compat for free.
- New AI-adjacent data models ship with a two-phase zod firewall (pre-clean walker + `safeParse`) and closed enums wherever feasible — the `parseStyleSpecSafe` → `parseLayoutRecipeSafe` lineage is now the project's standard for any model crossing an untrusted boundary.
- High-blast-radius phases name their back-compat and invariant gates as explicit, test-proven success criteria (SC3 byte-identical, SC4 public-by-default) before close.

### Key Lessons
1. The `milestone.complete` CLI's auto-extracted accomplishments cannot be trusted as-is — always plan to hand-write the MILESTONES.md key-accomplishments bullets from the phase SUMMARY files. Adding a real `one_liner` frontmatter field to future SUMMARY files would let `summary-extract` work.
2. Requirement-traceability checkboxes drift from reality during execution; the authoritative status lives in phase VERIFICATION.md, and the milestone close is the right place to reconcile — but a per-phase checkbox-update step would prevent the audit from having to flag it every time.
3. Defer operational setup explicitly and loudly: when a feature is fail-safe-closed pending env vars or a migration, record it as a tech-debt blocker in the audit, MILESTONES.md, PROJECT.md, and STATE.md so it cannot be forgotten — code-complete is not the same as operationally live.
4. Pre-existing test debt should be fixed (or quarantined) before a milestone starts, not carried through it — a stable green baseline makes every phase's verification cleaner.

### Cost Observations
- Model mix: not separately instrumented this milestone.
- Sessions: 1 (single-day, 2026-05-18).
- Notable: 4 phases / 12 plans / ~107 phase tests / 53 commits in one day. Mirroring existing patterns (StyleSpec → LayoutRecipe, parseStyleSpecSafe → parseLayoutRecipeSafe) was the dominant efficiency driver — minimal novel design, mostly disciplined adaptation.

---

## Milestone: v2.15 — DB-Backed Template Wiring

**Shipped:** 2026-05-19
**Phases:** 2 (87–88) | **Plans:** 5 | **Sessions:** 1

### What Was Built
- Picker + generation wiring — `getPickerDbTemplates()` pairs each DB template with its row `category` + `created_at`; `TemplatePicker` merges category-matching DB templates DB-first; the project-page server component fetches them and threads them through `GenerationForm` (no new API route). DB-aware category-snap on all three sites keeps a matching-category DB id instead of snapping to the default; `/api/v1/carousel` rejects unknown ids via DB-aware `isKnownTemplateId`.
- Render paths + per-slide override + publish/fork — all five render call sites converted `getTemplate` → async `resolveTemplate` (no `highlight-bar` fallback for a DB id); editor canvas resolves a DB project template via server-passed DB templates; `getDbTemplatesMap()` + an optional sync DB map thread per-slide DB overrides through the builders; fork route inherits the source `template_id`. Byte-identity guard for all 13 code ids; 3 fixture suites green at 45/45.
- Closed v2.14's TSTORE-02 / TSTORE-03, which previously passed only as isolated unit tests because Phase 83's merged registry was built but never wired into the app.

### What Worked
- A precise pre-milestone spec (`DB-TEMPLATE-WIRING-SPEC.md`) verified the file-level blast radius and recommended the exact 2-phase split — the roadmap honored it as-is and the file sets stayed disjoint, so the two phases never collided.
- The sync→async conversion risk was retired by NOT literally asyncifying `resolvePerSlideTemplate` / `buildSystemPrompt` — instead the async caller pre-resolves and passes a DB-aware value through optional params. A literal asyncification would have cascaded into ~40 sync test callers + 7 `'use client'` render-body callers; the optional-param approach kept blast radius near-zero with identical end behavior.
- A byte-identity guard test (sync `getTemplate` vs async `resolveTemplate` for all 13 code ids) gave hard, mechanical proof the conversion is behavior-neutral — no judgment call needed at verification.
- The live end-to-end Playwright dry-run caught a real (pre-existing) production fork bug that all the unit tests missed — confirming the value of a true full-loop exercise over layered unit coverage alone.

### What Was Inefficient
- `gsd-sdk query milestone.complete` again produced an empty accomplishments list and did not reorganize ROADMAP.md or delete the original REQUIREMENTS.md — all three had to be done by hand. Same `summary-extract --pick one_liner` gap as v2.14: SUMMARY files carry a `# Plan NN-NN Summary —` heading, not a `one_liner` frontmatter field.
- REQUIREMENTS.md traceability checkboxes again stayed `[ ]`/Pending for all 6 requirements despite every phase verifying PASS — the same cosmetic checkbox-lag the v2.14 retro flagged; the milestone audit had to call it out explicitly again.
- Phase 88 verification shipped as `status: human_needed` and sat stale until the orchestrator completed the dry-run and hand-corrected it — the verification status had no path to auto-promote once the human item passed.
- The Nyquist `*-VALIDATION.md` files were missing for both phases at milestone-audit time (Phase 87 had only a `draft`) and had to be backfilled retroactively — validation should be produced during execute-phase, not reconstructed at close.

### Patterns Established
- Optional-param DB-awareness over asyncification: when a sync helper must become DB-aware but is called from many sync/client/test sites, add an optional pre-resolved parameter and have the async caller fill it — avoids a cascading async refactor while delivering identical behavior in the consumable output.
- Byte-identity guard tests for behavior-neutral refactors: when converting a call across a sync→async (or any equivalent) boundary, assert the two code paths produce identical output for every known input — turns "did the refactor change anything?" into a mechanical pass/fail.

### Key Lessons
- A live end-to-end dry-run is worth more than its weight in unit tests for integration milestones — it exercised the real wiring and surfaced a production bug the 37 new unit tests could not.
- Wiring milestones (making already-built code reachable) are low-risk and fast when the prior milestone left a clean seam — v2.15 shipped 6 requirements in 2 phases / 5 plans because v2.14's registry was already built and tested, just unwired.

### Cost Observations
- Model mix: not separately instrumented this milestone.
- Sessions: 1.
- Notable: 2 phases / 5 plans / 37 new passing tests, zero new full-suite failures. A tightly-scoped pre-milestone spec was the dominant efficiency driver.

---

## Milestone: v2.16 — Picker Polish & Brand-Kit Shelving

**Shipped:** 2026-05-21
**Phases:** 2 (89–90) | **Plans:** 7 | **Sessions:** 1 (autonomous)

### What Was Built
- Phase 89 — Brand-Kit Shelving (Full Removal): removed the brand-kit feature across ~79 files (picker tile, Settings page, `/api/v1/me/brand-kit/*` routes, render/publish/download wiring, AI prompts, style-from-reference remix flow, `src/lib/brand-kit/` library + types). Dropped the `brandKit` positional arg from `buildSlideElement`/`buildSlideHtml` atomically across 20+ call sites; added a defensive `getTemplate('brand-kit') → news-oracle` resolver fallback. Render parity 45/45 held; DB schema left dormant.
- Phase 90 — Pre-Rendered Template Preview Pipeline: built `scripts/render-template-previews.ts`, ran it live (16 code-template cover PNGs sourced from `buyer@example.com`'s carousels, uploaded to the `template-previews` Supabase bucket, `preview` URLs wired into all 16 template files); collapsed `<TemplateTilePreview>` to a single-branch `<img>`.

### What Worked
- The plan-checker revision loop earned its keep on Phase 89: it caught a non-atomic `buildSlideElement` positional-arg removal across two iterations — 17 unowned call sites including a hard-gate parity suite — before any code was written. A delete-heavy refactor is exactly where unowned call sites hide.
- Running Phase 90's live pipeline on the main working tree (not an isolated worktree) was the right call — the worktree wouldn't have had the gitignored `.env.local` credentials the live Supabase/Gemini run needed.
- Per-wave `tsc` + parity-suite gates after every worktree merge caught nothing broken — but that's the point: each linear wave provably left the tree green, so the 79-file removal never compounded a latent break.
- Sourcing previews from the user's own published carousels (vs. curated stock photos) made the previews depict exactly what generation produces — and the gap-fill generation step meant even unused templates got a real exemplar.

### What Was Inefficient
- A coherent unrelated feature (an inline-dashboard generation form) surfaced in the working tree mid-Phase-89 with no commit provenance — it turned out to be the user's parallel work. It cost an investigation + a quarantine branch. Worktree executors leaving stray main-tree changes is a known hazard; a coherent *feature* appearing was new.
- The gsd-verifier ran `git` branch surgery to test a hypothesis and left the repo on the wrong branch — its Phase-89 "regression" finding was its own branch confusion. Cost a full state-recovery detour. Verifiers must stay read-only on git refs.
- `gsd-sdk query milestone.complete` again produced a junk accomplishments list (extracted a `[Rule 3 - Blocking]` deviation line + three bare `Task 1 —` fragments as "key accomplishments") and again did not reorganize ROADMAP.md or delete REQUIREMENTS.md — same gap flagged in the v2.14 and v2.15 retros, hand-fixed a third time.
- Phase 90's `*-VALIDATION.md` shipped `nyquist_compliant: false` because the planner never flipped it; the ROADMAP phase checkbox didn't auto-tick on `phase.complete` for either phase — both hand-corrected. Recurring tracking-write gaps.

### Patterns Established
- Quarantine, don't discard, unexplained working-tree state: when coherent uncommitted work of unknown provenance blocks a clean tree, commit it to a `wip/` branch (fully recoverable, inspectable) rather than stashing or reverting — it preserved what turned out to be the user's real parallel work.
- Run live-credential phases on the main tree, not a worktree: any plan that needs gitignored `.env.local` secrets (live API/DB runs) should drop worktree isolation — a fresh worktree never carries gitignored files.

### Key Lessons
- For a delete-heavy refactor, the highest-value gate is the plan-checker's call-site-completeness check — "is this edit atomic across every caller?" — not the post-hoc tests. Both Phase-89 revision rounds were the same defect class (unowned call sites), caught pre-execution.
- Subagents must be constrained to read-only git operations. A verifier that switches branches to test a hypothesis can strand the orchestrator on the wrong ref and produce findings that describe a branch that isn't HEAD.

### Cost Observations
- Model mix: opus orchestrator + opus planners/executors, sonnet checkers/verifiers.
- Sessions: 1 (a single autonomous `/gsd-autonomous` run, both phases + lifecycle).
- Notable: 2 phases / 7 plans, ~79-file removal + a live AI-generation pipeline run (~10 Gemini Flash calls), zero new test failures, render parity 45/45 held throughout. The autonomous run paused twice for genuine user decisions (the quarantine call; the live-run scope) — both were correct pause points, not friction.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v2.14 | 1 | 4 | First retrospective; single-day milestone execution; pattern-mirroring as the primary risk-reduction strategy |
| v2.15 | 1 | 2 | Tightly-scoped pre-milestone spec drove a clean 2-phase split; optional-param DB-awareness retired the async-refactor risk; live e2e dry-run as the final gate |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|--------------------|
| v2.14 | ~3238 passing (41 baseline-failing) | not separately measured | yes — recipe extraction is pure deterministic code, no new AI vendor/tier |
| v2.15 | ~3275 passing (41 baseline-failing) | not separately measured | yes — app-layer wiring only, no schema migration, no new dependency |

### Top Lessons (Verified Across Milestones)

1. Additive-only changes that merge a new construct alongside the old (rather than replacing it) preserve byte-identity back-compat — proven by v2.14's DB registry merge and consistent with the project's long-standing TPLREND-05 discipline.
2. Mirroring an existing, verified pattern beats novel design for both speed and risk — the StyleSpec → LayoutRecipe lineage shipped a hardened model in a single day.
3. Byte-identity / behavior-neutral guard tests turn risky refactors (DB registry merge, sync→async conversion) into mechanical pass/fail checks — used in both v2.14 and v2.15.
4. The `milestone.complete` CLI consistently under-delivers on accomplishments extraction and roadmap/requirements reorganization — budget for manual finishing at every milestone close until the `one_liner` SUMMARY-frontmatter gap is fixed.
