---
gsd_state_version: 1.0
milestone: v2.13
milestone_name: Style-from-Reference Generation
status: completed
stopped_at: Roadmap locked. Awaiting `/gsd-plan-phase 73` to begin execution.
last_updated: "2026-05-14T21:55:00.000Z"
last_activity: 2026-05-14 -- Completed quick task 260514-kct: make decorations (icons/shapes) draggable on canvas via Rnd wrapper + new onDecorationPositionChange handler; preserves rotation/selection contracts via inner visual-wrap div
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 20
  completed_plans: 20
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-10 — v2.13 milestone started)

**Core value:** Type a topic, get ready-to-post carousel slide images — fully AI-generated, editable, downloadable.
**Current focus:** v2.13 Style-from-Reference Generation — let users upload reference slideshow images and generate a new slideshow that mimics the reference's full design template (palette, type, layout, shape/decoration patterns) with their own content; two content paths (AI-generated copy from a topic OR user-supplied copy with style-only application); output lands in the existing v2.11/v2.12 editor. Phase numbering continues from 73.
**Success metric (v2.13):** A user can upload 1–8 reference slideshow images, see a mandatory non-skippable spec preview of the extracted style (palette swatches + font categories + layout sketch), pick a content path, and land in the editor with a generated 5-slide carousel that visually inherits the reference's design — all under hard cost rails (15 vision calls/day cap), with closed-enum schema defending against legal exposure AND prompt injection, and TPLREND-05 byte-identity invariant preserved across all v2.12 templates.

## Current Position

Phase: 79 — COMPLETE
Plan: —
Status: Phase 79 complete
Last activity: 2026-05-12 -- Completed quick task 260511-uk1: fix carousel palette divergence (template_id snapshot gap + explore-detail hardcode + fork-RPC hardcode); brand-kit decision locked at Option B

## v2.13 Phase Map

| Phase | Name | Reqs | Depends |
|-------|------|------|---------|
| 73 | Cost & Preprocessing Rails (Foundation) | 8 | — |
| 74 | Schema Foundation + Closed-Enum + Reference Upload + PTF Baseline | 22 | 73 |
| 75 | Vision Extraction + Two-Phase Architecture + Safety Config | 8 | 73 (HARD), 74 |
| 76 | Spec Preview UI + Per-Aspect Controls + Re-Extract + Recovery | 12 | 75 |
| 77 | Emit Integration + Token Budget Gate + Single-Undo + Editor Handoff | 14 | 76 |
| 78 | Remix / Fork / Publish Snapshot | 5 | 77 |
| 79 | Legal Hardening + ToS Clickwrap + Audit Log + Copy Review | 7 | 78 |

**Total:** 75 reqs across 9 categories (COST / REF / STYLESPEC / EXTRACT / PREVIEW / EMIT / EDITOR / REMIX / LEGAL + cross-cutting PARITY). 100% coverage; no orphans.

**Build-order constraints (non-negotiable, locked at roadmap):**

1. **Phase 73 ships first.** Cost rails (sharp preprocessing + SHA-256 cache + per-user-per-day rate cap + bill alarm) MUST land before any vision extraction code. Roadmap forbids merging Phase 73 into Phase 74 or 75.
2. **Phase 74 PTF baseline (STYLESPEC-11) locked BEFORE any vision-extraction feature code** (mirrors v2.12 Phase 67 PTF16 idempotent-absence discipline). Legacy projects with `style_spec: null` must render byte-identical across all 12 templates × both renderers.
3. **Phase 76 PREVIEW-01 mandatory non-skippable spec-preview** is the single biggest UX defense — do NOT split across phases or make optional.
4. **Closed-enum schema (STYLESPEC-03..09)** is THE primary architectural principle — defends against both legal exposure AND prompt-injection-via-image-text simultaneously. Phase 74 owns this as load-bearing, NOT as a security afterthought.

## Cross-Phase Constraints (carry-forward — every plan must honor)

### v2.13-specific constraints

