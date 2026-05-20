// Phase 82 (R7/R8/R9): keeper-curation guard.
//
// The template gallery was curated to 5 polished keepers via hide-not-delete.
// The keeper list was signed off by the user before the cull (SPEC R9 — see
// `.planning/phases/82-.../82-KEEPER-SIGNOFF.md`). This suite pins the cull so
// it cannot silently drift:
//   - pickerTemplates contains EXACTLY the 5 approved keepers.
//   - each of the 8 culled ids is absent from the picker but still resolves
//     via getTemplate() (renderer retained — back-compat with ~50 saved
//     projects; SPEC R8 hide-not-delete).
//   - every category's templateIds entry is a picker-visible keeper, so a
//     category can never resolve to a hidden template (SPEC R7).

import { describe, it, expect } from 'vitest'
import {
  templates,
  pickerTemplates,
  HIDDEN_FROM_PICKER,
  getTemplate,
} from '@/lib/render/templates'
import { CATEGORIES } from '@/lib/ai/categories'

// The user-approved keeper list (82-KEEPER-SIGNOFF.md, signed off 2026-05-17).
// quick task 260518-jhg: news-cyan retired from the picker, replaced by the
// Oracle-style news-oracle keeper — still 5 keepers (a swap, not an addition).
// quick task 260519-t3x: 3 trending-style additions (sunset-tabloid / soft-sage
// / chrome-pulse) appended to the picker — 5 keepers → 8 (verbally approved
// 2026-05-19 for the marketing-push expansion).
const APPROVED_KEEPERS = [
  'news-oracle',
  'tr3nding-news',
  'bold-yellow',
  'editorial-serif',
  'y2k-pop',
  'sunset-tabloid',
  'soft-sage',
  'chrome-pulse',
] as const

// The user-approved cull list (hidden from picker, renderers retained).
// quick task 260518-jhg: news-cyan added to the cull (8 culled ids now).
const CULLED_IDS = [
  'highlight-bar',
  'news-drop',
  'news-cyan',
  'magazine-bold',
  'documentary',
  'notes-app-chic',
  'brutalist-grid',
  'paper-essay',
] as const

describe('Phase 82 — keeper-list curation (R8/R9 hide-not-delete)', () => {
  it('pickerTemplates is exactly the approved keepers (5 + 3 from quick-260519-t3x = 8)', () => {
    const pickerIds = pickerTemplates.map((t) => t.id).sort()
    expect(pickerIds).toEqual([...APPROVED_KEEPERS].sort())
  })

  it('every culled id is absent from pickerTemplates', () => {
    const pickerIds = new Set(pickerTemplates.map((t) => t.id))
    for (const id of CULLED_IDS) {
      expect(pickerIds.has(id), `culled id '${id}' must NOT be in the picker`).toBe(false)
      expect(HIDDEN_FROM_PICKER.has(id), `'${id}' must be in HIDDEN_FROM_PICKER`).toBe(true)
    }
  })

  it('every culled id STILL resolves via getTemplate (renderer retained — SPEC R8)', () => {
    for (const id of CULLED_IDS) {
      const tpl = getTemplate(id)
      // getTemplate falls back to templates[0] on an unknown id — assert the
      // resolved template actually IS the requested one (renderer retained).
      expect(tpl.id, `getTemplate('${id}') must resolve to the real '${id}' renderer`).toBe(id)
    }
  })

  it("getTemplate('highlight-bar') still resolves (culled but renderable)", () => {
    const tpl = getTemplate('highlight-bar')
    expect(tpl.id).toBe('highlight-bar')
    expect(tpl.name).toBe('Highlight Bar')
  })

  it('the registry holds all 16 templates (no deletions — hide-not-delete; +news-oracle per quick task 260518-jhg; +3 trending per quick task 260519-t3x)', () => {
    const registryIds = new Set(templates.map((t) => t.id))
    for (const id of [...APPROVED_KEEPERS, ...CULLED_IDS]) {
      expect(registryIds.has(id), `template '${id}' must remain registered`).toBe(true)
    }
    expect(templates.length).toBe(16)
  })

  it('every category templateIds entry is a picker-visible keeper (no category resolves to a hidden template — SPEC R7)', () => {
    const keeperIds = new Set(pickerTemplates.map((t) => t.id))
    for (const category of CATEGORIES) {
      for (const tid of category.templateIds) {
        expect(
          keeperIds.has(tid),
          `category '${category.id}' references templateId '${tid}' which is not a picker-visible keeper`,
        ).toBe(true)
      }
    }
  })
})
