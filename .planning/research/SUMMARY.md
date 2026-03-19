# Project Research Summary

**Project:** TikTok Slideshow Creator
**Domain:** AI-powered short-form video creation (SaaS web app)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

This is an AI-powered slideshow video creator targeting TikTok and Reels creators — a well-established product category with direct competitors in BigMotion AI, Lumen5, InVideo, and Pictory. The recommended approach centers on a three-tier architecture: a Next.js 15.5 + Remotion frontend for real-time editing and preview, a Next.js API layer for orchestrating Claude and Pexels integrations, and a RunPod serverless Docker container for headless MP4 rendering. The most critical architectural insight is that the slide editor does NOT need a canvas library — slides are Remotion React compositions, and editing means updating a Zustand store that the Remotion Player reads directly. This single shared composition powers both browser preview and server-side export, guaranteeing visual parity.

The recommended approach produces a fast, no-frills MVP by treating Phase 1 as infrastructure validation (Remotion composition + Zustand store + RunPod render pipeline, end-to-end, before any editor UI) and Phase 2 as the AI content loop (Claude content generation + Pexels image integration + slide editor). The product's core value — competitive with BigMotion — can be delivered in 5 focused phases. A key platform insight from research: TikTok is disincentivizing low-effort commerce slideshow spam, which validates building around quality AI hooks and compelling content rather than raw generation speed.

The top risks are infrastructure (Remotion Docker misconfiguration on RunPod is a multi-day trap; must be validated before building anything else), AI quality (generic Claude output destroys the value proposition; requires significant prompt engineering investment), and async rendering architecture (must be job-queue-based from day one — retrofitting is a rewrite). Remotion's licensing also deserves early attention: it is free for teams of 3 or fewer, but a company license is required beyond that threshold, and v5.0 license changes are pending.

## Key Findings

### Recommended Stack

The stack is cohesive and high-confidence across all components. Next.js 15.5 (not 16 — ecosystem still catching up to breaking changes) with React 19, TypeScript 5, and Tailwind CSS 4 forms the web foundation. Remotion 4.x is the only mature React-based video framework and handles both in-browser preview (via `@remotion/player`) and server-side MP4 rendering (via `@remotion/renderer`). Supabase bundles auth, Postgres database, and file storage into a single platform, eliminating the need to integrate three separate services. Zustand 5 manages editor state with a flat, serializable store shape that maps directly to Remotion's inputProps. RunPod serverless Docker containers handle rendering — CPU-only workers are sufficient (Remotion is CPU-bound, not GPU-bound), making this meaningfully cheaper than GPU instances.

**Core technologies:**
- **Next.js 15.5**: Web framework — stable, best Remotion community support, SSR for marketing pages
- **Remotion 4.x**: Video engine — only mature React video framework; single composition for preview and export
- **@remotion/player**: Browser preview — renders compositions in real-time without server rendering
- **@remotion/renderer**: Server rendering — headless Chromium + FFmpeg in Docker on RunPod
- **Supabase**: Auth + database + storage — all-in-one eliminates multi-service integration
- **Prisma 6**: ORM — type-safe queries for relational project/slide/user data
- **Claude (Sonnet via @anthropic-ai/sdk 0.79)**: AI content generation — structured JSON output for slide copy
- **Pexels API**: Stock images — free, no per-image attribution required, portrait orientation support
- **Zustand 5**: Editor state — flat store shape maps to Remotion inputProps, supports undo/redo middleware
- **dnd-kit 6**: Slide reordering — actively maintained, accessible, 10KB
- **RunPod Serverless**: Render infrastructure — scale-to-zero, pay-per-second, Docker flexibility
- **Tailwind CSS 4 + shadcn/ui**: UI — full React 19 + Tailwind v4 support, copy-paste components

### Expected Features

Competitors studied: BigMotion AI, Lumen5, InVideo AI, Pictory, Canva Video, Pippit (CapCut).

**Must have (table stakes):**
- Text prompt to slideshow generation — the entire value proposition; every competitor has it
- 9:16 vertical output — non-negotiable for TikTok/Reels target audience
- In-browser preview — users must see results immediately before committing to export
- Basic slide editor (add, remove, reorder) — all competitors support post-generation editing
- Text overlay editing (font, size, color, position) — users always tweak AI copy
- Stock image search and swap (Pexels) — per-slide image replacement is table stakes
- User image uploads — branded content requires custom photos
- Transition effects (fade, zoom, slide, wipe) — static slides feel like PowerPoint
- Text animations — static text looks amateur compared to competitors
- MP4 export — the output the entire product exists to produce
- Template/style system (5-10 at launch) — users pick a "look" before or after generation
- Project save/load with user auth — creators make many projects; losing work is unacceptable
- Auto-generated hook, body, and CTA copy — structured AI output per slide

