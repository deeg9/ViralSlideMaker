---
quick_task: fix-carousel-palette-divergence-across-d
quick_id: 260511-uk1
created: 2026-05-12
status: ready-for-planning
---

# Quick Task 260511-uk1: Carousel renders 3 different palettes across Dashboard / Explore index / Explore detail — Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Task Boundary

The same published carousel ("Cognitive Agency Surrender: AI's Impact on Your Brain") renders with three visibly-different color palettes across three surfaces, even though the user has NOT edited the project since publishing:

| Surface | URL | Bottom panel | Highlighted words ("BRAIN" / "AI") |
|---------|-----|--------------|------------------------------------|
| Dashboard "Recent Carousels" grid | `/dashboard` | Dark / near-black | **TEAL / cyan** |
| Explore index card | `/explore` | Dark navy | **RED** |
| Explore detail page | `/explore/<slug>` | **WHITE** | **YELLOW** |

The user's canonical expectation: all three surfaces should render the same as the Dashboard. This is a v2.13 LEGAL-03 / TPLREND-05 parity-invariant violation: identical inputs (same project row + same brandKit) must produce byte-identical visual output across every render path.

This is not a content-distribution problem — same `slide_data`, same image, same headline. It is a **palette / template source-of-truth divergence** caused by three independent render paths each picking a different template/brandKit combination.

</domain>

<investigation_findings>
## What we already confirmed via codebase scout

### Surface 1 — Dashboard (`/dashboard`)
- Route: `src/app/(dashboard)/dashboard/page.tsx` reads from `projects` table (`select('*')` — has `style_spec`, `template_id`, everything).
- Card: `src/components/projects/project-card.tsx:61` →
  ```ts
  const template = getTemplate(project.template_id ?? 'highlight-bar')
  ```
- Renderer: `<SlidePreview ... brandKit={brandKit ?? null} />` at line 152-161.
- **Suspected gap:** `SlidePreview` is the live React preview. At `src/components/slides/slide-preview.tsx:676`:
  ```ts
  const accentColor = template.accentColor ?? template.textColor
  ```
  It reads ONLY from the resolved template — there appears to be no call site that applies `mergeWithBrandKit(template, brandKit)` here, so the brandKit's accent override does NOT take effect in the dashboard preview. The first scout agent confirmed this: "no code in SlidePreview that applies the brandKit's accent color to override `template.accentColor`."
- Therefore the dashboard's TEAL is the **raw `template.accentColor` of the project's `template_id`** — no brandKit merge.

### Surface 2 — Explore index card (`/explore`)
- Route: `src/app/explore/page.tsx:43-47` queries `published_carousels` with SELECT list:
  ```
  id, slug, title, hero_image_url, tags, bookmark_count, remix_count, view_count, published_at, owner_id
  ```
- The card shows the pre-rendered `hero_image_url` PNG (NOT a live render).
- The hero PNG was rendered at publish time by `src/lib/services/publish.ts:44-71` (`renderHeroBuffer`):
  ```ts
  const template = project.template_id === BRAND_KIT_TEMPLATE_ID && brandKit
      ? synthesizeBrandKitTemplate(brandKit)
      : getTemplate(project.template_id ?? 'highlight-bar')
  const effectiveTemplate = mergeWithBrandKit(template, brandKit)
  ```
- **Therefore the hero PNG's RED is the `mergeWithBrandKit(template, brandKit).accentColor`** — the project's template_id WITH the user's brandKit override layered on top. The brandKit's accent must currently be red.
- **Key inference:** Dashboard SlidePreview skips the brandKit merge; publish.ts Satori path applies it. Same project, same brandKit → different colors. This is the load-bearing TPLREND-05 parity violation.

### Surface 3 — Explore detail page (`/explore/<slug>`)
- Route: `src/app/explore/[slug]/page.tsx`
  - Line 29-30: SELECT list omits BOTH `style_spec` AND `template_id`.
  - Line 77: `const template = getTemplate('highlight-bar')` — **hardcoded**. Always yellow `#FFD600` accent + white background.
- Renderer: `<CarouselSlideshow slides={c.slide_data} template={template} ... />` (line 98-102).
- `CarouselSlideshow` (`src/app/explore/[slug]/carousel-slideshow.tsx:26-40`) passes through `template` to `<SlidePreview editable={false} ... />` — no brandKit, no style_spec.
- **Therefore the detail page's WHITE+YELLOW is the raw `highlight-bar` template default.** It does not even attempt to honor what was published.

