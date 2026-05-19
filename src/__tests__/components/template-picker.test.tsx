import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplatePicker } from '@/components/slides/template-picker'
import { pickerTemplates } from '@/lib/render/templates/index'
import { dbRowToSlideTemplate } from '@/lib/render/templates/db-template-row'
import type { PickerDbTemplate } from '@/lib/render/templates/registry'
import type { BrandKit } from '@/lib/types/brand-kit'

/**
 * Phase 48-01 — TPLTHUMB-02 regression test.
 *
 * Locks the picker against future regressions where a template might
 * silently fall back to a swatch / text-only label instead of rendering
 * via <SlidePreview> + makeSampleSlide.
 *
 * Polyfills: relies on src/__tests__/setup.ts (ResizeObserver +
 * getBoundingClientRect 1080x1920 fallback) so SlidePreview can compute
 * its scale and render its inner DOM (testid: 'slide-preview').
 */

describe('<TemplatePicker> TPLTHUMB-02 parity', () => {
  it('renders exactly pickerTemplates.length SlidePreview tiles when brandKit is null', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
        brandKit={null}
      />,
    )
    // brandKit=null -> empty-state link in slot 0 (NOT a SlidePreview).
    // Picker iterates the filtered list; templates hidden via HIDDEN_FROM_PICKER
    // remain in the registry for legacy projects but do not render as tiles.
    const previews = screen.getAllByTestId('slide-preview')
    expect(previews.length).toBe(pickerTemplates.length)
  })

  it('renders exactly pickerTemplates.length + 1 SlidePreview tiles when brandKit is configured', () => {
    const configuredBrandKit: BrandKit = {
      // Minimum fields for isBrandKitConfigured() to return true:
      //   hasColors -> background_color + text_color, OR
      //   hasFont   -> body_font_family / heading_font_family / font_family
      background_color: '#3d0000',
      text_color: '#ffffff',
      accent_color: null,
      body_font_family: 'Inter',
      heading_font_family: 'Anton',
      font_family: null,
      // The remaining BrandKit fields are optional for the picker -
      // the test only needs isBrandKitConfigured() to pass.
    } as unknown as BrandKit

    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
        brandKit={configuredBrandKit}
      />,
    )
    const previews = screen.getAllByTestId('slide-preview')
    // pickerTemplates.length + 1 brand-kit tile = total SlidePreview instances.
    expect(previews.length).toBe(pickerTemplates.length + 1)
  })

  it('shows brand-kit empty-state link (not a SlidePreview) when brandKit is null', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
        brandKit={null}
      />,
    )
    // Empty-state copy lives in the dashed-border anchor; it should NOT
    // be wrapped in a SlidePreview. The string is split across a <br />,
    // so a regex match against just the first text node is the safe check.
    expect(screen.getByText(/Build your/i)).toBeInTheDocument()
  })

  it('renders a "Selected" indicator on the active template tile', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
        brandKit={null}
      />,
    )
    // At least one tile must be in the Selected state.
    expect(screen.getAllByText(/Selected/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders visible Phase 56 templates (editorial-serif, notes-app-chic) as SlidePreview tiles, not swatch fallback', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
        brandKit={null}
      />,
    )
    const previews = screen.getAllByTestId('slide-preview')
    expect(previews.length).toBe(pickerTemplates.length)

    // For each visible Phase 56 template, find its tile by display name.
    // brutalist-grid is intentionally omitted here — it's in the registry
    // (for legacy projects) but hidden from the picker.
    const visiblePhase56Templates = [
      { id: 'editorial-serif', name: 'Editorial Serif' },
      { id: 'notes-app-chic', name: 'Notes App Chic' },
    ]
    for (const tpl of visiblePhase56Templates) {
      expect(screen.getByText(tpl.name)).toBeInTheDocument()
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
        brandKit={null}
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
        brandKit={null}
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
        brandKit={null}
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
        brandKit={null}
        category="news"
      />,
    )
    expect(screen.queryByText('DB News Template')).not.toBeInTheDocument()
    expect(screen.getByText('News Oracle')).toBeInTheDocument()
  })
})