**Should have (competitive differentiators):**
- Instant preview (under 10 seconds to see generated slideshow) — most competitors take 30-60 seconds
- Slide-level AI regeneration — regenerate one slide without redoing the whole thing; high UX value, low complexity
- Smart TikTok-specific hook generation — curiosity gaps, pattern interrupts, POV hooks outperform generic copy
- Undo/redo in editor — surprisingly missing from many AI video tools; power users expect it
- One-click style variations — same content in 3-4 templates for A/B testing
- Brand kit (colors, fonts, logo) — saves significant time for repeat creators
- Keyboard shortcuts — power users making 5+ videos/day want speed
- Aspect ratio variants (9:16, 1:1, 16:9) — repurpose content for different platforms

**Defer (v2+):**
- Auto-posting to TikTok/Instagram — complex OAuth, fragile API, restricted TikTok access
- Background music selection — TikTok adds music natively when posting; defer audio integration
- AI image generation (DALL-E, Flux) — cost-prohibitive; stock photos look more natural for this content type
- AI voiceover/TTS — TikTok's native voiceover is what creators actually use
- Video clip support — doubles editor and rendering complexity; images only for v1
- Content calendar / batch generation — requires queue infrastructure; v2 when core loop is validated
- AI avatars / talking heads — different product category entirely
- Real-time collaboration — target user is solo creator; multiplayer is massive engineering investment

### Architecture Approach

The architecture follows a strict three-tier separation: frontend (Next.js + Remotion Player + Zustand), orchestration API (Next.js API routes proxying Claude, Pexels, RunPod, and Supabase), and render worker (RunPod Docker container with Remotion + Chromium + FFmpeg). The shared Remotion composition is the load-bearing architectural element — the same React components render the in-browser preview and the server-side MP4, guaranteeing visual parity. The Zustand store shape is designed to be the Remotion inputProps, meaning the entire project state serializes to JSON and passes directly to the render worker with no transformation layer.

**Major components:**
1. **Remotion Composition** (`src/remotion/`) — single source of truth for visual rendering; imported by Player on frontend and bundled into Docker image for worker
2. **Zustand Store** — serializable project state (slides array, settings, style); IS the inputProps; drives both editor and Player
3. **Next.js API Routes** — `/api/generate` (Claude), `/api/images` (Pexels proxy with caching), `/api/uploads` (presigned URLs), `/api/render` (RunPod trigger + job polling), `/api/projects` (CRUD)
4. **RunPod Docker Worker** — receives project JSON, calls `renderMedia()`, uploads MP4 to Supabase Storage, returns URL
5. **Slide Editor UI** — writes to Zustand store; never touches Remotion internals directly
6. **Image Picker** — Pexels search + user upload; updates per-slide `imageUrl` in store

### Critical Pitfalls

1. **Remotion Docker misconfiguration on RunPod** — Use `node:22-bookworm-slim` base, install all required Chromium shared libraries explicitly (follow Remotion Docker docs), include emoji fonts, use `swangle` GL backend. Test the container end-to-end on RunPod before writing any editor UI. This pitfall costs days.

2. **Synchronous render API** — Design render as async job queue from day one. POST to `/api/render` returns a job ID immediately; frontend polls status. RunPod's async endpoint pattern supports this natively. Retrofitting async into a sync architecture is a full rewrite.

3. **Generic AI-generated content** — Invest 2-3x more time in prompt engineering than expected. Study 20-30 high-performing TikTok slideshows and build them into the system prompt as few-shot examples. Add tone parameters, constrain word count per slide (5-15 words max), use structured JSON output. The AI quality IS the product.

4. **Editor built before data model is solid** — Define the slideshow JSON schema first, render a video from it on RunPod, verify output matches expectations. Only then build editor UI. The data model must support undo/redo, map cleanly to Remotion inputProps, and round-trip cleanly from JSON to video.

5. **Preview/render parity gap** — Use the exact same Remotion composition for browser preview and server render. Bundle the same fonts in Docker and load them in the browser. Pin Chromium versions. Test side-by-side after every feature addition to catch divergence early.

## Implications for Roadmap

Research strongly suggests 5 phases with clear dependency ordering. The architecture research explicitly defines this build order and the pitfalls research reinforces it.

### Phase 1: Infrastructure and Data Foundation

**Rationale:** The Remotion composition and Zustand store shape are the foundations everything else depends on. The render pipeline (RunPod Docker + async job queue) must be proven before any UI work begins — Pitfall 1 warns this can cost days if deferred. The data model must be defined before the editor (Pitfall 9).

**Delivers:** A working end-to-end pipeline: JSON project data in, MP4 out on RunPod. No real UI yet — just the rendering infrastructure and store schema proven.

