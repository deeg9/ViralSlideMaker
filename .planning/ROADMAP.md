# Roadmap: TikTok Slideshow Creator

## Milestones

- v1.0 MVP - Phases 1-4 (shipped 2026-03-20)
- v1.1 Monetization & AI Images - Phases 5-7 (shipped)
- v1.2 Launch Readiness - Phases 8-9 (planned)
- v1.3 Rich Text Editing - Phases 10-14 (shipped 2026-03-27)
- v2.0 API & MCP Platform - Phases 15-18 (shipped 2026-04-07)
- v2.1 Text Effects - Phases 19-21 (shipped 2026-04-07)
- v2.2 Public REST API - Phases 22-25 (shipped 2026-04-09)
- v2.3 MCP Server - Phases 26-28 (shipped 2026-04-09)
- v2.4 Explore + Remix - Phases 29-33 (shipped 2026-04-27)
- v2.5 Public REST API Parity - Phases 34-39 (shipped 2026-04-28) — REST API now has full feature parity with the dashboard. ~21 new endpoints across 3 tiers (spec accuracy, project/slide CRUD, AI/Pexels/Explore/Bookmarks/Brand-Kit/Profile).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-4) - SHIPPED 2026-03-20</summary>

- [x] **Phase 1: Foundation and Auth** - Project scaffolding, Supabase setup, authentication, project CRUD, and base UI shell
- [x] **Phase 2: AI Generation and Image Rendering** - Core value loop: prompt to AI-generated carousel slides with stock photos, server-side rendering, and download
- [x] **Phase 3: Slide Editor** - Full editing capabilities: add/remove/reorder slides, text editing, image swap/upload, undo/redo, responsive layout
- [x] **Phase 4: Template System and Brand Kit** - Template switching post-generation, brand kit persistence, and auto-applied brand settings

### Phase 1: Foundation and Auth
**Goal**: Users can create accounts, log in, and manage slideshow projects in a clean app shell
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, PROJ-01, PROJ-02, PROJ-03, PROJ-04, UIUX-01
**Success Criteria** (what must be TRUE):
  1. User can create an account with email/password and log in
  2. User session persists across browser refresh without re-login
  3. User can create a new slideshow project, see it on a dashboard, and delete it
  4. User can save a project and return to it later with all data intact
  5. App has a clean, minimal design aesthetic consistent across all pages
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold Next.js app, Supabase auth setup, login/signup/logout flows
- [x] 01-02-PLAN.md -- Project CRUD, dashboard UI, app shell layout, visual checkpoint

### Phase 2: AI Generation and Image Rendering
**Goal**: Users can type a topic and receive a complete set of downloadable carousel slide images with AI-generated text and stock photos
**Depends on**: Phase 1
**Requirements**: AIGEN-01, AIGEN-02, AIGEN-03, REND-01, REND-02, REND-03, REND-04, TMPL-01, TMPL-02, UIUX-03
**Success Criteria** (what must be TRUE):
  1. User can enter a text prompt and receive a complete set of carousel slides with hook text, body copy, CTA, and background images
  2. Generated hook text uses TikTok-optimized patterns (curiosity gaps, pattern interrupts, POV hooks)
  3. User can choose a visual style template before generating, and slides render in that style
  4. Slides render as 1080x1920 images with text overlays baked in, consistent across devices
  5. User can download all slides as a ZIP or download individual slide images
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Types, schemas, templates, AI generation + Pexels integration, generation server action
- [x] 02-02-PLAN.md -- Render API, download system, slide UI components, project page, visual checkpoint

### Phase 3: Slide Editor
**Goal**: Users can fully edit AI-generated slideshows: manipulate slides, refine text, swap images, and undo mistakes
**Depends on**: Phase 2
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, EDIT-10, AIGEN-04, AIGEN-05, UIUX-02
**Success Criteria** (what must be TRUE):
  1. User can add, remove, reorder (drag-and-drop), and duplicate slides in a slideshow
  2. User can edit text overlay content, font size, color, and position on any slide
  3. User can search Pexels stock photos and swap a slide's background, or upload their own image
  4. User can regenerate a single slide's text or image query without affecting other slides
  5. User can undo and redo editing actions, and the app works on desktop and tablet browsers
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Editor state foundation: extended types, reducer with undo/redo, useSlideEditor hook (TDD)
- [x] 03-02-PLAN.md -- Editor UI components, dnd-kit drag-and-drop, server actions, image picker, project page integration, checkpoint

### Phase 4: Template System and Brand Kit
**Goal**: Users can switch visual styles after generation and save brand preferences that auto-apply to new slideshows
**Depends on**: Phase 3
**Requirements**: TMPL-03, TMPL-04, TMPL-05
**Success Criteria** (what must be TRUE):
  1. User can switch templates after generation and all slides re-render in the new style
  2. User can save a brand kit (custom colors, fonts, logo) to their account
  3. Brand kit settings apply automatically when the user generates new slideshows
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Template switching in editor, brand kit DB schema/types/merge function
- [x] 04-02-PLAN.md -- Brand kit settings page UI, auto-apply in generation and PNG rendering

</details>

<details>
<summary>v1.1 Monetization & AI Images (Phases 5-7) - SHIPPED</summary>

**Milestone Goal:** Add premium AI image generation via Google Imagen, Stripe-powered subscription tiers with credit system, and AI-generated social media captions.

- [x] **Phase 5: Credit Ledger & Usage Limits** - Database foundation, atomic credit system, balance display, and free tier usage gating
- [x] **Phase 6: Stripe Billing** - Subscription checkout, webhook lifecycle, customer portal, credit pack purchases, and upgrade prompts
- [x] **Phase 7: AI Images & Social Captions** - Imagen AI backgrounds in editor, auto-generated prompts, and multi-platform caption generation

