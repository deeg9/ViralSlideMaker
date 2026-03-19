# Domain Pitfalls

**Domain:** AI-powered TikTok slideshow/video creator (Next.js + Remotion + Claude API + Pexels + RunPod)
**Researched:** 2026-03-19

## Critical Pitfalls

Mistakes that cause rewrites, major cost overruns, or product failure.

---

### Pitfall 1: Remotion Docker Container Misconfiguration on RunPod

**What goes wrong:** Remotion requires headless Chromium, FFmpeg, and specific shared libraries (libnss3, libdbus-1-3, libatk-bridge2.0-0, etc.) to render video. Developers build a Docker image, deploy to RunPod, and get cryptic "Failed to launch Chrome" errors. The container works locally on macOS but fails on RunPod's Linux environment.

**Why it happens:** Remotion's rendering stack is ~150MB+ with Chromium alone. Docker images based on minimal bases (Alpine, slim variants) are missing required system libraries. Emoji fonts are not included by default on Debian/Ubuntu Docker images. GPU passthrough requires additional configuration.

**Consequences:** Days lost debugging container issues. Renders silently produce corrupted output or crash. Users see failed exports with no clear error.

**Prevention:**
- Use `node:22-bookworm-slim` as the base image (Remotion's official recommendation as of Nov 2024)
- Install ALL required shared libraries explicitly -- follow Remotion's Docker docs to the letter
- Install emoji fonts (`fonts-noto-color-emoji`) in the container
- Use `swangle` as the GL renderer backend (default since Remotion v3.0.8) to avoid the `angle` memory leak
- Test the exact Docker image on RunPod before building any application logic on top of it
- Keep container image under 20GB to avoid RunPod cold start spikes to 30+ seconds

**Detection:** Renders fail with "Failed to launch Chrome," produce black frames, or crash with OOM errors during testing.

**Phase:** Must be solved in Phase 1 (infrastructure). The entire product depends on reliable rendering. Do NOT build the editor UI until you have a working RunPod render pipeline producing actual MP4 output.

**Confidence:** HIGH -- based on Remotion official docs and RunPod documentation.

---

### Pitfall 2: No Async Job Architecture From Day One

**What goes wrong:** Developers wire up video rendering as a synchronous API call: user clicks "Export," frontend sends request, waits for response with the MP4 URL. This works for 5-second test videos but fails catastrophically for real slideshows (30-90 seconds of video = 2-10 minutes of rendering). HTTP requests time out. Users refresh the page and lose their render. Multiple users trigger duplicate renders.

**Why it happens:** It is natural to start with request/response patterns. Async job queues feel like premature optimization.

**Consequences:** Broken exports, duplicate renders burning GPU credits, terrible UX with users staring at a spinner that eventually times out, no way to show progress.

**Prevention:**
- Design the render pipeline as async from day one: API endpoint accepts render request, returns a job ID immediately
- Store job status in database (queued, rendering, complete, failed)
- Frontend polls job status (or uses WebSocket/SSE for real-time updates)
- RunPod serverless already returns a job ID -- use their async endpoint pattern, not the synchronous `/run` endpoint
- Implement a webhook callback from RunPod to update job status server-side
- Show progress UI: "Preparing... Rendering frame 45/120... Encoding... Done!"

**Detection:** If your render endpoint has a response time over 30 seconds, you have this problem.

**Phase:** Must be part of Phase 1 architecture. Retrofitting async into a sync architecture is a rewrite.

**Confidence:** HIGH -- this is a universal pattern for video rendering SaaS.

---

### Pitfall 3: Remotion License Surprise at Scale

**What goes wrong:** Developer builds the product as an individual (free license), gets traction, hires employees or incorporates, and suddenly needs a company license. The free tier only covers individuals, companies with up to 3 employees, and nonprofits. Once you exceed 3 employees in a for-profit entity, you need a paid license.

**Why it happens:** Remotion's license is not MIT/Apache. It uses a custom "Remotion License" that restricts commercial use above a threshold. Developers assume "free for individuals" means "free forever."

**Consequences:** Unexpected cost when scaling. Potentially need to relicense or find alternatives mid-product. Remotion 5.0 is changing license terms (details TBD), adding uncertainty.

**Prevention:**
- Read the full LICENSE.md on GitHub before committing to Remotion
- Budget for a company license from the start if planning SaaS
- Contact hi@remotion.dev early to understand pricing for your use case
- Keep Remotion as a rendering layer with clean abstraction so it could theoretically be replaced (unlikely, but good architecture practice)
- Check remotion.pro for current pricing

**Detection:** You incorporated or hired employee #4. Check license terms before that happens.

**Phase:** Awareness in Phase 1. Financial planning before any public launch.

**Confidence:** HIGH -- directly from Remotion's official license page.

---

### Pitfall 4: AI-Generated Slide Content That Feels Generic and Robotic

**What goes wrong:** Claude generates slide text that is technically correct but reads like AI slop -- generic hooks ("Did you know...?"), overused transitions, corporate-sounding body copy. Every slideshow sounds the same. Users cannot tell their content apart from anyone else's. TikTok audiences scroll past instantly.

**Why it happens:** Default Claude prompts without examples, tone constraints, or platform-specific context produce median-quality output. Developers test with a few prompts, think "good enough," and ship. They don't test against real TikTok content that performs well.

**Consequences:** The core value proposition fails. Users can write better slides themselves, so why use the tool? Low engagement on posted content reflects poorly on the product.

**Prevention:**
- Study high-performing TikTok slideshows manually. Collect 20-30 examples of hooks, transitions, and CTAs that actually work
- Build these into the system prompt as few-shot examples
- Use Claude's structured output (JSON mode) to enforce consistent slide structure
- Add tone/style parameters: "casual," "provocative," "educational," "luxury" -- not just one default voice
- Constrain text length per slide (TikTok slides should have 5-15 words max per overlay, not paragraphs)
- Include a "regenerate" button per-slide so users can iterate on individual slides
- Test output quality against real TikTok slideshows before shipping
- Since Claude 4.x takes instructions literally, be extremely specific in prompts -- show examples, specify exact word counts, define what "engaging" means concretely

**Detection:** Generate 20 slideshows on different topics. If you cannot distinguish them by voice/style, or if they all start with "Did you know," the prompts need work.

**Phase:** Core to Phase 2 (AI content generation). Invest heavily in prompt engineering and iteration. This is the product.

**Confidence:** HIGH -- based on Claude API best practices and AI content generation patterns.

---

### Pitfall 5: Chromium Memory Leak Crashing Long Renders

**What goes wrong:** Rendering a 60-90 second slideshow (the sweet spot for TikTok) at 30fps means rendering 1800-2700 frames through headless Chromium. Chrome has documented memory leaks in certain GL renderer backends that accumulate over long renders, eventually causing OOM kills on the RunPod worker.

**Why it happens:** Chrome's `angle` GL backend had a memory leak (documented in Remotion changelog). Even with `swangle` (the fix), very long renders in constrained container environments can exhaust memory. RunPod serverless workers have fixed memory allocations.

**Consequences:** Renders fail silently or produce partial videos. Users wait 5+ minutes for a render that crashes at 80%. GPU credits are burned with nothing to show.

**Prevention:**
- Use `swangle` GL backend (Remotion default since v3.0.8)
- Set `enforceAudioTrack: false` and `logLevel: 'verbose'` during development to catch issues early
- Use Remotion's `--enforce-audio-track=false` and memory-efficient rendering mode (`--disable-web-security` only if needed)
- For longer videos, consider splitting into segments and concatenating
- Monitor memory usage in RunPod workers -- set up alerts before OOM
- Choose a RunPod GPU tier with sufficient RAM (not just GPU VRAM, but system RAM)
- Set Remotion concurrency to match available CPU cores -- too high and you OOM, too low and renders are needlessly slow
- Implement render timeouts with cleanup -- if a render exceeds 5 minutes, kill it and retry once

**Detection:** Renders that succeed for 10-slide decks but fail for 15+ slides. OOM errors in RunPod logs.

**Phase:** Phase 1 (infrastructure). Test with maximum-length slideshows before moving on.

**Confidence:** HIGH -- documented in Remotion changelog and GitHub issues.

---

## Moderate Pitfalls

---

### Pitfall 6: Pexels API Rate Limits and Image Relevance

**What goes wrong:** The Pexels API has a default rate limit of 200 requests/hour and 20,000 requests/month. During development this seems fine, but in production each slideshow generation may trigger 5-10 image searches (one per slide), and image swaps add more. A modest 100 users/day exhausts the monthly limit in a week. Additionally, Pexels search results for specific queries (e.g., "morning routine productivity") often return irrelevant stock photos.

**Prevention:**
- Cache Pexels API responses aggressively -- image URLs are stable, cache search results for 24-48 hours
- Request increased limits from Pexels (free if you provide attribution) early, before hitting the wall
- Use the `per_page=80` max to reduce total API calls
- Build a fallback: if Pexels returns poor results, surface this to the user rather than showing irrelevant images
- Have Claude generate multiple search query variants per slide to improve hit rate
- Consider adding Unsplash as a fallback API (different rate limits, similar quality)
- Store user-selected images to build a local library over time

**Detection:** Monitor API usage weekly. Test edge-case queries ("niche hobby name" or abstract concepts) -- if results are garbage, you need query refinement.

**Phase:** Phase 2 (content pipeline). Rate limit handling and caching should be built into the image service from the start.

**Confidence:** HIGH -- directly from Pexels API documentation.

---

### Pitfall 7: Pexels License Violations in a SaaS Context

**What goes wrong:** Pexels images are free for commercial use, but with restrictions developers often miss. You cannot sell Pexels content "as-is" or "standalone" -- meaning a slideshow that is just stock photos with minimal text overlay could be considered standalone redistribution. You also cannot use the API for ML/AI training data collection, and you cannot replicate Pexels' core functionality (a stock photo search engine).

**Prevention:**
- Ensure slideshows always add meaningful creative transformation (text overlays, transitions, branding) -- this is naturally part of the product, but be aware of the legal line
- Do NOT cache and serve Pexels images as a browsable gallery separate from slideshow creation (this could be seen as replicating core functionality)
- Add Pexels attribution somewhere in the app (not required per image, but showing "Photos by Pexels" in the app helps maintain good standing and may get you unlimited API access)
- Do not use Pexels images to train any AI models
- Review Pexels ToS quarterly -- terms change

**Detection:** If your product ever lets users download individual stock photos without them being part of a slideshow, you are likely in violation.

**Phase:** Phase 2 (image integration). Legal review before public launch.

**Confidence:** MEDIUM -- based on Pexels API documentation and help center articles. Specific SaaS use cases may need legal review.

---

### Pitfall 8: RunPod Cold Start Destroying UX

**What goes wrong:** RunPod serverless scales to zero (that is the selling point -- no idle cost). But when a user clicks "Export" and no workers are warm, cold start adds 6-30 seconds before rendering even begins. For a large Docker image (Chromium + FFmpeg + Remotion + fonts = potentially 5-10GB), cold start can be brutal. Users think the export is broken.

**Prevention:**
- Keep the Docker image as small as possible (multi-stage builds, minimal base image, no dev dependencies)
- Use RunPod's FlashBoot (reduces cold starts to 500ms-2s for optimized images)
- Set `min_workers: 1` during business hours if usage is predictable (active workers cost up to 30% less than flex)
- Show users a "Preparing render environment..." state distinct from actual rendering progress
- Pre-warm workers with a health check cron job if scale-to-zero is essential for cost
- Consider a "render queue" UX where users can close the page and get notified (email/push) when the video is ready

**Detection:** Time from "Export" click to first render progress update. If consistently over 10 seconds, cold start is the bottleneck.

**Phase:** Phase 1 (infrastructure), refined in Phase 3 (UX polish).

**Confidence:** HIGH -- based on RunPod documentation and FlashBoot announcement.

---

### Pitfall 9: Building the Slide Editor Before Nailing the Data Model

**What goes wrong:** Developers jump into building a drag-and-drop slide editor UI with complex state management, then realize the data model does not support undo/redo, does not map cleanly to Remotion compositions, or cannot represent all the slide variations they need. The editor gets rebuilt 2-3 times.

**Prevention:**
- Define the slideshow data model FIRST, completely independent of UI
- The model must support: ordered slides, per-slide text (position, style, animation), per-slide image (source, crop, fit), per-slide timing/duration, global transitions, global style/theme
- Ensure the data model maps 1:1 to Remotion composition props -- render a video from JSON before building any editor
- Use a reducer pattern (useReducer) for editor state from day one -- this naturally enables undo/redo later
- Test the data model by round-tripping: create JSON -> render video -> verify output matches expectations
- Do not couple editor state to UI component state -- keep a single source of truth

**Detection:** If you cannot export the current editor state as JSON and render a video from that JSON without the editor, your data model is not clean enough.

**Phase:** Phase 1 (data model design), Phase 2 (editor implementation).

**Confidence:** HIGH -- standard software architecture principle applied to this specific domain.

---

### Pitfall 10: Preview/Render Parity Gap

**What goes wrong:** The in-browser preview (using Remotion Player) looks different from the rendered MP4 output. Text wraps differently, fonts render differently between browser and headless Chromium, image scaling behaves differently, transitions have different timing. Users tweak their slideshow to perfection in the editor, export, and the result looks wrong.

**Prevention:**
- Use the EXACT same Remotion composition for both preview and render -- do not maintain two rendering paths
- Bundle custom fonts in the Docker container AND load them in the browser preview
- Use web-safe or Google Fonts that render consistently across environments
- Test preview vs render output side-by-side for every new feature (text styles, transitions, image treatments)
- Pin Chromium version in Docker to match what Remotion Player uses
- Avoid CSS features that vary across rendering contexts (flexbox edge cases, certain text-shadow implementations)

**Detection:** Export 10 slideshows and visually compare each frame of the preview to the render. Any discrepancy is a bug.

**Phase:** Phase 2 (editor + rendering integration). Must be validated before shipping to users.

**Confidence:** HIGH -- this is the most commonly reported frustration in Remotion community discussions.

---

### Pitfall 11: Premature Cross-Platform Architecture for iOS

**What goes wrong:** Developers structure the entire v1 web app around future React Native compatibility -- using `react-native-web` primitives, avoiding web-specific APIs, setting up Turborepo monorepo, adding Solito for navigation. This adds weeks of complexity to v1 for a mobile app that may never ship (product-market fit not validated yet).

**Prevention:**
- Build v1 as a pure Next.js web app with NO React Native considerations
- Use standard web technologies (HTML, CSS, Tailwind, native browser APIs)
- Keep business logic in plain TypeScript functions and hooks (not tied to React components) -- this is naturally portable
- Keep the Remotion composition layer separate from the UI layer -- this is the actually reusable part
- When/if iOS becomes real, THEN set up the monorepo and port the UI layer
- The slide data model, API client, and AI prompts are already portable without any special architecture

**Detection:** If you find yourself writing `Platform.OS === 'web'` checks or importing from `react-native` in your v1 web app, you are over-engineering.

**Phase:** v1 should ignore mobile entirely. Revisit in v2 planning only after validating product-market fit.

**Confidence:** HIGH -- Expo monorepo docs explicitly warn about complexity, and the project brief says iOS is out of scope for v1.

---

## Minor Pitfalls

---

### Pitfall 12: Not Enforcing 9:16 Aspect Ratio Throughout the Pipeline

**What goes wrong:** Images from Pexels come in various aspect ratios. Developers display them in the editor at their native aspect ratio, but the Remotion composition forces 9:16. The editor shows one thing, the render shows another (cropped, letterboxed, or stretched images).

**Prevention:**
- Request portrait-oriented images from Pexels using the `orientation=portrait` parameter
- Always display images in the editor within a 9:16 container with `object-fit: cover` -- never show them at native aspect ratio
- Allow users to adjust image position/crop within the 9:16 frame
- Validate this for user-uploaded images too (they will upload landscape photos)

**Phase:** Phase 2 (editor implementation).

**Confidence:** HIGH.

---

### Pitfall 13: Ignoring Claude API Cost at Scale

**What goes wrong:** Each slideshow generation makes 1-3 Claude API calls (content generation, image query generation, potential regenerations). At $3/MTok input and $15/MTok output for Claude Sonnet, costs seem negligible in development. But with 1000 users generating 5 slideshows/day with regenerations, costs can reach $500-2000/month just for AI.

**Prevention:**
- Use Claude Haiku for simple tasks (image search query generation) and Sonnet only for creative content
- Cache AI-generated content for common/trending topics
- Set token limits on outputs (slideshow content should be <500 tokens)
- Track per-user AI usage and set reasonable limits
- Consider pre-generating template content for popular categories

**Phase:** Phase 2 (AI integration), monitored from launch.

**Confidence:** MEDIUM -- costs depend heavily on usage patterns and prompt design.

---

### Pitfall 14: No Error Recovery for Failed Renders

**What goes wrong:** A render fails (OOM, timeout, network error fetching an image, RunPod worker crash) and the user gets a generic "Export failed" error. They re-enter all their settings and try again. Or worse, the frontend shows "Rendering..." forever because the webhook/polling never gets a failure signal.

**Prevention:**
- Implement render job timeouts (max 10 minutes, then mark as failed)
- Store all slideshow state server-side so retry is one click
- Implement automatic retry (once) for transient failures
- Show specific error messages: "Image could not be loaded" vs "Render timed out" vs "Service temporarily unavailable"
- Ensure the polling/webhook mechanism handles ALL terminal states (success, failure, timeout)
- Log render failures with full context for debugging

**Phase:** Phase 1 (infrastructure), Phase 3 (UX polish).

**Confidence:** HIGH.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Infrastructure | Docker/RunPod setup (#1), cold starts (#8), sync rendering (#2) | Validate the full render pipeline end-to-end before any UI work. Prove: JSON in -> MP4 out on RunPod. |
| Phase 1: Data Model | Editor state not mapping to Remotion (#9) | Define the slideshow JSON schema first, render from it, then build the editor. |
| Phase 2: AI Content | Generic AI output (#4), Claude cost (#13) | Invest 2-3x more time in prompt engineering than you think you need. Use few-shot examples from real TikTok content. |
| Phase 2: Images | Pexels rate limits (#6), license issues (#7), aspect ratio (#12) | Build caching from day one. Always display in 9:16 context. |
| Phase 2: Editor + Render | Preview/render parity (#10) | Same composition for both. Test side-by-side constantly. |
| Phase 3: Scale/Polish | Cold start UX (#8), failed renders (#14) | Async job UX with progress and error states. FlashBoot or min_workers. |
| v2: iOS | Premature cross-platform (#11) | Do not architect v1 for mobile. Keep business logic in plain TypeScript. |
| Growth: Licensing | Remotion license (#3) | Budget for company license before hiring beyond 3 people. |

## Sources

- [Remotion Docker Guide](https://www.remotion.dev/docs/docker) -- Official containerization docs
- [Remotion License](https://www.remotion.dev/docs/license) -- Free tier thresholds and company license requirements
- [Remotion Chromium Flags](https://www.remotion.dev/docs/chromium-flags) -- GL renderer backends and memory leak history
- [Remotion SSR Comparison](https://www.remotion.dev/docs/compare-ssr) -- Server-side rendering options compared
- [RunPod Serverless Optimization](https://docs.runpod.io/serverless/development/optimization) -- Cold start mitigation
- [RunPod FlashBoot Announcement](https://www.runpod.io/blog/introducing-flashboot-serverless-cold-start) -- Sub-second cold starts
- [RunPod Endpoint Configuration](https://docs.runpod.io/serverless/references/endpoint-configurations) -- Active vs flex workers
- [Pexels API Documentation](https://www.pexels.com/api/documentation/) -- Rate limits (200/hr, 20K/month)
- [Pexels Rate Limit Guidance](https://help.pexels.com/hc/en-us/articles/900006470063-What-steps-can-I-take-to-avoid-hitting-the-rate-limit) -- Caching and pagination strategies
- [Claude Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) -- Structured output and prompt engineering
- [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- JSON mode for reliable content generation
- [Remotion Docker Template](https://www.scotthavird.com/blog/remotion-docker-template/) -- Production Docker setup guide
- [Expo Monorepo Guide](https://docs.expo.dev/guides/monorepos/) -- Cross-platform monorepo complexity warnings
- [CrePal Remotion Docker Guide](https://crepal.ai/blog/aivideo/blog-how-to-run-remotion-in-docker/) -- CPU limits, permissions, fonts in Docker
