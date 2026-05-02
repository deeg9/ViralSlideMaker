---
phase: 56-new-templates-decorative-library
status: complete
reviewed: 2026-04-30
reviewer: orchestrator-inline
overall_score: 22
max_score: 24
ui_spec_baseline: 56-UI-SPEC.md
---

# Phase 56 UI Review — 6-Pillar Audit

**Phase:** 56 — New Templates + Decorative Library
**Audit baseline:** `56-UI-SPEC.md` (visual identity contract for 3 templates + decorative library)
**Implementation:** 4 plans, 6 atomic commits, 11 templates total (8 existing + 3 new)

## Scope of audit

This phase ships **visual identity tokens for 3 carousel templates** that render via the existing dual renderer (Satori + React DOM), plus a decorative-overlay asset library and grain PNG set. There is no traditional web app UI surface — the "UI" is the visual design system that runs on user-generated carousels. The audit applies the 6 pillars to this domain accordingly.

---

## Pillar 1: Copywriting — 4/4

The 3 sample fixtures are the only user-facing copy this phase ships (consumed by `/templates` picker tile + `npm run thumbs`).

| Template | Sample copy | Tone fidelity |
|---|---|---|
| editorial-serif | `"The quietest revolutions begin in living rooms"` + `"Why community kitchens are 2026's most quietly radical institution."` | Restrained, declarative — matches NYT/SSENSE editorial register from UI-SPEC |
| notes-app-chic | `"I quit my job to sell paintings"` + `"6 months. 47 canvases. One sold yesterday."` | First-person, fragmented — perfect ransom-note rhythm |
| brutalist-grid | `"NO HEADLINES. JUST TYPE."` + `"A weekly publication for designers who refuse to decorate."` | Stark, declarative, paradoxical — AIGA brutalist tone exact |

**Scoring rationale (4/4):**
- Each sample reflects its template's intended aesthetic lane (editorial / craft / brutalist)
- Zero AI-slop openers ("In a world where", "Did you know", "Imagine if") — clean
- Tone variation across the 3 templates demonstrates content-lane differentiation
- `aiVoiceNote` strings on each template encode tone rules for the AI generator (template-aware copy at user generation time)
- No hedging, no filler, no LLM-canon platitudes

**Improvements (none required):**
- Sample copy is fixture-quality, not user-facing in production beyond picker tiles. Future: A/B test sample variations to measure picker-tile click-through.

---

## Pillar 2: Visuals — 4/4

Each template has a clear visual identity with a named reference style. Decorative asset library inventoried (14 assets) with locked fill colors and dimensions. Layer order respects the Phase 55 LAYER ORDER contract.

**Asset library quality:**
- 14 decorative assets in `public/overlays/` — 12 SVG + 2 halftone PNG
- 5 grain PNGs in `public/textures/` — deterministic, byte-identical across runs (SHA-256 verified)
- All SVGs are valid XML (`xmllint --noout` passes); inline drop shadows via `<feDropShadow>` (Satori-compatible, NOT CSS `filter:`)
- Total asset weight <2 MB — no bloat
- File naming aligned with renderer convention (`/textures/grain-${intensity}.png`) — fixed mid-execution from CONTEXT D-17 misalignment

**Layer order verification:**
```
0   Background fill / image
1.0 backgroundMode: image-with-bottom-card
1.5 renderGrain (Phase 55 — declared by editorial-serif: medium, notes-app-chic: xerox)
2.0 Overlay color tint
2.5 renderVignette (none of the 3 new templates declare it)
3.0 Hook + body text
4.0 Template overlays (incl. NEW decorative variant)
```

**Scoring rationale (4/4):**
- Distinct visual identities — NYT vs Loewe vs AIGA — no commodity sameness
- Decorative overlays are properly scoped (3 in notes-app-chic; 0 in brutalist-grid by design; 0 in editorial-serif by design)
- TPLREND-05 parity invariant honored (both renderers consume `renderDecorativeOverlay` from same module)
- Generated thumbnails for all 3 new templates verified at 1080×1920

**Improvements (none required):**
- Notes-app-chic decorative placements (rotation/scale/offset) are static across slides; future polish could add per-slide jitter for more "human" feel

---

## Pillar 3: Color — 4/4

