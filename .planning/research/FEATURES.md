# Feature Landscape

**Domain:** AI-powered TikTok/Reels slideshow video creator
**Researched:** 2026-03-19
**Reference products:** BigMotion AI, Canva Video, Lumen5, InVideo AI, Pictory, Pippit (CapCut)

## Table Stakes

Features users expect from any AI slideshow/video creator. Missing any of these and users will bounce to a competitor.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Text prompt to slideshow generation | Core value prop of every competitor. BigMotion, InVideo, Lumen5 all do this. Users type a topic, get slides. | High | Requires AI content generation (script, slide text, image queries), stock image matching, and layout assembly. This is THE feature. |
| 9:16 vertical output | TikTok/Reels are vertical. Every competitor defaults to this. Non-negotiable for the target audience. | Low | Aspect ratio constraint on templates and rendering. |
| Slide editor (add/remove/reorder slides) | Every competitor allows post-generation editing. Users always want to tweak AI output. | Medium | Drag-and-drop reorder, add/delete slides, basic CRUD. |
| Text overlay editing | All competitors let you edit text on slides -- change copy, font size, color, position. | Medium | Rich text editing on canvas with font/size/color/position controls. |
| Image swapping (stock library) | Lumen5, BigMotion, Pictory all have stock image libraries. Users swap AI-picked images constantly. | Medium | Pexels/Unsplash API integration with search. User must be able to search and swap per-slide. |
| User image uploads | BigMotion and all competitors support uploading your own photos. Table stakes for branded content. | Low | File upload, storage, thumbnail preview. |
| Transition effects between slides | Every slideshow tool has transitions (fade, zoom, wipe, slide). Without them the output feels like a PowerPoint. | Medium | Need 5-10 solid transitions. Fade, zoom, slide, wipe cover 90% of use cases. |
| Text animations/motion | Text that fades in, slides up, or types on. All competitors have this. Static text looks amateur. | Medium | Remotion handles this well with React animations. |
| MP4 video export | The entire point -- exportable video file. Every competitor does this. | High | Server-side Remotion rendering on RunPod. This is the most technically complex table-stakes feature. |
| Preview/playback in browser | Users need to see what the video looks like before exporting. BigMotion, Canva, all have in-browser preview. | Medium | Remotion Player component handles this. Real-time preview of the composition. |
| Template/style system | Every competitor offers templates -- different visual styles, layouts, color schemes. Users pick a "look" before generating. | Medium | Pre-built Remotion compositions with different layouts, fonts, color palettes. Need 5-10 at launch minimum. |
| Project save/load | Users create multiple slideshows. Every competitor has a project dashboard. Without this, work is lost. | Medium | Database-backed project persistence. CRUD for projects. |
| Auto-generated slide text (hook, body, CTA) | BigMotion specifically generates hook text, body copy, and closing CTA. This is core to the "AI" value prop. | Medium | Claude API generates structured slide content from prompt. |

## Differentiators

Features that would set this product apart. Not expected by default, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Instant generation speed (under 10 seconds to preview) | Most competitors take 30-60 seconds. Instant preview while rendering MP4 in background would feel magical. | Medium | Remotion Player can preview compositions instantly without rendering to MP4. Generate content fast, show preview immediately, render MP4 async. |
| Smart hook generation optimized for TikTok | BigMotion generates generic hooks. A tool that understands TikTok-specific hook patterns (curiosity gaps, pattern interrupts, POV hooks) would stand out. | Low | Prompt engineering on Claude API. Low technical complexity, high value. |
| One-click style variations | Generate the same content in 3-4 different visual styles simultaneously so users can A/B test. | Medium | Run same content through multiple templates, show side-by-side. |
| Slide-level AI regeneration | Regenerate just one slide's text or image query without redoing the whole slideshow. | Low | Targeted Claude API call for single slide. Very high UX value. |
| Brand kit (saved colors, fonts, logo) | Lumen5 Pro and Canva have brand kits. For repeat creators, this saves massive time. | Medium | Store brand assets (colors, fonts, logo) per user. Apply to templates on generation. |
| Aspect ratio variants (9:16, 1:1, 16:9) | Generate for TikTok, then one-click resize for Instagram square or YouTube. Canva does this well. | Medium | Re-layout the same content for different aspect ratios. Remotion supports this but templates need responsive layouts. |
| Content calendar / batch generation | Generate 7 or 30 days of content from a single topic list. BigMotion has auto-posting but not batch creation from a content plan. | High | Requires queue system, bulk generation, storage for many projects. |
| Analytics-informed templates | Track which template styles get the most engagement (if auto-posting added later). Surface "top performing" styles. | High | Requires analytics pipeline. Defer to v2+. |
| Keyboard shortcuts for editor | Power users (content creators making 5+ videos/day) want speed. Most AI video tools have poor keyboard support. | Low | Standard shortcuts for common actions. Low effort, high power-user satisfaction. |
| Undo/redo in editor | Surprisingly missing from many AI video tools. Essential for confident editing. | Medium | State management with history stack. |

## Anti-Features