### Phase 5: Credit Ledger & Usage Limits
**Goal**: Users have accurate credit balances that gate premium features, and free tier users have clear usage boundaries
**Depends on**: Phase 4
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-05, STRIPE-04
**Success Criteria** (what must be TRUE):
  1. Pro users receive their monthly credit allowance at the start of each billing cycle
  2. Credit balance displays in the top navbar and updates immediately after each AI generation
  3. Credits deduct atomically before AI operations with no possibility of double-spend under concurrent requests
  4. User can view a credit usage history showing date, action type, and amount for each transaction
  5. Free tier users hit a clear usage limit on project count and AI text generations per month
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md -- Database schema (subscriptions, credit_transactions, stripe_events), atomic RPC functions, credit service rewrite, tests
- [x] 05-02-PLAN.md -- Navbar credit display, credit history page, dashboard wiring, atomic generation deduction, visual checkpoint

### Phase 6: Stripe Billing
**Goal**: Users can subscribe to Pro, manage their subscription, and purchase extra credits through Stripe
**Depends on**: Phase 5
**Requirements**: STRIPE-01, STRIPE-02, STRIPE-03, STRIPE-05, CRED-04
**Success Criteria** (what must be TRUE):
  1. User can subscribe to Pro plan via Stripe Checkout and their subscription status reflects in the app immediately
  2. Subscription lifecycle events (renewal, cancellation, failed payment, plan change) sync to the database via webhooks without duplicates or data loss
  3. User can open Stripe Customer Portal to upgrade, downgrade, or cancel their subscription
  4. Free users see contextual upgrade prompts when they hit usage limits (not random nag screens)
  5. User can purchase extra credit packs via one-time Stripe payment and credits appear in their balance
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- Stripe SDK setup, webhook Route Handler with signature verification and idempotency, event-type-dispatched sync handlers, unit tests
- [x] 06-02-PLAN.md -- Checkout/portal/credit-pack server actions, subscription page wiring, upgrade prompt component, visual checkpoint

### Phase 7: AI Images & Social Captions
**Goal**: Users can generate AI-powered slide backgrounds and get ready-to-post social media captions for their carousels
**Depends on**: Phase 6
**Requirements**: IMAGEN-01, IMAGEN-02, IMAGEN-03, IMAGEN-04, CAPTION-01, CAPTION-02
**Success Criteria** (what must be TRUE):
  1. User can generate an AI slide background via Google Imagen from within the editor image picker
  2. Imagen prompts auto-generate from slide content (hook, body, topic) so the user does not need to write image prompts manually
  3. User can preview and edit the auto-generated Imagen prompt before spending a credit
  4. Free users see an "Upgrade to AI" button on slides instead of the generate option, serving as a low-friction upsell
  5. User can generate social media captions (TikTok, Instagram, LinkedIn) that reference actual slide content, not just the topic
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 07-01-PLAN.md -- Imagen lib (generate + refund), auto-prompt lib, caption lib, server actions, unit tests
- [x] 07-02-PLAN.md -- AI Generate tab in image picker, caption panel, editor wiring, free-user gate, visual checkpoint

</details>

<details>
<summary>v1.2 Launch Readiness (Phases 8-9) - planned</summary>

**Milestone Goal:** Get the app production-ready with Stripe Customer Portal, working export/download on Vercel serverless, and production deployment at viralslidemaker.com.

- [ ] **Phase 8: Stripe Portal & Serverless Export** - Customer Portal branding, serverless-compatible image rendering, and working download flow on Vercel
- [ ] **Phase 9: Production Deployment** - Environment variables, Stripe webhook endpoint, and domain configuration for viralslidemaker.com

### Phase 8: Stripe Portal & Serverless Export
**Goal**: Users can manage their subscription through a branded portal and download slide images from the Vercel-deployed app
**Depends on**: Phase 7
**Requirements**: PORTAL-01, PORTAL-02, EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):
  1. User can open Stripe Customer Portal from the app to cancel subscription or update payment method
  2. Stripe Customer Portal displays ViralSlideMaker branding (name/colors) instead of generic Stripe defaults
  3. User can download a single slide as a PNG image via the Export button
  4. User can download all slides as a ZIP file containing individual PNGs
  5. Export and rendering work on Vercel serverless without Puppeteer (serverless-compatible image pipeline)
**Plans**: 1 plan

Plans:
- [x] 28-01-PLAN.md -- stdio npm package (viralslidemaker-mcp) and MCP guide verification/fix

### Phase 9: Production Deployment
**Goal**: The app is live at viralslidemaker.com with all services correctly configured for production
**Depends on**: Phase 8
**Requirements**: PROD-01, PROD-02, PROD-03
**Success Criteria** (what must be TRUE):
  1. All environment variables (Supabase, Stripe, Gemini, Pexels, Imagen) are configured for production
  2. Stripe webhooks fire to the production URL and process events successfully
  3. The app is accessible at https://viralslidemaker.com with correct NEXT_PUBLIC_APP_URL
**Plans**: 1 plan

Plans:
- [x] 28-01-PLAN.md -- stdio npm package (viralslidemaker-mcp) and MCP guide verification/fix

</details>

<details>
<summary>v1.3 Rich Text Editing (Phases 10-14) - SHIPPED 2026-03-27</summary>

**Milestone Goal:** Give users professional-grade text editing tools in the slide editor -- fonts, styling, alignment with snap guides, and resizable text boxes.

- [x] **Phase 10: Foundation Refactor** - Fix export font rendering bug and extract shared style resolution utility (completed 2026-03-26)
- [x] **Phase 11: Bold & Italic** - Toggle bold/italic per text box with correct rendering in preview and export (completed 2026-03-27)
- [x] **Phase 12: Font Picker & Google Fonts** - Curated font selection with live preview, correct Satori TTF rendering, and server-side caching (completed 2026-03-27)
- [x] **Phase 13: Resizable Text Boxes** - Drag-handle resize for text boxes with persistence and correct export rendering (completed 2026-03-27)
- [x] **Phase 14: Alignment Snap Guides** - Visual guide lines and snapping when positioning text boxes on slides (completed 2026-03-27)

