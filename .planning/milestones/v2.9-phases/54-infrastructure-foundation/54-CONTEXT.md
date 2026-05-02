# Phase 54: Infrastructure Foundation - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning
**Mode:** `--auto` (Claude-decided defaults grounded in research synthesis + codebase audit)

<domain>
## Phase Boundary

Server-side photo-treatment pipeline + AI-slop guardrails + Imagen 4 Fast verification + ZIP-download-rate baseline are live; nothing user-visible has changed yet, but every downstream phase builds on this foundation.

**In scope:**
- `src/lib/photo-treatment/treat.ts` (sharp-based B&W / duotone / contrast-bump / palette via SHA-256 idempotent cache)
- `slide-backgrounds-treated` Supabase Storage bucket + 7-day retention on orphan assets
- `src/lib/ai/slop-guardrails.ts` (Imagen prompt addendum + Pexels query addendum modules; single source of truth)
- Premium-template Inter audit (SLOP-05) — replace defaults in `magazine-bold.ts` and `documentary.ts`
- AI hook system-prompt addendum (forbid "In a world where" / "Did you know" / "Imagine if"; demand cross-slide variety)
- Imagen 4 Fast verification audit (already shipped — TREAT-04 success criterion is verify-only, not a code change)
- `download_zip` event tracking via existing `carousel_events` table (extend, do not parallel-create)
- One-shot `scripts/capture-zip-baseline.ts` writing `.planning/milestones/v2.9-METRIC-BASELINE.md`

**Out of scope (deferred to later phases):**
- Schema additions for `original_source_url` / `derived_palette` / `template_id_override` (Phase 55)
- New `renderGrain` / `renderVignette` resolver helpers (Phase 55)
- Font catalog expansion (Phase 55)
- Template `bodyFontFamily` validator extension (Phase 55, via SLOP-03)
- Editor UI for treatment overrides (Phase 57)
- New templates / decorative overlay library (Phase 56)
- Slide-role-aware AI / `match-photos-to-slides` (Phase 58)

</domain>

<decisions>
## Implementation Decisions

### Treatment library API surface

- **D-01: Ship all 4 presets in the `treat.ts` API surface** (`bw`, `duotone-cream`, `duotone-cobalt`, `contrast-bump`) but only `bw` and `contrast-bump` are wired into the generation pipeline by Phase 54. Duotones become available to templates in Phase 56 — the library work is the same regardless of how many call sites exist initially.
- **D-02:** `treatPhoto(sourceUrl, spec)` returns `{ url, palette: { Vibrant, DarkVibrant, ... } }`. Palette extraction in Phase 54 uses **`sharp.stats()`** (cheaper, no new dep, returns dominant + 3-cluster). `@vibrant/node` (named-role k-means) is added in Phase 57 when templates that consume named roles ship.
- **D-03: Cache key = SHA-256 of `(sourceUrl + JSON.stringify(spec))`**. Storage path: `${userId}/treated/${sha256}.png`. Cache hit returns existing public URL without re-running sharp.
- **D-04: `sharp.cache(false)` and `sharp.concurrency(1)` set at module import time** in a single config file (`src/lib/photo-treatment/sharp-config.ts`) imported first by `treat.ts`. Per Pitfall #5 — prevents serverless memory fragmentation.
- **D-05:** sharp version pinned to **`^0.33.x`** (latest stable as of 2026-05). Single new npm dep introduced this phase.

### Storage + schema

- **D-06: New public Supabase Storage bucket `slide-backgrounds-treated`** created via SQL migration mirroring the RLS policy of existing `slide-backgrounds`. Migration name: `2026MMDD_treated_backgrounds_bucket.sql`.
- **D-07: 7-day retention** on `slide-backgrounds-treated` enforced via `pg_cron` job that deletes objects untouched for 7+ days AND not referenced by any `projects.slide_data.*.background_url` (existing `pg_cron` infra from v2.4 Explore).
- **D-08: Phase 54 does NOT add `slide.original_source_url` to the slide schema** — that's Phase 55. For Phase 54, generation pipeline still writes treated URL directly to `slide.background_url`; re-treating compounds in this phase only (acceptable, no user-facing treatment override exists yet).

