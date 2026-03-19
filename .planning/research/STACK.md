# Technology Stack

**Project:** TikTok Slideshow Creator
**Researched:** 2026-03-19
**Overall Confidence:** HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 15.5.x | Web application framework | Stable, battle-tested. v16 is out but v15.5 is the safer choice -- v16 has breaking changes (middleware replaced by proxy.ts, Turbopack default) and the ecosystem is still catching up. Remotion docs and community examples target Next.js 15. Upgrade to 16 when Remotion and shadcn fully stabilize on it. | HIGH |
| React | 19.x | UI library | Required by Next.js 15, Remotion 4.x, and shadcn/ui. React 19 is stable with Server Components, Actions, and improved hooks. | HIGH |
| TypeScript | 5.x | Type safety | Non-negotiable for a project this size. Remotion, Next.js, Anthropic SDK, and Supabase all have first-class TS support. | HIGH |

### Video Engine

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Remotion | 4.0.x (latest: 4.0.436) | Programmatic video creation | The only mature React-based video framework. Declarative composition, frame-by-frame React rendering, built-in Player component for browser preview, TikTok template available, Docker rendering support. Free for teams of 3 or fewer. No real alternative exists in this space. | HIGH |
| @remotion/player | 4.0.x | In-browser video preview | Embeddable React component that renders Remotion compositions in-browser without server rendering. Supports play/pause, seeking, custom controls. This IS the slideshow preview. | HIGH |
| @remotion/renderer | 4.0.x | Server-side MP4 rendering | Node.js API for headless rendering in Docker containers on RunPod. Uses Chromium + FFmpeg internally. | HIGH |

### Database & Backend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase | Latest | Database, auth, file storage | All-in-one backend: Postgres DB, Row Level Security, auth (email/social), file storage with presigned URLs for image uploads, real-time subscriptions if needed later. Free tier is generous (500MB DB, 1GB storage). Eliminates need to build auth, storage, and DB separately. | HIGH |
| Prisma | 6.x | ORM / type-safe queries | Layer on top of Supabase Postgres for type-safe queries, schema migrations, and generated types. Supabase client SDK is fine for auth/storage, but Prisma is better for complex relational queries (projects, slides, templates). Use Supabase for auth + storage, Prisma for data access. | MEDIUM |

### AI & Content Generation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @anthropic-ai/sdk | 0.79.x | Claude API access | Official TypeScript SDK. Streaming support, structured output, retries built-in. Use Claude 3.5 Sonnet for content generation (fast, cheap, good enough for slide copy). Call from Next.js API routes / Server Actions only. | HIGH |
| Pexels API | v1 | Stock photo search | Free, no attribution required for most uses. 200 req/hr, 20K req/month on free tier -- sufficient for MVP. Can request unlimited for free by emailing api@pexels.com with attribution. REST API, no official SDK needed (simple fetch wrapper). | HIGH |

### UI & Styling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | 4.x | Utility-first CSS | v4 stable since Jan 2025, Rust-based Oxide engine, CSS-native config with @theme. Faster builds, cleaner DX. shadcn/ui has full v4 support. | HIGH |
| shadcn/ui | Latest | Component library | Copy-paste components, not a dependency. Full Tailwind v4 + React 19 support. Clean, minimal aesthetic aligns with project design goals. Customizable to match "21st.dev" inspiration. | HIGH |
| Lucide React | Latest | Icons | Default icon set for shadcn/ui. Consistent, clean, tree-shakeable. | HIGH |

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | 5.x | Global app state | Slide editor needs a centralized store for project state (slides array, current slide, editor mode, undo/redo stack). Zustand's single-store model with slices is simpler and more debuggable than atomic state for this use case. Lightweight (1.2KB), no boilerplate. | HIGH |

**Why not Jotai:** Jotai's atomic model is better for deeply nested, independently-updating state (collaborative editors, spreadsheets). A slideshow editor has a relatively flat state shape -- a list of slides with properties. Zustand's slice pattern handles this cleanly with less cognitive overhead.

**Why not Redux:** Overkill. Zustand gives the same single-store benefits without the boilerplate.