| Constraint | Source | Notes |
|------------|--------|-------|
| Two-phase firewall (Phase A vision → validated spec → Phase B emit) | EXTRACT-02 + Pitfall 3 | Raw image bytes never reach text emit; emit consumes ONLY validated spec |
| Closed enums everywhere except sanitized `voice_note` | STYLESPEC-03..09 + PARITY-05 | `git grep "reference_artist\|reference_brand\|copy_exactly\|style_freetext"` MUST return zero matches |
| Spec REPLACES template `aiVoiceNote` when both present | EMIT-05 | Explicit precedence; documented in code comment + test |
| Single reducer dispatch + single pushHistory per generation | EMIT-10 | Mirror v2.12 BULK_ROTATE — Cmd+Z restores exact pre-generation state |
| Vision call retries capped at 1 (not 3) | COST-07 | Transient errors fail loud rather than compound cost |
| Per-user-per-day rate cap enforced server-side | COST-04 | 5 extraction calls × 3 images = 15 vision calls/day (free tier) |
| Charge-then-refund credit ledger | COST-06 | Mirror v2.6 `gemini_vision_match` pattern |
| 10-second Promise.race timeout per vision call | EXTRACT-06 | Mirror `match-photos-to-slides.ts` pattern |
| `BLOCK_ONLY_HIGH` Gemini safety config + `promptFeedback.blockReason` recovery | EXTRACT-03 + EXTRACT-07 | Structured `{blocked, reason, recovery_suggestion}` for UI |
| Silent-drop counter at AI-ingest boundary AND emit boundary | STYLESPEC-10 + EMIT-08 + PARITY-03 | Alerting on non-zero |
| 9:16 aspect-normalize at sharp preprocessing | PARITY-04 + COST-01 | Defends against v2.12 ASPECT-01 bug class |
| CI prompt-token-budget gate < 12K tokens | EMIT-06 | Gemini 2.5 Flash context budget headroom |
| Zero new fields on Slide type | STYLESPEC-12 | TPLREND-05 byte-identity preserved by construction |
| "Inspired by" framing across every UI surface | LEGAL-03 | No "exactly like" / "clone" / "copy" / "duplicate" copy |

### v2.12 carry-forward (still apply to every Phase 73–79 plan)

| Constraint | Source | Notes |
|------------|--------|-------|
| `(slide.decorations ?? []).map(...)` at every render+transform site | TPLREND-05 + idempotent absence | Never `slide.decorations.map(...)` |
| Explicit hex in every schema color field | PCL12 grep gate | No `currentColor`, no `inherit`, no CSS vars |
| CSS `box-shadow` for shadow effects | PCL13 grep gate + v2.1 reuse | Never SVG `<filter>` |
| Per-icon static imports OR `dynamicIconImports` | DEPS-05 + bundle gate | Never barrel `import * as LucideIcons` |
| `isPickerOpenRef` second short-circuit on tinykeys firewalls | v2.12 H.1 SWEEP carry-forward | Picker keyboard scope MUST suspend editor scope |
| `AddressableScope` exhaustive type + PRA1..PRA12 source-grep audit | v2.12 G.1 reducer symmetry | Cross-scope reducer changes fail CI on missing scope |
| `onRotateStop` only (matches v2.10 onDragStop/onResizeStop) | PERF-01 carry-forward | BULK_ROTATE dispatched once per gesture |

### v2.11 carry-forward (still apply)

| Constraint | Source | Notes |
|------------|--------|-------|
| `onDragStop` / `onResizeStop` only | v2.10 PERF-01 | Never per-tick `onDrag` / `onResize` |
| `isEditing` keyboard guard | v2.8 KBD-02 | `slide-editor.tsx:344-348` |
| `pushHistory` once per gesture | KBD-09 + ALIGN-08 | Single undo step per multi-element op |
| Editor chrome gates `editable={true}` | TPLREND-05 + PARITY-01 | Selection rings, marquee, smart guides, group bbox, layers panel — all gated |
| Modifier state resets on blur | KBD-04 + SNAP-05 | `window.blur` + `visibilitychange` |
| Z-order = array splice | ZORDER-05 + Satori invariant | Never CSS `z-index` |
| Selection state outside reducer history | SEL-15 + v2.8 pattern | React state only |

