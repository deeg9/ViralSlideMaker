# Requirements — v2.13 Style-from-Reference Generation

**Goal:** Let users upload reference slideshow images and generate a new slideshow that mimics the reference's full design template (palette, type, layout, shape/decoration patterns) with their own content — at full template fidelity, with two content paths (AI-generated copy from a topic, OR user-supplied copy with style-only application), output landing in the existing project editor.

**Phase numbering:** Continues from v2.12 (Phase 72 last shipped) → starts at **Phase 73**.

**Source of truth:** `.planning/research/SUMMARY.md` (synthesized 2026-05-10 from 4 parallel research agents). Stack/Features/Architecture/Pitfalls broken out in `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`.

**Locked decisions (pre-roadmap, 2026-05-10):**
1. **Premium gating:** Free-tier with daily cap (5 uploads × 3 images = 15 vision calls/day); reuses existing credit-ledger pattern
2. **Refusal pre-pass:** Second Gemini Vision call (no new vendor; ~$0.001/image extra)
3. **Bucket name:** `slide-references` (matches existing `slide-*` prefix)
4. **NSFW pre-classifier:** Deferred — rely on Gemini built-in safety (`BLOCK_ONLY_HIGH`) + recovery UI; revisit on telemetry

---

## v2.13 Requirements

### Cost & Preprocessing Rails (COST) — Phase 0 (non-negotiable foundation)

- [ ] **COST-01**: `sharp` server-side preprocessing pipeline downscales every uploaded reference image to ≤1024×1024 before any vision call (mirror v2.9 Phase 54 photo-treatment pattern)
- [ ] **COST-02**: HEIC inputs transcoded to JPEG@85 by sharp; output to vision is always JPEG (deterministic + Gemini wire-format normalization)
- [ ] **COST-03**: `style_spec_cache` Postgres table keyed on SHA-256 hash of the preprocessed image bytes; cache hit returns persisted StyleSpec without re-calling vision
- [ ] **COST-04**: Per-user-per-day rate cap enforced in server action — free tier: 5 extraction calls/day, 3 reference images max per call (15 vision calls/day ceiling)
- [ ] **COST-05**: Daily Vercel cron bill-alarm — alerts if extraction-call cost exceeds configured ceiling for the day
- [ ] **COST-06**: Charge-then-refund credit ledger pattern (mirror v2.6 `gemini_vision_match`); failed extraction refunds the charge
- [ ] **COST-07**: Vision call retries capped at 1 (NOT 3); transient errors fail loud rather than compound cost

### Reference Upload (REF) — Phase 1

- [ ] **REF-01**: New private Supabase Storage bucket `slide-references` provisioned via migration; per-user folder structure (`{user_id}/{ref_id}.{ext}`)
- [ ] **REF-02**: Signed-URL upload pattern (mirror existing `brand-kit/logo-upload-url/route.ts`); browser uploads directly to Storage, NOT through server action (avoids 4MB Vercel body cap)
- [ ] **REF-03**: Upload UI accepts 1–8 reference images per generation (image/png, image/jpeg, image/webp, image/heic); inline previews with X-to-remove
- [ ] **REF-04**: Drag-and-drop + click-to-add support; file-type validation client-side and server-side
- [ ] **REF-05**: Per-image MIME + size validation server-side (max 20MB per file pre-preprocessing); rejection messages explain the cap
- [ ] **REF-06**: Reference upload ≠ extraction trigger — user explicitly clicks "Extract style" to consume credits
- [ ] **REF-07**: `reference_assets jsonb` column added to `projects` table — persists `[{url, sha256, uploaded_at}, ...]` for provenance + remix support

### StyleSpec Schema (STYLESPEC) — Phase 1

