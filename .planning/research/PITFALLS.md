# Pitfalls Research: v2.9 Viral Visual Quality

**Domain:** Adding visual-quality upgrades to an existing AI-generated TikTok/Instagram carousel image SaaS
**Researched:** 2026-05-01
**Stack in play:** Next.js 15.5 + React 19, Satori (via `next/og` `ImageResponse`), Gemini 2.5 Flash + `gemini-2.5-flash-image-preview`, Imagen 4, Pexels API, Supabase, Upstash, Vercel
**Confidence:** MEDIUM-HIGH (Satori limits + Gemini/Imagen pricing verified from official sources; trend/aesthetic claims grounded in 2026 industry write-ups; pre-PMF discipline grounded in startup-marketing canon)

> **Tone:** This is a v2.9-specific pitfalls doc. It assumes the v2.3 MCP/tooling pitfalls (auth, idempotency, transports) are already mitigated and concentrates only on what breaks when you start chasing visual quality on top of a working pipeline. It is opinionated about pre-PMF discipline.

---

## How To Read This Doc

Each pitfall has:
- **What goes wrong** — concrete failure
- **Why it happens** — root cause
- **Warning signs** — how you'd recognize it before users complain
- **Prevention** — specific lib/config/test, not platitudes
- **Phase to address** — pinned to v2.9 phase boundaries (research → templates → photo treatment → AI tightening → QA)

The Pitfall-to-Phase Mapping at the bottom is the executive summary the roadmap should read.

---

## Pre-PMF Discipline (read this first)

Before any pitfall: **the most expensive mistake in v2.9 is building visual polish that doesn't move the metric we actually need (creators ship-and-share).** The user is pre-PMF. Visual quality matters insofar as it removes a "this looks like AI slop / I'd be embarrassed to post this" objection. Beyond that, every additional polish hour competes with finding the actual wedge.

**Hard rules for v2.9 (do not relax without a user signal):**

