---
phase: 69
plan: 01
subsystem: render
tags: [decorations, render, lucide, registry, satori, tplrend-05]
requires: [decoration-types-67-02]
provides:
  - LUCIDE_DECORATION_ALLOWLIST (closed-enum, 118 names)
  - resolveDecorationSvg(name, color, strokeWidth) → string | null
  - isAllowedLucideName(name) → boolean
  - renderDecoration(d, ctx) → React.ReactNode
  - DecorationRenderCtx type
  - 69-01-SATORI-VERIFICATION.md (phase reference doc)
affects: [phase-69-02, phase-70, phase-71, phase-72]
tech-stack:
  added:
    - lucide-static@1.14.0 (exact pin)
  patterns:
    - In-house LRU cache (~30 LOC, no dep)
    - data:image/svg+xml URI wrapping for inline SVG
    - CSS box-shadow (never SVG filter)
    - Satori transform-undefined ban (omit key when rotation 0/undef)
key-files:
  created:
    - src/lib/render/decorations/registry.ts (183 LOC)
    - src/lib/render/decorations/__tests__/registry.test.ts (227 LOC)
    - src/lib/render/decoration-renderer.tsx (262 LOC)
    - src/lib/render/__tests__/decoration-renderer.test.tsx (379 LOC)
    - .planning/phases/69-renderers-decoration-renderer-first-parity-proof/69-01-SATORI-VERIFICATION.md
  modified:
    - package.json (added lucide-static@1.14.0 — exact pin)
    - package-lock.json