- [ ] **STYLESPEC-01**: New `StyleSpec` TypeScript type in `src/lib/types/style-spec.ts` (separate type, NOT a Slide override) with sections: `palette`, `typography`, `layout`, `imagery`, `decorations`, `rhythm`, `voice_note`
- [ ] **STYLESPEC-02**: `style_spec jsonb` column added to `projects` table; nullable (legacy projects render byte-identical)
- [ ] **STYLESPEC-03**: Closed-enum `palette.mode` field (`solid | duotone | gradient | photo`) — no free-text
- [ ] **STYLESPEC-04**: Closed-enum `typography.hookFontCategory` field over the existing 4-font catalog (no `font_name` free-text)
- [ ] **STYLESPEC-05**: Closed-enum `decorations.preferredLucide` field — values constrained to v2.12 100-icon allowlist
- [ ] **STYLESPEC-06**: Closed-enum `decorations.preferredShapes` field — values constrained to v2.12 8-shape primitive set
- [ ] **STYLESPEC-07**: Closed-enum `layout.hookPosition` field — values constrained to existing `text_position` enum
- [ ] **STYLESPEC-08**: Closed-enum `imagery.treatmentPreset` field — values constrained to v2.9 sharp-treatment presets
- [ ] **STYLESPEC-09**: `voice_note` field is the ONLY free-text field in StyleSpec — sanitized (HTML-stripped, ≤200 chars, single line)
- [ ] **STYLESPEC-10**: Zod validator strips unknown enum values silently at the AI-ingest boundary; instrumented with silent-drop counter (mirror v2.12 DECOR-05 pattern)
- [ ] **STYLESPEC-11**: PTF baseline test (`style-spec-absent-baseline.test.ts`) locked BEFORE feature code — verifies legacy projects render byte-identical with `style_spec: null` (mirror v2.12 Phase 67 PTF16 discipline)
- [ ] **STYLESPEC-12**: Zero new fields on `Slide` type — TPLREND-05 byte-identity preserved by construction (StyleSpec consumed entirely server-side; emit projects to existing Slide fields)

### Vision Extraction (EXTRACT) — Phase 2

- [ ] **EXTRACT-01**: New server endpoint `extract-style-spec.ts` (mirror `match-photos-to-slides.ts` shape) — accepts `{ project_id, reference_urls[] }`, returns validated StyleSpec
- [ ] **EXTRACT-02**: Two-phase architecture — Phase A: Gemini Vision call extracts raw spec from images; Phase B: Zod validates + closed-enum-coerces; Phase B output is the ONLY thing downstream emit ever sees (raw image bytes never reach text emit)
- [ ] **EXTRACT-03**: Gemini 2.5 Flash invoked with `responseMimeType: 'application/json'` + `responseSchema` for the StyleSpec contract; `BLOCK_ONLY_HIGH` safety config
- [ ] **EXTRACT-04**: `node-vibrant` extracts the palette deterministically from the preprocessed image bytes (NOT Gemini); Gemini is only used for role/style naming and categorical inference
- [ ] **EXTRACT-05**: Refusal pre-pass — second Gemini Vision call classifies each reference for `{contains_logo, contains_face, contains_watermark}`; positive hits are flagged in the response and surfaced in the spec-preview UI as warnings (NOT auto-rejected; user gets choice)
- [ ] **EXTRACT-06**: 10-second `Promise.race` timeout per vision call (mirror `match-photos-to-slides.ts`); timeout triggers refund + recovery UI
- [ ] **EXTRACT-07**: `promptFeedback.blockReason` detection — when Gemini safety filter blocks an image, response carries structured `{blocked: true, reason, recovery_suggestion}` for UI to render
- [ ] **EXTRACT-08**: Per-extraction cost telemetry recorded — `vision_calls_count`, `tokens_in/out`, `cache_hit/miss`, `duration_ms` per request (feeds bill-alarm + future per-user analytics)

### Spec Preview UI (PREVIEW) — Phase 3

