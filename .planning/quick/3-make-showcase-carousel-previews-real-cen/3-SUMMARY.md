# Quick Task 3: Make showcase carousel previews real centered and interactive

## What was done
- Replaced 3 static hardcoded carousel mockups with real AI-generated content
- Generated carousel data via Gemini 2.5 Flash for 3 topics: Productivity, Wellness, Digital Minimalism
- Created `ShowcaseCarousels` client component with interactive prev/next navigation
- Each card shows slide content with counter (e.g., "1 / 7"), styled per template theme
- Cards are centered using flex-wrap justify-center layout

## Files changed
- `src/components/landing/showcase-carousel.tsx` (new) — interactive carousel cards with hardcoded AI data
- `src/app/page.tsx` — replaced static mockups with ShowcaseCarousels component

## Commit
- `8efdde2`: feat(quick-3): replace static showcase mockups with interactive AI-generated carousels
