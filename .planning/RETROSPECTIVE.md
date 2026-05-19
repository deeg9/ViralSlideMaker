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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v2.14 | 1 | 4 | First retrospective; single-day milestone execution; pattern-mirroring as the primary risk-reduction strategy |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|--------------------|
| v2.14 | ~3238 passing (41 baseline-failing) | not separately measured | yes — recipe extraction is pure deterministic code, no new AI vendor/tier |

### Top Lessons (Verified Across Milestones)

1. Additive-only changes that merge a new construct alongside the old (rather than replacing it) preserve byte-identity back-compat — proven by v2.14's DB registry merge and consistent with the project's long-standing TPLREND-05 discipline.
2. Mirroring an existing, verified pattern beats novel design for both speed and risk — the StyleSpec → LayoutRecipe lineage shipped a hardened model in a single day.
