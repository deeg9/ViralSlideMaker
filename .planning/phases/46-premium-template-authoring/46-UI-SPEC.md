---
phase: 46
slug: premium-template-authoring
status: draft
shadcn_initialized: true
preset: base-nova (existing — no new shadcn components added in this phase)
created: 2026-04-29
---

# Phase 46 — UI Design Contract

> Visual contract for the **3 new premium templates** (`magazine-bold`, `tr3nding-news`, `documentary`). All decisions are LOCKED in `46-CONTEXT.md`. This document formalizes those locked tokens so the planner, executor, and ui-checker have a single source of truth.
>
> **This is not a re-design.** Tokens are extracted from CONTEXT.md verbatim. The Phase 44 schema and Phase 45 renderer are CONSUMED — no schema or renderer changes in this phase.

---

## Phase Type

| Property | Value |
|----------|-------|
| Surface kind | New template configs (TS modules under `src/lib/render/templates/`) |
| New chrome UI | None — no buttons, modals, forms, or screens |
| Visual ground truth | `/Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_1.png` and `_slide_2.png` |
| Render path | Templates rendered through Phase 45 surface: Satori PNG export AND React `<SlidePreview>`. Both paths consume `template.overlays` + `template.backgroundMode` automatically. |
| Schema source | Phase 44 `SlideTemplate` (`src/lib/render/templates/index.ts`) — `overlays`, `backgroundMode`, `TextSegment.highlightColor/highlightStyle` |
| Renderer source | Phase 45 `SLOT_GEOMETRY`, `resolveOverlayContent`, `renderSegments`, `bottomCardBackground` (`src/lib/render/resolve-overlay.ts`) |

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn (existing, base-nova preset) | `components.json` |
| Preset | `base-nova` (Tailwind v4, neutral baseColor, CSS variables, lucide icons) | `components.json` |
| Component library | radix (via shadcn/ui), used in editor chrome only — Phase 46 does not add any | existing |
| Icon library | lucide — Phase 46 does not introduce icons | existing |
| Fonts (canvas content) | `'Anton', sans-serif` (display/hook) + `'Inter', sans-serif` (body) — already loaded for news-drop. **NO new font loads in Phase 46.** | existing templates |
| Tailwind config | inline `@theme` in `src/app/globals.css` (Tailwind v4) | repo state |

**Phase 46 does not initialize shadcn components, add registries, or modify theme tokens.** This phase ships data files (template configs), not chrome.

---

## Premium Tier Cohesion (locked)

The 3 new templates form a "premium tier" with deliberate cohesion-vs-diverge contrast:

| Template | Aesthetic Family | Mint Accent (`#A8E0B0`) | Anton + Inter | Rationale |
|----------|------------------|-------------------------|---------------|-----------|
| `magazine-bold` | News-magazine, photo-driven | YES — pill highlights + topic chip background | YES | Murphy reference; flagship premium template |
| `tr3nding-news` | News-magazine variant with mid-pill | YES — pill highlights + mint text in dark mid-pill | YES | Sibling of magazine-bold; shares cohesion to feel like one premium family |
| `documentary` | Photo-forward, story-led, minimal | NO — accent intentionally `#ffffff` | NO — Inter only | Deliberate divergence: minimal/quiet voice; no decorative pills, no condensed display font |

**Cohesion contract:** `magazine-bold` and `tr3nding-news` MUST share the mint accent hex `#A8E0B0` exactly, and both MUST use Anton for hook + Inter for body. `documentary` MUST NOT introduce mint accent or condensed display font; it stays Inter-only at smaller sizes for the minimal aesthetic to read as intentional, not as an oversight.

---

## Template 1 — `magazine-bold` (Murphy reference flagship)

### Identity tokens

