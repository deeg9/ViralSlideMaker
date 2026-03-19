# Architecture Patterns

**Domain:** AI-powered TikTok slideshow video creator
**Researched:** 2026-03-19

## Recommended Architecture

A three-tier system with strict separation between the editor frontend, the orchestration API, and the render worker. This mirrors how production video creation platforms are structured and maps cleanly to the project's constraints (Next.js frontend, RunPod serverless rendering, Claude API for content generation).

```
+--------------------------------------------------+
|                   FRONTEND                        |
|  Next.js App (App Router)                         |
|                                                   |
|  +------------+  +------------+  +-----------+    |
|  | Slide      |  | Remotion   |  | Image     |    |
|  | Editor UI  |  | <Player>   |  | Picker    |    |
|  +------+-----+  +------+-----+  +-----+-----+   |
|         |               |              |           |
|         +-------+-------+------+-------+           |
|                 |              |                    |
|          [Zustand Store]  [Upload to S3]           |
+-----------|------------|---------------------------+
            |            |
            v            v
+--------------------------------------------------+
|              ORCHESTRATION API                    |
|  Next.js API Routes (or standalone)               |
|                                                   |
|  /api/generate    - Claude content generation     |
|  /api/images      - Pexels search proxy           |
|  /api/uploads     - Presigned URL generation      |
|  /api/render      - Trigger render on RunPod      |
|  /api/render/[id] - Poll render status            |
|  /api/projects    - CRUD for saved projects       |
+-----------|--------------------------------------+
            |
            v
+--------------------------------------------------+
|              RENDER WORKER                        |
|  RunPod Serverless (Docker container)             |
|                                                   |
|  +------------+  +------------+  +-----------+    |
|  | Remotion   |  | Chromium   |  | FFmpeg    |    |
|  | bundle()   |  | Headless   |  | Encoder   |    |
|  +------+-----+  +------+-----+  +-----+-----+   |
|         |               |              |           |
|         +---> renderMedia() ---------->+           |
|                                        |           |
|                              [Upload MP4 to S3]    |
+--------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Runtime |
|-----------|---------------|-------------------|---------|
| **Slide Editor UI** | Add/remove/reorder slides, edit text, configure styles | Zustand store, Image Picker | Browser |
| **Remotion Player** | Real-time video preview in browser (no rendering) | Reads from Zustand store | Browser |
| **Image Picker** | Pexels search + user upload interface | API routes, S3/storage | Browser |
| **Zustand Store** | Single source of truth for slideshow project state | All frontend components | Browser |
| **API: /generate** | Calls Claude API, returns structured slide content | Claude API | Server (Node.js) |
| **API: /images** | Proxies Pexels API (hides API key, adds caching) | Pexels API | Server (Node.js) |
| **API: /uploads** | Generates presigned upload URLs | S3-compatible storage | Server (Node.js) |
| **API: /render** | Sends render job to RunPod, returns job ID | RunPod API | Server (Node.js) |
| **API: /projects** | CRUD operations for saved slideshow projects | Database | Server (Node.js) |
| **Render Worker** | Receives project data, runs Remotion renderMedia(), uploads MP4 | S3 storage | RunPod container |

### Data Flow

**1. Content Generation Flow (User prompt to slides)**

```
User types prompt
  -> POST /api/generate { prompt, slideCount, style }
  -> Claude API (structured output: array of slide objects)
  -> Response: { slides: [{ hookText, bodyText, imageQuery, ctaText }] }
  -> Zustand store updated with generated slides
  -> Remotion Player re-renders preview automatically
```

**2. Image Resolution Flow (Each slide gets an image)**

```
For each slide.imageQuery:
  -> GET /api/images?q={query}&orientation=portrait
  -> Pexels API search (cached server-side, 200 req/hr limit)
  -> Response: { photos: [{ id, src: { portrait, large } }] }
  -> User selects image OR uploads custom image
  -> If upload: POST /api/uploads -> presigned URL -> PUT to S3
  -> Zustand store updated with image URL per slide