**Addresses:**
- Remotion composition (`TikTokSlideshow.tsx`, `Slide.tsx`)
- Zustand store schema (Project interface, slides array)
- Remotion Player integration (in-browser preview)
- RunPod Docker container (Chromium + FFmpeg + Remotion bundle)
- Async render job architecture (`/api/render` returns job ID, polling endpoint)
- Supabase setup (auth + database schema + storage bucket)

**Avoids:** Pitfalls 1 (Docker misconfiguration), 2 (sync rendering), 5 (Chromium OOM), 9 (editor before data model), 14 (no error recovery)

**Research flag:** Needs phase research — RunPod + Remotion custom Docker is not a documented pattern; official Remotion Docker docs are the starting point but RunPod integration requires custom work.

### Phase 2: AI Content Generation Loop

**Rationale:** Without AI generation, testing the editor requires manually crafting slide data. AI generation must come before editor polish because the editor's job is refining generated content, not creating from scratch. This phase delivers the core value proposition.

**Delivers:** The complete "prompt to preview" loop — user types topic, Claude generates structured slide content, Pexels images are fetched per slide, Remotion Player shows the result. The product is usable at this point.

**Addresses:**
- Claude API route (`/api/generate`) with few-shot TikTok-optimized prompts
- Pexels API proxy (`/api/images`) with server-side caching
- Image picker UI (search + swap per slide)
- Template/style system (3-5 initial templates)
- 9:16 aspect ratio enforcement throughout (Pexels portrait param, `object-fit: cover` in editor)

**Avoids:** Pitfalls 4 (generic AI output), 6 (Pexels rate limits), 7 (Pexels license), 12 (aspect ratio enforcement)

**Research flag:** Prompt engineering quality needs validation against real TikTok content — this is product work, not just engineering. Budget extra time here.

### Phase 3: Slide Editor and Export

**Rationale:** Now that AI-generated slides exist to edit, the editor UI has real content to work with. MP4 export is the primary deliverable of the product and must ship in this phase. Editor and export ship together because they are tightly coupled (the exported video is the preview composition).

**Delivers:** Full editing capabilities plus working MP4 export. The product is shippable to beta users.

**Addresses:**
- Slide editor UI (add/remove/reorder via dnd-kit, text editing, style controls)
- Text overlay editing (font, size, color, position)
- User image uploads (presigned URL to Supabase Storage)
- MP4 export with async render status UI (progress indicators, download link)
- Slide-level AI regeneration (targeted Claude call per slide)
- Undo/redo (Zustand history middleware)
- Project save/load (CRUD via `/api/projects`)

**Avoids:** Pitfall 10 (preview/render parity — validate side-by-side before shipping)

**Research flag:** Standard patterns here (dnd-kit, Zustand middleware, presigned uploads). Skip phase research.

### Phase 4: Transitions, Animations, and Template Expansion

**Rationale:** Transitions and text animations are table stakes but depend on a working composition and editor. With Phase 3 complete, these are pure Remotion composition enhancements with no new infrastructure. Template expansion multiplies value with relatively low effort.

**Delivers:** Polished video output with professional transitions and text animations. 8-10 templates total. The product is competitive with BigMotion baseline.

**Addresses:**
- Transition effects (fade, zoom, slide, wipe — at minimum)
- Text animations (fade-in, slide-up, typewriter)
- Additional templates (5+ new styles)
- Transition and animation controls in editor UI
- RunPod cold start UX improvements (FlashBoot, "Preparing..." state)

**Avoids:** Pitfall 8 (cold start UX — users need clear progress states, not a frozen spinner)

**Research flag:** Standard Remotion animation patterns. Skip phase research.

### Phase 5: Differentiation and Growth Features

**Rationale:** After core loop is validated with real users, invest in the differentiators that set the product apart from competitors. These require product-market fit signal before building.

**Delivers:** Features that convert casual users to power users and reduce churn — brand kit, style variations, keyboard shortcuts, aspect ratio variants.

**Addresses:**
- Brand kit (saved colors, fonts, logo)
- One-click style variations (same content, 3-4 templates simultaneously)
- Smart TikTok hook generation (curiosity gaps, pattern interrupts, POV hooks)
- Aspect ratio variants (1:1 Instagram, 16:9 YouTube)
- Keyboard shortcuts for editor
- More templates (15-20 total)
- Claude cost optimization (Haiku for simple tasks, Sonnet for creative content)

**Research flag:** Brand kit and style variation UX patterns are worth a quick phase research pass — these have product design implications beyond engineering.

### Phase Ordering Rationale

