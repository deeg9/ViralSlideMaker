---
phase: 60-multi-select-foundation-watermark-schema-lift
plan: 01
subsystem: schema
tags: [schema, types, watermark, multi-select, additive, foundation]
requires: []
provides:
  - "Watermark interface (top-level export)"
  - "TextBox.groupId? / locked? / hidden? optional fields"
  - "CustomImage.groupId? / locked? / hidden? optional fields"
  - "Slide.watermark? optional slot pointing at Watermark interface"
affects:
  - "Plan 60-02 (watermark-adapter consumers): imports Watermark + Slide.watermark"
  - "Plan 60-03 (useSelectionModel): reads slide.watermark?.id during stale-id reconciliation"
  - "Plan 60-05 (selection-bounds + ring): reads slide.watermark?.id for selection membership"
  - "Phase 62 (groups): writes groupId? semantics on all three element types"
  - "Phase 64 (lock/hide): writes locked? / hidden? semantics on all three element types"
tech-stack:
  added: []
  patterns:
    - "Additive optional-field convention (mirrors v2.8 segments?, effects? pattern at slide.ts:90-103)"
    - "Phase-tagged JSDoc on every new field/interface (mirrors slide.ts:177 style)"
key-files:
  created: []
  modified:
    - "src/lib/types/slide.ts (+39 lines: 3 fields × 2 interfaces + new Watermark interface + Slide.watermark? slot)"
decisions:
  - "Watermark id strategy: deterministic w_${slideIndex} (per RESEARCH Q2; idempotent across loads)"
  - "Legacy SlideStyleOverrides.watermark retained — Plan 02 lazy initializer dual-writes for one-milestone bridge"
  - "Watermark interface placed AFTER SlideStyleOverrides, BEFORE Slide (forward-references resolved)"
  - "Comments reference Phase 60 + WMARK-01 + downstream phase hand-off (62 groups, 64 lock/hide)"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-02"
  tasks: 2
  files: 1
  loc_added: 39
  loc_estimated: 60
---

# Phase 60 Plan 01: Schema Foundation — Optional Fields + Watermark Interface Summary

Lifted the v2.11 multi-select schema into `src/lib/types/slide.ts` with zero behavior changes — additive only.

## What Shipped

**Three optional multi-select fields landed on every addressable element:**

| Interface | Fields added | Where (line) |
|---|---|---|
| `TextBox` | `groupId?: string`, `locked?: boolean`, `hidden?: boolean` | 109-111 (before `position: TextBoxPosition`) |
| `CustomImage` | same three fields | 50-52 (after `border_radius?`) |
| `Watermark` (new) | same three fields | 188-190 (in new interface body) |

**New top-level `Watermark` interface (lines 170-191):**

```typescript
export interface Watermark {
  id: string
  enabled?: boolean
  customLogoUrl?: string
  customText?: string
  position?: 'top-left' | 'bottom-left' | 'bottom-right'
  groupId?: string
  locked?: boolean
  hidden?: boolean
}
```

**`Slide.watermark?: Watermark` optional slot (line 217):** Points at the new interface; renderers will read this with legacy fallback (Plan 02 wires the adapter; Plan 60-01 ships the slot only).

## Verification

- `npx tsc --noEmit -p tsconfig.json` → **23 errors total (same as baseline)**. All errors are pre-existing test-mock typing issues in `src/__tests__/auth/*`, `src/__tests__/projects/`, `src/__tests__/stripe/`, and `src/lib/services/__tests__/` (vitest `Mock<Procedure | Constructable>` shape). **Zero new errors introduced by slide.ts changes.** Confirmed via `git stash` baseline comparison.
- `npx vitest run src/lib/render/__tests__/parity.test.tsx` → **14/14 pass** (TPLREND-05 invariant intact).
- `npx vitest run src/lib/editor/__tests__/text-box-adapter.test.ts src/lib/editor/__tests__/editor-reducer.test.ts` → **46/46 pass**.
- `npx vitest run src/lib/` → **356/356 tests across 24 files pass**. Zero regressions.

**Grep coverage confirmation:**

```
$ grep -n "groupId?: string" src/lib/types/slide.ts
50:  groupId?: string
109:  groupId?: string
188:  groupId?: string
$ grep -n "^export interface Watermark" src/lib/types/slide.ts
180:export interface Watermark {
$ grep -n "watermark?: Watermark" src/lib/types/slide.ts
217:  watermark?: Watermark
```

All success criteria met (3 hits each for groupId/locked/hidden; exactly 1 Watermark interface; exactly 1 Slide.watermark slot).

## Downstream Consumers

| Plan | Imports / reads | Why |
|---|---|---|
| 60-02 | `Watermark`, `Slide.watermark` from `types/slide` | watermark-adapter.ts: `legacyWatermarkToElement(slide): Watermark \| null` + lazy initializer mints from `style_overrides.watermark` |
| 60-03 | `slide.watermark?.id` (in stale-id reconciliation effect) | useSelectionModel: filters `selection.ids` against union of `text_boxes ∪ custom_images ∪ watermark` ids; needs the optional slot to be addressable |
| 60-05 | `slide.watermark?.id` (in selection-bounds + ring rendering) | computeSelectionBounds reads element by id; selection ring renders union AABB across heterogeneous element types |
| Phase 62 | `groupId?` on TextBox / CustomImage / Watermark | group/ungroup behavior: Cmd+G writes shared `groupId`; Cmd+Shift+G clears it |
| Phase 64 | `locked?` / `hidden?` on all three element types | Cmd+Shift+L toggles `locked`; renderers filter `hidden` from output |

## Deviations from Plan

**None.** Plan executed exactly as written.

The plan estimated ~60 LOC (~50 in slide.ts + ~10 doc-comments). Actual: **39 LOC** — the three multi-select fields share a single 2-line JSDoc block (rather than per-field docs), which is more compact than the plan's estimate while still satisfying the "Comments reference Phase 60 + relevant REQ-IDs" success criterion.

## Cross-Phase Constraints Honored

- ✅ TPLREND-05 parity preserved (additive optional fields; renderers ignore them; parity test still passes byte-identically).
- ✅ Zero behavior changes (no reducer cases added, no render paths touched, no imports added).
- ✅ No new packages installed (tinykeys lands in Plan 60-04).
- ✅ No reducer action additions (BULK_TRANSLATE lands in Plan 60-03).
- ✅ Selection-state-outside-history pattern unaffected (Plan 60-03 generalizes the `selectedTextBoxId` slot; Plan 60-01 only declares fields).

## Self-Check: PASSED

**Files verified to exist:**
- ✅ `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/types/slide.ts` (39 lines added vs prior commit)

**Commits verified to exist:**
- ✅ `1164c73` — `feat(60-01/schema): add groupId/locked/hidden fields + Watermark interface`
