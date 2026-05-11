# Roadmap — TikTok Slideshow Creator

## Active Milestone — v2.13 Style-from-Reference Generation

**Goal:** Let users upload reference slideshow images and generate a new slideshow that mimics the reference's full design template (palette, type, layout, shape/decoration patterns) with their own content — at full template fidelity, with two content paths (AI-generated copy from a topic, OR user-supplied copy with style-only application), output landing in the existing project editor.

**Requirements coverage:** 75/75 v2.13 reqs mapped (100%). Source of truth: `.planning/REQUIREMENTS.md`. Research synthesis: `.planning/research/SUMMARY.md`.

**Phase numbering:** Continues from v2.12 (last shipped Phase 72) → v2.13 starts at Phase 73. (No `--reset-phase-numbers` flag passed.)

**Hard constraints (locked, non-negotiable):**
- Phase 73 (cost rails) MUST ship before any extraction code (Phase 75). Roadmap MUST NOT allow merging Phase 73 into Phase 74 or 75.
- Phase 74's STYLESPEC-11 PTF baseline MUST be locked BEFORE any vision-extraction feature code (mirrors v2.12 Phase 67 PTF16 discipline).
- Phase 76's PREVIEW-01 mandatory non-skippable spec-preview is the single biggest UX defense — do NOT split across phases or make optional.
- Closed-enum schema (STYLESPEC-03..09) is THE primary architectural principle — defends against both legal AND prompt-injection threats simultaneously. Phase 74 owns this as load-bearing.

**Locked decisions (pre-roadmap, 2026-05-10):**
1. Free-tier with daily cap (5 uploads × 3 images = 15 vision calls/day) — Phase 73 owns the cap rails
2. Refusal pre-pass = second Gemini Vision call (no new vendor; ~$0.001/image extra) — Phase 75
3. Storage bucket name: `slide-references` (matches existing `slide-*` prefix) — Phase 74
4. NSFW pre-classifier deferred — rely on Gemini `BLOCK_ONLY_HIGH` + recovery UI; revisit on telemetry — explicitly NOT in Phase 73 scope

---

## Phases

- [x] **Phase 73: Cost & Preprocessing Rails (Foundation)** — sharp pipeline + SHA-256 cache + per-user-per-day rate cap + bill alarm; NO vision call code lands until this ships. ✅ Shipped 2026-05-10 (3 plans, 54+1todo tests, 8/8 reqs).
- [x] **Phase 74: Schema Foundation + Closed-Enum + Reference Upload + PTF Baseline** — `StyleSpec` type + closed-enum design + idempotent-absence PTF baseline + `slide-references` bucket + reference upload pipeline. ✅ Shipped 2026-05-10 (4 plans, 168 tests, 22/22 reqs, closed-enum CI gate live).
- [x] **Phase 75: Vision Extraction + Two-Phase Architecture + Safety Config** — `extract-style-spec.ts` + refusal pre-pass + `BLOCK_ONLY_HIGH` safety + `node-vibrant` for palette. ✅ Shipped 2026-05-10 (3 plans, 51 tests, 8/8 reqs, two-phase firewall structurally enforced).
- [x] **Phase 76: Spec Preview UI + Per-Aspect Controls + Re-Extract + Recovery** — mandatory non-skippable spec-preview panel + per-aspect checkboxes + brand-kit toggle + safety-block recovery UI. ✅ Shipped 2026-05-10 (3 plans, 112 tests, 12/12 reqs, PREVIEW-01 enforced by reducer + source-grep gate).
- [x] **Phase 77: Emit Integration + Token Budget Gate + Single-Undo + Editor Handoff** — `generate-from-style-spec.ts` + two content paths + spec replaces `aiVoiceNote` + roundtrip parity + editor handoff. ✅ Shipped 2026-05-10 (3 plans, 98 tests, 14/14 reqs, PTF77 byte-identity locked, 12K-token CI gate live).
- [ ] **Phase 78: Remix / Fork / Publish Snapshot** — `published_carousels` columns + publish/fork RPC extensions + "Regenerate from references".
- [ ] **Phase 79: Legal Hardening + ToS Clickwrap + Audit Log + Copy Review** — ToS clickwrap + `style_reference_uploads` audit table + DMCA docs + Inspired-by copy enforcement.

