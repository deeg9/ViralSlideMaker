# Phase 2: AI Generation and Image Rendering - Research

**Researched:** 2026-03-19
**Domain:** AI content generation (Claude API), stock photo sourcing (Pexels API), server-side image rendering (Puppeteer), file download (ZIP)
**Confidence:** HIGH

## Summary

Phase 2 transforms the existing project shell into a functional AI-powered carousel generator. The user enters a topic, Claude generates structured slide content (hook, body, image queries, CTA), Pexels provides background photos, and Puppeteer renders final 1080x1920 images server-side. Users choose a visual template before generation and can download individual slides or a ZIP of all slides.

The stack is straightforward: `@anthropic-ai/sdk` with structured outputs (Zod schemas) for reliable JSON from Claude, the official `pexels` npm package for stock photos, `node-html-to-image` (Puppeteer wrapper) for server-side HTML-to-PNG rendering, and `jszip` + `file-saver` for client-side ZIP downloads. All four libraries are mature, well-documented, and TypeScript-friendly.

**Primary recommendation:** Use Claude structured outputs with Zod schemas to get typed slide data, render slides as self-contained HTML templates via `node-html-to-image`, and serve rendered PNGs from Next.js API routes. Keep templates as pure HTML/CSS strings with Handlebars interpolation -- no React rendering on the server side.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIGEN-01 | User enters text prompt, receives complete carousel slides | Claude API structured outputs return typed slide array from a single prompt |
| AIGEN-02 | Claude generates structured content: hook, body, image queries, CTA | Zod schema defines per-slide structure; `messages.parse()` guarantees conformance |
| AIGEN-03 | Hook text uses TikTok-optimized patterns | System prompt engineering with pattern examples (curiosity gaps, POV hooks, etc.) |
| REND-01 | Slides render as 9:16 (1080x1920) images with text overlays baked in | `node-html-to-image` renders HTML at exact pixel dimensions via CSS body sizing |
| REND-02 | Server-side rendering for consistent quality | `node-html-to-image` uses headless Chromium -- identical output regardless of client device |
| REND-03 | Download all slides as ZIP | `jszip` creates ZIP client-side from rendered image URLs; `file-saver` triggers download |
| REND-04 | Download individual slide images | Direct link to API route that returns PNG buffer with `Content-Disposition: attachment` |
| TMPL-01 | Choose from 5-10 visual style templates before generating | Template definitions stored as typed objects with CSS/layout properties; user selects before generation |
| TMPL-02 | Templates define layout, font choices, color palette, text positioning | Template type includes fontFamily, colors, textPosition, overlayOpacity, fontSize ranges |
| UIUX-03 | Slide preview updates in real-time as user edits | Client-side preview component mirrors server template HTML; actual download triggers server render |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.80.0 | Claude API client with structured outputs | Official SDK; `messages.parse()` + Zod gives typed, validated JSON |
| `pexels` | ^1.4.0 | Stock photo search | Official Pexels JS client; TypeScript-native; server + browser |
| `node-html-to-image` | ^3.1.0 | HTML-to-PNG rendering | Wraps Puppeteer; buffer output; Handlebars templating; TypeScript defs |
| `jszip` | ^3.10.1 | ZIP file creation | De facto standard; browser + Node; 6000+ dependents |
| `file-saver` | ^2.0.5 | Trigger file downloads in browser | Companion to JSZip; handles blob-to-download |
| `zod` | ^3.23.0 | Schema definition for Claude structured outputs | Required by `@anthropic-ai/sdk` Zod helpers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/file-saver` | ^2.0.7 | TypeScript types for file-saver | Dev dependency |
| `puppeteer` | ^23.0.0 | Headless Chrome (peer dep of node-html-to-image) | Installed automatically; may need explicit install for version control |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node-html-to-image` | Raw Puppeteer | More control but more boilerplate; node-html-to-image handles page lifecycle |
| `node-html-to-image` | `sharp` with SVG | No CSS support, no web fonts, limited layout -- not viable for styled slides |
| `jszip` (client-side) | Server-side ZIP in API route | Server ZIP is simpler but uses more server memory; client-side is more scalable |
| `pexels` npm | Direct Pexels REST calls | npm package adds convenience but is 3 years old; REST API is stable so either works |

