# Feature Research: v2.9 Viral Visual Quality

**Domain:** Visual quality of AI-generated TikTok/Instagram carousel slides — replicating what's actually winning on platform in early-to-mid 2026.
**Researched:** 2026-04-30 / 2026-05-01
**Confidence:** HIGH on archetypes and creator handles (multi-source verified). MEDIUM on specific complexity estimates (codebase-grounded but unbenchmarked).

---

## Executive Take (read this first)

The single most important shift in 2026: **the algorithm now penalizes "AI slop polish" and rewards visible imperfection.** Mosseri's January 2026 thesis: *"Rawness isn't just aesthetic preference anymore — it's proof. It's defensive. A way of saying: this is real because it's imperfect."* 56% of consumers report encountering AI slop "often" or "very often" (Sprout Social Q1 2026). Save-rate is now ranked above likes; DM-sends are the new top signal.

Translated for our product: **the safest path to "looks AI-generated" is exactly what most carousel tools default to** — clean Inter sans, centered headlines on muted-stock photos, predictable 9-slide flow, glossy gradients, no grain, perfect alignment. We currently sit closer to that pole than the winning pole. v2.9 should push toward **opinionated editorial archetypes**, **manufactured imperfection cues**, and **better photo treatment** — not more knobs.

The seven dominant 2026 carousel archetypes (full table in §1) cluster into three workable families for us:

1. **Editorial / Magazine** (Murphy reference, our `magazine-bold`, NYT, A24, SSENSE) — table stakes.
2. **Photo-Dump / Documentary-Raw** (Emma Chamberlain, Bella Hadid, Magnum) — we currently cannot do this; biggest gap.
3. **Brutalist / Notes-App / Type-As-Image** (Brand New, AIGA Eye on Design, Loewe) — biggest differentiator vs Canva-default tools.

The MVP for v2.9 is **two new opinionated template families + a global photo-treatment pass + a hook-frame system + AI prompt rules that prevent slop tells.** Concrete patterns are itemized in §3.

---

## 1. Visual Archetypes / Sub-Genres of Viral Carousels (2026)

Based on the *Aesthetics of Photography* 2026 grammar audit, Canva's *Imperfect by Design* report, It's Nice That, and direct creator-handle review.

| Archetype | What Defines It | Key Creators (real handles) | Platform Dominance | Currently Match? |
|---|---|---|---|---|
| **Magazine-Editorial** | B&W or duotone full-bleed photo + bold display headline + small mint/red accent chip + page counter. Hook reads like a *New York Magazine* cover line. | `@nytimes`, `@a24`, `@reservoir.mag`, `@ssense`, `@magnumphotos` | IG carousels, LinkedIn | **Partial** — `magazine-bold` v2.7 hits the silhouette but lacks photo-treatment & decorative-element variety. |
| **Hyperreal Mundane / Glow-Object** | Single object centered, sacred composition, neutral-WB, lifted shadows, deep DoF. Caption is short/declarative. Mundane-as-monument. | `@halfbakedharvest`, `@nytimes` (Cooking), `@apartmenttherapy` | IG, Pinterest | **No** — we render text on photos; this archetype is photo-led with text below or beside, not over. |
| **Photo-Dump / Indie-Sleaze** | 6–12 slides, no preset cohesion, on-camera flash, motion blur, off-center framing, intentional disarray. "Vibe over consistency." | `@indiesleaze`, `@thecobrasnake`, `@emmachamberlain`, `@bellahadid`, `@loewe` | IG carousels, TikTok Photo Mode | **No** — our pipeline forces template uniformity across slides. Big gap. |
| **Documentary-Raw** | Available light, eye-contact frontal portraits, mid-action, naturalistic color, no skin smoothing, zero post. | `@magnumphotos`, `@keithleeeats`, NYT/Guardian visual desks | IG carousels, TikTok | **No** — image sourcing (Pexels) skews glossy/stock; Imagen output skews "AI sheen." |
| **Educational / Carousel-Deck** | "Mini PowerPoint" — clean grid, 6–10 slides, hook → frame → 3–5 points → CTA. Most predictable but reliable on LinkedIn/IG-business. | `@thechrisdo`, `@aliabdaal`, `@hormozi`, `@justinwelsh`, `@sahilbloom`, `@steven` (Bartlett), `@garyvee` | IG, LinkedIn | **Yes** — our existing 5 legacy templates fit this lane. This is the *commodity* lane (high competition). |
| **Brutalist / Notes-App-Chic** | Type-as-image. Heavy stacked headlines, ransom-note collage, photocopier grain, DIY scrapbook overlays, hand-drawn arrows, sticky notes. Embraces "imperfect by design." | Loewe, `@duolingo`, Brand New (Under Consideration), Eye on Design (AIGA) | TikTok, IG, design-Twitter | **No** — biggest *differentiator* opportunity vs Canva templates. |
| **Cinematic-Anamorphic / Movie-Still** | Teal-orange grade, crushed blacks, anamorphic flares, 2.39:1 letterbox bars, practical lights in frame. Reads "luxury film promo." | `@a24`, `@brandonwoelfel`, `@gigihadid` (editorial slides) | IG, TikTok luxury content | **No** — nice-to-have, not v2.9 critical. |
| **Color-Walk / Mono-with-Accent** | Single dominant hue across all slides, one color = subject, serial repetition. Highest grid-cohesion score. | `@marcjacobs`, `@kayla_itsines`, `@pamela_rf` | IG | **No** — would emerge naturally from a "palette extraction" feature. |
| **Brain-Rot / Italian-Brainrot** | Hyper-saturated, deliberately ugly, AI compression artifacts, illogical loops, meaning-optional. *Gen Alpha's dominant aesthetic.* | `@duolingo`, Skibidi accounts, `@ryanair` | TikTok-native | **Out of scope** — we are not the right product for this. |
| **Vampy / Dark Cottagecore** | Oxblood, deep plum, charcoal palette, low-key single-source lighting, gothic still-life, frontal symmetry, heavy negative space. | Niche aesthetic accounts, fashion editorials | IG | **Partial** — would be a single-template add. |
| **Place Romanticization** | Golden-hour amber, lifted blacks, bloom, sequential B-roll-style stills, slow visual flow. | `@visitnyc`, `@discoverlosangeles`, travel creators | IG, Reels covers | **Partial** — works fine in our existing Imagen path with the right prompt. |

