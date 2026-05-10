# Research Summary — v2.13 Style-from-Reference Generation

**Project:** TikTok Slideshow Creator
**Milestone:** v2.13 — Style-from-Reference Generation
**Synthesis date:** 2026-05-10

---

## Executive Summary

v2.13 is a wedge layered on top of v2.12, not a stack expansion — every primitive (Gemini 2.5 Flash vision, sharp, node-vibrant, Supabase signed-URL upload, v2.12 100-icon allowlist, charge-then-refund credit ledger) is already production-tested, with **zero new vendor relationships needed**. The competitive picture is settled: **Swipe Carousel ships exactly this feature with both content paths**, so we are catching up to a verified market pattern, not pioneering — our differentiator is the **structured visible style-spec preview** (palette swatches + font names + layout sketch + per-slide role) where every embedding-based competitor (Midjourney, Firefly, Canva Dream Lab) hides extracted style behind opacity. The load-bearing risks are legal and architectural, not technical: **closed-enum schema is the primary defense against both legal exposure** (no `reference_artist` free-text field) **AND prompt-injection-via-image-text** (no landing zone for "ignore previous instructions"), and **Phase 0 cost rails (sharp preprocessing + SHA-256 cache + per-user-per-day cap) are non-negotiable BEFORE any extraction code lands**.

---

## Per-Domain Headlines

- **STACK:** zero new dependencies; mirror existing `match-photos-to-slides.ts` pattern; per-call cost ~$0.002–$0.005 after sharp downscale.
- **FEATURES:** Swipe Carousel is direct competitor doing this exactly with both content paths — we are catching up; UX pattern (multi-upload + spec preview + content-path toggle at spec-confirmation) is well-established.
- **ARCHITECTURE:** StyleSpec is a separate type, not a Slide override → preserves TPLREND-05 byte-identity with zero new fields on Slide; only the projector (`StyleSpec → Slide[]`) needs new test coverage.
- **PITFALLS:** legal posture is load-bearing risk (Reface/Kyland Young precedent already binding from v2.9); closed-enum schema defends against both legal AND injection threats simultaneously.

---

## Recommended Roadmap (6 phases + Phase 0)

> **Hard constraint:** Phase 0 ships BEFORE any extraction code. Roadmap should NOT allow merging Phase 0 with Phase 1.

### Phase 0 — Cost & Preprocessing Rails (Foundation)
**Deliverable:** sharp pipeline + SHA-256 cache table + per-user-per-day rate cap + bill alarm cron.
**Closes pitfalls:** 4 (cost), 2d (aspect-misread), 6d (aspect-bug class).
**No vision call code lands until this phase ships.**

### Phase 1 — Schema Foundation + Closed-Enum + PTF Baseline
**Deliverable:** `StyleSpec` interface (closed enums everywhere except sanitized `voice_note`), `projects.style_spec jsonb` + `projects.reference_assets jsonb` columns, idempotent-absence PTF baseline locked BEFORE feature code (mirrors v2.12 Phase 67 discipline).
**Closes pitfalls:** 1 (legal — closed enums), 2a/2c/2e (VLM failure modes), 3 (injection — closed enums), 5c/5d (silent-drop + TPLREND-05).
**Closed-enum schema is THE primary architectural principle, not a security afterthought.** Every string field MUST be a closed enum: `font_family` from existing 4-font catalog, `treatment_preset` from v2.9 sharp presets, `preferred_lucide` from v2.12 100-icon allowlist, `preferred_shapes` from v2.12 8-shape primitive set, `hook_position` from existing `text_position` enum. Only `voice_note` is free-text (sanitized, ≤200 chars).

### Phase 2 — Vision Extraction + Two-Phase Architecture + Safety Config
**Deliverable:** `extract-style-spec.ts` mirroring `match-photos-to-slides.ts` shape, refusal pre-pass (logos/faces/watermarks), explicit `BLOCK_ONLY_HIGH` Gemini safety + recovery routing, `node-vibrant` for color extraction (Gemini only for role-naming).
**Closes pitfalls:** 1 (refusal pass), 2b/2c (VLM color/text), 3 (architecture — two-phase firewall), 7 (Gemini safety filters).

### Phase 3 — UI: Spec Preview + Per-Aspect Controls + Re-Extract
**Deliverable:** mandatory non-skippable spec-preview panel between extraction and emit, per-aspect checkboxes, "Remix with Brand Kit" toggle, content-path toggle at spec-confirmation, rights clickwrap, safety-block recovery UI.
**Closes pitfalls:** 6b/6c/6e (UX traps), 7 (recovery surface).
**Mandatory non-skippable spec-preview is the single biggest UX defense.**