| Token | Value | Source |
|-------|-------|--------|
| `id` | `'magazine-bold'` | CONTEXT.md decisions |
| `name` | `'Magazine Bold'` | derived |
| `thumbnail` | `'/templates/magazine-bold.png'` | CONTEXT.md (PNG generated in Phase 48) |
| `fontFamily` | `"'Inter', sans-serif"` | CONTEXT.md (body) |
| `headingFontFamily` | `"'Anton', sans-serif"` | CONTEXT.md (hook) |
| `hookFontSize` | `'72px'` | CONTEXT.md (smaller than news-drop 110px because card has 80px padding) |
| `bodyFontSize` | `'34px'` | CONTEXT.md |
| `textColor` | `'#ffffff'` | CONTEXT.md (white text on dark card) |
| `backgroundColor` | `'#000000'` | CONTEXT.md (Phase 45 wraps with alpha 0.85 via `bottomCardBackground`) |
| `overlayColor` | `'#000000'` | CONTEXT.md |
| `overlayOpacity` | `0.15` | CONTEXT.md (subtle tint over photo for B&W contrast control) |
| `textAlign` | `'left'` | CONTEXT.md |
| `textPosition` | `'bottom'` | CONTEXT.md (irrelevant for card mode but kept for fallback) |
| `hookStyle` | `'uppercase'` | CONTEXT.md |
| `accentColor` | `'#A8E0B0'` (mint) | CONTEXT.md |
| `backgroundMode` | `'image-with-bottom-card'` | CONTEXT.md |

### Overlays (3)

| # | position | content | style | Notes |
|---|----------|---------|-------|-------|
| 1 | `top-left` | `{ type: 'slide-field', field: 'topic' }` | `{ background: '#A8E0B0', color: '#000000', padding: '8px 20px', borderRadius: '4px', fontSize: '26px', fontWeight: 700, textTransform: 'uppercase' }` | Topic chip — mint background, black text |
| 2 | `top-right` | `{ type: 'page-counter' }` | `{ background: 'rgba(0,0,0,0.6)', color: '#ffffff', padding: '8px 16px', borderRadius: '4px', fontSize: '26px', fontWeight: 700 }` | Page counter pill (e.g. `1/5`) |
| 3 | (implicit) | bottom-card via `backgroundMode` | rendered by Phase 45 `bottomCardBackground` — no explicit overlay | rgba(0,0,0,0.85) per Phase 45 contract |

### Sample data (locked)

```ts
sample: {
  hook_text: 'FOLK SINGER FIGHTS BACK AFTER AI CLONED HER VOICE',
  body_text: 'Murphy Campbell, a folk singer from Western North Carolina, sues OpenAI for copyright theft.',
  hook_segments: [
    { text: 'FOLK SINGER' },
    { text: 'FIGHTS BACK', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
    { text: 'AFTER AI' },
    { text: 'CLONED HER VOICE', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
  ],
}
```

---

## Template 2 — `tr3nding-news` (mid-pill variant)

### Identity tokens

| Token | Value | Source |
|-------|-------|--------|
| `id` | `'tr3nding-news'` | CONTEXT.md |
| `name` | `'Tr3nding News'` | derived |
| `thumbnail` | `'/templates/tr3nding-news.png'` | CONTEXT.md |
| `fontFamily` | `"'Inter', sans-serif"` | CONTEXT.md (body) |
| `headingFontFamily` | `"'Anton', sans-serif"` | CONTEXT.md (hook) |
| `hookFontSize` | `'72px'` | CONTEXT.md (matches magazine-bold for cohesion) |
| `bodyFontSize` | `'34px'` | CONTEXT.md |
| `textColor` | `'#ffffff'` | CONTEXT.md |
| `backgroundColor` | `'#000000'` | CONTEXT.md |
| `overlayColor` | `'#000000'` | CONTEXT.md |
| `overlayOpacity` | `0.15` | CONTEXT.md |
| `textAlign` | `'left'` | CONTEXT.md |
| `textPosition` | `'bottom'` | CONTEXT.md |
| `hookStyle` | `'uppercase'` | CONTEXT.md |
| `accentColor` | `'#A8E0B0'` (mint — matches magazine-bold for premium-tier cohesion) | CONTEXT.md |
| `backgroundMode` | `'image-with-bottom-card'` | CONTEXT.md |

### Overlays (3)