---

## Phase Details

### Phase 73: Cost & Preprocessing Rails (Foundation)
**Goal**: Lock cost ceilings and deterministic preprocessing in place before a single vision call ships, so extraction work in Phase 75 cannot blow the budget or compound retry costs.
**Depends on**: Nothing (foundation phase; hard prerequisite for Phase 75)
**Requirements**: COST-01, COST-02, COST-03, COST-04, COST-05, COST-06, COST-07, PARITY-04
**Success Criteria** (what must be TRUE):
  1. Every uploaded reference image is downscaled to ≤1024×1024 and JPEG-normalized by sharp before any downstream consumer sees it (HEIC inputs transcoded; aspect 9:16 normalize verified by regression test).
  2. A free-tier user attempting a 6th extraction in 24 hours is blocked at the server action with a clear "daily cap reached" response (5 calls × 3 images ceiling enforced).
  3. The `style_spec_cache` table returns the persisted StyleSpec on SHA-256 hash hit without invoking Gemini Vision (cache miss + persist + cache hit round-trip observable in telemetry).
  4. A daily Vercel cron emits an alert when extraction-call cost crosses the configured ceiling for the day.
  5. A failed vision call refunds credits via the charge-then-refund ledger pattern (mirror v2.6 `gemini_vision_match`); transient errors fail loud after 1 retry, not 3.
**Plans**: 3 plans
  - [ ] 73-01-PLAN.md — Sharp preprocessing pipeline + 9:16 PARITY-04 regression test (COST-01, COST-02, PARITY-04)
  - [ ] 73-02-PLAN.md — `style_spec_cache` table + SHA-256 lookup/persist helpers (COST-03)
  - [ ] 73-03-PLAN.md — Rate cap + charge-then-refund ledger + single-retry policy + bill-alarm cron (COST-04, COST-05, COST-06, COST-07)

### Phase 74: Schema Foundation + Closed-Enum + Reference Upload + PTF Baseline
**Goal**: Land the StyleSpec contract, the closed-enum invariant, the reference upload pipeline, and the byte-identity baseline so all subsequent feature work has a stable surface and proven non-regression on legacy projects.
**Depends on**: Phase 73 (cost rails must exist before storage upload paths consume them)
**Requirements**: REF-01, REF-02, REF-03, REF-04, REF-05, REF-06, REF-07, STYLESPEC-01, STYLESPEC-02, STYLESPEC-03, STYLESPEC-04, STYLESPEC-05, STYLESPEC-06, STYLESPEC-07, STYLESPEC-08, STYLESPEC-09, STYLESPEC-10, STYLESPEC-11, STYLESPEC-12, PARITY-01, PARITY-03, PARITY-05
**Success Criteria** (what must be TRUE):
  1. A user can upload 1–8 reference images (PNG/JPEG/WebP/HEIC) via drag-and-drop or click-to-add, see inline previews with X-to-remove, and the upload completes via signed URL directly to the `slide-references` bucket without hitting the 4MB Vercel body cap.
  2. Every existing legacy project (with `style_spec: null`) renders byte-identical to its v2.12 baseline across all 12 templates × both renderers — PTF baseline test (`style-spec-absent-baseline.test.ts`) is GREEN and locked BEFORE any vision-extraction feature code lands.
  3. `git grep "reference_artist\|reference_brand\|copy_exactly\|style_freetext"` returns zero matches in production source; only `voice_note` is free-text (sanitized, ≤200 chars, single line); all other StyleSpec fields are closed enums backed by existing v2.9/v2.12 catalogs.
  4. The Zod validator at the AI-ingest boundary silently drops unknown enum values and increments a silent-drop counter (mirror v2.12 DECOR-05); upload ≠ extraction trigger (user must explicitly click "Extract style").
  5. `projects.style_spec jsonb` and `projects.reference_assets jsonb` columns exist via migration; `Slide` type has zero new fields (StyleSpec consumed entirely server-side at emit time).