**Installation:**
```bash
npm install @anthropic-ai/sdk pexels node-html-to-image jszip file-saver zod
npm install -D @types/file-saver
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    ai/
      generate-slides.ts       # Claude API call with Zod schema
      prompts.ts                # System prompt and hook patterns
      schemas.ts                # Zod schemas for slide structure
    pexels/
      search-photos.ts          # Pexels API wrapper
    render/
      render-slide.ts           # node-html-to-image rendering
      templates/                # Template HTML strings + configs
        index.ts                # Template registry
        bold-minimal.ts         # Individual template definitions
        dark-gradient.ts
        ...
    types/
      slide.ts                  # Slide, Template, GenerationRequest types
    download/
      zip-slides.ts             # Client-side ZIP creation
  app/
    api/
      generate/
        route.ts                # POST: topic -> structured slide data + Pexels images
      render/
        [slideId]/
          route.ts              # GET: render single slide as PNG
      render-all/
        route.ts                # GET: render all slides for a project, return URLs
    (dashboard)/
      project/
        [id]/
          page.tsx              # Updated: generation form + slide preview grid
  components/
    slides/
      slide-preview.tsx         # Client-side slide preview (CSS, not image)
      slide-grid.tsx            # Grid of all slide previews
      generation-form.tsx       # Topic input + template selector + generate button
      template-picker.tsx       # Visual template selection grid
      download-controls.tsx     # Download individual / ZIP buttons
```

### Pattern 1: Claude Structured Output with Zod
**What:** Define slide structure as a Zod schema, use `messages.parse()` for guaranteed typed JSON
**When to use:** Every Claude API call that returns slide content
**Example:**
```typescript
// src/lib/ai/schemas.ts
import { z } from 'zod'

export const SlideContentSchema = z.object({
  hook_text: z.string().describe('Attention-grabbing hook for this slide'),
  body_text: z.string().describe('Supporting body copy'),
  image_query: z.string().describe('Pexels search query for background image'),
  is_cta: z.boolean().describe('Whether this is the closing CTA slide'),
})

export const CarouselSchema = z.object({
  title: z.string().describe('Carousel title/topic'),
  slides: z.array(SlideContentSchema).min(3).max(10),
})

export type SlideContent = z.infer<typeof SlideContentSchema>
export type Carousel = z.infer<typeof CarouselSchema>
```

```typescript
// src/lib/ai/generate-slides.ts
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { CarouselSchema } from './schemas'
import { buildSystemPrompt } from './prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function generateSlideContent(topic: string) {
  const response = await client.messages.parse({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: `Create a TikTok carousel about: ${topic}` }],
    output_config: { format: zodOutputFormat(CarouselSchema) },
  })

  return response.parsed_output // Typed as Carousel
}
```
**Source:** [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

### Pattern 2: Server-Side Image Rendering via API Route
**What:** Next.js API route receives slide data, renders HTML template with node-html-to-image, returns PNG buffer
**When to use:** Download and final image generation
**Example:**
```typescript
// src/app/api/render/[slideId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import nodeHtmlToImage from 'node-html-to-image'
import { createClient } from '@/lib/supabase/server'
import { buildSlideHtml } from '@/lib/render/render-slide'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slideId: string }> }
) {
  const { slideId } = await params
  // Fetch slide data from database
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('slide_data, template_id')
    .eq('id', slideId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Render slide as image
  const html = buildSlideHtml(project.slide_data, project.template_id)
  const imageBuffer = await nodeHtmlToImage({
    html,
    type: 'png',
    puppeteerArgs: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  })

  return new NextResponse(imageBuffer as Buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="slide-${slideId}.png"`,
    },
  })
}
```

### Pattern 3: Template System as Typed Objects
**What:** Templates are plain TypeScript objects defining CSS properties, not React components
**When to use:** All template definitions
**Example:**
```typescript
// src/lib/render/templates/index.ts
export interface SlideTemplate {
  id: string
  name: string
  thumbnail: string  // Static preview image path
  fontFamily: string
  hookFontSize: string
  bodyFontSize: string
  textColor: string
  backgroundColor: string
  overlayColor: string    // Semi-transparent overlay on background image
  overlayOpacity: number
  textAlign: 'left' | 'center' | 'right'
  textPosition: 'top' | 'center' | 'bottom'
  hookStyle: 'uppercase' | 'normal' | 'italic'
}