## Locked Decisions (pre-roadmap, 2026-05-10)

1. **Premium gating:** Free-tier with daily cap (5 uploads × 3 images = 15 vision calls/day). Reuses existing credit-ledger pattern. Owned by Phase 73.
2. **Refusal pre-pass approach:** Second Gemini Vision call (no new vendor; ~$0.001/image extra). NOT Sightengine, NOT hybrid. Owned by Phase 75.
3. **Storage bucket name:** `slide-references` (matches existing `slide-*` prefix). Owned by Phase 74.
4. **NSFW pre-classifier:** Deferred — rely on Gemini built-in safety (`BLOCK_ONLY_HIGH`) + recovery UI (Phase 76); revisit on telemetry. Explicitly NOT in Phase 73 scope.

## Coverage Audit

| Category | Count | Phase(s) | Coverage |
|----------|-------|----------|----------|
| COST | 7 | 73 | ✓ |
| REF | 7 | 74 | ✓ |
| STYLESPEC | 12 | 74 | ✓ |
| EXTRACT | 8 | 75 | ✓ |
| PREVIEW | 12 | 76 | ✓ |
| EMIT | 10 | 77 | ✓ |
| EDITOR | 3 | 77 | ✓ |
| REMIX | 5 | 78 | ✓ |
| LEGAL | 6 | 79 | ✓ |
| PARITY | 5 | 73 (P-04), 74 (P-01, P-03 intro, P-05 intro), 77 (P-02, P-03 emit-boundary verify), 79 (P-05 final verify) | ✓ |

**Total:** 75/75 reqs mapped (100%). Zero orphans. Zero duplicates.

## Performance Metrics

**Velocity (through v2.12):**

- Total milestones shipped: v1.0, v1.1, v1.3, v2.0, v2.1, v2.2, v2.4, v2.5, v2.6, v2.7, v2.8, v2.9, v2.10, v2.11, v2.12
- Latest: v2.12 (6 phases / 67–72, 19 plans, ~875 tests added, ~82 commits, 81/81 reqs at code level — shipped 2026-05-04)
- Tests trajectory: v2.12 ended at ~960 tests (was 756 at v2.9; +204 net new across 23 plans through v2.11; +875 across v2.12). 17 baseline tsc errors preserved throughout.

**v2.13 Progress:** 0/7 phases complete; 0/? plans complete; 0/75 reqs satisfied.

## Accumulated Context

### Decisions

