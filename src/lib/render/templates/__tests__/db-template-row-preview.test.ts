import { describe, it, expect } from 'vitest'
import {
  dbRowToSlideTemplate,
  templateFlatStyle,
  type DbTemplateRow,
} from '@/lib/render/templates/db-template-row'
import type { SlideTemplate } from '@/lib/render/templates'

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

/**
 * Phase 86 fix — templateFlatStyle: a resolved SlideTemplate → flat_style blob.
 * The write-side inverse of dbRowToSlideTemplate.
 */
const SAMPLE_TEMPLATE = {
  id: 'news-cyan',
  name: 'News Cyan',
  thumbnail: '/templates/news-cyan.png',
  fontFamily: 'Anton',
  headingFontFamily: undefined,
  hookFontSize: '120px',
  bodyFontSize: '28px',
  textColor: '#ffffff',
  backgroundColor: '#0a0a0a',
  overlayColor: '#000000',
  overlayOpacity: 0.45,
  accentColor: '#00e5ff',
  textAlign: 'center',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  sample: { hook_text: 'X', body_text: 'Y' },
} as SlideTemplate

describe('templateFlatStyle (Phase 86)', () => {
  it('carries the flat-style fields of a resolved template', () => {
    const blob = templateFlatStyle(SAMPLE_TEMPLATE)
    expect(blob).toMatchObject({
      fontFamily: 'Anton',
      hookFontSize: '120px',
      bodyFontSize: '28px',
      textColor: '#ffffff',
      backgroundColor: '#0a0a0a',
      overlayColor: '#000000',
      overlayOpacity: 0.45,
      accentColor: '#00e5ff',
      textAlign: 'center',
      textPosition: 'bottom',
      hookStyle: 'uppercase',
    })
  })

  it('strips identity + picker-asset keys (id, name, thumbnail, sample, preview)', () => {
    const blob = templateFlatStyle({
      ...SAMPLE_TEMPLATE,
      preview: 'https://example.com/p.png',
    } as SlideTemplate)
    expect(blob).not.toHaveProperty('id')
    expect(blob).not.toHaveProperty('name')
    expect(blob).not.toHaveProperty('thumbnail')
    expect(blob).not.toHaveProperty('sample')
    expect(blob).not.toHaveProperty('preview')
  })

  it('omits undefined-valued fields (skip-emit)', () => {
    const blob = templateFlatStyle(SAMPLE_TEMPLATE)
    expect(blob).not.toHaveProperty('headingFontFamily')
  })

  it('round-trips through dbRowToSlideTemplate — flat style survives, row id/name win', () => {
    const blob = templateFlatStyle(SAMPLE_TEMPLATE)
    const template = dbRowToSlideTemplate(
      makeRow({ id: 'transit-news', name: 'Transit News', flat_style: blob }),
    )
    // flat style of the source template is faithfully reproduced
    expect(template.fontFamily).toBe('Anton')
    expect(template.textColor).toBe('#ffffff')
    expect(template.backgroundColor).toBe('#0a0a0a')
    expect(template.accentColor).toBe('#00e5ff')
    expect(template.overlayOpacity).toBe(0.45)
    expect(template.hookStyle).toBe('uppercase')
    // the new DB template's own id/name win — not the source template's
    expect(template.id).toBe('transit-news')
    expect(template.name).toBe('Transit News')
  })
})
