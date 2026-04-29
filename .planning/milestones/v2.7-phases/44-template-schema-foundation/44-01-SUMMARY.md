---
phase: 44-template-schema-foundation
plan: 01
subsystem: rendering
tags: [typescript, types, slide-template, overlay, discriminated-union, schema]

# Dependency graph
requires:
  - phase: 260427-bkt
    provides: existing SlideTemplate (id, fontFamily, headingFontFamily?, textColor, accentColor, sample) consumed by 5 built-in templates and editor
provides:
  - Optional `overlays?: TemplateOverlay[]` on SlideTemplate
  - Optional `backgroundMode?: 'color' | 'image-bleed' | 'image-with-bottom-card'` on SlideTemplate
  - New exported types `OverlaySlot`, `OverlayContent`, `TemplateOverlay`
  - Optional `highlightColor?: string` and `highlightStyle?: 'pill' | 'block'` on TextSegment
affects: [45-renderer-composition, 46-premium-template-authoring, 47-ai-prompt-tuning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-tag comments (`// Phase 44:`) on new optional fields per project convention"
    - "Discriminated unions keyed on `type` for content-source schemas"
    - "Closed-enum slide-field references (no open `keyof Slide`) for safer downstream handling"

key-files:
  created: []
  modified:
    - src/lib/types/slide.ts
    - src/lib/render/templates/index.ts

key-decisions:
  - "Named-slot overlay positions ('top-left' | 'top-right' | 'mid' | 'bottom-card' | 'free') with optional offset for fine-tuning — Phase 45 renderer maps each slot to fixed CSS"
  - "OverlayContent.slide-field restricted to closed enum 'topic' | 'hook_text' | 'body_text' — not open keyof Slide, to keep downstream resolver narrow"
  - "TextSegment highlightStyle enum is exactly 'pill' | 'block' — distinct value-space from sibling TextHighlightEffect.style ('tight' | 'full') to avoid confusion"
  - "All new SlideTemplate fields optional so existing 5 templates pass through unchanged (zero-edit backwards-compat)"

patterns-established:
  - "Pure-type extension before renderer wiring: schema lands in one phase, renderer consumes in next phase, validator enforces in companion plan"
  - "Discriminated unions for content-source schemas (literal | page-counter | slide-field) keyed on `type` discriminator"

requirements-completed: [TPLSCHEMA-01, TPLSCHEMA-02, TPLSCHEMA-03, TPLSCHEMA-04]

# Metrics
duration: 3min
completed: 2026-04-29
---

# Phase 44 Plan 01: Template Schema Foundation Summary

**Type-only extension of `SlideTemplate` with `overlays?` + `backgroundMode?` and `TextSegment` with `highlightColor?` + `highlightStyle?: 'pill' | 'block'`, plus three new exported types (`OverlaySlot`, `OverlayContent`, `TemplateOverlay`) — pure additive contracts that the existing 5 templates pass through unchanged.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-29T16:06:08Z
- **Completed:** 2026-04-29T16:09:18Z
- **Tasks:** 2
- **Files modified:** 2 (slide.ts +4 lines, index.ts +36 lines)

## Accomplishments

- Extended `TextSegment` with optional `highlightColor: string` and `highlightStyle: 'pill' | 'block'` while preserving the existing `accent?: boolean` field used by news two-color headlines.
- Added new exported types `OverlaySlot`, `OverlayContent` (discriminated union keyed on `type`), and `TemplateOverlay` to `src/lib/render/templates/index.ts`.
- Extended `SlideTemplate` with optional `overlays?: TemplateOverlay[]` and `backgroundMode?: 'color' | 'image-bleed' | 'image-with-bottom-card'` — both undefined-safe so existing 5 templates require zero edits.
- Verified zero diff against the 5 existing template body files (highlight-bar, news-drop, news-cyan, y2k-pop, bold-yellow).
- Existing templates registry test suite (7/7) still passes.

## Final Type Shapes

### TextSegment (`src/lib/types/slide.ts`)

```typescript
export interface TextSegment {
  text: string
  accent?: boolean
  highlightColor?: string
  highlightStyle?: 'pill' | 'block'
}
```

### SlideTemplate (`src/lib/render/templates/index.ts`)

Existing fields preserved (id, name, thumbnail, fontFamily, headingFontFamily?, hookFontSize, bodyFontSize, textColor, backgroundColor, overlayColor, overlayOpacity, textAlign, textPosition, hookStyle, accentColor?, sample?). New optional fields appended:

```typescript
  overlays?: TemplateOverlay[]
  backgroundMode?: 'color' | 'image-bleed' | 'image-with-bottom-card'
```

### New Exported Types (`src/lib/render/templates/index.ts`)

```typescript
export type OverlaySlot = 'top-left' | 'top-right' | 'mid' | 'bottom-card' | 'free'

export type OverlayContent =
  | { type: 'literal'; text: string }
  | { type: 'page-counter'; format?: string }
  | { type: 'slide-field'; field: 'topic' | 'hook_text' | 'body_text' }

export interface TemplateOverlay {
  position: OverlaySlot
  content: OverlayContent
  offset?: { x: number; y: number }
  style?: {
    background?: string
    color?: string
    padding?: string
    borderRadius?: string | number
    fontSize?: string
    fontWeight?: string | number
    textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
  }
}
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend TextSegment with optional highlight fields** — `3354924` (feat)
2. **Task 2: Extend SlideTemplate with overlays + backgroundMode + export new overlay types** — `0f7a2ee` (feat)

_Note: Plan 44-01 frontmatter declares `tdd="true"` per task, but the plan body specifies type-only changes verified via tsc + grep + the existing registry test suite. No new test files were authored; instead the existing `src/__tests__/render/templates.test.ts` regression suite (7/7 passing) proves backwards compatibility._

## Files Created/Modified

- `src/lib/types/slide.ts` — TextSegment extended with two optional fields and a Phase 44 comment.
- `src/lib/render/templates/index.ts` — Three new exported types + two new optional SlideTemplate fields. `templates` array, `getTemplate` helper, and the 5 imported template constants are unchanged.
- `.planning/phases/44-template-schema-foundation/deferred-items.md` — Created to log pre-existing TS errors and vitest failures that are out of scope for this plan.

## Confirmation: Existing 5 Templates Untouched

`git diff --stat HEAD~2 HEAD -- src/lib/render/templates/highlight-bar.ts src/lib/render/templates/news-drop.ts src/lib/render/templates/news-cyan.ts src/lib/render/templates/y2k-pop.ts src/lib/render/templates/bold-yellow.ts` returns empty. All 5 existing template body files are byte-for-byte identical to pre-plan state.

## Decisions Made

None beyond what CONTEXT.md already locked. The plan was executed exactly as written — field ordering, enum values, and discriminator structure all sourced from CONTEXT.md decisions table.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the type extensions are purely additive and required no scaffolding fixes.

## Issues Encountered

**1. Pre-existing baseline failures in unrelated test files**
- `npx tsc --noEmit` reports 14 pre-existing errors, all in `src/__tests__/*` files (api-keys, auth, projects, stripe). None reference any file modified by Phase 44.
- `npx vitest run` reports 12 failing tests across 7 files (rate-limit, slide-preview, responsive, slide-preview, crud, stripe checkout, sync-subscription). All pre-date Phase 44.
- Confirmed identical baseline pass/fail counts via `git stash` round-trip both before and after edits.
- Logged in `.planning/phases/44-template-schema-foundation/deferred-items.md` per executor scope-boundary rule. Recommend a dedicated test-hygiene quick task.

## Validator Note

Per CONTEXT.md and the plan's <objective>, the registry validator (`validateTemplateRegistry()`) and its module-load wiring are explicitly **out of scope** for this plan. They are scheduled for Plan 44-02. This plan ships contracts only.

## Next Phase Readiness

- Plan 44-02 (validator + module-load wiring) can now consume the schema landed here.
- Phase 45 (renderer composition) has the type contracts it needs to wire Satori PNG export + React preview to overlays and backgroundMode.
- Phase 46 (premium template authoring — magazine-bold, tr3nding-news, documentary) has the schema it needs to declare overlays and bottom-card backgrounds.
- Phase 47 (AI prompt tuning) has `highlightColor` / `highlightStyle` fields it can populate on generated `hook_segments` / `body_segments`.

## Self-Check: PASSED

- `src/lib/types/slide.ts` — FOUND, contains `highlightColor?: string` and `highlightStyle?: 'pill' | 'block'` (verified via grep)
- `src/lib/render/templates/index.ts` — FOUND, contains `export type OverlaySlot`, `export type OverlayContent`, `export interface TemplateOverlay`, `overlays?: TemplateOverlay[]`, `backgroundMode?: 'color' | 'image-bleed' | 'image-with-bottom-card'` (verified via grep)
- Commit `3354924` (Task 1) — FOUND in git log
- Commit `0f7a2ee` (Task 2) — FOUND in git log
- Existing 5 template body files — zero changes (verified via `git diff --stat`)
- Existing `src/__tests__/render/templates.test.ts` — passes 7/7 post-changes

---
*Phase: 44-template-schema-foundation*
*Completed: 2026-04-29*
