# Requirements: ViralSlideMaker

**Defined:** 2026-03-26
**Core Value:** Type a topic, get ready-to-post carousel slide images — fully AI-generated, editable, downloadable.

## v1.2 Requirements

Requirements for Launch Readiness milestone.

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

## Future Requirements

### Growth

- **GROWTH-01**: Auto-posting to TikTok/Instagram
- **GROWTH-02**: Analytics dashboard for carousel performance
- **GROWTH-03**: Native iOS app (Expo/React Native)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video export | Image carousels only — no video pipeline |
| Auto-posting | Complex OAuth, defer to v2+ |
| iOS app | Web first, validated before mobile |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PORTAL-01 | Phase 8 | Pending |
| PORTAL-02 | Phase 8 | Pending |
| EXPORT-01 | Phase 8 | Pending |
| EXPORT-02 | Phase 8 | Pending |
| EXPORT-03 | Phase 8 | Pending |
| PROD-01 | Phase 9 | Pending |
| PROD-02 | Phase 9 | Pending |
| PROD-03 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