| # | position | content | style | Notes |
|---|----------|---------|-------|-------|
| 1 | `top-right` | `{ type: 'page-counter' }` | `{ background: 'rgba(0,0,0,0.6)', color: '#ffffff', padding: '8px 16px', borderRadius: '4px', fontSize: '26px', fontWeight: 700 }` | Identical to magazine-bold counter for sibling cohesion |
| 2 | `mid` | `{ type: 'literal', text: 'TR3NDING' }` | `{ background: '#000000', color: '#A8E0B0', padding: '12px 24px', borderRadius: '40px', fontSize: '28px', fontWeight: 700, textTransform: 'uppercase' }` | Mid-pill — black background, mint text, fully rounded (40px = pill shape) |
| 3 | (implicit) | bottom-card via `backgroundMode` | rendered by Phase 45 | rgba(0,0,0,0.85) |

**NO `top-left` topic chip** — the mid-pill is the visual identity here.

**Mid-pill is configurable:** template-config consumers can change `content.text` to `'BREAKING'`, `'EXCLUSIVE'`, `'HOT TAKE'`, etc. for future variants without schema changes.

### Sample data (locked)

```ts
sample: {
  hook_text: 'STARTUP RAISES $50M IN 12 MINUTES',
  body_text: 'AI infrastructure boom drives record-breaking seed round.',
  hook_segments: [
    { text: 'STARTUP RAISES' },
    { text: '$50M', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
    { text: 'IN' },
    { text: '12 MINUTES', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
  ],
}
```

---

## Template 3 — `documentary` (minimal divergence)

### Identity tokens

| Token | Value | Source |
|-------|-------|--------|
| `id` | `'documentary'` | CONTEXT.md |
| `name` | `'Documentary'` | derived |
| `thumbnail` | `'/templates/documentary.png'` | CONTEXT.md |
| `fontFamily` | `"'Inter', sans-serif"` | CONTEXT.md (body) |
| `headingFontFamily` | `"'Inter', sans-serif"` | CONTEXT.md (hook ALSO Inter — minimal sans-serif voice; deliberate divergence from sibling templates) |
| `hookFontSize` | `'56px'` | CONTEXT.md (smaller — story-led, not shouting) |
| `bodyFontSize` | `'30px'` | CONTEXT.md |
| `textColor` | `'#ffffff'` | CONTEXT.md |
| `backgroundColor` | `'#000000'` | CONTEXT.md |
| `overlayColor` | `'#000000'` | CONTEXT.md |
| `overlayOpacity` | `0.35` | CONTEXT.md (mid-strength tint for legibility on bright photos) |
| `textAlign` | `'left'` | CONTEXT.md |
| `textPosition` | `'bottom'` | CONTEXT.md (text sits in the gradient-darkened zone) |
| `hookStyle` | `'normal'` | CONTEXT.md (NOT uppercase — minimal voice) |
| `accentColor` | `'#ffffff'` | CONTEXT.md (no accent pill — minimal aesthetic; white = same as text = visual no-op) |
| `backgroundMode` | `'image-bleed'` | CONTEXT.md (full-bleed photo, NO bottom card) |

### Overlays (2)

| # | position | content | style | Notes |
|---|----------|---------|-------|-------|
| 1 | `top-right` | `{ type: 'page-counter' }` | `{ color: '#ffffff', opacity: 0.7, fontSize: '24px', fontWeight: 400, padding: '0', background: 'transparent' }` | Ghosted/minimal counter — no pill, transparent background |
| 2 | `free` | `{ type: 'literal', text: '' }` | `{ width: '1080px', height: '580px', background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))' }` with `offset: { x: 0, y: 1340 }` | Bottom-darken gradient surface — empty literal is fine; renderer emits the styled div |

**NO `top-left` chip, NO mid-pill, NO highlight pills on segments.** Minimal aesthetic locks this.

**Gradient overlay DOM order:** Place LAST in the `overlays` array. Phase 45 layer stack puts overlays BELOW hook/body, so the gradient sits beneath the text and darkens the photo without occluding text.

### Sample data (locked)

```ts
sample: {
  hook_text: 'The Last Glassblower of Murano',
  body_text: 'How four centuries of craft survive in a digital age.',
  // NO hook_segments — minimal aesthetic; segments break the unified-text feel.
}
```

---

## Spacing Scale

