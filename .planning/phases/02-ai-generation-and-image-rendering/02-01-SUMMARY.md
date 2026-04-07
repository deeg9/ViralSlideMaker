---
phase: 02-ai-generation-and-image-rendering
plan: 01
subsystem: ai, api, rendering
tags: [anthropic-sdk, claude, pexels, zod, structured-outputs, html-templates, vitest]

# Dependency graph
requires:
  - phase: 01-foundation-and-auth/02
    provides: Projects table with slide_data jsonb column, CRUD server actions, Supabase client helpers
provides:
  - Zod schemas for Claude structured output (CarouselSchema, SlideContentSchema)
  - generateSlideContent() function calling Claude with structured outputs
  - searchPhotos() Pexels wrapper with portrait orientation
  - 5 visual templates (bold-minimal, dark-gradient, soft-pastel, neon-pop, clean-serif)
  - buildSlideHtml() producing 1080x1920 HTML with text overlays and escaping
  - Slide/SlideData/GenerationStatus types replacing unknown[] in Project
  - generateCarousel server action orchestrating full pipeline
  - SQL migration for template_id, topic, generation_status columns
affects:
  - 02-02 (rendering will use templates and buildSlideHtml)
  - all subsequent phases (slide data structure is now defined)

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk (Claude API with structured outputs)"
    - "pexels (official Pexels JS client)"
    - "node-html-to-image (HTML-to-PNG rendering)"
    - "jszip (ZIP file creation)"
    - "file-saver (browser file download trigger)"
    - "zod (schema validation for Claude structured outputs)"
  patterns:
    - "Claude structured outputs with Zod: zodOutputFormat(CarouselSchema) -> messages.parse()"
    - "Template system: SlideTemplate interface with CSS properties, registry with getTemplate(id)"
    - "HTML template builder: buildSlideHtml(slide, template) -> full HTML document"
    - "Server action orchestration: Claude generate -> Pexels fetch -> DB save -> revalidate"

key-files:
  created:
    - src/lib/types/slide.ts
    - src/lib/ai/schemas.ts
    - src/lib/ai/prompts.ts
    - src/lib/ai/generate-slides.ts
    - src/lib/pexels/search-photos.ts
    - src/lib/render/templates/index.ts
    - src/lib/render/templates/bold-minimal.ts
    - src/lib/render/templates/dark-gradient.ts
    - src/lib/render/templates/soft-pastel.ts
    - src/lib/render/templates/neon-pop.ts
    - src/lib/render/templates/clean-serif.ts
    - src/lib/render/render-slide.ts
    - src/app/(dashboard)/project/[id]/actions.ts
    - supabase/migrations/002_add_template_and_topic.sql
    - src/__tests__/ai/generate-slides.test.ts
    - src/__tests__/ai/prompts.test.ts
    - src/__tests__/render/templates.test.ts
  modified:
    - src/lib/types/project.ts
    - package.json

key-decisions:
  - "Used claude-sonnet-4-5-20250514 model for content generation -- best balance of speed, cost, and quality"
  - "Templates defined as typed CSS property objects, not React components -- simpler, portable, works in both preview and server render"
  - "HTML escaping applied to all user-generated text in slide HTML to prevent XSS"
  - "Pexels photos fetched in parallel with Promise.all for all slides in a carousel"

patterns-established:
  - "Pattern: SlideTemplate interface defines all CSS properties for a template"
  - "Pattern: getTemplate(id) with bold-minimal as default fallback"
  - "Pattern: buildSlideHtml(slide, template) produces self-contained HTML document at 1080x1920"
  - "Pattern: generateCarousel server action manages generation_status lifecycle (generating -> complete/error)"

requirements-completed: [AIGEN-01, AIGEN-02, AIGEN-03, TMPL-01, TMPL-02, REND-01]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 02 Plan 01: AI Generation, Templates, and Slide Pipeline Summary

**Claude structured outputs with Zod schemas generate TikTok carousel content, Pexels provides portrait backgrounds, 5 CSS-driven templates define visual styles, and buildSlideHtml produces 1080x1920 slide HTML**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T22:18:04Z
- **Completed:** 2026-03-19T22:22:27Z
- **Tasks:** 2 (1 TDD + 1 auto)
- **Files modified:** 19 files (17 created, 2 modified)

## Accomplishments

