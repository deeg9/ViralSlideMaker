# Phase 75: Vision Extraction + Two-Phase Architecture + Safety Config - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Smart-discuss — most decisions locked in REQUIREMENTS.md/SUMMARY.md/research; remaining grey areas covered below

<domain>
## Phase Boundary

Stand up the vision-extraction endpoint with the load-bearing two-phase firewall: Phase A (Gemini Vision call) extracts a raw spec from preprocessed images; Phase B (Zod validate + closed-enum coerce) is the only thing downstream emit ever sees. Raw image bytes never reach the text-emit pipeline. This architecture is the primary defense against prompt-injection-via-image-text (no landing zone for "ignore previous instructions" smuggled in image text — closed enums from Phase 74 + two-phase isolation).

This phase composes Phase 73 cost rails (sharp prep, cache, rate-cap, ledger, retry) + Phase 74 schema (StyleSpec type, Zod validator, projects-storage-constants) into a single extract endpoint. Phase 75 produces the FIRST function that actually calls Gemini Vision in v2.13.

8 reqs in scope: EXTRACT-01..08. Mirror `src/lib/ai/match-photos-to-slides.ts` shape exactly (Promise.race timeout + charge-then-refund + telemetry).

</domain>

<decisions>
## Implementation Decisions

### Locked specs (from REQUIREMENTS.md + research SUMMARY.md)
- **Endpoint:** `extract-style-spec.ts` (server-side service module — NOT a route handler; Phase 76 UI will call via Server Action that imports this)
- **Two-phase architecture:** Phase A vision call → Phase B Zod coerce → return spec. Raw bytes are discarded after Phase A; only the validated spec flows to consumers.
- **Gemini model:** Gemini 2.5 Flash (verified in research/STACK.md — vision-capable, supports `responseMimeType: 'application/json' + responseSchema`, $0.30/$0.30/$2.50 per 1M)
- **Safety config:** `BLOCK_ONLY_HIGH` for all 4 categories (HARASSMENT, HATE_SPEECH, SEXUALLY_EXPLICIT, DANGEROUS_CONTENT) — minimum permissive that still blocks the worst content; lifestyle/fitness slideshows should not be auto-rejected
- **Refusal pre-pass:** Second Gemini Vision call (locked decision — no new vendor; ~$0.001/image extra). Classifies each reference for `{contains_logo, contains_face, contains_watermark}`. Positive hits are FLAGGED in the response for the spec-preview UI to render warnings — NOT auto-rejected.
- **Timeout:** 10-second `Promise.race` per vision call (mirror `match-photos-to-slides.ts`); timeout triggers refund via Phase 73 ledger
- **Palette source:** `node-vibrant` extracts palette deterministically from preprocessed bytes (NOT Gemini). Gemini ONLY for categorical role/style inference (font category, layout type, decoration density, etc.). This is the load-bearing determinism guarantee.
- **Telemetry:** record `vision_calls_count`, `tokens_in/out`, `cache_hit/miss`, `duration_ms`, `block_reason` per request — feeds Phase 73 bill-alarm cron + future per-user analytics

### Claude's Discretion
- **Service module location:** `src/lib/ai/extract-style-spec.ts` (matches existing `match-photos-to-slides.ts` neighbor) — symmetric organization
- **Refusal pre-pass implementation:** parallel Promise.all dispatch with main extraction call (saves ~10s wall time vs sequential) — single round-trip per reference batch
- **node-vibrant invocation:** call once per reference image; merge palettes server-side via dominant-color voting OR weighted average — recommend dominant-color voting (more interpretable)
- **Per-image weighting in role inference:** if N>1 references, treat each equally (voting) — defer per-slide-role mapping to v2.14 P2 deferral
- **Error taxonomy:** distinct return shapes for `{error: 'cap_reached', detail}`, `{error: 'safety_blocked', reason, recovery_suggestion}`, `{error: 'extraction_failed', detail}` — UI in Phase 76 routes per shape
- **Schema-violation handling:** if Gemini returns valid JSON but with unknown enum values, Phase 74's silent-drop counter increments + we still return the spec (degraded gracefully); if Gemini returns invalid JSON entirely (rare), refund + return `extraction_failed`
- **Refusal pre-pass cost recording:** counts as charge (anti-abuse posture per Phase 73 rate-cap policy) but stays under the same rate-cap envelope (one user-initiated extract = one rate-cap unit, not two, even though it makes 2 vision calls — accounting via `vision_calls_count: 2` in telemetry while rate-cap consumes 1 charge)
- **Retry only on Phase A (main extraction)** — refusal pre-pass failure does NOT trigger retry; if pre-pass fails, downgrade to "no flags" rather than blocking the user (graceful degradation)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 73 + Phase 74)
- `src/lib/preprocessing/style-reference-prep.ts` — `prepareForVision(buffer): { bytes, sha256, mimeType, width, height }`
- `src/lib/cache/style-spec-cache.ts` — `lookupStyleSpec`, `persistStyleSpec`
- `src/lib/cost/style-extraction-rate-cap.ts` — `checkExtractionRateCap`
- `src/lib/cost/style-extraction-ledger.ts` — `chargeExtractionCredit`, `refundExtractionCredit`
- `src/lib/cost/style-extraction-retry.ts` — `withSingleRetry`
- `src/lib/types/style-spec.ts` — `StyleSpec` type
- `src/lib/validators/style-spec.ts` — `parseStyleSpecSafe`, `StyleSpecSchema`
- `src/lib/validators/silent-drop-counter.ts` — `createSilentDropCounter`
- `src/lib/types/projects-storage-constants.ts` — `SLIDE_REFERENCES_BUCKET`, `ReferenceAssetRow`

