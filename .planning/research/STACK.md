# Stack Research

**Domain:** v2.9 — Viral Visual Quality upgrades for AI-generated TikTok/Instagram carousel slides
**Researched:** 2026-05-01
**Confidence:** HIGH on model choice + image-processing libs; MEDIUM on font strategy (Satori variable-font block forces a static-weight workaround); MEDIUM on grain/texture pipeline (pre-rendered PNG textures are required because Satori does NOT execute SVG `<filter>` primitives).

> **Scope:** This document is ADDITIVE to the validated v2.8 stack (Next.js 15.5.13, React 19.1, Satori via `next/og`, Supabase, `@google/genai` 1.46, `pexels` 1.4, `sharp` 0.34.5, `image-size` 2.0, `zod` 4.3, etc.). It covers ONLY what's needed to push visual output toward what's actually shipping on platform in early-to-mid 2026.

## TL;DR

Visual-quality wins in v2.9 come from **smarter use of existing AI** and **a small number of carefully-chosen processing libs**, not a stack rewrite. Three pillars:

1. **Model upgrades:** Promote Imagen-3 calls to **Imagen 4 Fast** (`imagen-4.0-fast-generate-001`) and the parked stylize feature to **Gemini 3.1 Flash Image Preview** (`gemini-3.1-flash-image-preview`). Both are accessible through the already-installed `@google/genai` SDK — no new dependency.
2. **Image-processing layer:** Lean harder on the `sharp` we already ship. Add ONE new color-extraction lib (`@vibrant/node` v4) for accent-color mining from photos. Add ONE pre-rendered grain/texture PNG asset set (1080x1920) baked at build time — because Satori does NOT execute `<feTurbulence>` SVG filters or CSS `backdrop-filter`.
3. **Typography:** Stay on self-hosted `.ttf` static-weight files via Fontsource (already validated). Do NOT switch to variable fonts — Satori's variable-font path is still broken (issue #162 / #712 closed-as-duplicate, not fixed). Add 2-3 high-impact display faces from Pangram Pangram's free-to-try set (commercial license $40/face/site) when v2.9 ships paid premium templates.

