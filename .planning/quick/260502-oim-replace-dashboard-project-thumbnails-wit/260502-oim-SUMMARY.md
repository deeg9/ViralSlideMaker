---
phase: quick-260502-oim
status: complete
date: 2026-05-03
---

# Quick Task 260502-oim: Summary

Dashboard project cards now render the **actual first slide** (template + hook + body + overlays) instead of the raw `slide_data[0].background_url` photo, and ship with **left/right chevron arrows + slide counter** so users can step through every slide of every project from the dashboard without opening the editor.

## Files changed

### Task 1 — Thread brandKit through dashboard → ProjectList (commit `4f5a05a`)

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/page.tsx` | Added single `brand_kits` lookup (gated on `user`), passed `brandKit` to `<ProjectList>`. One DB read shared across the whole grid. |
| `src/components/projects/project-list.tsx` | Accepted optional `brandKit?: BrandKit \| null` prop, passed through to each `<ProjectCard>`. |

### Task 2 — Replace thumbnail with rendered slide + add inline arrows (commit `e0e7b0d`)

| File | Change |
|------|--------|
| `src/components/projects/project-card.tsx` | Replaced `<img src={slides[0].background_url}>` with `<SlidePreview slide={slides[currentSlideIndex]} template={...} editable={false} brandKit={brandKit} ...>`. Added `useState(0)` for current slide. Added left/right chevron buttons (hover-revealed, `absolute left-2/right-2 top-1/2`, white pill with shadow). Added `{n} / {total}` counter at bottom of thumbnail (hover-revealed). Hidden when `slides.length <= 1`. Click handlers `e.stopPropagation()` so navigation doesn't trigger the card's `router.push` to `/project/[id]`. Empty-state fallback (auto_awesome_motion icon) preserved for projects with zero slides. |

## Approach notes

- **Client-side `<SlidePreview>`, not `/api/render`.** SlidePreview already handles full slide rendering with ResizeObserver-based auto-scaling to any container width. Using it instead of the Satori PNG endpoint avoids 1 HTTP round-trip per card per slide-flip and sidesteps the 30/min render rate limit.
- **Template resolved client-side** via `getTemplate(project.template_id ?? 'highlight-bar')` — pure function over a static registry, no fetch.
- **brandKit fetched once at page level**, threaded down — keeps the editor's brand-kit precedence chain visible on the dashboard. Templates with `paletteMode: 'fixed'` (paper-essay, brutalist-grid) remain locked from brand-kit override per the earlier render-divergence fix in this session.
- **Hover-only arrow visibility** mirrors the existing 3-dot menu pattern on the card.

## Manual QA (confirmed in browser via Playwright MCP)

| Check | Result |
|-------|--------|
| Card 1 (7-slide project) thumbnail shows the rendered first slide ("STOP SCROLLING! YOUR SLEEP NEEDS THIS" hook on photo, not raw photo) | ✓ |
| Card 2 (zero-slide project "Paper Essay Test") shows fallback auto_awesome_motion icon | ✓ |
| Hover Card 1 → previous + next chevrons appear; previous disabled at slide 1 | ✓ |
| Click Next on Card 1 → slide flips to "1. CONSISTENCY IS KEY" alarm-clock photo, URL stays at `/dashboard` (no router.push) | ✓ |
| `1 / 7` counter visible at bottom of thumbnail on hover, updates on flip | ✓ |
| Card without arrow click still navigates to `/project/[id]` editor | (existing behavior preserved — arrows e.stopPropagation; gradient overlay made `pointer-events-none` so it doesn't swallow card clicks) |
| `npx tsc --noEmit` — no new errors in changed files (pre-existing test-mock errors unrelated) | ✓ |

## Commits

- `ad6cb2d` — docs(quick-260502-oim): pre-dispatch plan
- `4f5a05a` — feat(quick-260502-oim/t2): thread brandKit from dashboard page through ProjectList
- `e0e7b0d` — feat(quick-260502-oim/t1): render first slide as dashboard thumbnail + add inline slide nav arrows

## Follow-ups (not done)

- Performance: with many projects (50+), each card mounts its own `<SlidePreview>`. If this gets sluggish, consider lazy-mounting cards beyond the viewport via `IntersectionObserver`, or pre-rendering thumbnails server-side to a cached PNG. Out of scope for this quick task; revisit if real users hit it.
- Pre-existing console error `Base UI: A component that acts as a button expected a native <button>... at CreateProjectDialog` — unrelated to this task. Worth a separate quick if it surfaces a real a11y issue.