- Complete AI content generation pipeline: Claude structured outputs with Zod validation produce typed carousel slide data from a text prompt
- Pexels photo integration fetches portrait-oriented background images for each slide
- 5 visual templates (bold-minimal, dark-gradient, soft-pastel, neon-pop, clean-serif) with full CSS property definitions
- HTML template builder produces 1080x1920 slide documents with text overlays, overlay colors, and HTML escaping
- generateCarousel server action orchestrates the full pipeline: Claude -> Pexels -> DB save with error handling and status tracking
- 12 unit tests covering schemas, prompts, templates, HTML output, and API mocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, define types/schemas, build templates and AI/Pexels integrations** - `8c26b09` (feat, TDD)
2. **Task 2: Build generateCarousel server action** - `daf28a2` (feat)

## Files Created/Modified

- `src/lib/types/slide.ts` - Slide, SlideData, GenerationStatus types
- `src/lib/types/project.ts` - Updated Project interface with Slide[] and template/status fields
- `src/lib/ai/schemas.ts` - Zod schemas: SlideContentSchema, CarouselSchema with min(3)/max(10) validation
- `src/lib/ai/prompts.ts` - System prompt with 6 TikTok hook patterns and slide structure rules
- `src/lib/ai/generate-slides.ts` - generateSlideContent() using Claude claude-sonnet-4-5-20250514 structured outputs
- `src/lib/pexels/search-photos.ts` - searchPhotos() wrapper with portrait default, ErrorResponse handling
- `src/lib/render/templates/index.ts` - SlideTemplate interface, templates registry, getTemplate() helper
- `src/lib/render/templates/bold-minimal.ts` - White on dark, Inter 900, uppercase, center/center
- `src/lib/render/templates/dark-gradient.ts` - White text, dark gradient 0.7, left/bottom
- `src/lib/render/templates/soft-pastel.ts` - Dark text on light overlay, Georgia serif, center/center
- `src/lib/render/templates/neon-pop.ts` - White with neon accent, high contrast 0.75, center/center
- `src/lib/render/templates/clean-serif.ts` - Dark text, white overlay 0.9, Georgia, left/top
- `src/lib/render/render-slide.ts` - buildSlideHtml() with 1080x1920 body, overlay, escaping, Google Fonts
- `src/app/(dashboard)/project/[id]/actions.ts` - generateCarousel server action with full pipeline
- `supabase/migrations/002_add_template_and_topic.sql` - Adds template_id, topic, generation_status columns
- `src/__tests__/ai/generate-slides.test.ts` - Tests for Claude API call, Pexels call, Zod schemas
- `src/__tests__/ai/prompts.test.ts` - Tests for hook pattern presence in system prompt
- `src/__tests__/render/templates.test.ts` - Tests for template registry, HTML builder output
- `package.json` - Added 6 production + 1 dev dependency

## Decisions Made

- Used `claude-sonnet-4-5-20250514` model -- best balance of speed, cost, and quality for content generation (not complex enough for Opus)
- Templates are plain TypeScript objects with CSS properties, not React components -- simpler, portable, works in both client preview and server render
- HTML escaping applied to all user text in slide HTML to prevent XSS injection
- Pexels photos fetched in parallel via Promise.all for all slides -- acceptable for small carousel sizes (3-10 slides)
- Default template is bold-minimal when invalid ID provided

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Anthropic SDK mock needed class-based constructor pattern (not vi.fn().mockImplementation) since the SDK is instantiated with `new Anthropic()`. Fixed during TDD RED->GREEN cycle.

## User Setup Required

**External services require manual configuration.** Two API keys must be added to `.env.local`:

- `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com/settings/keys)
- `PEXELS_API_KEY` - Get from [Pexels API](https://www.pexels.com/api/new/)

**Database migration** must be run:
- Execute `supabase/migrations/002_add_template_and_topic.sql` in Supabase Dashboard SQL Editor

## Next Phase Readiness

- AI generation pipeline complete and tested -- ready for UI integration in Plan 02-02
- Template system ready for client-side preview components
- buildSlideHtml ready for server-side image rendering via node-html-to-image
- generateCarousel server action ready to wire to generation form UI

## Self-Check: PASSED

All 18 key files verified present. Both task commits (8c26b09, daf28a2) verified in git log. 12/12 tests passing.

---
*Phase: 02-ai-generation-and-image-rendering*
*Completed: 2026-03-19*
