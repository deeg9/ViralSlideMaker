---
phase: 45
status: issues_found
depth: standard
reviewed_at: 2026-04-29T18:15:00Z
files_reviewed: 16
files_reviewed_list:
  - src/lib/render/resolve-overlay.ts
  - src/lib/render/render-slide-satori.tsx
  - src/components/slides/slide-preview.tsx
  - src/app/api/render/route.ts
  - src/app/api/v1/projects/[id]/download/route.ts
  - src/app/(dashboard)/project/[id]/publish-actions.ts
  - src/lib/services/publish.ts
  - src/app/api/admin/seed-explore/route.ts
  - src/components/editor/slide-canvas.tsx
  - src/components/editor/slide-list.tsx
  - src/components/editor/sortable-slide.tsx
  - src/components/editor/slide-editor.tsx
  - src/components/slides/slide-grid.tsx
  - src/components/slides/template-picker.tsx
  - src/components/brand-kit/brand-kit-form.tsx
  - src/app/explore/[slug]/carousel-slideshow.tsx
findings:
  critical: 0
  high: 0
  medium: 2
  low: 3
---

# Phase 45: Code Review Report

**Reviewed:** 2026-04-29T18:15:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 45 delivers the renderer composition layer cleanly. The shared resolver (`resolve-overlay.ts`) is pure and correctly implemented. The Satori and React preview renderers wire the shared resolver through identical mutual-exclusion gates, identical resolveCtx fallback semantics, and matching DOM layer order. The five existing templates remain byte-identical (backgroundMode undefined → useBgMode=false). No security vulnerabilities found.

Two medium findings affect correctness and parity fidelity. Three low findings are code quality issues that do not affect runtime behavior.

---

## Warnings

### WR-01: Redundant background image fetch when `useBgMode=true` — preview/Satori divergence in error state

**File:** `src/components/slides/slide-preview.tsx:397`

**Issue:** `innerStyle` always sets `backgroundImage: !newsZone && slide.background_url ? \`url(${slide.background_url})\` : undefined`. This condition is `true` exactly when `useBgMode` is `true` (since `useBgMode` requires `!newsZone`). The result is that when `backgroundMode` is `image-bleed` or `image-with-bottom-card`, the container `<div>` gets a CSS `background-image` **and** `BackgroundLayers` renders an absolutely-positioned `<img>` covering 100%×100% with the same URL.

Consequences:
1. **Two fetches** to the same image URL per render (browser cache mitigates on repeat, but not on first load).
2. **Brief visual flash** during load: the CSS background-image uses `backgroundSize: cover` applied to the *scaled 1080×1920 container*, while `<img>` uses `objectFit: cover` on a 100%×100% absolute element. They render identically once loaded, but between DOM paint and image load the CSS background may flash slightly differently.
3. **Parity divergence with Satori**: Satori never sets `backgroundImage` on `rootStyle` — it relies solely on the `<img>` tag. React sets both. While visually masked, this is a semantic difference that violates the spirit of TPLREND-05 in image-load error cases (a 404 background shows the flat `template.backgroundColor` in React but a blank in Satori).

**Fix:** Guard the `backgroundImage` property in `innerStyle` to exclude the `useBgMode` path. Since `BackgroundLayers` owns the background image in that path, the CSS property should be suppressed:

```tsx
const innerStyle: React.CSSProperties = {
  width: REF_WIDTH,
  height: REF_HEIGHT,
  fontFamily: template.fontFamily,
  color: textColor,
  backgroundColor: template.backgroundColor,
  // Phase 45: When useBgMode is active, BackgroundLayers renders the photo as
  // an absolutely-positioned <img> — suppress the CSS backgroundImage to avoid
  // a redundant second fetch and match Satori which never sets backgroundImage
  // on the root element (Satori uses only the <img> tag, no CSS background).
  backgroundImage: !newsZone && !useBgMode && slide.background_url
    ? `url(${slide.background_url})`
    : undefined,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  position: 'absolute',
  top: 0,
  left: 0,
  transform: `scale(${scale})`,
  transformOrigin: 'top left',
}
```

---

### WR-02: `resolveOverlayContent` returns `undefined` at runtime for unknown discriminator values — renders "undefined" as overlay text

**File:** `src/lib/render/resolve-overlay.ts:76-99`

**Issue:** Both the outer `switch (content.type)` and the inner `switch (content.field)` lack a `default` branch. TypeScript's control-flow analysis accepts this because the discriminated union is exhaustive at compile time. However, if template data arrives at runtime with an unexpected `type` or `field` value (e.g., future schema evolution, partial JSON migration, or a hand-authored template that bypasses `validateTemplateRegistry`), both renderers silently receive `undefined` from the function.

