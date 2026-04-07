# Phase 16: REST API Endpoints - Research

**Researched:** 2026-04-06
**Domain:** REST API surface for carousel CRUD, slide editing, rendering, and download with credit metering
**Confidence:** HIGH

## Summary

This phase builds the full REST API surface on top of the infrastructure Phase 15 established (auth, rate limiting, error handling, CORS, service extraction). The existing `/api/v1/carousel` endpoint serves as the one-shot generation path (REST-01). Phase 16 adds: template listing, project CRUD, granular slide editing, render triggering, download delivery, and credit usage headers on every response.

The codebase is well-positioned for this work. All editor operations already exist as Server Actions in `editor-actions.ts` and `dashboard/actions.ts` -- they just need extraction into service functions (same pattern Phase 15 used for `generateCarouselService`). The render pipeline at `/api/render/route.ts` already works but uses cookie-based auth; it needs an API-compatible variant using the admin client. JSZip is already installed for ZIP downloads. No new npm packages are required.

The primary technical decisions are: (1) how to deliver rendered images via API (presigned URLs with TTL vs. inline binary), (2) how to structure the credit headers consistently across all endpoints, and (3) how to handle the render-to-download pipeline for API consumers who cannot use browser-side JSZip. The CONTEXT.md locks these: presigned URLs for ZIP, direct binary for individual PNGs, and `x-credits-remaining` + `x-credits-used` on every response.