- [ ] **PREVIEW-01**: Mandatory non-skippable spec-preview panel rendered between extraction-complete and emit-trigger — user MUST review before generating
- [ ] **PREVIEW-02**: Visible palette swatches (4–6 colors) with hex value labels
- [ ] **PREVIEW-03**: Visible font category badges (e.g., "Hook: Heavy Display / Body: Sans Serif")
- [ ] **PREVIEW-04**: Visible layout sketch — schematic representation of hook position, body density, decoration density
- [ ] **PREVIEW-05**: Visible "Style notes" — sanitized `voice_note` rendered as a single-line caption
- [ ] **PREVIEW-06**: Per-aspect checkboxes — user can toggle off `palette / typography / layout / decorations` independently to control which extracted aspects are applied
- [ ] **PREVIEW-07**: "Re-extract" button (free retries up to 2 per generation) — re-invokes vision with the same references; spec-preview updates in place
- [ ] **PREVIEW-08**: "Remix with Brand Kit" toggle (visible only when user has a brand kit configured) — overlays brand kit colors/fonts on top of extracted style; per-field merge
- [ ] **PREVIEW-09**: Sticky reference thumbnails — uploaded reference images stay visible in a strip throughout the spec-preview + emit flow
- [ ] **PREVIEW-10**: Refusal-warning surface — when EXTRACT-05 flags logo/face/watermark, render an inline warning ("This reference contains a logo — generated output will be inspired by the style, not the brand identity") with confirm-and-continue
- [ ] **PREVIEW-11**: Visible credit cost — UI shows "Generating will use N credits" before the user clicks Generate
- [ ] **PREVIEW-12**: Safety-block recovery UI — when Gemini blocks an image (EXTRACT-07), render specific guidance: "Try cropping high-skin areas / try a different image / describe the style in text instead"

### Style-from-Spec Emit (EMIT) — Phase 4

- [ ] **EMIT-01**: New server endpoint `generate-from-style-spec.ts` — accepts `{ style_spec, mode: 'ai-copy' | 'user-copy', topic?, user_copy? }`, returns `Slide[]` ready for editor
- [ ] **EMIT-02**: New orchestrator `generateCarouselFromReferences()` in `services/carousel.ts` (sibling to existing `generateCarousel()`); existing `generateSlideContent` left untouched
- [ ] **EMIT-03**: Mode `ai-copy` — user provides a topic; Gemini generates new slide copy in the reference's voice/style (style spec replaces template `aiVoiceNote` when present)
- [ ] **EMIT-04**: Mode `user-copy` — user provides per-slide copy strings; Gemini structures the input into Slide segments + applies role + decoration choices (style-only application; no copy generation)
- [ ] **EMIT-05**: Spec REPLACES template `aiVoiceNote` when both are present — explicit precedence; documented in code comment + test
- [ ] **EMIT-06**: CI prompt-token-budget gate — fails if `style_spec + topic + brand_kit + system_prompt` exceeds 12K tokens (Gemini 2.5 Flash context budget headroom)
- [ ] **EMIT-07**: StyleSpec → Slide projector emits ONLY values that already round-trip through both renderers (Satori + React preview); no new Slide fields introduced
- [ ] **EMIT-08**: Triple-layer silent-drop pipeline + Zod validate at emit boundary (mirror v2.12 + v2.9 patterns); silent-drop counter instrumented
- [ ] **EMIT-09**: `style-spec-roundtrip.test.ts` proves byte-identity: spec → emit → render-preview ≡ render-PNG (mirror v2.12 PTF17 AI-emit parity test)
- [ ] **EMIT-10**: Single reducer dispatch + single `pushHistory` per generation — undo restores the exact pre-generation state in one Cmd+Z (mirror v2.12 BULK_ROTATE pattern)

### Editor Handoff (EDITOR) — Phase 4 / 5

- [ ] **EDITOR-01**: Generated project lands in the existing v2.11/v2.12 editor with no new wiring — same routing as today's Gemini emit flow
- [ ] **EDITOR-02**: Project list / dashboard shows a "From references" badge on style-from-reference projects (visual differentiator for user recall)
- [ ] **EDITOR-03**: Reference thumbnails persist on the project detail page (Explore + dashboard) — visible provenance for the user

### Remix / Fork / Publish (REMIX) — Phase 5

- [ ] **REMIX-01**: `published_carousels.style_spec jsonb` + `published_carousels.reference_assets jsonb` columns added via migration (snapshot pattern matches v2.4 publish flow)
- [ ] **REMIX-02**: Publish flow snapshots `style_spec + reference_assets` into `published_carousels` row
- [ ] **REMIX-03**: Fork RPC extended to copy `style_spec + reference_assets` to the new project (one-line RPC migration)
- [ ] **REMIX-04**: Forker sees inherited reference thumbnails on their fork (provenance preserved)
- [ ] **REMIX-05**: "Regenerate from references" action on fork — re-invokes the extraction + emit pipeline on the inherited references; new content, same template

