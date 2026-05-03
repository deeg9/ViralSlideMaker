---
created: 2026-05-03
slug: export-divergence
title: Fix exported PNG diverges from web UI preview (TPLREND-05 invariant breach)
area: render
status: planning
files: src/lib/render/render-slide-satori.tsx, src/components/slides/slide-preview.tsx, src/lib/render/render-slide.ts
---

# Quick Task: Fix exported PNG diverges from web UI preview

## Problem

**TPLREND-05 invariant breach.** User reports the downloaded PNG (`slide-01.png`) does NOT match the web UI live preview. From screenshots:

**Web UI (live preview):**
- Hook text "YOUR BRAIN IS OUTSOURCING THINKING TO AI" fits cleanly within the bottom dark card
- Body text "Researchers call it cognitive agency surrender..." wraps neatly BELOW the hook
- Layout looks polished (this is the news-cyan / news-with-bottom-card template)

**Exported PNG:**
- Hook text wraps differently and is rendered LARGER — taking up more vertical space than in preview
- Body text OVERLAPS the hook — they're rendered on top of each other ("RESEARCHERS CALL IT COGNITIVE AGENCY SURRENDER..." crashes into the hook lines)
- Visual mess; not shippable

## Hypothesis

Most likely root cause (in order of likelihood):

1. **Satori-only path bug introduced during v2.11** — Phase 60 (watermark adapter modified render-slide-satori.tsx; comment-only per plan but verify) OR Phase 64 (HIDDEN filter added at element-iteration sites in render-slide-satori.tsx) OR pre-v2.11 cleanup commit `2180d86` (paletteMode='fixed' fix + origin threading + headingFontFamily font-loading)
2. **Body position not respecting newsZone** — the news-with-bottom-card template positions body inside the bottom card; Satori may be rendering body at default position (overlapping hook)
3. **Hook auto-shrink computing different value in Satori** — both renderers import hook-fit and call `getHookFontSize(template.id, slide.hook_text, baseHookSize)`, but the computed `hookFontSize` may differ if `parseInt(template.hookFontSize)` parses different strings on each side
4. **TPLREND-05 PARITY-04 regression** — Phase 65 PARITY-04 fingerprint test was supposed to catch any byte-identity drift between renderers. If the test passed but the divergence is real, the test fixture coverage missed this case (e.g., specific template + hook length combination)

## Investigation Plan

1. Verify which template the user's project uses (URL: `localhost:3000/project/d03a8ica-...`). Check Supabase or client-side state if possible; otherwise infer from screenshots (cyan accent + image-top + dark-bottom-card → likely `news-cyan` or `news-drop`)
2. Read both renderer's news-zone body-positioning logic side-by-side
3. Check git history for any post-v2.11-tag changes to render-slide-satori.tsx
4. Run the PARITY-04 fingerprint test against the user's template + a representative long-hook fixture; confirm it passes/fails

## Fix Plan

After diagnosis:
- Identify the exact divergence point
- Apply minimal fix to bring Satori renderer back in line with React preview
- Extend PARITY-04 fingerprint test fixture with a long-hook + body case so this regression can never silently land again
- Atomic commit

## Acceptance

- [ ] Exported PNG matches web UI preview byte-identically (or visually-identically for non-deterministic snapshots) for the user's project
- [ ] PARITY-04 fingerprint test extended with regression-pinning fixture
- [ ] All existing parity tests still green
- [ ] tsc baseline (17 errors) maintained
