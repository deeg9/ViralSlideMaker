---
quick_id: 260428-0ah
description: Build out resources page with viral carousel tactics and app usage tips
status: complete
date: 2026-04-28
---

# Quick Task 260428-0ah — Summary

## What shipped

Replaced the `/resources` placeholder ("Templates, guides, and creator tools. Coming soon.") with a real, opinionated **Creator Playbook** page at `src/app/(dashboard)/resources/page.tsx`.

Single server component — no new dependencies, no new routes, no schema changes.

## Page sections

1. **Hero** — `Make slides people can’t stop swiping.`
2. **Stat strip** — 1.9× reach, 8–10 sweet-spot, ~2 sec to earn the swipe
3. **The hook rule** — 4 hook patterns (Question / Bold Claim / Stat / Transformation) with concrete example copy + "don’t reveal everything on slide 1" tip
4. **Make text pop** — 4 rules: big simple type (≥36px headlines, ≥24px body), high contrast (WCAG AA 4.5:1), left-align + one idea, whitespace
5. **Structure** — hook → tension → payoff → CTA with 5 numbered steps (slides 1, 2, 3–7, 8–9, 10), explaining the slide-2 re-serve and slide-8+ engagement rebound
6. **Last-slide CTAs** — 4 example phrases that drive saves/shares/follows + "pick one action" tip
7. **App playbook** — 5 in-app shortcuts: start from Explore, set up Brand Kit, watermark, free→Pro slide cap, ZIP export. Each with a deep link where relevant (`/explore`, `/settings/brand-kit`)
8. **Pre-post checklist** — 6 yes/no items
9. **Final CTA banner** — primary "Browse templates" → `/explore`, secondary "Start a new carousel" → `/dashboard`

## Style

- Matches dashboard tokens exactly: `#3d0000` (text), `#fff0f0` (card bg), `#fadbdb` (accent), `#7d6161` (muted), `#dbc1bc` (border), `#fff8f7` (page bg), white (cards).
- Uses existing `Icon` component (Material Symbols Outlined) — no new asset deps.
- Container `mx-auto max-w-5xl px-4 py-8 space-y-12` — matches `bookmarks/page.tsx` density.
- Local helper components (`Section`, `StatCard`, `RuleCard`, `StructureStep`, `AppStep`, `Tip`) kept page-local — not promoted to a design system since they're page-specific.

## Research baked in

Web research (April 2026) on viral-carousel best practices informed every section. Pulled stats from multiple sources for credibility:

- 1.9× reach vs static (Mosseri Feb 2026)
- 8–10 slide sweet spot (engagement studies)
- ~2 sec to earn swipe (60–80% strong vs <20% weak hooks)
- WCAG AA 4.5:1 contrast, ≥24px body text mobile
- Curiosity gap mechanic (Loewenstein)
- Last-slide CTA → save/share/comment lift

## Verification

- ESLint: clean on the new file (no output)
- TypeScript: no errors introduced (project has pre-existing TS errors in `__tests__/` and the `[transport]/route.ts` MCP handler — unrelated, predates this commit)
- Dev server: started without error; route is auth-gated so middleware redirects to `/login` for unauthenticated requests, which is correct dashboard behavior
- Production build: pre-existing `mcp-handler` module-not-found in `src/app/api/[transport]/route.ts` blocks build (since v2.3 phase 26-01) — not introduced by this task

## Files changed

- `src/app/(dashboard)/resources/page.tsx` — full rewrite (15 lines → 427 lines)

## Notes / known limits

- Resources page is currently mounted under `(dashboard)` and therefore behind login. If we want it browsable while signed-out (lead-gen), we'd need to lift it out of `(dashboard)` like we did for `/explore` in quick task `260427-wmg`. Not in scope here.
- All copy is English-only. No i18n hook today, so this matches the rest of the app.
