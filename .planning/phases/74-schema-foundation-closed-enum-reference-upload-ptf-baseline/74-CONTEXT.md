# Phase 74: Schema Foundation + Closed-Enum + Reference Upload + PTF Baseline - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Smart-discuss — most decisions locked in REQUIREMENTS.md/SUMMARY.md/research; remaining grey areas covered below

<domain>
## Phase Boundary

Land the load-bearing foundation for v2.13: the `StyleSpec` contract (with closed-enum invariant as primary architectural defense), the reference-upload pipeline (signed-URL upload to new `slide-references` bucket), the persisted-spec storage shape (`projects.style_spec` + `projects.reference_assets` JSONB columns), and the byte-identity PTF baseline that locks legacy projects against regression BEFORE any vision-extraction code lands in Phase 75.

22 reqs in scope, organized in two distinct surfaces:
- **Foundation (15 reqs):** STYLESPEC-01..12 (schema + closed-enum + Zod validator + zero new Slide fields + PTF baseline) + PARITY-01 (PTF baseline lock) + PARITY-03 (silent-drop counter at ingest boundary) + PARITY-05 (CI grep gate for closed-enum invariant)
- **Upload pipeline (7 reqs):** REF-01..07 (slide-references bucket + signed-URL upload pattern + 1–8 image limit + drag-drop UI + MIME/size validation + upload ≠ extraction trigger + reference_assets JSONB column)

These two surfaces have NO file-overlap and CAN ship in parallel waves. The planner is free to split them across multiple plans within the same phase OR into a Phase 74.1 / 74.2 split if it produces > 5 plans (per roadmapper watchlist).

**Closed-enum schema is THE primary architectural principle** — defends against both legal exposure (no `reference_artist` free-text) AND prompt-injection-via-image-text (no landing zone for "ignore previous instructions"). Phase 74 ships this as load-bearing, NOT a security afterthought. PARITY-05 grep gate enforces the invariant in CI.

</domain>

<decisions>
## Implementation Decisions

### Locked specs (from REQUIREMENTS.md + research SUMMARY.md)
- **Bucket name:** `slide-references` (matches existing `slide-*` prefix); private; per-user folder structure `{user_id}/{ref_id}.{ext}`
- **Upload pattern:** signed-URL upload directly browser→Storage (mirror `brand-kit/logo-upload-url/route.ts`); avoids 4MB Vercel body cap
- **Accepted MIME types:** image/png, image/jpeg, image/webp, image/heic
- **Max file size:** 20MB per file pre-preprocessing (sharp from Phase 73 will downscale to ≤1024×1024)
- **Image count cap:** 1–8 per generation (Phase 73 rate-cap enforces 3/call free-tier; UI allows 1–8 because premium-tier-future may have higher cap)
- **Schema location:** `src/lib/types/style-spec.ts` (separate from `Slide` type)
- **DB columns added:** `projects.style_spec jsonb` (nullable) + `projects.reference_assets jsonb` (nullable)
- **`reference_assets` shape:** `[{url, sha256, uploaded_at}, ...]` for provenance + remix support
- **Closed-enum sources (all four anchors verified by research):**
  - `palette.mode`: `solid | duotone | gradient | photo`
  - `typography.hookFontCategory`: 4-font catalog (verify exact list from existing font config)
  - `decorations.preferredLucide`: v2.12 100-icon allowlist (existing constant)
  - `decorations.preferredShapes`: v2.12 8-shape primitive set (existing enum)
  - `layout.hookPosition`: existing `text_position` enum
  - `imagery.treatmentPreset`: v2.9 sharp-treatment presets (existing enum)
- **`voice_note`:** ONLY free-text field; sanitized (HTML-stripped, ≤200 chars, single line)
- **Silent-drop counter:** mirror v2.12 DECOR-05 pattern; instrumented at Zod validator boundary
- **Zero new fields on Slide type** — TPLREND-05 byte-identity preserved by construction
- **PTF baseline:** `style-spec-absent-baseline.test.ts` locked BEFORE vision-extraction code (verify legacy projects with `style_spec: null` render byte-identical to v2.12 baseline across all 12 templates × both renderers; mirror v2.12 Phase 67 PTF16 discipline)

