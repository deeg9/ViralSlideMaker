---
quick_id: 260515-lcr
slug: retint-loader-brand-colors
status: complete
completed: 2026-05-15
commit: 3b8c1e2
---

# SUMMARY — Retint carousel-generation loader to brand palette

The full-screen `LetterCircleLoader` shipped in 260515-lcl (dark-blue
gradient + sky-blue halo) didn't match the rest of the app. User said
"too blue and black — make it the pink / tan / white we have on the
dashboard." Retinted in-place, no behavior change.

## Changes

- **`src/components/ui/letter-circle-loader.tsx`**
  - Backdrop `bg-gradient-to-b from-[#1a3379] via-[#0f172a] to-black
    dark:from-gray-100 dark:via-gray-200 dark:to-gray-300` →
    `from-[#fff8f7] via-[#fff0f0] to-[#fadbdb]`. Cream → pale-pink → light-
    pink mirrors the dashboard tile colors.
  - Letter color `text-white dark:text-gray-800` → `text-[#3d0000]`
    (burgundy on the light backdrop).
- **`src/app/globals.css` — `@keyframes loaderCircle`**
  - Inner box-shadow stops swapped from sky/blue
    (`#38bdf8`/`#005dff`/`#1e40af`/`#60a5fa`/`#0284c7`/`#4dc8fd`) to brand
    tan / brown / burgundy (`#dbc1bc`/`#7d6161`/`#3d0000` with `#e8c8c2`
    and `#a07878` as the 50% mid-frame variants).
  - Halo rgba()s swapped from sky/royal blue to tan + brown.
  - `prefers-color-scheme: dark` override block deleted — it set the
    halo to gray tones, which would clash with the new pink backdrop
    (loader is always brand-light now).

## Out of scope

- `loaderLetter` keyframe (opacity/translate only — no color) untouched.
- `LetterCircleLoader` prop signature + `font-inter` class + a11y attrs
  on the wrapper in `generation-form.tsx` preserved.
- Generation-form submit-button spinner / "Generating slides…" copy
  unchanged — separate UI surface, already burgundy.

## Verification

- `npx tsc --noEmit` — zero new errors on touched files. Pre-existing
  test-mock errors (`__tests__/api/*`, `auth/*`, `stripe/*`, `legal/*`,
  `services/projects-delete`, `editor/slide-editor.treatment-sync`) all
  unchanged from baseline.
- `grep -rn LetterCircleLoader src` — single consumer
  (`generation-form.tsx`) unaffected; no API change.
- Visual smoke check deferred to user (requires live carousel-generation
  flow).
