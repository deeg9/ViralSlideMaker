# Requirements: ViralSlideMaker

**Defined:** 2026-03-26
**Core Value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.

## v1.3 Requirements

Requirements for Rich Text Editing milestone.

### Foundation

- [x] **FOUND-01**: Exported PNG slides render in the correct template font (fix Satori font loading bug)
- [x] **FOUND-02**: Style resolution logic is consolidated into a shared `resolveSlideStyles()` utility used by all renderers

### Text Styling

- [x] **STYLE-01**: User can toggle bold on/off for each text box (hook text, body text)
- [x] **STYLE-02**: User can toggle italic on/off for each text box
- [x] **STYLE-03**: Bold and italic settings persist across save/reload and render correctly in PNG exports

### Font Selection

- [ ] **FONT-01**: User can select a font from a curated list of Google Fonts for each text box
- [ ] **FONT-02**: Font picker shows a live preview of each font in the dropdown
- [x] **FONT-03**: Selected fonts render correctly in both browser preview and PNG export (Satori)
- [x] **FONT-04**: Server-side font loading caches TTF files to avoid re-fetching on every export

### Text Box Sizing

- [ ] **RESIZE-01**: User can resize text boxes by dragging corner/edge handles
- [ ] **RESIZE-02**: Text box dimensions persist across save/reload
- [ ] **RESIZE-03**: Resized text boxes render correctly in PNG exports at the specified dimensions

### Alignment Guides

- [ ] **ALIGN-01**: Visual guide lines appear when dragging a text box near the horizontal or vertical center of the slide
- [ ] **ALIGN-02**: Visual guide lines appear when a text box edge aligns with another text box's edge
- [ ] **ALIGN-03**: Text boxes snap to guide positions when within proximity threshold

## Previous Milestone Requirements

<details>
<summary>v1.2 Launch Readiness</summary>

### Stripe Portal

- [ ] **PORTAL-01**: User can manage their subscription via Stripe Customer Portal (cancel, update payment method)
- [ ] **PORTAL-02**: Stripe Customer Portal is configured with branding (ViralSlideMaker name/colors)

### Export

- [ ] **EXPORT-01**: User can download individual slide as PNG via the Export button
- [ ] **EXPORT-02**: User can download all slides as a ZIP file
- [ ] **EXPORT-03**: Export/render works on Vercel serverless (serverless-compatible image rendering)

### Production

- [ ] **PROD-01**: All environment variables configured for production (viralslidemaker.com)
- [ ] **PROD-02**: Stripe webhook endpoint configured for production URL
- [ ] **PROD-03**: NEXT_PUBLIC_APP_URL set to https://viralslidemaker.com in production

</details>

## Future Requirements

### Growth

- **GROWTH-01**: Auto-posting to TikTok/Instagram
- **GROWTH-02**: Analytics dashboard for carousel performance
- **GROWTH-03**: Native iOS app (Expo/React Native)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video export | Image carousels only -- no video pipeline |
| Auto-posting | Complex OAuth, defer to v2+ |
| iOS app | Web first, validated before mobile |
| Inline rich text | Per-word bold/italic within a text box -- too complex for short carousel text, breaks Satori rendering |
| Full rich text editor (TipTap/Slate) | Overkill for 5-15 word text boxes, adds massive complexity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 10 | Complete |
| FOUND-02 | Phase 10 | Complete |
| STYLE-01 | Phase 11 | Complete |
| STYLE-02 | Phase 11 | Complete |
| STYLE-03 | Phase 11 | Complete |
| FONT-01 | Phase 12 | Pending |
| FONT-02 | Phase 12 | Pending |
| FONT-03 | Phase 12 | Complete |
| FONT-04 | Phase 12 | Complete |
| RESIZE-01 | Phase 13 | Pending |
| RESIZE-02 | Phase 13 | Pending |
| RESIZE-03 | Phase 13 | Pending |
| ALIGN-01 | Phase 14 | Pending |
| ALIGN-02 | Phase 14 | Pending |
| ALIGN-03 | Phase 14 | Pending |

**Coverage:**
- v1.3 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after v1.3 roadmap creation*