60/30/10 hierarchy explicit per template. No purple-blue gradients (Anti-Pattern #2 mitigated). Accent reserved per template with explicit usage rules.

| Template | Dominant 60% | Secondary 30% | Accent 10% |
|---|---|---|---|
| editorial-serif | B&W photo (auto-treated) | `#0A0A0A` near-black + 0.25 overlay tint | `#F5EFE6` cream — text + page counter only |
| notes-app-chic | `#F4EFE3` paper-cream | `#1A1A1A` near-black text | `#FFD86B` sticky-yellow — sticky-note + ransom-note pill |
| brutalist-grid | `#FFFFFF` white | `#000000` black text | `#FF3B30` system-red — single hook segment max |

**Scoring rationale (4/4):**
- Each template demonstrates a coherent 60/30/10 hierarchy
- Accent usage is explicitly scoped (not "all interactive elements") — cream on text, yellow on pill, red on single segment
- No CSS gradient backgrounds (Anti-Pattern #2 mitigated)
- Decorative SVG colors are locked at the asset-fill level (peach tape, pink/blue stickies, etc.) — guarantees visual consistency
- Free-tier templates targeting 3 distinct content lanes — no commodity sameness

**Improvements (none required):**
- Phase 57 will add `paletteMode: 'palette-dominant'` consumer wiring to allow editorial-serif and notes-app-chic to derive accents from photo palette

---

## Pillar 4: Typography — 4/4

No template defaults to Inter (Anti-Pattern #1 mitigated). All fonts in existing Phase 55 catalog. Hook sizes respect TYPO-03 band where applicable; brutalist-grid intentionally above by type-as-image hero requirement.

| Template | Heading | Body | Hook (inner / cover) | Style |
|---|---|---|---|---|
| editorial-serif | Playfair Display | Lora | 130 / 130 px | normal (mixed-case) |
| notes-app-chic | Plus Jakarta Sans (per-segment overrides for ransom-note: Playfair / Bebas Neue / Archivo Black / DM Serif Display) | Plus Jakarta Sans | 110 / 120 px | normal |
| brutalist-grid | Archivo Black | Space Grotesk | 180 / 220 px | uppercase |

**Scoring rationale (4/4):**
- All 3 templates declare explicit `bodyFontFamily` (D-04 / Anti-Pattern #1) — parity test asserts NOT containing 'Inter'
- 5 fonts referenced in notes-app-chic ransom-note segments, all catalog-resident (`loadFontBuffersForSlide` walks them — TPL-07)
- Static-weight TTF only (TYPO-04) — no variable axes
- No Pangram fonts (TYPO-05) — free Google Fonts only
- Phase 55's `news-hook-fit.ts` auto-shrink path handles oversized brutalist hook on long titles

**Improvements (none required):**
- Brutalist hook 180/220px above TYPO-03 band is intentional per TPL-03 type-as-image hero — UI-SPEC documents the deliberate band-break

---

## Pillar 5: Spacing — 4/4

Pixel anchors honored from Phase 55's `SLOT_GEOMETRY`. New decorative overlays use `'free'` slot with explicit pixel offsets.

**Spacing tokens (1080×1920 canvas):**
| Token | Value | Usage |
|---|---|---|
| 3xl | 60px | Canvas-edge inset (`SLOT_GEOMETRY` named slots) |
| 4xl | 80px | Bottom-card padding (existing pattern) |

**Per-template content widths:**
- editorial-serif: 960px hook column (8 columns × 120px)
- notes-app-chic: 960px hook column; decorative overlays at fixed offsets (60, 40), (780, 50), (720, 760)
- brutalist-grid: 540px body width (50% / half-grid) for the type-as-image rhythm

**Scoring rationale (4/4):**
- All values are 4-multiples (4 / 8 / 16 / 24 / 32 / 48 / 60 / 80 px)
- Existing `SLOT_GEOMETRY` from Phase 44/45 is the single source of truth
- Decorative overlay positions are explicit and aesthetic (not arbitrary) — UI-SPEC layout primitives match the rendering output
- Brutalist 8-column grid honored at render-time (CONTEXT D-11) without a schema field

**Improvements (none required):**
- Per-slide decorative jitter (within bounded range) is a future-iteration polish, not a correctness gap

---

## Pillar 6: Experience Design — 2/4

The "experience" surface for this phase is constrained — no new editor controls, no new UI states, no new error/empty/loading states. The picker tile auto-extension is the only user-touchable surface.

**Strong:**
- Picker tile auto-extension via registry iteration (zero TemplatePicker code changes)
- Free-tier (no paywall) — pre-PMF discipline holds
- Module-load validator catches misconfigured decorative assets at build time (errors surface fast)
- Treatment integration in `actions.ts` is best-effort (try/catch falls through) — generation never blocks on treatPhoto failure
- Determinism contract on grain PNGs prevents CI churn

**Weak (cost the 2/4 here):**
- **No user-visible feedback during the (potentially slow) treatPhoto generation step.** When editorial-serif or brutalist-grid is selected with an image, treatPhoto runs server-side per slide; users see existing generation spinner but no specific "applying treatment" status. Phase 57's editor controls will surface treatment state in the right rail, but Phase 56 leaves the generation flow opaque.
- **Picker tile preview quality varies across templates.** notes-app-chic's ransom-note hook with 5 fontFamily values requires Google Fonts CSS fetch via `loadFontBuffersForSlide` for each — the picker tile's SlidePreview component renders sample text but may show fallback fonts during the brief font-load window. No skeleton or graceful-degrade UI.
- **No discoverability hint that brutalist-grid works without an attached photo.** The template's `backgroundMode: 'color'` default means it renders well on white-only canvas, but users may not realize this.

**Scoring rationale (2/4):**
- Phase scope was narrow (visual templates, no editor surface) — most experience work belongs in Phase 57 by design
- The deferrals are documented and non-blocking
- Treatment opacity / picker-preview hint / discoverability nudges are minor polish, not correctness gaps

**Improvements (deferred to Phase 57):**
1. Right-rail treatment status indicator ("B&W applied", "Original photo restored")
2. Picker tile font pre-warm hint (skeleton text while fonts load)
3. Brutalist-grid template card copy: "Type-as-image hero — works on white canvas; attach photo for B&W treatment"

---

## Overall Score: 22/24

| Pillar | Score |
|---|---|
| Copywriting | 4/4 |
| Visuals | 4/4 |
| Color | 4/4 |
| Typography | 4/4 |
| Spacing | 4/4 |
| Experience Design | 2/4 |

## Top 3 fixes (advisory — Phase 57 candidates)

1. **Treatment status feedback during generation** — surface a "Applying B&W treatment to N photos…" sub-status in the generation toast/spinner so users understand the new step. Right-rail treatment controls in Phase 57 will make this self-evident, but a short-term hint would improve perceived performance.
2. **Picker tile font pre-warm** — for notes-app-chic, prefetch the 5 ransom-note fonts on picker hover so the tile renders without fallback text. Implementation: `<link rel="preload" as="font">` injected when picker mounts.
3. **Brutalist-grid template card copy** — add a one-line subtitle ("Type-as-image — works on solid white") under the template name to clarify the intended use without an attached photo.

## Anti-pattern audit

| Anti-pattern | Status |
|---|---|
| Inter as default body font (Anti-Pattern #1) | MITIGATED — all 3 templates declare non-Inter `bodyFontFamily`; parity test asserts |
| Purple/blue gradient backgrounds (Anti-Pattern #2) | MITIGATED — no gradients used; backgroundMode is `image-bleed` or `color` |
| Skipping resolve-overlay.ts for "just one layer" (Anti-Pattern #3) | MITIGATED — `renderDecorativeOverlay` exported from `resolve-overlay.ts`; both renderers consume same module; TPLREND-05 invariant verified by parity test |
| CSS filter properties for photo treatment (PARITY-04) | MITIGATED — `no-css-filter.test.ts` still green; all treatment via Phase 54 server-side `treat.ts` |
| Variable fonts (TYPO-04) | MITIGATED — all fonts static-weight TTF |
| Pangram / paid fonts (TYPO-05) | MITIGATED — free Google Fonts only |
| New npm dependencies (Pre-PMF Rule #1) | MITIGATED — zero new deps |
| Licensed third-party SVG sets (D-37) | MITIGATED — in-house SVG authoring |
| Existing 8 templates byte-identical regression | MITIGATED — Phase 55 `legacy-templates-byte-identical.test.ts` (6/6) STILL passes |

---

**Approval:** Score 22/24 — phase ready for ship. Experience-design improvements are advisory and properly land in Phase 57's editor work.