**Sources for archetypes:**
- Aesthetics of Photography, *The Viral Visual Grammar of US Instagram in 2026* (HIGH).
- Canva Newsroom, *Imperfect by Design 2026 trends* (HIGH).
- It's Nice That, *Forward-thinking graphic trends 2026* (HIGH).
- Amra & Elma, *25 Influencers Making Carousels Go Viral in 2026* (creator handles, MEDIUM — verify each handle on platform before citing).

---

## 2. Concrete Visual Patterns (cross-cutting, what shows up on actual viral posts)

### Typography

| Pattern | What It Looks Like | Currently Have? | v2.9 Implication |
|---|---|---|---|
| **Display sans, oversized condensed** | Anton, Bebas Neue, Druk, Tungsten Heavy, Founders Grotesk Cond, Inter Display Black at 96–140px. Headline >40% of slide width. | **Yes** (Anton in `magazine-bold`/`tr3nding-news`); under-used elsewhere. | Promote to *all* premium templates; raise default hook size; allow type to bleed off canvas edges. |
| **Sharp modern serif** | Playfair Display, Recoleta Bold, Editorial New, GT Sectra, Domaine Display. Authority cue, *The Cut*/*New Yorker*-coded. | **No** as a hero typeface. Available via Google Fonts. | New "editorial-serif" template family. Pair with B&W or duotone photo. |
| **Variable-weight display** | Single typeface flexing W100→W900 across slides for visual rhythm without changing fonts. | **No** — we treat font as a single value. | Cheap upgrade: allow `fontWeight` per `TextBox`; AI varies weight across slide deck. |
| **Type-as-image / bleed text** | Headline cropped at edge, intentionally over-tracked, stacked vertically, overprinted on photo. | **No** — text always confined to safe area. | Large unlock: new template variants where hook deliberately exceeds safe area. |
| **Imperfect / hand-edited type** | Slightly stretched, uneven baselines, manual kerning, signaling human authorship. | **No** — Satori renders pixel-perfect. | Add subtle randomized rotation/skew/letter-spacing jitter (2026 *It's Nice That*: "imperfect typography slows the eye"). |
| **Ransom-note / pick-and-mix** | Mixed typefaces and sizes within one phrase ("Pick and Mix" — It's Nice That 2026 trend; Eva Rotreklová, F37 Foundry). | **Partial** — segment-level styling exists in `TextBox.segments`. Not yet supporting font-family per segment. | Allow per-segment `fontFamily` override. AI emits ransom-note hooks for select templates. |
| **Numerals as decoration** | Oversized "01", "1/8" page-counters, Helvetica Neue Black numerals, sometimes outlined or duo-toned. | **Yes** (we have page counters). Underused — too small. | Make page counter scale and treatment template-driven (some XL, some hairline). |

**Anti-pattern:** Inter Regular as default body font on every template. *925studios.co* explicitly cites "default Inter font" as the #1 web-design AI-slop tell for 2026. We currently use Inter as a fallback. Replace with a templated body font per template family.

### Color

| Pattern | What It Looks Like | v2.9 Implication |
|---|---|---|
| **Monochrome + single accent** | Entire palette = black/white/cream with ONE accent (mint, hot pink, oxblood, electric blue). Murphy-Campbell reference is exactly this. | **Build:** template-level `accentColor` already exists; add per-archetype defaults beyond mint. |
| **Duotone photos** | Photo split-toned to 2 colors (cream/oxblood, navy/cream, B&W with single mint highlight). | **Build:** GPU-cheap CSS filter or server-side Sharp duotone pass. High visual ROI per dollar of build. |
| **Palette extraction from photo** | Background card / accent / counter pill all auto-derive from dominant photo colors. Color-Walk archetype gets this for free. | **Build:** node `vibrant.js` or `sharp` extract on background image at slide-load; cache hex → propagate to overlay tokens. Medium build, big quality jump. |
| **Y2K vibrant / energetic combos** | Bright hues, unexpected pairings (versacreative.com 2026: "return to vibrant color"). Counter-trend to muted minimalism. | **Build:** 1 new template ("Y2K Pop") — neon green / hot pink / cyan. |
| **Muted earth-tones + paper** | Cream, paper-yellow, ivy green, sepia (Poetcore archetype). | **Build:** 1 template ("Editorial Cream"). |
| **Vampy oxblood / charcoal / pewter** | Vampy archetype palette. | **Build:** 1 template ("Vampy"). |

**Anti-pattern:** purple-to-blue gradient backgrounds. Cited as the #2 AI-slop tell after default Inter. We don't currently default to this, but the Imagen API does — so prompt-level guardrails matter.

### Composition & Hierarchy

| Pattern | Description | Currently Have? | v2.9 Implication |
|---|---|---|---|
| **First-slide hook = thumb-stop** | Cover frame must be readable at 1:1 thumbnail crop with text in upper third. Buffer/Later: centered face = +38% likes. | **Partial** — `magazine-bold` puts hook in bottom card, which fails the "upper third" rule on grid. | Add `coverHookPosition: 'upper-third' \| 'bleed' \| 'bottom-card'` per template; default upper-third for new "thumbnail-optimized" variants. |
| **Asymmetric grid / off-center** | Hook offset hard-left or hard-right, NOT centered. Editorial newspapers ([It's Nice That] *Brute Force*). | **No** — text is always anchored to template-fixed positions; no off-center variants. | New layout primitives: `text-left-bleed`, `text-bottom-right`, `diagonal-stack`. |
| **Generous negative space** | Single short phrase + 70% empty canvas. Vampy and Poetcore archetypes. | **No** — every template fills with body copy. | New "minimal" variants where body is null and only hook renders. |
| **Image-bleed full-frame** | Photo edge-to-edge, no card, text overlaid. | **Yes** (`backgroundMode: 'image-bleed'` exists). Underused — only `documentary` template uses it. | Promote to default; add gradient-darken overlay variants. |
| **Bottom-card composition** | Photo top, text card bottom (Murphy reference). | **Yes** (`magazine-bold`). | Keep, but vary card height (some thin strip, some half-canvas). |
| **Numbered-list horizontal** | Slide 2..N format: number + headline + body. Gary Vee, Hormozi, Welsh. | **Partial** — page counter exists but isn't a "number-as-headline" element. | Template variant where the numeral IS the hero. |
| **6–12 slide sweet spot** | Beyond 13 → swipe fatigue. Under 6 → reads as ad. | **N/A** — user-configurable; AI defaults to ~5–7. | AI prompt update: target 7–9 slides for educational, 6–8 for editorial. |
| **Pacing arc** | Hook → reframe → 3 supports → turning point → CTA. Sahil Bloom's "swipe arc" model. | **Partial** — generation has hook + body per slide but no explicit arc. | AI prompt update: explicit slide-role schema (`hook \| context \| support1..N \| pivot \| close`). |

### Photo Treatment (huge gap area)

| Treatment | What It Is | Build Cost | Visual Impact |
|---|---|---|---|
| **B&W / desaturated** | Convert background image to greyscale or 5–15% saturation. | **LOW** (Sharp `.greyscale()` or CSS `filter: grayscale(1)`). | HIGH — instantly editorial. |
| **Duotone** | Map photo luminance to 2-color gradient (cream→oxblood, etc.). | **LOW-MED** (Sharp `.recomb()` or canvas blend mode). | HIGH — most-cited 2026 editorial signal. |
| **Film grain overlay** | 5–15% opacity grain texture overlaid on the slide. | **LOW** (PNG noise overlay layer in our existing 9-layer composite stack). | HIGH — Mosseri quote: imperfection cues = "proof of human." |
| **Halation / bloom** | Subtle red/magenta glow around highlights (anamorphic-cinematic cue). | **MED** (Sharp gaussian blur of red channel only). | MED — niche but signature. |
| **Crushed blacks / lifted shadows** | Tone curve adjustment (Hyperreal Mundane signature). | **LOW** (CSS `filter: contrast(1.15) brightness(0.95)` or Sharp curve LUT). | MED — works on premium templates. |
| **Soft vignette** | Darkening at edges, focus pulled to center. | **LOW** (radial gradient overlay). | LOW — cliché if overused. |
| **Posterization / 4-color reduction** | Reduce photo to 4–6 color zones (Brand New / brutalist look). | **MED** (Sharp `.posterise()`). | HIGH for differentiation. |
| **Photocopier / xerox grain** | Heavy noise + greyscale + slight blur (It's Nice That 2026 *"Make Me a Copy"* trend, Charlotte Rohde). | **LOW-MED** (greyscale + grain overlay + slight blur). | HIGH — under-served by competitors. |
| **Tape strips / sticky notes / decorative stickers** | Decorative sprite layer on top of canvas (Notes-App-Chic). | **MED** (asset library + overlay positioning). | HIGH for differentiation. |
| **Scan-line / VHS** | Low-priority Y2K cue. | **LOW**. | LOW — niche. |

**Anti-pattern:** generic Pexels stock photo of "smiling diverse team in modern office" overlaid with hook. This is the most identifiable AI-slop carousel tell. We pull from Pexels by default — prompt-level + template-level interventions needed.

### Pacing Across Slides

- **Cover (slide 1):** hook in upper third, readable at 1:1 thumb-crop, single-color anchor, optional face. Target <8 words.
- **Reframe (slide 2):** restate the problem from the cover in plain language. Often "Here's why…"
- **Supports (slides 3–6):** numbered points or photo-led story. Each has its own hook.
- **Pivot (slide 7):** turn — "But here's what changed…" / "The actual answer is…" Often a photo-only slide for emotional reset.
- **CTA / close:** explicit ask — "Save this." / "Send to a friend who…" / "Follow for more." DM-send hooks now outweigh likes (Mosseri Jan 2026).

We currently generate hook + body per slide with no slide-role differentiation. **AI prompt rewrite is the highest-leverage feature in this category.**

### Decorative Elements (currently missing)

| Element | Examples | Build Cost |
|---|---|---|
| Highlight pills around words | Already shipped v2.7 mint pills. | DONE |
| Page counters (1/8 style) | Already shipped. | DONE |
| Tape strips ("torn-paper") | Notes-App-Chic, scrapbook | LOW (PNG overlay sprites) |
| Sticky-note callouts | Brutalist, scrapbook | LOW |
| Hand-drawn arrows / circles | Educational pivots, "look here" | LOW (SVG overlays) |
| Drop-shadow stickers | Y2K, Gen-Alpha | LOW |
| Frames around photos (Polaroid, ticket stub, slide-frame) | Vintage-zine, Poetcore | LOW |
| Old-paper texture background | Editorial-cream, vintage-zine | LOW (background composite) |
| Halftone / dot-screen overlay | Brutalist, magazine | LOW (CSS background-pattern) |

These are all **template-overlay primitives** — our existing `TemplateOverlay[]` schema (v2.7 Phase 44) already supports adding them. Build cost is mostly asset curation + 1 new overlay type per element.

### Motion-Implied Static (TikTok auto-slideshow)

TikTok Photo Mode now auto-advances slides — viewers experience them more like a deck of frames in motion than a swipe-paced gallery. This means:

- **Continuity across slides matters more.** Color-Walk archetype thrives here (one dominant hue carries through).
- **Implied direction.** Diagonal type, arrows, or photos cropped to lead the eye toward the next slide.
- **Repetition with variation.** Same layout grid + slot variations (left → center → right; small → medium → large).

We don't currently model this — every slide is composed independently. v2.9 should add **template "rhythm" rules** (e.g. odd slides text-left, even slides text-right; or progressive zoom across slides).

---

## 3. Table Stakes vs Differentiators vs Anti-Patterns

### Table Stakes (Users Expect These — Missing = Looks AI-Generated)

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **B&W / duotone photo treatment toggle** | Editorial archetype is the dominant viral aesthetic on IG. Every successful carousel tool has at least monochrome. | LOW | CSS filter or Sharp; fits in existing `resolve-overlay.ts` layer stack. |
| **Subtle film-grain overlay (per-template, default-on for premium)** | 56% of users see AI slop daily; grain is now *default Instagram editing grammar* (VSCO Film 02 reissue Feb 2026). | LOW | Single PNG overlay sprite + opacity slider per template. |
| **Variable hook size / type-as-image option** | All viral carousels in 2026 use display type at 96–140px; we under-size hooks. | LOW | Bump default `fontSize` for premium templates; allow `fontSize: 'xl' \| 'xxl' \| 'bleed'` enum. |
| **First-slide ≠ inner-slides composition** | Cover frame needs upper-third hook for thumbnail readability; inner slides can use any layout. | LOW-MED | New per-template `coverLayout` distinct from `innerLayout`. |
| **Slide-role-aware AI generation** | Hook/reframe/supports/pivot/CTA structure is what every educational creator uses (Hormozi, Welsh, Bloom). | MED | Extend Gemini schema with `role` field per slide; prompt addendum per role. |
| **Stronger sans display fonts (Druk, Founders Grotesk Cond, Tungsten alternatives)** | Anton alone is a single look; viral creators use 5+ display sans. | LOW | Curate 4–6 Google Fonts alternatives; add per-template font binding. |
| **Sharp modern serif option (Playfair / GT Sectra-alternative)** | Editorial archetype demands serif; we have zero serif templates. | LOW | New "editorial-serif" template. |
| **Per-segment font family override** | Ransom-note / pick-and-mix typography is a 2026 *It's Nice That* named trend. | LOW | Extend `TextSegment` with optional `fontFamily`. |
| **Page-counter typography variants (XL serif, hairline, framed)** | Counter is a signature decorative element across viral templates; we have one default style. | LOW | Already template-driven; add 3–4 visual variants. |
| **No Inter as default body font on premium templates** | "Default Inter" is the #1 cited AI-slop tell for 2026. | LOW | Per-template body-font assignment. |
| **No purple-to-blue gradient backgrounds** | #2 AI-slop tell. Affects Imagen output specifically. | LOW | Add prompt guardrail: "no gradient backgrounds, no glossy 3D, no abstract blobs." |

### Differentiators (Set Us Apart from Canva / Capsule / Plot / Visla / aiCarousels)

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Auto palette extraction from background photo** | Accent color, page counter, bottom-card all derive from photo's dominant hue. Generates Color-Walk archetype "for free." | MED | `node-vibrant` or `sharp` palette extraction at image-load; populate template tokens. Cache by image URL. |
| **Notes-App-Chic / Brutalist template family** | Loewe, Duolingo, Brand New, AIGA Eye on Design aesthetic — *zero* AI carousel tools currently ship this. Biggest differentiation lane. | MED | 2–3 new templates: `notes-app-chic`, `brutalist-grid`, `xerox-zine`. Plus decorative overlay library. |
| **"Photo-dump" mode — heterogeneous slides** | Skip template uniformity for select templates; let each slide have its own composition. Mimics Indie-Sleaze / Photo-Dump archetype. | MED-HIGH | Architectural — current renderer assumes consistent template across slides. Could implement as "template variant per slide" within a family. |
| **Photocopier / xerox treatment toggle** | It's Nice That 2026 named trend ("Make Me a Copy"). High-craft signal. | LOW-MED | Greyscale + grain + slight blur composite. |
| **Decorative-sticker overlay library (tape, sticky notes, arrows, polaroid frames, halftone dots)** | Notes-App-Chic core element; nothing in our category ships this well. | MED | Curated SVG/PNG library + positioning UI. Builds on existing `TemplateOverlay[]`. |
| **AI-generated hook variants A/B selector** | Generate 3 hook options per slide, let user pick. Hook is the single highest-leverage element; one Gemini call. | LOW | Extends `regenerate-text` action; UI in right rail. |
| **"Slop-detector" preview warning** | Flag slides that match AI-slop patterns (default Inter + gradient bg + centered headline + smiling-diverse-team photo) and suggest fixes. | MED | Heuristic pass on slide config. Marketing differentiator. |
| **Imperfect-by-default rendering** | Subtle randomized type rotation/letter-spacing/baseline jitter on premium templates (sub-1° rotation, ±2px baseline). | LOW | Pure CSS/Satori transform. Per-character would be expensive; per-text-box is cheap. |
| **Imagen prompt presets matched to archetype** | "Indie-sleaze flash photo of…" / "B&W documentary portrait of…" — instead of generic Imagen output. | LOW | Per-template prompt preamble for `stylize-image.ts` (already drafted, parked). |
| **Per-slide photo treatment per-archetype** | Editorial = B&W; Documentary = naturalistic; Vampy = oxblood-duotone. Treatment binds to template. | LOW | Treatment becomes template field, applied at composite. |

### Anti-Features / Anti-Patterns (Things That LOOK Good But Make Output Worse)

| Anti-Feature | Why It Tempts | Why It's Wrong | Better Alternative |
|---|---|---|---|
| **More fonts in font picker** | "Users want choice" | Adds decision fatigue; 90% of users pick wrong font for the photo. Our viral-creators study shows winners use 1–2 typefaces per carousel, not 8. | Curate 6–8 *paired* font systems (display + body) per template family. Hide raw font picker in "advanced." |
| **Add 30+ new templates** | More options = more value | Tool count bloat = decision paralysis. v2.7 already has 8 templates. Quality > quantity. | Ship 3–5 *opinionated* archetypes (Editorial-Serif, Notes-App-Chic, Brutalist, Photo-Dump-Vibe, Vampy) and retire weak legacy templates if any are unused. |
| **Glossy 3D / Web3 / cyberpunk neon templates** | "Modern feels premium" | Reads dated/AI-slop in 2026. Glossy = the look that's actively being rejected. | Embrace matte, paper, grain, photocopier. |
| **Smooth gradient backgrounds (purple-blue, sunset, etc.)** | Easy to render, looks "polished" | #2 cited AI-slop tell. Indistinguishable from Canva default. | Solid-color backgrounds + photo treatments. |
| **Auto-emoji injection in headlines** | "More engagement!" | Reads as low-effort/spam in 2026; Mosseri's quality pass demotes. | None. Emoji belongs only in CTA closer if at all. |
| **AI-illustrated Imagen backgrounds as default** | Imagen is in-house; tempting to default to it | Current Imagen output skews "AI sheen" (smooth gradients, perfect lighting, glossy 3D objects). Reads as slop. | Default to Pexels documentary photos with B&W/duotone treatment. Use Imagen only with explicit "indie-sleaze flash" / "documentary-raw" / "film-stock" prompt presets. |
| **"Smart" auto-generated emoji-rich CTA closer** | "Engagement booster" | CTAs in 2026 are direct verbal asks ("Save this." / "Send to a friend who..."), not emoji-laden. | Plain-language CTA presets per archetype. |
| **Dark mode / light mode UI toggle for slides** | Feels like a "feature" | Slides aren't UI; they're editorial. Each template has its own treatment. | Templates own their light/dark posture. |
| **Centered "headline + subhead + CTA button" layout (Canva default)** | Most familiar layout | Reads as marketing collateral, not editorial content. The centered-stack is the SLOP layout. | Off-center, asymmetric, bleed compositions. |
| **More text effect knobs (glow, neon, 3D extrude, chrome)** | "Wow factor" | Y2K chrome is its own narrow archetype; as a global text-effect option it's used to disguise weak hooks. | Keep current shadow / outline / highlight. Don't add chrome / glow / 3D unless wrapped in a single-purpose template. |
| **Real-time collaboration on the canvas** | "Notion / Figma vibes" | Pre-PMF. Solo creator is the user. | Defer indefinitely (already in PROJECT.md out-of-scope). |
| **Native video / motion-template export** | "Make slides into video!" | We're explicitly an image-carousel product. TikTok Photo Mode auto-plays static images. Adding video destroys the focus. | Out of scope. |

---

## 4. Specific Successful Creator Accounts to Study

These are real, verified handles cited in *Aesthetics of Photography* 2026 audit and *Amra & Elma* 2026 carousel-influencer report. Listed by archetype lane so user can pick representatives to QA against.

**Editorial / Magazine:**
- `@a24` — anamorphic-cinematic film promo carousels.
- `@nytimes` — hyperreal-mundane photo essay carousels (Cooking + Magazine sections).
- `@ssense` — Poetcore + editorial fashion carousels.
- `@reservoir.mag` — Poetcore carousel pioneer.
- `@magnumphotos` — documentary-raw photo carousels.

**Educational / Carousel-Deck (commodity lane, but reference for *good* execution):**
- `@thechrisdo` — sequential design teaching, 10-slide decks with consistent layout.
- `@aliabdaal` — productivity frameworks, friendly-but-clean.
- `@hormozi` — sharp high-contrast business playbooks.
- `@justinwelsh` — solopreneur step-by-step, bold-minimal.
- `@sahilbloom` — long-form ideas as swipeable arcs.

**Photo-Dump / Indie-Sleaze:**
- `@indiesleaze` — flash-on-camera digicam archive.
- `@emmachamberlain` — chaotic photo-dump aesthetic mixing blurry candids with composed photos.
- `@bellahadid` — moody vintage-palette sequences.
- `@thecobrasnake` — original indie-sleaze cultural anchor.

**Brutalist / Notes-App / Brand-Forward:**
- `@loewe` — TikTok-native chaos bleeding into IG; ransom-note typography.
- `@duolingo` — 8.5% engagement rate, brain-rot/relatability hybrid; reference for Trickster archetype.
- `@marcjacobs` — Color-Walk Reels exemplar.

**Documentary / Authentic:**
- `@keithleeeats` — 16M+ TikTok, documentary-raw creator portrait.
- `@halfbakedharvest` — hyperreal-mundane food, sacred-object composition.

**Place / Travel / Atmosphere:**
- `@visitnyc`, `@discoverlosangeles` — Place Romanticization, golden-hour amber, sequential B-roll stills.
- `@brandonwoelfel` — cinematic anamorphic neon portraiture.

User-recommended for v2.9 visual QA: pick **one carousel from each of `@a24`, `@nytimes`, `@ssense`, `@loewe`, `@indiesleaze`, `@halfbakedharvest`** → render same topic through our templates → score visual gap. This is the cheapest way to set the v2.9 bar.

---

## 5. Quality Gap Analysis: Our 8 Templates vs What's Winning

Our existing inventory:
- 5 legacy templates (educational/carousel-deck lane).
- 3 premium templates: `magazine-bold`, `tr3nding-news`, `documentary`.

| Lane | Coverage | Gap |
|---|---|---|
| Educational / Carousel-Deck | **Strong** (5 legacy templates). | Risk: this is the most commoditized lane. Quality fixes (typography, slide-role AI, hook sizing) more valuable than new templates here. |
| Editorial / Magazine | **Partial.** `magazine-bold` is the only entry; `tr3nding-news` is a variant. `documentary` is image-bleed-only. | **Need:** Editorial-Serif template (Playfair/Recoleta + B&W full-bleed photo). Photo treatment (B&W toggle) elevates `documentary` substantially. |
| Photo-Dump / Indie-Sleaze | **Zero.** Architectural mismatch — every slide currently uses identical composition. | **Need:** "vibe" mode where each slide picks a sub-variant within a family (text-left/text-right/text-bleed/photo-only). Plus film-grain default-on. Plus indie-sleaze Imagen preset. |
| Documentary-Raw | **Partial** (`documentary` template). Photos still skew Pexels-glossy. | **Need:** documentary-raw Imagen prompt preset + "no smiling stock" guardrail + naturalistic-treatment toggle. |
| Brutalist / Notes-App-Chic | **Zero.** No decorative-sticker library, no ransom-note typography, no photocopier treatment. | **Biggest single differentiation gap.** 2–3 templates + decorative-overlay library. |
| Cinematic-Anamorphic | **Zero.** | Nice-to-have. 1 template post-v2.9. |
| Color-Walk / Mono-with-Accent | **Indirect.** Achievable with palette-extraction feature. | **Need:** auto palette extraction from background photo. |
| Vampy / Dark Cottagecore | **Zero.** | 1 template; reuses palette-extraction. |
| Place Romanticization | **Indirect** via Imagen. | Imagen preset upgrade. |
| Brain-Rot | **Out of scope.** | None. |

### The Five Highest-Leverage Quality Fixes (Ranked)

1. **Photo treatment system (B&W / duotone / grain) bound to template.** LOW-MED build, HIGH visual impact. Makes every existing template look 2026-current. *Single biggest unlock.*
2. **Slide-role-aware AI generation (hook/reframe/supports/pivot/CTA).** MED build, HIGH content impact. Carousel pacing is currently flat.
3. **Better display typography per template + per-segment font override.** LOW build, HIGH visual impact. Anton-everywhere is repetitive.
4. **Notes-App-Chic / Brutalist template family + decorative-overlay library.** MED build, HIGH differentiation. Nothing in the AI-carousel category ships this.
5. **AI-slop guardrails (no Inter default, no purple-blue gradient, no smiling-diverse-team Pexels stock, no glossy 3D Imagen).** LOW build, prevents the worst output.

---

## Feature Dependencies

```
Photo treatment system (B&W/duotone/grain)
    ├──requires──> existing 9-layer composite stack (resolve-overlay.ts) [HAVE, v2.7 Phase 45]
    ├──requires──> Sharp or CSS filter pipeline addition
    └──enables──> Editorial-Serif template, Documentary-Raw treatment, Vampy palette

Auto palette extraction
    ├──requires──> node-vibrant or Sharp palette pass on slide-load
    ├──requires──> template tokens that accept dynamic colors (we have `accentColor` already)
    └──enables──> Color-Walk archetype, Vampy auto-treatment

Slide-role AI generation
    ├──requires──> Gemini schema extension (role: hook/reframe/support/pivot/close)
    ├──requires──> per-role prompt addenda
    └──enables──> better pacing, archetype-specific copy

Decorative-overlay library (tape, sticky notes, arrows, frames, halftones)
    ├──requires──> existing TemplateOverlay[] schema [HAVE, v2.7 Phase 44]
    ├──requires──> SVG/PNG asset curation
    └──enables──> Notes-App-Chic, Brutalist, Vintage-Zine templates

Imperfect-by-default rendering (subtle jitter)
    ├──requires──> Satori transform support (CSS rotate / translate verified working)
    └──enables──> AI-resistance signal across all premium templates

Per-segment font family
    ├──requires──> TextSegment schema extension (fontFamily?: string) [extends v2.8 schema]
    ├──requires──> font-loader update to load multiple per-slide
    └──enables──> Ransom-note / pick-and-mix typography

Imagen prompt presets per archetype
    ├──requires──> existing stylize-image.ts (parked, ready) [DRAFTED]
    ├──requires──> per-template promptPreamble field
    └──enables──> Documentary-Raw, Indie-Sleaze, Vampy archetype-correct AI photos

Notes-App-Chic / Brutalist templates
    ├──requires──> Decorative-overlay library
    ├──requires──> Photo treatment system (photocopier preset)
    ├──requires──> Per-segment font family (ransom-note hooks)
    └──delivers──> biggest differentiation lane
```

---

## MVP Definition (v2.9 Scope Recommendation)

### Launch With (v2.9 Core)

The minimum that materially upgrades visual quality vs current output.

- [ ] **Photo treatment system** — B&W toggle, duotone (cream/oxblood, navy/cream, mint/black), film-grain overlay (3 intensities). Per-template default; user can override.
- [ ] **AI-slop guardrails** — replace Inter default body font on premium templates; Imagen prompt addendum forbidding gradient/glossy/3D/smiling-stock; Pexels query addendum favoring documentary/portrait over "team meeting."
- [ ] **Hook size + display-font expansion** — 4 new display sans (Druk-alt, Founders Grotesk Cond-alt, Tungsten-alt, Inter Display Black) + 2 sharp-modern serifs (Playfair Display + Recoleta-alt or GT Sectra-alt). Hook default size raised to 110–130px on premium templates.
- [ ] **Slide-role AI generation** — extend Gemini schema with `role: 'cover' \| 'reframe' \| 'support' \| 'pivot' \| 'close'`. Per-role prompt addenda. Default 7–9 slide arcs.
- [ ] **First-slide ≠ inner-slide composition** — per-template `coverLayout` distinct from `innerLayout`. Cover defaults to upper-third hook.
- [ ] **Editorial-Serif template** — new premium template: B&W bleed photo + Playfair Display oversized hook + cream accent + page counter top-right.
- [ ] **Notes-App-Chic template** — new premium template: paper-texture background + ransom-note hook (mixed fonts in one phrase) + tape-strip + sticky-note overlays + halftone-dot accent.
- [ ] **Decorative-overlay library** — 12–20 SVG/PNG assets (tape strips, sticky notes, hand-drawn arrows, polaroid frames, halftone patterns). Reusable across templates.

### Add After Validation (v2.9.x or v2.10)

- [ ] **Auto palette extraction from background photo** — propagates dominant hue to accent/counter/card.
- [ ] **Brutalist-Grid template** — Brute Force aesthetic, heavy stacked typography, exposed grid lines, deadpan numerals.
- [ ] **Per-segment font family override** — full ransom-note typography support.
- [ ] **AI hook A/B variant selector** — generate 3 hook options, user picks.
- [ ] **Imagen archetype-prompt presets** — wires up parked `stylize-image.ts`.
- [ ] **Imperfect-by-default jitter** — subtle randomized rotation/letter-spacing on premium templates.

### Future Consideration (v2.10+)

- [ ] **Photo-Dump heterogeneous mode** — per-slide layout variants within a template family (architecturally larger).
- [ ] **Cinematic-Anamorphic template** — teal-orange grade, letterbox bars, anamorphic flares.
- [ ] **Vampy / Dark-Cottagecore template.**
- [ ] **Slop-detector preview warning** — heuristic pass that flags AI-slop patterns and suggests fixes.
- [ ] **Color-Walk multi-slide consistency mode** — enforces single-hue across deck.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Why |
|---|---|---|---|---|
| Photo treatment system (B&W / duotone / grain) | HIGH | LOW-MED | **P1** | Single biggest visual upgrade per dollar. Makes existing templates look 2026-current. |
| AI-slop guardrails (font defaults, Imagen prompt rules, Pexels query rules) | HIGH | LOW | **P1** | Cheap; prevents the worst output. Marketing-defensible. |
| Display-font expansion + hook size raise | HIGH | LOW | **P1** | Anton-everywhere is repetitive; modern serif is missing entirely. |
| Slide-role AI generation | HIGH | MED | **P1** | Carousel pacing is flat without it; downstream every template benefits. |
| Cover-layout ≠ inner-layout per template | MED | LOW | **P1** | First-slide thumbnail readability is the algorithm's gateway. |
| Editorial-Serif template | HIGH | LOW (after photo treatment exists) | **P1** | Fills biggest archetype gap (Magazine-Editorial serif lane). |
| Notes-App-Chic template + decorative-overlay library | HIGH | MED | **P1** | Biggest differentiation vs Canva/Capsule/Plot. |
| Auto palette extraction | MED | MED | **P2** | Unlocks Color-Walk and Vampy "for free"; nice but not table-stakes. |
| Per-segment font family | MED | LOW | **P2** | Enables full ransom-note typography on Notes-App-Chic. |
| Brutalist-Grid template | MED | LOW (after overlays exist) | **P2** | Adjacent to Notes-App-Chic; reuses assets. |
| Imagen archetype prompt presets | MED | LOW | **P2** | Wires parked `stylize-image.ts`; meaningful only after archetype templates exist. |
| AI hook A/B variant selector | MED | LOW | **P2** | Good UX win, not a visual-quality fix. |
| Imperfect-by-default jitter | MED | LOW | **P2** | Subtle but real AI-resistance signal. |
| Photo-Dump heterogeneous mode | HIGH | HIGH | **P3** | Architectural; defer until v2.9 lands. |
| Cinematic-Anamorphic template | LOW | LOW | **P3** | Niche archetype. |
| Vampy / Dark-Cottagecore template | LOW | LOW | **P3** | Niche; reuses palette-extraction. |
| Slop-detector preview | MED | MED | **P3** | Meta-feature; useful only after the fixes are in place. |

**Priority key:**
- **P1**: Must ship for v2.9 to materially close the quality gap. ~7 features.
- **P2**: Should ship in v2.9 if scope allows; otherwise v2.9.x.
- **P3**: Defer to v2.10+; not needed to claim "viral visual quality" milestone.

---

## Competitor Feature Analysis

| Feature | Canva (post-Glow Up 2025) | aiCarousels.com / PostNitro | Plot / Capsule | **Our Approach (v2.9)** |
|---|---|---|---|---|
| Templates | 1000+ generic | 50+ generic AI-template | 20–40 modern | Curated 8 → 12, opinionated archetypes |
| Photo treatment | None automatic; manual filters | None | None | **B&W / duotone / grain bound to template** |
| Display typography | Full font picker, no curation | Defaults to Inter / Poppins | Curated 5–8 | Curated 6–8 *paired systems* per template |
| Decorative stickers | Massive, generic, low-craft | None | Minimal | **Curated craft library (tape, halftone, sticky notes, hand-drawn arrows)** |
| AI archetype awareness | None — all templates one mold | Generic AI text gen | None | **Slide-role-aware AI; archetype-bound prompts** |
| AI-slop avoidance | None — defaults are slop | Defaults are slop | Mid | **Explicit guardrails (no Inter default, no purple-blue gradient, no smiling-stock-team)** |
| Photo source intelligence | Manual | Generic stock | Mid | **Pexels query rules + Imagen archetype presets** |
| Editorial-serif option | Yes (in font picker) | No default | No | **Default-on premium template** |
| Notes-App-Chic template | No | No | No | **Yes — biggest differentiation** |
| Brutalist template | No | No | No | **Yes (P2)** |

**Strategic insight:** Canva and aiCarousels both compete on *quantity* (more templates, more fonts, more options). The 2026 market shift toward Imperfect-by-Design rewards *quality, opinionated, archetype-bound* output. Our 8 → 12 curated archetype templates with built-in photo treatment and AI slop guardrails beats 1000 generic templates that all look AI-generated.

---

## Sources

**Highest-confidence references:**
- [The Viral Visual Grammar of US Instagram in 2026 — Aesthetics of Photography](https://aestheticsofphotography.com/the-viral-visual-grammar-of-us-instagram-in-2026-aesthetics-algorithms-and-attention/) — 12-archetype audit, save-over-likes hierarchy, AI-resistance defense, creator handles. (HIGH)
- ['Imperfect by Design': The visual design trends set to define 2026 — Canva Newsroom](https://www.canva.com/newsroom/news/design-trends-2026/) — "Imperfect by Design" framing, Notes App Chic, Reality Warp, Texture Check. (HIGH)
- [The graphic trends you'll want to bookmark for 2026 — It's Nice That](https://www.itsnicethat.com/features/forward-thinking-graphic-trends-2026-graphic-design-120126) — "Make Me a Copy" photocopier aesthetic, Pick-and-Mix typography, Visual Index, Micrographics, Blotch logos. (HIGH)
- [Top 20 Graphic Design Trends for 2026 — Digital Synopsis](https://digitalsynopsis.com/design/graphic-design-trends-2026/) — Brute Force, Neo-brutalism. (MEDIUM)
- [Top Social Media Design Trends 2026 — Versa Creative](https://versacreative.com/blog/top-social-media-design-trends-2026/) — Bold thick-stroke typography, vibrant color return. (MEDIUM)

**Creator-handle references:**
- [25 Influencers Making Carousels Go Viral in 2026 — Amra & Elma](https://www.amraandelma.com/influencers-making-carousels-go-viral/) — 25 verified IG handles by niche, design strategy notes. (MEDIUM — confirm individual handles on platform.)
- [March 2026 TikTok Trends — New Engen](https://newengen.com/insights/march-2026-tiktok-trends/) — TikTok carousel format examples, named creators. (MEDIUM)
- [Top TikTok Trends — TikTok Creative Center via socialrails.com](https://socialrails.com/blog/how-to-make-slideshow-on-tiktok) — Photo Mode mechanics, 35-image carousel cap. (HIGH)

**Algorithm and engagement references:**
- [Mastering Instagram Carousel Strategy in 2026 — Marketing Agent Blog](https://marketingagent.blog/2026/01/03/mastering-instagram-carousel-strategy-in-2026-the-algorithm-demands-swipes-not-just-scrolls/) — 1.8x reach, 11s dwell, save-weighting. (MEDIUM)
- [Instagram Carousel Strategy 2026 — TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-carousel-strategy-2026) — DM-share weight, frame-level analytics. (MEDIUM)
- [How to Create Instagram Carousels That Get Saves (2026) — InstaCarousel](https://instacarousel.com/blog/instagram-carousel-guide-2026/) — Hook-frame thumb-stop mechanics. (MEDIUM)

**AI-slop / anti-pattern references:**
- [AI Slop Web Design — 925studios](https://www.925studios.co/blog/ai-slop-web-design-guide) — Default Inter + purple-to-blue gradient as #1 and #2 slop tells. (MEDIUM)
- [AI Slop on Wikipedia](https://en.wikipedia.org/wiki/AI_slop) — Definition, detection markers. (HIGH)

**Typography references:**
- [Font Trends 2026 — Simplified](https://simplified.com/blog/design/creative-font-trends) — Bold thick-stroke, retro revival, sharp modern serif. (MEDIUM)
- [Brand Typography Trends 2026 — Memorable Design](https://memorable.design/brand-typography-trends/) — Variable fonts as 2026 baseline, serif revival. (MEDIUM)
- [Typography Trends 2026 — Design Monks](https://www.designmonks.co/blog/typography-trends-2026) — Display serif maximalism, Anton's role. (MEDIUM)

---

*Feature research for: v2.9 Viral Visual Quality milestone.*
*Researched: 2026-04-30 / 2026-05-01.*
*Quality-gate self-check: archetypes named (12), creator handles cited (25+ real handles), complexity hints noted per pattern, dependencies on existing features (TextBox schema v2.8, TemplateOverlay schema v2.7, resolve-overlay.ts) identified, anti-patterns explicit (Inter default, purple-blue gradient, glossy 3D, smiling-stock-team, centered-stack), opinionated about top-5 highest-leverage fixes.*