### Phase 10: Foundation Refactor
**Goal**: Exported slide images render in the correct template font, and all renderers share a single style resolution function
**Depends on**: Phase 9
**Requirements**: FOUND-01, FOUND-02
**Success Criteria** (what must be TRUE):
  1. User downloads a slide PNG and sees the correct template font (not Satori default Noto Sans)
  2. Changing a template in the editor produces identical text styling in both the browser preview and the exported PNG
  3. Adding a new style override field requires updating only one function, not multiple renderer copies
**Plans**: 1 plan

Plans:
- [x] 10-01-PLAN.md -- Extract resolveSlideStyles() shared utility, fix Satori font loading in render route

### Phase 11: Bold & Italic
**Goal**: Users can apply bold and italic formatting to individual text boxes and see it rendered correctly everywhere
**Depends on**: Phase 10
**Requirements**: STYLE-01, STYLE-02, STYLE-03
**Success Criteria** (what must be TRUE):
  1. User can click a Bold button to toggle bold on/off for any text box (hook or body) in the editor
  2. User can click an Italic button to toggle italic on/off for any text box in the editor
  3. Bold and italic settings survive save, reload, and undo/redo without losing state
  4. A slide exported as PNG renders bold and italic text identically to the browser preview
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [x] 11-01-PLAN.md -- Extend data model with bold/italic overrides, update resolveSlideStyles + font loading, add B/I toggle buttons to editor panel

### Phase 12: Font Picker & Google Fonts
**Goal**: Users can choose from a library of fonts for each text box, with live preview in the editor and correct rendering in exports
**Depends on**: Phase 11
**Requirements**: FONT-01, FONT-02, FONT-03, FONT-04
**Success Criteria** (what must be TRUE):
  1. User can open a font picker dropdown and select from a curated list of Google Fonts for any text box
  2. Each font in the dropdown renders in its own typeface so users can visually browse
  3. Selecting a font updates the browser preview immediately with the chosen font
  4. Exported PNG renders the user-selected font correctly (not a fallback or default)
  5. Repeated exports of the same slide do not re-download font files (server-side TTF caching works)
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 12-01-PLAN.md -- Font catalog, data model extension, dynamic server-side font loading for Satori export
- [x] 12-02-PLAN.md -- Font picker UI component, editor panel integration, client-side preview wiring, visual checkpoint

### Phase 13: Resizable Text Boxes
**Goal**: Users can resize text boxes by dragging handles, with dimensions persisted and rendered correctly in exports
**Depends on**: Phase 12
**Requirements**: RESIZE-01, RESIZE-02, RESIZE-03
**Success Criteria** (what must be TRUE):
  1. User can drag corner or edge handles on a text box to change its width
  2. Resized text box dimensions persist after saving and reloading the project
  3. Exported PNG renders the text box at the exact dimensions the user set in the editor
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [x] 13-01-PLAN.md -- Data model width fields, resolve-styles override support, replace react-draggable with react-rnd for drag+resize

### Phase 14: Alignment Snap Guides
**Goal**: Users get visual alignment feedback when positioning text boxes, making professional-looking layouts easy
**Depends on**: Phase 13
**Requirements**: ALIGN-01, ALIGN-02, ALIGN-03
**Success Criteria** (what must be TRUE):
  1. A dashed guide line appears when the user drags a text box near the horizontal or vertical center of the slide
  2. Guide lines appear when a text box edge aligns with another text box's edge or center
  3. Text boxes snap into aligned positions when dragged within a proximity threshold of a guide
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [x] 14-01-PLAN.md -- useAlignmentGuides hook + snap guide overlay in slide-preview.tsx

</details>

<details>
<summary>v2.0 API & MCP Platform (Phases 15-18) - SHIPPED 2026-04-07</summary>

**Milestone Goal:** Expose Viral Slide Maker as a developer platform with REST API endpoints and an MCP server, so AI agents can create carousels programmatically.

- [x] **Phase 15: Service Extraction & API Auth** - Extract Server Actions into shared services, API key management, rate limiting via Upstash Redis
- [x] **Phase 16: REST API Endpoints** - One-shot and granular carousel endpoints with credit metering headers
- [x] **Phase 17: MCP Server** - MCP tools wrapping REST API for AI agent integration via Streamable HTTP and npm package (completed 2026-04-07)
- [x] **Phase 18: API Documentation** - OpenAPI spec generation, interactive Scalar playground, and MCP connection guide (completed 2026-04-07)

### Phase 15: Service Extraction & API Auth
**Goal**: Developers can create and manage API keys that authenticate requests with rate limiting and credit deduction
**Depends on**: Phase 14
**Requirements**: AAUTH-01, AAUTH-02, AAUTH-03, AAUTH-04, AAUTH-05, AAUTH-06
**Success Criteria** (what must be TRUE):
  1. Developer can generate an API key from account settings and sees the key exactly once at creation time
  2. Developer can view a list of their API keys (masked) and revoke any key, immediately blocking further requests with that key
  3. An API request with a valid Bearer token authenticates successfully; an invalid or revoked token returns 401
  4. API requests exceeding the per-key rate limit receive a 429 response with retry-after information
  5. Each authenticated API request that consumes resources deducts credits from the developer's balance
**Plans**: 3 plans

Plans:
- [x] 15-01-PLAN.md -- Service extraction
- [x] 15-02-PLAN.md -- API auth + rate limiting
- [x] 15-03-PLAN.md -- API key management UI

**UI hint**: yes

### Phase 16: REST API Endpoints
**Goal**: Developers can create, edit, render, and download carousels entirely through REST API calls
**Depends on**: Phase 15
**Requirements**: REST-01, REST-02, REST-03, REST-04, REST-05, REST-06
**Success Criteria** (what must be TRUE):
  1. Developer can POST a topic string and receive a complete carousel (generated content + rendered images) in a single API call
  2. Developer can create a project, list templates, edit individual slides, and trigger renders through separate granular endpoints
  3. Developer can download rendered carousel images (individual PNGs or ZIP) via API response URLs
  4. Every API response includes x-credits-remaining and x-credits-used headers reflecting accurate credit state
**Plans**: 3 plans

