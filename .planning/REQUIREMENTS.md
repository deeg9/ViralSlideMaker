# Requirements: ViralSlideMaker

**Defined:** 2026-04-07
**Core Value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.

## v2.1 Requirements

Requirements for Text Effects milestone.

### Text Effects Data Model

- [ ] **FX-01**: User's text effect settings (shadow, outline, highlight) persist across save/load
- [ ] **FX-02**: Each text element (hook, body, custom text boxes) has independent effect settings

### Text Shadow

- [ ] **SHAD-01**: User can toggle text shadow on/off for any text element
- [ ] **SHAD-02**: User can pick shadow color via swatches and custom color picker
- [ ] **SHAD-03**: User can select shadow size from S/M/L presets

### Text Outline

- [ ] **OUT-01**: User can toggle text outline on/off for any text element
- [ ] **OUT-02**: User can pick outline color via swatches and custom color picker
- [ ] **OUT-03**: User can adjust outline thickness via slider (1-8px)

### Background Highlight

- [ ] **HL-01**: User can toggle background highlight on/off for any text element
- [ ] **HL-02**: User can pick highlight color via swatches and custom color picker
- [ ] **HL-03**: User can choose between tight (marker) and full-width (banner) highlight styles
- [ ] **HL-04**: User can adjust highlight padding via slider (4-24px)

### Rendering

- [ ] **REND-01**: Text effects render correctly in the editor preview (real CSS)
- [ ] **REND-02**: Text effects render correctly in Satori PNG export (native textShadow/WebkitTextStroke)
- [ ] **REND-03**: Text effects render correctly in HTML export
- [ ] **REND-04**: Tight highlight gracefully falls back to full-width in Satori export if needed

### Validation

- [ ] **VAL-01**: Validation spike confirms native Satori support for textShadow and WebkitTextStroke before full implementation

## Previous Milestone Requirements

<details>
<summary>v1.3 Rich Text Editing</summary>

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

### Advanced Text Effects

- **ADV-FX-01**: Gradient text fill
- **ADV-FX-02**: Neon glow effect with blur
- **ADV-FX-03**: Curved text

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video export | Image carousels only -- no video pipeline |
| Auto-posting | Complex OAuth, defer to v2+ |
| iOS app | Web first, validated before mobile |
| Inline rich text | Per-word bold/italic within a text box -- too complex for short carousel text, breaks Satori rendering |
| Full rich text editor (TipTap/Slate) | Overkill for 5-15 word text boxes, adds massive complexity |
| Gradient text / neon glow / blur | Requires rendering pipeline switch to Playwright -- defer until after v2.1 feedback |
| Curved text | Not supported by Satori -- requires rendering pipeline switch |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FX-01 | Pending | Pending |
| FX-02 | Pending | Pending |
| SHAD-01 | Pending | Pending |
| SHAD-02 | Pending | Pending |
| SHAD-03 | Pending | Pending |
| OUT-01 | Pending | Pending |
| OUT-02 | Pending | Pending |
| OUT-03 | Pending | Pending |
| HL-01 | Pending | Pending |
| HL-02 | Pending | Pending |
| HL-03 | Pending | Pending |
| HL-04 | Pending | Pending |
| REND-01 | Pending | Pending |
| REND-02 | Pending | Pending |
| REND-03 | Pending | Pending |
| REND-04 | Pending | Pending |
| VAL-01 | Pending | Pending |

**Coverage:**
- v2.1 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17

---
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-07 after v2.1 requirements definition*