### Legal & Safety (LEGAL) — Phase 6

- [ ] **LEGAL-01**: ToS clickwrap modal on first style-from-reference upload — explicit "I have rights to these images" confirmation; user_id + ToS version + timestamp recorded
- [ ] **LEGAL-02**: `style_reference_uploads` audit table records `{user_id, sha256, ToS_version, accepted_at}` per upload; 12-month retention via pg_cron
- [ ] **LEGAL-03**: All UI copy uses "Inspired by" framing — no "exactly like" / "clone" / "copy" / "duplicate" language
- [ ] **LEGAL-04**: DMCA process documented in `docs/legal/dmca-style-references.md` — takedown contact, audit-log lookup procedure, response SLA
- [ ] **LEGAL-05**: ToS document update — new section covering style-from-reference rights/responsibilities (mirror Canva AI Product Terms pattern)
- [ ] **LEGAL-06**: Closed-enum schema (covered by STYLESPEC-03..09) is the structural defense — no field accepts free-text artist/brand names

### Test Coverage & Parity (PARITY) — cross-cutting

- [ ] **PARITY-01**: PTF baseline locked before feature code (covered by STYLESPEC-11)
- [ ] **PARITY-02**: Spec → emit → render byte-identity proven (covered by EMIT-09)
- [ ] **PARITY-03**: Silent-drop counter wired + alerting on non-zero (covered by STYLESPEC-10 + EMIT-08)
- [ ] **PARITY-04**: 9:16 aspect-normalize regression test — uploaded reference of any aspect ratio produces a 9:16-correct emit (defends against v2.12 ASPECT-01 bug class re-emerging)
- [ ] **PARITY-05**: CI grep gate — `git grep "reference_artist\|reference_brand\|copy_exactly\|style_freetext"` MUST return zero matches (closed-enum invariant)

---

## Future Requirements (deferred to v2.14+)

- Per-slide style mapping (vision infers role per reference image; spec carries per-role overrides)
- Save extracted spec as a personal "Style" — reusable across new generations
- "Try this style" preset gallery — curated style specs as a starting point
- Generate N variants from one spec
- Clipboard-paste reference image (Cmd+V on the upload screen)
- Read-only spec JSON viewer (advanced users)
- pHash cache layer above SHA-256 (same-content-different-bytes deduplication)
- NSFW pre-classifier (Sightengine or equivalent) — add only if safety-block telemetry shows demand

## Out of Scope (v2.13 explicit exclusions)

- **"Perfect 1:1 clone" framing or behavior** — legal exposure (Disney/Universal v. Midjourney precedent); Inspired-by framing is structural
- **Automatic copyright detection** — vendor dependency + accuracy claims we can't defend; rely on refusal pre-pass + ToS clickwrap + audit log instead
- **Per-image weighted blend slider** — embedding-tool pattern; conflicts with our spec-preview-edit posture
- **Real-time spec preview as user uploads** — cost (every keystroke = vision call); UX confusion
- **JSON-textbox spec editor** — power-user surface; defer to v2.15+ if requested
- **Auto-detect output aspect ratio** — output is always 9:16 (matches platform spec); aspect-normalize at preprocessing
- **AI-generated-content reference detection** — out of scope; we don't try to determine if the reference is AI-generated
- **Style transfer onto user-uploaded photos (`stylize-image.ts`)** — definitively deferred per v2.9 right-of-publicity decision
- **URL-paste → screenshot extraction** — defer to v2.15+ (additional vendor dependency for screenshotting)
- **Multi-aspect output** — 9:16 only in v2.13; multi-aspect is a separate milestone
- **Streaming response** — Gemini Flash is fast enough; revisit only if launch telemetry shows latency UX issue
- **Public REST API surface for `regenerateFromReferences()`** — defer to v2.14 if dev-API users request
- **Premium-only gating** — explicitly chose free-tier-with-cap to maximize wedge growth pre-PMF
- **Sightengine NSFW pre-classifier in Phase 0** — defer until Gemini safety-filter false-positive rate justifies the new vendor

---

## Traceability

**Coverage:** 75/75 v2.13 reqs mapped to phases 73–79 (100%). Zero orphans, zero duplicates. Mapping locked 2026-05-10 by gsd-roadmapper.

