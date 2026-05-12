---
quick_task: fix-carousel-palette-divergence-across-d
quick_id: 260511-uk1
created: 2026-05-12
completed: 2026-05-12
status: complete
---

Shipped: closed a Phase 78 snapshot-column gap and two consumer bugs in one quick task. Carousel palette divergence across Dashboard / Explore index hero / Explore detail is structurally resolved for every new publish; legacy rows continue to render with their pre-uk1 fallback (highlight-bar) until republished.

## What shipped (4 tasks, 7 files)

**Snapshot column + idempotent backfill — supabase/migrations/20260512_v213_published_carousels_template_id.sql** (new)
- `ALTER TABLE public.published_carousels ADD COLUMN IF NOT EXISTS template_id text;` (additive, nullable, re-runnable).
- One-shot `UPDATE … FROM public.projects` backfill guarded by `pc.template_id IS NULL AND pc.source_project_id IS NOT NULL` — idempotent; rows whose source project was deleted stay NULL.
- COMMENT ON COLUMN citing quick-260511-uk1, mirrors Phase 78 REMIX-01 column-comment style. Header-comment block includes verification SQL (info_schema check, unbackfilled-row count, legacy-NULL check).

**Fork RPC inherits template_id — supabase/migrations/20260512_v213_fork_inherits_template_id.sql** (new)
- `CREATE OR REPLACE FUNCTION public.fork_published_carousel(uuid)` — function body copied verbatim from 20260510_v213_fork_inherits_style_spec.sql with one line changed: the hardcoded `'bold-minimal'` becomes `COALESCE(pub.template_id, 'bold-minimal')`.
- Trailing `GRANT EXECUTE … TO authenticated` preserved (idempotent insurance even though CREATE OR REPLACE keeps the v2.4 grant).
- Header-comment verification SQL covers both inheritance + COALESCE-fallback paths.

**Publish path writes the snapshot — src/lib/services/publish.ts** (modified)
- `template_id: project.template_id ?? null` added to the `publishProjectAdmin` `.insert({…})` payload, directly after `reference_assets: referenceAssetsSnapshot,`.
- Single-line behavioral change + 7-line citation comment. `mergeWithBrandKit` + `buildSlideElement` + `renderHeroBuffer` left untouched — the Option B decision lock requires no render-layer change in the publish path.

**Publish regression test — src/lib/services/\_\_tests\_\_/publish-template-id-snapshot.test.ts** (new, 234 LOC)
- 3 tests: non-null template_id flows through INSERT; null project.template_id flows through as null; stored value is a plain string (not JSON-stringified — the text column would accept either but the contract is explicit). Mirrors the hoisted-mocks + hand-rolled SupabaseClient pattern from publish-style-spec-snapshot.test.ts.
- RED commit (96e2812): 0/3 passing on pre-uk1 code. GREEN commit (4ab46d4): 3/3 passing after the publish.ts edit.

**Explore detail page reads the snapshot — src/app/explore/[slug]/page.tsx** (modified)
- SELECT projection appends `, template_id` (line 30).
- Inline row-type annotation widens to include `template_id: string | null` (line 51).
- `getTemplate('highlight-bar')` becomes `getTemplate(c.template_id ?? 'highlight-bar')` (line 85, with a 7-line citation comment immediately above).

**Explore detail static source-grep test — src/app/explore/[slug]/\_\_tests\_\_/page-template-id.test.ts** (new, 84 LOC)
- 4 tests against a comment-filtered copy of page.tsx (Node `readFileSync` of the source string): SELECT contains template_id; getTemplate uses the `c.template_id ?? 'highlight-bar'` fallback; the bare `getTemplate('highlight-bar')` form is gone; row type carries `template_id: string | null`.
- Comment filter strips both full-`//` lines AND lines containing the literal `260511-uk1` — defends against the self-invalidating grep-gate anti-pattern where header-comment text containing the literal `getTemplate('highlight-bar')` would falsely satisfy the negative grep. Same posture as the PCL grep gates.
- RED commit (ef26e5a): 0/4 passing on pre-uk1 page.tsx. GREEN commit (047b0f6): 4/4 passing after the three page.tsx edits.

**TPLREND-05 parity pin — src/lib/render/\_\_tests\_\_/parity.quick-260511-uk1-snapshot-template.test.tsx** (new, 163 LOC)
- 24 parity assertions (12 templates × 2 renderers) + 1 registry-sanity gate = 25 tests total. All GREEN.
- For every built-in template, asserts `fingerprint(renderer, brandKitFixture) === fingerprint(renderer, null)` independently for SlidePreview AND for buildSlideElement (Satori). The brandKit fixture leaves `logo_url + logo_position null` so `resolveWatermark` short-circuits to null identically across both arms — isolating the assertion to the accent-color / mergeWithBrandKit-no-op surface (the actual decision-lock subject).
- Cross-renderer parity (SlidePreview ↔ Satori) intentionally NOT re-asserted here — PTF74 (parity.style-spec-absent-baseline.test.tsx, 74 tests) already pins that invariant for the same 12 templates. Per the plan's adaptation guidance, this test scopes strictly to "per-renderer is brandKit-independent."
- If a future PR re-introduces a render-time brand-kit color override on a built-in template, at least one of these 24 tests turns red at PR time.