### Phase 78 snapshot gap
- Migration `supabase/migrations/20260510_v213_published_carousels_style_spec.sql` added `style_spec jsonb` + `reference_assets jsonb` to `published_carousels`. It DID NOT snapshot `template_id`.
- `publish.ts:165-189` writes `style_spec` + `reference_assets` into the snapshot but NOT `template_id`.
- Consequence: even if explore queries selected the snapshot, they couldn't reconstruct the template — the template_id wasn't preserved.

### `mergeWithBrandKit` and brandKit fetch
- `src/lib/brand-kit/get-effective-template.ts` defines `mergeWithBrandKit` + `synthesizeBrandKitTemplate`.
- Publish path fetches brandKit from somewhere in `publishProjectAdmin` (see `src/lib/services/publish.ts:141`) before calling `renderHeroBuffer`. Dashboard `ProjectCard` receives `brandKit` as a prop from `/dashboard` (which fetches it once per page load).
- The brandKit being applied is presumably the SAME user-level brandKit in both surfaces — that's why we know the divergence is structural (one applies the merge, the other doesn't).

</investigation_findings>

<decisions>
## Implementation Decisions (locked from user discussion)

### Edit-after-publish status
- User confirmed: **no post-publish edit**. The carousel was published with its current style and not modified afterward. Therefore the hero PNG's drift from the dashboard is a **real render-path divergence**, not snapshot-as-designed behavior.
- All three surfaces SHOULD match. Whichever palette is canonical, it must be applied consistently.

### Canonical render
- The Dashboard is what the user sees, expects, and considers "the truth." Whatever the Dashboard SlidePreview renders is the contract every other surface must match.
- **Implication:** The publish-time hero PNG and the Explore detail live render must produce visually-identical output to the Dashboard SlidePreview for the same project. That's the TPLREND-05 parity invariant restated for v2.13.

### Backfill scope
- User confirmed: **backfill existing published_carousels rows.** Add `template_id text` column; backfill via `UPDATE published_carousels SET template_id = (SELECT template_id FROM projects WHERE id = source_project_id) WHERE template_id IS NULL AND source_project_id IS NOT NULL`. Mirrors v2.13's additive-snapshot pattern; legacy rows where source project was deleted stay NULL and fall back to `'highlight-bar'`.

### Brand-kit merge parity question — DEFER the resolution to the planner
- The dashboard SlidePreview does NOT apply `mergeWithBrandKit`; publish.ts Satori path DOES. That's the structural source of the dashboard-vs-hero-PNG color difference.
- **Constraint for the planner:** Both render paths must agree on whether to apply `mergeWithBrandKit`. The planner must pick ONE of the following based on which is the existing design intent:
  - **Option A — Apply brandKit merge in SlidePreview too.** Live preview shows the user's brand-kit-overridden palette. Hero PNG and detail page already do this. Makes dashboard match the existing hero PNG output (which would mean the user's "teal" expectation gets replaced with the brandKit's actual accent — but the result is internally consistent).
  - **Option B — Stop applying brandKit merge at publish/render-satori unless an explicit per-project toggle is set.** Live preview is canonical; hero PNG matches it. Makes hero PNG match dashboard (TEAL). This is what the user's *complaint* implies they want, since they treat Dashboard as the source of truth.
  - **Option C — Investigate further:** there may be an existing per-project / per-template toggle (e.g., the `brand-kit-remix-toggle` component) that says "this project SHOULD apply brandKit." If so, the live preview's path is the bug — it ignores the toggle.
- The planner must read `src/lib/brand-kit/get-effective-template.ts`, `src/components/style-from-reference/brand-kit-remix-toggle.tsx`, and the publish flow to identify whether a per-project `useBrandKitRemix` flag exists and whether it's persisted. **Whatever the planner picks must restore the TPLREND-05 parity invariant: live SlidePreview and Satori `buildSlideElement` must produce identical output for identical inputs.**
- The planner should default to **Option B with a per-project opt-in flag** if it finds the brand-kit-remix-toggle component already implies a per-project setting — i.e., apply brandKit ONLY when the project explicitly set `useBrandKitRemix=true`, and ensure the same flag drives both render paths. This matches user expectation (Dashboard = canonical = TEAL) while keeping the brandKit feature opt-in.

### Hero PNG re-render for existing publishes
- After the publish-path fix lands, existing `published_carousels` rows will still carry their old (wrong) `hero_image_url` PNGs. Going forward, new publishes render correctly. **Out of scope for this quick task:** re-rendering historical hero PNGs in storage. Add a follow-up note to STATE.md so a separate task can handle backfill via admin script if the user wants it.
- For now: the user can republish their existing carousel to get a fresh hero PNG, OR we ship a one-shot admin endpoint as a follow-up.

</decisions>

