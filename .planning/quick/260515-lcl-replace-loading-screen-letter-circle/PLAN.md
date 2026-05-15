---
quick_id: 260515-lcl
slug: replace-loading-screen-letter-circle
status: complete
created: 2026-05-15
---

# Replace Tetris loading screen with letter-circle loader

## Problem

The carousel generation form shows a full-screen "Building your slides…" Tetris
animation (`TetrisLoading`) on a cream `bg-[#fff8f7]/95` overlay during
generate/upload. User wants to replace it with a circular halo + pulsing-letter
loader on a dark blue gradient (snippet supplied verbatim).

## Scope

**Touch:**
- `src/components/ui/letter-circle-loader.tsx` — NEW. The component the user
  provided, renamed from `Component` → `LetterCircleLoader`, with `<style jsx>`
  removed (project doesn't use styled-jsx). Keyframes live in `globals.css`.
- `src/app/globals.css` — add `@keyframes loaderCircle`, `@keyframes loaderLetter`,
  and `.animate-loaderCircle` / `.animate-loaderLetter` utility classes.
- `src/components/slides/generation-form.tsx` — swap `TetrisLoading` for
  `LetterCircleLoader`. Drop the "Hang tight…" subtitle (incompatible with new
  full-screen dark-gradient design). Pick short single-word text per state:
  uploading → "Uploading", AI → "Generating", default → "Building".
- `src/components/ui/tetris-loading.tsx` — DELETE. Only consumer is
  generation-form.tsx (verified via grep). Removing alongside the swap.

**Don't touch:** form behavior, busy gating, role="status"/aria-live wrapper.

## Contracts that MUST hold

- `busy && (<overlay>)` still mounts the full-screen overlay during generation.
- The overlay keeps `role="status"`, `aria-live="polite"`, `aria-busy="true"`.
- `z-50` so it sits above the form.

## Implementation notes

- New component is `'use client'` (uses animation-only CSS; no hooks needed, but
  stays client to match call site and avoid any RSC surprises).
- Convert `<style jsx>` block to global keyframes in `globals.css`. Project
  doesn't use styled-jsx anywhere; globals.css is the existing pattern (see
  `@keyframes spotlight`, `fall-*`, `cpu-move-*`).
- The user's snippet had a `@media (prefers-color-scheme: dark)` block that
  overrode `box-shadow` for `.animate-loaderCircle`. Preserved in globals.css.
- The original wrapper around the loader already had `fixed inset-0 z-50`, so
  we wrap the new component in the existing `role="status"` div WITHOUT
  duplicating the fixed positioning — the new component itself provides
  `fixed inset-0 z-50 flex items-center justify-center`. We replace the entire
  overlay div with the new component and add a wrapper `<div role="status" …>`
  only if needed for a11y. Simpler: keep a thin wrapper that re-applies the
  a11y attrs around `<LetterCircleLoader />`.

## Verification

1. `pnpm typecheck` — no new errors.
2. Visual: trigger carousel generation; new dark-blue loader animates over the
   full screen.
3. `grep -r TetrisLoading src` returns zero hits.