1. **No new dependencies in v2.9 unless a current pipeline blocks a documented user complaint.** That means: no `sharp` in production unless we have evidence an existing user wanted, e.g., duotone and bounced. (Pitfall #5 below.)
2. **Ship 1–3 templates, not 8.** Trend-fatigue research (see Pitfall #1) shows format-based trends saturate in 3–4 weeks. Investing 2 weeks each into 8 templates burns runway on stuff that ages out.
3. **The two parked features (`match-photos-to-slides.ts`, `stylize-image.ts`) require a measured user-need signal before promoting from `parked` to `shipped`.** Both add cost-per-carousel and latency; neither is a known objection from current users. (Pitfalls #6, #7, #11.)
4. **Do not build accessibility tooling, alt-text generation, or screen-reader audits this milestone** unless an enterprise/agency lead asks. (Pitfall #14: not the metric.)
5. **One AI cost line at a time.** If we add Gemini Vision, we don't simultaneously add Imagen-stylization. Watch the Vercel + Gemini bill for one week before stacking the next AI feature. (Pitfall #11.)

If a pitfall mitigation conflicts with one of these rules, the rule wins by default and we explicitly note we're deferring the mitigation.

---

## Critical Pitfalls

### Pitfall 1: Chasing a Viral Aesthetic That Saturates Mid-Build

**What goes wrong:**
You spend Phase 2 (Premium Templates) replicating a specific look — Murphy-magazine, mint-pill, "tr3nding" red caption bar, bento grid, etc. — that's currently winning. By the time you ship and creators try it on TikTok, the algorithm and audience have moved on. The template feels stale at launch and dated within a quarter. Bento grids in particular peak within days and disappear; even the broader 90s-revival aesthetic is hitting fatigue in 2026.

**Why it happens:**
The 2026 cross-platform aesthetic flywheel runs Pinterest (18-month incubation) → TikTok (1–4 weeks to saturation) → Instagram Reels/Carousels (2–8 weeks commercialization) → re-fragmentation. Format-based trends typically run 3–4 weeks before saturation. Engineering cycle (research → ship → user feedback → iterate) is longer than a 3–4 week saturation window. By the time the template ships, what's "viral" has rotated.

**Warning signs:**
- Reference inspirations are all from a single 4-week window
- Designer/PM pushes for "every style we've seen on TikTok this month"
- Templates locked to a specific accent color (#mint, #electric-orange) with no easy theme override
- One template named after a specific creator's exact look ("the @username layout")
- Marketing copy says "match what's trending this month"

**Prevention:**
- **Build for the structural pattern, not the surface aesthetic.** Hierarchy (hook >> body > CTA), pacing (slide 1 hook → slides 2-N value → last CTA), bold-large-readable typography, image-led composition, page counter — these patterns hold across 2024–2026 viral carousels. The mint color, the 8-bit pixel font, the specific photo filter — those age.
- **Make every template parametric (color, font weight, accent shape) at the schema level.** Each template should be a `compositionPattern` + `themeOverrides`. Re-skinning to follow a 2026-Q3 trend should be a CSS/JSON change, not a new file.
- **Limit v2.9 to 1–3 new templates.** More than that and you're betting on aesthetics over patterns.
- **Pin a "trend half-life" check** in the milestone audit: "Will this template still be defensible in 6 months?" If no, it's not worth shipping.
- **Avoid micro-trends in `aiVoiceNote` strings.** Don't tell Gemini "write copy in the 'demure mindful' voice" — that voice was dead 6 weeks after it peaked.

**Phase to address:** Phase 1 (Research) finalizes which patterns we actually replicate vs. which surface details we leave parametric. Phase 2 (Templates) executes against patterns, not aesthetics.

---

### Pitfall 2: Satori Silent-Ignore on Trendy CSS — Filters, Mix-Blend-Mode, Backdrop-Filter, Masks

**What goes wrong:**
You add a "liquid glass overlay" to slides using `backdrop-filter: blur()`, or a "blend overlay" using `mix-blend-mode: multiply`, or a `mask-image` cutout. The React preview in `<SlidePreview>` looks great in the browser. Satori's `ImageResponse` silently drops every one of these properties. The exported PNG ships without the effect. Users export, post to TikTok, find their carousel looks completely different from what they previewed, and churn.

This is the **same class of bug** as the Phase 48 `display:flex` issue caught in v2.7 (commit `e96fd3a`) but for visual effects rather than layout.

**Why it happens:**
Satori implements a Flexbox-based layout engine on top of an SVG 1.1 backend, not a real browser. From the official README: 3D transforms unsupported, no z-index, no `calc()`, no kerning/ligatures, no RTL, only TTF/OTF/WOFF (no WOFF2). `backdrop-filter`, `mix-blend-mode`, `box-decoration-break`, and `mask-image` have no implementation entry in the docs, and Satori "silently ignores unsupported features." There are open GitHub issues going back years (#493 mix-blend-mode, #545 mask-image) with no resolution.

**Warning signs:**
- A new template uses CSS that *isn't* already in `resolve-overlay.ts` or one of the 8 existing templates
- Previewing a slide in the browser shows an effect that's missing in the `/api/render` PNG
- Tests pass against `<SlidePreview>` but you have no Satori snapshot test
- A designer says "I want frosted glass" or "color blend"
- A trend study says the winning aesthetic uses noise textures, gradients with grain, or animated micro-interactions (Satori is static, no animations regardless)

**Prevention:**
- **Maintain a Satori-supported-CSS allowlist** in `src/lib/render/satori-css-allowlist.ts`. Every new property used in a template gets added here only after a Satori snapshot test confirms it actually renders. The allowlist is the source of truth — designers hit it before mocking.
- **Mandatory parity test:** every new template gets a `render-slide-satori.test.tsx` snapshot. If a property has no effect on the snapshot but is present in the React preview, the test must explicitly mark it as `// SATORI: dropped, intentional fallback` or fail review.
- **Forbidden in v2.9 templates** (verified absent from Satori): `backdrop-filter`, `filter` (anything beyond text), `mix-blend-mode`, `mask-image` / `-webkit-mask`, `clip-path` beyond simple rects, CSS animations/transitions (no effect on a static PNG anyway), CSS variables with custom properties (limited), WOFF2 fonts, `box-decoration-break: clone`. The existing Phase 45 fallback pattern for `tight` highlight (REND-04) is the model — degrade gracefully, in code, with a comment.
- **For "trendy" effects we want anyway:** pre-bake them. If we want a noise overlay, ship a 1080x1920 PNG noise tile in `public/textures/` and `<img>` it. If we want a gradient with grain, render the grain into the gradient PNG offline. **This is preferable to anything that could break parity.**
- **Lock font format to TTF/OTF.** Reject WOFF2 in font-picker validation server-side. Phase 51 the font picker validation.

**Phase to address:** Phase 2 (Templates). The allowlist file and parity test policy land before any new template lands.

---

### Pitfall 3: Color Drift Between React Preview and Satori PNG (Gradient, Anti-Aliasing, Text Shadow)

**What goes wrong:**
Even properties Satori claims to support drift visually: gradient color stops interpolate slightly differently in SVG vs. CSS, `textShadow` blur radii are clamped or rendered as a single duplicate offset, anti-aliasing on rounded corners differs, sub-pixel text positioning differs. A user picks a brand color, sees a perfect cream-on-mint preview, exports, and the PNG comes out a shade off. Worse for brand-kit users who picked the color from their brand guidelines.

**Why it happens:**
Satori is *not* a browser. It implements a subset of CSS atop an SVG renderer. Rendered output "doesn't guarantee 100% match the browser-rendered HTML output" by the maintainers' own statement. The React preview uses the actual browser engine. Two different rendering pipelines = drift.

**Warning signs:**
- Brand-kit users complain about "wrong color" in exports
- A/B comparing the preview screenshot vs. the PNG export shows visible difference
- Gradients look fine in preview but "banded" in PNG
- Text shadow is "too sharp" or "too soft" in PNG
- Designer screenshots a brand-style guide swatch and the rendered PNG is off by hex 2–4

**Prevention:**
- **Treat Satori as the source of truth, the React preview as an approximation.** Update preview CSS to match Satori's actual rendering when divergence is unfixable, not the other way around. (We already did the inverse for `display:flex` in Phase 48 — same discipline.)
- **Add a "preview accuracy" toggle** that renders a small Satori PNG inline in the editor every ~2 seconds (debounced) so the user sees the actual output. This is cheap (server-side rendering of one slide), prevents export-shock, and is more defensible than chasing pixel-parity in CSS.
- **Document known drifts** in `MIGRATION-NOTES.md` or a new `SATORI-NOTES.md`: "textShadow blur radii > 8px are clamped," "linear-gradient with > 4 stops may band," etc. When a user reports drift, link them.
- **Avoid gradients with > 3 stops** in v2.9 templates. Two-stop gradients render reliably; three is borderline; four+ bands.
- **No emoji in template defaults.** Satori's emoji fallback is a Twitter CDN that fails in some sandboxed builds and renders "tofu." If a user types an emoji into a hook, that's their choice; if our template embeds one (e.g., 🔥 in TR3NDING), we ship it as inline SVG, not a Unicode codepoint.

**Phase to address:** Phase 2 (Templates) for the policy; Phase 5 (QA) for the inline-Satori-preview if we ship it.

---

### Pitfall 4: Over-Constrained AI Prompt → Monoculture Output

**What goes wrong:**
You add a "viral voice" addendum to the Gemini prompt — "always start with a curiosity gap, max 12 words, must include accent word, must hit emotional cadence X" — plus tightened the JSON schema with stricter enums on every field, plus per-template `aiVoiceNote` strings (already in v2.7), plus a typo gate (already in v2.7). Suddenly every carousel reads the same. Hooks all start with "The reason..." or "Nobody talks about..." Body text all has the same rhythm. Users stop generating because two carousels in a row felt identical.

This is a real, documented degradation: forcing LLMs into rigid JSON schemas costs 10–15% on reasoning quality, and constrained decoding suppresses the model's natural variation, producing "robotic, repetitive, or overly literal" output. Smaller models (under 14B) tolerate constraints; larger models (which we'd want for quality) get worse.

**Why it happens:**
Each constraint feels safe in isolation. Stacked, they collapse the output distribution. Gemini 2.5 Flash is small enough to handle constraints reasonably, but the v2.7 stack (premium-tier word caps + 28-entry typo gate + per-template voice notes + retry-on-detection) is already approaching the ceiling.

**Warning signs:**
- Two carousels generated from different topics open with structurally identical hooks
- The same accent word appears in 30%+ of generations
- Body text rhythm is identical across topics ("X. Y. Then Z.")
- Internal QA people start saying "they all sound the same"
- Gemini's first attempt fails the typo gate frequently — implies it's straining against the constraints
- A/B against a less-constrained baseline shows higher engagement on the looser version

**Prevention:**
- **Two-pass generation:** first call free-form with no schema (just "draft slide content for topic X"), second call constrained (parse free-form into the schema). This is the documented mitigation for JSON-mode reasoning loss.
- **Tighten one axis at a time.** v2.9 should *not* simultaneously: tighten word caps, add new voice notes, add new typo entries, add structural constraints. Pick one and measure output diversity before adding the next.
- **Output diversity metric:** in CI, run 20 carousel generations on a fixed test prompt set and compute n-gram repetition rate hook-to-hook. If repetition exceeds a threshold (say, 30% trigram overlap across 20 samples), block the AI prompt change.
- **Per-template voice notes are higher leverage than global constraints.** A template-specific note ("documentary tone — no hyperbole") creates intentional diversity; a global note ("always start with a curiosity gap") creates monoculture.
- **Explicitly tell Gemini to vary** in the system prompt: "Hooks should not all begin with the same word or pattern. Vary opening across slides and across runs." This works, anecdotally.

**Phase to address:** Phase 4 (AI tightening). Build the diversity test harness first, change the prompt second.

---

### Pitfall 5: Adding `sharp` to a Serverless Pipeline — Memory Fragmentation OOMs

**What goes wrong:**
v2.9 calls for image treatments: B&W, duotone, dominant-color extraction for theme matching, smart crop, downscaling for thumbnails. The natural lib is `sharp`. You add it. Locally it works. In production on Vercel, after a few hundred slides processed, a serverless instance starts hitting heap limits and crashing. Symptom: intermittent 502s on render, never reproducible, only on warm instances.

**Why it happens:**
Sharp's underlying libvips library is a multi-threaded C++ allocator. On Linux (Vercel's runtime), the default glibc malloc fragments memory under sharp's many-small-allocations pattern. The V8 heap looks fine but the process RSS climbs. This isn't a "true leak" — it's fragmentation — but it crashes the process the same way. Documented across years of `lovell/sharp` issues. The recommended fix (jemalloc) is incompatible with Vercel's lambda runtime out of the box.

**Warning signs:**
- Intermittent 5xx on `/api/render` only after the function has been warm for minutes
- Vercel logs show "JavaScript heap out of memory" or function killed by SIGKILL
- Vercel function memory graph climbs slowly, never resets
- Only happens at "moderate scale" — fine in dev, fine for one user, fails when 5+ users render simultaneously
- Putting `sharp` calls behind `Promise.all([...])` makes it dramatically worse

**Prevention:**
- **Default position: do not add sharp in v2.9.** Pre-PMF rule #1. Most "image treatments" creators want (B&W, duotone, slight desaturation) can be approximated in **Satori CSS** (`filter` is partial — but `opacity` over a solid-color tint works) or rendered server-side via the existing Satori path with no new dep.
- **If a treatment genuinely requires raster manipulation** (e.g., true duotone with two-tone color mapping), do it as a one-shot at upload time, not at render time. Store the processed image in Supabase Storage. Render path stays sharp-free.
- **If sharp ends up necessary anyway:**
  - Serial processing only — no `Promise.all` over more than 1 sharp pipeline at a time
  - `sharp.cache(false)` and `sharp.concurrency(1)` at module load
  - Move sharp into a separate Vercel function with elevated memory (1024–3008MB), not the main render path
  - Set `maxDuration` and a hard timeout
  - Track function memory in Vercel observability and alert on RSS > 80% of allocation
- **Watch egress costs alongside memory.** Each sharp transform that fetches a Pexels/Imagen image adds ingress; each upload back to Supabase adds egress. Easy to silently 10x bandwidth.

**Phase to address:** Phase 3 (photo treatments) gates this. If Phase 1 research surfaces a user-validated need for raster effects, Phase 3 is the place. Otherwise, defer to v3.0+.

---

### Pitfall 6: Gemini Vision for Photo↔Slide Matching — Cost-Per-Carousel Trap

**What goes wrong:**
The parked `src/lib/ai/match-photos-to-slides.ts` calls Gemini Vision with each user photo (base64-encoded, in-line) plus a slide manifest, returning a slideIndex→photoIndex mapping. Looks elegant. Then a power user uploads 12 photos for an 8-slide carousel. One generation = 12 vision-input tokens (~12 × 1120 tokens for Gemini 2.5 Flash image input) + slide manifest text + JSON output. Per Gemini's published 2025 pricing, image input is ~560–1120 tokens **per image** depending on model. 12 photos = ~13,440 tokens just for vision input, on top of text. Carousel generation that used to cost 1 credit (one Gemini text call) now costs 5–8x in Gemini billing. We don't see it in our credit ledger because it's denominated in *Gemini tokens we pay for*, not user credits.

**Why it happens:**
The credit system was sized to one Gemini-text call per carousel + N Imagen calls per AI image. Vision adds an undeclared cost line. There's no per-photo cap in the code path. There's no per-user rate limit on photo count.

**Warning signs:**
- The Gemini bill exceeds the projection and you can't pin which feature
- Free-tier users (who upload many photos to "see what works") cost 3-5x more than paid users
- A power user with 30 uploaded photos crashes the matcher (timeout) or burns $0.50 per generation in Gemini token cost
- `match-photos-to-slides.ts` has no `MAX_PHOTOS` constant in the implementation path

**Prevention:**
- **Cap photos sent to vision at 8 per call.** If user uploaded more, send first 8 + slide manifest, fallback to index-order for the rest. (Existing fallback already exists; just gate on count.)
- **Charge an extra credit for vision-matching, or absorb the cost only on premium tier.** Track the cost line in the credit ledger explicitly: `gemini_vision_match`. Then the bill matches the ledger.
- **Pre-PMF: do not ship this feature unless we have a user complaint that index-order matching is bad.** Phase 1 research validates this. The current index-order fallback is fine for 80% of cases. Vision matching is polish for the 20% where photo selection feels random.
- **If shipped, gate behind a paid tier or credit cost.** Free tier gets index-order; premium gets vision. Aligns cost with revenue.
- **Time-box the vision call** to ~10 seconds. If it fails or times out, fallback silently to index-order. Vision-matching MUST be a quality booster, not a generation blocker.
- **Cache vision results per (photo-set hash, slide-set hash).** Same upload + same slide content = no re-call. This kills repeat costs on edit-and-regen flows.

**Phase to address:** Phase 4 (AI tightening) decides whether to ship at all. If yes, gates the cost protections.

---

### Pitfall 7: Imagen Stylization (`stylize-image.ts`) — Latency, Cost-Per-Slide, Quality Drift

**What goes wrong:**
The parked `src/lib/imagen/stylize-image.ts` calls `gemini-2.5-flash-image-preview` to restyle a user photo into a "viral aesthetic." Per slide. With 8 slides per carousel and Imagen 4 at $0.04/image (or `gemini-2.5-flash-image-preview` whose cost we should verify before launch), a stylized carousel costs $0.32+ in raw model spend. Plus 5–15 seconds latency *per slide* (image-to-image is slower than text-to-image). 8 slides × 10s = 80s of wall clock, well over Vercel's 60s `maxDuration`.

Worse: the output quality varies. Stylization preserves "subject and recognizable content" only loosely. A user uploading a photo of themselves for a personal-brand carousel ends up with a slightly-different-faced version of themselves across 8 slides — uncanny valley. Coca-Cola's 2025 ad campaign is the cautionary tale: 70,000 AI clips, 5 specialists, 100 staff, public backlash. Smaller-scale: GS25's distorted-hands campaign in South Korea. The pattern is consistent — AI image manipulation of recognizable people is high-risk.

**Why it happens:**
Image-preview models are non-deterministic. Stylization preserves style direction but not identity continuity across calls. There's no built-in "same face across N renders" primitive.

**Warning signs:**
- A user reports their face looks "off" or "different" across slides
- Carousels with people in the photos hit lower share/save rates than carousels without
- Generation times for stylized carousels exceed 60s and timeouts spike
- Imagen/Gemini bill has a long tail of "premium" carousels eating margin
- Customer support gets a "this isn't me" complaint
- Right-of-publicity concerns surface (user uploaded a celebrity photo and asks for "Studio Ghibli style")

**Prevention:**
- **Pre-PMF: do not ship full-photo restyling.** The risk profile (uncanny faces + ToS friction + cost + latency) doesn't match a pre-PMF user need. Defer to v3.0+ when we have data on demand.
- **If shipped:** restrict to non-face photos (use a face-detector pre-pass; if face detected, refuse and offer "background-only" restyling). This sidesteps the worst quality and legal risks.
- **Stylize backgrounds, not subjects.** A "viral aesthetic" can be achieved with a stylized background plate + un-touched user photo composited on top. Cheaper, no uncanny-valley issue.
- **Async + background queue.** Stylization happens after generation; user gets a regular carousel immediately and the stylized version when ready. Frees us from `maxDuration` and lets the user share unstyled if they're impatient.
- **Lock to a small, opinionated set of style prompts.** "Minimalist B&W documentary." "Mid-2010s film grain." "Mute color editorial." Three styles, each with a tested prompt. Do not let the user free-form prompt — that's where you get "Studio Ghibli" requests and right-of-publicity blowback.
- **Add a moderation pre-pass.** Before sending a user photo to Gemini image-preview, check it against a basic moderation API. If it's flagged (real recognizable person, brand logo, etc.), refuse. This is cheap insurance against ToS violations.
- **Log every stylize call** with input/output URL, prompt, cost. We need this for the support and legal trail.

**Phase to address:** Phase 3 (photo treatments). Default verdict: defer entirely to v3.0+. If Phase 1 research surfaces evidence of real demand, Phase 3 ships the locked-style background-only variant.

---

### Pitfall 8: TikTok / Instagram Algorithm Penalty for "AI Slop"

**What goes wrong:**
TikTok in late 2025 added user-controllable AI-content filtering and is invisibly watermarking AI-generated content from its own tools. Reach suppression for fully-AI-generated content depicting fake scenarios is reportedly ~73% within 48 hours of detection. A creator's carousel posted from our tool gets buried because:
1. The Imagen-generated background image carries C2PA metadata indicating AI authorship
2. The visual style (over-symmetrical layout, AI-stock-photo look) triggers the heuristic
3. The hook copy reads as obviously LLM-generated ("In a world where..." style)

User churns, blames us, leaves a review.

**Why it happens:**
- Imagen 4 outputs include SynthID watermarking by default
- Platforms increasingly read C2PA metadata on upload
- Algorithmic detection of "AI editing patterns" is part of the Sept 2025 TikTok update
- Our defaults (centered text, large hook, identical slide rhythm) are the patterns the algorithm fingerprints

**Warning signs:**
- A creator reports "this isn't getting any views"
- A/B test of our carousels vs. hand-made carousels shows disproportionate reach gap
- Image metadata inspection shows C2PA AI tags surviving export
- Stylistic analysis of 50 random user carousels shows visual homogeneity (ties to Pitfall #4)

**Prevention:**
- **Strip metadata aggressively on export.** Satori PNG export should already produce a clean PNG, but verify EXIF/XMP/C2PA fields are absent in the final ZIP. If we ever add Imagen-stylized backgrounds, run them through a metadata-strip step (one of the few legit uses for sharp's `withMetadata({})`).
- **Embrace creator-feel defaults.** Slight imperfections — a casual phone-photo source, hand-drawn-feel arrows, varied text positions across slides — read as "human-made" to the algorithm and to viewers. Our v2.7 magazine-bold template's full-bleed B&W photo + mint highlight is *less* generic than centered-on-gradient. Continue down that path.
- **Do not auto-pick Imagen-generated backgrounds by default.** Pexels-stock or user-uploaded should remain default. Imagen-generated is a power feature, not a default visual.
- **In the AI text prompt, explicitly forbid AI-tells:** "Do not start hooks with 'In a world where', 'Did you know', 'Imagine if'. Avoid generic LLM cadence."
- **Don't claim the carousel as AI-made in the watermark or metadata.** That's an algorithmic kill-switch.
- **Document this in the Resources page.** Tell creators: "Edit slide 1 even slightly so it reads as yours" — this offsets sameness.

**Phase to address:** Phase 4 (AI tightening) for the prompt-side; Phase 5 (QA) for the metadata-strip verification.

---

### Pitfall 9: Aspect-Ratio Crop in Profile Grid — Important Content Cut

**What goes wrong:**
Our output is 1080×1920 (9:16 portrait). On TikTok feed, that displays full. On Instagram Posts carousel, the recommended size is **1080×1350 (4:5)** — Instagram crops 9:16 inputs. On Instagram profile *grid*, even 4:5 carousels get cropped to **3:4** with only the **center 1012×1350** visible. We render at 9:16, position the hook in `SAFE.top.hookY: 12` (near top), and the grid-preview crop centers the image — meaning the hook is half-cut in the user's profile grid. Users post, see their own grid look bad, blame us.

**Why it happens:**
We optimized for 9:16 (TikTok-first) and never re-tested cropped versions. Instagram cross-posting was implicit in the product but never visually validated.

**Warning signs:**
- A user reports "looks fine in the post but cut off in my grid"
- Internal posting test: pull up Instagram, post the carousel, switch to grid view, check if hook is visible
- Instagram-aware competitors render at 4:5 by default and add center safe-zones

**Prevention:**
- **Add an Instagram-grid safe-zone overlay** in the canvas editor: a translucent box showing the 3:4 center crop. User can see what the grid will show before exporting. Cheap to ship — pure CSS overlay.
- **Offer a "crop preview" toggle** in the export modal: "Preview as TikTok feed / Instagram post / Instagram grid." Pure CSS — no extra rendering.
- **Set hook position defaults to `center.hookY: 30` rather than `top.hookY: 12`** for templates intended for cross-posting. Or: offer a per-template `crossPlatformSafe` flag that constrains hook to the 3:4 center crop.
- **Document the crops** in the resources page. Creators who understand the constraint design around it.
- **Do not auto-export a 4:5 version this milestone.** That's a real feature with its own complexity (re-flow, safe-zone re-resolve). Defer unless validated.

**Phase to address:** Phase 2 (Templates) for the safe-zone overlay; Phase 5 (QA) for the export modal preview.

---

### Pitfall 10: Pexels Photo + Stylization → Right-of-Publicity / License Friction

**What goes wrong:**
A user picks a Pexels photo of a recognizable person (Pexels' license permits commercial use of photos but does *not* grant rights of publicity for recognizable people). They run our stylize feature on it. Now we've materially altered a recognizable person's likeness for commercial use, surfaced it on Explore, and someone notices. Pexels' license + the underlying right of publicity are different things. The Ninth Circuit upheld a class action against the Reface app over Kyland Young's likeness in 2024–2025 — directly precedential for face-style apps.

**Why it happens:**
Stock-photo licenses cover the photographer's copyright but explicitly disclaim model releases for editorial/commercial-as-endorsement use. Face-stylization crosses the line.

**Warning signs:**
- Users posting carousels using stylized photos of recognizable real people
- Explore page surfaces a stylized photo of a celebrity
- A DMCA-adjacent or right-of-publicity complaint comes in
- Customer support gets "is it legal to..." questions

**Prevention:**
- **Tie this directly to Pitfall #7 mitigation.** If we don't ship full-photo restyling on faces, this risk evaporates.
- **If we ship anything stylization-adjacent:** add a face-detection pre-pass that refuses to stylize images with detected faces above a confidence threshold. Pre-built libs: TensorFlow.js BlazeFace (client-side) or a Gemini-vision "is there a face" pre-check.
- **Update ToS** to disclaim user responsibility for likeness rights and grant us indemnity. (Probably out of scope for v2.9 itself; flag for a legal-review milestone.)
- **Disallow stylization on Explore-shared carousels** until ToS and detection are firm. Explore is the public-surface risk vector.

**Phase to address:** Phase 3 (photo treatments) only if stylization ships. Default: deferred entirely.

---

### Pitfall 11: AI Cost Stacking — One Carousel, N Model Calls, Silent Margin Compression

**What goes wrong:**
v2.9 adds, plausibly: Gemini Vision photo-matching (1 call) + Imagen-stylize per slide (8 calls) + Gemini text-regen per slide (8 calls if user iterates) + caption generation + alt-text generation. A single "make me a carousel" can fan out to **20+ model calls**. Each carousel that used to cost ~$0.01 in raw AI now costs $0.30–$0.50. Subscription tier doesn't cover it on heavy users. We learn this at the next billing cycle.

**Why it happens:**
Each feature was costed in isolation against "free tier." Stacked, the worst-case per-carousel cost is the sum of all features × users who max each out. Margin compression is invisible until the bill hits.

**Warning signs:**
- The Gemini + Imagen + (anything else) bill is up >2x and you can't attribute it cleanly
- Power users (top 5%) cost more than they pay
- Free-tier conversion isn't covering the AI cost of the free-tier itself
- The credit ledger doesn't have a 1:1 with the AI bill

**Prevention:**
- **One AI cost line per phase.** Phase 3 ships *one* of {photo-match, photo-stylize, alt-text}. Watch the bill for one week. Then ship the next. **Hard rule.**
- **Track every model call in the credit ledger as a typed line item:** `gemini_text`, `gemini_vision`, `imagen_4`, `gemini_image_preview`. Aggregate weekly and reconcile to the AI bill.
- **Per-carousel AI-cost budget.** Define a max $/carousel (say $0.05 for free tier, $0.20 for premium). When a generation projects to exceed it (e.g., user uploaded 30 photos triggering 30 vision calls), cap at the budget — fall back to non-AI matching or warn the user.
- **Cache aggressively.** Photo-match results, image-prompt embeddings, regen drafts all cache by content-hash for 24h. Repeat generations on the same input cost $0.
- **Surface model-cost telemetry to the dashboard early.** A 2-line `creditsBurned this week` widget in the dev dashboard catches blow-ups before billing.

**Phase to address:** Phase 3 / Phase 4 (whichever ships first AI feature). The cost-tracking infra goes in *before* the feature.

---

### Pitfall 12: Vercel Function Egress + Storage Bloat from Asset Multiplication

**What goes wrong:**
v2.9 adds higher-quality assets: 2x retina template thumbnails, multi-resolution exports (1080x1920 + 1620x2880 for "premium"), saved Imagen backgrounds, stylized variants, dominant-color extraction caching. Each project now stores 5–10x the asset count of v2.8. Supabase Storage cost goes up linearly. Vercel egress (every render, every download, every preview) goes up linearly. Pro plan limits hit silently mid-month.

**Why it happens:**
Asset count was a non-issue when each project = 8 PNGs. Adding intermediate caches, variants, and retina assets compounds. No retention policy.

**Warning signs:**
- Supabase Storage usage trending exponentially
- Vercel egress alerts firing
- "Slow to load editor" reports — the editor is loading uncached intermediate assets
- The "delete project" action doesn't clean up child assets

**Prevention:**
- **Asset retention policy** in Supabase: intermediate cache assets (vision-match outputs, stylized variants) auto-purge after 7 days unless promoted to a saved project. Cron job or Postgres trigger.
- **One canonical resolution per export, period.** v2.9 does NOT ship retina/multi-resolution. 1080x1920 is correct for the platforms; anything more is bloat. (TikTok and Instagram both downscale anyway.)
- **Lazy-load template thumbnails.** Already partially done in v2.7. Verify the picker doesn't fetch all 8 thumbnails on mount.
- **Watch the Supabase Storage egress dashboard weekly.** Alert at 50% of plan limit.
- **`DELETE /projects/{id}` must also delete `published_carousels` snapshot, hero thumbnail, and any cached intermediate assets.** Audit the cascade.

**Phase to address:** Phase 5 (QA). Cleanup audit is a ship gate.

---

### Pitfall 13: Premature Visual Polish that Doesn't Move Retention or Share-Rate

**What goes wrong:**
We spend the milestone on subtle polish — better gradient stops, perfect kerning, an Instagram grid safe-zone overlay, a 9-stop color picker. Users don't notice (they wouldn't have churned on the old version). Meanwhile the actual blockers — say, "I don't know which template is right for me" or "the AI hooks don't match my niche" — go untouched. Milestone closes, retention is flat, shareto-TikTok rate is flat.

**Why it happens:**
Visual polish feels productive and is gratifying. It is the easiest thing to schedule against. It is also the thing pre-PMF startups most consistently overinvest in.

**Warning signs:**
- The roadmap is heavy on "improve the look of X" and light on "improve the user's outcome on platform Y"
- No success metric tied to the milestone other than "looks better"
- No user interview citation in any phase plan
- The phase plans don't reference current creator complaints
- v2.9 phases ship and the engineer-week-to-user-impact ratio is unmeasurable

**Prevention:**
- **Every phase has one quantitative success metric.** "X% more users complete a carousel," "X% more carousels get downloaded as ZIP," not "the templates look more current."
- **One in-product instrumentation per phase.** Don't ship a feature without a measurable signal it shipped well. Even crude — "carousel-completed events / generation-started events" — beats vibes.
- **A user interview every 2 weeks during v2.9.** Not optional. Show the latest preview, ask "would you post this?" If the answer is "almost," that's the gap. If the answer is "yes," the visual is done — go fix the thing that's actually blocking them.
- **Reserve at least 40% of milestone capacity for "research-driven, not polish-driven" features.** If Phase 1 research surfaces "users don't trust the hooks for their niche," that's higher-leverage than any visual polish and should outrank.
- **Ship the smallest visual upgrade that crosses the quality bar.** If the bar is "doesn't look like AI slop," and 1 new template + tighter type-pair achieves it, *stop*.

**Phase to address:** Phase 1 (Research) and the milestone audit. The roadmap structure itself is the prevention.

---

### Pitfall 14: Adding "Accessibility / Alt-Text" as Visual-Quality Polish Without User Demand

**What goes wrong:**
Industry research surfaces accessibility (WCAG, screen-reader, contrast, alt text) as a "quality" axis. We schedule a phase to add alt-text generation, contrast checking, motion-reduction modes. Engineering eats 1–2 weeks. No paying user asked. EAA enforcement is "early stages" with few public penalties — not yet an enterprise threat for solo creators. Pre-PMF, we just spent runway on a non-objection.

**Why it happens:**
Accessibility is morally legible and feels like quality. It also has near-zero pull from a creator-facing pre-PMF product.

**Warning signs:**
- "Accessibility" appears as a phase before any user has asked
- The justification is "platforms started enforcing" without a specific platform/penalty cited
- The work item is "WCAG compliance" rather than "fix this user's specific complaint"

**Prevention:**
- **Defer accessibility tooling out of v2.9.** Park it in Out of Scope with a note: revisit when (a) an enterprise/agency lead asks, (b) a platform actively enforces, or (c) a user reports a specific accessibility blocker.
- **Bake the cheap defaults** without making it a phase: ensure existing templates pass 4.5:1 text contrast, ensure body alt text is human-readable. That's an hour of polish, not a milestone.
- **If a real demand signal arrives, it gets its own milestone**, not a v2.9 phase.

**Phase to address:** This is a *non*-phase. Explicitly excluded.

---

### Pitfall 15: Cache Invalidation on Visual Treatments — Stale Renders in Production

**What goes wrong:**
You change a template's CSS or a stylization prompt in code. Existing rendered PNGs in Supabase Storage (from earlier exports, hero thumbnails, Explore page snapshots) don't update. Some users see the old visual, some the new. Explore page hero thumbnails are wrong. Customer support gets "you said you fixed X but my export still has Y."

The Explore feature already does the snapshot pattern — `published_carousels` is a deep-copy at publish time. Changing a template post-publish doesn't update published carousels. **This is correct** for Explore (immutability). But for *unpublished* projects whose hero thumbnails were cached, it's wrong.

**Why it happens:**
We render server-side and persist. Persisted assets don't auto-invalidate when the template changes.

**Warning signs:**
- Users report "I updated the slide but the export still has the old version"
- Explore thumbnails don't match current content
- Hero thumbnails for projects don't match the project's actual current state
- Race conditions between "save" and "render" produce stale views

**Prevention:**
- **Versioned template IDs.** When a template is materially changed (not a fix), bump its version: `magazine-bold@1.0` → `magazine-bold@1.1`. Existing projects keep `@1.0` (locked snapshot). New projects get `@1.1`. This is the immutability pattern Explore already implies.
- **Render output paths include a hash of inputs:** `{projectId}/{slideIndex}/{contentHash}.png`. Re-render produces a new path. Old renders are orphaned (cleaned up by retention policy from Pitfall #12).
- **Hero thumbnail re-generation on edit.** The publish-actions path already re-renders on publish — extend to project-edit if we surface project thumbnails anywhere.
- **Don't change template IDs in place.** Add new ones, deprecate old ones, never mutate.

**Phase to address:** Phase 2 (Templates) for the versioning policy; Phase 5 (QA) for the cache-invalidation audit.

---

## Pitfall-to-Phase Mapping (Roadmap Index)

| # | Pitfall | Severity | Phase to Bake Prevention In | Verification |
|---|---|---|---|---|
| 1 | Trend-fatigued aesthetic | CRITICAL | Phase 1 (Research) → Phase 2 (Templates) | Templates parametric (color/font as data); ≤3 new templates total |
| 2 | Satori silent-ignore on trendy CSS | CRITICAL | Phase 2 (Templates) | `satori-css-allowlist.ts` checked in; per-template Satori snapshot test |
| 3 | Color drift preview vs PNG | HIGH | Phase 2 (Templates) | Inline Satori preview in editor; documented drift list |
| 4 | Over-constrained AI → monoculture | HIGH | Phase 4 (AI tightening) | Diversity test harness in CI; 1 constraint added per change |
| 5 | sharp memory fragmentation | HIGH | Phase 3 (photo treatments) — *defer* | Default position: no sharp; if added, serial only + jemalloc note |
| 6 | Gemini Vision cost trap | HIGH | Phase 4 (AI tightening) — *gate* | MAX_PHOTOS=8; vision call cached by content hash; cost tracked |
| 7 | Imagen stylize cost/latency/uncanny | CRITICAL | Phase 3 (photo treatments) — *defer to v3.0* | Background-only if shipped; locked style prompts; face-detect refusal |
| 8 | Algorithm "AI slop" penalty | HIGH | Phase 4 (AI tightening) + Phase 5 (QA) | Strip metadata on export; forbid AI-tell hooks; default to user/Pexels images |
| 9 | IG grid 3:4 crop hides hook | MEDIUM | Phase 2 (Templates) | Safe-zone overlay in editor; export-modal preview |
| 10 | Right-of-publicity / face stylize | CRITICAL (legal) | Phase 3 — *defer with stylize* | Face-detect refusal; locked styles only; ToS update |
| 11 | AI cost stacking, margin compression | CRITICAL | Phase 3 / Phase 4 (whichever first) | One AI feature per phase; per-call ledger lines; per-carousel cost cap |
| 12 | Asset bloat / egress | MEDIUM | Phase 5 (QA) | Retention cron; single-resolution export; cascade-delete audit |
| 13 | Polish that doesn't move metric | CRITICAL (process) | Phase 1 (Research) + audit | One quantitative metric per phase; biweekly user interview |
| 14 | Accessibility as polish without demand | MEDIUM | Out of scope for v2.9 | Park in Out of Scope; revisit on signal |
| 15 | Stale renders / cache invalidation | MEDIUM | Phase 2 + Phase 5 | Versioned template IDs; content-hash render paths |

---

## "Looks Done But Isn't" Checklist (v2.9 ship gate)

- [ ] Each new template renders byte-identical-or-better in Satori PNG vs React preview (snapshot test, not visual eyeball)
- [ ] No new template uses CSS not on the Satori allowlist
- [ ] No emoji in template defaults (if used, inline SVG)
- [ ] AI-prompt diversity test: 20 carousels on the same topic generate ≥X distinct hook openings (threshold TBD by the AI tightening phase)
- [ ] Per-carousel AI cost projection ≤ budget for free tier
- [ ] If photo-match shipped: MAX_PHOTOS cap, fallback path tested, content-hash cache verified
- [ ] If stylize shipped: face-detect refusal in path, locked style prompts only, async queue (not blocking generation)
- [ ] Export ZIP PNG metadata is clean (no EXIF, no XMP, no C2PA)
- [ ] Editor canvas shows IG-grid safe-zone overlay (cheap, ship it)
- [ ] Each phase has one quantitative success metric defined and instrumented before ship
- [ ] Cascade-delete: deleting a project removes its hero thumbnail and any cached intermediate assets
- [ ] Template versioning policy in place (no in-place mutation of shipped templates)
- [ ] No regression on the v2.8 542 test count; new tests added per new template / per new AI feature

---

## Recovery Strategies (when prevention failed)

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| 1 — trend already aged | LOW–MEDIUM | Re-skin via theme overrides, not new template; sunset the worst-aged template |
| 2 — Satori silent-drop | LOW | Remove the unsupported property; substitute pre-baked asset (PNG noise tile etc.); add to allowlist as forbidden |
| 3 — color drift complaints | MEDIUM | Update React preview to match Satori output (not vice versa); document known drifts |
| 4 — monoculture output | MEDIUM | Two-pass generation; loosen one constraint; add explicit "vary opening" instruction |
| 5 — sharp OOM in prod | HIGH | Move sharp to dedicated function with elevated memory; serial-only; or rip sharp out and use Satori CSS approximations |
| 6 — vision cost spike | LOW | Add MAX_PHOTOS, add cache, gate behind premium tier |
| 7 — uncanny stylize complaints | HIGH | Disable feature; refund affected users; switch to background-only stylization |
| 8 — algorithm penalty | MEDIUM | Strip metadata aggressively; A/B test new prompt cadence; offer "humanize this hook" UX |
| 9 — IG grid crop | LOW | Add safe-zone overlay in editor; offer reposition tool |
| 10 — right-of-publicity threat | HIGH | Take feature down; remove offending Explore content; legal review |
| 11 — bill blowout | MEDIUM | Add per-call ledger lines; reconcile to bill; cap per-carousel cost |
| 12 — storage / egress alarm | LOW | Add retention cron; downgrade retina (if shipped); cascade-delete audit |
| 13 — polished, didn't move metric | HIGH (runway) | Pause polish work; user interviews; pivot next milestone toward unblocking the actual objection |
| 14 — accessibility scope creep | LOW | Park work; redirect to demand signal |
| 15 — stale renders | LOW | Force re-render with content-hash path; backfill hero thumbnails on next edit |

---

## Sources

- [Satori README — supported/unsupported CSS](https://github.com/vercel/satori/blob/main/README.md) (HIGH — official, current)
- [Satori issue #493 — mix-blend-mode unsupported](https://github.com/vercel/satori/issues/493) (HIGH — primary source)
- [Satori issue #545 — mask-image rendering broken](https://github.com/vercel/satori/issues/545) (HIGH)
- [Satori issue #41 — silent ignoring of unsupported properties](https://github.com/vercel/satori/issues/41) (HIGH)
- [Gemini API pricing — image input/output token rates 2025/2026](https://ai.google.dev/gemini-api/docs/pricing) (HIGH — official)
- [Imagen 4 pricing — $0.04 standard, $0.06 Ultra, $0.02 Fast per output image](https://developers.googleblog.com/imagen-4-now-available-in-the-gemini-api-and-google-ai-studio/) (HIGH — official)
- [TikTok 2026 algorithm — AI slop suppression, ~73% reach reduction signal](https://buffer.com/resources/tiktok-algorithm/) (MEDIUM — industry write-up; cross-referenced with multiple 2025–2026 sources)
- [TikTok adding AI-slop filter tools + invisible watermarks on TikTok-AI tools](https://htxt.co.za/2025/11/you-can-now-control-how-much-ai-slop-you-see-on-tiktok/) (MEDIUM)
- [TikTok carousel algorithm 2026 — slide 1 hook drives 60–80% swipe-through](https://www.postwaffle.com/blog/tiktok-carousel-algorithm) (MEDIUM)
- [TikTok hook eye-tracking — 1.7s attention shift threshold (WARC + TikTok Creative Center)](https://www.opus.pro/blog/tiktok-hook-formulas) (MEDIUM)
- [Instagram 2026 carousel sizing — 1080×1350 (4:5) recommended; 3:4 grid crop center 1012×1350](https://socialbee.com/blog/instagram-aspect-ratio-and-image-size/) (MEDIUM)
- [Instagram cross-platform aesthetic flywheel + 3–4 week format-trend saturation](https://aestheticsofphotography.com/the-viral-visual-grammar-of-us-instagram-in-2026-aesthetics-algorithms-and-attention/) (MEDIUM — well-sourced industry write-up)
- [Sharp memory fragmentation in serverless — multi-threaded libvips + glibc malloc](https://www.context.dev/blog/preventing-memory-issues-in-node-js-sharp-a-journey) (HIGH — engineering postmortem)
- [Sharp issue #3052 — memory leak / fragmentation under load](https://github.com/lovell/sharp/issues/3052) (HIGH — primary source)
- [Sharp issue #1041 — bloating in production, jemalloc as mitigation](https://github.com/lovell/sharp/issues/1041) (HIGH)
- [LLM constrained-decoding cost — 10–15% reasoning loss; monoculture risk](https://arxiv.org/html/2501.10868v1) (HIGH — academic)
- [SLOT: Two-pass generation as constrained-decoding mitigation](https://aclanthology.org/2025.emnlp-industry.32.pdf) (HIGH — academic)
- [AI-image uncanny-valley failures — Coca-Cola, GS25 case studies](https://davinci.ai/blog/why-do-ai-generated-images-look-uncanny) (MEDIUM)
- [Right-of-publicity + AI face stylization — Reface/Kyland Young 9th Cir.](https://perkinscoie.com/insights/blog/refaceoff-animating-right-publicity-dawn-generative-ai) (HIGH — legal source)
- [Pre-PMF mistakes — premature scaling, optimizing landing-page before product](https://www.allied.vc/guides/growth-metrics-before-product-market-fit) (MEDIUM)
- [Sean Ellis on optimization mistakes that kill startups](https://www.startup-marketing.com/optimization-mistakes-that-kill-startups/) (MEDIUM — canonical)
- [a16z — 12 Things About Product-Market Fit](https://a16z.com/12-things-about-product-market-fit/) (MEDIUM — canonical)
- [Web carousel accessibility — WCAG 2025, EAA enforcement state](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025) (MEDIUM)
- Codebase: `src/lib/render/render-slide-satori.tsx` (existing Satori path, REND-04 box-decoration-break fallback in place)
- Codebase: `src/lib/render/resolve-overlay.ts` (single source of truth for Satori + React parity — model for new templates)
- Codebase: `src/lib/ai/match-photos-to-slides.ts` (parked feature reviewed for cost/cap pitfalls)
- Codebase: `src/lib/imagen/stylize-image.ts` (parked feature reviewed for legal/uncanny pitfalls)
- Codebase: `package.json` (no `sharp` dep currently — supports Pre-PMF Rule #1)
- Prior research: `.planning/research/archive-pre-v2.9/PITFALLS.md` (v2.3 MCP pitfalls — assumed mitigated, not re-stated here)

---
*Pitfalls research for: v2.9 Viral Visual Quality*
*Researched: 2026-05-01*
*Confidence: MEDIUM-HIGH. Lowest confidence on TikTok algorithm specifics (industry write-ups, not platform documentation); highest confidence on Satori limits and AI pricing (official sources).*