**Plans**: 4 plans
  - [ ] 74-01-PLAN.md — StyleSpec type + Zod validator + silent-drop counter + closed-enum CI grep gate (STYLESPEC-01, 03–10, PARITY-03, PARITY-05)
  - [ ] 74-02-PLAN.md — Migration: projects.style_spec + reference_assets jsonb columns + slide-references private bucket + per-user RLS (STYLESPEC-02, REF-01, REF-07)
  - [ ] 74-03-PLAN.md — Signed-URL upload route + ReferenceImageUploader component (drag-drop, 1–8 cap, REF-06 separation) (REF-02, REF-03, REF-04, REF-05, REF-06)
  - [ ] 74-04-PLAN.md — PTF baseline test (12 templates × 2 renderers) + Slide-zero-new-fields invariant (STYLESPEC-11, STYLESPEC-12, PARITY-01)

### Phase 75: Vision Extraction + Two-Phase Architecture + Safety Config
**Goal**: Stand up the extraction endpoint with the load-bearing two-phase firewall (vision → validated spec → emit; raw image bytes never reach text emit), refusal pre-pass for logos/faces/watermarks, and structured safety-block routing.
**Depends on**: Phase 73 (cost rails), Phase 74 (StyleSpec schema + reference upload + cache table) — HARD PREREQUISITE on Phase 73; merging is forbidden.
**Requirements**: EXTRACT-01, EXTRACT-02, EXTRACT-03, EXTRACT-04, EXTRACT-05, EXTRACT-06, EXTRACT-07, EXTRACT-08
**Success Criteria** (what must be TRUE):
  1. POST to `extract-style-spec.ts` with `{project_id, reference_urls[]}` returns a Zod-validated, closed-enum-coerced `StyleSpec` within 10 seconds (Promise.race timeout) or refunds credits via recovery UI handoff.
  2. The palette in the returned StyleSpec is deterministic (extracted by `node-vibrant` from preprocessed bytes, NOT by Gemini); Gemini is invoked only for categorical role/style inference under `responseMimeType: 'application/json'` + `responseSchema`.
  3. Every reference is run through a refusal pre-pass (second Gemini Vision call) that flags `{contains_logo, contains_face, contains_watermark}`; flagged images are surfaced as warnings in the Phase 76 UI (NOT auto-rejected — user gets choice).
  4. When `BLOCK_ONLY_HIGH` safety filter triggers (`promptFeedback.blockReason` populated), the response carries structured `{blocked: true, reason, recovery_suggestion}` for Phase 76 UI to render.
  5. Per-extraction telemetry records `vision_calls_count`, `tokens_in/out`, `cache_hit/miss`, `duration_ms` — observable in the bill-alarm cron from Phase 73.
**Plans**: 3 plans
  - [ ] 75-01-PLAN.md — extract-style-spec.ts orchestrator + types + two-phase firewall + Promise.race timeout + telemetry + safety routing (EXTRACT-01, EXTRACT-02, EXTRACT-03, EXTRACT-06, EXTRACT-07, EXTRACT-08) — Wave 2 (depends on 75-02 + 75-03)
  - [ ] 75-02-PLAN.md — refusal-pre-pass.ts (second Gemini Vision call: logo/face/watermark flags; graceful-degradation contract) (EXTRACT-05, EXTRACT-06) — Wave 1
  - [ ] 75-03-PLAN.md — palette-extraction.ts (node-vibrant deterministic palette + multi-image dominant-color voting merge) (EXTRACT-04) — Wave 1