- [v2.13 / roadmap]: 7 phases (73–79), aligned with research synthesis canonical 6+0 split. Phase 73 (cost rails foundation) is hard prerequisite for Phase 75 (vision extraction); roadmap forbids merging. Phase 74 (schema + closed-enum + upload + PTF baseline) bundles the schema-first discipline (mirror v2.12 Phase 67 PTF16 lock-before-feature-code) with the reference upload pipeline because both are pre-extraction surfaces with identical "no vision call yet" posture.
- [v2.13 / roadmap]: 75 v2.13 reqs across 9 categories (COST / REF / STYLESPEC / EXTRACT / PREVIEW / EMIT / EDITOR / REMIX / LEGAL + cross-cutting PARITY). 100% mapped to phases 73–79. Coverage: 73=8 (incl. PARITY-04), 74=22 (REF-01..07 + STYLESPEC-01..12 + PARITY-01,03,05 intro), 75=8, 76=12, 77=14 (EMIT-01..10 + EDITOR-01..03 + PARITY-02), 78=5, 79=7 (LEGAL-01..06 + PARITY-05 final-verify).
- [v2.13 / roadmap]: PARITY-03 (silent-drop counter) is *introduced* in Phase 74 with STYLESPEC-10 at AI-ingest boundary; *verified at emit boundary* in Phase 77 with EMIT-08. Primary owner = Phase 74 to honor "exactly one phase" rule; emit-boundary verification is a Phase 77 success criterion.
- [v2.13 / roadmap]: PARITY-05 (closed-enum CI grep gate) is *introduced* in Phase 74 (load-bearing on STYLESPEC-03..09); *verified end-to-end* in Phase 79 legal hardening pass. Primary owner = Phase 74; final verification is a Phase 79 success criterion.
- [v2.13 / roadmap]: Free-tier with daily cap (15 vision calls/day) chosen over premium-only — pre-PMF wedge growth dominates monetization concerns. Cap rails owned by Phase 73 (COST-04).
- [v2.13 / roadmap]: Second Gemini Vision call for refusal pre-pass (no new vendor) — chosen over Sightengine and hybrid options. Cost: ~$0.001/image extra; latency under 10s budget. Owned by Phase 75 (EXTRACT-05).
- [v2.13 / roadmap]: Storage bucket = `slide-references` (matches existing `slide-*` prefix). NOT `reference-images`. Owned by Phase 74 (REF-01).
- [v2.13 / roadmap]: NSFW pre-classifier explicitly deferred — Gemini `BLOCK_ONLY_HIGH` + recovery UI (Phase 76 PREVIEW-12) is sufficient pre-PMF. Telemetry from Phase 75 (EXTRACT-08) feeds the revisit decision.
- [v2.13 / roadmap]: Closed-enum schema is THE load-bearing architectural principle, NOT a security afterthought. Defends BOTH legal exposure (no `reference_artist` free-text) AND prompt-injection-via-image-text (no landing zone for "ignore previous instructions"). Phase 74 ships closed enums for palette.mode, typography.hookFontCategory, decorations.preferredLucide (v2.12 100-icon allowlist), decorations.preferredShapes (v2.12 8-shape primitives), layout.hookPosition (existing text_position enum), imagery.treatmentPreset (v2.9 sharp presets). Only `voice_note` is free-text (sanitized, ≤200 chars, single line).
- [v2.13 / roadmap]: StyleSpec is a separate type, NOT a Slide override — preserves TPLREND-05 byte-identity with zero new fields on Slide (STYLESPEC-12). Only the projector (`StyleSpec → Slide[]`) needs new test coverage. PTF baseline test (STYLESPEC-11) is the structural guarantee; locked BEFORE feature code per v2.12 Phase 67 discipline.
- [v2.13 / roadmap]: Two-phase architecture firewall (EXTRACT-02) — Phase A vision call extracts raw spec; Phase B Zod validates + closed-enum-coerces; Phase B output is the ONLY thing downstream emit ever sees. Raw image bytes NEVER reach text emit. This is THE structural defense against prompt-injection-via-image-text.
- [v2.13 / roadmap]: Spec REPLACES template `aiVoiceNote` when both are present (EMIT-05). Explicit precedence; documented in code comment + test. Mirror v2.9 Phase 58 `template_id_override` precedence pattern.
- [v2.13 / roadmap]: `node-vibrant` extracts palette deterministically from preprocessed bytes; Gemini is invoked only for categorical role/style inference (EXTRACT-04). Same posture as v2.9 Phase 57 palette extraction; carries forward `node-vibrant@4.0.4` (no scope per project memory) on the server-only `'use server'` boundary.
- [v2.13 / roadmap]: 12K-token CI prompt-budget gate (EMIT-06) — fails build if `style_spec + topic + brand_kit + system_prompt` exceeds Gemini 2.5 Flash headroom. Mirror v2.12 DEPS-05 bundle-size gate pattern (CI-enforced, fail-fast).
- [v2.13 / roadmap]: Single reducer dispatch + single pushHistory per generation (EMIT-10) — Cmd+Z restores exact pre-generation state in one undo step. Mirror v2.12 BULK_ROTATE pattern.
- [v2.13 / roadmap]: Vision call retries capped at 1 (NOT 3) — transient errors fail loud rather than compound cost (COST-07). Charge-then-refund ledger (COST-06) handles refunds.
- [v2.13 / roadmap]: Phase 76 is the only pure-UI phase. Phase 77 has editor handoff surface (EDITOR-01..03 — "From references" badge + persistent reference thumbnails). Phase 79 has clickwrap modal surface (LEGAL-01 — ToS modal on first upload). Roadmap UI hint: yes for 76 only.