### Slide Editor Internals

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| dnd-kit | 6.x | Drag-and-drop slide reordering | Best-in-class React DnD library. 10KB, zero deps, smooth animations, accessible. Use for reordering slides in the sidebar panel. | HIGH |
| Native DOM + CSS | -- | Text/image positioning on slides | Do NOT use Fabric.js or Konva for the slide canvas. Remotion compositions ARE the slides -- text overlays and image positioning are React components rendered by Remotion. The "editor" manipulates Remotion composition props (text content, position, font size, image URL), not a separate canvas. The Remotion Player renders the result in real-time. | HIGH |

This is a critical architectural insight: the slide editor does NOT need a canvas library. Each slide is a Remotion `<Composition>` rendered as React components. Editing means changing the data model (text, position, image) and letting Remotion re-render.

### Rendering Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| RunPod Serverless | -- | GPU/CPU container hosting | Scales to zero, per-second billing ($0.17-0.40/hr for low-end GPUs, CPU even cheaper). Docker-based. Cold starts as low as 2s with FlashBoot. Perfect for bursty rendering workloads. | HIGH |
| Docker | -- | Rendering container | Base image: `node:22-bookworm-slim`. Install Chromium + FFmpeg. Run @remotion/renderer in headless mode. Remotion docs have Docker guides. | HIGH |