```

**3. Video Render Flow (Project data to MP4)**

```
User clicks "Export"
  -> POST /api/render { projectData: entireZustandState }
  -> API serializes project data as Remotion inputProps
  -> API calls RunPod serverless endpoint
  -> RunPod spins up container with pre-built Remotion bundle
  -> Worker: selectComposition() with inputProps
  -> Worker: renderMedia() (Chromium renders frames, FFmpeg encodes)
  -> Worker: uploads MP4 to S3
  -> Worker: returns S3 URL to RunPod
  -> Frontend polls GET /api/render/{jobId} for status
  -> On complete: user gets download link
```

**4. Project Persistence Flow**

```
Auto-save or manual save:
  -> POST /api/projects { name, slides, settings }
  -> Stored in database (project JSON + metadata)
  -> On load: GET /api/projects/{id} -> hydrate Zustand store
```

## Patterns to Follow

### Pattern 1: Shared Remotion Composition (Code Sharing)

The same React component powers both the in-browser Player preview and the server-side render. This is Remotion's recommended architecture.

**What:** Write your slideshow composition once in a `remotion/` directory. Import it into the Player on the frontend. Bundle it into the Docker image for the render worker.

**Why:** Guarantees visual parity between preview and export. Single source of truth for layout, animations, and transitions.

**Structure:**
```
src/
  remotion/
    Root.tsx              # Registers all compositions
    TikTokSlideshow.tsx   # Main composition component
    Slide.tsx             # Individual slide component
    transitions/          # Transition effects
  app/                    # Next.js app directory
    page.tsx              # Editor page
    api/                  # API routes
  components/
    Editor/               # Slide editor UI components
    Player/               # Remotion Player wrapper
