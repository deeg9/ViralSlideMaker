# Phase 69 — Satori Support Verification (Phase Start)

**Date:** 2026-05-03
**Lookup method:** Context7 MCP (`/vercel/satori`) via `npx ctx7@latest` CLI fallback
**Active Satori version (in use):** Embedded in `next/og` (Next.js 15.5.13). Production code paths invoke Satori indirectly through `ImageResponse` from `next/og` — see `src/app/api/render/route.ts`, `src/app/api/v1/projects/[id]/download/route.ts`, `src/lib/services/publish.ts`.
**lucide-static pinned at:** `1.14.0` (exact, no caret — see `package.json` line 41).

This document is the authoritative reference for Phase 69 fallback decisions and is consumed by Plans 69-02 and 69-03.

---

## 1. Satori Support Matrix

| Property / Element                         | Supported? | Notes                                                                                                                                                                |
| ------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<img>` element                            | YES (full) | Recommended way to embed SVG content. Per docs: supports URLs, data URIs (`data:image/svg+xml;...`), ArrayBuffers. Width/height attrs strongly recommended (Satori README). |
| `<img src="data:image/svg+xml,...">`       | YES (full) | The documented Satori-safe path for inline SVG. Avoids the React-component issue with `lucide-react` (vercel/satori#570).                                              |
| Inline `<svg>` direct in JSX               | PARTIAL    | Satori parses `<svg>` but its CSS subset on inner SVG nodes (style="..." attribute substitution) is incomplete. Per #570, `lucide-react` (which emits inline `<svg>` React trees) is incompatible. The data-URI `<img>` wrapping is the documented workaround. |
| `<polygon>` / `<path>` / `<line>` / `<rect>` / `<circle>` / `<ellipse>` direct | INDIRECT (via `<img>` wrap) | Reliable path is to ship pre-baked SVG asset files in `public/shapes/*.svg` and reference via `<img src="/shapes/...">`. Pattern proven in v2.9 `public/overlays/`. |
| `transform: rotate({deg}deg)` on `<div>`   | YES (full) | Confirmed in Satori docs ("Transforms" section): `transform: 'rotate(15deg) scale(0.9)'` example. CSS rotate on the wrapping `<div>` is the default render path. |
| `transform` on inline `<svg>`              | PARTIAL    | Avoid. CSS `transform` on the wrapping `<div>` is the supported path. (Plan 69-02/69-03 verify via PTF18 non-uniform scale.) |
| `borderRadius` on `<div>`                  | YES (full) | Supports individual corner properties + shorthand. `borderRadius: '50%'` works for circle/ellipse from CSS-div path. |
| `box-shadow`                               | YES (full) | Confirmed in Satori "Render SVG with Comprehensive CSS Support" example: `boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'`. v2.1 use confirmed. |
| `opacity`                                  | YES (full) | Confirmed in CSS Variables example: `opacity: 0.5`. WR-01 lock: pass 0..1 directly, NEVER divide by 100. |
| `filter:` / `backdrop-filter:` / `mix-blend-mode:` | NO     | Silently dropped by Satori (vercel/satori#573). Burned in v2.9. NEVER use. PCL13 grep gate enforces. |
| Inline `style="..."` substitution in SVG strings | UNRELIABLE | Satori does not consistently parse style attrs on inner SVG nodes. We instead substitute `currentColor` → explicit hex BEFORE wrapping in a data URI. (vercel/satori#41 — `currentColor` cascade is unreliable at any tier.) |

---

## 2. Decisions Locked by This Lookup

### 2.1 Rotation render path (RENDER-07)
**DECISION:** CSS `transform: rotate(${deg}deg)` on the wrapping `<div>` is the default render path for ALL decorations.

**Rationale:** Satori docs explicitly support `transform: 'rotate(15deg) scale(0.9)'` on a `<div>`. No fallback to pre-baked rotated SVG variants is needed.

**Edge case:** When `rotation === 0` or `rotation === undefined`, OMIT the `transform` key entirely from the style object. Satori throws `"Invalid transform value"` on `transform: undefined`. (Mirror `resolve-overlay.ts:471` comment.)

### 2.2 Icon render path (RENDER-02)
**DECISION:** Resolve Lucide name → SVG string via `lucide-static`; substitute `currentColor` → explicit hex; wrap in `<img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}">`.

**Rationale:** `lucide-react` is Satori-incompatible (#570 — emits React component tree, not raw SVG string). `lucide-static` ships per-icon SVG strings keyed by PascalCase name (verified: `typeof L.Heart === 'string'`, length 404, contains `stroke="currentColor"` and `stroke-width="2"` defaults). Data-URI wrapping is the documented Satori-safe path for inline SVG content.

**Required token substitutions** (BEFORE forming the data URI):
1. `currentColor` → explicit hex (the user-supplied `IconDecoration.color`)
2. `stroke-width="2"` → `stroke-width="${strokeWidth}"` (the user-supplied `IconDecoration.strokeWidth`)

### 2.3 Shape render path (RENDER-01, RENDER-04)
**DECISION:** Two-path discriminated render:

- **CSS-div path** (`shapeKind ∈ {rect, circle, ellipse}`):
  Pure CSS `<div>` with `width / height / borderRadius / background / border / box-shadow`. Zero SVG nodes. Most efficient.
- **SVG-asset path** (`shapeKind ∈ {triangle, polygon, star, arrow, line}`):
  Pre-baked SVG files in `public/shapes/*.svg` referenced via `<img src="/shapes/${shapeKind}.svg">` wrapped in a `<div>`. Mirrors v2.9 overlay pattern. Asset files land in Plan 69-02; the renderer in Plan 69-01 emits the path strings (graceful — assets absent → broken `<img>` only at runtime, no render-time crash).

**Rationale:** Inline `<svg>` polygons in Satori are partial (#570 lineage); the v2.9 overlay pattern (`<img src="/overlays/star.svg">`) has shipped reliably for ~6 months. Same pattern lands in `public/shapes/`.

### 2.4 Box-shadow (RENDER-05)
**DECISION:** CSS `box-shadow: ${offsetX}px ${offsetY}px ${blur}px ${color}` on the wrapping `<div>`. NEVER SVG `<filter>`.

**Confirmed:** Satori docs example uses `boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'`. v2.1 TextShadowEffect use confirmed shipping.

**Size mapping** (locked here, used by `decoration-renderer.tsx`):
- `sm`: `'2px 2px 4px'`
- `md`: `'4px 4px 8px'`
- `lg`: `'6px 6px 16px'`

Then suffixed with `' ' + color` (8-digit hex from `DecorationShadowEffect.color`).

### 2.5 Opacity (RENDER-06)
**DECISION:** `opacity: d.opacity ?? 1` directly on the wrapping `<div>`. WR-01 lock: 0..1 scale, NEVER divide by 100. Confirmed Satori supports `opacity: 0.5` (CSS Variables example).

### 2.6 currentColor substitution (PCL12 invariant)
**DECISION:** Substitute `currentColor` → explicit hex inside `resolveDecorationSvg` BEFORE returning the SVG string. Caller never sees a `currentColor` token in the resolver output. Enforced by registry tests (assertion: substituted string contains the hex AND does NOT contain the literal token `currentColor`).

**Rationale:** vercel/satori#41 — Satori's `currentColor` cascade is unreliable across template / fontSize / nested-element boundaries. Explicit hex is the only safe path. PCL12 grep gate (Plan 69-03) enforces zero `currentColor` literals in `src/lib/render/` production code.

### 2.7 Inline style substitution in SVG strings
**DECISION:** Treat as UNRELIABLE. Only token substitutions on the SVG STRING are: `currentColor` → hex, `stroke-width="2"` → `stroke-width="${n}"`. No other style/attribute injection. The wrapping `<div>` carries all decoration-level styling (transform/opacity/box-shadow/position).

---

## 3. Lucide-Static Verification

### 3.1 Pinned version
```json
"lucide-static": "1.14.0"
```
Exact version pinning enforced (no `^` / no `~`) — closed-enum allowlist correctness depends on a stable export shape.

### 3.2 Export shape
```js
const L = require('lucide-static')
typeof L.Heart  // → 'string'
L.Heart.length  // → 404
L.Heart.slice(0, 200)
// → '<svg
//      class="lucide lucide-heart"
//      xmlns="http://www.w3.org/2000/svg"
//      width="24" height="24" viewBox="0 0 24 24"
//      fill="none" stroke="currentColor"
//      stroke-width="2" stroke-linecap="rou...
```
Each PascalCase key (e.g. `Heart`, `Star`, `ArrowRight`) maps directly to a complete SVG string with `stroke="currentColor"` and `stroke-width="2"` defaults.

### 3.3 PTF13 fixture set verified
All 10 PTF13 fixture names resolve to non-empty strings:
```
Heart : string    Star : string      Check : string      Zap : string
ArrowRight : string    X : string    Plus : string       Crown : string
Sparkles : string    Circle : string
```

### 3.4 Registry import pattern
```typescript
// src/lib/render/decorations/registry.ts
import * as Lucide from 'lucide-static'

const raw = (Lucide as Record<string, string>)[name]  // PascalCase key lookup
if (typeof raw !== 'string') return null              // closed-enum integrity guard
```

---

## 4. Cross-References

- `vercel/satori#570` — `lucide-react` Satori incompatibility → why we use `lucide-static`
- `vercel/satori#41` — `currentColor` cascade unreliable → why explicit hex substitution
- `vercel/satori#573` — `filter:` / `backdrop-filter:` silently dropped → why CSS `box-shadow` is the only shadow path; PCL13 grep gate enforces
- `resolve-overlay.ts:471` — `transform: undefined` Satori throw — pattern mirrored in `decoration-renderer.tsx`
- `public/overlays/` — v2.9 pattern that `public/shapes/` mirrors (Plan 69-02)

---

## 5. Phase 69 Risk Posture

**TPLREND-05 (HIGH risk):** Both renderers will consume `decoration-renderer.tsx` starting Plan 69-02. This phase ships the renderer module — but does NOT yet wire it into either renderer (zero-touch on `render-slide-satori.tsx` and `slide-preview.tsx`). The pure-function design (no React hooks, no DOM access) keeps the module trivially server-side-safe.

**Fallback risk:** If PTF18 (Plan 69-03) reveals CSS `transform: rotate()` divergence between the two renderers, we fall back to pre-baked rotated SVG variants (0/15/30/45/60/75/90 deg). Documented but considered low-likelihood given Satori docs explicitly support the property.

**Closed-enum integrity:** The `LUCIDE_DECORATION_ALLOWLIST` allowlist must contain only names that `lucide-static@1.14.0` exports. Plan 69-01 Task 2 includes a round-trip test asserting every allowlist entry resolves to a non-null string — this catches any typo or version drift.