Plans:
- [x] 16-01-PLAN.md -- One-shot endpoint
- [x] 16-02-PLAN.md -- Granular CRUD endpoints
- [x] 16-03-PLAN.md -- Render + download endpoints

### Phase 17: MCP Server
**Goal**: AI agents (Claude Code, OpenAI agents, etc.) can create and manage carousels through MCP tool calls
**Depends on**: Phase 16
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06
**Success Criteria** (what must be TRUE):
  1. An AI agent can call create_carousel with a topic and receive rendered carousel image URLs back
  2. An AI agent can call edit_slide and render_carousel to modify and re-render individual slides
  3. An AI agent can call list_templates to discover available visual styles before creating a carousel
  4. The MCP server is accessible as a Streamable HTTP endpoint deployed inside the Next.js app
  5. The MCP server is installable as an npm package and works via stdio transport for local AI agent use
**Plans**: 2 plans

Plans:
- [x] 17-01-PLAN.md -- MCP server route + 4 tool definitions (Streamable HTTP at /api/mcp)
- [x] 17-02-PLAN.md -- npm package entry point with stdio transport (HTTP client wrapper)

### Phase 18: API Documentation
**Goal**: Developers and AI agent builders have complete, interactive documentation to integrate with the API and MCP server
**Depends on**: Phase 17
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. An OpenAPI spec is auto-generated from API route schemas and stays in sync with code changes
  2. Developer can explore and test all API endpoints in an interactive Scalar playground at /docs
  3. MCP connection instructions explain how to configure Claude Code, Cursor, and other AI agents to connect to the MCP server
**Plans**: 1 plan

Plans:
- [x] 18-01-PLAN.md -- OpenAPI spec, Scalar playground, and MCP connection guide

</details>

<details>
<summary>v2.1 Text Effects (Phases 19-21) - SHIPPED 2026-04-07</summary>

**Milestone Goal:** Add text shadow, outline, and background highlight effects to make text stand out over images -- per-element controls, Satori-compatible rendering, zero new dependencies.

- [x] **Phase 19: Validation Spike & Data Model** - Confirm native Satori CSS support, define TextEffects type hierarchy, build shared resolveTextEffects() utility (completed 2026-04-07)
- [x] **Phase 20: Renderer Implementation** - Shadow, outline, and highlight rendering across all three renderers (completed 2026-04-07)
- [x] **Phase 21: Editor UI & Tight Highlight** - Text effects control panel with toggles/pickers/sliders (completed 2026-04-07)