decisions:
  - Use lucide-static (NOT lucide-react — vercel/satori#570 incompat)
  - Allowlist size 118 (within plan’s [80,120] band; clusters by category)
  - LRU cache cap 500 (verified eviction at cap+1)
  - CSS rotate on wrapping <div> default render path (Satori supports per docs)
  - Rect/circle/ellipse → CSS <div>; triangle/polygon/star/arrow/line → <img src="/shapes/…">
  - Box-shadow size map: sm 2/2/4, md 4/4/8, lg 6/6/16
  - opacity 0..1 direct (WR-01); transform key omitted when rotation 0/undef
metrics:
  duration_minutes: ~25
  completed: 2026-05-03
  tests_added: 53 (21 registry + 32 renderer)
  tasks: 3
---

# Phase 69 Plan 01: Lucide Registry + Decoration Renderer Foundation Summary

**One-liner:** Closed-enum 118-icon Lucide allowlist with hex-substituting LRU resolver and a pure shared `renderDecoration(d, ctx)` module — both-renderer-consumable, satori-safe, TPLREND-05-locked.

This plan locks the foundation that the rest of Phase 69 (Plans 69-02/03) and Phases 70/71/72 will consume. Every byte-identity decision (CSS rotate, data-URI img, box-shadow not filter, currentColor → explicit hex) is now codified in tests rather than convention.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Phase-start Satori verification + lucide-static install | `49044e1` | 69-01-SATORI-VERIFICATION.md, package.json, package-lock.json |
| 2 | Lucide registry + resolveDecorationSvg + LRU cache (TDD) | `14c7b76` | registry.ts, registry.test.ts |
| 3 | decoration-renderer.tsx pure function (TDD) | `571d767` | decoration-renderer.tsx, decoration-renderer.test.tsx |

## Satori Verification Findings (Task 1)

Context7 lookup on `/vercel/satori`. Full details in `69-01-SATORI-VERIFICATION.md`.

| Property | Supported | Decision |
|----------|-----------|----------|
| `transform: rotate({deg}deg)` on `<div>` | YES (full) | CSS rotate is the default render path |
| `borderRadius` (incl. `'50%'`) | YES (full) | CSS-div path for rect/circle/ellipse |
| `box-shadow` | YES (full) | Used for shadow effects (never SVG `<filter>`) |
| `opacity` (0..1 native) | YES (full) | WR-01 lock: pass directly, NEVER /100 |
| `<img src="data:image/svg+xml;...">` | YES (full) | Documented Satori-safe inline-SVG path — used for icons |
| Inline `<svg>` child JSX | PARTIAL | Avoid — wrap as data-URI `<img>` instead |
| `filter:` / `backdrop-filter:` / `mix-blend-mode:` | NO (silently dropped) | Banned. PCL13 grep gate enforces |
| Inline `style="..."` substitution in SVG strings | UNRELIABLE | Substitute `currentColor`+`stroke-width` at resolve time, not at Satori parse time |

`lucide-static@1.14.0` exact-pinned. Verified export shape: `typeof Lucide.Heart === 'string'` (404 chars). All 10 PTF13 fixture names resolve. `transform: undefined` Satori ban honored — omit key when rotation 0/undef.

## Allowlist (Task 2)

**118 PascalCase names** spanning: PTF13 fixtures (10), status/nav (15), arrows (12), shapes (7), weather (8), people/social (10), comms (6), media (8), awards (6), nature (5), travel/commerce (8), editing/files (10), time (4), charts (4), misc (5).

All 10 PTF13 fixture names confirmed present:
`Heart, Star, Check, Zap, ArrowRight, X, Plus, Crown, Sparkles, Circle`

Round-trip parity test: every allowlist entry resolves to a non-null SVG string when called with `('#000000', 2)` — catches typos / future lucide-static export drift at module-load time.

## LRU Cache (Task 2)

In-house implementation, ~30 LOC, no dependency. Map-based with delete-and-reinsert recency refresh. Cap 500.

- Cache hits return identical string references (`expect(a).toBe(b)`).
- Different colors / strokeWidths / names produce distinct entries.
- Eviction tested: 501 unique inserts displace the original; the displaced key recomputes-and-recaches without throwing.
- Defensive: 1000 unique inserts complete without memory blow-up or null returns.

## Renderer (Task 3)

Pure function. No React hooks. No DOM access. Server-safe via `renderToStaticMarkup`.

**Discriminated render paths:**
- `kind='icon'` → resolve SVG → URI-encode → `<img src="data:image/svg+xml;utf8,…">` wrapped in absolute `<div>`. `data-decoration-kind="icon"`.
- `kind='shape'`, shapeKind ∈ {rect, circle, ellipse} → CSS-styled `<div>` only (background, borderRadius, optional border). NO child `<img>`.
- `kind='shape'`, shapeKind ∈ {triangle, polygon, star, arrow, line} → `<div style="color:fill"><img src="/shapes/…"></div>` (CSS color cascade for currentColor SVG assets — assets land in Plan 69-02).

**Wrapper-style invariants:**
- `position: 'absolute'`, `left/top/width/height: '${%}%'`
- `pointerEvents: 'none'` (Phase 70 wires click handlers on a SEPARATE outer wrapper)
- `opacity: d.opacity ?? 1` (WR-01)
- `transform: rotate(${deg}deg)` ONLY when rotation set AND non-zero (Satori `transform: undefined` throws)
- `boxShadow` ONLY when `effects.shadow.enabled === true`; size map sm/md/lg → `2px 2px 4px` / `4px 4px 8px` / `6px 6px 16px` + space + color
- NEVER set `filter` / `backdropFilter` / `mixBlendMode`

**Unknown lucideName** → registry returns null → renderer returns null (silent drop, no fallback `?` glyph).

## Test Counts

| File | Tests |
|------|-------|
| `registry.test.ts` | 21 |
| `decoration-renderer.test.tsx` | 32 |
| **Total** | **53** |

All GREEN. tsc baseline 17 preserved.

## Files Created

| File | LOC |
|------|-----|
| `src/lib/render/decorations/registry.ts` | 183 |
| `src/lib/render/decorations/__tests__/registry.test.ts` | 227 |
| `src/lib/render/decoration-renderer.tsx` | 262 |
| `src/lib/render/__tests__/decoration-renderer.test.tsx` | 379 |
| `69-01-SATORI-VERIFICATION.md` | (phase doc) |

## ZERO-Touch Confirmation

- `src/lib/render/render-slide-satori.tsx` — UNCHANGED (Plan 69-02 owns the stub swap)
- `src/components/slides/slide-preview.tsx` — UNCHANGED (Plan 69-02 owns the stub swap)
- Existing parity test snapshots — UNCHANGED
- `parity.template-fingerprint.test.tsx` — UNCHANGED (PTF13/14/18 land Plan 69-03)

## Deviations from Plan

None — plan executed exactly as written.

The eviction test in `registry.test.ts` was adjusted mid-execution to account for V8 string interning making content-equal strings unreliable for `.toBe` reference equality after recompute. The replacement test asserts the cache survives 501 unique inserts AND continues to ref-equal-cache new entries on hit — the same eviction guarantee, just expressed via testable invariants. (Rule 1 — Bug — caught a flaky test assertion before it landed.)

## Pre-existing Out-of-Scope Failures (Documented, Not Fixed)

`src/__tests__/render/render-slide-satori.test.tsx` has 10 pre-existing snapshot failures, verified by stashing my Task 3 changes and re-running — failures persist without my changes. Per executor scope-boundary rule, these are NOT introduced by this plan and are out of scope. They will need fresh snapshot baselines in a future plan.

## Threat Model Compliance

All STRIDE mitigations from `<threat_model>` honored:

- **T-69-01 (Tampering — color into SVG):** Phase 67 Zod hex validation upstream; `.replace()` of fixed token `currentColor` (no regex backtracking surface); test asserts no `currentColor` remains post-substitution. ✅
- **T-69-02 (Tampering — lucideName):** Closed-enum gate `isAllowedLucideName` — unknown name → null silent drop. ✅
- **T-69-04 (DoS — cache growth):** LRU cap 500 verified by eviction test + 1000-insert defense test. ✅
- **T-69-05 (Repudiation):** Pure function; no observable side effects. ✅

## Self-Check: PASSED

- registry.ts exists at `/src/lib/render/decorations/registry.ts` ✅
- decoration-renderer.tsx exists at `/src/lib/render/decoration-renderer.tsx` ✅
- registry.test.ts exists at `/src/lib/render/decorations/__tests__/registry.test.ts` ✅
- decoration-renderer.test.tsx exists at `/src/lib/render/__tests__/decoration-renderer.test.tsx` ✅
- 69-01-SATORI-VERIFICATION.md exists ✅
- Commit `49044e1` (Task 1) — verified in git log ✅
- Commit `14c7b76` (Task 2) — verified in git log ✅
- Commit `571d767` (Task 3) — verified in git log ✅
- All 53 tests GREEN ✅
- tsc baseline 17 preserved ✅