### Existing pattern to mirror exactly
- `src/lib/ai/match-photos-to-slides.ts` — vision-call shape: GoogleGenAI client, Promise.race(call, timeout), structured JSON response with responseSchema, charge-then-refund credit ledger, telemetry capture, error taxonomy
- `src/lib/ai/generate-slides.ts` — text-only Gemini call shape (NOT consumed here; Phase 77 emit will compose with Phase 75 output)

### node-vibrant integration
- Already in `package.json` (v4.0.4) from v2.9 — verified in research/STACK.md
- Server-side import: `import Vibrant from 'node-vibrant'`
- Pattern: `Vibrant.from(buffer).getPalette()` returns named swatches (Vibrant, Muted, DarkVibrant, etc.)

### Integration points
- New file: `src/lib/ai/extract-style-spec.ts` (main service module — exports `extractStyleSpec({projectId, references[]}): Promise<ExtractResult>`)
- New file: `src/lib/ai/extract-style-spec.types.ts` (return-type shapes — error taxonomy + success shape)
- New file: `src/lib/ai/refusal-pre-pass.ts` (second Gemini Vision call for logo/face/watermark detection)
- New file: `src/lib/ai/palette-extraction.ts` (node-vibrant wrapper + multi-image palette merge)
- Tests for each module
- Phase 76 UI consumes this via Server Action wrapper (Phase 76's responsibility — not in 75 scope)

</code_context>

<specifics>
## Specific Ideas

- The 4-pillar two-phase architecture is the v2.13 architectural keystone:
  1. Phase A: vision call returns raw `{palette_dominant_index, font_category, layout_type, hook_position, decoration_density, voice_note}` — NEVER trusted directly
  2. Phase B: `parseStyleSpecSafe` from Phase 74 validates, coerces enums, strips unknowns, sanitizes voice_note
  3. Output: `StyleSpec` type — only thing Phase 77 emit will see
  4. Raw image bytes: discarded after Phase A; never propagate to text-emit prompt
- Palette is extracted client-of-Gemini-but-not-by-Gemini: `node-vibrant` runs server-side on preprocessed bytes from Phase 73; its output is fed into the StyleSpec palette section directly (not via Gemini). This sidesteps Gemini's known weakness on gradient/duotone color extraction (per PITFALLS.md Pitfall 2b).
- Refusal pre-pass output shape: `{[reference_index]: {logo: bool, face: bool, watermark: bool}}` — Phase 76 UI surfaces these as warnings per reference thumbnail with the "Inspired by" framing copy
- Telemetry sink: re-use the existing telemetry infrastructure used by `match-photos-to-slides.ts` (find via grep at planning time)
- Cache is checked BEFORE rate-cap charge — cached extractions are free per CONTEXT.md Phase 73 (cache hit rate is the cost lever)

</specifics>

<deferred>
## Deferred Ideas

- Per-slide style mapping (vision infers role per reference image) — defer to v2.14 P2 (FEATURES.md categorization)
- pHash cache layer above SHA-256 — defer to v2.14 (Pitfalls open question)
- Sightengine NSFW pre-classifier — explicitly NOT in scope per locked decision #4
- Streaming response — anti-decision per Stack research; revisit only if launch latency becomes UX issue
- Premium-tier higher cap — not in v2.13 scope
- Embedding-based style similarity (vector store) — out of scope; we use closed-enum classification not embeddings
- Vision call fan-out beyond 8 references — UI caps at 8

</deferred>