### Phase 76: Spec Preview UI + Per-Aspect Controls + Re-Extract + Recovery
**Goal**: Stand the mandatory non-skippable spec-preview panel between extraction and emit so users see exactly what will be applied, can toggle aspects off, and have a recovery path when references are flagged or blocked.
**Depends on**: Phase 75 (extraction must exist before its output can be previewed)
**Requirements**: PREVIEW-01, PREVIEW-02, PREVIEW-03, PREVIEW-04, PREVIEW-05, PREVIEW-06, PREVIEW-07, PREVIEW-08, PREVIEW-09, PREVIEW-10, PREVIEW-11, PREVIEW-12
**Success Criteria** (what must be TRUE):
  1. A user cannot reach the emit-trigger without first being shown the spec-preview panel — palette swatches (4–6 colors with hex labels), font category badges, layout sketch, and sanitized voice_note are all visible inline.
  2. The user can toggle off `palette / typography / layout / decorations` independently via per-aspect checkboxes and the resulting emit only applies the checked aspects.
  3. The user can click "Re-extract" up to 2 times per generation (free retries) and the spec-preview panel updates in place; the visible credit cost ("Generating will use N credits") refreshes accordingly.
  4. When EXTRACT-05 flags a logo/face/watermark, an inline warning appears with "Inspired by"-framing copy and a confirm-and-continue control; reference thumbnails stay sticky throughout the flow.
  5. When EXTRACT-07 reports a safety block, the recovery UI shows specific, actionable guidance ("Try cropping high-skin areas / try a different image / describe the style in text instead").
**Plans**: 3 plans
  - [ ] 76-01-PLAN.md — State machine + page shell + Server Action + sticky strip + spec-preview panel skeleton (PREVIEW-01, PREVIEW-09)
  - [ ] 76-02-PLAN.md — Display components: palette swatches + font badges + layout sketch + voice-note caption + per-aspect toggles + brand-kit remix toggle + credit cost (PREVIEW-02, PREVIEW-03, PREVIEW-04, PREVIEW-05, PREVIEW-06, PREVIEW-08, PREVIEW-11)
  - [ ] 76-03-PLAN.md — Recovery surfaces: refusal warning + safety-block recovery + error router + Re-extract counter wiring + dashboard CTA (PREVIEW-07, PREVIEW-10, PREVIEW-12)
**UI hint**: yes

