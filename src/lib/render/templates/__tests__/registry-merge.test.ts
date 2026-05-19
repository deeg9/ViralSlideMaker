// Phase 83 (TSTORE-02): hermetic unit tests for the hybrid code+DB registry.
//
// All DB rows are injected via the registry test seam (__setDbTemplateFetcher)
// — NO live DB connection. Each test resets the cache + default fetcher in
// afterEach so cases are independent.
//
// Proves: merge resolution, the code-wins collision rule, DB-first picker
// ordering, isKnownTemplateId, the ~60s TTL cache, and graceful degradation
// when the DB read fails.

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  resolveTemplate,
  getPickerTemplates,
  getPickerDbTemplates,
  templateCategory,
  isKnownTemplateId,
  __setDbTemplateFetcher,
  __resetDbTemplateRegistry,
} from '../registry'
import type { DbTemplateRow } from '../db-template-row'
import { templates, pickerTemplates, TEMPLATE_IDS } from '../index'

function makeRow(id: string, overrides: Partial<DbTemplateRow> = {}): DbTemplateRow {
  return {
    id,
    name: `DB ${id}`,
    category: 'news',
    flat_style: { textColor: '#111111', backgroundColor: '#eeeeee' },
    layout_recipe: null,
    preview: null,
    created_by: null,
    created_at: '2026-05-18T00:00:00Z',
    updated_at: '2026-05-18T00:00:00Z',
    ...overrides,
  }
}

afterEach(() => {
  __resetDbTemplateRegistry()
})

describe('Phase 83 registry merge (TSTORE-02)', () => {
  it('resolveTemplate returns a DB template when the id matches only a DB row', async () => {
    __setDbTemplateFetcher(async () => [makeRow('db-only-tpl')])
    const tpl = await resolveTemplate('db-only-tpl')
    expect(tpl.id).toBe('db-only-tpl')
    // flat_style fields flow through the dbRowToSlideTemplate mapper.
    expect(tpl.textColor).toBe('#111111')
    expect(tpl.backgroundColor).toBe('#eeeeee')
  })

  it('resolveTemplate returns the CODE template on an id collision (code wins)', async () => {
    const codeId = TEMPLATE_IDS[0]
    // Inject a DB row that shadows an existing code-template id.
    __setDbTemplateFetcher(async () => [
      makeRow(codeId, { flat_style: { textColor: '#ff0000' }, name: 'DB IMPOSTER' }),
    ])
    const resolved = await resolveTemplate(codeId)
    const codeTemplate = templates.find((t) => t.id === codeId)
    expect(resolved).toEqual(codeTemplate)
    expect(resolved.name).not.toBe('DB IMPOSTER')
  })

  it('resolveTemplate falls back to templates[0] for an unknown id (never undefined/throws)', async () => {
    __setDbTemplateFetcher(async () => [])
    const tpl = await resolveTemplate('totally-unknown-id-xyz')
    expect(tpl).toEqual(templates[0])
  })

  it('getPickerTemplates lists DB templates first, then the code picker templates', async () => {
    __setDbTemplateFetcher(async () => [makeRow('db-a'), makeRow('db-b')])
    const picker = await getPickerTemplates()
    const ids = picker.map((t) => t.id)
    // First two entries are the DB ids...
    expect(ids.slice(0, 2)).toEqual(['db-a', 'db-b'])
    // ...the tail is exactly the code pickerTemplates in order.
    expect(ids.slice(2)).toEqual(pickerTemplates.map((t) => t.id))
  })

  it('getPickerTemplates drops a DB row whose id collides with a code template id', async () => {
    const codeId = TEMPLATE_IDS[0]
    __setDbTemplateFetcher(async () => [makeRow(codeId), makeRow('db-unique')])
    const picker = await getPickerTemplates()
    const ids = picker.map((t) => t.id)
    // No duplicate id — the colliding DB row is dropped.
    expect(new Set(ids).size).toBe(ids.length)
    // The colliding id appears at most once (from the code list).
    expect(ids.filter((id) => id === codeId).length).toBeLessThanOrEqual(1)
    // The non-colliding DB row still surfaces first.
    expect(ids[0]).toBe('db-unique')
  })

  it('isKnownTemplateId is true for a code id, true for a DB id, false for an unknown id', async () => {
    __setDbTemplateFetcher(async () => [makeRow('db-known')])
    expect(await isKnownTemplateId(TEMPLATE_IDS[0])).toBe(true)
    expect(await isKnownTemplateId('db-known')).toBe(true)
    expect(await isKnownTemplateId('nope-not-real')).toBe(false)
  })

  it('serves DB rows from the ~60s TTL cache — fetcher runs once across rapid calls', async () => {
    const fetcher = vi.fn(async () => [makeRow('db-cached')])
    __setDbTemplateFetcher(fetcher)
    await getPickerTemplates()
    await getPickerTemplates()
    await resolveTemplate('db-cached')
    // All three calls inside the TTL window → exactly one fetch.
    expect(fetcher).toHaveBeenCalledTimes(1)

    // __resetDbTemplateRegistry clears the cache — a fresh fetcher runs again.
    __resetDbTemplateRegistry()
    const fetcher2 = vi.fn(async () => [makeRow('db-after-reset')])
    __setDbTemplateFetcher(fetcher2)
    await getPickerTemplates()
    expect(fetcher2).toHaveBeenCalledTimes(1)
  })

  it('degrades gracefully when the DB fetch fails — never throws, code templates still resolve', async () => {
    __setDbTemplateFetcher(async () => {
      throw new Error('simulated DB outage')
    })
    // resolveTemplate of a code id still works.
    const codeId = TEMPLATE_IDS[0]
    const resolved = await resolveTemplate(codeId)
    expect(resolved).toEqual(templates.find((t) => t.id === codeId))
    // getPickerTemplates still returns at least the code picker templates.
    const picker = await getPickerTemplates()
    expect(picker.map((t) => t.id)).toEqual(pickerTemplates.map((t) => t.id))
    // isKnownTemplateId still answers without throwing.
    expect(await isKnownTemplateId(codeId)).toBe(true)
    expect(await isKnownTemplateId('unknown')).toBe(false)
  })
})

