# Requirements: TikTok Slideshow Creator

**Defined:** 2026-03-24
**Core Value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.

## v1.0 Requirements (Complete)

All v1.0 requirements shipped and verified. See MILESTONES archive for details.

### AI Content Generation

- [x] **AIGEN-01**: User can enter a text prompt and receive a complete set of carousel slides — v1.0
- [x] **AIGEN-02**: Claude generates structured content per slide: hook text, body copy, image search queries, and closing CTA — v1.0
- [x] **AIGEN-03**: Hook text uses TikTok-optimized patterns (curiosity gaps, pattern interrupts, POV hooks, hot takes) — v1.0
- [x] **AIGEN-04**: User can regenerate a single slide's text without regenerating the entire slideshow — v1.0
- [x] **AIGEN-05**: User can regenerate a single slide's image query without affecting other slides — v1.0

### Slide Editor

- [x] **EDIT-01**: User can add new slides to an existing slideshow — v1.0
- [x] **EDIT-02**: User can remove slides from a slideshow — v1.0
- [x] **EDIT-03**: User can reorder slides via drag-and-drop — v1.0
- [x] **EDIT-04**: User can duplicate an existing slide — v1.0
- [x] **EDIT-05**: User can edit text overlay content on each slide — v1.0
- [x] **EDIT-06**: User can change text font size, color, and position on each slide — v1.0
- [x] **EDIT-07**: User can search Pexels stock photos and swap a slide's background image — v1.0
- [x] **EDIT-08**: User can upload their own images to use as slide backgrounds — v1.0
- [x] **EDIT-09**: User can undo and redo editing actions — v1.0
- [x] **EDIT-10**: User can preview all slides in sequence in the browser — v1.0

### Templates and Styling

- [x] **TMPL-01**: User can choose from 5-10 visual style templates before generating slides — v1.0
- [x] **TMPL-02**: Templates define layout, font choices, color palette, and text positioning — v1.0
- [x] **TMPL-03**: User can switch templates after generation and slides re-render in the new style — v1.0
- [x] **TMPL-04**: User can save a brand kit (custom colors, fonts, logo) to their account — v1.0
- [x] **TMPL-05**: Brand kit settings apply automatically when generating new slideshows — v1.0

### Image Rendering

- [x] **REND-01**: Slides render as 9:16 vertical images (1080x1920 pixels) with text overlays baked in — v1.0
- [x] **REND-02**: Image rendering happens server-side for consistent quality across all devices — v1.0
- [x] **REND-03**: User can download all slides as a ZIP file — v1.0
- [x] **REND-04**: User can download individual slide images one at a time — v1.0

### Projects and Persistence

- [x] **PROJ-01**: User can create a new slideshow project — v1.0
- [x] **PROJ-02**: User can save a project and return to edit it later — v1.0
- [x] **PROJ-03**: User can view a dashboard of all their saved projects — v1.0
- [x] **PROJ-04**: User can delete projects they no longer need — v1.0

### Authentication

- [x] **AUTH-01**: User can create an account with email and password — v1.0
- [x] **AUTH-02**: User session persists across browser refresh — v1.0
- [x] **AUTH-03**: User can log out from any page — v1.0

### UI/UX

- [x] **UIUX-01**: App has a clean, minimal design aesthetic — v1.0
- [x] **UIUX-02**: App is responsive and works on desktop and tablet browsers — v1.0
- [x] **UIUX-03**: Slide preview updates in real-time as user edits text or swaps images — v1.0

## v1.1 Requirements

Requirements for monetization, AI images, and captions milestone. Each maps to roadmap phases.

### Stripe & Subscriptions

- [ ] **STRIPE-01**: User can subscribe to Pro plan via Stripe Checkout
- [ ] **STRIPE-02**: Subscription status syncs to DB via Stripe webhooks (checkout completed, updated, deleted, payment failed)
- [ ] **STRIPE-03**: User can manage subscription (upgrade/downgrade/cancel) via Stripe Customer Portal
- [ ] **STRIPE-04**: Free tier users have usage limits (project count, AI text generations per month)
- [ ] **STRIPE-05**: Free users see contextual upgrade prompts when they hit limits

