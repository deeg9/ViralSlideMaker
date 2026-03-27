# Roadmap: TikTok Slideshow Creator

## Milestones

- v1.0 MVP - Phases 1-4 (shipped 2026-03-20)
- v1.1 Monetization & AI Images - Phases 5-7 (shipped)
- v1.2 Launch Readiness - Phases 8-9 (planned)
- v1.3 Rich Text Editing - Phases 10-14 (in progress)

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

### v1.3 Rich Text Editing (Phases 10-14)

**Milestone Goal:** Give users professional-grade text editing tools in the slide editor -- fonts, styling, alignment with snap guides, and resizable text boxes.

- [x] **Phase 10: Foundation Refactor** - Fix export font rendering bug and extract shared style resolution utility (completed 2026-03-26)
- [x] **Phase 11: Bold & Italic** - Toggle bold/italic per text box with correct rendering in preview and export (completed 2026-03-27)
- [x] **Phase 12: Font Picker & Google Fonts** - Curated font selection with live preview, correct Satori TTF rendering, and server-side caching (completed 2026-03-27)
- [ ] **Phase 13: Resizable Text Boxes** - Drag-handle resize for text boxes with persistence and correct export rendering
- [ ] **Phase 14: Alignment Snap Guides** - Visual guide lines and snapping when positioning text boxes on slides

## Phase Details

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
- [ ] 10-01-PLAN.md -- Extract resolveSlideStyles() shared utility, fix Satori font loading in render route

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
- [ ] 11-01-PLAN.md -- Extend data model with bold/italic overrides, update resolveSlideStyles + font loading, add B/I toggle buttons to editor panel

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
- [ ] 12-02-PLAN.md -- Font picker UI component, editor panel integration, client-side preview wiring, visual checkpoint

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
- [ ] 13-01-PLAN.md -- Data model width fields, resolve-styles override support, replace react-draggable with react-rnd for drag+resize

### Phase 14: Alignment Snap Guides
**Goal**: Users get visual alignment feedback when positioning text boxes, making professional-looking layouts easy
**Depends on**: Phase 13
**Requirements**: ALIGN-01, ALIGN-02, ALIGN-03
**Success Criteria** (what must be TRUE):
  1. A dashed guide line appears when the user drags a text box near the horizontal or vertical center of the slide
  2. Guide lines appear when a text box edge aligns with another text box's edge or center
  3. Text boxes snap into aligned positions when dragged within a proximity threshold of a guide
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12 -> 13 -> 14

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
| 10. Foundation Refactor | v1.3 | 0/1 | Complete    | 2026-03-26 |
| 11. Bold & Italic | v1.3 | 0/1 | Complete    | 2026-03-27 |
| 12. Font Picker & Google Fonts | v1.3 | 1/2 | Complete    | 2026-03-27 |
| 13. Resizable Text Boxes | v1.3 | 0/1 | Not started | - |
| 14. Alignment Snap Guides | v1.3 | 0/0 | Not started | - |
