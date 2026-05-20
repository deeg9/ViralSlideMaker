---
phase: quick-260519-t3x
plan: 01
subsystem: render-templates / template-picker
tags: [template-picker, trending-styles, marketing-push, 2026-trends]
requires: []
provides:
  - "sunset-tabloid: retro-bold warm-tabloid color-block keeper"
  - "soft-sage: wellness journaling / 'That Girl' quiet keeper"
  - "chrome-pulse: cyber-Y2K / acid-maximalism dark keeper"
affects:
  - src/lib/render/templates/index.ts
  - src/lib/render/templates/__tests__/keeper-curation.test.ts
  - src/__tests__/render/templates.test.ts
  - 4 parity-fingerprint tests + their snapshots (PTF14/PTF15/PTF16)
tech-stack:
  added: []
  patterns:
    - "append-at-end registration to preserve existing template indices"
    - "free-tier convention — bodyFontFamily declared explicitly (anti-Inter discipline)"
key-files:
  created:
    - src/lib/render/templates/sunset-tabloid.ts
    - src/lib/render/templates/soft-sage.ts
    - src/lib/render/templates/chrome-pulse.ts
    - public/templates/sunset-tabloid.png
    - public/templates/soft-sage.png
    - public/templates/chrome-pulse.png
  modified:
    - src/lib/render/templates/index.ts
    - src/lib/render/templates/__tests__/keeper-curation.test.ts
    - src/__tests__/render/templates.test.ts
    - src/lib/render/__tests__/parity.publish-render-vs-slide-preview.test.tsx
    - src/lib/render/__tests__/parity.quick-260511-uk1-snapshot-template.test.tsx
    - src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx
    - 3 snapshot files (purely additive PTF14/PTF15/PTF16 entries)
decisions:
  - "Picker keepers expanded 5 → 8 (verbal sign-off from user 2026-05-19 for marketing-push)"
  - "All 3 templates free-tier — no premium-tier marker; bodyFontFamily declared for anti-Inter discipline"
  - "chrome-pulse: image-bleed (not image-with-bottom-card) chosen so the no-photo thumbnail composes cleanly; mid-pill dropped after 128px Anton wrapped 3 lines and collided with body"
metrics:
  duration: ~25m
  completed: 2026-05-19
---

# Phase quick-260519-t3x Plan 01: Add three trending picker templates — Summary

Added three new picker keepers capturing 2026 trends researched via web
(SocialHabit, Krumzi, AestheticFonts, NewEngen weekly trend log): retro-bold
nostalgia, "That Girl" wellness journaling, and cyber-Y2K acid. Picker keeper
count goes from 5 to 8; registry total 13 → 16.

## What shipped

- **`src/lib/render/templates/sunset-tabloid.ts`** — `id: 'sunset-tabloid'`,
  Bebas Neue + Plus Jakarta Sans, cream `#F4E8D0` bg, plum `#2D1F2E` text,
  burnt-orange `#D4571C` accent. Sample uses 2 burnt-orange pills on
  `HOW`/`BORED` for the retro-tabloid vibe. No photo, no overlays (legacy
  color-block bucket alongside bold-yellow / y2k-pop / news-oracle).
- **`src/lib/render/templates/soft-sage.ts`** — `id: 'soft-sage'`, DM Serif
  Display italic heading + Lora body, cream `#EFEBE0` bg, forest `#2A352B`
  text, sage `#7A9476` accent, `grainMode: 'paper'`. Centered hook+body,
  page-counter overlay only. Fills the picker's quiet/wellness gap
  (paper-essay is hidden).
- **`src/lib/render/templates/chrome-pulse.ts`** — `id: 'chrome-pulse'`,
  Anton heading (`hookFontWeight: 400` for Satori parity) + Plus Jakarta
  Sans body, near-black `#0D0D14` bg, hot-magenta `#FF2DAA` accent + acid-
  lime `#C7FF3C` highlight, `backgroundMode: 'image-bleed'`,
  `photoTreatment: 'contrast-bump'`, `grainMode: 'heavy'`,
  `vignette: { strength: 0.45 }`. Single magenta page-counter overlay (mid
  pill iteration dropped — see Deviations).
- **`index.ts`** — three imports + three array appends at the END so PTF1..
  PTF13 keep their indices; new templates assigned PTF14/PTF15/PTF16.
- **`keeper-curation.test.ts`** — `APPROVED_KEEPERS` expanded from 5 → 8;
  registry-count assertion 13 → 16.
- **`templates.test.ts`** — registry-count 13 → 16; `legacyIds` gains
  `sunset-tabloid`; `freeOverlayIds` gains `soft-sage` + `chrome-pulse`.
- **3 trailing-edge parity-floor tests** (publish-vs-preview, uk1-snapshot,
  style-spec-absent-baseline) — registry-length floor bumped to 16, with
  comments noting the per-template matrices iterate automatically.
- **3 snapshot files** — purely additive PTF14a/b, PTF15a/b, PTF16a/b
  entries (76 insertions, 0 modifications). Existing snapshots untouched.
- **`public/templates/{sunset-tabloid,soft-sage,chrome-pulse}.png`** —
  generated via `npm run thumbs` through the production Satori → resvg
  pipeline (1080×1920).

## Deviations from Plan

### chrome-pulse design iteration

**Initial:** Two overlays (magenta page-counter chip + lime PULSE//26 mid
pill), `backgroundMode: 'image-with-bottom-card'`, `hookFontSize: '128px'`,
sample hook `'NOSTALGIA IS THE NEW LUXURY'`.

**Problem found at thumbnail render:** Anton at 128px wrapped the 3-segment
hook across 3 lines; line 3 ("LUXURY" with pill) collided with the body
start at top:62%. Removing the mid pill didn't fix it — the hook + body
positions are fixed regardless of overlay slots.

**Fix:** Dropped the mid pill (kept the magenta page-counter chip),
switched to `backgroundMode: 'image-bleed'` (matches editorial-serif's
robust no-photo handling), reduced `hookFontSize` to 116px, and trimmed
the sample to `'ACID IS THE NEW BLACK'` (2-line wrap on Anton 116px). Lime
pill highlight moved to the first segment to keep the chrome/acid signature.

Snapshots regenerated with `-u` to capture the new fingerprint.

## Verification

- Full render suite: **997/997 pass** (`npx vitest run src/__tests__/render src/lib/render`).
- Focused template suite: **62/62 pass** (`npx vitest run src/lib/render/templates src/__tests__/render/templates.test.ts`).
- Snapshot delta: 76 insertions / 0 modifications across 3 snapshot files —
  PTF1..PTF13 byte-identical.
- Pre-existing failures NOT caused by this task: auth-signup mock-typing,
  Stripe sync-subscription upsert, ToS audit-log mocks, `Slide.role`
  typecheck errors in render-slide{,-satori}.ts + slide-preview.tsx —
  same set deferred by quick-260518-jhg.
- Visual verification: all 3 PNGs rendered via `npm run thumbs` through
  production pipeline; reviewed before commit.

## Notes

- AI category wiring (`src/lib/ai/categories/*`) deliberately NOT touched —
  the 3 new templates are picker-visible but not yet defaults for any
  category. Users can apply manually; AI category defaults can be repointed
  in a follow-up if these prove high-converting.
- Premium-tier marker NOT added — all 3 are free-tier per the project's
  "all 13 (now 16) templates available to all tiers" policy.