### Pending Todos

- v2.13: Run `/gsd-plan-phase 73` to begin executing the cost rails foundation phase.
- v2.13 / Phase 75: research deeper — Refusal pre-pass build-vs-buy comparison (second-Gemini-call cost/latency/accuracy already chosen; document fallback if Gemini-only proves insufficient on telemetry).
- v2.13 / Phase 79: research deeper — DMCA process + ToS legal language (may need outside review; reuse v2.9 Reface/Kyland Young precedent language as starting point).
- v2.13 / Phase 74: research deeper — exact closed-enum values (4 vs 5 vs 6 font categories? which decoration densities? which palette modes?) is a domain question benefiting from focused research against current TikTok/IG carousel design corpora.

### Roadmap Evolution

- Phase 80 added: composition-aware style extraction — replace flat StyleSpec tagging with archetype classification + typed slot primitives so style-from-reference can faithfully reproduce captioned/collage/highlight-rhythm layouts that the renderer already supports

### Carry-over from v2.12

- 6 manual QA smoke tests pending: Lucide picker scroll perf (1,703 icons, lazy-loaded); 5-slide Gemini generation with 0–2 decorations; fork carousel with locked decorations; open v2.11-saved project byte-identity check; drag rotation handle + Shift-snap to 15° + single Cmd+Z; export PNG of rotated decoration.
- Carry-over: Manual iPhone Safari touch QA for v2.10 corner resize handles (A11Y-01 deferred).
- Carry-over: Manual visual QA on v2.9 templates (NYT/SSENSE / Loewe-Duolingo / AIGA fidelity).
- Carry-over: ZIP download rate trajectory measurement 14+ days post-v2.9 launch against baseline.

### Blockers/Concerns

