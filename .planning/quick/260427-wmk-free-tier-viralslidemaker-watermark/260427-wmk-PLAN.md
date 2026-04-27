---
phase: 260427-wmk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/render/resolve-forced-watermark.ts
  - src/lib/render/resolve-forced-watermark.test.ts
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/render-slide.ts
  - src/components/slides/slide-preview.tsx
  - src/app/api/render/route.ts
  - src/app/api/v1/projects/[id]/download/route.ts
  - src/components/editor/slide-editor.tsx
  - src/components/editor/slide-canvas.tsx
  - src/components/editor/sortable-slide.tsx
  - src/components/slides/slide-grid.tsx
  - src/components/slides/template-picker.tsx
  - src/components/slides/download-controls.tsx
  - src/app/(dashboard)/settings/subscription/page.tsx
autonomous: true
requirements:
  - QUICK-260427-wmk
must_haves:
  truths:
    - "Free-tier users see a logo + 'ViralSlideMaker.com' lockup at bottom-left in editor preview"
    - "Free-tier users get the watermark baked into per-slide PNG download via /api/render"
    - "Free-tier users get the watermark baked into ZIP download via /api/v1/projects/[id]/download"
    - "Plus and Pro users see no forced watermark in any render path"
    - "Per-slide hide_watermark flag does NOT remove the forced free-tier watermark"
    - "Brand-kit watermark (paid users' own logo) renders independently of the forced watermark"
    - "Free users see an inline 'Slides include a ViralSlideMaker watermark — Upgrade to remove' link near the download button"
  artifacts:
    - path: src/lib/render/resolve-forced-watermark.ts
      provides: "Pure function returning ResolvedForcedWatermark | null based on tier"
      contains: "resolveForcedWatermark"
    - path: src/lib/render/render-slide-satori.tsx
      provides: "Satori PNG render with forced watermark JSX layer"
      contains: "resolveForcedWatermark"
    - path: src/components/slides/slide-preview.tsx
      provides: "Editor preview with forced watermark DOM layer (zIndex 19)"
      contains: "resolveForcedWatermark"
    - path: src/app/api/render/route.ts
      provides: "Server resolves owner tier and passes to buildSlideElement"
      contains: "getUserTier"
    - path: src/app/api/v1/projects/[id]/download/route.ts
      provides: "ZIP route resolves owner tier and passes to buildSlideElement"
      contains: "getUserTier"
    - path: src/components/slides/download-controls.tsx
      provides: "Inline upsell link for free users"
      contains: "/settings/subscription"
  key_links:
    - from: "src/lib/render/render-slide-satori.tsx"
      to: "src/lib/render/resolve-forced-watermark.ts"
      via: "resolveForcedWatermark(tier, { width: W, height: H })"
      pattern: "resolveForcedWatermark"
    - from: "src/components/slides/slide-preview.tsx"
      to: "src/lib/render/resolve-forced-watermark.ts"
      via: "resolveForcedWatermark(userTier, ...)"
      pattern: "resolveForcedWatermark"
    - from: "src/app/api/render/route.ts"
      to: "src/lib/credits/check-credits.ts"
      via: "getUserTier(p.user_id)"
      pattern: "getUserTier"
---

<objective>
Add a forced "ViralSlideMaker.com" watermark to every slide for free-tier users. Render path coverage must be exhaustive — live editor preview, per-slide PNG, and ZIP. Plus/Pro tiers see no forced watermark. Cannot be bypassed via the existing per-slide hide_watermark flag (which is for paid users' own brand-kit watermark, not this).

Output: a small bottom-left lockup of the brand logo + "ViralSlideMaker.com" text at opacity ~0.55, plus an inline "Upgrade to remove" link in the download bar for free users.
</objective>