export const templates: SlideTemplate[] = [
  {
    id: 'bold-minimal',
    name: 'Bold Minimal',
    thumbnail: '/templates/bold-minimal.png',
    fontFamily: "'Inter', sans-serif",
    hookFontSize: '72px',
    bodyFontSize: '36px',
    textColor: '#ffffff',
    backgroundColor: '#000000',
    overlayColor: '#000000',
    overlayOpacity: 0.6,
    textAlign: 'center',
    textPosition: 'center',
    hookStyle: 'uppercase',
  },
  // ... more templates
]
```

### Pattern 4: Client-Side Preview vs Server-Side Render
**What:** Preview uses CSS-styled divs; final download uses server-rendered PNG
**When to use:** Always -- never render images client-side for download
**Why:** Client-side previews are instant (no API call), but final images must be server-rendered for consistency. The preview component mirrors the template CSS so what you see matches what you get.

### Pattern 5: Generation Flow (Server Action)
**What:** Single server action orchestrates: Claude generate -> Pexels fetch -> save to DB -> return
**When to use:** The "Generate" button click
**Example:**
```typescript
// src/app/(dashboard)/project/[id]/actions.ts
'use server'

import { generateSlideContent } from '@/lib/ai/generate-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateCarousel(projectId: string, topic: string, templateId: string) {
  // 1. Generate content with Claude
  const carousel = await generateSlideContent(topic)

  // 2. Fetch background images from Pexels for each slide
  const slides = await Promise.all(
    carousel.slides.map(async (slide) => {
      const photos = await searchPhotos(slide.image_query, { orientation: 'portrait', per_page: 1 })
      return {
        ...slide,
        background_url: photos[0]?.src.portrait ?? null,
        pexels_photo_id: photos[0]?.id ?? null,
      }
    })
  )

  // 3. Save to database
  const supabase = await createClient()
  await supabase
    .from('projects')
    .update({
      slide_data: slides,
      template_id: templateId,
      title: carousel.title,
    })
    .eq('id', projectId)

  revalidatePath(`/project/${projectId}`)
  return { success: true, slideCount: slides.length }
}
```

### Anti-Patterns to Avoid
- **Client-side image rendering:** Never use html2canvas or dom-to-image for the final download. Results vary across browsers and devices. Server-side only.
- **Storing rendered images in the database:** Store slide data (JSON) and template ID. Render images on-demand via API route. This avoids massive blob storage and lets templates be changed retroactively.
- **Calling Claude without structured outputs:** Always use Zod + `messages.parse()`. Raw text responses require fragile regex/JSON parsing.
- **Embedding Google Fonts via URL in server rendering:** Puppeteer may fail to load external fonts in time. Use `@font-face` with base64-encoded font data or ensure `waitUntil: 'networkidle0'`.
- **Synchronous rendering of all slides:** Render slides in parallel with `Promise.all` but cap concurrency to avoid memory spikes from multiple Chromium pages.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON from Claude | Manual JSON.parse + validation | `@anthropic-ai/sdk` structured outputs + Zod | Guaranteed schema conformance; no retry loops |
| Stock photo search | Custom Pexels REST client | `pexels` npm package | Already typed, handles pagination, auth |
| HTML to image | Raw Puppeteer page management | `node-html-to-image` | Handles page lifecycle, cleanup, buffer output |
| ZIP creation | Manual binary ZIP building | `jszip` | Edge cases in ZIP format are brutal |
| File download trigger | Manual blob URL creation | `file-saver` | Cross-browser download handling |
| Template CSS | Complex React-based rendering | Plain HTML string templates | Simpler, faster, works in both preview and server render |

**Key insight:** The entire rendering pipeline should be: data (JSON) + template (HTML/CSS string) = image. No React on the server render path. This keeps templates portable and debugging simple.

## Common Pitfalls

### Pitfall 1: Puppeteer Memory Leaks in Serverless
**What goes wrong:** Each `node-html-to-image` call launches a Chromium instance. Under load, memory grows unbounded.
**Why it happens:** Default behavior spawns a new browser per render.
**How to avoid:** For development, the default is fine. For production, consider a browser pool or use `puppeteerArgs` to share a browser instance. Cap concurrent renders (e.g., max 3 at a time using a semaphore).
**Warning signs:** API route timeouts, OOM errors on hosting platform.

### Pitfall 2: Font Loading in Headless Chromium
**What goes wrong:** Custom fonts don't appear in rendered images -- fallback system font used instead.
**Why it happens:** Headless Chrome may not wait for external font loading. `@import` in CSS may timeout.
**How to avoid:** Either: (a) use `waitUntil: 'networkidle0'` and load fonts from a fast CDN, or (b) embed fonts as base64 `@font-face` declarations directly in the HTML template. Option (b) is more reliable.
**Warning signs:** Rendered images show different fonts than the preview.

### Pitfall 3: Pexels API Rate Limiting
**What goes wrong:** Generating a carousel with 7 slides means 7 Pexels API calls in quick succession. Rate limit hit.
**Why it happens:** Pexels has per-minute rate limits (varies by API key tier).
**How to avoid:** Batch slide queries into fewer calls where possible. Use `per_page: 1` to minimize data transfer. Cache Pexels results in the database so re-renders don't re-fetch. Add simple retry with backoff on 429 responses.
**Warning signs:** 429 status codes, missing background images.

### Pitfall 4: Claude API Latency
**What goes wrong:** Generation feels slow -- user waits 5-10 seconds staring at nothing.
**Why it happens:** Claude API calls for structured output with 7+ slides take several seconds.
**How to avoid:** Show a loading state with progress indicators. Consider streaming the response if partial results are useful. At minimum, show "Generating slide content..." -> "Fetching background images..." -> "Done!" states.
**Warning signs:** Users abandoning the generation flow.

### Pitfall 5: Image Dimensions Not Matching Template CSS
**What goes wrong:** Rendered image is wrong size or content is clipped.
**Why it happens:** `node-html-to-image` screenshots the body element. If body dimensions aren't explicitly set, it defaults to viewport size.
**How to avoid:** Always set explicit `width: 1080px; height: 1920px;` on the body element in the template HTML. The body IS the image.
**Warning signs:** Images that are 800x600 or have unexpected whitespace.

### Pitfall 6: Pexels Image URLs Expiring
**What goes wrong:** Stored Pexels image URLs stop working after some time.
**Why it happens:** Pexels CDN URLs may change or have caching policies.
**How to avoid:** For v1, store the Pexels photo ID alongside the URL. If a URL fails, re-fetch the photo by ID. For production, consider proxying/caching images through your own storage.
**Warning signs:** Broken background images on older projects.

## Code Examples

### Pexels Photo Search
```typescript
// src/lib/pexels/search-photos.ts
import { createClient, PhotosWithTotalResults, Photo } from 'pexels'