### Phase 4 — Emit Integration + Token Budget Gate + Single-Undo + 9:16 Fixture Sweep
**Deliverable:** `generate-from-style-spec.ts` projector + Gemini text call (`mode: 'ai-copy' | 'user-copy'` discriminated input). Spec REPLACES template `aiVoiceNote` when present. CI < 12K-token budget gate. One reducer dispatch + one pushHistory. `style-spec-roundtrip.test.ts` mirrors v2.12 PTF17.
**Closes pitfalls:** 5a/5b (token budget + emit ignoring spec), 5d (TPLREND-05 extension), 6c/6d (UX magic + aspect bugs).

### Phase 5 — Remix / Fork + Publish Snapshot
**Deliverable:** `published_carousels.style_spec` + `reference_assets` columns; one-line publish + fork RPC extensions; "Regenerate from references" action.
**Forker gets `slide_data + style_spec + reference_assets` by default.** No new locked-stripping needed (spec is inert metadata).

### Phase 6 — Legal Hardening + ToS Clickwrap + Audit Log + Copy Review
**Deliverable:** `style_reference_uploads` audit table (sha256 + user_id + ToS version + 12-month retention); marketing copy review enforcing "Inspired by" framing; DMCA process docs; final integration smoke.
**Closes pitfalls:** 1 (ToS + audit log), 6a (over-promising copy).

---

## Cross-Document Tensions Resolved

### Tension 1 — Phase ordering (3 vs 4 vs 5 vs 6)
**RESOLVED at 6 phases (+ Phase 0).** Pitfalls' Phase 0 is non-negotiable; Architecture's 5-phase feature split is correct; final legal-hardening phase carries ToS + audit + copy review (too important to bolt onto Phase 4).

### Tension 2 — StyleSpec storage
**Architecture wins: JSONB on `projects` (`style_spec jsonb` + `reference_assets jsonb`)**, not a separate `style_specs` table.
- v2.4 fork RPC compatibility (one-line addition vs FK rewrite)
- `published_carousels` snapshot pattern makes shareability free
- Pre-PMF discipline (separate table is a forward bet on unvalidated demand)

Re-extraction is cheap (~$0.0005); persistence is for **provenance + remix**, not caching.

### Tension 3 — Closed-enum schema posture
**Primary architectural principle, NOT security afterthought.** Closed enums are load-bearing for BOTH Pitfall 1 (no `reference_artist` free-text field for legal exposure) AND Pitfall 3 (no landing zone for prompt-injection-via-image-text). Phase 1 ships closed-enum design as load-bearing deliverable.

### Tension 4 — Premium gating
**OPEN — surfaced as decision needed before Phase 0 scope locks.** Three sub-questions for Diego:
1. Free-tier-with-caps OR premium-only?
2. If free, what daily cap? (Pitfall 4 proposal: 5 uploads × 3 images = 15 vision calls/day)
3. Reuse `match-photos-to-slides.ts` premium gate or new gate?

### Tension 5 — Mandatory pre-flight rails
**Hard constraint on phase ordering.** Phase 0 ships sharp preprocessing + `style_spec_cache` table + per-user-per-day rate cap rails + bill alarm cron BEFORE Phase 1.

---

## Top Critical Pitfalls (with structural defenses)

1. **Copyright / right-of-publicity / trademark dilution** — defense: "Inspired by" framing + refusal pre-pass on logos/faces/watermarks + closed-enum schema + ToS clickwrap + audit log
2. **Prompt injection via text in uploaded image** — defense: closed-enum schema everywhere + two-phase architecture (Phase A vision → validated spec → Phase B text-only emit receives ONLY validated spec, never original image)
3. **Cost / rate-limit blowup** — defense: Phase 0 sharp preprocessing + SHA-256 cache + per-user-per-day caps + 1-retry cap + bill alarm
4. **Style spec collides with existing emit pipeline (silent-drop + TPLREND-05 + token budget)** — defense: schema-first phase ordering + PTF baseline before feature code + spec REPLACES template `aiVoiceNote` + CI token gate + silent-drop counter
5. **UX traps (over-promising / hidden spec / aspect bugs / no retry)** — defense: copy discipline + mandatory non-skippable spec-preview panel + per-aspect checkboxes + sharp aspect-normalize + single-reducer-dispatch single-pushHistory + 2 free re-extract retries
6. **Gemini safety-filter false positives on fitness/fashion/lifestyle** — defense: explicit `BLOCK_ONLY_HIGH` config + `promptFeedback.blockReason` detection + specific recovery UI ("crop high-skin areas / try different image / describe in text")

---

## Feature Categorization (table-stakes / differentiator / anti-feature)