See `.planning/milestones/v2.1-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v2.2 Public REST API (Phases 22-25) - SHIPPED 2026-04-09</summary>

**Milestone Goal:** Implement the full REST API with per-user API key authentication, rate limiting, credit enforcement, and all 10 OpenAPI-defined endpoints.

- [x] **Phase 22: Auth Foundation & Key Management** - API keys table, SHA-256 hashing, middleware bypass, Bearer auth pipeline, key management UI (completed 2026-04-09)
- [x] **Phase 23: Rate Limiting, Credits & Infrastructure** - Upstash Redis rate limiting, credit enforcement headers, structured errors, CORS, service extraction (completed 2026-04-09)
- [x] **Phase 24: REST Endpoints (Read)** - Templates, projects list/get/delete, single slide get -- read-only endpoints with no credit deduction (completed 2026-04-09)
- [x] **Phase 25: REST Endpoints (Write & Render)** - Carousel generation, project creation, slide update, render, download -- mutation and binary endpoints (completed 2026-04-09)

### Phase 22: Auth Foundation & Key Management
**Goal**: Developers can create, view, and revoke API keys, and authenticate API requests with Bearer tokens
**Depends on**: Phase 21
**Requirements**: KEY-01, KEY-02, KEY-03, KEY-04, KEY-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Developer can create a named API key in settings, sees the full `vsl_` token exactly once, and it is stored as a SHA-256 hash
  2. Developer can view a list of their keys showing name, masked prefix, created date, and last-used timestamp
  3. Developer can revoke a key and any subsequent API request using that key returns 401 immediately
  4. A curl request with `Authorization: Bearer vsl_...` to any `/api/v1/*` route authenticates successfully without triggering Supabase session middleware
  5. Settings page shows quick-start code snippets (curl, JavaScript, Python) after key creation
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 22-01-PLAN.md -- Database migration, middleware bypass, authenticateApiKey + withApiAuth HOC, unit tests
- [x] 22-02-PLAN.md -- Server actions (create/list/revoke), settings page UI, create dialog with snippets, revoke dialog, visual checkpoint

### Phase 23: Rate Limiting, Credits & Infrastructure
**Goal**: API requests are rate limited per key, credit-consuming operations enforce balances, and all responses follow a consistent structured format
**Depends on**: Phase 22
**Requirements**: RATE-01, RATE-02, RATE-03, CRED-01, CRED-02, CRED-03, INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. API requests exceeding the per-key sliding window limit receive a 429 response with `Retry-After` header
  2. All API responses include `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers
  3. Credit-consuming endpoints deduct via the existing atomic RPC; insufficient credits return 402 with `x-credits-remaining` header
  4. All API responses include `x-credits-remaining` and `x-credits-used` headers
  5. Error responses use structured JSON with codes matching the OpenAPI spec, and CORS headers are present for cross-origin consumers
**Plans**: 2 plans

Plans:
- [x] 23-01-PLAN.md -- Rate limiting (Upstash), structured errors, CORS, enhanced withApiAuth HOC
- [x] 23-02-PLAN.md -- Admin-client credit functions, project CRUD service extraction, carousel service stub

### Phase 24: REST Endpoints (Read)
**Goal**: Developers can query templates, list and retrieve projects, and fetch individual slides through the API
**Depends on**: Phase 23
**Requirements**: API-02, API-03, API-05, API-06, API-07
**Success Criteria** (what must be TRUE):
  1. Developer can GET `/api/v1/templates` and receive the list of available visual styles
  2. Developer can GET `/api/v1/projects` and see only their own projects (user scoping enforced)
  3. Developer can GET `/api/v1/projects/{id}` and receive the full project with all slides
  4. Developer can DELETE `/api/v1/projects/{id}` and the project is removed
  5. Developer can GET `/api/v1/projects/{id}/slides/{index}` and receive a single slide's data
**Plans**: 2 plans

Plans:
- [x] 24-01-PLAN.md -- Templates list + projects list endpoints
- [x] 24-02-PLAN.md -- Project get/delete + single slide get endpoints

### Phase 25: REST Endpoints (Write & Render)
**Goal**: Developers can create carousels, create projects, update slides, and render/download images entirely through the API
**Depends on**: Phase 24
**Requirements**: API-01, API-04, API-08, API-09, API-10
**Success Criteria** (what must be TRUE):
  1. Developer can POST `/api/v1/carousel` with a topic and receive a fully generated carousel with rendered slide images (1 credit deducted)
  2. Developer can POST `/api/v1/projects` to create an empty project
  3. Developer can PATCH `/api/v1/projects/{id}/slides/{index}` to update slide fields (text, image, position)
  4. Developer can POST `/api/v1/projects/{id}/render` and receive download URLs for all rendered slide images
  5. Developer can GET `/api/v1/projects/{id}/download` and receive a ZIP file containing all slide PNGs
**Plans**: 2 plans

Plans:
- [x] 25-01-PLAN.md -- Carousel generation, project creation, slide update (write mutations)
- [x] 25-02-PLAN.md -- Render URLs and ZIP download (binary output endpoints)

</details>

### v2.3 MCP Server (In Progress)

**Milestone Goal:** Build the MCP server so AI agents can create carousels through native MCP tool calls, wrapping the v2.2 REST API.

- [x] **Phase 26: MCP Transport & Auth** - Streamable HTTP endpoint at /api/mcp with Bearer auth, middleware bypass, rate limiting, and stateless Vercel-compatible transport (completed 2026-04-09)
- [x] **Phase 27: MCP Tools** - Four outcome-oriented tools (create_carousel, list_templates, edit_slide, render_carousel) calling the service layer with credit enforcement (completed 2026-04-09)
- [x] **Phase 28: stdio Package & Documentation** - npm package for local agent use via mcp-remote bridge, and verified MCP connection guide (completed 2026-04-09)

## Phase Details

### Phase 26: MCP Transport & Auth
**Goal**: The /api/mcp endpoint accepts MCP protocol requests with Bearer token authentication, rate limiting, and stateless transport compatible with Vercel serverless
**Depends on**: Phase 25
**Requirements**: TRANS-01, TRANS-02, TRANS-03, INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. An MCP client can connect to /api/mcp with a Bearer token and receive a valid MCP server response (protocol handshake succeeds)
  2. A request to /api/mcp without a valid Bearer token returns an authentication error (not a redirect to login)
  3. MCP requests from the same API key that exceed the rate limit receive appropriate rate-limited responses
  4. The MCP endpoint works correctly on Vercel (no in-memory session state; stateless transport mode)
**Plans**: 1 plan

Plans:
- [x] 26-01-PLAN.md -- MCP packages, auth adapter, route handler, middleware bypass

### Phase 27: MCP Tools
**Goal**: AI agents can complete the full carousel workflow -- discover templates, create a carousel, edit slides, and get download URLs -- through MCP tool calls
**Depends on**: Phase 26
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, INFRA-03
**Success Criteria** (what must be TRUE):
  1. An AI agent can call create_carousel with a topic string and receive a project ID with rendered slide URLs (1 credit deducted)
  2. An AI agent can call list_templates and receive the available visual styles with enough detail to make a selection
  3. An AI agent can call edit_slide to change text, image URL, or template on a specific slide in a project
  4. An AI agent can call render_carousel and receive download URLs for all slides in a project
  5. Tool descriptions are clear enough that an AI agent can complete the full workflow without external documentation
**Plans**: 1 plan

Plans:
- [x] 27-01-PLAN.md -- 4 MCP tool definitions (list_templates, create_carousel, edit_slide, render_carousel) with credit enforcement

### Phase 28: stdio Package & Documentation
**Goal**: Developers can install an npm package for local MCP agent use, and the MCP guide accurately reflects the working implementation
**Depends on**: Phase 27
**Requirements**: TRANS-04, DOC-01
**Success Criteria** (what must be TRUE):
  1. Running `npx viralslidemaker-mcp` with a valid API key connects to the hosted MCP server via stdio transport
  2. The MCP guide documents correct configuration for Claude Desktop and Cursor that works against the actual /api/mcp endpoint
  3. All code examples in the MCP guide (connection config, tool call examples) have been verified against the implementation
**Plans**: 1 plan

Plans:
- [ ] 28-01-PLAN.md -- stdio npm package (viralslidemaker-mcp) and MCP guide verification/fix

---

## v2.4 Explore + Remix (Phases 29-33) — PLANNED 2026-04-27

Community publishing + v0.dev-style fork-and-save. Built on `public.profiles` (shipped 2026-04-27). Architecture grounded in `.planning/research/explore-remix.md`.

### Phase 29: Schema, RPCs & Hero Storage
**Goal**: All Explore data structures exist in Postgres with RLS, the publish/fork/unpublish RPCs work atomically, and the `hero-thumbnails` storage bucket is provisioned — verifiable end-to-end via SQL alone with no UI yet.
**Depends on**: 260427-nxd (profiles table, shipped as a quick task)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06, SCHEMA-07, MOD-01, MOD-02
**Success Criteria** (what must be TRUE):
  1. `published_carousels`, `bookmarks`, `carousel_events` tables exist with RLS policies enforcing public-read / owner-write semantics
  2. `publish_carousel(...)` RPC validates ownership, generates a unique slug, snapshots `slide_data`, and inserts a published row
  3. `fork_published_carousel(p_id)` RPC atomically deep-copies into a new private `projects` row owned by the caller and increments `remix_count`
  4. `unpublish_carousel(p_id)` soft-deletes (sets `unpublished_at`) and the row stops appearing in feeds while preserving counters
  5. `hero-thumbnails` public Supabase Storage bucket exists with per-user-folder write RLS
  6. `is_hidden` and `is_featured` columns exist on `published_carousels` and admin can toggle them via Supabase Studio
  7. `claim_username` reserved-word list verified to include `explore` and `bookmarks`
**Plans**: 1-2 plans

Plans:
- [ ] 29-01-PLAN.md -- migration: tables, RLS, RPCs, hero-thumbnails bucket, username reserved-list patch

### Phase 30: Publish Flow
**Goal**: A user can click "Publish to Explore" inside the editor, confirm a title + tags in a modal, and end up with a public `/explore/[slug]` URL whose hero thumbnail and slide images render for anonymous viewers.
**Depends on**: Phase 29
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, MOD-03
**Success Criteria** (what must be TRUE):
  1. "Publish to Explore" button appears in the slide editor for saved carousels and opens a modal collecting title (required), description (optional), tags (max 5)
  2. On submit, server pre-renders slide 1 to PNG via existing Satori pipeline, uploads to `hero-thumbnails/${user_id}/${published_id}.png`, calls `publish_carousel` RPC, and redirects to `/explore/[slug]`
  3. `slide_data` image references that point at private user buckets are re-issued or copied into a public location at publish time, so anonymous visitors to `/explore/[slug]` see all slides correctly
  4. Tag input accepts free-form lowercase tags (server normalizes lower/trim/dedupe, max 24 chars each, ≤5 per carousel) stored as `text[]`
  5. Tag denylist server-side rejects offensive submissions
  6. Republish updates the `slide_data` snapshot and regenerates the hero thumbnail without changing the slug or counters
  7. "Manage Published" view on the dashboard lets the user unpublish or republish each of their published carousels
**Plans**: 2 plans

Plans:
- [ ] 30-01-PLAN.md -- publish modal UI + server action that calls publish_carousel + asset re-resolution
- [ ] 30-02-PLAN.md -- hero pre-render to public bucket + Manage Published dashboard view

### Phase 31: Explore Feed & Detail Page
**Goal**: `/explore` shows a card grid of published carousels with Trending/New/Featured tabs, infinite-scroll pagination, and a public `/explore/[slug]` detail page where any visitor (signed-in or not) can see all slides and click Fork.
**Depends on**: Phase 30
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-06, EXPL-07, EXPL-08, FORK-01, FORK-02, FORK-03, FORK-04, FORK-05, PERF-01
**Success Criteria** (what must be TRUE):
  1. `/explore` lists carousels in a card grid (hero thumbnail, title, `@username`, bookmark count, remix count) with three tabs: Trending (default), New, Featured
  2. `popularity_score` column refreshed every 10 minutes via `pg_cron` running an HN-style gravity formula; Trending tab orders by it
  3. `/explore/[slug]` server-renders the full carousel as a public page with creator profile link, all slide thumbnails, Fork CTA, Bookmark toggle
  4. Anonymous visitors can browse `/explore` and `/explore/[slug]`; clicking Fork or Bookmark while logged out routes to login
  5. Authenticated users clicking Fork land on `/dashboard/projects/[new_id]/edit` with the fork RPC having atomically deep-copied `slide_data`, stripped `brand_kit_id`, re-resolved brand-kit references to the forker's own brand kit, and incremented `remix_count`
  6. Forking does NOT consume credits
  7. Infinite-scroll pagination uses cursor-based queries (`popularity_score, published_at` for Trending; `published_at` for New)
  8. p95 feed query latency is <200ms with a 5,000-row seed dataset (`EXPLAIN ANALYZE` evidence in plan summary)
**Plans**: 2 plans

Plans:
- [ ] 31-01-PLAN.md -- /explore feed with tabs, cursor pagination, popularity_score pg_cron job
- [ ] 31-02-PLAN.md -- /explore/[slug] detail page + Fork RPC integration + brand-kit re-resolution

### Phase 32: Search & Tag Filters
**Goal**: Users can find carousels via full-text search and tag filter chips on the Explore page; empty-search state surfaces popular tags as discovery prompts.
**Depends on**: Phase 31
**Requirements**: EXPL-05, SEARCH-01, SEARCH-02, SEARCH-03
**Success Criteria** (what must be TRUE):
  1. `published_carousels.search_vector` is a generated `tsvector` column over `title || description || tags || creator.username` with weights, indexed via GIN
  2. Search box at top of `/explore` queries via `websearch_to_tsquery()` + `ts_rank` ordering, debounced 250ms client-side
  3. Tag filter chips on `/explore` scope the feed to carousels containing the selected tag; multiple tags AND together
  4. Empty-state for "no matches" surfaces the curated 12-tag pillset with friendly copy
  5. Search query latency is <150ms p95 against the 5,000-row seed dataset
**Plans**: 1 plan

Plans:
- [ ] 32-01-PLAN.md -- search_vector + GIN index + search UI + tag chip filters + empty-state pillset

### Phase 33: Bookmarks, Counters & Polish
**Goal**: Bookmarking works end-to-end across feed cards, the `/bookmarks` standalone page, and the detail page; the async view counter pipeline runs nightly without contention; small Trust & Safety polish items land.
**Depends on**: Phase 32
**Requirements**: BM-01, BM-02, BM-03, BM-04, PERF-02, PERF-03, DOC-01, DOC-02
**Success Criteria** (what must be TRUE):
  1. Bookmark toggle on every Explore card and detail page inserts/deletes a `public.bookmarks` row idempotently
  2. `/bookmarks` page lists the user's bookmarks (most-recent first) with the same card UX as `/explore` plus a Fork CTA
  3. The Bookmarks icon in the top nav (shipped in 260427-iun) is wired to `/bookmarks`
  4. `bookmark_count` updates via direct trigger on `bookmarks` insert/delete
  5. View tracking writes to `carousel_events` from the `/explore/[slug]` page; nightly `pg_cron` job aggregates events into `published_carousels.view_count`
  6. Hero thumbnails stay under 200KB
  7. PROJECT.md updated with v2.4 milestone summary; in-app docs page has a "How to publish" section
**Plans**: 2 plans

Plans:
- [ ] 33-01-PLAN.md -- bookmarks table integration: toggle component, /bookmarks page, top nav wire-up, bookmark_count trigger
- [ ] 33-02-PLAN.md -- carousel_events view tracking + nightly aggregation + thumbnail size cap + PROJECT.md + docs

### Phase 34: API Spec Accuracy (Tier 1)
**Goal**: `/docs` (Scalar API reference) accurately documents every field of every existing v1 route — no new endpoints, just bring the OpenAPI spec into line with the current `Slide` / `StyleOverrides` / `CustomText` / `Project` shapes and document the actual `/carousel` POST response. Lowest-risk way to ship value to customers reading the reference.
**Depends on**: Phase 33
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, SPEC-06, SPEC-07
**Success Criteria** (what must be TRUE):
  1. `Slide` schema lists `hook_segments` and `body_segments` (`TextSegment[]`)
  2. `StyleOverrides` schema lists `hook_text_effects`, `body_text_effects`, `layout`, `hide_watermark`
  3. `CustomText` schema lists `text_effects` and `segments`
  4. New `TextSegment` and `TextEffects` schemas exist in `components/schemas` and match `src/lib/types/slide.ts`
  5. `Project` schema lists `description` and `generation_status`
  6. `/carousel` POST 200 response shape documented as `{ success, projectId, slideCount }` (matches actual return)
  7. `npx tsc --noEmit` clean against `src/lib/api/openapi.ts`
  8. `curl /docs` renders without error and the new schemas appear when expanded in Scalar
**Plans**: 1 plan

Plans:
- [x] 34-01-PLAN.md -- expand openapi.ts schemas + verify Scalar render (shipped 2026-04-28)

### Phase 35: Project & Slide CRUD (Tier 2.A)
**Goal**: API customers can rename projects, change templates, edit every slide field the dashboard exposes (not just 5), and add / delete / reorder slides programmatically.
**Depends on**: Phase 34
**Requirements**: API-01, API-02, API-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. `PATCH /projects/{id}` updates `title` / `description` / `template_id` and rejects unknown fields
  2. `PATCH /projects/{id}/slides/{index}` accepts `custom_texts`, `custom_images`, `hook_segments`, `body_segments`, and `style_overrides.hide_watermark` in addition to the existing 5 fields, with deep-merge of `style_overrides`
  3. `POST /projects/{id}/slides` appends a new slide; optional `position` body param inserts at index
  4. `DELETE /projects/{id}/slides/{index}` removes a slide and adjusts subsequent indices
  5. `POST /projects/{id}/slides/reorder` validates `{order}` length matches and is a permutation, then applies
  6. Each new endpoint has a matching OpenAPI path entry in the same commit
  7. Each endpoint reuses `withApiAuth`, `apiSuccess`/`apiError`, and `updateProjectService` patterns
**Plans**: 2 plans

Plans:
- [ ] 35-01-PLAN.md -- PATCH /projects/{id} + expand PATCH /slides/{index} fields
- [ ] 35-02-PLAN.md -- POST/DELETE /slides + POST /slides/reorder

### Phase 36: Publish & Credits Read (Tier 2.B)
**Goal**: API customers can publish to Explore, unpublish, and read their own credit balance + tier.
**Depends on**: Phase 35
**Requirements**: API-06, API-07, API-08
**Success Criteria** (what must be TRUE):
  1. `POST /projects/{id}/publish` calls the existing `publish_carousel` RPC with hero render and returns `{ publishedId, slug, url }`
  2. `DELETE /projects/{id}/publish` calls `unpublish_carousel` RPC
  3. `GET /me/credits` returns `{ tier, balance, monthly_grant, period_end }` keyed off the existing `subscriptions` row
  4. Hero render path reuses `renderHero` logic from `publishProjectToExplore` server action (extract to a shared helper if needed)
  5. OpenAPI spec entries shipped in same commit
**Plans**: 1 plan

Plans:
- [ ] 36-01-PLAN.md -- /publish POST+DELETE + /me/credits GET

### Phase 37: AI & Image Sources (Tier 3.A)
**Goal**: API customers can swap stock backgrounds via Pexels search and trigger AI image / text regeneration on a per-slide basis.
**Depends on**: Phase 36
**Requirements**: API-09, API-10, API-11
**Success Criteria** (what must be TRUE):
  1. `POST /pexels/search` accepts `{ query, orientation?, perPage? }` and returns Pexels search results — free
  2. `POST /projects/{id}/slides/{index}/generate-image` calls existing Imagen path, writes URL to `slide.background_url`, deducts 1 credit, surfaces `x-credits-remaining`
  3. `POST /projects/{id}/slides/{index}/regenerate-text` accepts `{ field: 'hook' | 'body' }`, returns the new text — free
  4. Insufficient-credits returns 402 `INSUFFICIENT_CREDITS` per existing convention
  5. OpenAPI spec entries in same commit
**Plans**: 2 plans

Plans:
- [ ] 37-01-PLAN.md -- /pexels/search proxy + spec
- [ ] 37-02-PLAN.md -- generate-image + regenerate-text endpoints

### Phase 38: Explore, Bookmarks, Forking (Tier 3.B)
**Goal**: API customers can browse the Explore feed, view single published carousels, fork them, and manage their own bookmarks.
**Depends on**: Phase 37
**Requirements**: API-12, API-13, API-14, API-15, API-16, API-17
**Success Criteria** (what must be TRUE):
  1. `GET /explore` accepts `?sort=trending|new|featured&tag=&q=&cursor=` and returns `{ items, next_cursor }` matching the existing /explore page query
  2. `GET /explore/{slug}` returns the published carousel snapshot with creator profile snippet
  3. `POST /explore/{slug}/fork` calls `fork_published_carousel` RPC, returns `{ projectId }`
  4. `POST /me/bookmarks` and `DELETE /me/bookmarks/{publishedId}` insert/delete owner-only `bookmarks` rows
  5. `GET /me/bookmarks` returns most-recent-first list
  6. New `PublishedCarousel` schema added to OpenAPI spec
  7. Anonymous Explore reads supported via the existing public RLS policy on `published_carousels`
**Plans**: 2 plans

Plans:
- [ ] 38-01-PLAN.md -- /explore GET + /explore/{slug} GET + /explore/{slug}/fork POST
- [ ] 38-02-PLAN.md -- /me/bookmarks CRUD endpoints

### Phase 39: Brand Kit & Profile (Tier 3.C)
**Goal**: API customers can read and update their brand kit and public profile programmatically.
**Depends on**: Phase 38
**Requirements**: API-18, API-19, API-20, API-21, DOC-01, DOC-02
**Success Criteria** (what must be TRUE):
  1. `GET /me/brand-kit` returns the user's brand kit row (or null)
  2. `PUT /me/brand-kit` upserts brand kit; logo upload uses an upload-URL pattern (`POST /me/brand-kit/logo-upload-url` returns a signed PUT URL)
  3. `GET /me/profile` returns the `public.profiles` row (display_name, bio, avatar_url, website_url, social_links)
  4. `PATCH /me/profile` updates non-username fields
  5. PROJECT.md updated with v2.5 milestone summary
  6. README quickstart references new credits + publish endpoints
  7. End-to-end: a fresh customer with a brand-new API key can do everything the dashboard can — generate, edit, publish, fork, manage credits, manage profile — in one curl session
**Plans**: 2 plans

Plans:
- [ ] 39-01-PLAN.md -- /me/brand-kit GET + PUT + logo-upload-url + /me/profile GET + PATCH
- [ ] 39-02-PLAN.md -- PROJECT.md + README updates + e2e curl walk-through

---

## Progress

**Execution Order:**
Phases execute in numeric order: 26 -> 27 -> 28 -> 29 -> 30 -> 31 -> 32 -> 33

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Auth | v1.0 | 2/2 | Complete | 2026-03-19 |
| 2. AI Generation and Image Rendering | v1.0 | 2/2 | Complete | 2026-03-19 |
| 3. Slide Editor | v1.0 | 2/2 | Complete | 2026-03-19 |
| 4. Template System and Brand Kit | v1.0 | 2/2 | Complete | 2026-03-20 |
| 5. Credit Ledger & Usage Limits | v1.1 | 2/2 | Complete | - |
| 6. Stripe Billing | v1.1 | 2/2 | Complete | - |
| 7. AI Images & Social Captions | v1.1 | 2/2 | Complete | - |
| 8. Stripe Portal & Serverless Export | v1.2 | 0/0 | Not started | - |
| 9. Production Deployment | v1.2 | 0/0 | Not started | - |
| 10. Foundation Refactor | v1.3 | 1/1 | Complete | 2026-03-26 |
| 11. Bold & Italic | v1.3 | 1/1 | Complete | 2026-03-27 |
| 12. Font Picker & Google Fonts | v1.3 | 2/2 | Complete | 2026-03-27 |
| 13. Resizable Text Boxes | v1.3 | 1/1 | Complete | 2026-03-27 |
| 14. Alignment Snap Guides | v1.3 | 1/1 | Complete | 2026-03-27 |
| 15. Service Extraction & API Auth | v2.0 | 3/3 | Complete | 2026-04-07 |
| 16. REST API Endpoints | v2.0 | 3/3 | Complete | 2026-04-07 |
| 17. MCP Server | v2.0 | 2/2 | Complete | 2026-04-07 |
| 18. API Documentation | v2.0 | 1/1 | Complete | 2026-04-07 |
| 19. Validation Spike & Data Model | v2.1 | 2/2 | Complete | 2026-04-07 |
| 20. Renderer Implementation | v2.1 | 2/2 | Complete | 2026-04-07 |
| 21. Editor UI & Tight Highlight | v2.1 | 1/1 | Complete | 2026-04-07 |
| 22. Auth Foundation & Key Management | v2.2 | 2/2 | Complete | 2026-04-09 |
| 23. Rate Limiting, Credits & Infrastructure | v2.2 | 2/2 | Complete | 2026-04-09 |
| 24. REST Endpoints (Read) | v2.2 | 2/2 | Complete | 2026-04-09 |
| 25. REST Endpoints (Write & Render) | v2.2 | 2/2 | Complete | 2026-04-09 |
| 26. MCP Transport & Auth | v2.3 | 1/1 | Complete    | 2026-04-09 |
| 27. MCP Tools | v2.3 | 1/1 | Complete    | 2026-04-09 |
| 28. stdio Package & Documentation | v2.3 | 1/1 | Complete    | 2026-04-09 |
| 29. Schema, RPCs & Hero Storage | v2.4 | 1/1 | Complete | 2026-04-27 |
| 30. Publish Flow | v2.4 | 1/1 | Complete | 2026-04-27 |
| 31. Explore Feed & Detail Page | v2.4 | 1/1 | Complete | 2026-04-27 |
| 32. Search & Tag Filters | v2.4 | 1/1 | Complete | 2026-04-27 |
| 33. Bookmarks, Counters & Polish | v2.4 | 1/1 | Complete | 2026-04-27 |
| 34. API Spec Accuracy (Tier 1) | v2.5 | 1/1 | Complete | 2026-04-28 |
| 35. Project & Slide CRUD (Tier 2.A) | v2.5 | 2/2 | Complete | 2026-04-28 |
| 36. Publish & Credits Read (Tier 2.B) | v2.5 | 1/1 | Complete | 2026-04-28 |
| 37. AI & Image Sources (Tier 3.A) | v2.5 | 2/2 | Complete | 2026-04-28 |
| 38. Explore, Bookmarks, Forking (Tier 3.B) | v2.5 | 2/2 | Complete | 2026-04-28 |
| 39. Brand Kit & Profile (Tier 3.C) | v2.5 | 2/2 | Complete | 2026-04-28 |
