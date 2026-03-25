---
phase: 7
slug: ai-images-social-captions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 7 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Imagen image generation | IMAGEN-01 | External API call | Generate AI background in editor, verify image appears |
| Auto-prompt from slide content | IMAGEN-02 | AI output quality | Check generated prompt matches slide content |
| Prompt preview/edit UI | IMAGEN-04 | UI interaction | Verify prompt dialog shows, edit works, credits deduct |
| Free user upgrade button | IMAGEN-03 | UI flow | Log in as free user, verify "Upgrade to AI" shows |
| Multi-platform captions | CAPTION-01 | AI output quality | Generate captions, verify TikTok/IG/LinkedIn variants |
| Carousel-aware captions | CAPTION-02 | Content quality | Verify captions reference slide hooks/CTAs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
