---
quick_id: 260515-lcl
slug: replace-loading-screen-letter-circle
status: complete
completed: 2026-05-15
commit: 6360653
---

# SUMMARY

Replaced the cream-overlay Tetris loading screen shown during carousel
generation with a full-screen dark-blue gradient + circular halo + pulsing-
letter loader (user-supplied snippet).

## Changes

- **NEW** `src/components/ui/letter-circle-loader.tsx` — renamed user's
  `Component` → `LetterCircleLoader`, dropped `<style jsx>` block in favor of
  global keyframes (project doesn't use styled-jsx anywhere).
- **DELETED** `src/components/ui/tetris-loading.tsx` — sole consumer was the
  generation form; no tests referenced it.
- **MODIFIED** `src/components/slides/generation-form.tsx` — swapped import +
  overlay JSX; loader text condenses to a single word per state
  (Uploading / Generating / Building) so each letter fits the 180px circle.
  Dropped the "Hang tight — this usually takes 10–30 seconds." subtitle since
  the new full-screen design doesn't have a natural place for it.
- **MODIFIED** `src/app/globals.css` — added `@keyframes loaderCircle`,
  `@keyframes loaderLetter`, `.animate-loaderCircle`, `.animate-loaderLetter`,
  and the prefers-color-scheme:dark box-shadow override from the snippet.

## Verification

- `npx tsc --noEmit` — zero new errors on touched files (only pre-existing
  test-mock errors remain).
- `grep -r TetrisLoading src` — zero hits.
- Visual smoke test deferred to user (requires logged-in carousel generation
  flow).

## Notes

- `font-inter` Tailwind class kept verbatim from the snippet even though it's
  not a defined utility in this project's `@theme inline {}` block — it's a
  harmless no-op. The body already applies `font-sans` (mapped to Inter via
  `--font-inter` in `layout.tsx`), so the loader text renders in Inter
  regardless.
- Preserved a11y attributes (`role="status"`, `aria-live="polite"`,
  `aria-busy="true"`) on a thin wrapper around the new loader.