All values multiples of 4. Phase 46 reuses Phase 45 slot anchors and pill spacing — no new spacing tokens introduced.

| Token | Value | Usage in this phase |
|-------|-------|----------------------|
| xs | 4px | (consumed by Phase 45 highlight pill `padding: 4px ...`) |
| sm | 8px | Top-left chip vertical padding (`8px 20px` on magazine-bold topic chip and counter pill) |
| md | 12px | Mid-pill vertical padding (`12px 24px` on tr3nding-news mid-pill) |
| lg | 16px | Counter pill horizontal padding (`8px 16px`) |
| xl | 20px | Topic chip horizontal padding (`8px 20px`) |
| 2xl | 24px | Mid-pill horizontal padding (`12px 24px`) |
| — | 60px | Slot inset from canvas edge (top-left/top-right) — owned by Phase 45 `SLOT_GEOMETRY` |
| — | 80px | Bottom-card inner padding — owned by Phase 45 `bottomCardBackground` |
| — | 580px | Documentary gradient overlay height (≈30% of 1920) |
| — | 1340px | Documentary gradient overlay y-offset (1920 − 580 = 1340) |

### Exceptions (locked, all multiples of 4)

| Value | Rationale |
|-------|-----------|
| `borderRadius: '4px'` (chip + counter) | Locked; sharp/structural look matching Murphy reference |
| `borderRadius: '40px'` (mid-pill) | Fully-rounded pill shape — multiple of 4; chosen as "pill-shaped at 56px line height" (visually equivalent to `borderRadius: 9999` since 40 > height/2) |
| `width: 1080px` / `height: 580px` (documentary gradient) | 1080 matches canvas width; 580 = 1340 + 580 = 1920 → bottom-aligned full-width gradient |

---

## Typography

Phase 46 declares **only the type values used by the 3 new templates**. All other type comes from existing template fields and Phase 45 overlay-style rules.

| Role | Size | Weight | Family | Used by |
|------|------|--------|--------|---------|
| Display hook (premium tier) | 72px | inherits Anton's natural weight (≈900) | Anton | `magazine-bold`, `tr3nding-news` |
| Display hook (minimal) | 56px | 400 (Inter regular — quiet voice) | Inter | `documentary` |
| Body | 34px | 400 (Inter regular) | Inter | `magazine-bold`, `tr3nding-news` |
| Body (minimal) | 30px | 400 | Inter | `documentary` |
| Topic chip | 26px | 700 | Inter | `magazine-bold` overlay 1 |
| Page counter (premium tier) | 26px | 700 | Inter | `magazine-bold`, `tr3nding-news` overlay |
| Page counter (minimal) | 24px | 400 | Inter | `documentary` overlay 1 |
| Mid-pill | 28px | 700 | Inter | `tr3nding-news` overlay 2 |

### Phase 46 Typography Rules

1. **No new font families introduced.** Anton + Inter are already loaded and used by the existing news-drop template.
2. **`hookStyle` controls text-transform on hook only.** `'uppercase'` for magazine-bold/tr3nding-news; `'normal'` for documentary. Body never gets text-transform.
3. **Overlay `textTransform` is per-overlay.** Magazine-bold topic chip uses `textTransform: 'uppercase'`; counters and pills omit it (already configured uppercase via content/styling).
4. **Heading font fallback rule preserved.** Hook uses `template.headingFontFamily ?? template.fontFamily`. Documentary deliberately sets both to Inter so hook + body share family — this is a positive, intentional configuration, not a missing `headingFontFamily`.

---

## Color

Per-template 60/30/10 mapping. The "60% / 30% / 10%" framing applies to **what the viewer sees on a finished slide**, not to chrome UI (this phase has none).

### `magazine-bold`

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `slide.background_url` photo (full-bleed B&W ideal) | Slide visual surface; tinted via `overlayColor #000000 × 0.15` for contrast control |
| Secondary (30%) | `rgba(0,0,0,0.85)` bottom-card | Hosts hook + body text |
| Accent (10%) | `#A8E0B0` mint | Topic chip background AND pill highlights on `hook_segments` |
| Destructive | n/a | No destructive UI |

