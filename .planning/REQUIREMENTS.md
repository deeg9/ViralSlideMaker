# Requirements: TikTok Slideshow Creator

**Defined:** 2026-03-19
**Core Value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### AI Content Generation

- [x] **AIGEN-01**: User can enter a text prompt (topic or product description) and receive a complete set of carousel slides
- [x] **AIGEN-02**: Claude generates structured content per slide: hook text, body copy, image search queries, and closing CTA
- [x] **AIGEN-03**: Hook text uses TikTok-optimized patterns (curiosity gaps, pattern interrupts, POV hooks, hot takes)
- [x] **AIGEN-04**: User can regenerate a single slide's text without regenerating the entire slideshow
- [x] **AIGEN-05**: User can regenerate a single slide's image query without affecting other slides

### Slide Editor

- [x] **EDIT-01**: User can add new slides to an existing slideshow
- [x] **EDIT-02**: User can remove slides from a slideshow
- [x] **EDIT-03**: User can reorder slides via drag-and-drop
- [x] **EDIT-04**: User can duplicate an existing slide
- [x] **EDIT-05**: User can edit text overlay content on each slide
- [x] **EDIT-06**: User can change text font size, color, and position on each slide
- [x] **EDIT-07**: User can search Pexels stock photos and swap a slide's background image
- [x] **EDIT-08**: User can upload their own images to use as slide backgrounds
- [x] **EDIT-09**: User can undo and redo editing actions
- [x] **EDIT-10**: User can preview all slides in sequence in the browser

### Templates and Styling

- [x] **TMPL-01**: User can choose from 5-10 visual style templates before generating slides
- [x] **TMPL-02**: Templates define layout, font choices, color palette, and text positioning
- [ ] **TMPL-03**: User can switch templates after generation and slides re-render in the new style
- [ ] **TMPL-04**: User can save a brand kit (custom colors, fonts, logo) to their account
- [ ] **TMPL-05**: Brand kit settings apply automatically when generating new slideshows

### Image Rendering

- [x] **REND-01**: Slides render as 9:16 vertical images (1080x1920 pixels) with text overlays baked in
- [x] **REND-02**: Image rendering happens server-side for consistent quality across all devices
- [x] **REND-03**: User can download all slides as a ZIP file
- [x] **REND-04**: User can download individual slide images one at a time

### Projects and Persistence

- [x] **PROJ-01**: User can create a new slideshow project
- [x] **PROJ-02**: User can save a project and return to edit it later
- [x] **PROJ-03**: User can view a dashboard of all their saved projects
- [x] **PROJ-04**: User can delete projects they no longer need

### Authentication

- [x] **AUTH-01**: User can create an account with email and password
- [x] **AUTH-02**: User session persists across browser refresh
- [x] **AUTH-03**: User can log out from any page

### UI/UX

- [x] **UIUX-01**: App has a clean, minimal design aesthetic
- [x] **UIUX-02**: App is responsive and works on desktop and tablet browsers
- [x] **UIUX-03**: Slide preview updates in real-time as user edits text or swaps images

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

- **ADVAI-01**: AI-generated images (DALL-E, Flux) as alternative to stock photos
- **ADVAI-02**: Content calendar / batch generation from topic list
- **ADVAI-03**: One-click style variations (same content in 3-4 different looks)

### Growth

- **GROW-01**: Keyboard shortcuts for power users
- **GROW-02**: Template marketplace (user-created templates)

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI avatars / talking heads | Different product category -- this is faceless carousel content |
| Real-time collaboration | Solo creator tool, not a team product |
| Complex timeline editor | Slide-based model, not timeline-based -- keeps UX simple |
| Video clip support | Images only -- slideshows are image-based by definition |
| AI voiceover / TTS | Not applicable to static image carousels |
| Watermarks on free tier | Negative brand association -- use usage limits instead |
| OAuth login (Google, GitHub) | Email/password sufficient for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| PROJ-01 | Phase 1 | Complete |
| PROJ-02 | Phase 1 | Complete |
| PROJ-03 | Phase 1 | Complete |
| PROJ-04 | Phase 1 | Complete |
| UIUX-01 | Phase 1 | Complete |
| AIGEN-01 | Phase 2 | Complete |
| AIGEN-02 | Phase 2 | Complete |
| AIGEN-03 | Phase 2 | Complete |
| REND-01 | Phase 2 | Complete |
| REND-02 | Phase 2 | Complete |
| REND-03 | Phase 2 | Complete |
| REND-04 | Phase 2 | Complete |
| TMPL-01 | Phase 2 | Complete |
| TMPL-02 | Phase 2 | Complete |
| UIUX-03 | Phase 2 | Complete |
| EDIT-01 | Phase 3 | Complete |
| EDIT-02 | Phase 3 | Complete |
| EDIT-03 | Phase 3 | Complete |
| EDIT-04 | Phase 3 | Complete |
| EDIT-05 | Phase 3 | Complete |
| EDIT-06 | Phase 3 | Complete |
| EDIT-07 | Phase 3 | Complete |
| EDIT-08 | Phase 3 | Complete |
| EDIT-09 | Phase 3 | Complete |
| EDIT-10 | Phase 3 | Complete |
| AIGEN-04 | Phase 3 | Complete |
| AIGEN-05 | Phase 3 | Complete |
| UIUX-02 | Phase 3 | Complete |
| TMPL-03 | Phase 4 | Pending |
| TMPL-04 | Phase 4 | Pending |
| TMPL-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
