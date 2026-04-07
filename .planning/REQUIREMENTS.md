# Requirements: Viral Slide Maker

**Defined:** 2026-04-07
**Core Value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.

## v2.0 Requirements

Requirements for API & MCP Platform milestone. Each maps to roadmap phases.

### API Auth

- [x] **AAUTH-01**: Developer can generate API keys from account settings page
- [x] **AAUTH-02**: Developer can revoke/delete API keys from settings
- [ ] **AAUTH-03**: API requests authenticate via Bearer token in Authorization header
- [ ] **AAUTH-04**: API keys are SHA-256 hashed in storage (shown once on creation, never again)
- [ ] **AAUTH-05**: API requests are rate-limited per key via Upstash Redis (serverless-safe)
- [ ] **AAUTH-06**: API calls deduct credits from the developer's existing credit balance

### REST API

- [ ] **REST-01**: Developer can generate a full carousel from a text prompt in one API call (one-shot)
- [ ] **REST-02**: Developer can list available templates via API
- [ ] **REST-03**: Developer can create/list/get/delete projects via API
- [ ] **REST-04**: Developer can edit individual slides (change text, swap image, restyle) via API
- [ ] **REST-05**: Developer can trigger render and download carousel images (individual or ZIP) via API
- [ ] **REST-06**: API responses include credit usage headers (x-credits-remaining, x-credits-used)

### MCP Server

- [ ] **MCP-01**: AI agents can create carousels via MCP `create_carousel` tool
- [ ] **MCP-02**: AI agents can edit individual slides via MCP `edit_slide` tool
- [ ] **MCP-03**: AI agents can render and download carousels via MCP `render_carousel` tool
- [ ] **MCP-04**: AI agents can list available templates via MCP `list_templates` tool
- [ ] **MCP-05**: MCP server deploys as Streamable HTTP endpoint inside Next.js app
- [ ] **MCP-06**: MCP server is publishable as npm package for local stdio transport

### Documentation

- [ ] **DOCS-01**: OpenAPI spec auto-generated from API route schemas
- [ ] **DOCS-02**: Interactive API documentation via Scalar playground
- [ ] **DOCS-03**: MCP server connection instructions for Claude Code and other AI agents

## Previous Milestone Requirements

<details>
<summary>v1.3 Rich Text Editing (Complete)</summary>

### Foundation

- [x] **FOUND-01**: Exported PNG slides render in the correct template font (fix Satori font loading bug)
- [x] **FOUND-02**: Style resolution logic is consolidated into a shared `resolveSlideStyles()` utility used by all renderers

### Text Styling

- [x] **STYLE-01**: User can toggle bold on/off for each text box (hook text, body text)
- [x] **STYLE-02**: User can toggle italic on/off for each text box
- [x] **STYLE-03**: Bold and italic settings persist across save/reload and render correctly in PNG exports

### Font Selection

- [x] **FONT-01**: User can select a font from a curated list of Google Fonts for each text box
- [x] **FONT-02**: Font picker shows a live preview of each font in the dropdown
- [x] **FONT-03**: Selected fonts render correctly in both browser preview and PNG export (Satori)
- [x] **FONT-04**: Server-side font loading caches TTF files to avoid re-fetching on every export

### Text Box Sizing

- [x] **RESIZE-01**: User can resize text boxes by dragging corner/edge handles
- [x] **RESIZE-02**: Text box dimensions persist across save/reload
- [x] **RESIZE-03**: Resized text boxes render correctly in PNG exports at the specified dimensions

### Alignment Guides

- [x] **ALIGN-01**: Visual guide lines appear when dragging a text box near the horizontal or vertical center of the slide
- [x] **ALIGN-02**: Visual guide lines appear when a text box edge aligns with another text box's edge
- [x] **ALIGN-03**: Text boxes snap to guide positions when within proximity threshold

</details>

## Future Requirements

### API Extensions

- **AEXT-01**: Webhook notifications when async generation jobs complete
- **AEXT-02**: TypeScript/Python SDK client libraries
- **AEXT-03**: Developer portal landing page with signup flow
- **AEXT-04**: Standalone API-only pricing plans (separate from web subscription)
- **AEXT-05**: OAuth2 flow for third-party app integrations

### Growth

- **GROWTH-01**: Auto-posting to TikTok/Instagram
- **GROWTH-02**: Analytics dashboard for carousel performance
- **GROWTH-03**: Native iOS app (Expo/React Native)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Scheduled/recurring generation | Claude Code and other agents handle scheduling, not our API |
| GraphQL API | Unnecessary complexity -- REST is simpler and sufficient for this surface area |
| Image hosting/CDN | Rendered images returned as download URLs with TTL, not permanently hosted |
| Real-time streaming (SSE) | Generation is fast enough for sync responses; async pattern only if timeout hit |
| OAuth2 provider | Complex, low value for v2.0 -- API keys are sufficient |
| Separate API pricing tiers | API shares existing subscription credit pool -- avoid billing complexity |
| Video export | Image carousels only -- no video pipeline |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AAUTH-01 | Phase 15 | Complete |
| AAUTH-02 | Phase 15 | Complete |
| AAUTH-03 | Phase 15 | Pending |
| AAUTH-04 | Phase 15 | Pending |
| AAUTH-05 | Phase 15 | Pending |
| AAUTH-06 | Phase 15 | Pending |
| REST-01 | Phase 16 | Pending |
| REST-02 | Phase 16 | Pending |
| REST-03 | Phase 16 | Pending |
| REST-04 | Phase 16 | Pending |
| REST-05 | Phase 16 | Pending |
| REST-06 | Phase 16 | Pending |
| MCP-01 | Phase 17 | Pending |
| MCP-02 | Phase 17 | Pending |
| MCP-03 | Phase 17 | Pending |
| MCP-04 | Phase 17 | Pending |
| MCP-05 | Phase 17 | Pending |
| MCP-06 | Phase 17 | Pending |
| DOCS-01 | Phase 18 | Pending |
| DOCS-02 | Phase 18 | Pending |
| DOCS-03 | Phase 18 | Pending |

**Coverage:**
- v2.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-06 after roadmap creation for v2.0*