**Mint accent reserved for:**
1. Top-left topic chip background (overlay 1)
2. Per-segment pill backgrounds on `hook_segments` and `body_segments` when `highlightColor === '#A8E0B0'`

### `tr3nding-news`

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `slide.background_url` photo | Slide visual surface; tinted via `overlayColor #000000 × 0.15` |
| Secondary (30%) | `rgba(0,0,0,0.85)` bottom-card + black mid-pill | Card + mid-pill surfaces |
| Accent (10%) | `#A8E0B0` mint | Mid-pill text color AND pill highlights on `hook_segments` |
| Destructive | n/a | No destructive UI |

**Mint accent reserved for:**
1. Mid-pill `color` (text inside the black pill) — overlay 2
2. Per-segment pill backgrounds on `hook_segments` when `highlightColor === '#A8E0B0'`

### `documentary`

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `slide.background_url` photo (full-bleed) | Slide visual surface; tinted via `overlayColor #000000 × 0.35` |
| Secondary (30%) | `linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))` bottom-darken gradient | Visual zone hosting hook + body text |
| Accent (10%) | `#ffffff` (intentionally same as text — no decorative accent) | n/a — minimal aesthetic |
| Destructive | n/a | No destructive UI |

**Accent reserved for:** **NONE.** Documentary deliberately does not use an accent color. The `accentColor` field is set to `#ffffff` (the same as text) so any legacy `seg.accent === true` segment renders identically to non-accent text — visual no-op.

### Color rules for this phase

| Rule | Locked value | Source |
|------|--------------|--------|
| Mint hex (premium tier) | `#A8E0B0` (exact) | CONTEXT.md (sampled from Murphy reference image) |
| Magazine-bold + tr3nding-news bottom-card alpha | `0.85` (rgba — Phase 45 default applied because `backgroundColor` is 6-digit hex `#000000`) | Phase 45 contract |
| Magazine-bold + tr3nding-news photo tint | `#000000 × 0.15` | CONTEXT.md (subtle — preserves photo legibility) |
| Documentary photo tint | `#000000 × 0.35` | CONTEXT.md (mid-strength — photos may be brighter/colorful) |
| Documentary bottom-darken gradient | `linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))` | CONTEXT.md |
| Counter pill background (magazine-bold + tr3nding-news) | `rgba(0,0,0,0.6)` | CONTEXT.md (semi-opaque so photo bleeds through) |

---

## Component Inventory (template configs only — no chrome)

Phase 46 introduces no shadcn components and no React components. The "components" are template config objects shipped as TS modules.

| Artifact | File | Type | Contract |
|----------|------|------|----------|
| `magazineBold` config | `src/lib/render/templates/magazine-bold.ts` | `SlideTemplate` constant | Tokens above; passes `validateTemplateRegistry` at module load |
| `tr3ndingNews` config | `src/lib/render/templates/tr3nding-news.ts` | `SlideTemplate` constant | Tokens above; passes validator |
| `documentary` config | `src/lib/render/templates/documentary.ts` | `SlideTemplate` constant | Tokens above; passes validator |
| Registry | `src/lib/render/templates/index.ts` | edited array | Append 3 new templates AFTER existing 5 (preserves `getTemplate()` fallback to highlight-bar at index 0) |

### Registry order (locked)

```ts
export const templates: SlideTemplate[] = [
  highlightBar,    // index 0 — default fallback (unchanged)
  newsDrop,
  newsCyan,
  y2kPop,
  boldYellow,
  magazineBold,    // new — Phase 46
  tr3ndingNews,    // new — Phase 46
  documentary,     // new — Phase 46
]
```

**No new shadcn registry components used.** Registry safety gate not applicable.

---

## Regression Contract — 5 Existing Templates

Phase 46 is **additive**. The 5 existing templates (`highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`) MUST render byte-identical to v2.6 baseline. Their UI tokens are NOT in scope for this phase — frozen as-is.

### Regression test contract