**Why not Remotion Lambda:** Lambda is faster for distributed rendering of long videos (splits across many functions). Slideshow videos are short (15-60 seconds, 5-15 slides) -- a single container render is fast enough and simpler. RunPod gives more control, no AWS vendor lock-in, and is cheaper for CPU-bound rendering (Remotion does NOT need GPU -- it's Chromium + FFmpeg, both CPU-bound).

**Important:** Remotion rendering is CPU-bound, not GPU-bound. You do NOT need GPU instances on RunPod. Use CPU-only serverless workers for significant cost savings.

### File Storage & CDN

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase Storage | -- | Image uploads, rendered video storage | Presigned URL uploads bypass Next.js body size limits. Built-in image transformations. Videos stored here after RunPod renders them. CDN delivery included. | HIGH |

### Dev Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| pnpm | 9.x | Package manager | Faster, stricter than npm. Workspace support if needed later. | HIGH |
| ESLint | 9.x | Linting | Flat config, Next.js plugin, TypeScript support. | HIGH |
| Prettier | 3.x | Code formatting | Consistent style, Tailwind plugin for class sorting. | HIGH |
| Vitest | 2.x | Testing | Fast, Vite-native, good TypeScript support. Use for unit testing Remotion compositions and API routes. | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15.5 | Next.js 16 | v16 has breaking changes (proxy.ts replaces middleware), ecosystem still catching up. Upgrade later. |
| Framework | Next.js | Remix/Vite SPA | Remotion Player works best in React; Next.js has best Remotion community support and SSR for SEO/marketing pages. |
| Video Engine | Remotion | FFmpeg + custom React preview | Remotion IS FFmpeg + Chromium under the hood, but adds React composition, Player component, and rendering pipeline. Rolling your own gets you worse DX for no benefit. |
| Video Engine | Remotion | Motion Canvas | Motion Canvas is for animation/motion graphics, not slideshow/video composition. Different use case entirely. |
| Database | Supabase | Firebase | Supabase is Postgres (SQL, relational, RLS) vs Firestore (NoSQL). Slideshow data is relational (users -> projects -> slides). Supabase also has better pricing and no vendor lock-in. |
| Database | Supabase | PlanetScale/Neon + Clerk + S3 | Three services vs one. Supabase bundles DB + auth + storage. Less config, fewer bills, faster to ship. |
| ORM | Prisma | Drizzle | Drizzle is lighter and closer to SQL, but Prisma has better docs, migration tooling, and generated types. For a team that wants to move fast, Prisma's DX wins. |
| State | Zustand | Jotai | Jotai's atomic model adds complexity for a flat state shape. Zustand's single store with undo/redo middleware is simpler for a slide editor. |
| State | Zustand | Redux Toolkit | Unnecessary boilerplate for this project size. |
| Slide DnD | dnd-kit | react-beautiful-dnd | react-beautiful-dnd is in maintenance mode (Atlassian). dnd-kit is actively maintained and more performant. |
| Canvas | None (Remotion) | Fabric.js / Konva | Slides are Remotion React compositions, not canvas elements. Adding a canvas library would mean maintaining two rendering paths (canvas for editing, Remotion for export) -- a massive source of bugs. |
| Rendering | RunPod Serverless | AWS Lambda (Remotion Lambda) | Overkill for short videos. RunPod is simpler, cheaper for CPU-bound work, no AWS account needed. |
| Rendering | RunPod Serverless | Modal | Modal is also good but RunPod has better Docker support and is more established for media workloads. |
| Auth | Supabase Auth | Clerk / NextAuth | Already using Supabase. Adding another auth provider means two services to manage. Supabase Auth supports email, social (Google, GitHub), magic link -- sufficient for v1. |
| Stock Photos | Pexels | Unsplash | Both free. Pexels has no attribution requirement for API partners (easier for video rendering). Unsplash requires attribution, which is awkward in generated videos. |

## Installation

```bash
# Initialize Next.js 15.5 with TypeScript, Tailwind v4, App Router
pnpm create next-app@latest tiktok-slideshow --typescript --tailwind --eslint --app --src-dir

# Core dependencies
pnpm add remotion @remotion/player @remotion/cli @remotion/renderer
pnpm add @anthropic-ai/sdk
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add prisma @prisma/client
pnpm add zustand
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
pnpm add lucide-react
pnpm add sonner  # toast notifications (shadcn default)

# Dev dependencies
pnpm add -D @remotion/bundler
pnpm add -D vitest @testing-library/react
pnpm add -D prettier prettier-plugin-tailwindcss
pnpm add -D @types/node

# shadcn/ui initialization (run after project setup)
pnpm dlx shadcn@latest init
```

## Version Pinning Strategy

Pin major versions, allow patch updates:
- `remotion`: `^4.0.0` (v4 is current major, patch updates are safe)
- `next`: `~15.5.0` (stay on 15.5.x, don't auto-upgrade to 16)
- `@anthropic-ai/sdk`: `^0.79.0` (pre-1.0, but Anthropic maintains backward compat)
- `zustand`: `^5.0.0`
- `prisma`: `^6.0.0`

## Licensing Notes

- **Remotion**: Free for individuals and companies with 3 or fewer people. If the team grows past 3, a company license is required (paid). This is a hard constraint -- budget for it if scaling the team.
- **Pexels API**: Free. Default limits: 200 req/hr, 20K req/month. Can request unlimited free by emailing api@pexels.com with attribution.
- **Supabase**: Free tier (500MB DB, 1GB storage, 50K monthly active users). Pro tier $25/month when needed.
- **RunPod**: Pay-per-second. CPU serverless workers are cheapest. No minimum spend.

## Sources

- [Remotion official docs](https://www.remotion.dev/docs/) - HIGH confidence
- [Remotion licensing](https://www.remotion.dev/docs/license) - HIGH confidence
- [Remotion SSR comparison](https://www.remotion.dev/docs/compare-ssr) - HIGH confidence
- [Remotion Docker guide](https://crepal.ai/blog/aivideo/blog-how-to-run-remotion-in-docker/) - MEDIUM confidence
- [Remotion TikTok template](https://www.remotion.dev/templates/tiktok) - HIGH confidence
- [Next.js 15.5 blog](https://nextjs.org/blog/next-15-5) - HIGH confidence
- [Next.js 16 blog](https://nextjs.org/blog/next-16) - HIGH confidence
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) - HIGH confidence
- [Pexels API docs](https://www.pexels.com/api/documentation/) - HIGH confidence
- [Pexels rate limits](https://help.pexels.com/hc/en-us/articles/900005851863-Do-I-have-to-pay-for-higher-limits) - HIGH confidence
- [Supabase docs](https://supabase.com/docs) - HIGH confidence
- [Supabase storage presigned URLs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) - HIGH confidence
- [RunPod serverless docs](https://docs.runpod.io/serverless/overview) - HIGH confidence
- [RunPod pricing](https://docs.runpod.io/serverless/pricing) - HIGH confidence
- [shadcn/ui Tailwind v4 support](https://ui.shadcn.com/docs/tailwind-v4) - HIGH confidence
- [dnd-kit](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) - MEDIUM confidence
- [Zustand vs Jotai comparison](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k) - MEDIUM confidence