What does NOT belong in v2.9: variable fonts, headless-Chromium rendering, Adobe Fonts, Replicate-hosted open-weights models, `imgproxy`/`imagor` self-hosted CDNs, `smartcrop.js` ML-based cropping, `remove.bg` paid background removal. Reasoning in [What NOT to Use](#what-not-to-use).

## Recommended Stack

### Core Technologies (additions / promotions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@google/genai` | **1.46.0** *(already installed)* | Single SDK for **Gemini 2.5 Flash text**, **Imagen 4 image gen**, **Gemini 3.1 Flash Image Preview** photo restyling | Already in the project. Same SDK calls all three — no new dependency. The model string is what changes. Authoritative Google AI docs confirm the SDK is the supported path for both Imagen and the Nano-Banana family. ([Google AI image generation](https://ai.google.dev/gemini-api/docs/image-generation)) |
| **Imagen 4 Fast** | model: `imagen-4.0-fast-generate-001` | Replace current Imagen 3 calls in `src/lib/imagen/` for paid premium-tier backgrounds | $0.02/image (cheaper than current Imagen 3 path). 10x faster than Imagen 3. Materially better text rendering and detail — the two specific failure modes in current output. 2K resolution available; we render to 1080x1920 so 1K is sufficient. Released GA via Gemini API May 2025; production-stable as of 2026. ([Imagen 4 release](https://developers.googleblog.com/imagen-4-now-available-in-the-gemini-api-and-google-ai-studio/), [pricing](https://blog.laozhang.ai/en/posts/ai-image-api-pricing-comparison)) |
| **Gemini 3.1 Flash Image Preview (Nano Banana 2)** | model: `gemini-3.1-flash-image-preview` | Photo restyling for parked `src/lib/imagen/stylize-image.ts` (B&W magazine treatment, film-grain pass, duotone, etc. driven by reference photo + style prompt) | Native 9:16 support, up to 14 reference images, character/subject consistency — exactly the use case for our parked stylize feature. Strictly better than `gemini-2.5-flash-image-preview` currently used in the parked file (higher fidelity, supports thinking mode, 4K capable). $0.039/image at 1K still fits the existing 1-credit cost model. **Status:** preview, but Google explicitly states preview models may be used in production with 2-week deprecation notice. ([Gemini API image-generation docs](https://ai.google.dev/gemini-api/docs/image-generation), [model details](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image)) |
| **Gemini 2.5 Flash (text)** | `gemini-2.5-flash` *(already in use)* | Slide text + the parked photo→slide matcher (`match-photos-to-slides.ts`) | Keep. The matcher's design (vision input, JSON-schema-constrained output) is the right pattern for v2.9; promote it from "parked" to "shipped" without a model swap. Cost remains negligible vs image gen. |

### Supporting Libraries (NEW)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vibrant/node` | **^4.0.3** | Extract dominant + vibrant + muted swatches from a photo so the AI/template can pick a complementary accent color, mint-pill highlight color, or topic-chip background that resonates with the photo instead of a hardcoded brand swatch | Use server-side at slide-render time when the slide has a photo background and the template's accent is "auto". Run on the resized thumbnail (sharp resize → 64x64 → vibrant), not full res. K-means clustering produces semantically-meaningful roles (Vibrant / DarkVibrant / LightVibrant / Muted). Strictly better than `colorthief` for our case because we want named roles, not raw N-colors. ([node-vibrant](https://github.com/Vibrant-Colors/node-vibrant), [comparison](https://npm-compare.com/colorthief,node-vibrant)) |
| **Pre-rendered grain PNGs** *(asset, not lib)* | n/a | Film-grain / paper-texture overlay assets at 1080x1920, alpha PNG, generated once via `sharp` + SVG `<feTurbulence>` from a Node script and committed to `public/textures/` | The 2026 viral aesthetic is **deliberately imperfect** — film grain, light leaks, scratches, paper texture are read by users as "human-made vs. AI slop". Satori does not execute SVG filter primitives at render time, so we MUST bake them to PNG ahead of time. 5-7 PNGs covers the realistic taste range (subtle grain / heavy grain / paper / Polaroid border / VHS tracking lines). Composited as a top-z `<img>` in the existing 9-layer DOM stack — zero impact on parity invariant. ([Aesthetics of 2026 IG](https://aestheticsofphotography.com/the-viral-visual-grammar-of-us-instagram-in-2026-aesthetics-algorithms-and-attention/), [SVG noise via feTurbulence](https://css-tricks.com/grainy-gradients/)) |
| `@fontsource/anton` | **^5.2.x** *(already installed pattern)* | Static-weight Anton (already loaded via `loadFontBuffersForSlide`); confirm we lock to the static `.ttf` not the variable build | The magazine-bold and tr3nding-news templates already use Anton. Keep static. ([Fontsource Inter](https://fontsource.org/fonts/inter)) |
| **Pangram Pangram display faces** *(licensed assets)* | files committed to `src/assets/fonts/` | 2-3 high-impact display faces (e.g., **PP Editorial New**, **PP Neue Montreal**, **PP Right Grotesk**) for new premium templates that visibly differentiate from Google-Fonts-only competitors | Free for personal/dev use — ship dev-time on the trial license; pay $40/face/site web license once the templates ship to production. The visual gap between Anton/Inter and Pangram's editorial faces is the single biggest "looks expensive" lever short of hiring a designer. The foundry ships `.ttf` and `.woff` (NOT WOFF2-only), which Satori can read directly. ([Pangram Pangram FAQ](https://pangrampangram.com/pages/faq), [Satori font formats](https://github.com/vercel/satori/blob/main/README.md)) |
| `pexels` | **^1.4.0** *(already installed)* | Stock photos | Keep. No reason to switch. Pexels' curation quality remains competitive with Unsplash for our use case and the free tier has no hard request cap that we hit. ([2026 image-API comparison](https://blog.laozhang.ai/en/posts/free-image-api)) |
| `sharp` | **^0.34.5** *(already installed)* | Photo treatments **before** Satori composites the slide: B&W (`grayscale()`), warm tint (`tint()`), modulate brightness/saturation/hue (`modulate({brightness, saturation, hue})`), linear contrast (`linear()`), composite grain overlay | Lean harder. The current pipeline barely uses sharp's color manipulation. Pre-treating photos server-side before they hit Satori (which has primitive CSS-filter support) unlocks the magazine-bold B&W look authentically and is byte-deterministic for PNG export. ([sharp colour API](https://sharp.pixelplumbing.com/api-colour/)) |

### Development Tools (NEW)

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx scripts/build-textures.ts` | One-shot script: render N grain/texture PNGs at 1080x1920 from SVG `<feTurbulence>` source + Sharp PNG export, commit to `public/textures/*.png` | Add to `package.json` as `"textures": "tsx scripts/build-textures.ts"`. Run once at milestone time, not at request time. |
| `tsx scripts/visual-snapshot.ts` *(extend existing test infra)* | Render reference carousels for each premium template + each grain pass into `__tests__/__snapshots__/v29/` so PRs surface visual regressions | Mirrors the existing `npm run thumbs` script pattern from v2.7. PNG diff via existing `image-size` + manual review (no need to add a pixel-diff lib — keep it cheap). |

## Installation

```bash
# Single new runtime dep (color extraction)
npm install @vibrant/node@^4.0.3

# Pangram Pangram fonts: NOT npm — manual download from foundry,
# committed to src/assets/fonts/ under their trial license.
# Pay for web license at production launch ($40/face per pangrampangram.com/pages/faq).

# Texture script: no new deps — uses the sharp we already have.
```

**Net new dependencies: 1 npm package (`@vibrant/node`) + 5-7 committed PNG assets + 2-3 committed font files. Zero changes to the rendering pipeline (Satori + React parity stays the source of truth).**

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Imagen 4 Fast** ($0.02/img) | **Imagen 4 Standard** ($0.04) or **Ultra** ($0.06) | Only if user-reported quality on Fast is insufficient on production data. Pre-PMF, double the cost is hard to justify until we see real complaints. Ultra is single-image-per-call, which is fine for our 1-image-at-a-time flow. ([pricing](https://blog.laozhang.ai/en/posts/ai-image-api-pricing-comparison)) |
| **Gemini 3.1 Flash Image Preview** | **Gemini 3 Pro Image Preview** (`gemini-3-pro-image-preview`) | If stylize/edit accuracy on 3.1 Flash falls short. Pro is $0.134-$0.24/image — 3-6x more expensive — and requires we charge the user more credits. Not pre-PMF appropriate. |
| **Gemini 3.1 Flash Image Preview** | **Gemini 2.5 Flash Image** (the model the parked stylize file currently uses) | If 3.1 turns out to have higher latency that hurts UX, fall back to 2.5. Rare — 3.1 is purpose-built for low-latency image gen. |
| `@vibrant/node` (k-means, named roles) | `colorthief` (MMCQ, raw N-colors) | If we only ever need ONE dominant color and want zero config. We need named roles for the magazine accent system, so colorthief is a net loss. ([comparison](https://npm-compare.com/colorthief,node-vibrant)) |
| **Pre-rendered grain PNGs** | **CSS `filter: url(#grain)` at runtime** | Never — Satori can't execute SVG filters, and Satori is the source of truth for export. The PNG path is the only one with byte-parity. |
| **Pangram Pangram (free trial) + paid web license at launch** | **Adobe Fonts subscription** | Adobe Fonts requires the Creative Cloud subscription pay-per-CC-seat model, can't be self-hosted as `.ttf`, and the EULA forbids using the font files directly with Satori (which requires raw font buffers). Adobe Fonts is **incompatible** with our render pipeline — full stop. ([Satori font support](https://github.com/vercel/satori/blob/main/README.md)) |
| **Pangram Pangram** | **Variable fonts via Fontsource (Inter Variable, etc.)** | Variable fonts are blocked by Satori issue #162/#712 (closed as duplicate, not fixed). Static-weight `.ttf` is the only path. ([Satori issue 712](https://github.com/vercel/satori/issues/712)) |
| **Sharp pre-treatment + PNG composite** | **Imagen 4's prompt does B&W natively** | Both work. Sharp is deterministic, free, and instant — best for templates that always want B&W (magazine-bold). Imagen for prompts where the user wants a creative restyle ("90s film", "polaroid"). Use both — they don't compete. |
| **`@vibrant/node`** | **`sharp.stats()` for dominant color** | sharp ships a `stats()` method that returns dominant RGB. Adequate for "pick a dark vs light tint", inadequate for the named-role palette the magazine templates need. Keep sharp.stats as a zero-dep fallback. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Variable fonts** (`@fontsource-variable/inter`, etc.) | Satori does not support variable fonts. Issue #162 (Oct 2022) and #712 (Oct 2025) are both unresolved as of 2026-05. Triggers `TypeError: Cannot read properties of undefined` from opentype.js's fvar parser. | Static-weight `.ttf` files via `@fontsource/<face>` per-weight subpaths. ([Satori variable-font issue](https://github.com/vercel/satori/issues/162)) |
| **WOFF2 font files** | Satori supports TTF / OTF / WOFF only. WOFF2 throws at load time. | TTF (preferred) or WOFF. Pangram and Fontsource both ship TTF. ([Satori WOFF2 status](https://github.com/vercel/satori/discussions/157)) |
| **Headless Chromium / Puppeteer / Playwright for rendering** | Forklifts the pipeline off Satori, breaks the React parity invariant, requires ~600MB cold-start on Vercel, increases per-render cost from milliseconds to seconds. The existing Satori + React `<SlidePreview>` parity is a moat — do not destroy it. | Stay on `next/og` ImageResponse (Satori + resvg, Vercel-bundled). |
| **Adobe Fonts** | Tied to Creative Cloud subscriptions per seat. EULA forbids serving raw font files, which is exactly what Satori needs. Cannot self-host the binary. | Pangram Pangram (raw `.ttf` allowed under web license) or Google Fonts (free, raw OFL). |
| **Pangram before user license** | $40/face × 3 faces = $120/year minimum. Pre-PMF, that's a real cost. | Develop on the **free-to-try** license (allowed for "client pitches, personal projects, testing in different development environments"); upgrade to web license before production launch. ([Pangram FAQ](https://pangrampangram.com/pages/faq)) |
| **`smartcrop.js`** | The author explicitly says it's "fairly dumb image processing" (vanilla JS edge detection, not ML). Doesn't solve the actual problem we have, which is "this photo has a face on the wrong third of the frame for a 9:16 crop". | Defer entirely. If smart-crop becomes a real need, **Gemini 3.1 vision can return crop-rect coords** in the same JSON-schema call as the photo→slide matcher — one model, one round-trip. ([smartcrop.js](https://github.com/jwagner/smartcrop.js/)) |
| **`remove.bg` paid API** ($0.10/image at scale) | Background removal is not a viral-aesthetic lever in 2026. The trend is the opposite — full-bleed photos, grain, imperfection. Background-removed cutouts read as 2022 e-commerce. | Skip until a user actually asks for it. If needed, **`rembg` self-hosted** (open-source, free) is the right choice — but not for v2.9. ([2026 carousel trends](https://aestheticsofphotography.com/the-viral-visual-grammar-of-us-instagram-in-2026-aesthetics-algorithms-and-attention/)) |
| **Replicate-hosted open-weights image models** (SDXL Lightning, Flux, etc.) | Adds a third vendor + auth surface + per-request fee. Imagen 4 Fast at $0.02 already beats SDXL economics at our volume. The few quality scenarios where Flux wins (e.g., human anatomy) aren't the slideshow use case. | Stay on Google. One vendor, one SDK, one auth token. |
| **`imgproxy` / `imagor` / `Thumbor` self-hosted CDNs** | We're not at the scale where on-the-fly transformation servers pay off. Vercel's `next/image` + Supabase Storage's built-in CDN cover us through ~10K MAU. | Defer until measured CDN cost or latency becomes a complaint. ([Gumlet self-hosted vs cloud](https://www.gumlet.com/learn/self-hosted-vs-cloud-image-optimization-imgix-alternatives/)) |
| **Switching off `pexels` to Unsplash** | Higher API quality bar but stricter hotlinking + attribution rules that complicate our caching/storage flow. Marginal aesthetic gain, real engineering cost. | Stay on Pexels. ([Pexels vs Unsplash](https://blog.laozhang.ai/en/posts/free-image-api)) |
| **CSS `<feTurbulence>` filter at runtime** | Satori does NOT execute SVG `<filter>` primitives at render time. The grain would appear in the React preview but be invisible in the exported PNG — a parity break. | Bake textures to PNG once at build time, composite as `<img>` at render time. |
| **Replacing Satori with `@vercel/og`** | They are the same thing (`@vercel/og` is a thin wrapper bundled into `next/og`). No-op. | Stay on the current `next/og` import path. |
| **Native iOS pre-render via Skia / CoreImage** | iOS port is a v2 milestone, not v2.9. Pre-PMF. | Web-first, server-side rendering. |

## Stack Patterns by Variant

**If the slide template is `magazine-bold` or `tr3nding-news` (premium B&W magazine look):**
- Pre-treat the photo with `sharp().grayscale().linear(1.1, -10)` to pump contrast before Satori composites.
- Composite a subtle grain PNG (`textures/grain-subtle.png`, ~8% opacity) as the top z-index layer.
- Use `@vibrant/node` to extract a `Vibrant` swatch from the ORIGINAL color photo (before greyscale) → use as the mint-pill / topic-chip accent color when the user picks "auto" accent. Otherwise honor the brand kit.

**If the slide is using AI-generated imagery (Imagen 4 Fast):**
- Keep prompt format as-is (1080x1920 9:16). Imagen 4 handles aspect ratios natively.
- Bypass the grain composite — Imagen 4 photographs already have native film texture in many prompt styles.

**If the user is uploading their own photos:**
- Run `match-photos-to-slides.ts` (currently parked) to assign photos to slides by content fit using Gemini 2.5 Flash vision. Promote from parked → shipped.
- Optionally run `stylize-image.ts` (currently parked) when the user picks a stylize preset, with `model = 'gemini-3.1-flash-image-preview'` (UPGRADE from current `'gemini-2.5-flash-image-preview'`). Promote from parked → shipped with model bump.

**If pre-PMF cost discipline tightens:**
- Drop `gemini-3.1-flash-image-preview` stylize entirely — fall back to sharp-only treatments (B&W, tint, grain composite). 80% of the visual win at 0% per-image cost.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@google/genai@^1.46.0` | `imagen-4.0-fast-generate-001`, `gemini-3.1-flash-image-preview`, `gemini-2.5-flash-image`, `gemini-2.5-flash` | Single SDK supports all four model strings. Verified via Gemini API docs. ([Gemini API models](https://ai.google.dev/gemini-api/docs/models)) |
| `next@15.5.13` (`next/og`) | Satori static `.ttf` or `.woff` fonts, NO variable, NO WOFF2 | Bundle limit: 500KB total per render (JSX + fonts + composited images). Our 1080x1920 + 2 fonts + 1 grain PNG fits comfortably. ([@vercel/og reference](https://vercel.com/docs/og-image-generation/og-image-api)) |
| `sharp@^0.34.5` | Linux ARM64 + x64 + macOS ARM64 + x64 (libvips 1.2.4 prebuilds) | All targets needed for Vercel + dev are covered by current install. No action. |
| `@vibrant/node@^4.0.3` | Node 18+, ESM-first | Project is Node 20 (Next.js 15.5 requirement) — fine. |
| Pangram fonts | Satori (TTF/OTF), Fontsource pattern (`src/assets/fonts/*.ttf` + `loadFontBuffersForSlide`) | Already-validated load pattern. Drop new `.ttf` files into the existing folder. |

## Pre-PMF Discipline Notes

- **Net new monthly cost at zero users:** $0 (no new SaaS). At 1K paid generations/month: ~$20 (Imagen 4 Fast) + ~$10 (Pangram amortized) = $30. Same order of magnitude as current.
- **Net new code surface:** ~200 LOC for vibrant integration + ~50 LOC for grain composite + 2 model-string changes in `src/lib/imagen/` and `src/lib/ai/`. Small.
- **Reversibility:** Every addition has a feature flag or is a model-string swap. If `gemini-3.1-flash-image-preview` regresses, change one constant.
- **Parity invariant preserved:** No changes to `resolve-overlay.ts` or the 9-layer DOM stack. Grain is a new top-layer `<img>`. Color extraction happens BEFORE Satori. Sharp pre-treatment happens BEFORE Satori. The Satori byte-parity invariant is untouched.

## Sources

- [Google AI — Image Generation docs](https://ai.google.dev/gemini-api/docs/image-generation) — HIGH (official): model IDs, aspect-ratio support, pricing structure
- [Google AI — Models](https://ai.google.dev/gemini-api/docs/models) — HIGH (official): `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`, `gemini-2.5-flash-image`, `imagen-4.0-fast-generate-001` confirmed live
- [Vertex AI — Gemini 2.5 Flash Image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image) — HIGH (official): production-readiness of preview models
- [Imagen 4 release announcement](https://developers.googleblog.com/imagen-4-now-available-in-the-gemini-api-and-google-ai-studio/) — HIGH (official Google blog): GA via Gemini API, 10x faster, better text rendering
- [LaoZhang AI — 2026 image-API pricing](https://blog.laozhang.ai/en/posts/ai-image-api-pricing-comparison) — MEDIUM (third-party, but consistent with Google's official tier listing): Imagen 4 Fast $0.02 / Standard $0.04 / Ultra $0.06; Gemini 3 Pro Image $0.134-$0.24
- [Vercel Satori README](https://github.com/vercel/satori/blob/main/README.md) — HIGH (source repo): TTF/OTF/WOFF support, no WOFF2, no variable fonts, no kerning/ligatures
- [Satori issue #162 — variable font support](https://github.com/vercel/satori/issues/162) — HIGH: open since Oct 2022, still unresolved
- [Satori issue #712 — variable fonts](https://github.com/vercel/satori/issues/712) — HIGH: closed-as-duplicate of #162 in Oct 2025, NOT fixed
- [Satori WOFF2 discussion #157](https://github.com/vercel/satori/discussions/157) — HIGH: WOFF2 explicitly not supported
- [@vercel/og Reference](https://vercel.com/docs/og-image-generation/og-image-api) — HIGH (official Vercel docs): 500KB bundle limit, font/JSX/asset constraints
- [sharp colour API](https://sharp.pixelplumbing.com/api-colour/) — HIGH (official): `tint()`, `greyscale()`, `pipelineColourspace()`, `toColourspace()` signatures
- [sharp operations](https://sharp.pixelplumbing.com/api-operation/) — HIGH (official): `modulate()`, `linear()`, `composite()` for B&W + grain pipeline
- [node-vibrant repo](https://github.com/Vibrant-Colors/node-vibrant) — HIGH: k-means with named role palette
- [colorthief vs node-vibrant comparison](https://npm-compare.com/colorthief,node-vibrant) — MEDIUM (npm-compare aggregator): supports the role-based vs raw-N-colors distinction
- [Pangram Pangram FAQ](https://pangrampangram.com/pages/faq) — HIGH (foundry): trial license terms, $40 web licenses, .TTF/.OTF/.WOFF formats (NO WOFF2-only restriction)
- [Aesthetics of US Instagram 2026](https://aestheticsofphotography.com/the-viral-visual-grammar-of-us-instagram-in-2026-aesthetics-algorithms-and-attention/) — MEDIUM (third-party trend writeup, but well-sourced): grain/imperfection-as-authenticity is the dominant 2026 visual signal; VSCO Film 02 reissue Feb 2026 is cited as commercial proxy
- [Simplified — 2026 font trends](https://simplified.com/blog/design/creative-font-trends) — MEDIUM (third-party design blog): bold thick-stroke + sharp-serif as the two dominant 2026 typography modes
- [CSS-Tricks — Grainy Gradients](https://css-tricks.com/grainy-gradients/) — HIGH (well-known reference): `feTurbulence`-to-PNG technique
- [Fontsource](https://fontsource.org/) — HIGH (official): self-host pattern, version locking, NPM-bundled fonts
- [smartcrop.js](https://github.com/jwagner/smartcrop.js/) — HIGH (source repo): author-stated as "fairly dumb image processing", ML version perpetually "in development"
- [Pexels API documentation](https://www.pexels.com/api/documentation/) — HIGH (official): no rate-limit issues at our volume
- [LaoZhang AI — 2026 image API comparison](https://blog.laozhang.ai/en/posts/free-image-api) — MEDIUM: Pexels vs Unsplash vs Pixabay 2026 tradeoff analysis

---
*Stack research for: ViralSlideMaker v2.9 — Viral Visual Quality (additive only — preserves Satori + React parity invariant)*
*Researched: 2026-05-01*
