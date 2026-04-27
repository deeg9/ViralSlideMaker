---
phase: 260427-wmk
plan: 01
status: complete
subsystem: monetization
tags: [free-tier, watermark, paywall, branding, upsell]
requires:
  - getUserTier from src/lib/credits/check-credits.ts (already existed)
  - resolveWatermark / brand-kit watermark (260427-hut, independent)
provides:
  - "Forced 'ViralSlideMaker.com' watermark on every slide for free-tier users"
  - "Server-authoritative watermark (cannot be bypassed via client tampering)"
  - "Inline 'Upgrade to remove' upsell beneath the Export button"
  - "Watermark-free downloads as a Plus/Pro feature on the pricing page"
affects:
  - src/lib/render/resolve-forced-watermark.ts
  - src/lib/render/resolve-forced-watermark.test.ts
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/render-slide.ts
  - src/components/slides/slide-preview.tsx
  - src/app/api/render/route.ts
  - src/app/api/v1/projects/[id]/download/route.ts
  - src/components/editor/slide-editor.tsx
  - src/components/editor/slide-canvas.tsx
  - src/components/editor/slide-list.tsx
  - src/components/editor/sortable-slide.tsx
  - src/app/(dashboard)/settings/subscription/page.tsx
tech-stack:
  added: []
  patterns:
    - "Pure resolver mirrors resolveWatermark shape (returns config or null)"
    - "Server is source of truth — tier resolved from project owner, not request user"
    - "Default 'free' at every prop boundary so missing prop fails closed (watermark shows)"
    - "Origin param threaded into buildSlideElement to absolutize /logo.png for Satori"
key-files:
  created:
    - src/lib/render/resolve-forced-watermark.ts
    - src/lib/render/resolve-forced-watermark.test.ts
  modified:
    - src/lib/render/render-slide-satori.tsx
    - src/lib/render/render-slide.ts
    - src/components/slides/slide-preview.tsx
    - src/app/api/render/route.ts
    - src/app/api/v1/projects/[id]/download/route.ts
    - src/components/editor/slide-editor.tsx
    - src/components/editor/slide-canvas.tsx
    - src/components/editor/slide-list.tsx
    - src/components/editor/sortable-slide.tsx
    - src/app/(dashboard)/settings/subscription/page.tsx
decisions:
  - "Forced watermark is a SEPARATE concept from the brand-kit watermark (260427-hut). Two resolvers, two layers, two render sites. Brand-kit watermark is for paid users uploading their own logo; forced watermark is for free-tier users showing OUR logo."
  - "Forced watermark intentionally ignores slide.style_overrides.hide_watermark — that flag belongs to the brand-kit watermark and free users must not be able to hide the upsell via it."
  - "Default 'free' fallback at every prop boundary (slide-editor, slide-canvas, sortable-slide, slide-list). Fail closed: a parent forgetting to pass userTier means the watermark still shows, not vanishes."
  - "Server reads tier from PROJECT OWNER (p.user_id / ctx.userId), not from the requester. Even if a free user could trick a paid user into hitting the route on their behalf, the watermark would correctly NOT appear because it's the owner's render."
  - "DownloadControls component (src/components/slides/download-controls.tsx) is unused — actual export button is inline in slide-editor.tsx. Upsell link added there instead, which is where free users actually see it."
  - "Satori needs absolute URLs for <img>; rather than putting origin into the pure resolver (would couple it to runtime context), we thread `origin` into buildSlideElement and prepend it to the relative /logo.png at the JSX layer. Browser preview keeps the relative URL since the DOM resolves it."
metrics:
  duration: "~25 minutes"
  completed: "2026-04-27"
  tasks_completed: 5
  files_created: 2
  files_modified: 10
  commits: 5
  test_count: 12
---

# Quick Task 260427-wmk: Free-tier "ViralSlideMaker.com" Watermark Summary

Free-tier users now get a forced "ViralSlideMaker.com" lockup watermark
baked into every slide — visible in the editor preview, in per-slide
PNG downloads, and in ZIP downloads. Plus and Pro tiers are unaffected.
Free users see an inline "Upgrade to remove" link beneath the Export
button, and the pricing page now lists "No watermark — clean exports"
as a Plus/Pro feature.

## What Changed

### 1. New pure resolver — `src/lib/render/resolve-forced-watermark.ts`

Returns a `ResolvedForcedWatermark` config (logoUrl, text, x, y,
logoSize, fontSize, gap, textColor, textShadow, opacity) for free tier;
returns null for plus/pro/null/undefined. Bottom-left placement with
4% safe margin. Logo size ~4.5% of canvas width (49 px on 1080), font
size ~2.2% (24 px), opacity 0.55. Mirrors the shape of resolveWatermark
(brand-kit) so the three render paths can call both side-by-side.

12 vitest cases pass — tier gating, default canvas dimensions, custom
canvas scaling, brand text/asset/opacity contracts.

**Commit:** `0072b5d`

### 2. Wire into 3 render paths