## Option B decision lock (BRAND-KIT-MERGE-PARITY) — held

Locked in the plan frontmatter (`decision_lock.id: BRAND-KIT-MERGE-PARITY`, OPTION B) and pinned here as a regression test. The lock rationale rests on direct code evidence — not a stylistic preference:

- `src/lib/brand-kit/get-effective-template.ts:35-40` — `mergeWithBrandKit` is **already** a no-op passthrough for any built-in template after quick-260510-brand-kit-scope. The function body is `return template`; the JSDoc explicitly says "brand kit overrides ONLY apply to the synthesized brand-kit template (id === BRAND_KIT_TEMPLATE_ID). For any built-in template, this is now a passthrough."
- `src/components/slides/slide-preview.tsx:676` and `src/lib/render/render-slide-satori.tsx:193` both read the IDENTICAL expression `template.accentColor ?? template.textColor` — TPLREND-05 parity holds at the render layer by construction; the brandKit prop is consulted only for watermark resolution (`resolveWatermark`), which is gated on `brandKit.logo_url` and short-circuits to null when absent.
- `src/lib/services/publish.ts:62` calls `buildSlideElement(slide, effectiveTemplate, brandKit, …)` but `effectiveTemplate` IS the original template (because `mergeWithBrandKit` is a no-op for built-ins) — the brandKit param is threaded onward into the Satori build for the watermark gate only; it does not enter the accent-color path.

The TRUE root causes of the user's reported divergence were therefore (a) the Phase 78 template_id-snapshot column gap (closed by Task 1 + Task 2) and (b) the hardcoded `getTemplate('highlight-bar')` in `src/app/explore/[slug]/page.tsx:77` (closed by Task 3). Neither root cause lives in the brand-kit-merge path — picking Option A (re-enable merge in SlidePreview) or Option C (add a per-project `useBrandKitRemix` render-time flag) would have re-introduced the regression that quick-260510-brand-kit-scope deliberately removed, while leaving the actual snapshot + consumer bugs unfixed.

## Files modified / created

| Status | Path | LOC |
|---|---|---|
| new | supabase/migrations/20260512_v213_published_carousels_template_id.sql | 87 |
| new | supabase/migrations/20260512_v213_fork_inherits_template_id.sql | 117 |
| modified | src/lib/services/publish.ts | +9 |
| new | src/lib/services/\_\_tests\_\_/publish-template-id-snapshot.test.ts | 234 |
| modified | src/app/explore/[slug]/page.tsx | +8 / -2 |
| new | src/app/explore/[slug]/\_\_tests\_\_/page-template-id.test.ts | 84 |
| new | src/lib/render/\_\_tests\_\_/parity.quick-260511-uk1-snapshot-template.test.tsx | 163 |

## Migration filenames

Both migrations use the `20260512` date prefix matching the init.quick `created: 2026-05-12` date — one day after the latest pre-existing migration (`20260511_v213_credit_type_extract_style.sql`).