### Phase 77: Emit Integration + Token Budget Gate + Single-Undo + Editor Handoff
**Goal**: Wire the StyleSpec → Slide projector + Gemini text emit through both content paths (ai-copy and user-copy), prove byte-identity round-trip, and hand the result off to the existing v2.11/v2.12 editor with a single undo entry.
**Depends on**: Phase 76 (spec must be previewed and aspect-filtered before emit consumes it)
**Requirements**: EMIT-01, EMIT-02, EMIT-03, EMIT-04, EMIT-05, EMIT-06, EMIT-07, EMIT-08, EMIT-09, EMIT-10, EDITOR-01, EDITOR-02, EDITOR-03, PARITY-02
**Success Criteria** (what must be TRUE):
  1. A user submitting `mode: 'ai-copy'` with a topic gets a fully-generated 5-slide carousel that visually inherits palette/typography/layout/decoration patterns from the extracted spec; submitting `mode: 'user-copy'` with per-slide strings produces the same visual treatment with the user's exact words.
  2. The generated project lands in the existing editor with no new wiring (same routing as today's Gemini emit flow); a single Cmd+Z restores the exact pre-generation state (one reducer dispatch + one `pushHistory` per generation, mirror v2.12 BULK_ROTATE pattern).
  3. The `style-spec-roundtrip.test.ts` proves byte-identity: spec → emit → React preview ≡ Satori PNG (mirror v2.12 PTF17 AI-emit parity); silent-drop counter is also instrumented at the emit boundary.
  4. The CI prompt-token-budget gate fails the build if `style_spec + topic + brand_kit + system_prompt` exceeds 12K tokens (Gemini 2.5 Flash headroom); the StyleSpec → Slide projector emits ONLY values that round-trip through both renderers (no new Slide fields).
  5. The dashboard / project list shows a "From references" badge on style-from-reference projects, and the project detail page persists reference thumbnails for visible provenance.
**Plans**: 3 plans across 2 waves
  - [ ] 77-01-PLAN.md (wave 1) — Pure helpers: applyAspectFilter + applyBrandKitRemix + projectStyleSpecToSlideOverrides + narrowDecorationAllowlist (EMIT-07)
  - [ ] 77-02-PLAN.md (wave 2, depends on 77-01) — generate-from-style-spec.ts + buildFromSpecPrompt + generateCarouselFromReferences + regenerateAction Server Action wiring + 12K-token CI gate + PARITY-02 roundtrip PTF (EMIT-01..06, 08, 09, 10, EDITOR-01, PARITY-02)
  - [ ] 77-03-PLAN.md (wave 1, parallel with 77-01) — FromReferencesBadge + ReferenceThumbnailsStrip + ProjectCard + project detail page wiring + Project type extension (EDITOR-02, EDITOR-03)
**UI hint**: yes

### Phase 78: Remix / Fork / Publish Snapshot
**Goal**: Extend the v2.4 publish/fork pipeline so style specs and reference assets travel with published carousels, and forkers can regenerate new content from the inherited references in one click.
**Depends on**: Phase 77 (emit + editor handoff must exist before publish flow can snapshot it)
**Requirements**: REMIX-01, REMIX-02, REMIX-03, REMIX-04, REMIX-05
**Success Criteria** (what must be TRUE):
  1. Publishing a style-from-reference carousel snapshots both `style_spec` and `reference_assets` into the `published_carousels` row (one-line additive migration, snapshot pattern matches v2.4).
  2. Forking a published style-from-reference carousel copies `style_spec + reference_assets` into the new project; the forker sees inherited reference thumbnails on their fork (provenance preserved).
  3. The fork detail page exposes a "Regenerate from references" action that re-invokes the Phase 75 extraction + Phase 77 emit pipeline against the inherited references — new content, same template fidelity.
  4. Existing v2.12-and-prior published carousels (no `style_spec`) continue to publish/fork byte-identical to today; the new columns are nullable additive.
**Plans**: TBD

### Phase 79: Legal Hardening + ToS Clickwrap + Audit Log + Copy Review
**Goal**: Close the legal exposure surface with explicit user acknowledgement, durable audit trail, public DMCA process, and a copy review pass enforcing "Inspired by" framing across every UI surface.
**Depends on**: Phase 78 (full feature must be wired end-to-end before legal hardening + copy review pass)
**Requirements**: LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05, LEGAL-06, PARITY-05
**Success Criteria** (what must be TRUE):
  1. On the user's first style-from-reference upload, a ToS clickwrap modal blocks submission until "I have rights to these images" is explicitly checked; the `{user_id, ToS_version, accepted_at}` is recorded.
  2. The `style_reference_uploads` audit table records `{user_id, sha256, ToS_version, accepted_at}` per upload with 12-month retention enforced via `pg_cron`.
  3. Every UI surface mentioning style-from-reference uses "Inspired by" framing — `git grep "exactly like\|clone\|copy this\|duplicate the"` in the style-reference UI code returns zero matches; copy review checklist shipped.
  4. `docs/legal/dmca-style-references.md` exists and documents takedown contact, audit-log lookup procedure, and response SLA; ToS document carries a new section covering style-from-reference rights/responsibilities (Canva AI Product Terms pattern).
  5. The closed-enum invariant grep gate (PARITY-05) remains GREEN end-to-end after the legal hardening pass — no free-text artist/brand fields slipped in.
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 73. Cost & Preprocessing Rails (Foundation) | 0/3 | Not started | — |
| 74. Schema Foundation + Closed-Enum + Reference Upload + PTF Baseline | 0/4 | Not started | — |
| 75. Vision Extraction + Two-Phase Architecture + Safety Config | 0/3 | Not started | — |
| 76. Spec Preview UI + Per-Aspect Controls + Re-Extract + Recovery | 0/? | Not started | — |
| 77. Emit Integration + Token Budget Gate + Single-Undo + Editor Handoff | 0/? | Not started | — |
| 78. Remix / Fork / Publish Snapshot | 0/? | Not started | — |
| 79. Legal Hardening + ToS Clickwrap + Audit Log + Copy Review | 0/? | Not started | — |

---

## Coverage Audit

**v2.13 requirement count:** 75 requirements across 9 categories
**Mapped:** 75/75 (100%) ✓
**Orphans:** 0
**Duplicates:** 0

| Category | Count | Phase(s) |
|----------|-------|----------|
| COST | 7 | 73 |
| REF | 7 | 74 |
| STYLESPEC | 12 | 74 |
| EXTRACT | 8 | 75 |
| PREVIEW | 12 | 76 |
| EMIT | 10 | 77 |
| EDITOR | 3 | 77 |
| REMIX | 5 | 78 |
| LEGAL | 6 | 79 |
| PARITY | 5 | 73 (PARITY-04), 74 (PARITY-01, -03, -05), 77 (PARITY-02), 79 (PARITY-05 verification) |

**PARITY-03 note:** Silent-drop counter is *introduced* in Phase 74 (with STYLESPEC-10 at the AI-ingest boundary) and *verified at the emit boundary* in Phase 77 (with EMIT-08). Primary owner = Phase 74; emit-boundary verification is built into Phase 77's EMIT-08 success criteria.
**PARITY-05 note:** The closed-enum CI grep gate is *introduced* in Phase 74 (load-bearing on STYLESPEC-03..09) and *verified end-to-end* in Phase 79 (legal hardening pass). Primary owner = Phase 74; final verification is built into Phase 79's success criteria.

---

## Milestones

- 🚧 **v2.13 Style-from-Reference Generation** — Phases 73–79 (planning 2026-05-10). 75 reqs across 9 categories. Vision-LLM-driven style extraction from uploaded slideshow images + spec preview + two content paths + remix/fork/publish snapshot + legal hardening. Closed-enum schema is THE primary architectural defense against legal exposure AND prompt injection. See [REQUIREMENTS.md](REQUIREMENTS.md).
- ✅ **v2.12 Shapes & Icons (Decoration Primitives)** — Phases 67–72 (shipped 2026-05-04). 81 reqs across 12 categories. Lucide icon picker (118-icon allowlist) + 8 Canva-style shapes + full v2.11 editor parity (multi-select / align / group / lock / layers / z-order) + Gemini AI emit + interactive rotation handles + rotation-aware AABB. See [archive](milestones/v2.12-ROADMAP.md).
- ✅ **v2.11 Full Editor Parity** — Phases 60–66 (shipped 2026-05-03) — Multi-select, alignment, group/ungroup, smart guides, lock/hide, z-order, layers panel, power-user differentiators. See [archive](milestones/v2.11-ROADMAP.md).
- ✅ **v2.10 Text Box Resize Handles** — Phase 59 (shipped 2026-05-02). See [archive](milestones/v2.10-ROADMAP.md).
- ✅ **v2.9 Viral Visual Quality** — Phases 54–58 (shipped 2026-05-01). See [archive](milestones/v2.9-ROADMAP.md).
- ✅ **v2.8 Text Editor Right-Rail Redesign** — Phases 49–53 (shipped 2026-04-30).
- ✅ **v2.7 Premium Templates** — Phases 44–48 (shipped 2026-04-29).
- ✅ **v2.6 MCP Server** — Phases 40–43 (shipped 2026-04-28).
- ✅ **v2.5 Public REST API Parity** — Phases 34–39 (shipped 2026-04-28).
- ✅ **v2.4 Explore + Remix** — Phases 26–33 (shipped 2026-04-27).
- ✅ **v2.2 Public REST API** — Phases 20–25 (shipped 2026-04-09). See [archive](milestones/v2.2-ROADMAP.md).
- ✅ **v2.1 Text Effects** — Phases 17–19 (shipped 2026-04-07). See [archive](milestones/v2.1-ROADMAP.md).
- ✅ **v2.0 API & MCP Platform** — Phases 14–16 (shipped 2026-04-07). See [archive](milestones/v2.0-ROADMAP.md).

---