- None active for v2.13 — all gray-area decisions resolved at requirements lock (premium gating = free with caps; refusal pre-pass = second Gemini call; bucket = `slide-references`; NSFW pre-classifier deferred).
- Watch item: Phase 74 is largest at 22 reqs (>15 instruction threshold). REF (7) + STYLESPEC (12) + PARITY (3 cross-cutting) substructure mitigates; if Wave decomposition during plan-phase produces a >5-plan phase, may need to consider splitting REF off into Phase 73.5 (upload pipeline). Roadmap currently keeps them combined because both are pre-extraction surfaces with identical "no vision call yet" posture, and the PTF baseline lock applies to the combined surface.
- Carry-over reminder: TPLREND-05 parity invariant — every editor-only addition must gate behind `editable={true}` so Satori/HTML render paths stay byte-identical. v2.13 adds NO new editor chrome (StyleSpec is server-side only); the spec-preview UI in Phase 76 lives BEFORE editor handoff in a separate flow.
- Carry-over reminder: Closed-enum invariant (PARITY-05) is structurally load-bearing — any free-text artist/brand field reintroduced in any phase fails the CI grep gate. Plan reviewers must scan StyleSpec changes for new free-text fields.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260511-flj | Narrow content blocks to nudity/CSAM only; shift IP/right-of-publicity liability to user via T&C (supersedes Phase 75 D-05 + Phase 76 PREVIEW-10) | 2026-05-11 | 740823c | [260511-flj-narrow-content-blocks-to-nudity-and-csam](./quick/260511-flj-narrow-content-blocks-to-nudity-and-csam/) |
| 260511-uk1 | Fix carousel palette divergence — closes Phase 78 template_id snapshot gap + hardcoded explore-detail template + fork-RPC hardcode. Brand-kit decision locked at Option B (mergeWithBrandKit is no-op for built-in templates) | 2026-05-12 | 531ef9a | [260511-uk1-fix-carousel-palette-divergence-across-d](./quick/260511-uk1-fix-carousel-palette-divergence-across-d/) |
| 260514-hide-styles | Hide 5 deprecated visual styles from picker (highlight-bar, news-drop, magazine-bold, documentary, brutalist-grid). Kept in registry so legacy projects render; added `HIDDEN_FROM_PICKER` set + `pickerTemplates` filtered export. | 2026-05-14 | 70e6528 | [20260514-hide-deprecated-styles-from-picker](./quick/20260514-hide-deprecated-styles-from-picker/) |
| 260514-icon-pill | Figma-style icon-swap pill + "← Browse {icon\|element} library" link in the Elements inspector. Replaces the dead "AlertTriangle" label with a clickable pill (thumbnail + name + chevron) that opens LucidePicker in swap-mode. Adds `pickerMode` state in slide-editor so picker success dispatches UPDATE_DECORATION (preserves position/color/size) instead of ADD_DECORATION. | 2026-05-14 | 8e25d8f | [20260514-icon-swap-pill-back-to-library](./quick/20260514-icon-swap-pill-back-to-library/) |
| 260514-jn5 | Fix icon/element editor bugs — move DecorationCard from Text tab to Elements tab w/ auto-tab-switch on decoration select, add Delete button, wire Icons + Shapes picker tiles into ElementsPanel library mode | 2026-05-14 | 4f2c55e | [260514-jn5-fix-icon-element-editor-bugs](./quick/260514-jn5-fix-icon-element-editor-bugs/) |
| 260514-k3j | Centralize auto-publish-on-generate across all three carousel generation paths — new `lib/services/auto-publish-on-generate.ts` helper called from `generateCarousel`, `generateCarouselFromReferences`, and `actions.ts` `generateCarousel`. Kills the recurring "Private by default" regression at the source: any new generation path is one call away from honoring public-by-default. | 2026-05-14 | 7572046 | [260514-k3j-auto-publish-on-generate-everywhere](./quick/260514-k3j-auto-publish-on-generate-everywhere/) |
| 260514-kct | Make decorations (icons/shapes) draggable on the canvas — wrapped each decoration in `<Rnd>` in slide-preview.tsx, wired new `onDecorationPositionChange` callback through slide-canvas → slide-editor → `UPDATE_DECORATION` dispatch. Group drag (BULK_TRANSLATE) was already supported by the reducer (Phase 68 Plan 02) but the canvas never dispatched it for decorations — now it does. Rotation transform moved to inner visual-wrap div so it doesn't clobber Rnd's `translate(x,y)`. | 2026-05-14 | aaeda7b | [260514-kct-make-decorations-draggable](./quick/260514-kct-make-decorations-draggable/) |

**Follow-up note:** Hero PNG re-render for historical `published_carousels` rows is OUT OF SCOPE of quick-260511-uk1. Existing rows keep their (now-stale) `hero_image_url`; users can republish to get a fresh PNG. A future quick task could add an admin one-shot script that iterates rows and re-runs `renderHeroBuffer` against the snapshotted `(slide_data, template_id, style_spec)` triple.

## Session Continuity

Last activity: 2026-05-10 — **v2.13 Roadmap created**. ROADMAP.md prepended with v2.13 milestone block (7 phases, 73–79) above existing shipped-milestone history. STATE.md initialized with v2.13 phase map, cross-phase constraints, locked decisions, and coverage audit. REQUIREMENTS.md traceability section filled (75/75 reqs mapped, zero orphans).

Stopped at: Roadmap locked. Awaiting `/gsd-plan-phase 73` to begin execution.

Next: Phase 73 (Cost & Preprocessing Rails — Foundation). 8 reqs (COST-01..07 + PARITY-04). Hard prerequisite for Phase 75. Sharp pipeline + SHA-256 cache table + per-user-per-day rate cap + bill alarm cron + charge-then-refund ledger + 1-retry cap + 9:16 aspect-normalize regression test. Direct mirror of v2.9 Phase 54/57 sharp + cache + rate-cap patterns; standard pattern, skip deeper research.