```

**Confidence:** HIGH -- This is directly from Remotion's official code-sharing documentation.

### Pattern 2: Serializable Project State (InputProps)

**What:** The entire slideshow project must be serializable as JSON. This JSON becomes the `inputProps` passed to the Remotion composition. The Zustand store shape IS the Remotion inputProps shape.

**Why:** The render worker has no access to browser state. Everything it needs must arrive as a JSON payload. If the store shape matches inputProps, no transformation layer is needed.

**Example shape:**
```typescript
interface Project {
  id: string;
  name: string;
  settings: {
    fps: 30;
    width: 1080;
    height: 1920;
    durationPerSlide: number; // seconds
    transition: 'fade' | 'slide' | 'zoom';
  };
  slides: Array<{
    id: string;
    order: number;
    hookText?: string;
    bodyText?: string;
    ctaText?: string;
    imageUrl: string; // Must be an absolute URL accessible by the worker
    textStyle: {
      fontFamily: string;
      fontSize: number;
      color: string;
      position: 'top' | 'center' | 'bottom';
    };
  }>;
}
```

**Confidence:** HIGH -- This follows Remotion's inputProps pattern and is the standard approach in all Remotion templates.

### Pattern 3: API Proxy for Third-Party Services

**What:** Never call Claude or Pexels directly from the browser. Route through Next.js API routes that hold API keys as server-side environment variables.

**Why:** API keys must stay server-side. The proxy also enables caching (especially for Pexels, which has a 200 req/hr rate limit), request validation, and response transformation.

**Confidence:** HIGH -- Standard web security practice.

### Pattern 4: Async Render with Polling

**What:** POST /api/render returns a job ID immediately. The frontend polls GET /api/render/{jobId} for progress. The RunPod worker reports progress via callback or the RunPod status API.

**Why:** Video rendering takes 30 seconds to several minutes. Synchronous HTTP would time out. RunPod serverless natively supports this pattern with job status endpoints.

**Confidence:** HIGH -- This is exactly how the Remotion render server template works and how RunPod serverless is designed.

### Pattern 5: Zustand for Editor State

**What:** Use Zustand (not Redux, not Context) for the slide editor state.

**Why:** Zustand is lightweight, works well with React, supports middleware (persist for auto-save, immer for immutable updates), and avoids the boilerplate of Redux or the re-render issues of Context. The video editor community has converged on Zustand for this type of application.

**Confidence:** MEDIUM -- Based on community patterns from multiple Next.js video editor projects. Zustand is the most common choice but Jotai or Redux Toolkit would also work.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Rendering of Export Video

**What:** Attempting to render the final MP4 in the user's browser using WebCodecs or @remotion/web-renderer.

**Why bad:** Browser rendering is limited to a subset of HTML elements, unreliable across devices, slow, and cannot use FFmpeg. The quality and consistency gap compared to server-side rendering is significant.

**Instead:** Always render exports server-side on RunPod. The browser Player is for preview only.

### Anti-Pattern 2: Coupling Editor UI to Remotion Internals

**What:** Having editor controls directly manipulate Remotion frames, timelines, or internal APIs.

**Why bad:** Creates tight coupling. The editor should manage project data (which slides, what text, which images). The Remotion composition reads that data and handles all visual rendering. Mixing concerns makes both harder to maintain.

**Instead:** Editor writes to Zustand store. Remotion Player reads from Zustand store. They never call each other directly.

### Anti-Pattern 3: Storing Images as Base64 in Project State

**What:** Embedding user-uploaded images as base64 strings in the project JSON.

**Why bad:** Bloats project data massively. A single image can be 2-5MB as base64. The project JSON gets sent to the render worker -- you do not want multi-megabyte payloads. Also breaks Remotion's image loading (it expects URLs).

**Instead:** Upload images to S3-compatible storage, store only the URL in project state. The render worker fetches images by URL during rendering.

### Anti-Pattern 4: Running Multiple Concurrent Renders Per Worker

**What:** Allowing a single RunPod worker container to handle multiple renderMedia() calls simultaneously.

**Why bad:** Each render spawns a Chromium headless instance. Multiple instances compete for CPU and memory, causing OOM crashes or corrupted output. The official Remotion render server template explicitly serializes renders for this reason.

**Instead:** One render per worker instance. Use RunPod's auto-scaling to handle concurrency -- it spins up additional containers as needed.

## Key Architecture Decisions

### Why RunPod Over Lambda or Cloud Run

| Factor | Lambda | Cloud Run | RunPod Serverless |
|--------|--------|-----------|-------------------|
| Max execution time | 15 min | 60 min | Configurable (long) |
| Cold start | Fast (distributed) | Moderate | Moderate |
| GPU access | No | Limited | Yes (if needed later) |
| Cost at low volume | Pay per invoke | Pay per invoke | Pay per second |
| Remotion support | Official (@remotion/lambda) | Alpha | Custom Docker |
| Vendor lock-in | AWS ecosystem | GCP ecosystem | Minimal (Docker) |
| Scale to zero | Yes | Yes | Yes |

**Recommendation:** Start with RunPod serverless because the project specifies it and it provides the most flexibility. The Docker container approach means you can migrate to any container platform later (Cloud Run, Fly.io, Railway) without code changes.

**Important tradeoff:** Lambda has official Remotion support with distributed rendering (faster for long videos). RunPod requires a custom Docker setup using the Node.js renderMedia() API. For TikTok slideshows (typically 15-60 seconds, 5-10 slides), single-machine rendering is fast enough -- distributed rendering is overkill.

**Confidence:** MEDIUM -- RunPod + Remotion is not a documented pattern. Lambda is officially supported. But RunPod's flexibility and the project's constraints make it the right call.

### Why S3-Compatible Storage is Required

Both user uploads and rendered videos need a persistent storage layer accessible by both the frontend and the render worker. Options:

- **AWS S3** -- Standard, works with presigned URLs
- **Cloudflare R2** -- S3-compatible, no egress fees, cheaper
- **Supabase Storage** -- S3-compatible, integrates with Supabase auth if used

**Recommendation:** Cloudflare R2 for cost efficiency, or Supabase Storage if using Supabase for auth/database.

### Database for Project Persistence

Projects are JSON documents with metadata. Options:

- **Supabase (Postgres + auth)** -- Full-featured, includes auth, storage, and database in one platform
- **PlanetScale/Neon (Postgres)** -- If auth is handled separately

**Recommendation:** Supabase. It covers auth, database, and storage in a single platform, reducing integration complexity for v1.

## Suggested Build Order (Dependencies)

The architecture has clear dependency chains that dictate build order:

```
Phase 1: Foundation
  Remotion composition (TikTokSlideshow.tsx, Slide.tsx)
  Zustand store (project state shape)
  Remotion Player integration (preview in browser)
  -> These three form the core loop: edit state -> see preview

