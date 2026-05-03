---
phase: quick-260502-oim
plan: 01
type: execute
wave: 1
files_modified:
  - src/app/(dashboard)/dashboard/page.tsx
  - src/components/projects/project-list.tsx
  - src/components/projects/project-card.tsx
---

# Plan: Replace dashboard thumbnails with rendered first slide + add inline slide navigation

## Context

Today the dashboard `Recent Carousels` grid shows raw `slide_data[0].background_url` photos. The user wants every card to show the actual rendered first slide (template + hook + body + overlays — what `/api/render?slide=0` produces), and wants left/right chevron arrows so they can flip through all slides on the dashboard without opening the editor.

The existing `<SlidePreview>` component already handles full slide rendering with ResizeObserver-based auto-scaling to any container width. The `<CarouselSlideshow>` on `/explore/[slug]` is the proven pattern: SlidePreview + chevron arrows + state. We mirror that pattern inside ProjectCard at thumbnail scale.

## Approach

**Client-side rendering, not /api/render.** The /api/render endpoint produces a Satori PNG and is rate-limited 30/min — calling it for every dashboard card would be slow on first load and could hit rate-limits when a user has many projects. SlidePreview is the same component the editor uses; rendering it inline is instant.

**Brand-kit fetch lifted to page level.** The dashboard list query already pulls `slide_data` via `select('*')`. We add a single `brand_kits` lookup at the page level and thread it down through ProjectList → ProjectCard, so all cards share one DB read.

**Template resolved client-side via `getTemplate()`** — pure function over a static registry, no fetch needed.

## Tasks

### Task 1 — Replace photo thumbnail with rendered SlidePreview + add slide navigation arrows

**Files:** `src/components/projects/project-card.tsx`

- Convert thumbnail block: replace `<img src={slides[0].background_url}>` with `<SlidePreview slide={slides[currentSlideIndex]} template={template} ... editable={false} brandKit={brandKit} userTier={...} />`.
- Resolve template via `getTemplate(project.template_id ?? 'highlight-bar')` — same fallback the render route uses.
- Add `useState(0)` for `currentSlideIndex`.
- Add left/right chevron buttons (mirroring the `CarouselSlideshow` pattern: `absolute left-2 / right-2 top-1/2 -translate-y-1/2`, white pill, smaller than explore's because we're at thumbnail scale). Hover-only visibility (matching the existing 3-dot menu pattern).
- `e.stopPropagation()` on arrow clicks so the card's `handleCardClick` (router.push to editor) doesn't fire when navigating slides.
- Keep the empty-state fallback (`Icon name="auto_awesome_motion"`) when `slides.length === 0`.
- Hide both arrows when `slides.length <= 1`.
- Keep the existing hover gradient + "Open Editor" label, the 3-dot menu, the Public badge.
- Drop the `userTier` prop unless we already have it; if not threaded, pass `undefined` (SlidePreview handles missing tier — only used for forced watermark which is owner-tier-resolved on the render path; on the preview path the watermark just doesn't appear, which is fine for thumbnails).

### Task 2 — Thread brandKit + accept the prop on the bridge components

**Files:** `src/app/(dashboard)/dashboard/page.tsx`, `src/components/projects/project-list.tsx`

- Page: add `const { data: brandKitRow } = await supabase.from('brand_kits').select('*').eq('user_id', user.id).maybeSingle()` (gated on `user`). Pass to ProjectList: `<ProjectList projects={...} brandKit={brandKitRow as BrandKit | null} ...>`.
- ProjectList: add `brandKit?: BrandKit | null` prop, pass through to each ProjectCard.

## Verification

- `npm run dev`, open `/dashboard` → every card thumbnail shows the rendered first slide (with hook text overlay), not the raw photo. Cards with 0 slides still show the fallback icon.
- Hover a card → left + right chevron buttons appear (only when slides.length > 1).
- Click chevrons → slide changes inline; URL stays on `/dashboard` (no navigation).
- Click anywhere else on the card → routes to `/project/[id]` as before.
- `npx tsc --noEmit` — no new errors in changed files.
