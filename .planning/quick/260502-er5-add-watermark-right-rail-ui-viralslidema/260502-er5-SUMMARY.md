---
quick_id: 260502-er5
description: Add watermark right-rail UI — ViralSlideMaker toggle + custom upload, tier-gated
date: 2026-05-02
status: complete
final_commit: 0b2dc16
---

# Summary: Watermark right-rail UI

Shipped tier-aware per-slide watermark controls in the editor right rail, replicating Canva/CapCut's free-tier-branded-watermark-as-upgrade-hook pattern.

## Commits

| # | Hash | What |
|---|---|---|
| C1 | `238977f` | Schema + 3-branch resolver + 3 renderer wire-ups + 8 new resolver tests |
| C2 | `41ac397` | `<WatermarkControls>` component + mount in text-editor-panel |
| C3 | `9c6d42a` | `updateSlideWatermark` server action + slide-editor handlers |
| C4 | `0b2dc16` | 12 component tests (tier gating, patch emission, preview state) |

## Test trajectory

- **Before:** 764 pass / 13 pre-existing fail
- **After:** 784 pass / 13 pre-existing fail (+20 new, zero new failures)

## Visual QA the user should run

1. **Free tier flow:** Sign in as a free user → open any project → right rail → scroll past Photo Treatment → Watermark card visible with Switch ON + disabled, "Pro" chip, upgrade hint. Click switch → no-op. No position picker. No upload button.
2. **Paid tier toggle:** Sign in as Pro user → Watermark card → Switch OFF by default → toggle ON → ViralSlideMaker watermark appears bottom-left in canvas preview within ~1s.
3. **Position picker:** Pro user with watermark on → click "Bottom Right" → preview re-renders with watermark on the right.
4. **Custom logo:** Pro user → click "Upload logo" → pick a PNG → after upload, 32px preview + Remove button appears in the card; preview canvas shows custom logo bottom-left (or bottom-right if previously selected). Click "Remove" → preview returns to ViralSlideMaker mark.
5. **Render parity:** Generate a fresh ZIP export with watermark on Pro tier → exported PNGs match the editor preview byte-for-byte (TPLREND-05).

## Tier behavior (locked)

| Tier | Switch | Default | Custom logo | Position |
|---|---|---|---|---|
| free | locked-on | always rendered | ❌ | bottom-left only |
| plus | functional | OFF | ✅ | bottom-left / bottom-right |
| pro | functional | OFF | ✅ | bottom-left / bottom-right |

## Deviations from plan

- **Position picker shipped in MVP** rather than deferred (plan listed it as "if cheap; <10 LOC each side"). Two radio buttons + a `position` field in the patch — turned out to be 12 LOC. The user explicitly mentioned bottom-right in their original request.
- **No new bucket created.** Reused `slide-backgrounds` (project-scoped, RLS already correct) per the plan agent's recommendation in C3.
- **Custom-logo upload via existing `createUploadUrl()`** — no new upload mechanism. Single 22-line handler in slide-editor.tsx.

## Deferred (post-PMF)

- Opacity slider (current 0.55 hardcoded)
- Size slider (current LOGO_SIZE_FRAC hardcoded)
- Project-level default watermark scope (currently per-slide only)
- brand-kit-tied watermark for "set once, applies to all projects" UX
- AI-generated watermark suggestions