const pexelsClient = createClient(process.env.PEXELS_API_KEY!)

interface SearchOptions {
  orientation?: 'landscape' | 'portrait' | 'square'
  per_page?: number
  page?: number
}

export async function searchPhotos(
  query: string,
  options: SearchOptions = {}
): Promise<Photo[]> {
  const { orientation = 'portrait', per_page = 5, page = 1 } = options

  const result = await pexelsClient.photos.search({
    query,
    orientation,
    per_page,
    page,
  })

  // Type guard: search returns PhotosWithTotalResults or ErrorResponse
  if ('photos' in result) {
    return (result as PhotosWithTotalResults).photos
  }

  return []
}
```

### Slide HTML Template Builder
```typescript
// src/lib/render/render-slide.ts
import type { SlideTemplate } from './templates'
import type { SlideContent } from '../ai/schemas'

export function buildSlideHtml(
  slide: SlideContent & { background_url: string | null },
  template: SlideTemplate
): string {
  const backgroundCss = slide.background_url
    ? `background-image: url('${slide.background_url}'); background-size: cover; background-position: center;`
    : `background-color: ${template.backgroundColor};`

  const positionMap = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
  }

  return `
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: 1080px;
          height: 1920px;
          ${backgroundCss}
          font-family: ${template.fontFamily};
          color: ${template.textColor};
          display: flex;
          flex-direction: column;
          justify-content: ${positionMap[template.textPosition]};
          align-items: ${template.textAlign === 'center' ? 'center' : template.textAlign === 'right' ? 'flex-end' : 'flex-start'};
          text-align: ${template.textAlign};
          padding: 80px 60px;
          position: relative;
        }
        .overlay {
          position: absolute;
          inset: 0;
          background-color: ${template.overlayColor};
          opacity: ${template.overlayOpacity};
        }
        .content {
          position: relative;
          z-index: 1;
          max-width: 960px;
        }
        .hook {
          font-size: ${template.hookFontSize};
          font-weight: 900;
          line-height: 1.1;
          margin-bottom: 40px;
          ${template.hookStyle === 'uppercase' ? 'text-transform: uppercase;' : ''}
          ${template.hookStyle === 'italic' ? 'font-style: italic;' : ''}
        }
        .body {
          font-size: ${template.bodyFontSize};
          font-weight: 400;
          line-height: 1.5;
          opacity: 0.9;
        }
      </style>
    </head>
    <body>
      <div class="overlay"></div>
      <div class="content">
        <div class="hook">${escapeHtml(slide.hook_text)}</div>
        <div class="body">${escapeHtml(slide.body_text)}</div>
      </div>
    </body>
    </html>
  `
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

