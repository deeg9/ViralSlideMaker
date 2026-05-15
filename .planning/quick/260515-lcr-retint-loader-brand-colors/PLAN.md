---
quick_id: 260515-lcr
slug: retint-loader-brand-colors
created: 2026-05-15
---

# PLAN — Retint carousel-generation loader to dashboard palette

The carousel-generation loading screen (`LetterCircleLoader`, shipped in
260515-lcl) is dark-blue → black gradient with a sky-blue glowing halo.
User says: "too blue and black" — match dashboard's pink / tan / cream /
burgundy palette.

## Brand palette (from dashboard + generation form)

- `#fff8f7` — dashboard background (warm cream)
- `#fff0f0` — pale pink tile
- `#fadbdb` — light pink tile
- `#dbc1bc` — tan / dusty pink
- `#7d6161` — muted brown
- `#3d0000` — burgundy (primary brand)

## Changes

1. **`src/components/ui/letter-circle-loader.tsx`**
   - Backdrop `bg-gradient-to-b from-[#1a3379] via-[#0f172a] to-black` →
     `bg-gradient-to-b from-[#fff8f7] via-[#fff0f0] to-[#fadbdb]`.
   - Letter color `text-white dark:text-gray-800` → `text-[#3d0000]`
     (always burgundy on the new light backdrop).

2. **`src/app/globals.css` — `@keyframes loaderCircle`**
   - Inner shadows retinted from sky/blue (`#38bdf8`, `#60a5fa`, `#0284c7`,
     `#005dff`, `#1e40af`) to tan / brown / burgundy (`#dbc1bc`, `#7d6161`,
     `#3d0000`) with `#e8c8c2` / `#a07878` mid-frame variants.
   - Halo glow rgba()s swapped from blue tones to tan + brown.
   - Drop the `prefers-color-scheme: dark` override — loader is always
     brand-light now, the gray-tone dark variant would clash with the new
     pink backdrop.

## Out of scope

- No behavior / API change to `LetterCircleLoader` — only color values.
- `loaderLetter` keyframe (opacity / translate) is colorless — left alone.
- Generation-form button spinner + "Generating slides…" text unchanged
  (separate UI surface, brand colors already).

## Verification

- `npx tsc --noEmit` — zero new errors.
- Visual smoke check deferred to user (requires logged-in carousel
  generation flow).