| Test file | Asserts |
|-----------|---------|
| `src/__tests__/render/legacy-templates-regression.test.tsx` (NEW) | Snapshots all 5 existing templates' Satori output via `buildSlideElement` with a fixed `Slide` fixture. Test fails loud if ANY byte changes between v2.6 baseline and Phase 46 output. |
| Existing Phase 45 snapshot tests | Untouched — not modified by Phase 46. |

### Fixture strategy (Claude's discretion per CONTEXT)

Inline 5 fixtures in the test file (only 5 — no need for a separate `fixtures.ts` helper yet).

---

## Test Strategy (parity + regression contract under test)

| Test layer | File | Asserts |
|-----------|------|---------|
| Satori snapshot — new templates | `src/__tests__/render/render-slide-satori.test.tsx` (extended) OR new `premium-templates.test.tsx` | Each new template renders through `buildSlideElement(slide, template, brandKit, tier, origin, ctx)` and matches a stored snapshot. Exercises `image-bleed` (documentary), `image-with-bottom-card` (magazine-bold, tr3nding-news), all overlay slot positions, and mint pill highlights. |
| DOM signature — new templates | `src/__tests__/components/slide-preview-overlays.test.tsx` (extended) | Each new template renders through `<SlidePreview>` and emits the expected `data-testid` + DOM structure for top-left chip, top-right counter, mid-pill (where present), bottom-card, and free-slot gradient. Parity gate vs Satori snapshot. |
| Regression — legacy 5 | `src/__tests__/render/legacy-templates-regression.test.tsx` (NEW) | Snapshots all 5 existing templates with fixed fixtures; fails loud on any byte drift. |
| Validator — module load | (covered by existing module-load behavior in `src/lib/render/templates/index.ts`) | `validateTemplateRegistry(templates)` runs at import; misconfigured overlay declarations on any of the 3 new templates fail `npm run build`. |

**Explicitly out of test scope:** pixel-diff visual regression (deferred to v3.0+ per Phase 45 deferred section).

---

## Copywriting Contract

Phase 46 introduces no chrome UI copy (no buttons, no error toasts, no empty states). The "copywriting" surface is **the sample data on each new template**, used as the picker mini-preview content.

| Element | Copy | Template |
|---------|------|----------|
| `magazine-bold` sample hook | `'FOLK SINGER FIGHTS BACK AFTER AI CLONED HER VOICE'` | matches Murphy reference |
| `magazine-bold` sample body | `'Murphy Campbell, a folk singer from Western North Carolina, sues OpenAI for copyright theft.'` | matches Murphy reference |
| `tr3nding-news` sample hook | `'STARTUP RAISES $50M IN 12 MINUTES'` | story-shaped real content |
| `tr3nding-news` sample body | `'AI infrastructure boom drives record-breaking seed round.'` | story-shaped real content |
| `tr3nding-news` mid-pill default | `'TR3NDING'` | matches Murphy slide-1 reference |
| `documentary` sample hook | `'The Last Glassblower of Murano'` | story-led, minimal voice |
| `documentary` sample body | `'How four centuries of craft survive in a digital age.'` | story-led |
| Empty state | n/a — picker always has sample data | — |
| Error state | n/a — Phase 44 validator surfaces config errors at build time | — |
| Destructive action | n/a — no destructive actions | — |
| Primary CTA | n/a — no chrome introduced | — |

### Copy rules

1. **Sample copy must be story-shaped, not lorem ipsum.** Picker preview should look like a real slide.
2. **Mid-pill content is configurable per CONTEXT.md.** Default `'TR3NDING'`; future variants can override via `content.text`.
3. **Documentary samples MUST NOT use `hook_segments`.** Including segments breaks the unified-text minimal feel — locked exclusion.

---

## Render Context Compatibility

Phase 46 templates rely on Phase 45 `ctx` threading. No new context plumbing is introduced — templates simply consume what Phase 45 provides:

| Overlay content | Resolves to | Source |
|-----------------|-------------|--------|
| `magazine-bold` topic chip (`slide-field topic`) | `ctx.topic ?? ''` | Phase 45 `resolveOverlayContent` |
| `magazine-bold` + `tr3nding-news` page counter | `'{slideIndex+1}/{totalSlides}'` | Phase 45 `resolveOverlayContent` |
| `tr3nding-news` mid-pill literal | `'TR3NDING'` (verbatim) | Phase 45 `resolveOverlayContent` |
| `documentary` page counter | `'{slideIndex+1}/{totalSlides}'` | Phase 45 |
| `documentary` gradient free slot literal | `''` (empty — the styled div IS the gradient surface) | Phase 45 |