### AI-slop guardrails

- **D-09: Single source of truth at `src/lib/ai/slop-guardrails.ts`** exporting `IMAGEN_ADDENDUM` (string constant) and `pexelsQueryWithGuardrails(query: string)` (function that appends positive terms + excludes negative terms). All Imagen call sites (`generate-image.ts`, `services/ai-regen.ts`) and Pexels call site (`pexels/search-photos.ts`) import from here.
- **D-10:** `IMAGEN_ADDENDUM` content (locked verbatim — referenced in tests):
  > "Do not generate gradient backgrounds. Do not generate glossy 3D objects or abstract color blobs. Do not generate purple-to-blue, sunset orange-to-pink, or teal-to-navy gradients. Generate documentary-style photographs with naturalistic lighting."
- **D-11:** Pexels query enhancement: append ` natural lighting, candid, editorial, portrait` to query; Pexels API does not support negative-term exclusion natively, so we instead **filter the result set** post-fetch — drop photos whose `alt` text contains `meeting`, `office`, `team`, `smiling`, `diverse group`, `business meeting`, `group of people` (case-insensitive). If filtering drops all results, fall back to unfiltered first photo (never block generation).
- **D-12: AI hook system-prompt addendum** appended in `src/lib/ai/prompts.ts` to the existing premium-tier prompt assembly. Verbatim text:
  > "Do not start hooks with 'In a world where', 'Did you know', or 'Imagine if'. Vary hook openings across slides in the same carousel — no two slides should start with the same word or phrase pattern."

### SLOP-05 premium-template Inter audit

- **D-13: Two templates currently default to Inter** (verified via `grep`):
  - `src/lib/render/templates/magazine-bold.ts:19` — `fontFamily: "'Inter', sans-serif"`
  - `src/lib/render/templates/documentary.ts:29-30` — both `fontFamily` AND `headingFontFamily: "'Inter', sans-serif"`
- **D-14: Replacement font: Plus Jakarta Sans** (free Google Font, in v2.9 catalog plan). Update both files; re-run `npm run thumbs` to regenerate template thumbnails.
- **D-15:** v2.7 audit baseline (19/19 reqs in `.planning/milestones/v2.7-MILESTONE-AUDIT.md`) re-verified after font swap — premium-tier guardrails (length caps, typo gate, voice notes) unaffected by font change. If any tests break, revert the affected template to current Inter and document as a follow-up rather than blocking the phase.

### Imagen 4 Fast verification

- **D-16: Verify-only — no code change.** Audit confirmed Imagen 4 Fast (`imagen-4.0-fast-generate-001`) already used at all 3 call sites (`src/lib/imagen/generate-image.ts:33`, `src/lib/services/ai-regen.ts:67`, `src/lib/imagen/stylize-image.ts:80` — last one parked). Phase 54 plan includes a single audit task: grep for any remaining `imagen-3` / `imagen-2` references; assert none exist; document the verification in the phase summary.

### `download_zip` event + baseline

- **D-17: Extend the existing `carousel_events` table** (v2.4 Explore infrastructure, already used for view counts). Add new event type `'download_zip'`; payload via the existing `event_data jsonb` column. No new table, no parallel events store.
- **D-18:** Event fields in `event_data`: `{ project_id, slide_count, template_id, user_tier }`. Inserted from `downloadSlidesAsZip` server action immediately before returning the ZIP.
- **D-19: Admin/analytics query** in a new SQL view `v_zip_download_rate` returning `(window_start, window_end, downloads, projects_created, rate)`. Surfaced in admin dashboard only (not user-facing).
- **D-20: One-shot baseline-capture script** at `scripts/capture-zip-baseline.ts`. Reads `carousel_events` for the 30 days preceding script run, computes downloads/projects-created ratio, writes the result to `.planning/milestones/v2.9-METRIC-BASELINE.md` (one-line: "Baseline captured 2026-MM-DD: X.X% (N downloads / M projects)"). Runs once at end of Phase 54; baseline result committed to repo.

### Plan structure (rough — gsd-planner refines)

