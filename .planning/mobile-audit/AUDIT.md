# Mobile Audit — iPhone 15 viewport (393×852)

**Date:** 2026-05-31
**Method:** Playwright MCP, true 393px logical viewport (headed window clamps to 589px @ dpr 0.667 unless the requested size is pre-divided by 1.4987 → requested 262×569 yields a real 393×853). Authenticated session (`seller@example.com`) was already present in the browser profile, so gated surfaces were reachable.
**Probe per page:** horizontal-overflow scan, sub-44px tap-target scan, viewport + full-page screenshots in `shots/`.

## TL;DR

The app is in **decent mobile shape for viewing/sharing** — public surfaces (explore, public carousel, public profile), the subscription page, and the dashboard all reflow cleanly with **zero horizontal overflow** anywhere tested. The real work concentrates in **(1) the slide editor** (cramped, the core touch-editing flow is unverified) and **(2) cross-cutting polish**: sub-44px tap targets, missing iOS safe-area handling, and a low-contrast input. This is a real but **focused** milestone, not a ground-up rebuild.

## Cross-cutting findings

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| X1 | **iOS safe-area insets unhandled.** `bottom-navbar.tsx` is `fixed bottom-0 … pb-6` (static 24px) with no `env(safe-area-inset-bottom)`; no `viewport-fit=cover` viewport export exists, so the inset env vars aren't even populated. On iPhone 15 the bottom tab bar will crowd / collide with the home indicator. | **High** | `src/components/layout/bottom-navbar.tsx:25`; no `viewport` export in `src/app` |
| X2 | **Pervasive sub-44px tap targets.** Header account icon 32×32; editor toolbar icons 36px wide; slide/layer chips 80×22; carousel chevrons 28–32px; settings "Change" link; undo/redo. Apple HIG minimum is 44×44. Editor alone had **46** interactive elements under 40px. | **High** | probe output, all surfaces |
| X3 | **Low-contrast placeholder** in the main prompt textarea (light pink-grey on white) — fails WCAG contrast; hard to read the example prompt. | Medium | `shots/01-dashboard-vp.png` |
| — | ~~Dark "N" circle overlapping the bottom nav~~ → **NOT an app bug.** Verified it's the **Next.js dev-mode indicator** (dev-only overlay), no matching app element. Excluded. | n/a | code grep |

## Per-surface findings

| Surface | Verdict | Notes |
|---------|---------|-------|
| **Slide editor** `/project/[id]` | **High — needs work** | Heaviest vertical-chrome stack on mobile: header + title/toolbar row + slide filmstrip + Layers panel + 9:16 canvas + TEXT/ELEMENTS/IMAGES tabs + undo/redo + Public/Export bar + bottom nav — all competing for height, squeezing the canvas. Toolbar icons cramped (36px). Slide filmstrip is horizontal-scroll with no scroll affordance. **The core interaction — tapping a text element to edit it on touch — is UNVERIFIED and is the #1 risk to validate.** `dashboard-shell.tsx:9` notes the editor "manages its own viewport-fit height." |
| **Dashboard** `/dashboard` | OK w/ polish | No overflow. Oversized "Welcome back, Big D!" heading eats ~⅓ of the fold; placeholder contrast (X3); account icon 32px (X2). |
| **Settings** `/settings/*` | Low–Med | Sub-nav is a horizontal-scroll strip (`min-w-max`, 564px) — tabs scroll off-screen with no affordance (discoverability). Forms reflow fine. |
| **Subscription** `/settings/subscription` | **Good** | Pricing tiers stack vertically and read well. |
| **Explore** `/explore` | **Good** | Single-column feed, search + filter, no overflow. |
| **Public carousel** `/explore/[slug]` | **Good** | Most important shared surface — full-width 9:16, prev/next, slide counter, Fork/Bookmark CTAs all clean. |
| **Public profile** `/[username]` | **Good** | Avatar/bio/social links + single-column carousel grid, no overflow. |
| **Template picker** (inline on dashboard) | Low | Horizontal-scroll row of 160px tiles — works, but discoverability of all 16 templates via horizontal scroll is mediocre on a phone. |

## Not audited (blocked)

The browser profile was logged in and there are no available credentials to log back in after a logout, so these **logged-out** surfaces were not captured and need a separate pass:

- Landing page `/` (logged-out marketing view — redirects to `/dashboard` when authed)
- Auth: `/login`, `/signup`, `/onboarding/username`, `/forgot-password`, `/reset-password`

## Suggested milestone shape (v2.17 — Mobile Optimization)

1. **Cross-cutting foundation** — `viewport-fit=cover` + safe-area insets on the fixed nav and editor bars; global tap-target pass to 44px; input-contrast fix.
2. **Editor mobile pass** — the big one: rework the editor's vertical chrome so the canvas gets room, and verify/repair the touch text-editing flow.
3. **Logged-out pass** — audit + fix landing and auth pages at 393px (needs a login credential to round-trip).
4. (Minor) settings sub-nav + template-picker discoverability polish.
