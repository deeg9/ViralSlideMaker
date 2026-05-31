---
plan_id: 91-1
phase: 91
title: Global mobile foundation — viewport-fit, safe-area bars, tap-44 utility, placeholder contrast
wave: 1
depends_on: []
files_modified:
  - src/app/layout.tsx
  - src/components/layout/bottom-navbar.tsx
  - src/components/layout/dashboard-shell.tsx
  - src/app/globals.css
  - src/components/slides/generation-form.tsx
  - src/components/editor/ai-generate-tab.tsx
  - src/components/editor/image-picker-panel.tsx
requirements:
  - FOUND-01
  - FOUND-03
  - FOUND-04
autonomous: true
---

# Plan 91-1 — Global mobile foundation

**Goal:** Land the global, cross-cutting iOS-Safari correctness primitives that have no editor-internal dependency: the `viewport-fit=cover` viewport export (which populates `env(safe-area-inset-*)`), safe-area padding on the fixed bottom navbar and the fixed editor shell, the reusable `@utility tap-44` hit-area utility, the global tap-highlight reset, and the WCAG-AA placeholder-contrast fix on the three faint placeholders. This is the strict prerequisite for everything else in the milestone — `env()` reads `0` until task 1 (the viewport export) ships.

**Requirements covered:** FOUND-01 (safe-area on fixed bars + viewport-fit), FOUND-03 (tap-44 utility — the editor button sweep that consumes it is in Plan 91-2), FOUND-04 (placeholder contrast; input ≥16px is already satisfied by the `Input` primitive and the `text-base` prompt textarea — verified, no change needed).

**Ordering invariant:** Task 1 (viewport export) MUST land before the safe-area tasks are meaningful, but they ship in the same plan/commit-set so the foundation is atomic. The `tap-44` utility (Task 4) must exist before Plan 91-2's sweep.

---

<task id="91-1-1" type="execute">
<title>Add the Next.js App Router viewport export with viewport-fit=cover</title>
<read_first>
- src/app/layout.tsx (current state: has `metadata` export, NO `viewport` export; keep the Material Symbols `<link>` in `<head>`)
- .planning/research/STACK.md (§1 Step A — exact viewport export syntax)
</read_first>
<action>
In `src/app/layout.tsx`, import the `Viewport` type from `next` and add a module-level `export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }`. Place it adjacent to the existing `metadata` export. Do NOT add `maximumScale` or `userScalable: false` (WCAG 1.4.4). Do NOT hand-write a `<meta name="viewport">` tag — App Router owns it via this export. Do NOT touch the existing Material Symbols `<link>` or the `metadata` export. `interactiveWidget` is intentionally deferred to the editor/keyboard phase (93).
</action>
<acceptance_criteria>
- src/app/layout.tsx contains `import type { Viewport } from 'next'`
- src/app/layout.tsx contains `export const viewport: Viewport` with `viewportFit: 'cover'`
- src/app/layout.tsx contains `width: 'device-width'` and `initialScale: 1`
- src/app/layout.tsx does NOT contain `maximumScale` and does NOT contain `userScalable`
- src/app/layout.tsx does NOT contain a literal `<meta name="viewport"`
- The existing `export const metadata` and the Material Symbols `<link href="https://fonts.googleapis.com/css2?family=Material+Symbols` remain present
- `npx tsc --noEmit` introduces no NEW errors vs the 20-error test-file baseline
</acceptance_criteria>
</task>

<task id="91-1-2" type="execute">
<title>Pad the fixed bottom navbar with safe-area-inset-bottom</title>
<read_first>
- src/components/layout/bottom-navbar.tsx (L25 — the `<nav>` is `md:hidden fixed bottom-0 … px-4 pb-6 pt-2 …`)
- .planning/research/STACK.md (§1 Step C — arbitrary env() value pattern with max())
</read_first>
<action>
In `src/components/layout/bottom-navbar.tsx`, on the `<nav>` className at L25, replace the static `pb-6` with `pb-[max(1.5rem,env(safe-area-inset-bottom))]`. Use `max()` so non-notched devices and devtools keep the original 24px (1.5rem) breathing room. Change nothing else on the nav (keep `md:hidden fixed bottom-0 left-0 w-full`, the background, shadow, `rounded-t-2xl`, `z-50`, `px-4`, `pt-2`).
</action>
<acceptance_criteria>
- src/components/layout/bottom-navbar.tsx contains `pb-[max(1.5rem,env(safe-area-inset-bottom))]`
- src/components/layout/bottom-navbar.tsx does NOT contain a standalone ` pb-6` class on the nav
- The nav still contains `md:hidden fixed bottom-0` and `z-50`
- `npx tsc --noEmit` introduces no NEW errors vs baseline
</acceptance_criteria>
</task>

<task id="91-1-3" type="execute">
<title>Respect top/bottom safe-area insets on the fixed editor shell</title>
<read_first>
- src/components/layout/dashboard-shell.tsx (L19 — the `isFullBleed` branch returns `fixed inset-0 overflow-hidden bg-[#fff8f7] flex flex-col`; L21 the `<main>`)
- .planning/research/ARCHITECTURE.md (Q1 — the fixed inset-0 editor shell should clear env(safe-area-inset-top) at its top chrome and env(safe-area-inset-bottom) at its bottom region)
</read_first>
<action>
In `src/components/layout/dashboard-shell.tsx`, on the `isFullBleed` (editor) branch container at L19, add top and bottom safe-area padding so the pinned `fixed inset-0` shell clears the notch/Dynamic Island and the home indicator: add `pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]` to the `fixed inset-0 …` className string. Leave the non-editor (`min-h-screen`) branch unchanged in THIS task (its dvh swap is optional and handled separately if low-risk). Do not alter the `<main>` or the inner content div.
</action>
<acceptance_criteria>
- src/components/layout/dashboard-shell.tsx, in the `isFullBleed` true branch className, contains `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]`
- The `fixed inset-0 overflow-hidden` and `flex flex-col` classes remain on that branch
- The non-editor branch still contains `min-h-screen` (unchanged in this task)
- `npx tsc --noEmit` introduces no NEW errors vs baseline
</acceptance_criteria>
</task>