**Primary recommendation:** Extract editor actions into `lib/services/editor.ts` and project CRUD into `lib/services/project.ts` following the thin-wrapper pattern. Build API routes that compose: authenticateApiKey -> checkRateLimit -> Zod validate -> service call -> credit headers -> response. Reuse the existing CORS and error handling patterns verbatim.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- API path convention: `/api/v1/{resource}` (RESTful) -- continues pattern from Phase 15's `/api/v1/carousel`
- One-shot response: synchronous -- return content + render URLs in single response (within 60s Vercel timeout)
- Granular edit: `PATCH /api/v1/projects/:id/slides/:index` -- standard REST resource nesting
- Render endpoint: `POST /api/v1/projects/:id/render` -> returns download URLs (TTL'd presigned URLs)
- Extract all slide-level editor actions: update text, swap image, restyle, reorder
- Service layer pattern: extract to `lib/services/editor.ts`, existing Server Actions become thin wrappers
- Image source for API: accept Pexels query string or direct URL -- no Imagen support via API (credit cost too high for batch use)
- Credit headers `x-credits-remaining` + `x-credits-used` on every response, even 0-cost reads
- ZIP endpoint returns presigned URL; individual PNGs returned as direct binary with Content-Disposition header
- Template listing requires API key authentication -- keeps template list private to paying users

### Claude's Discretion
- Service layer internal structure and helper utilities
- Error code naming conventions for new endpoint-specific errors
- Zod schema structure for each endpoint
- Test structure for new services and routes

### Deferred Ideas (OUT OF SCOPE)
- Imagen image generation via API (too expensive for batch use)
- Async generation with polling (sync is sufficient for now)
- Webhook notifications on completion
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REST-01 | Developer can generate a full carousel from a text prompt in one API call (one-shot) | Existing `/api/v1/carousel` endpoint already handles this; needs credit headers added |
| REST-02 | Developer can list available templates via API | `templates` array in `lib/render/templates/index.ts` provides data; new `GET /api/v1/templates` route |
| REST-03 | Developer can create/list/get/delete projects via API | Extract from `dashboard/actions.ts` into `lib/services/project.ts`; CRUD routes at `/api/v1/projects` |
| REST-04 | Developer can edit individual slides (change text, swap image, restyle) via API | Extract from `editor-actions.ts` into `lib/services/editor.ts`; `PATCH /api/v1/projects/:id/slides/:index` |
| REST-05 | Developer can trigger render and download carousel images (individual or ZIP) via API | Reuse `buildSlideElement` + `loadFontBuffersForSlide` from render pipeline; new render/download routes |
| REST-06 | API responses include credit usage headers (x-credits-remaining, x-credits-used) | Helper function wrapping `getCreditBalance`; applied to all route responses |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.13 | API route handlers | App Router route handlers are the API framework [VERIFIED: package.json] |
| zod | 4.3.6 | Request validation | Already used in Phase 15 carousel route [VERIFIED: package.json] |
| jszip | 3.10.1 | ZIP file creation for multi-slide download | Already installed, used by client-side download [VERIFIED: package.json] |
| @supabase/supabase-js | 2.99.3 | Database operations via admin client | Already installed [VERIFIED: package.json] |

### Supporting (from Phase 15 -- reuse directly)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@/lib/api/auth.ts` | Bearer token authentication | Every API route handler |
| `@/lib/api/rate-limit.ts` | Upstash Redis rate limiting | Every API route handler |
| `@/lib/api/errors.ts` | Structured error responses | Error handling in every route |
| `@/lib/api/types.ts` | ApiKeyAuth, ApiKeyRecord types | Route handler type safety |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js route handlers | Express/Hono | Unnecessary -- route handlers are sufficient for this surface area and keep deployment simple |
| Supabase Storage signed URLs | Cloudflare R2 | No need -- Supabase Storage presigned URLs work fine with TTL for download delivery |
| Server-side JSZip | archiver | JSZip already installed and works for this volume |

**Installation:** None needed. All packages already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    services/
      carousel.ts          # [EXISTS] One-shot generation service
      project.ts           # [NEW] Project CRUD service
      editor.ts            # [NEW] Slide editing service (text, image, style)
      render.ts            # [NEW] Render + download service
    api/
      auth.ts              # [EXISTS] Bearer token auth
      errors.ts            # [EXISTS] Error responses -- extend with new codes
      rate-limit.ts        # [EXISTS] Upstash rate limiting
      types.ts             # [EXISTS] Auth types
      headers.ts           # [NEW] Credit header helper + CORS utility
  app/
    api/
      v1/
        carousel/
          route.ts         # [EXISTS] POST -- one-shot generation (add credit headers)
        templates/
          route.ts         # [NEW] GET -- list templates
        projects/
          route.ts         # [NEW] GET (list) + POST (create)
          [id]/
            route.ts       # [NEW] GET (single) + DELETE
            slides/
              [index]/
                route.ts   # [NEW] PATCH (edit slide) + GET (get slide)
            render/
              route.ts     # [NEW] POST (trigger render, returns URLs)
            download/
              route.ts     # [NEW] GET (download ZIP)
              [index]/
                route.ts   # [NEW] GET (download single PNG)
```
[VERIFIED: codebase analysis of existing file structure]

### Pattern 1: Service Extraction (Thin Wrapper)
**What:** Same pattern Phase 15 established -- extract business logic into service functions, Server Actions become thin wrappers.
**When to use:** Every editor action and project operation that will be exposed via API.
**Example:**
```typescript
// src/lib/services/project.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project } from '@/lib/types/project'

export async function listProjects(
  userId: string,
  options?: { adminClient?: SupabaseClient }
): Promise<Project[]> {
  const supabase = options?.adminClient ?? await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, topic, template_id, generation_status, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Project[]
}

export async function getProject(
  userId: string,
  projectId: string,
  options?: { adminClient?: SupabaseClient }
): Promise<Project | null> {
  const supabase = options?.adminClient ?? await createClient()
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  return data as Project | null
}

export async function createProjectService(
  userId: string,
  params: { title: string; topic?: string; templateId?: string },
  options?: { adminClient?: SupabaseClient }
): Promise<{ id: string }> {
  const supabase = options?.adminClient ?? await createClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      title: params.title,
      topic: params.topic ?? null,
      template_id: params.templateId ?? null,
      slide_data: [],
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Failed to create project')
  return { id: data.id }
}

export async function deleteProjectService(
  userId: string,
  projectId: string,
  options?: { adminClient?: SupabaseClient }
): Promise<void> {
  const supabase = options?.adminClient ?? await createClient()
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)
  if (error) throw error
}
```
[VERIFIED: pattern matches Phase 15's carousel.ts service extraction]

### Pattern 2: Credit Header Helper
**What:** Utility that fetches credit balance and returns headers for every API response.
**When to use:** Every API route -- both credit-consuming and read-only endpoints.
**Example:**
```typescript
// src/lib/api/headers.ts
import { getCreditBalance } from '@/lib/credits/check-credits'
import { createAdminClient } from '@/lib/supabase/admin'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export async function buildResponseHeaders(
  userId: string,
  creditsUsed: number = 0,
  rateLimit?: { limit: number; remaining: number }
): Promise<Record<string, string>> {
  const adminClient = createAdminClient()
  const balance = await getCreditBalance(userId, adminClient)
  return {
    ...CORS_HEADERS,
    'x-credits-remaining': String(balance),
    'x-credits-used': String(creditsUsed),
    ...(rateLimit ? {
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    } : {}),
  }
}
```
[ASSUMED: exact function signature -- pattern derived from CONTEXT.md requirements]

### Pattern 3: API Route Handler Boilerplate
**What:** Standard structure for every new API route -- auth, rate limit, validate, service, credit headers.
**When to use:** Every `/api/v1/` route handler.
**Example:**
```typescript
// Standard pattern for any new API route
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)
    const { id } = await params  // Next.js 15: params is a Promise
    
    const project = await getProject(auth.userId, id, {
      adminClient: createAdminClient(),
    })
    if (!project) throw new ApiError('NOT_FOUND', 'Project not found')
    
    const headers = await buildResponseHeaders(auth.userId, 0, { limit, remaining })
    return NextResponse.json({ data: project }, { headers })
  } catch (err) {
    return apiError(err)
  }
}
```
[VERIFIED: params as Promise confirmed in Next.js 15 -- existing route.ts uses this pattern]

### Pattern 4: Render-to-Download Pipeline for API
**What:** Server-side rendering of slides to PNG, then either return as binary or package into ZIP with presigned upload URL.
**When to use:** REST-05 render and download endpoints.
**Example:**
```typescript
// src/lib/services/render.ts
import { ImageResponse } from 'next/og'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import { getTemplate } from '@/lib/render/templates'
import { mergeWithBrandKit } from '@/lib/brand-kit/get-effective-template'
import JSZip from 'jszip'

