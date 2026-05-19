import { describe, it, expect } from 'vitest'
import { dbRowToSlideTemplate, type DbTemplateRow } from '@/lib/render/templates/db-template-row'

/**
 * Phase 86 (ADMIN-02) — the DB→SlideTemplate mapper carries the preview URL.
 */

function makeRow(overrides: Partial<DbTemplateRow> = {}): DbTemplateRow {
  return {
    id: 'my-db-template',
    name: 'My DB Template',
    category: 'news',
    flat_style: {},
    layout_recipe: null,
    preview: null,
    created_by: null,
    created_at: '2026-05-19T00:00:00Z',
    updated_at: '2026-05-19T00:00:00Z',
    ...overrides,
  }
}

describe('dbRowToSlideTemplate — preview field (Phase 86)', () => {
  it('carries a non-null preview URL onto SlideTemplate.preview', () => {
    const template = dbRowToSlideTemplate(
      makeRow({ preview: 'https://example.com/p.png' }),
    )
    expect(template.preview).toBe('https://example.com/p.png')
  })

  it('maps a null preview to undefined', () => {
    const template = dbRowToSlideTemplate(makeRow({ preview: null }))
    expect(template.preview).toBeUndefined()
  })

  it('still backfills required fields and lets id/name win over the blob', () => {
    const template = dbRowToSlideTemplate(
      makeRow({
        id: 'canonical-id',
        name: 'Canonical Name',
        flat_style: { id: 'blob-id', name: 'Blob Name', textColor: '#123456' },
      }),
    )
    expect(template.id).toBe('canonical-id')
    expect(template.name).toBe('Canonical Name')
    expect(template.textColor).toBe('#123456')
    // a required field absent from the blob is backfilled
    expect(template.fontFamily).toBeTruthy()
  })
})