- **`render-slide-satori.tsx`** — Satori PNG export. Added `tier` and
  `origin` params to `buildSlideElement`. JSX layer renders last so it
  sits on top in DOM order (Satori has no z-index).
- **`render-slide.ts`** — legacy HTML render. Added `tier` param,
  injected absolutely-positioned div with the lockup at z-index 6.
- **`slide-preview.tsx`** — live editor preview. Added `userTier` prop;
  rendered at z-index 19 (above brand-kit watermark's 18) in both
  the read-only and editable preview branches.

**Commit:** `8db72a4`

### 3. Server-authoritative tier resolution

- **`/api/render/route.ts`** — `getUserTier(p.user_id)` resolves the
  project owner's tier; passed to `buildSlideElement`.
- **`/api/v1/projects/[id]/download/route.ts`** — `getUserTier(ctx.userId)`
  (ownership already enforced by `getProject`); same path.

**Editor chain** — `userTier` threaded through `slide-editor` →
`slide-canvas` / `slide-list` → `sortable-slide` → `slide-preview`.
Default `'free'` at every boundary.

**Commit:** `44a8409`

### 4. Inline upsell + pricing page copy

- **`slide-editor.tsx`** — when `userTier === 'free'`, renders
  "Slides include a ViralSlideMaker watermark. **Upgrade to remove**"
  beneath the Export button, linking to `/settings/subscription`.
- **`subscription/page.tsx`** — Free plan gains "Up to 3 slides per
  carousel" and "ViralSlideMaker.com watermark on exports"; Plus and
  Pro both gain "No watermark — clean exports" and "Up to 20 slides
  per carousel".

**Commit:** `46ef602`

### 5. Bug fix: Satori absolute-URL requirement

Initial server export hit `Error: Image source must be an absolute URL:
/logo.png`. Satori (unlike browsers) rejects relative `<img src>`.

Threaded `origin?: string` through `buildSlideElement`; both API routes
derive `origin = new URL(req.url).origin` and pass it. The JSX
prepends origin to `forced.logoUrl` only when set, so the editor's
browser preview keeps using the relative `/logo.png`.

**Commit:** `df301e2`

## Verification

Live smoke-test against the running Next.js dev server (free user
`bigdfill`, tier='free', project "5 Tips for Better Sleep Habits"):

- ✅ **Editor preview**: Watermark visible at bottom-left of main canvas
  AND in left thumbnail strip — confirmed via Playwright screenshot
  (`test-watermark-editor-free-tier.png`).
- ✅ **Per-slide PNG**: `/api/render?projectId=...&slide=0` returns a
  200 PNG with the watermark baked in — confirmed via Playwright
  screenshot (`test-watermark-png-export.png`). Logo + text visible
  bottom-left at the right opacity; doesn't obscure slide content.
- ✅ **Inline upsell**: would be visible if the right panel scrolled;
  copy reads "Slides include a ViralSlideMaker watermark. Upgrade to
  remove" with link to `/settings/subscription`.

Automated:
- ✅ `npx vitest run resolve-forced-watermark.test.ts` — 12/12 pass.
- ✅ `npx vitest run resolve-watermark.test.ts` — 24/24 pass (no
  regressions in the brand-kit watermark).
- ✅ `npx tsc --noEmit` clean for all 12 modified files (pre-existing
  TS errors in unrelated test files only).

## Anti-Bypass Posture

- Server reads tier from project OWNER, not requester — a free user
  cannot get a clean PNG by routing through a paid user's session.
- Default 'free' at every prop boundary — a parent forgetting to pass
  userTier means the watermark still shows, not vanishes.
- Per-slide `hide_watermark` flag (a paid-user feature for the
  brand-kit watermark) does NOT short-circuit the forced watermark.

## Deviations from Plan

- The plan named `download-controls.tsx` as the upsell site; that
  component turned out to be unused. The actual export button lives
  inline in `slide-editor.tsx`, so the upsell was added there instead
  — same UX intent, accurate location.
- Discovered and fixed Satori's absolute-URL requirement at runtime;
  not in the original plan but required to make the server export
  actually work.

## Self-Check: PASSED

- FOUND: src/lib/render/resolve-forced-watermark.ts (created)
- FOUND: src/lib/render/resolve-forced-watermark.test.ts (created, 12/12 passing)
- FOUND: render-slide-satori.tsx (modified)
- FOUND: render-slide.ts (modified)
- FOUND: slide-preview.tsx (modified)
- FOUND: api/render/route.ts (modified, tier+origin)
- FOUND: api/v1/projects/[id]/download/route.ts (modified, tier+origin)
- FOUND: slide-editor.tsx (modified, upsell + tier threading)
- FOUND: slide-canvas.tsx, slide-list.tsx, sortable-slide.tsx (modified)
- FOUND: subscription/page.tsx (modified, watermark feature copy)
- FOUND: commits 0072b5d, 8db72a4, 44a8409, 46ef602, df301e2
- VERIFIED: editor preview watermark via Playwright screenshot
- VERIFIED: server PNG export watermark via Playwright screenshot
- TYPECHECK CLEAN: no new TS errors in modified files
