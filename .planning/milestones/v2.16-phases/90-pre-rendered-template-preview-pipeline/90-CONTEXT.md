# Phase 90: Pre-Rendered Template Preview Pipeline - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — user chose ROADMAP as spec)

<domain>
## Phase Boundary

Replace the template picker's live-render `<SlidePreview>` fallback with real photo-backed preview PNGs. Every one of the 15 code templates gets a `preview` URL pointing to a Supabase Storage PNG that depicts the template the way it actually generates — with a real photo background + representative sample text. The picker tile becomes a single-branch `<img>` component.

Maps requirements PREVIEW-01 through PREVIEW-05 (see `.planning/REQUIREMENTS.md`).

</domain>

<decisions>
## Implementation Decisions

These are LOCKED from `.planning/REQUIREMENTS.md` "Locked Decisions" + the milestone scope + a user decision captured at phase-90 dispatch — do not revisit:

### Preview photos are sourced from `buyer@example.com`'s own published carousels
One published cover slide per template, snapshotted and uploaded to the existing `template-previews` Supabase Storage bucket. The pipeline identifies, per template, whether that account already has a carousel using it. For templates with **no** exemplar carousel on that account, the pipeline generates a new carousel on that account using that template, then snapshots its cover. This treats Diego's pro account as the canonical "good-looking exemplar" source — it sidesteps stock-photo licensing and guarantees the preview is what generation actually produces today.

### Full autonomous run, INCLUDING the live preview run (user decision, 2026-05-20)
The user explicitly approved running the pipeline end-to-end during this autonomous execution — including: querying the `buyer@example.com` account, generating new carousels for templates that lack an exemplar (this incurs real Gemini API spend), uploading PNGs to Supabase Storage, and wiring the resulting URLs into the code-template source files. The executor should run the live pipeline, not just build it and defer. It MAY still pause if it hits an un-automatable auth gate (e.g. Supabase credentials missing/invalid in `.env.local`).

### `<SlidePreview>` fallback is fully deleted
After this phase, every code template MUST have a `preview` URL. `src/components/slides/template-tile-preview.tsx` becomes a single-branch `<img>` component; the `<SlidePreview>` fallback branch and the `makeSampleSlide` import are deleted from it. A new code template cannot ship without first rendering its preview — this is the intended forcing function.

### One-off pipeline, idempotent
`scripts/render-template-previews.ts` (or equivalent) is a one-off render at milestone time — NOT a scheduled refresh. Re-running it on an unchanged set is a no-op. If a template's design changes later, the operator re-runs the script.

### Claude's Discretion
All other implementation choices — the exact script structure, how to query the account's projects, the deterministic storage path scheme (`code-templates/{slug}.png` is suggested in REQUIREMENTS.md), whether to reuse `renderCoverPreviewPng` from `src/lib/render/preview-render.ts`, how to detect a template's "exemplar" carousel, and how to wire the `preview` URL onto each code-template definition — are at Claude's discretion. Use the ROADMAP phase goal, success criteria, REQUIREMENTS.md, RESEARCH.md, and existing codebase conventions.

</decisions>

<code_context>
## Existing Code Insights

- **Picker tile component:** `src/components/slides/template-tile-preview.tsx` — currently has a two-branch body: if `template.preview` is a non-empty string → render `<img>`; else → `<SlidePreview slide={makeSampleSlide(template)} .../>`. Phase 89 already removed the brand-kit tile from `template-picker.tsx`. Phase 90 deletes the `<SlidePreview>` fallback branch + the `makeSampleSlide` import here.
- **The 15 code templates:** `src/lib/render/templates/*.ts` — `bold-yellow`, `brutalist-grid`, `chrome-pulse`, `documentary`, `editorial-serif`, `highlight-bar`, `magazine-bold`, `news-cyan`, `news-drop`, `news-oracle`, `notes-app-chic`, `paper-essay`, `soft-sage`, `sunset-tabloid`, `tr3nding-news`. Each has a `preview?` field on the `SlideTemplate` type (added in v2.14 phase 86; currently unset for code templates). (`db-template-row.ts`, `decorative.ts`, `premium-tier.ts`, `validate.ts`, `index.ts`, `registry.ts` are NOT templates — skip them.)
- **The `template-previews` Supabase Storage bucket** already exists — migration `supabase/migrations/20260519_phase86_template_previews_bucket.sql` (v2.14 phase 86). DB templates already store preview PNGs there.
- **`renderCoverPreviewPng`** — a reusable Satori single-slide cover-render pipeline lives in `src/lib/render/preview-render.ts` (v2.14 phase 86). Used by `POST /api/admin/templates`. Phase 90's pipeline can likely reuse it to snapshot a cover.
- **`getPickerDbTemplates` / `resolveTemplate`** — the merged code+DB registry from v2.14/v2.15 lives in `src/lib/render/templates/registry.ts`.
- **Account note:** `buyer@example.com` is Diego's PRO account (per project memory `reference_dev_accounts.md` — distinct from the `seller@example.com` free dev account). The pipeline queries projects by that account's Supabase user id. Supabase is remote-only — there is no local DB.

The phase-researcher and pattern-mapper will produce the authoritative integration map during plan-phase.

</code_context>

<specifics>
## Specific Ideas

- Reuse `renderCoverPreviewPng` (`src/lib/render/preview-render.ts`) for the cover snapshot rather than building a new render path — keeps render parity with the v2.14 DB-template preview path.
- Deterministic storage path: `template-previews/code-templates/{slug}.png` (suggested in REQUIREMENTS.md) so re-runs overwrite-in-place (idempotent).
- Wire the resulting public URL onto each code template's `preview` field in `src/lib/render/templates/{slug}.ts`.
- After wiring, `<TemplateTilePreview>` collapses to a single `<img>` branch — verify with a Playwright picker smoke (all 15 code tiles + live DB tiles render `<img>` with valid `src`, no broken images). Per project memory `feedback_playwright_react_clicks`, use `mcp__playwright__browser_click` (not eval-side `.click()`) for any React interaction in the smoke.
- The live run touches a real account + real Gemini spend — keep generation minimal: one carousel per missing template, smallest viable slide count.

</specifics>

<deferred>
## Deferred Ideas

- Per-slide / multi-variant previews — out of scope (one preview per template).
- Animated or video previews — out of scope (static PNG only).
- Scheduled / cron preview refresh — out of scope (one-off render; operator re-runs on redesign).
- Premium-tier picker chrome redesign, picker layout changes — out of scope (only the tile preview body changes).

</deferred>