<specifics>
## Specific File Targets

**New (migration + backfill):**
- `supabase/migrations/<TIMESTAMP>_v213_published_carousels_template_id.sql`
  - `ALTER TABLE public.published_carousels ADD COLUMN IF NOT EXISTS template_id text;`
  - One-shot UPDATE backfill from `projects.template_id` for rows where `source_project_id` is non-null and the row still exists. Add COMMENT ON COLUMN matching the Phase 78 style.
  - Mirror the safety posture of `20260510_v213_published_carousels_style_spec.sql` (nullable, additive, no rollback complications).

**Modify (publish path):**
- `src/lib/services/publish.ts` — write `template_id: project.template_id ?? null` into the insert at line ~178-190.
- If the planner picks Option B + opt-in: also write a `use_brand_kit_remix` boolean snapshot column (separate migration step if needed). Otherwise: existing brand-kit flow continues to apply to the hero PNG.

**Modify (Explore detail page):**
- `src/app/explore/[slug]/page.tsx` —
  - Line 29-31: add `style_spec, template_id` (and `use_brand_kit_remix` if applicable) to the SELECT list.
  - Line 77: replace `getTemplate('highlight-bar')` with `getTemplate(row.template_id ?? 'highlight-bar')`.
  - If the planner picks brandKit merge: fetch the owner's brandKit (or a snapshot of it) and apply `mergeWithBrandKit`.

**Modify (Explore index page):**
- `src/app/explore/page.tsx` — adding `style_spec`/`template_id` to the SELECT is OPTIONAL since the card just shows `hero_image_url`. Skip unless the planner finds a code path that benefits.

**Modify (SlidePreview parity — depends on planner's brandKit decision):**
- `src/components/slides/slide-preview.tsx` —
  - If Option A (apply brandKit in SlidePreview): wire `mergeWithBrandKit(template, brandKit)` around line 676 (and any sibling accent-color reads). Verify the change keeps TPLREND-05 parity tests passing.
  - If Option B (don't apply brandKit anywhere by default): no edits here, but verify publish.ts stops applying mergeWithBrandKit unless the per-project flag says to.

**Tests:**
- Add a focused regression test that asserts dashboard's SlidePreview render and publish.ts's `buildSlideElement` produce identical accent-color resolution for the same `(project, brandKit)` pair. Use the existing parity-test harness in `src/lib/render/__tests__/parity.*.test.tsx`.
- Update or add tests for `src/app/explore/[slug]/__tests__/` (if any) that pin the detail page reading the snapshot's `template_id`.

**Out of scope (explicit non-goals):**
- Re-rendering hero PNGs for historical published carousels. Add a follow-up note.
- Changing the brandKit feature semantics broadly. Whatever decision the planner makes must be surgical and reversible.
- Adding a new template family or modifying any existing template's accent palette.
- Touching the Phase 78 snapshot semantics for `style_spec` and `reference_assets` (those are correct; we only fix the `template_id` gap and the consumer-side reads).

</specifics>

<canonical_refs>
## Canonical References

- **Phase 78 CONTEXT** — `.planning/phases/78-remix-fork-publish-snapshot/78-CONTEXT.md` — design of `published_carousels` snapshot.
- **Phase 78 migration** — `supabase/migrations/20260510_v213_published_carousels_style_spec.sql` — pattern to mirror for the new `template_id` column.
- **Publish path** — `src/lib/services/publish.ts` (especially `renderHeroBuffer` lines 44-71 and the insert at 165-189).
- **Live preview** — `src/components/slides/slide-preview.tsx:676` (the accentColor read site).
- **Satori path** — `src/lib/render/render-slide-satori.tsx` (`buildSlideElement` at line 109).
- **TPLREND-05 parity tests** — `src/lib/render/__tests__/parity.*.test.tsx` — the load-bearing parity invariant for v2.13.
- **BrandKit merge** — `src/lib/brand-kit/get-effective-template.ts` — `mergeWithBrandKit` + `synthesizeBrandKitTemplate`.
- **Detail page renderer** — `src/app/explore/[slug]/carousel-slideshow.tsx` — currently passes hardcoded template through.

</canonical_refs>

<scope_boundary>
## Out of scope (explicit non-goals)

- Backfill / re-render of historical hero PNGs (note as a follow-up).
- Restructuring or replacing the Phase 78 snapshot model.
- Adding new templates or modifying existing template definitions.
- Cross-region brandKit semantics or i18n changes.
- Performance optimizations to the live preview or Satori render path.
- Touching the Phase 79 LEGAL-03 "Inspired by" framing or any of the v2.13 LEGAL constraints.

</scope_boundary>