In the Satori path the overlay `<div>` renders `{text}` where `text === undefined`, producing the literal string "undefined" in the exported PNG. In the React path the same happens in `OverlayLayers`. The Phase 44 validator guards template load, but `resolveOverlayContent` is the last line of defense at render time.

**Fix:** Add a `default` to both switches returning `''` (consistent with the existing graceful-degradation contract described in CONTEXT.md Area 4):

```ts
export function resolveOverlayContent(
  content: OverlayContent,
  ctx: OverlayResolveCtx,
): string {
  switch (content.type) {
    case 'literal':
      return content.text
    case 'page-counter': {
      const fmt = content.format ?? DEFAULT_COUNTER_FORMAT
      return fmt
        .replace('{currentSlide}', String(ctx.slideIndex + 1))
        .replace('{totalSlides}', String(ctx.totalSlides))
    }
    case 'slide-field':
      switch (content.field) {
        case 'topic':    return ctx.topic ?? ''
        case 'hook_text': return ctx.slide.hook_text ?? ''
        case 'body_text': return ctx.slide.body_text ?? ''
        default:          return ''  // unknown field — graceful fallback
      }
    default:
      return ''  // unknown type — graceful fallback
  }
}
```

This also satisfies the TypeScript exhaustiveness check without relying on the union narrowing implicitly returning `undefined`.

---

## Info

### IN-01: `ctx` variable shadows the outer `ApiContext` parameter in the download route

**File:** `src/app/api/v1/projects/[id]/download/route.ts:78`

**Issue:** The `withApiAuth` handler receives `(req, ctx)` where `ctx` is the `ApiContext` object (`.supabase`, `.userId`, etc.). Inside the `for` loop at line 78, a new `const ctx = { slideIndex: i, totalSlides, topic: project.topic }` shadows the outer `ctx`. This is not a bug — the outer `ctx` is not needed inside the loop, and the inner `ctx` is correctly passed to `buildSlideElement`. However, linters with `no-shadow` rules would flag this, and it introduces a maintenance trap: if future loop-body code needs `ctx.supabase` (e.g., to re-fetch per-slide data), it would silently use the wrong `ctx`.

**Fix:** Rename the inner variable to avoid shadowing:

```ts
const renderCtx = { slideIndex: i, totalSlides, topic: project.topic }
const element = buildSlideElement(slide, effectiveTemplate, resolvedBrandKit, ownerTier, origin, renderCtx)
```

---

### IN-02: `BackgroundLayers` accepts a `useBgMode` prop that is always `true` at its call sites

**File:** `src/components/slides/slide-preview.tsx:70-82`

**Issue:** `BackgroundLayersProps` declares `useBgMode: boolean` and the component body has `if (!useBgMode) return null`. Both call sites (lines ~498 and ~759) invoke `<BackgroundLayers>` only inside the `useBgMode ? (...)` branch, making `useBgMode` always `true` at the time `BackgroundLayers` renders. The early-return guard is therefore dead code.

**Fix:** Remove the `useBgMode` prop from `BackgroundLayersProps` and its early-return guard. The calling ternary in `SlidePreview` already enforces the condition:

```tsx
interface BackgroundLayersProps {
  template: SlideTemplate
  slide: Slide
  useBottomCard: boolean
  overlayOpacity: number
}

function BackgroundLayers({ template, slide, useBottomCard, overlayOpacity }: BackgroundLayersProps) {
  // No useBgMode guard needed — caller already gates on useBgMode
  return (
    <>
      {slide.background_url && (
        <img data-testid="bg-bleed" ... />
      )}
      ...
    </>
  )
}
```

---

### IN-03: Numeric array index used as React `key` in `renderSegments`

**File:** `src/lib/render/resolve-overlay.ts:144,146`

**Issue:** `renderSegments` uses the array iteration index `i` as the React `key` for span children:
```ts
return React.createElement('span', { key: i, style: pillStyle }, children)
```
For the current use cases (static template configs, immutable segment arrays), this is functionally correct. However, if segments are ever dynamically reordered or a segment is inserted mid-array, React will reconcile incorrectly (matching wrong DOM nodes by position). The CONTEXT.md decision to not extract a `<HighlightSpan>` component keeps this inline, but the key strategy should be noted.

**Fix:** Use a composite key that is stable under mutation. Since `TextSegment` has no `id` field, using `text` content or `i-text` avoids false matches when segments change:

```ts
return React.createElement('span', { key: `${i}-${seg.text}`, style: pillStyle }, children)
```

Note: the Satori renderer's snapshot test suite would catch any key-change regressions since snapshot keys are deterministic.

---

_Reviewed: 2026-04-29T18:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