**Graceful fallback (locked, code-level):**

| Condition | Behavior |
|-----------|----------|
| `ctx.topic` undefined | Topic chip on magazine-bold renders as empty string. Picker mini-preview supplies a real topic via `slide.body_text` context (unchanged). |
| `ctx` omitted entirely | Counter renders `1/1`; topic chip renders empty. No throw (Phase 45 contract). |

---

## Slot Geometry Compliance

All 3 new templates use Phase 45 `SLOT_GEOMETRY` anchors. No new slot positions introduced.

| Slot used | Templates | Purpose |
|-----------|-----------|---------|
| `top-left` | `magazine-bold` (overlay 1) | Topic chip |
| `top-right` | `magazine-bold` (overlay 2), `tr3nding-news` (overlay 1), `documentary` (overlay 1) | Page counter |
| `mid` | `tr3nding-news` (overlay 2) | Mid-pill |
| `bottom-card` | `magazine-bold` + `tr3nding-news` (implicit via `backgroundMode`) | Hook + body host |
| `free` | `documentary` (overlay 2) | Bottom-darken gradient surface |

Documentary's `free`-slot use is the **first non-trivial use of the `free` slot in v2.7** — validates schema flexibility without requiring schema extension.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none added in this phase | not required (no third-party blocks consumed) |

Phase 46 ships TS data files (template configs), not new shadcn components or registry blocks. The registry-safety vetting gate is not applicable.

---

## Out of Scope (locked)

Listed so the checker doesn't flag absence:

- Schema changes — Phase 44 is locked.
- Renderer changes — Phase 45 is locked. Magazine-bold proves Phase 45 works end-to-end.
- AI prompt changes — Phase 47.
- Template thumbnail PNG generation — Phase 48 (Phase 46 ships `thumbnail: '/templates/<id>.png'` paths only; PNGs do not exist on disk yet).
- Template picker UI changes — Phase 48.
- Editing or removing the 5 existing templates — frozen; regression test guards them.
- New shadcn components, registries, theme tokens — none introduced.
- Pixel-diff visual regression — deferred to v3.0+.
- Re-design of the 3 templates' aesthetics — all decisions LOCKED in CONTEXT.md.

---

## Checker Sign-Off

The 6 standard dimensions, evaluated against this phase's template-authoring surface (no chrome UI introduced).

- [ ] **Dimension 1 — Copywriting:** Sample copy declared per template (story-shaped, not lorem). Mid-pill default copy locked. Documentary segments deliberately omitted. **Expected verdict:** PASS.
- [ ] **Dimension 2 — Visuals:** All 3 templates have full token sets (overlays, backgroundMode, sample), all anchored to Phase 45 `SLOT_GEOMETRY` and Murphy reference. Premium tier cohesion contract documented (mint + Anton/Inter for magazine-bold + tr3nding-news; deliberate divergence for documentary). **Expected verdict:** PASS.
- [ ] **Dimension 3 — Color:** Per-template 60/30/10 mapping declared. Mint hex `#A8E0B0` exact-match for premium-tier cohesion. Documentary intentionally skips accent. **Expected verdict:** PASS.
- [ ] **Dimension 4 — Typography:** Two fonts (Anton + Inter), both already loaded. 8 type roles declared with size + weight + family, all multiples of 2 for px. Documentary's Inter-only configuration is intentional, not a gap. **Expected verdict:** PASS.
- [ ] **Dimension 5 — Spacing:** All values multiples of 4. Slot inset (60px) and bottom-card padding (80px) inherited from Phase 45. Pill paddings (8/16, 8/20, 12/24) all multiples of 4. **Expected verdict:** PASS.
- [ ] **Dimension 6 — Registry Safety:** No new registry blocks consumed. Vetting gate not applicable. **Expected verdict:** PASS.

**Approval:** pending
