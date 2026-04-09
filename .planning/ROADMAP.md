# Roadmap: TikTok Slideshow Creator

## Milestones

- v1.0 MVP - Phases 1-4 (shipped 2026-03-20)
- v1.1 Monetization & AI Images - Phases 5-7 (shipped)
- v1.2 Launch Readiness - Phases 8-9 (planned)
- v1.3 Rich Text Editing - Phases 10-14 (shipped 2026-03-27)
- v2.0 API & MCP Platform - Phases 15-18 (shipped 2026-04-07)
- v2.1 Text Effects - Phases 19-21 (shipped 2026-04-07)
- v2.2 Public REST API - Phases 22-25 (shipped 2026-04-09)
- v2.3 MCP Server - Phases 26-28 (in progress)

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
**Plans**: TBD

### Phase 9: Production Deployment
**Goal**: The app is live at viralslidemaker.com with all services correctly configured for production
**Depends on**: Phase 8
**Requirements**: PROD-01, PROD-02, PROD-03
**Success Criteria** (what must be TRUE):
  1. All environment variables (Supabase, Stripe, Gemini, Pexels, Imagen) are configured for production
  2. Stripe webhooks fire to the production URL and process events successfully
  3. The app is accessible at https://viralslidemaker.com with correct NEXT_PUBLIC_APP_URL
**Plans**: TBD

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
- [ ] **Phase 28: stdio Package & Documentation** - npm package for local agent use via mcp-remote bridge, and verified MCP connection guide

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
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 26 -> 27 -> 28

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
| 28. stdio Package & Documentation | v2.3 | 0/0 | Not started | - |
