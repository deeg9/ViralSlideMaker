// Phase 83 (TSTORE-04): byte-identity guard for the registry merge.
//
// The Phase 83 registry merge adds a DB-aware accessor layer but must change
// how NO code template renders. This suite proves:
//   A. async resolveTemplate returns every one of the 13 code templates
//      byte-identical to the sync getTemplate (sha256 of JSON.stringify).
//   B. A DB row whose id collides with a code template id cannot shadow it.
//   C. The registry layer never mutates the code templates[] array.

import { describe, it, expect, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  resolveTemplate,
  getPickerTemplates,
  __setDbTemplateFetcher,
  __resetDbTemplateRegistry,
} from '@/lib/render/templates/registry'
import type { DbTemplateRow } from '@/lib/render/templates/db-template-row'
import { templates, getTemplate, TEMPLATE_IDS } from '@/lib/render/templates'

function hashTemplate(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function makeRow(id: string, overrides: Partial<DbTemplateRow> = {}): DbTemplateRow {
  return {
    id,
    name: `DB ${id}`,
    category: 'news',
    flat_style: {},
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

describe('Phase 83: code-template byte-identity after the storage change (TSTORE-04)', () => {
  it('async resolveTemplate returns every code template byte-identical to sync getTemplate', async () => {
    __setDbTemplateFetcher(async () => [])
    for (const id of TEMPLATE_IDS) {
      const syncHash = hashTemplate(getTemplate(id))
      const asyncHash = hashTemplate(await resolveTemplate(id))
      expect(asyncHash, `template '${id}' diverged between getTemplate and resolveTemplate`).toBe(
        syncHash,
      )
    }
  })

  it('a colliding DB row cannot shadow a code template (code wins at the render boundary)', async () => {
    const codeId = TEMPLATE_IDS[0]
    // A DB row that impersonates a code id with a different style.
    __setDbTemplateFetcher(async () => [
      makeRow(codeId, { flat_style: { textColor: '#ff00ff' }, name: 'DB SHADOW' }),
    ])
    const resolved = await resolveTemplate(codeId)
    expect(resolved).toEqual(getTemplate(codeId))
    expect(resolved.name).not.toBe('DB SHADOW')
  })

  it('the registry layer never mutates the code templates[] array', async () => {
    const before = hashTemplate(templates)
    __setDbTemplateFetcher(async () => [makeRow('db-side-effect-probe')])
    await resolveTemplate('db-side-effect-probe')
    await getPickerTemplates()
    await resolveTemplate(TEMPLATE_IDS[0])
    const after = hashTemplate(templates)
    expect(after).toBe(before)
  })
})