| Requirement | Phase | Status | Notes |
|-------------|-------|--------|-------|
| COST-01 | Phase 73 | Pending | sharp ≤1024×1024 downscale |
| COST-02 | Phase 73 | Pending | HEIC → JPEG@85 transcode |
| COST-03 | Phase 73 | Pending | `style_spec_cache` table (SHA-256 keyed) |
| COST-04 | Phase 73 | Pending | 5 calls × 3 images = 15/day cap |
| COST-05 | Phase 73 | Pending | Daily Vercel cron bill-alarm |
| COST-06 | Phase 73 | Pending | Charge-then-refund ledger (v2.6 mirror) |
| COST-07 | Phase 73 | Pending | Retry cap = 1 (not 3) |
| REF-01 | Phase 74 | Pending | `slide-references` private bucket |
| REF-02 | Phase 74 | Pending | Signed-URL upload (avoid 4MB cap) |
| REF-03 | Phase 74 | Pending | 1–8 images per generation |
| REF-04 | Phase 74 | Pending | Drag-drop + click + validation |
| REF-05 | Phase 74 | Pending | 20MB per file pre-preprocessing |
| REF-06 | Phase 74 | Pending | Upload ≠ extraction trigger |
| REF-07 | Phase 74 | Pending | `projects.reference_assets jsonb` |
| STYLESPEC-01 | Phase 74 | Pending | `StyleSpec` TypeScript type |
| STYLESPEC-02 | Phase 74 | Pending | `projects.style_spec jsonb` (nullable) |
| STYLESPEC-03 | Phase 74 | Pending | Closed-enum `palette.mode` |
| STYLESPEC-04 | Phase 74 | Pending | Closed-enum `typography.hookFontCategory` |
| STYLESPEC-05 | Phase 74 | Pending | Closed-enum `preferredLucide` (v2.12 100-icon) |
| STYLESPEC-06 | Phase 74 | Pending | Closed-enum `preferredShapes` (v2.12 8-shape) |
| STYLESPEC-07 | Phase 74 | Pending | Closed-enum `layout.hookPosition` |
| STYLESPEC-08 | Phase 74 | Pending | Closed-enum `imagery.treatmentPreset` (v2.9) |
| STYLESPEC-09 | Phase 74 | Pending | `voice_note` ONLY free-text (sanitized ≤200) |
| STYLESPEC-10 | Phase 74 | Pending | Zod silent-drop + counter (DECOR-05 mirror) |
| STYLESPEC-11 | Phase 74 | Pending | PTF baseline locked BEFORE feature code |
| STYLESPEC-12 | Phase 74 | Pending | Zero new Slide fields (TPLREND-05 by construction) |
| EXTRACT-01 | Phase 75 | Pending | `extract-style-spec.ts` endpoint |
| EXTRACT-02 | Phase 75 | Pending | Two-phase firewall (vision → validated → emit) |
| EXTRACT-03 | Phase 75 | Pending | Gemini 2.5 Flash + responseSchema + BLOCK_ONLY_HIGH |
| EXTRACT-04 | Phase 75 | Pending | `node-vibrant` for palette (deterministic) |
| EXTRACT-05 | Phase 75 | Pending | Refusal pre-pass (logo/face/watermark flags) |
| EXTRACT-06 | Phase 75 | Pending | 10s Promise.race timeout |
| EXTRACT-07 | Phase 75 | Pending | `promptFeedback.blockReason` structured response |
| EXTRACT-08 | Phase 75 | Pending | Per-extraction cost telemetry |
| PREVIEW-01 | Phase 76 | Pending | Mandatory non-skippable spec-preview panel |
| PREVIEW-02 | Phase 76 | Pending | Palette swatches with hex labels |
| PREVIEW-03 | Phase 76 | Pending | Font category badges |
| PREVIEW-04 | Phase 76 | Pending | Layout sketch |
| PREVIEW-05 | Phase 76 | Pending | Sanitized voice_note caption |
| PREVIEW-06 | Phase 76 | Pending | Per-aspect checkboxes |
| PREVIEW-07 | Phase 76 | Pending | Re-extract (2 free retries) |
| PREVIEW-08 | Phase 76 | Pending | Remix with Brand Kit toggle |
| PREVIEW-09 | Phase 76 | Pending | Sticky reference thumbnails |
| PREVIEW-10 | Phase 76 | Pending | Refusal-warning inline surface |
| PREVIEW-11 | Phase 76 | Pending | Visible credit cost pre-Generate |
| PREVIEW-12 | Phase 76 | Pending | Safety-block recovery guidance |
| EMIT-01 | Phase 77 | Pending | `generate-from-style-spec.ts` endpoint |
| EMIT-02 | Phase 77 | Pending | `generateCarouselFromReferences()` orchestrator |
| EMIT-03 | Phase 77 | Pending | Mode `ai-copy` (topic → AI copy in reference voice) |
| EMIT-04 | Phase 77 | Pending | Mode `user-copy` (style-only application) |
| EMIT-05 | Phase 77 | Pending | Spec REPLACES template `aiVoiceNote` |
| EMIT-06 | Phase 77 | Pending | CI 12K-token prompt-budget gate |
| EMIT-07 | Phase 77 | Pending | Projector emits round-trip-safe values only |
| EMIT-08 | Phase 77 | Pending | Triple-layer silent-drop + emit-boundary counter |
| EMIT-09 | Phase 77 | Pending | `style-spec-roundtrip.test.ts` (PTF17 mirror) |
| EMIT-10 | Phase 77 | Pending | Single dispatch + single pushHistory per gen |
| EDITOR-01 | Phase 77 | Pending | Lands in existing editor (no new wiring) |
| EDITOR-02 | Phase 77 | Pending | "From references" dashboard badge |
| EDITOR-03 | Phase 77 | Pending | Persistent reference thumbnails on detail page |
| REMIX-01 | Phase 78 | Pending | `published_carousels.style_spec` + `reference_assets` columns |
| REMIX-02 | Phase 78 | Pending | Publish snapshots spec + assets |
| REMIX-03 | Phase 78 | Pending | Fork RPC copies spec + assets |
| REMIX-04 | Phase 78 | Pending | Forker sees inherited reference thumbnails |
| REMIX-05 | Phase 78 | Pending | "Regenerate from references" action on fork |
| LEGAL-01 | Phase 79 | Pending | ToS clickwrap on first upload |
| LEGAL-02 | Phase 79 | Pending | `style_reference_uploads` audit table (12mo retention) |
| LEGAL-03 | Phase 79 | Pending | "Inspired by" framing in all UI copy |
| LEGAL-04 | Phase 79 | Pending | DMCA process docs |
| LEGAL-05 | Phase 79 | Pending | ToS document update (Canva AI Product Terms pattern) |
| LEGAL-06 | Phase 79 | Pending | Closed-enum structural defense (covered by STYLESPEC-03..09) |
| PARITY-01 | Phase 74 | Pending | Covered by STYLESPEC-11 (PTF baseline lock) |
| PARITY-02 | Phase 77 | Pending | Covered by EMIT-09 (spec→emit→render byte-identity) |
| PARITY-03 | Phase 74 | Pending | Silent-drop counter introduced (STYLESPEC-10); verified at emit boundary in Phase 77 (EMIT-08) |
| PARITY-04 | Phase 73 | Pending | 9:16 aspect-normalize regression in sharp preprocessing (defends v2.12 ASPECT-01 class) |
| PARITY-05 | Phase 74 | Pending | Closed-enum CI grep gate introduced (load-bearing on STYLESPEC-03..09); verified end-to-end in Phase 79 |

### Coverage Summary

| Category | Count | Phase(s) | Status |
|----------|-------|----------|--------|
| COST | 7 | 73 | Pending |
| REF | 7 | 74 | Pending |
| STYLESPEC | 12 | 74 | Pending |
| EXTRACT | 8 | 75 | Pending |
| PREVIEW | 12 | 76 | Pending |
| EMIT | 10 | 77 | Pending |
| EDITOR | 3 | 77 | Pending |
| REMIX | 5 | 78 | Pending |
| LEGAL | 6 | 79 | Pending |
| PARITY | 5 | 73, 74, 77, 79 | Pending |
| **TOTAL** | **75** | **73–79** | **0/75 complete** |