- Phase 1 must come first because the Remotion composition and store schema are foundational — every other phase depends on them. The render pipeline must be proven before building any UI that depends on it.
- Phase 2 before Phase 3 because the editor's purpose is refining AI-generated content; without generation working, editor testing is artificial and misses real-world edge cases.
- Phase 3 before Phase 4 because transitions and animations are composition enhancements that require the editor and export pipeline to already exist.
- Phase 5 last because it requires user feedback to prioritize correctly. Building brand kits before knowing what users actually want is waste.
- This order directly mirrors the dependency chain in ARCHITECTURE.md's "Suggested Build Order" section and is reinforced by PITFALLS.md's phase-specific warnings.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** RunPod + custom Remotion Docker integration — not an officially documented pattern; requires careful reading of Remotion Docker docs and RunPod serverless handler setup. Async job architecture with webhook callbacks needs implementation research.
- **Phase 2:** Claude prompt engineering for TikTok content — requires studying real TikTok slideshows and iterative prompt refinement. This is a product research activity more than an engineering one.

Phases with standard patterns (skip research-phase):
- **Phase 3:** dnd-kit, Zustand history middleware, Supabase presigned uploads are well-documented. Remotion's own templates demonstrate project persistence patterns.
- **Phase 4:** Remotion animation and transition APIs are well-documented with examples in official templates.
- **Phase 5:** Standard CRUD + UI patterns for brand kit and variation features.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major choices verified against official docs. Remotion, Next.js 15.5, Supabase, RunPod all well-documented. Only Prisma vs Drizzle is medium-confidence (either works). |
| Features | HIGH | Competitor feature analysis from 6+ reference products. TikTok platform dynamics (slideshow restrictions) confirmed from 2025-2026 sources. |
| Architecture | HIGH | Three-tier pattern and shared Remotion composition approach come directly from Remotion's official architecture docs. RunPod integration is the one medium-confidence piece. |
| Pitfalls | HIGH | 14 pitfalls documented, most from official Remotion changelog, RunPod docs, and Pexels API docs. Chromium memory leak and Docker misconfiguration are verified from official sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **RunPod + Remotion integration specifics:** The exact handler code for a Remotion render server on RunPod is not in official docs. Plan for 2-3 days of integration work in Phase 1. The Remotion render server template on GitHub is the closest reference.
- **Claude prompt quality validation:** Cannot be assessed until tested against real TikTok content. Allocate dedicated prompt engineering iteration time in Phase 2 before declaring it done.
- **Pexels image relevance for niche queries:** Abstract topics may return irrelevant images. The mitigation (multiple query variants from Claude) needs to be tested empirically.
- **Remotion 5.0 license changes:** Remotion 5.0 is forthcoming with unconfirmed license changes. Monitor remotion.pro for updates before any public launch involving more than 3 team members.
- **RunPod cold start duration at scale:** FlashBoot claims 500ms-2s, but Docker image size heavily influences this. Actual cold start time needs measurement once the container is built.

## Sources

### Primary (HIGH confidence)
- [Remotion official docs](https://www.remotion.dev/docs/) — architecture, Docker, Player, renderMedia, licensing
- [Remotion SSR comparison](https://www.remotion.dev/docs/compare-ssr) — rendering options rationale
- [Next.js 15.5 blog](https://nextjs.org/blog/next-15-5) and [Next.js 16 blog](https://nextjs.org/blog/next-16) — version selection
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) — Claude integration
- [Pexels API docs](https://www.pexels.com/api/documentation/) — rate limits, licensing, portrait orientation
- [Supabase docs](https://supabase.com/docs) — auth, storage, presigned URLs
- [RunPod serverless docs](https://docs.runpod.io/serverless/overview) — job architecture, pricing, FlashBoot
- [shadcn/ui Tailwind v4 support](https://ui.shadcn.com/docs/tailwind-v4) — component library compatibility
- [Remotion Chromium flags](https://www.remotion.dev/docs/chromium-flags) — GL backend and memory leak history
- [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — structured output

### Secondary (MEDIUM confidence)
- [BigMotion AI](https://www.bigmotion.ai/tools/slideshow-video-maker), [Lumen5](https://lumen5.com/features/ai-video-generator), [InVideo AI](https://invideo.io/make/ai-video-generator/), [Pictory](https://pictory.ai/all-features) — competitor feature analysis
- [CrePal Remotion Docker guide](https://crepal.ai/blog/aivideo/blog-how-to-run-remotion-in-docker/) — CPU limits, fonts, permissions in Docker
- [Remotion render server template](https://deepwiki.com/remotion-dev/template-render-server) — async render patterns
- [Zustand vs Jotai comparison](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k) — state management rationale
- [TikTok Updates 2026](https://disruptmarketing.co/blog/tiktok-updates/) — slideshow posting restrictions

### Tertiary (LOW confidence)
- [RunPod FlashBoot announcement](https://www.runpod.io/blog/introducing-flashboot-serverless-cold-start) — cold start claims need empirical validation with actual container

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