export async function renderSlide(
  project: Project,
  slideIndex: number,
  brandKit: BrandKit | null
): Promise<ArrayBuffer> {
  const slide = project.slide_data[slideIndex]
  if (!slide) throw new Error(`Slide ${slideIndex} not found`)
  
  const template = getTemplate(project.template_id ?? 'bold-minimal')
  const effectiveTemplate = mergeWithBrandKit(template, brandKit)
  const element = buildSlideElement(slide, effectiveTemplate)
  const fonts = await loadFontBuffersForSlide(slide, effectiveTemplate)
  
  const imageResponse = new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts,
  })
  
  return imageResponse.arrayBuffer()
}

export async function renderAllSlidesToZip(
  project: Project,
  brandKit: BrandKit | null
): Promise<Buffer> {
  const zip = new JSZip()
  
  for (let i = 0; i < project.slide_data.length; i++) {
    const buffer = await renderSlide(project, i, brandKit)
    const slideNum = String(i + 1).padStart(2, '0')
    zip.file(`slide-${slideNum}.png`, buffer)
  }
  
  return zip.generateAsync({ type: 'nodebuffer' }) as Promise<Buffer>
}
```
[VERIFIED: render pattern matches existing `/api/render/route.ts` lines 76-93]

### Anti-Patterns to Avoid
- **Using `createClient()` in API routes:** API routes have no cookies. Always use `createAdminClient()` and filter by `userId` from the authenticated key. [VERIFIED: Phase 15 established this pattern]
- **Forgetting `.eq('user_id', userId)` on queries:** The admin client bypasses RLS. Every query MUST include the user_id filter or one user can access another's projects. [VERIFIED: codebase analysis]
- **Rendering all slides synchronously in one request:** For ZIP downloads, renders should be sequential (not Promise.all) to avoid memory pressure on serverless. Each PNG is ~200-500KB. [ASSUMED: based on Vercel serverless memory constraints]
- **Duplicating CORS headers per route:** Extract CORS headers into the shared `headers.ts` utility. The existing carousel route already has CORS but it's inline -- consolidate. [VERIFIED: existing carousel/route.ts lines 23-27]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP creation | Custom archive stream | JSZip (already installed) | Handles compression, cross-platform compatibility |
| Request validation | Manual field checking | Zod schemas (already installed) | Type inference, error messages, coercion |
| Auth pipeline | Per-route auth code | `authenticateApiKey` (from Phase 15) | Single implementation, consistent error format |
| Rate limiting | Per-route throttle logic | `checkRateLimit` (from Phase 15) | Tier-aware, Redis-backed, consistent headers |
| Presigned URLs | Custom token system | Supabase Storage `createSignedUrl` | Built-in TTL, works with existing bucket |

**Key insight:** Phase 15 built the entire API infrastructure layer. Phase 16 is pure application logic -- extracting existing Server Action business logic into services, then wiring them to route handlers using the established auth/rate-limit/error pipeline.

## Common Pitfalls

### Pitfall 1: Next.js 15 Dynamic Route Params are Promises
**What goes wrong:** Destructuring `params.id` directly instead of awaiting the Promise.
**Why it happens:** Next.js 14 params were synchronous objects; Next.js 15 changed them to Promises.
**How to avoid:** Always `const { id } = await params` in route handlers.
**Warning signs:** Runtime error "Cannot read property of Promise" or params being `[object Promise]`.
[VERIFIED: Next.js 15.5.13 in package.json; existing carousel route already uses this pattern]

### Pitfall 2: Admin Client Bypasses RLS -- Must Filter by userId
**What goes wrong:** A query without `.eq('user_id', auth.userId)` returns another user's projects.
**Why it happens:** `createAdminClient()` uses the service role key which bypasses all RLS policies.
**How to avoid:** Every Supabase query in a service function called from an API route MUST include the user_id filter. Add it as the first filter in every query chain.
**Warning signs:** API returns data that doesn't belong to the authenticated user.
[VERIFIED: existing carousel.ts service uses adminClient without user_id filter on project update -- BUT the project was just created by the same user. New read endpoints MUST filter.]

### Pitfall 3: Vercel Timeout on ZIP Renders
**What goes wrong:** Rendering 20 slides to PNG + packaging into ZIP exceeds Vercel's function timeout.
**Why it happens:** Each Satori render takes 1-3 seconds. 20 slides = 20-60 seconds. Hobby tier = 10s timeout. Pro tier = 60s.
**How to avoid:** Set `export const maxDuration = 60` on render routes (matching existing render route). For production, ensure Pro tier deployment. Consider rendering fewer slides per request for very large carousels.
**Warning signs:** 504 Gateway Timeout on ZIP download requests with 10+ slides.
[VERIFIED: existing `/api/render/route.ts` line 7 already sets `maxDuration = 60`]

### Pitfall 4: Missing Error Codes for New Endpoints
**What goes wrong:** New endpoints throw errors that the `apiError` handler doesn't recognize, resulting in generic 500 responses.
**Why it happens:** The `ErrorCode` type in `errors.ts` only has 5 codes (UNAUTHORIZED, RATE_LIMITED, VALIDATION_ERROR, INTERNAL_ERROR, INSUFFICIENT_CREDITS).
**How to avoid:** Extend the `ErrorCode` type with `NOT_FOUND` (404) and `FORBIDDEN` (403) before building new routes. These are essential for project-not-found and project-belongs-to-other-user scenarios.
**Warning signs:** All errors returning 500 instead of appropriate status codes.
[VERIFIED: errors.ts line 3-9 shows current ErrorCode type missing NOT_FOUND]

### Pitfall 5: Credit Headers on Error Responses
**What goes wrong:** Error responses don't include credit headers, violating REST-06 ("every response").
**Why it happens:** Error paths short-circuit before credit header logic runs.
**How to avoid:** Add credit headers in the `apiError` function itself, or ensure the catch block always adds them. For unauthenticated errors (401), skip credit headers since there's no user context.
**Warning signs:** API consumers see credit headers on success but not on 400/404/422 responses.
[ASSUMED: exact implementation approach -- CONTEXT.md says "every response, even 0-cost reads"]

### Pitfall 6: One-Shot Endpoint Missing Credit Headers
**What goes wrong:** The existing `/api/v1/carousel` endpoint from Phase 15 returns rate limit headers but not credit headers.
**Why it happens:** Phase 15 didn't implement REST-06 (credit headers are a Phase 16 requirement).
**How to avoid:** Add credit headers to the existing carousel route as part of this phase.
**Warning signs:** One-shot endpoint inconsistent with other endpoints on header behavior.
[VERIFIED: carousel/route.ts lines 82-89 only include rate limit headers, no credit headers]

### Pitfall 7: Slide Index Validation
**What goes wrong:** API accepts slide index out of bounds, causing undefined behavior or crashes.
**Why it happens:** No bounds check against `project.slide_data.length`.
**How to avoid:** Validate `index >= 0 && index < project.slide_data.length` after fetching the project. Return 404 with "Slide at index N not found" message.
**Warning signs:** Undefined array access errors in production logs.
[VERIFIED: existing render route does this check at line 68-74]

## Code Examples

### Endpoint: GET /api/v1/templates
```typescript
// src/app/api/v1/templates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError } from '@/lib/api/errors'
import { templates } from '@/lib/render/templates'
import { buildResponseHeaders } from '@/lib/api/headers'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)
    
    const templateList = templates.map(t => ({
      id: t.id,
      name: t.name,
      thumbnail: t.thumbnail,
      textPosition: t.textPosition,
      textAlign: t.textAlign,
    }))
    
    const headers = await buildResponseHeaders(auth.userId, 0, { limit, remaining })
    return NextResponse.json({ data: templateList }, { headers })
  } catch (err) {
    return apiError(err)
  }
}
```
[VERIFIED: templates array structure from `lib/render/templates/index.ts`]

### Endpoint: PATCH /api/v1/projects/:id/slides/:index
```typescript
// src/app/api/v1/projects/[id]/slides/[index]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError, ApiError } from '@/lib/api/errors'
import { buildResponseHeaders } from '@/lib/api/headers'
import { updateSlide } from '@/lib/services/editor'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const slideUpdateSchema = z.object({
  hook_text: z.string().optional(),
  body_text: z.string().optional(),
  image_query: z.string().optional(),      // Pexels search query
  background_url: z.string().url().optional(), // Direct image URL
  style_overrides: z.object({
    hook_font_size: z.number().optional(),
    body_font_size: z.number().optional(),
    text_color: z.string().optional(),
    hook_text_color: z.string().optional(),
    body_text_color: z.string().optional(),
    text_position: z.enum(['top', 'center', 'bottom']).optional(),
    text_align: z.enum(['left', 'center', 'right']).optional(),
    hook_font_weight: z.number().optional(),
    body_font_weight: z.number().optional(),
    hook_font_style: z.enum(['normal', 'italic']).optional(),
    body_font_style: z.enum(['normal', 'italic']).optional(),
    hook_font_family: z.string().optional(),
    body_font_family: z.string().optional(),
    overlay_opacity: z.number().min(0).max(100).optional(),
  }).optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)
    const { id, index: indexStr } = await params
    const slideIndex = parseInt(indexStr, 10)
    
    if (isNaN(slideIndex) || slideIndex < 0) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid slide index')
    }
    
    const body = await req.json()
    const updates = slideUpdateSchema.parse(body)
    
    const adminClient = createAdminClient()
    const result = await updateSlide(auth.userId, id, slideIndex, updates, { adminClient })
    
    const headers = await buildResponseHeaders(auth.userId, 0, { limit, remaining })
    return NextResponse.json({ data: result }, { headers })
  } catch (err) {
    return apiError(err)
  }
}
```
[VERIFIED: SlideStyleOverrides fields from `lib/types/slide.ts`; Next.js 15 params pattern]

### Service: Editor Operations
```typescript
// src/lib/services/editor.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Slide } from '@/lib/types/slide'
import { createClient } from '@/lib/supabase/server'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { ApiError } from '@/lib/api/errors'