### Claude's Discretion
- **Migration filename:** `supabase/migrations/20260510_v213_style_spec_columns_and_bucket.sql` OR split into 2 migrations (`20260510_style_spec_columns.sql` + `20260510_slide_references_bucket.sql`); planner's call — split is cleaner
- **`reference_assets` row shape per upload:** include only the 3 fields above OR add optional `mime_type`, `size_bytes`, `original_filename` for richer provenance? Recommend YES include for forensics — cheap insurance
- **Upload UI component name:** `<ReferenceImageUploader>` OR `<StyleReferenceDrop>` — planner's call; mirror existing `BrandKitLogoUploader` naming
- **Drag-drop library:** native HTML5 `dragstart`/`dragover`/`drop` (cheap, no dep) OR react-dropzone if already in package.json; check first
- **Schema versioning field:** add `style_spec.schema_version: 1` for future-proofing? Recommend YES — cheap; defends against future StyleSpec evolution
- **Closed-enum value source pattern:** import from existing constants modules (single source of truth) vs hardcode in style-spec.ts type — STRONGLY prefer import (single source of truth = grep gate stays effective forever)
- **Where the upload UI lands:** new dashboard route `/dashboard/style-from-reference/new` OR modal triggered from existing dashboard CTA — modal is faster but route is cleaner for future deep-linking; planner's call
- **PARITY-05 grep gate location:** `scripts/grep-gates/closed-enum-styleSpec.sh` invoked from `package.json` `lint:gates` (mirror existing v2.12 grep-gate pattern)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/brand-kit/logo-upload-url/route.ts` — signed-URL upload pattern; mirror for `style-references`
- `src/lib/photo-treatment/sharp-config.ts` + Phase 73's `src/lib/preprocessing/style-reference-prep.ts` — preprocessing already shipped
- v2.12 100-icon allowlist (likely in `src/components/editor/decoration-picker/lucide-allowlist.ts` or similar) — closed-enum source
- v2.12 8-shape primitive set enum — closed-enum source
- `text_position` enum — existing closed enum to reuse for `layout.hookPosition`
- v2.9 sharp-treatment presets — closed-enum source for `imagery.treatmentPreset`
- 4-font catalog — closed-enum source for `typography.hookFontCategory`
- v2.12 PTF16 idempotent-absence baseline pattern (`__tests__/parity/`) — mirror for `style-spec-absent-baseline.test.ts`
- v2.12 DECOR-05 silent-drop counter pattern in Zod validators — mirror for STYLESPEC-10
- v2.12 grep-gate pattern (CI shell scripts) — mirror for PARITY-05

### Established Patterns
- Supabase migrations: dated filename + DDL only + RLS policies inline
- Storage bucket migrations: `INSERT INTO storage.buckets (id, name, public) VALUES (...)` + RLS policies on `storage.objects`
- JSONB columns on `projects`: existing pattern (`slide_data`, `style_overrides`, etc.) — additive nullable for back-compat
- Zod validators: discriminated unions + closed enums with `.catchall(z.never())` to prevent additive smuggling
- TypeScript types in `src/lib/types/` with consumer imports

### Integration Points
- New file: `src/lib/types/style-spec.ts` (StyleSpec type + closed enums)
- New file: `src/lib/validators/style-spec.ts` (Zod validator + silent-drop counter)
- New migration(s): `supabase/migrations/20260510_*.sql` (style_spec columns + slide-references bucket)
- New file: `src/app/api/style-references/upload-url/route.ts` (signed-URL endpoint)
- New file: `src/components/dashboard/reference-image-uploader.tsx` (drag-drop UI)
- New file: `src/app/(dashboard)/style-from-reference/new/page.tsx` OR modal in existing dashboard
- New PTF test: `src/__tests__/parity/style-spec-absent-baseline.test.ts`
- New CI gate: `scripts/grep-gates/closed-enum-styleSpec.sh`
- Updated `package.json` script: `lint:gates` runs the grep gate

</code_context>

<specifics>
## Specific Ideas

- Upload UI is functional-not-fancy: drag-drop zone + click-to-add + thumbnail preview row + X-to-remove per thumb + "Extract style" CTA at bottom (CTA explicit per REF-06: upload ≠ extraction trigger)
- `reference_assets` rows update on upload completion (not on click "Extract") — provenance preserved even if user abandons before generating
- Schema version field defends future evolution: spec consumers ignore unknown future versions, log silent-drop
- Zod validator's `silent_drop_counter` is incremented per stripped field, not per call — granular telemetry
- PTF baseline test runs against ALL 12 existing templates × both renderers (Satori + React preview) — same matrix as v2.12 Phase 67
- Closed-enum grep gate runs in CI on every PR; failing CI is the right signal (not a soft warning)

</specifics>

<deferred>
## Deferred Ideas

- Schema versioning beyond v1 — defer to v2.14+ when the second version is needed
- `reference_assets` per-row TTL — defer until storage cost becomes a real concern (negligible at pre-PMF scale)
- Premium-tier higher upload count cap — defer to v2.14+ (premium gating not in v2.13)
- Reference image hashing for dedup before storage upload — defer; rare overlap pre-PMF, sharp SHA-256 already provides cache hit
- Per-user storage quota beyond rate-cap — defer; rate-cap already enforces extraction cost ceiling

</deferred>