### Client-Side ZIP Download
```typescript
// src/lib/download/zip-slides.ts
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export async function downloadSlidesAsZip(
  projectId: string,
  slideCount: number,
  projectTitle: string
) {
  const zip = new JSZip()

  const fetchPromises = Array.from({ length: slideCount }, async (_, i) => {
    const response = await fetch(`/api/render/${projectId}?slide=${i}`)
    const blob = await response.blob()
    zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob)
  })

  await Promise.all(fetchPromises)

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  saveAs(zipBlob, `${projectTitle.replace(/[^a-zA-Z0-9]/g, '-')}-slides.zip`)
}
```

### System Prompt for TikTok Hook Generation
```typescript
// src/lib/ai/prompts.ts
export function buildSystemPrompt(): string {
  return `You are an expert TikTok carousel content creator. You generate slide content for vertical carousel posts (1080x1920 images).

HOOK PATTERNS - Use these proven TikTok hook formulas:
- Curiosity gaps: "The one thing about X that nobody talks about"
- Pattern interrupts: "Stop scrolling if you..." / "This changed everything"
- POV hooks: "POV: you just discovered..."
- Hot takes: "Unpopular opinion: X is actually..."
- Lists with stakes: "5 mistakes that are costing you..."
- Before/after: "I used to think X, then I learned Y"

SLIDE STRUCTURE RULES:
1. First slide: Must be a powerful hook that stops scrolling. Short, punchy, max 10 words.
2. Middle slides (2-6): One key point per slide. Hook text (bold) + body text (supporting detail).
3. Last slide: Clear CTA. Tell them what to do next (follow, save, share, comment).
4. Total slides: 5-8 is optimal. Never less than 4, never more than 10.
5. Image queries: Provide specific Pexels search terms. Prefer lifestyle, aesthetic, and mood shots. Add "vertical" or "portrait" to queries.

