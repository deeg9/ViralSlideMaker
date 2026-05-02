# Phase 56: New Templates + Decorative Library — Discussion Log

**Mode:** `--auto` (Claude-decided defaults grounded in v2.9 research synthesis + Phase 55 carry-forward + codebase audit)
**Date:** 2026-04-30

This log captures the auto-resolved gray areas and the rationale for each chosen default. Downstream agents (researcher, planner, executor) read CONTEXT.md as the canonical decision record. This log is for human reference only (audits, retrospectives).

---

## Auto-resolved Gray Areas

### Area 1: Template aesthetic configurations (D-05, D-07, D-10)
- **Q:** What concrete typography / color / layout defaults for editorial-serif, notes-app-chic, brutalist-grid?
- **Selected:** Per-template config locked in CONTEXT D-05 (editorial-serif), D-07 (notes-app-chic), D-10 (brutalist-grid) — body fonts from Phase 55 catalog, accent colors per research aesthetic references (cream / sticky-yellow / brutalist-red), backgroundMode per template intent (image-bleed / image-bleed / color)
- **Rationale:** Aesthetic references in `.planning/research/FEATURES.md` (NYT, SSENSE, A24, Loewe, Duolingo, Brand New, AIGA) provide concrete visual targets; Phase 55 font catalog provides font palette; TYPO-03 hook size band guides hook fontSize choices

### Area 2: Free vs premium tier (D-03)
- **Q:** Do new templates extend `PREMIUM_TEMPLATE_IDS`?
- **Selected:** No — all 3 new templates are free-tier per TPL-09 + Pre-PMF research finding that "no paywall on differentiation features pre-PMF"
- **Rationale:** Phase 55's `validatePremiumBodyFont` checks `PREMIUM_TEMPLATE_IDS`; not extending it means free-tier templates aren't validator-required to declare `bodyFontFamily`. However, D-04 voluntarily declares it on all 3 templates per universal anti-Inter discipline (Anti-Pattern #1)

### Area 3: Decorative overlay schema integration (D-13, D-14)
- **Q:** How do decorative SVG/PNG assets get composed into slides — new schema field or new overlay-content type?
- **Selected:** New discriminated-union member `{ type: 'decorative'; asset: DecorativeAsset; rotation?; scale?; opacity? }` on `OverlayContent` — keeps assets composable via existing `template.overlays[]` array; new resolver `renderDecorativeOverlay` handles rendering
- **Rationale:** Existing `OverlayContent` discriminated union (literal | page-counter | slide-field) is the natural extension point; pattern is established (Phase 44); validator extension is trivial; both renderers consume from same resolver per TPLREND-05 invariant

### Area 4: Decorative asset sourcing (D-15, D-16)
- **Q:** SVG vs PNG; in-house vs licensed third-party set?
- **Selected:** 12 SVGs + 2 halftone PNGs hand-authored in repo; NO licensed third-party sets
- **Rationale:** Pitfalls Pre-PMF Rule #1 (no new deps), zero IP risk, halftone needs raster grain that vector strokes can't reproduce. Sample SVG path data hand-authored or LLM-generated; mock-quality acceptable for free-tier launch

### Area 5: Grain PNG generation determinism (D-17, D-18, D-20)
- **Q:** Generated procedurally vs designer-supplied PNGs? Determinism contract? Commit policy?
- **Selected:** Procedurally generated via `scripts/build-textures.ts` using sharp + seeded noise; SHA-256-determinism-tested; committed PNGs (not regenerated at build time)
- **Rationale:** Determinism prevents CI thumbnail diff noise (phase brief constraint); sharp already installed (Phase 54 — no new dep); committed binaries are version-controlled; build script regenerates on demand for designers iterating

### Area 6: TextSegment.fontFamily extension (D-21, D-22, D-23)
- **Q:** Where does per-segment fontFamily land? How does font loader walk it?
- **Selected:** `TextSegment.fontFamily?: string` in slide.ts; `loadFontBuffersForSlide` extended to walk `slide.hook_segments` and add unique segment fontFamilies to load set; renderer applies via inline style on `<span>`
- **Rationale:** TPL-07 explicitly requires per-segment for ransom-note hook; existing `extractFontName` + catalog lookup pattern handles arbitrary fonts; both renderers call same `renderSegments` helper — TPLREND-05 preserved

### Area 7: Cover ≠ Inner layouts (D-25, D-26)
- **Q:** How does the renderer apply `coverLayout` overrides?
- **Selected:** `resolveSlideStyles(slide, template, slideIndex)` extended to merge `template.coverLayout` over template defaults when `slideIndex === 0`
- **Rationale:** Phase 55 added `coverLayout?` schema field but no renderer support; Phase 56 wires it because all 3 new templates need cover-vs-inner distinction; existing 8 templates leave `coverLayout` undefined → no behavior change

### Area 8: Treatment pipeline integration timing (D-27, D-28)
- **Q:** When does `treatPhoto()` get wired into the generation pipeline?
- **Selected:** Phase 56 — required because `editorial-serif` declares `photoTreatment: 'bw'` and MUST render B&W photos to satisfy TPL-01
- **Rationale:** Phase 54 deferred this (no consumer); Phase 55 deferred again (still no consumer); Phase 56 has the first consumer template — landing the wire-in here is just-in-time

### Area 9: Parity test scope (D-32, D-33)
- **Q:** Does Phase 56 ship the full parity test harness or just per-template assertions?
- **Selected:** Per-template parity test for the 3 new templates only (`new-templates-parity.test.tsx`); full visual grid harness (`render-parity-grid.ts`) ships in Phase 58
- **Rationale:** Phase 58's PARITY-03 explicitly scopes the visual grid harness to that phase; Phase 56's TPL-10 only requires per-template parity; no scope overlap

### Area 10: Plan structure (D-40)
- **Q:** How does Phase 56 split into plans?
- **Selected:** 3-4 plans — 56-01 (assets), 56-02 (schema + resolver), 56-03 (templates + parity), 56-04 (optional picker test + smoke)
- **Rationale:** Wave-based: assets ship first (independent, paths exist before consumers), schema/resolver second (consumers exist now), templates third (depend on both), polish last; mirrors Phase 55's 2-plan split scaled up for the larger Phase 56 scope

---

## Deferred (captured for later phases)
- See CONTEXT.md `<deferred>` section.

## Claude's Discretion (planner judgment)
- See CONTEXT.md `<decisions>` § "Claude's Discretion" subsection for items where multiple acceptable approaches exist.

---

*Note:* This is a `--auto` mode discussion log — no interactive AskUserQuestion calls were made. All 40 D-NN decisions in CONTEXT.md were resolved by Claude based on (a) Phase 55 carry-forward, (b) v2.9 research findings, (c) hard constraints from the phase brief, and (d) codebase audit. User can review and edit CONTEXT.md before planning advances.