- **D-21:** Phase 54 splits into ~2 plans:
  - **Plan 54-01: Treatment foundation.** sharp install + `sharp-config.ts` + `treat.ts` + pure unit tests + bucket migration + retention `pg_cron` job.
  - **Plan 54-02: Guardrails + metric.** `slop-guardrails.ts` module + 4 call-site integrations (3 Imagen, 1 Pexels) + AI hook prompt addendum + SLOP-05 template font audit + Imagen 4 Fast verification audit + `carousel_events` `download_zip` event extension + `v_zip_download_rate` view + `capture-zip-baseline.ts` script + baseline file.

### Claude's Discretion

- Sharp transform implementation details (exact `linear()` matrices for B&W, exact `tint()` colors for duotones, contrast-bump `gamma`/`linear` parameters) — choose based on viral-aesthetic visual targets in `.planning/research/FEATURES.md`. Iterate during plan execution; lock in at code-review.
- Test coverage shape (unit-only vs unit+integration). Default: pure unit tests for `treat.ts` (no DB), one integration test for the storage round-trip.
- `pg_cron` retention job exact schedule (daily 03:00 UTC suggested; tweakable).
- Plan file ordering and inter-plan dependency boundaries.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (this milestone)
- `.planning/research/SUMMARY.md` — synthesized v2.9 thesis, Top 5 features, recommended phase plan, parked-experiments verdict
- `.planning/research/STACK.md` — sharp version, model choices, library decisions
- `.planning/research/ARCHITECTURE.md` — Satori parity invariant, build-order dependencies, schema integration points
- `.planning/research/PITFALLS.md` — sharp memory fragmentation (Pitfall #5), Vercel cost traps (Pitfall #11), AI-slop tells (Pitfall #3), pre-PMF discipline rules

### Requirements
- `.planning/REQUIREMENTS.md` §TREAT, §SLOP, §METRIC — Phase 54 requirement specifications
- `.planning/ROADMAP.md` §"Phase 54: Infrastructure Foundation" — goal + success criteria + dependency on Phase 53

### Existing infrastructure (do not duplicate)
- `src/lib/imagen/generate-image.ts` — current Imagen call site (already on imagen-4.0-fast-generate-001)
- `src/lib/services/ai-regen.ts` — secondary Imagen call site
- `src/lib/pexels/search-photos.ts` — current Pexels search wrapper
- `src/lib/ai/prompts.ts` — premium-tier prompt assembly (where AI hook addendum injects)
- `src/lib/render/templates/magazine-bold.ts:19` — Inter default to replace (SLOP-05)
- `src/lib/render/templates/documentary.ts:29-30` — Inter defaults to replace (SLOP-05)
- `supabase/migrations/20260427_explore_remix_phase29.sql` — `carousel_events` table definition (extend, don't replace)
- `supabase/migrations/20260427_explore_remix_phase31_cron.sql` — existing `pg_cron` infra pattern for the retention job

### External
- [vercel/satori#573](https://github.com/vercel/satori/issues/573) — CSS filter silent-drop justification (why we sharp pre-bake)
- [sharp issue #3052](https://github.com/lovell/sharp/issues/3052) — memory fragmentation justification (why `cache(false)` + `concurrency(1)`)
- [Imagen 4 release announcement](https://developers.googleblog.com/imagen-4-now-available-in-the-gemini-api-and-google-ai-studio/) — model verification reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`carousel_events` table + payload pattern** (v2.4 Explore) — already the project's events store. Adding `download_zip` event type is one-line.
- **`pg_cron` job pattern** (v2.4 Explore) — established for hourly aggregations and nightly cleanups; reuse for treated-bucket retention.
- **Storage bucket migration template** (`20260428_brand_kit_logos_bucket.sql`) — most recent example of a public bucket with per-user RLS; clone its shape for `slide-backgrounds-treated`.
- **`createAdminClient()`** (`src/lib/supabase/admin.ts`) — server-side admin client for storage uploads (used by Imagen + ai-regen + parked stylize); reuse for `treat.ts`.
- **`deductCredit()` + refund pattern** (`src/lib/credits/check-credits.ts`) — not used in Phase 54 (treatment is free; cost is one-time-per-source-photo via cache), but referenced as the cost-tracking pattern for future phases.

### Established Patterns
- **Single shared module → multi-site import** — v2.6's `src/lib/api/auth-core.ts` (Bearer auth shared between REST and MCP) is the exact pattern for `slop-guardrails.ts` (Imagen + Pexels guardrails shared across multiple call sites).
- **Idempotent SHA-256 cache key** — already used in `viralslidemaker-mcp` (caching tool definitions) and v2.4 fork RPC (slug uniqueness via hash). Phase 54's treat.ts uses the same shape.
- **`pg_cron` schedule strings** — established at `'0 3 * * *'` (daily 03:00 UTC) and `'0 * * * *'` (hourly) in v2.4. Pick one of these conventions for the retention job.
- **Migration file naming** — `YYYYMMDD_description.sql` (no time component, lowercase snake-case description).

### Integration Points
- **`downloadSlidesAsZip` server action** — where the `download_zip` event insert lands (one line before the response).
- **`generateCarousel` action** — where treated URLs replace raw Pexels URLs in the slide pipeline (Phase 54 wires this for newly-generated slides; existing slides remain on raw URLs until a user-driven re-treat in Phase 57).
- **`generateImagenBackground` (`src/lib/imagen/generate-image.ts:10`)** — Imagen call site that imports `IMAGEN_ADDENDUM` and concatenates to user prompt.
- **`searchPhotos` (`src/lib/pexels/search-photos.ts:11`)** — Pexels call site that wraps query through `pexelsQueryWithGuardrails()` and filters results.
- **Premium-tier prompt assembly in `src/lib/ai/prompts.ts`** — exact function name TBD by planner; this is where the AI hook variety addendum gets appended for premium templates.

### Don't Touch
- The 8 existing templates' overall layout / overlays / colors / sizes — Phase 54 only changes `fontFamily` defaults on `magazine-bold` and `documentary`. Everything else is reserved for Phase 55+.
- The `resolve-overlay.ts` 9-layer DOM stack — Phase 55 extends it; Phase 54 does not.
- Slide schema (`src/lib/types/slide.ts`) — Phase 55 extends it; Phase 54 does not.
- Editor UI / right rail — Phase 57.

</code_context>

<specifics>
## Specific Ideas

- **Treatment quality bar** = "looks like the photo was edited in VSCO Film 02 or Lightroom with a film preset, not a CSS filter." All 4 presets must pass this bar at code-review.
- **Cache hit measurement target** = >70% on a representative dev workload (re-generating the same prompt twice). If <70%, the cache key formula needs revisiting.
- **`magazine-bold` font swap reference** — visual goal is Murphy Campbell carousel reference (cited in v2.7 PROJECT.md). Plus Jakarta Sans should preserve that aesthetic; if it visually drifts, the planner can propose a different free Google Font.
- **No premature Phase 55 scope creep** — when implementing `treat.ts`, resist the temptation to also expose `original_source_url` writes. Phase 55 adds the schema field; Phase 54 keeps writes on `background_url`.

</specifics>

<deferred>
## Deferred Ideas

- **`@vibrant/node` named-role palette extraction** — adds a new dep; defer to Phase 57 when templates that consume named roles (Vibrant / DarkMuted) ship. `sharp.stats()` covers Phase 54 needs.
- **CSS-filter live-preview for treatment overrides** — would let editor preview show treatment without re-fetching from Storage. Not needed for Phase 54 (no editor UI ships); revisit in Phase 57 if perceptible lag is a problem.
- **Reverse-treatment cache (untreat)** — irrelevant; treatment is one-way (we always treat from `original_source_url`, never invert). Captured here so a future phase doesn't try to add an "undo treatment" feature.
- **Imagen 4 Standard ($0.04/img) for paid users** — research recommended Imagen 4 Fast ($0.02) for everyone. Standard tier is a post-PMF tier-pricing decision, not a v2.9 phase.
- **Variable-fonts** — Satori issues #162/#712 unresolved. Defer indefinitely.

</deferred>

---

*Phase: 54-Infrastructure Foundation*
*Context gathered: 2026-05-01*
