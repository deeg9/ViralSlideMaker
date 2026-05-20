---
milestone: v2.16
milestone_name: Picker Polish & Brand-Kit Shelving
created: 2026-05-20
status: scoped
---

# v2.16 Requirements — Picker Polish & Brand-Kit Shelving

**Goal:** Make the template picker visually represent what users will actually generate (real photo backgrounds, not text-on-solid-color), and shelve the brand-kit feature that's no longer part of the near-term direction.

## Locked Decisions

- **Brand-kit DB data is left dormant.** No forward migration drops `brand_kit` columns or rows. The `20260427_brand_kit_template.sql` migration is marked SHELVED. Reversibility is the priority — if brand-kit returns later, we re-wire against the same schema.
- **Preview photos are sourced from `christopherfill9@gmail.com`'s own published carousels.** One published cover per template, snapshotted and uploaded to the existing `template-previews` Supabase Storage bucket. For templates that have no existing project on that account, the pipeline (or the operator) generates a new carousel on that account using that template, then snapshots its cover. This treats Diego's pro account as the canonical "good-looking exemplar" source — sidesteps stock-photo licensing, guarantees the preview is what generation actually produces today.
- **`<SlidePreview>` fallback is fully deleted.** After phase 90, every code template MUST have a `preview` URL. The picker tile becomes a single-branch `<img>` component; `makeSampleSlide` is no longer called from the picker. Acts as a forcing function — a new code template can't ship without first rendering its preview.

## Active Requirements

### Brand-Kit Shelving (BKSHELVE-*)

Full removal of the brand-kit feature from the user-facing app and the type/render/AI pipelines. DB schema is left in place (dormant).

- [ ] **BKSHELVE-01** — User no longer sees the "Your Brand Kit" tile (configured or empty-state CTA) in the template picker on the project page.
- [ ] **BKSHELVE-02** — Settings → Brand Kit page is removed: nav link in `src/app/(dashboard)/settings/layout.tsx` deleted, `src/app/(dashboard)/settings/brand-kit/` directory removed, navigating to `/settings/brand-kit` returns 404.
- [ ] **BKSHELVE-03** — `/api/v1/me/brand-kit/*` routes removed (`route.ts` + `logo-upload-url/route.ts`); calls return 404. The `/api/v1/me/brand-kit` schema is removed from `src/lib/api/openapi.ts`.
- [ ] **BKSHELVE-04** — Carousel generation works without a brand-kit param in all code paths (`generation-form.tsx`, `actions.ts`, `carousel.ts`). Removed from props, type unions, request bodies. Public API request schema no longer accepts the field.
- [ ] **BKSHELVE-05** — Render parity preserved: byte-identity check on all 13 code templates + the live DB-backed templates currently in `templates` table on production. The 3 fixture suites stay GREEN at 45/45. No new fixture regen required.
- [ ] **BKSHELVE-06** — Style-from-reference flow works without the brand-kit remix toggle: `src/components/style-from-reference/brand-kit-remix-toggle.tsx` deleted, the toggle is removed from the shell, the `state-machine.ts` no longer threads a `useBrandKitRemix` field, and generation from a style spec doesn't merge with brand kit.
- [ ] **BKSHELVE-07** — Publish/fork/download paths free of brand-kit references: `publish-actions.ts`, `publish.ts`, `download/route.ts`, `render/route.ts` all stripped of `BRAND_KIT_TEMPLATE_ID` / `synthesizeBrandKitTemplate` / `mergeWithBrandKit`. Existing projects whose `project.template_id === 'brand-kit'` fall back to a sensible default template (e.g. `news-oracle`) at resolve time — they don't crash.
- [ ] **BKSHELVE-08** — AI prompts no longer include brand-kit merge logic: `src/lib/ai/style-spec-brand-kit-merge.ts` and its tests deleted; `prompts.ts` and `style-spec-projector.ts` no longer reference brand kit. Generated copy is unchanged for users who never configured a brand kit (the vast majority — verified by snapshot regression).
- [ ] **BKSHELVE-09** — `src/lib/brand-kit/` directory + `src/lib/types/brand-kit.ts` deleted. All `import` references across the 79-file footprint resolved (either removed or replaced).

### Pre-Rendered Template Previews (PREVIEW-*)

Replace the picker's live-render fallback with real photo-backed previews sourced from Diego's own published carousels.

- [ ] **PREVIEW-01** — Every one of the 15 code templates in `src/lib/render/templates/*.ts` has a `preview` field set to a public Supabase Storage URL. The URL points to a PNG that depicts the template with a real photo background + representative sample text.
- [ ] **PREVIEW-02** — All 15 preview PNGs are sourced from carousels on the `christopherfill9@gmail.com` account. The operator (or a one-off script) identifies the per-template gap, generates a carousel on that account for any missing templates, and uses the cover slide of each carousel as the preview.
- [ ] **PREVIEW-03** — A one-off `scripts/render-template-previews.ts` (or equivalent) automates: (a) querying the account's projects to identify which templates already have an exemplar carousel, (b) snapshotting cover slides via the existing render pipeline, (c) uploading PNGs to `template-previews` Supabase bucket with deterministic paths (`code-templates/{slug}.png`), and (d) writing public URLs back into each code-template source file. Idempotent — re-running on an unchanged set is a no-op.
- [ ] **PREVIEW-04** — `<TemplateTilePreview>` is simplified to a single-branch `<img>` component (or `next/image`). The `<SlidePreview>` fallback branch and the `makeSampleSlide` import in `template-tile-preview.tsx` and `template-picker.tsx` are deleted.
- [ ] **PREVIEW-05** — Playwright smoke against the project picker confirms (a) all 15 code templates render as `<img>` elements with valid `src` URLs, (b) live DB templates from `templates` table also render via the `<img>` path, (c) no broken-image regressions. Existing `template-picker.test.tsx` is updated to assert the new contract.

## Out of Scope (v2.16)

- **Custom photo per slide-in-picker (multiple sample variants).** Each template gets exactly one preview. Per-slide variants come later if needed.
- **Animated/video previews.** Static PNG only — matches the existing `template.preview` contract.
- **Rolling preview refresh / cron.** This is a one-off render at milestone time. If a template's design changes, the operator re-runs the script. No scheduled refresh.
- **Rolling back the brand-kit migration.** Migration stays in the migrations folder marked SHELVED. Future un-shelving can rewire against the same schema.
- **Brand-kit feature flag instead of removal.** Removal is full and forward-only. A future revival rebuilds against the schema rather than toggling old code on.
- **Premium-template indicator overlay on previews.** Existing premium-tier marker logic stays as-is; we're not redesigning the picker chrome, only the tile body.
- **Picker layout changes** (number of columns, sort order, category chips). Only the tile preview body changes.

## Traceability

To be filled by `gsd-roadmapper` after roadmap creation.

| REQ ID | Phase | Status |
|--------|-------|--------|
| BKSHELVE-01..09 | TBD | Open |
| PREVIEW-01..05 | TBD | Open |