- `supabase/migrations/20260512_v213_published_carousels_template_id.sql` (apply first — adds the column)
- `supabase/migrations/20260512_v213_fork_inherits_template_id.sql` (apply second — extends the RPC that reads the column; would fail if the column doesn't exist yet)

Both are idempotent + additive + nullable; no rollback complications.

## Parity-test contract pinned in Task 4

For each of the 12 templates in `src/lib/render/templates/index.ts:templates`:

```
fingerprint(SlidePreview(slide, template, brandKitFixture)) === fingerprint(SlidePreview(slide, template, null))
fingerprint(buildSlideElement(slide, template, brandKitFixture)) === fingerprint(buildSlideElement(slide, template, null))
```

where `brandKitFixture` populates vivid `primary_color / secondary_color / accent_color / text_color / background_color` values that WOULD tint a template if `mergeWithBrandKit` weren't a no-op, but leaves `logo_url + logo_position` null so `resolveWatermark` returns null identically in both arms. Same `(slide, template)` input ⇒ same rendered fingerprint regardless of brandKit. This is Option B in test form.

## Commits

| Task | Hash | Type | Description |
|---|---|---|---|
| 1 | 8cbb0f0 | chore | Migrations — published_carousels.template_id column + fork RPC inherits via COALESCE |
| 2 (RED) | 96e2812 | test | RED — publish-template-id-snapshot 3 tests failing on pre-uk1 publish.ts |
| 2 (GREEN) | 4ab46d4 | feat | publish.ts INSERT writes `template_id: project.template_id ?? null` (3/3 GREEN) |
| 3 (RED) | ef26e5a | test | RED — page-template-id 4 tests failing on pre-uk1 page.tsx |
| 3 (GREEN) | 047b0f6 | fix | page.tsx reads snapshotted template_id with highlight-bar fallback (4/4 GREEN) |
| 4 | c91096f | test | TPLREND-05 parity pin — 24 + 1 sanity = 25 tests GREEN; PTF74 baseline (74 tests) unchanged |

## Verification

- All four task verify gates pass.
- 32 new tests across 3 new test files — all GREEN (3 publish + 4 explore-detail + 24 parity + 1 registry-sanity).
- PTF74 baseline (parity.style-spec-absent-baseline.test.tsx, 74 tests) unchanged: 74/74 GREEN — no snapshot regenerations needed.
- publish-style-spec-snapshot.test.ts unchanged: 4/4 GREEN — no Phase 78 regression.
- `npx tsc --noEmit` returns 19 errors (see Deviations below); none in files touched by this plan.
- Static migration verification gates: `ADD COLUMN IF NOT EXISTS template_id text` appears once; `COALESCE(pub.template_id, …)` appears in the fork RPC. Both citations of `quick-260511-uk1` present in each migration header.

## Deviations from plan

1. **Task 3 — SELECT-regex tightening during GREEN (Rule 1, minor).** The plan's draft RED regex (`…['"]([^'"]+)['"]\s*\)`) didn't account for the existing Next.js / supabase trailing-comma style (`'…',\n    )`). On the unedited page.tsx, the SELECT projection already used the trailing-comma form — meaning the plan's draft regex would have failed to match even after the fix. I relaxed the regex to `…['"]([^'"]+)['"]\s*,?\s*\)` in the same RED test file (committed as part of the GREEN edit, ef26e5a → 047b0f6). The CONTRACT assertion (`selectMatch![1].toContain('template_id')`) is preserved verbatim — the regex change only allows the trailing comma that's standard in this codebase. The test still RED'd on pre-uk1 page.tsx for the right reason (no template_id in the captured projection string).

2. **Task 4 — 25 tests total instead of 24 (Rule 2, additive).** The plan's "done" criteria said "24 tests total." I added a 25th test — a registry-sanity gate (`expect(templates).toHaveLength(12)`) at the top of the describe block, mirroring PTF74's identical sanity floor. If a future milestone grows the registry past 12, the matrices iterate the new template automatically AND this gate flags the addition for deliberate Option-B review. The 24 parity assertions specified in the plan are unchanged.

3. **tsc --noEmit baseline drift (informational, NOT introduced by this plan).** The plan's "done" criteria said "17 baseline errors UNCHANGED." Current `npx tsc --noEmit` returns 19 errors — all in unrelated test files (api-keys, auth, stripe, slide-editor, legal, projects-delete). None are in files modified or created by this plan. The 17 → 19 drift comes from upstream commits between the plan's scout-time count and execute time; no new tsc errors are introduced by this work.

## Known stubs / follow-ups

### Out of scope: hero PNG re-render for historical published_carousels rows
Existing `published_carousels` rows retain their pre-uk1 `hero_image_url` PNGs — those were rendered by `renderHeroBuffer` BEFORE this plan landed. New publishes after this plan deploys will render correctly (correct template_id flows through `renderHeroBuffer`'s `getTemplate(project.template_id ?? 'highlight-bar')` call). To re-render historical hero PNGs, a separate admin script is needed: iterate over `published_carousels`, fetch source project, re-call `renderHeroBuffer` with the current template_id, upload to `hero-thumbnails`, UPDATE the row's `hero_image_url`. Users can republish their carousel to get a fresh hero in the meantime. This is **out of scope for this quick task** and can be done in a future quick task; the plan's `follow_up.hero-png-backfill` block carries the same note for future planners.

### Out of scope: Explore index card SELECT projection
`src/app/explore/page.tsx:43-47` intentionally unchanged — the index card renders `hero_image_url` (a pre-baked PNG) with no live render path. Adding `template_id` to the SELECT would load bytes no consumer reads. If a future feature adds a live mini-preview to the index card, that plan should add the columns then.

## Self-Check: PASSED

- `git log --oneline | grep 8cbb0f0` — FOUND (Task 1 commit)
- `git log --oneline | grep 96e2812` — FOUND (Task 2 RED commit)
- `git log --oneline | grep 4ab46d4` — FOUND (Task 2 GREEN commit)
- `git log --oneline | grep ef26e5a` — FOUND (Task 3 RED commit)
- `git log --oneline | grep 047b0f6` — FOUND (Task 3 GREEN commit)
- `git log --oneline | grep c91096f` — FOUND (Task 4 commit)
- `supabase/migrations/20260512_v213_published_carousels_template_id.sql` — FOUND
- `supabase/migrations/20260512_v213_fork_inherits_template_id.sql` — FOUND
- `src/lib/services/__tests__/publish-template-id-snapshot.test.ts` — FOUND
- `src/app/explore/[slug]/__tests__/page-template-id.test.ts` — FOUND
- `src/lib/render/__tests__/parity.quick-260511-uk1-snapshot-template.test.tsx` — FOUND