Features to explicitly NOT build. These add complexity without proportional value, or actively harm the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI-generated images (DALL-E, Flux, Midjourney) | Massive API cost per image. Stock photos are free and look more natural for slideshow content. AI images often look uncanny for product/lifestyle content. InVideo and Pictory use stock, not AI images, for slideshows. | Use Pexels/Unsplash stock photos. Add AI image generation as a premium v2 feature if demand warrants. |
| Auto-posting to TikTok/Instagram | Complex OAuth flows, platform API changes frequently, TikTok API access is restricted. BigMotion has this but it is a whole product surface unto itself. | Export MP4. Users upload manually. Revisit in v2 when core product is validated. |
| AI avatars / talking heads | Pictory and Synthesia offer this but it is a completely different product category. Slideshow content is faceless by design. Adding avatars fragments the product identity. | Stay focused on faceless slideshow content. This is the target niche. |
| Real-time collaboration | Google Docs-style multiplayer editing is massive engineering effort. Target user is a solo creator, not a team. | Single-user editing. Project sharing via export. |
| Video clip support (mixing video + images) | Doubles the complexity of the editor, timeline, and rendering pipeline. Slideshows are image-based by definition. | Images only for v1. If users request video clips heavily, add in v2. |
| Music/audio integration in v1 | Audio sync, music licensing, volume controls, beat matching -- each is a rabbit hole. TikTok adds music natively when posting. | Let TikTok/Reels handle music. Export silent video. Add background music selection in v2 as a quick win. |
| AI voiceover / text-to-speech | InVideo and Pictory have this, but for TikTok slideshows specifically, users add voiceover in TikTok itself or use trending sounds. Building TTS adds API cost and complexity. | Defer to v2. TikTok's native voiceover is what creators use anyway. |
| Free tier with watermark | Watermarked exports are the #1 complaint about Lumen5 free tier. Creates negative brand association. | Use usage limits (number of exports/month) instead of watermarks if monetizing. |
| Complex timeline editor | Canva Video 2.0 and traditional NLEs have complex timelines. This is a slideshow tool, not a video editor. A timeline adds cognitive load that conflicts with "type and get a video." | Keep it slide-based, not timeline-based. Each slide has a duration, transitions happen between slides. Simple. |

## Feature Dependencies

```
Text prompt generation --> Slide editor (must generate before you can edit)
Slide editor --> Preview (must have slides to preview)
Preview --> MP4 export (preview composition is what gets rendered)
Template system --> Text prompt generation (templates define layout for generated content)
Stock image search --> Slide editor (swap images within editor)
User image uploads --> Slide editor (use uploaded images in slides)
Project save/load --> All editing features (persist state)
User auth --> Project save/load (know whose projects are whose)
Brand kit --> Template system (brand kit overrides template defaults)
```

## MVP Recommendation

**Prioritize (Phase 1 -- core loop):**
1. Text prompt to slideshow generation (Claude API) -- THE feature
2. Template/style system (3-5 templates minimum) -- needed for generation
3. 9:16 vertical output -- non-negotiable for target market
4. In-browser preview -- users must see result immediately
5. Basic slide editor (reorder, add, delete slides)
6. Text overlay editing (edit copy on each slide)
7. Stock image search and swap (Pexels API)
8. MP4 export (RunPod + Remotion)

**Prioritize (Phase 2 -- editing polish):**
1. User image uploads
2. Transition effects (5 core transitions)
3. Text animations
4. Project save/load with user auth
5. Undo/redo
6. Slide-level AI regeneration

**Prioritize (Phase 3 -- differentiation):**
1. Brand kit
2. Smart TikTok hook generation
3. One-click style variations
4. Aspect ratio variants
5. Keyboard shortcuts
6. More templates (10-20 total)

**Defer indefinitely:**
- Auto-posting: Complex, fragile, TikTok API restrictions
- AI images: Cost prohibitive, stock is better for this use case
- AI voiceover: TikTok handles this natively
- Video clips: Out of scope for slideshow product
- AI avatars: Different product category entirely

## Critical Insight: TikTok Platform Risk

As of 2025-2026, TikTok is actively disincentivizing passive slideshow-style commerce content. Posting 5+ non-interactive shop videos in 7 days triggers a posting cap. This means:

- **Slideshows for educational/entertainment content remain strong** -- the restriction targets low-effort commerce spam
- **Quality and engagement matter more than volume** -- the product should optimize for compelling hooks and content, not just fast generation
- **This validates the "AI-powered quality" angle** -- generic template spam will be penalized; well-crafted AI-generated content with good hooks stands out

## Sources

- [BigMotion AI Slideshow Video Maker](https://www.bigmotion.ai/tools/slideshow-video-maker)
- [BigMotion AI TikTok Slideshow Maker](https://www.bigmotion.ai/tools/slideshow)
- [BigMotion Product Hunt](https://www.producthunt.com/products/bigmotion-ai-slideshow)
- [Lumen5 AI Video Generator Features](https://lumen5.com/features/ai-video-generator)
- [InVideo AI Video Generator](https://invideo.io/make/ai-video-generator/)
- [InVideo AI Review 2026](https://max-productive.ai/ai-tools/invideo-ai/)
- [Pictory All Features](https://pictory.ai/all-features)
- [Canva AI Video Generator](https://www.canva.com/features/ai-video-generator/)
- [Pippit AI Slideshow Video Maker](https://www.pippit.ai/create/slideshow-video-maker)
- [Shopify: TikTok Slideshow 2026 Guide](https://www.shopify.com/blog/how-to-make-a-slideshow-on-tiktok)
- [TikTok Updates 2026](https://disruptmarketing.co/blog/tiktok-updates/)
- [Synthesia Brand Kits](https://docs.synthesia.io/docs/brand-kits)
- [AI Studios Brand Kit](https://www.aistudios.com/features/brand-kit)