Phase 2: Content Generation
  Claude API route (/api/generate)
  Pexels API route (/api/images)
  Image picker UI
  -> Depends on: Zustand store shape from Phase 1

Phase 3: Persistence & Auth
  Supabase setup (auth + database + storage)
  Project CRUD API routes
  Image upload flow (presigned URLs -> S3/R2)
  -> Depends on: Store shape from Phase 1

Phase 4: Video Export
  RunPod Docker container (Remotion + Chromium + FFmpeg)
  Render API route (/api/render)
  Render status polling UI
  -> Depends on: Remotion composition from Phase 1, Storage from Phase 3

Phase 5: Polish
  Transitions, animations, templates
  Gallery/style system
  Error handling, loading states, edge cases
```

**Why this order:**
- Phase 1 must come first because the Remotion composition and store shape are the foundation everything else depends on.
- Phase 2 is next because without AI content generation, testing the editor means manually creating slides.
- Phase 3 before Phase 4 because the render worker needs S3 storage to upload results, and you need storage for user image uploads.
- Phase 4 is the most complex infrastructure piece but also the most independently testable once the composition exists.

## Scalability Considerations

| Concern | At 10 users | At 1K users | At 100K users |
|---------|-------------|-------------|---------------|
| Rendering | Single RunPod worker, sequential | RunPod auto-scale 3-5 workers | RunPod auto-scale, consider Lambda for distributed rendering |
| Storage | Supabase free tier | R2/S3 with CDN | CDN + lifecycle policies to delete old renders |
| Claude API | Per-request, low volume | Rate limit awareness, retry logic | Queue + rate limiting, consider caching common prompts |
| Pexels API | 200 req/hr sufficient | Server-side cache critical | Dedicated cache layer, consider premium API tier |
| Database | Supabase free tier | Supabase Pro | Connection pooling, read replicas |

## Future: Expo/React Native iOS App

The architecture supports code sharing with a future iOS app:

- **Remotion compositions** are pure React components -- they can be previewed in React Native using @remotion/player (if RN support is added) or by rendering a WebView that loads the Player.
- **Zustand store** works identically in React Native.
- **API routes** are consumed via HTTP -- the mobile app calls the same endpoints.
- **The render worker** is completely decoupled -- no changes needed for mobile.

The main challenge will be the editor UI itself, which will need to be rebuilt in React Native components. But the data layer (store shape, API contracts, Remotion compositions) carries over directly.

## Sources

- [Remotion Code Sharing (Player + SSR)](https://www.remotion.dev/docs/player/integration) -- HIGH confidence
- [Remotion SSR with Node.js](https://www.remotion.dev/docs/ssr-node) -- HIGH confidence
- [Remotion SSR Comparison](https://www.remotion.dev/docs/compare-ssr) -- HIGH confidence
- [Remotion Player docs](https://www.remotion.dev/docs/player/player) -- HIGH confidence
- [Remotion Render Server Template](https://deepwiki.com/remotion-dev/template-render-server) -- HIGH confidence
- [Remotion renderMedia() API](https://www.remotion.dev/docs/renderer/render-media) -- HIGH confidence
- [RunPod Serverless Overview](https://docs.runpod.io/serverless/overview) -- HIGH confidence
- [Pexels API Documentation](https://www.pexels.com/api/documentation/) -- HIGH confidence
- [React Video Editor (Remotion + Next.js)](https://www.reactvideoeditor.com/) -- MEDIUM confidence
- [Remotion Next.js Template](https://www.remotion.dev/templates/next) -- HIGH confidence