### Credit System

- [ ] **CRED-01**: Pro users receive monthly credit allowance at billing cycle start
- [ ] **CRED-02**: Credit balance displays in top navbar, updates after each generation
- [ ] **CRED-03**: Credits deduct atomically via Postgres RPC before AI image generation
- [ ] **CRED-04**: User can purchase extra credit packs via Stripe one-time payment
- [ ] **CRED-05**: User can view credit usage history (transaction log with date, action, amount)

### AI Image Generation

- [ ] **IMAGEN-01**: User can generate AI slide backgrounds via Google Imagen 4 Fast
- [ ] **IMAGEN-02**: Imagen prompts auto-generate from slide content (hook text, body, topic) without manual input
- [ ] **IMAGEN-03**: Free users see "Upgrade to AI" button on slides as low-friction upsell
- [ ] **IMAGEN-04**: User can preview and edit the auto-generated Imagen prompt before spending a credit

### Social Media Captions

- [ ] **CAPTION-01**: User can generate social media captions for their carousel (TikTok, Instagram, LinkedIn)
- [ ] **CAPTION-02**: Captions reference actual slide content (hooks, key points, CTA) rather than just the topic

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Platform Expansion

- **PLAT-01**: iOS native app (Expo/React Native) consuming the same server API
- **PLAT-02**: Aspect ratio variants (1:1 for Instagram grid, 16:9 for YouTube)

### Audio/Video

- **AV-01**: Background music selection from royalty-free library
- **AV-02**: Optional MP4 video export (animated slideshow with transitions)

### Social Integration

- **SOCL-01**: Auto-post carousels directly to TikTok via API
- **SOCL-02**: Auto-post carousels directly to Instagram via API

### Advanced AI

- **ADVAI-01**: Multiple AI image providers as alternatives to Imagen
- **ADVAI-02**: Content calendar / batch generation from topic list
- **ADVAI-03**: One-click style variations (same content in 3-4 different looks)
- **ADVAI-04**: Caption tone variants (professional, casual, viral)

### Growth

- **GROW-01**: Keyboard shortcuts for power users
- **GROW-02**: Template marketplace (user-created templates)
- **GROW-03**: Annual billing option
- **GROW-04**: Team/agency plans with shared credit pools

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI avatars / talking heads | Different product category -- this is faceless carousel content |
| Real-time collaboration | Solo creator tool, not a team product |
| Complex timeline editor | Slide-based model, not timeline-based |
| Video clip support | Images only -- slideshows are image-based |
| AI voiceover / TTS | Not applicable to static image carousels |
| Watermarks on free tier | Negative brand association -- use usage limits instead |
| OAuth login (Google, GitHub) | Email/password sufficient for now |
| Credit rollover across months | Complicates billing, creates balance sheet liability. Generous monthly allowance instead. |
| Multiple AI image providers | Multiplies maintenance. Imagen only, switch entirely if needed. |
| Real-time credit balance via WebSocket | Over-engineered. Credits change on explicit actions -- refetch after each call. |
| Annual billing | Adds proration complexity. Monthly only until pricing validates. |
| Imagen image editing (inpainting) | Significant UX scope. Generate-only for v1.1. |
| Auto-posting to TikTok/Instagram | Complex OAuth, frequent API changes. Defer to v2+. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRIPE-01 | TBD | Pending |
| STRIPE-02 | TBD | Pending |
| STRIPE-03 | TBD | Pending |
| STRIPE-04 | TBD | Pending |
| STRIPE-05 | TBD | Pending |
| CRED-01 | TBD | Pending |
| CRED-02 | TBD | Pending |
| CRED-03 | TBD | Pending |
| CRED-04 | TBD | Pending |
| CRED-05 | TBD | Pending |
| IMAGEN-01 | TBD | Pending |
| IMAGEN-02 | TBD | Pending |
| IMAGEN-03 | TBD | Pending |
| IMAGEN-04 | TBD | Pending |
| CAPTION-01 | TBD | Pending |
| CAPTION-02 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16 (pending roadmap creation)

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after v1.1 scoping*