### P1 — Table stakes (must ship in v2.13)
multi-image upload (1–8) · rights modal · vision LLM extract · visible spec preview · edit spec before generate · two-path content toggle · drop into editor · sticky reference thumbnails · visible credit cost · "Remix with Brand Kit" toggle (cheap if existing kit read is easy)

### P2 — Differentiators (defer to v2.14)
per-slide style mapping · save spec as personal Style · "Try this style" preset gallery · generate N variants · clipboard paste · read-only spec JSON viewer

### P3 — Defer to v2.15+ / v3.0+
URL paste → screenshot extract · multi-aspect output · style transfer to user photos (definitively deferred per v2.9 decisions)

### Anti-features (do NOT build)
"perfect 1:1 clone" framing · automatic copyright detection · per-image weighted blend slider · real-time spec preview as user uploads · JSON-textbox spec editor · auto-detect aspect ratio · AI-reference detection · `stylize-image.ts` style transfer onto user photos

---

## Decisions Needed Before Roadmap Locks

1. **Premium gating (Tension 4):** free-tier-with-caps OR premium-only? — needed before Phase 0 scope locks
2. **Refusal pre-pass approach (Phase 2 research flag):** second-Gemini-call OR deterministic classifier OR hybrid? — needed before Phase 2 scope locks
3. **Reference image bucket naming:** `slide-references` (STACK) vs `reference-images` (ARCHITECTURE)? — trivial, pick one before migration writing
4. **(Optional) NSFW pre-classifier:** ship in Phase 0 OR defer until safety-block telemetry shows demand? — adds vendor dependency (~$0.001/image)

---

## Research Flags (Phases needing deeper research during planning)

- **Phase 1:** Closed-enum schema design — exact enum values (4 vs 5 vs 6 font categories? which decoration densities? which palette modes?) is a domain question benefiting from focused research against current TikTok/IG carousel design corpora
- **Phase 2:** Refusal pre-pass build-vs-buy — second-Gemini-call vs Sightengine vs hybrid; cost/latency/accuracy comparison needed
- **Phase 6:** DMCA process + ToS legal language — may need outside review or reuse v2.9 Reface/Kyland Young precedent language

**Phases with standard patterns (skip research):**
- **Phase 0:** Direct mirror of v2.9 Phase 54/57 sharp + cache + rate-cap patterns
- **Phase 3:** Multi-image upload + drag-drop + modal patterns trodden in v2.4 + v2.7 + v2.12
- **Phase 4:** Service-extraction + Zod + emit-integration mirrors v2.5 + v2.9 Phase 58 + v2.12 Phase 71
- **Phase 5:** Fork RPC extension is direct mirror of v2.4 RPC + v2.12 `20260504_fork_strip_decoration_locked.sql`

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Gemini specifics verified against `ai.google.dev` 2026-05-10 + Context7 SDK; existing app patterns verified by direct code reads |
| Features | HIGH | Swipe Carousel verified via WebFetch 2026-05-10; multi-source prior art per row; anti-features each backed by PROJECT.md OR architectural conflict OR prior-art absence |
| Architecture | HIGH | Direct codebase inspection of all integration points; decisions trace to specific existing patterns |
| Pitfalls | HIGH | Gemini pricing + safety + injection vector verified against primary Google docs + DeepMind paper + Trail of Bits; Midjourney litigation (Disney/Universal June 2025, Warner Bros. Sept 2025) verified via Lexology + Wikipedia; VLM benchmarks peer-reviewed |

**Overall confidence: HIGH**

---

## Source References

**Per-document deep dives:** `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` (all in `.planning/research/`)

**Primary external sources:** Gemini docs (image-understanding, pricing, structured-output, safety-settings, long-context), `@google/genai` SDK via Context7, Cornell LII trademark dilution, Disney/Universal v. Midjourney (Lexology), Warner Bros. v. Midjourney (Wikipedia), Canva AI Product Terms, arXiv 2503.23768v3 (VLM font ID), arXiv 2508.16652 (VLM attribute-binding), arXiv 2505.14534v1 (Google DeepMind Defending Gemini), Trail of Bits image-scaling attacks, swipecarousel.com (verified WebFetch 2026-05-10), Midjourney `--sref` docs, Adobe Firefly Style Reference docs, Canva Magic Design + Dream Lab, image.to.design / Codia / dembrandt.

**Internal codebase reads (Architecture):** `match-photos-to-slides.ts`, `generate-slides.ts`, `schemas.ts`, `carousel.ts`, `upload-image.ts`, `slide.ts`, `decoration.ts`, `package.json`, `supabase/schema.sql`, `20260504_fork_strip_decoration_locked.sql`, `.planning/PROJECT.md`.
