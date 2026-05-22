import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplatePicker } from '@/components/slides/template-picker'
import { pickerTemplates } from '@/lib/render/templates/index'
import { dbRowToSlideTemplate } from '@/lib/render/templates/db-template-row'
import type { PickerDbTemplate } from '@/lib/render/templates/registry'

/**
 * Phase 48-01 — TPLTHUMB-02 regression test.
 *
 * Locks the picker against future regressions where a template might
 * silently fall back to a swatch / text-only label instead of rendering
 * a preview tile.
 *
 * Phase 90 (PREVIEW-05): every code AND DB template now carries a `preview`
 * URL, so each picker tile renders a single <img> (no <SlidePreview>
 * live-render path). Tiles are therefore counted as `getAllByRole('img')`.
 */

describe('<TemplatePicker> TPLTHUMB-02 parity', () => {
  it('renders exactly pickerTemplates.length preview img tiles', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
      />,
    )
    // Picker iterates the filtered list; templates hidden via HIDDEN_FROM_PICKER
    // remain in the registry for legacy projects but do not render as tiles.
    const previews = screen.getAllByRole('img')
    expect(previews.length).toBe(pickerTemplates.length)
  })

  it('renders a "Selected" indicator on the active template tile', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
      />,
    )
    // At least one tile must be in the Selected state.
    expect(screen.getAllByText(/Selected/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders a picker-visible keeper as a named preview img tile, not swatch fallback', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
      />,
    )
    const previews = screen.getAllByRole('img')
    expect(previews.length).toBe(pickerTemplates.length)

    // A picker-visible keeper renders as a named tile (the TPLTHUMB-02
    // swatch-fallback regression guard).
    expect(screen.getByText('Sunset Tabloid')).toBeInTheDocument()

    // editorial-serif / soft-sage / y2k-pop stay in the registry for legacy
    // projects but were retired from the picker (HIDDEN_FROM_PICKER, 2026-05-20)
    // — the keeper-filtered picker must never render them as tiles.
    for (const hiddenName of ['Editorial Serif', 'Soft Sage', 'Y2K Pop']) {
      expect(screen.queryByText(hiddenName)).not.toBeInTheDocument()
    }
  })
})

/**
 * Phase 87 Plan 01 Task 6 — WIRE-01 DB-template merge.
 *
 * Proves a DB-backed template of the matching category appears in the
 * category-filtered picker, ordered DB-first before the category's code
 * templates, and is excluded from a non-matching category.
 */
describe('<TemplatePicker> WIRE-01 DB-template merge', () => {
  const dbNewsTemplate: PickerDbTemplate = {
    template: dbRowToSlideTemplate({
      id: 'db-news-87',
      name: 'DB News Template',
      category: 'news',
      flat_style: { textColor: '#111111', backgroundColor: '#eeeeee' },
      layout_recipe: null,
      preview: null,
      created_by: null,
      created_at: '2026-05-19T00:00:00Z',
      updated_at: '2026-05-19T00:00:00Z',
    }),
    category: 'news',
    createdAt: '2026-05-19T00:00:00Z',
  }

  it('shows a category=news DB template in the News picker', () => {
    render(
      <TemplatePicker
        selectedId="news-oracle"
        onSelect={vi.fn()}
        category="news"
        dbTemplates={[dbNewsTemplate]}
      />,
    )
    expect(screen.getByText('DB News Template')).toBeInTheDocument()
  })

  it('orders the DB template DB-first, before the News code templates', () => {
    const { container } = render(
      <TemplatePicker
        selectedId="news-oracle"
        onSelect={vi.fn()}
        category="news"
        dbTemplates={[dbNewsTemplate]}
      />,
    )
    // Tile name labels — the bold span inside each tile button.
    const names = Array.from(
      container.querySelectorAll('span.text-sm.font-semibold'),
    ).map((el) => el.textContent)
    const dbIdx = names.indexOf('DB News Template')
    const oracleIdx = names.indexOf('News Oracle')
    expect(dbIdx).toBeGreaterThanOrEqual(0)
    expect(oracleIdx).toBeGreaterThanOrEqual(0)
    // The DB tile precedes the first News code template.
    expect(dbIdx).toBeLessThan(oracleIdx)
  })

  it('excludes a DB template from a non-matching category', () => {
    render(
      <TemplatePicker
        selectedId="news-oracle"
        onSelect={vi.fn()}
        category="facts"
        dbTemplates={[dbNewsTemplate]}
      />,
    )
    expect(screen.queryByText('DB News Template')).not.toBeInTheDocument()
  })

  it('defaults dbTemplates to [] — a render without the prop is unchanged', () => {
    render(
      <TemplatePicker
        selectedId="news-oracle"
        onSelect={vi.fn()}
        category="news"
      />,
    )
    expect(screen.queryByText('DB News Template')).not.toBeInTheDocument()
    expect(screen.getByText('News Oracle')).toBeInTheDocument()
  })
})