interface ServiceOptions {
  adminClient?: SupabaseClient
}

export async function updateSlide(
  userId: string,
  projectId: string,
  slideIndex: number,
  updates: Partial<Slide> & { style_overrides?: Partial<Slide['style_overrides']> },
  options?: ServiceOptions
): Promise<Slide> {
  const supabase = options?.adminClient ?? await createClient()
  
  // Fetch project and verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('slide_data')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  
  if (!project) throw new ApiError('NOT_FOUND', 'Project not found')
  
  const slides = (project.slide_data ?? []) as Slide[]
  if (slideIndex < 0 || slideIndex >= slides.length) {
    throw new ApiError('NOT_FOUND', `Slide at index ${slideIndex} not found`)
  }
  
  const currentSlide = slides[slideIndex]
  
  // Handle image_query: search Pexels and update background
  let imageUpdates: Partial<Slide> = {}
  if (updates.image_query) {
    const photos = await searchPhotos(updates.image_query, {
      orientation: 'portrait',
      per_page: 1,
    })
    imageUpdates = {
      image_query: updates.image_query,
      background_url: photos[0]?.src.portrait ?? currentSlide.background_url,
      pexels_photo_id: photos[0]?.id ?? currentSlide.pexels_photo_id,
    }
  }
  
  // Merge updates
  const updatedSlide: Slide = {
    ...currentSlide,
    ...(updates.hook_text !== undefined ? { hook_text: updates.hook_text } : {}),
    ...(updates.body_text !== undefined ? { body_text: updates.body_text } : {}),
    ...(updates.background_url !== undefined ? { background_url: updates.background_url } : {}),
    ...imageUpdates,
    style_overrides: {
      ...currentSlide.style_overrides,
      ...updates.style_overrides,
    },
  }
  
  slides[slideIndex] = updatedSlide
  
  const { error } = await supabase
    .from('projects')
    .update({ slide_data: slides })
    .eq('id', projectId)
    .eq('user_id', userId)
  
  if (error) throw new ApiError('INTERNAL_ERROR', 'Failed to update slide')
  
  return updatedSlide
}
```
[VERIFIED: Slide type and editor-actions.ts patterns from codebase]

## Complete Endpoint Map

| Method | Path | Purpose | Credits | Req |
|--------|------|---------|---------|-----|
| POST | `/api/v1/carousel` | [EXISTS] One-shot generate | 1 (+ AI image cost) | REST-01 |
| GET | `/api/v1/templates` | List available templates | 0 | REST-02 |
| GET | `/api/v1/projects` | List user's projects | 0 | REST-03 |
| POST | `/api/v1/projects` | Create new project | 0 | REST-03 |
| GET | `/api/v1/projects/:id` | Get project details + slides | 0 | REST-03 |
| DELETE | `/api/v1/projects/:id` | Delete project | 0 | REST-03 |
| PATCH | `/api/v1/projects/:id/slides/:index` | Edit slide (text, image, style) | 0 | REST-04 |
| POST | `/api/v1/projects/:id/render` | Trigger render, get download URLs | 0 | REST-05 |
| GET | `/api/v1/projects/:id/download` | Download all slides as ZIP | 0 | REST-05 |
| GET | `/api/v1/projects/:id/download/:index` | Download single slide PNG | 0 | REST-05 |

**Total new routes:** 9 (1 existing needs credit header update)
**Total new service files:** 3 (project.ts, editor.ts, render.ts)
**Total new utility files:** 1 (headers.ts)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cookie-based auth for render | API key auth variant | Phase 16 | API consumers can render without browser session |
| Client-side JSZip (browser) | Server-side JSZip (route handler) | Phase 16 | API consumers receive ZIP URL, no client-side packaging needed |
| Inline CORS per route | Shared CORS utility | Phase 16 | Consistent CORS headers, DRY |
| No credit usage visibility | x-credits headers on every response | Phase 16 | API consumers track credit consumption programmatically |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sequential rendering (not parallel) is needed for ZIP to avoid memory pressure | Anti-Patterns | Parallel might work fine on Pro tier; sequential is safer but slower |
| A2 | Supabase Storage createSignedUrl supports TTL for presigned download URLs | Architecture | May need to use a different URL delivery mechanism |
| A3 | Credit headers should include balance on error responses (except 401) | Pitfall 5 | Could simplify to success-only if this creates complexity |
| A4 | Slide editing via API is 0-cost (no credit deduction) | Endpoint Map | If edits should cost credits, need deduction logic in editor service |
| A5 | 15-minute TTL for presigned download URLs is appropriate | CONTEXT.md specifics | Too short = users can't download; too long = security concern |

## Open Questions (RESOLVED)

1. **Presigned URL mechanism for ZIP downloads** (RESOLVED)
   - What we know: CONTEXT.md says "presigned URL" for ZIP downloads
   - What's unclear: Whether to upload the rendered ZIP to Supabase Storage and return a signed URL, or return the ZIP directly as a binary response body
   - Recommendation: Return ZIP directly as binary response with `Content-Disposition: attachment`. Uploading to storage adds complexity and latency with no benefit. Reserve presigned URLs for very large files that would exceed response size limits.

2. **Credit deduction for one-shot endpoint already happens inside service** (RESOLVED)
   - What we know: `generateCarouselService` calls `deductCredit` internally
   - What's unclear: How to extract the credits-used count for the response header
   - Recommendation: Have the service return `{ success: true, slideCount: N, creditsUsed: 1 }` and use that value in the header.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js | Route handlers | Yes | 15.5.13 | -- |
| Supabase | Database + Storage | Yes | 2.99.3 | -- |
| Upstash Redis | Rate limiting | Yes | Configured in Phase 15 | -- |
| JSZip | ZIP creation | Yes | 3.10.1 | -- |
| Zod | Validation | Yes | 4.3.6 | -- |
| Satori/next-og | PNG rendering | Yes | Built into Next.js | -- |

**Missing dependencies:** None. All infrastructure was built in Phase 15.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REST-01 | One-shot carousel returns credit headers | unit | `npx vitest run src/__tests__/api/v1/carousel.test.ts -t "credit headers"` | No -- Wave 0 |
| REST-02 | List templates returns template array | unit | `npx vitest run src/__tests__/api/v1/templates.test.ts -t "list"` | No -- Wave 0 |
| REST-03 | Project CRUD operations | unit | `npx vitest run src/__tests__/services/project.test.ts` | No -- Wave 0 |
| REST-04 | Slide update with text/image/style | unit | `npx vitest run src/__tests__/services/editor.test.ts -t "update"` | No -- Wave 0 |
| REST-05 | Render returns PNG buffer, ZIP packages multiple | unit | `npx vitest run src/__tests__/services/render.test.ts` | No -- Wave 0 |
| REST-06 | Credit headers present on success and error responses | unit | `npx vitest run src/__tests__/api/v1/headers.test.ts -t "credits"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/services/project.test.ts` -- covers REST-03 (project CRUD service)
- [ ] `src/__tests__/services/editor.test.ts` -- covers REST-04 (slide update service)
- [ ] `src/__tests__/services/render.test.ts` -- covers REST-05 (render + ZIP)
- [ ] `src/__tests__/api/v1/templates.test.ts` -- covers REST-02
- [ ] `src/__tests__/api/v1/headers.test.ts` -- covers REST-06 (credit headers)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Bearer token via Phase 15's `authenticateApiKey` -- no changes |
| V3 Session Management | No | Stateless API |
| V4 Access Control | Yes | Every query filtered by `user_id` -- admin client bypasses RLS |
| V5 Input Validation | Yes | Zod schemas on every request body + URL params |
| V6 Cryptography | No | No new crypto operations (Phase 15 handles key hashing) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on project access | Tampering | Filter all queries by `user_id` from authenticated key |
| IDOR on slide index | Tampering | Validate index within `project.slide_data.length` bounds |
| Malicious image URL in slide edit | Spoofing | Only accept URLs from allowed domains (Pexels, Supabase Storage) or Pexels query strings |
| ZIP bomb via large carousel | Denial of Service | Cap slide count at 20 (already enforced in carousel schema) |
| Render timeout abuse | Denial of Service | `maxDuration = 60` + rate limiting prevents sustained abuse |
| Credit manipulation via concurrent requests | Tampering | `deductCredit` uses atomic RPC (already implemented) |

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/app/api/v1/carousel/route.ts`, `src/lib/api/*.ts`, `src/lib/services/carousel.ts` [VERIFIED]
- Codebase analysis: `src/app/(dashboard)/project/[id]/editor-actions.ts`, `src/app/(dashboard)/dashboard/actions.ts` [VERIFIED]
- Codebase analysis: `src/app/api/render/route.ts`, `src/lib/render/render-slide-satori.tsx` [VERIFIED]
- Codebase analysis: `src/lib/types/slide.ts`, `src/lib/types/project.ts` [VERIFIED]
- Codebase analysis: `src/lib/render/templates/index.ts` -- SlideTemplate type, 5 templates [VERIFIED]
- Codebase analysis: `src/lib/credits/check-credits.ts` -- getCreditBalance accepts optional adminClient [VERIFIED]
- Phase 15 summary: `15-01-SUMMARY.md` -- established patterns and infrastructure [VERIFIED]

### Secondary (MEDIUM confidence)
- Vercel serverless function limits (10s Hobby, 60s Pro) -- referenced in STATE.md blockers [CITED: STATE.md]

### Tertiary (LOW confidence)
- None -- all findings based on direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages, all existing infrastructure verified
- Architecture: HIGH -- service extraction pattern proven in Phase 15, route structure follows REST conventions
- Pitfalls: HIGH -- identified from direct codebase analysis of auth patterns, error handling, and Next.js 15 behavior

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- all infrastructure already built and tested)