WRITING STYLE:
- Conversational, not corporate
- Short sentences. Punchy. Direct.
- Use line breaks for emphasis
- Numbers and statistics when relevant
- Emoji sparingly (1-2 per carousel max, or zero)`
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude tool_use for JSON extraction | Structured outputs with Zod (`messages.parse()`) | Nov 2025 | Guaranteed schema compliance, no parsing errors |
| Raw Puppeteer for HTML-to-image | `node-html-to-image` v3.1 wrapper | Stable | Simpler API, Handlebars support, auto-cleanup |
| Server-side ZIP generation | Client-side JSZip | Stable | Reduces server memory; images fetched in parallel from render API |
| html2canvas client-side rendering | Server-side Puppeteer rendering | N/A (architecture choice) | Consistent output across all devices |

**Deprecated/outdated:**
- **Remotion**: Not applicable -- this is image output, not video. Explicitly out of scope per project pivot.
- **RunPod / GPU rendering**: Not needed. Puppeteer runs on CPU. Server-side image rendering is lightweight.
- **Sharp for slide rendering**: Sharp cannot render HTML/CSS. It is only useful for post-processing (resize, format conversion). Puppeteer/node-html-to-image is required for the actual rendering.

## Database Schema Update

The existing `projects` table has `slide_data jsonb DEFAULT '[]'`. Phase 2 needs to define the slide structure stored in this column and add a `template_id` column.

**Migration needed:**
```sql
ALTER TABLE projects ADD COLUMN template_id text DEFAULT 'bold-minimal';
ALTER TABLE projects ADD COLUMN topic text;
ALTER TABLE projects ADD COLUMN generation_status text DEFAULT 'draft';
```

**slide_data JSON structure (per slide):**
```json
{
  "hook_text": "string",
  "body_text": "string",
  "image_query": "string",
  "is_cta": false,
  "background_url": "string | null",
  "pexels_photo_id": "number | null"
}
```

## Environment Variables Required

```env
ANTHROPIC_API_KEY=sk-ant-...     # Claude API key
PEXELS_API_KEY=...               # Pexels API key (free at pexels.com/api/new)
```

## Open Questions

1. **Puppeteer on deployment platform**
   - What we know: Puppeteer works locally. On Vercel serverless, it requires `puppeteer-core` + `@sparticuz/chromium-min`. On a VPS/Docker, full Puppeteer works fine.
   - What's unclear: What deployment platform Diego will use for production.
   - Recommendation: Build for local/VPS first (full Puppeteer). Add Vercel-compatible config as a separate concern if needed. The `node-html-to-image` library supports `puppeteer` option to swap in `puppeteer-core`.

2. **Claude model selection**
   - What we know: Structured outputs work with Sonnet 4.5, Opus 4.5, Haiku 4.5, and newer.
   - What's unclear: Cost vs quality tradeoff for this use case.
   - Recommendation: Use `claude-sonnet-4-5-20250514` -- best balance of speed, cost, and quality for content generation. Carousel text is not complex enough to need Opus.

3. **Concurrent Puppeteer renders**
   - What we know: Each render spawns a Chromium page. Memory-intensive.
   - What's unclear: How many concurrent renders the server can handle.
   - Recommendation: Serialize renders for now (one at a time per request). Optimize with browser pooling only if performance becomes an issue.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIGEN-01 | Generate slides from topic prompt | unit | `npx vitest run src/__tests__/ai/generate-slides.test.ts -t "generates slides"` | No - Wave 0 |
| AIGEN-02 | Structured content per slide (hook, body, query, CTA) | unit | `npx vitest run src/__tests__/ai/generate-slides.test.ts -t "structured content"` | No - Wave 0 |
| AIGEN-03 | TikTok hook patterns used | unit | `npx vitest run src/__tests__/ai/prompts.test.ts -t "hook patterns"` | No - Wave 0 |
| REND-01 | 1080x1920 image with text overlays | unit | `npx vitest run src/__tests__/render/render-slide.test.ts -t "dimensions"` | No - Wave 0 |
| REND-02 | Server-side rendering consistency | integration | `npx vitest run src/__tests__/render/render-slide.test.ts -t "server render"` | No - Wave 0 |
| REND-03 | ZIP download of all slides | unit | `npx vitest run src/__tests__/download/zip-slides.test.ts` | No - Wave 0 |
| REND-04 | Individual slide download | unit | `npx vitest run src/__tests__/render/render-api.test.ts -t "single download"` | No - Wave 0 |
| TMPL-01 | Template selection before generation | unit | `npx vitest run src/__tests__/render/templates.test.ts -t "template selection"` | No - Wave 0 |
| TMPL-02 | Templates define layout properties | unit | `npx vitest run src/__tests__/render/templates.test.ts -t "template properties"` | No - Wave 0 |
| UIUX-03 | Real-time slide preview | unit | `npx vitest run src/__tests__/components/slide-preview.test.tsx` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/ai/generate-slides.test.ts` -- covers AIGEN-01, AIGEN-02 (mock Claude API)
- [ ] `src/__tests__/ai/prompts.test.ts` -- covers AIGEN-03 (validate prompt includes hook patterns)
- [ ] `src/__tests__/render/render-slide.test.ts` -- covers REND-01, REND-02 (test HTML output structure)
- [ ] `src/__tests__/render/templates.test.ts` -- covers TMPL-01, TMPL-02
- [ ] `src/__tests__/render/render-api.test.ts` -- covers REND-04
- [ ] `src/__tests__/download/zip-slides.test.ts` -- covers REND-03
- [ ] `src/__tests__/components/slide-preview.test.tsx` -- covers UIUX-03

## Sources

### Primary (HIGH confidence)
- [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) - Zod integration, `messages.parse()`, `zodOutputFormat()`
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) - v0.80.0, TypeScript SDK
- [node-html-to-image GitHub](https://github.com/frinyvonnick/node-html-to-image) - v3.1.0, API options, buffer output
- [JSZip npm](https://www.npmjs.com/package/jszip) - v3.10.1, browser + Node support

### Secondary (MEDIUM confidence)
- [Pexels API documentation](https://www.pexels.com/api/documentation/) - search endpoint, parameters, rate limits
- [pexels npm (official JS client)](https://github.com/pexels/pexels-javascript) - v1.4.0, TypeScript-native
- [Vercel Puppeteer deployment patterns](https://dev.to/joelgriffith/vercel-puppeteer-4l7c) - puppeteer-core + @sparticuz/chromium-min

### Tertiary (LOW confidence)
- Pexels rate limit specifics (exact numbers not publicly documented -- varies by tier)
- `node-html-to-image` concurrent rendering limits (not documented, needs testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm/GitHub, API patterns confirmed in official docs
- Architecture: HIGH - HTML-to-image via Puppeteer is well-established pattern; Claude structured outputs officially documented
- Pitfalls: MEDIUM - Font loading and memory issues are known patterns but exact thresholds depend on deployment environment

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days -- stack is stable)