// Phase 87 Plan 01 Task 2 (WIRE-01): getPickerDbTemplates pairs each DB
// template with the row category + created_at the picker needs.
describe('getPickerDbTemplates', () => {
  it('returns each DB template paired with template, category, and createdAt', async () => {
    __setDbTemplateFetcher(async () => [
      makeRow('db-a', { category: 'news', created_at: '2026-05-19T00:00:00Z' }),
      makeRow('db-b', { category: 'facts', created_at: '2026-05-18T00:00:00Z' }),
    ])
    const result = await getPickerDbTemplates()
    expect(result).toHaveLength(2)
    for (const entry of result) {
      expect(entry).toHaveProperty('template')
      expect(entry).toHaveProperty('category')
      expect(entry).toHaveProperty('createdAt')
    }
    expect(result[0].category).toBe('news')
    expect(result[0].createdAt).toBe('2026-05-19T00:00:00Z')
    expect(result[0].template.id).toBe('db-a')
  })

  it('preserves the fetcher order (newest-first)', async () => {
    __setDbTemplateFetcher(async () => [
      makeRow('db-a', { created_at: '2026-05-19T00:00:00Z' }),
      makeRow('db-b', { created_at: '2026-05-18T00:00:00Z' }),
    ])
    const result = await getPickerDbTemplates()
    expect(result.map((r) => r.template.id)).toEqual(['db-a', 'db-b'])
  })

  it('drops a DB row whose id collides with a code template id', async () => {
    const codeId = TEMPLATE_IDS[0]
    __setDbTemplateFetcher(async () => [makeRow(codeId), makeRow('db-unique')])
    const result = await getPickerDbTemplates()
    const ids = result.map((r) => r.template.id)
    expect(ids).not.toContain(codeId)
    expect(ids).toContain('db-unique')
  })

  it('degrades to an empty array when the DB fetch fails — never throws', async () => {
    __resetDbTemplateRegistry()
    __setDbTemplateFetcher(async () => {
      throw new Error('boom')
    })
    const result = await getPickerDbTemplates()
    expect(result).toEqual([])
  })

  it('keeps a row whose category is null (the picker, not this helper, filters)', async () => {
    __setDbTemplateFetcher(async () => [makeRow('db-nullcat', { category: null })])
    const result = await getPickerDbTemplates()
    expect(result).toHaveLength(1)
    expect(result[0].category).toBeNull()
  })
})

// Phase 87 Plan 02 Task 2 (WIRE-02): templateCategory resolves a DB
// template's category (null for code/unknown ids).
describe('templateCategory', () => {
  it('returns null for a code-template id', async () => {
    expect(await templateCategory(TEMPLATE_IDS[0])).toBeNull()
  })

  it('returns the DB row category for a DB id', async () => {
    __setDbTemplateFetcher(async () => [makeRow('db-x', { category: 'news' })])
    expect(await templateCategory('db-x')).toBe('news')
  })

  it('returns null for an unknown id', async () => {
    __setDbTemplateFetcher(async () => [])
    expect(await templateCategory('unknown-id-zzz')).toBeNull()
  })

  it('returns null for a DB row whose category column is null', async () => {
    __setDbTemplateFetcher(async () => [makeRow('db-nullcat', { category: null })])
    expect(await templateCategory('db-nullcat')).toBeNull()
  })
})
