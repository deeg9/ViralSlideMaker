import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplateTilePreview } from '@/components/slides/template-tile-preview'
import { pickerTemplates } from '@/lib/render/templates/index'
import type { SlideTemplate } from '@/lib/render/templates/index'

/**
 * Phase 86 (ADMIN-02) — the tile-level preview switch.
 *
 * Relies on src/__tests__/setup.ts polyfills (ResizeObserver +
 * getBoundingClientRect) so <SlidePreview> renders its inner DOM
 * (testid: 'slide-preview').
 */

// A real code template — leaves `preview` undefined (fallback branch).
const codeTemplate: SlideTemplate = pickerTemplates[0]

// A DB-style template with a saved cover-snapshot PNG.
const dbTemplate: SlideTemplate = {
  ...pickerTemplates[0],
  id: 'my-db-template',
  name: 'My DB Template',
  preview: 'https://example.com/cover.png',
}

describe('<TemplateTilePreview>', () => {
  it('renders the preview PNG (and no SlidePreview) when template.preview is set', () => {
    render(<TemplateTilePreview template={dbTemplate} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.png')
    expect(screen.queryByTestId('slide-preview')).toBeNull()
  })

  it('renders <SlidePreview> (and no preview img) when template.preview is absent', () => {
    render(<TemplateTilePreview template={codeTemplate} />)
    expect(screen.getByTestId('slide-preview')).toBeTruthy()
    expect(screen.queryByAltText(/^Preview of /)).toBeNull()
  })

  it('gives the preview img descriptive alt text (ADMIN-02)', () => {
    render(<TemplateTilePreview template={dbTemplate} />)
    expect(screen.getByAltText('Preview of My DB Template')).toBeTruthy()
  })
})