<task id="91-1-4" type="execute">
<title>Add the tap-44 utility and the global tap-highlight reset to globals.css</title>
<read_first>
- src/app/globals.css (uses `@import "tailwindcss"`, `@theme inline` at L7, `@layer base` at L121; Tailwind v4 CSS-first, NO tailwind.config — so custom utilities go in `@utility`)
- .planning/research/STACK.md (§4 — the `@utility tap-44` definition; §3 — `-webkit-tap-highlight-color: transparent`)
</read_first>
<action>
In `src/app/globals.css`, add two things. (1) A Tailwind v4 custom utility, placed after the `@layer base { … }` block (around L131): `@utility tap-44 { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }`. (2) Inside the existing `@layer base` block, on the `html` rule that already has `@apply font-sans;`, add `-webkit-tap-highlight-color: transparent;` (raw CSS property, not an @apply). Do not remove or reorder any existing rules; the app already uses `active:bg-*` press feedback so the native grey flash is redundant.
</action>
<acceptance_criteria>
- src/app/globals.css contains `@utility tap-44`
- The tap-44 utility body contains `min-width: 44px`, `min-height: 44px`, and `display: inline-flex`
- src/app/globals.css contains `-webkit-tap-highlight-color: transparent`
- The existing `@theme inline`, `@layer base`, and `.material-symbols-outlined` blocks remain present
- `npm run build` (or `npx next build`) is NOT required here; CSS compiles — confirm no Tailwind parse error by `npx tsc --noEmit` introducing no NEW errors (CSS is not type-checked, this is a sanity gate that the edit didn't break imports)
</acceptance_criteria>
</task>

<task id="91-1-5" type="execute">
<title>Fix the near-invisible placeholders to a WCAG-AA-contrast token</title>
<read_first>
- src/components/slides/generation-form.tsx (L346 — `placeholder:text-[#dbc1bc]` on the prompt textarea; AUDIT X3)
- src/components/editor/ai-generate-tab.tsx (L120 — `placeholder:text-[#dbc1bc]`)
- src/components/editor/image-picker-panel.tsx (L194 — `placeholder:text-[#dbc1bc]`)
- src/app/page.tsx (L46 — reference: the app's readable placeholder convention is `placeholder:text-[#7d6161]/60`)
</read_first>
<action>
Replace the faint `placeholder:text-[#dbc1bc]` (light pink-grey on white — fails WCAG AA) with the app's established readable placeholder token `placeholder:text-[#7d6161]/60` (`--muted-foreground` at 60% — already used on `page.tsx`, `search-box.tsx`, and the onboarding form) in all three files at the lines noted. Change ONLY the placeholder color class; leave every other class on each element untouched. Do not alter the textarea/input font sizes — they are already ≥16px (`text-base`/`text-sm` where appropriate) and the prompt textarea is `text-base` (no iOS zoom).
</action>
<acceptance_criteria>
- src/components/slides/generation-form.tsx no longer contains `placeholder:text-[#dbc1bc]`; contains `placeholder:text-[#7d6161]/60`
- src/components/editor/ai-generate-tab.tsx no longer contains `placeholder:text-[#dbc1bc]`; contains `placeholder:text-[#7d6161]/60`
- src/components/editor/image-picker-panel.tsx no longer contains `placeholder:text-[#dbc1bc]`; contains `placeholder:text-[#7d6161]/60`
- `grep -rn "placeholder:text-\[#dbc1bc\]" src/` returns no matches
- `npx tsc --noEmit` introduces no NEW errors vs baseline
</acceptance_criteria>
</task>

---

## Verification criteria

1. `src/app/layout.tsx` has a `viewport` export with `viewportFit: 'cover'`, no `<meta name=viewport>`, no `userScalable`/`maximumScale`.
2. `bottom-navbar.tsx` consumes `env(safe-area-inset-bottom)` via `pb-[max(1.5rem,env(safe-area-inset-bottom))]`.
3. `dashboard-shell.tsx` editor branch consumes `env(safe-area-inset-top)` + `env(safe-area-inset-bottom)`.
4. `globals.css` defines `@utility tap-44` (min 44×44, inline-flex centered) and sets `-webkit-tap-highlight-color: transparent`.
5. No `placeholder:text-[#dbc1bc]` remains anywhere under `src/`.
6. `npx tsc --noEmit` shows no NEW errors beyond the known 20 test-file baseline.

## must_haves (goal-backward)

- **FOUND-01 enabled:** `viewport-fit=cover` shipped (env vars now populate on device) AND the two fixed bars (bottom navbar, editor shell) consume the insets. *(On-device home-indicator clearance is a human/device check — Playwright reports insets as 0.)*
- **FOUND-03 foundation:** the reusable `tap-44` utility exists and is ready for the editor sweep (Plan 91-2).
- **FOUND-04:** the three faint placeholders now use a WCAG-AA-contrast token; inputs confirmed ≥16px on mobile (no change needed).

## Device / human-needed items

- **FOUND-01 (safe-area) — physical iPhone 15 required.** Playwright/devtools always report `env(safe-area-inset-*)` as `0`. Confirm on device that the bottom tab nav and the editor shell chrome clear the home indicator / notch. This is expected and is recorded as a human checkpoint, not a Playwright-claimable pass.
