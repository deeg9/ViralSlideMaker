import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplateTilePreview } from '@/components/slides/template-tile-preview'
import { pickerTemplates } from '@/lib/render/templates/index'
import type { SlideTemplate } from '@/lib/render/templates/index'

/**
 * Phase 90 (PREVIEW-04) — the picker tile is a SINGLE-BRANCH <img>.
 *
 * Every code AND DB template now carries a `preview` URL (a rendered
 * cover-snapshot PNG). <TemplateTilePreview> always renders exactly one
 * <img src={template.preview}> and NEVER mounts <SlidePreview> — the
 * live-render fallback branch was deleted. These tests lock that contract:
 * a `slide-preview` testid must never appear in the tile output.
 */

// A DB-style template with a saved cover-snapshot PNG.
const dbTemplate: SlideTemplate = {
  ...pickerTemplates[0],
  id: 'my-db-template',
  name: 'My DB Template',
  preview: 'https://example.com/cover.png',
}

// A code template — after Plan 02 every code template carries a `preview` URL.
const codeTemplate: SlideTemplate = {
  ...pickerTemplates[0],
  preview: 'https://example.com/code-cover.png',
}

describe('<TemplateTilePreview>', () => {
  it('renders the preview <img> (and never <SlidePreview>) for a DB template', () => {
    render(<TemplateTilePreview template={dbTemplate} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.png')
    expect(screen.queryByTestId('slide-preview')).toBeNull()
  })

  it('renders the preview <img> (and never <SlidePreview>) for a code template', () => {
    render(<TemplateTilePreview template={codeTemplate} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/code-cover.png')
    // The <SlidePreview> live-render fallback branch was deleted (PREVIEW-04).
    expect(screen.queryByTestId('slide-preview')).toBeNull()
  })

  it('gives the preview <img> descriptive alt text', () => {
    render(<TemplateTilePreview template={dbTemplate} />)
    expect(screen.getByAltText('Preview of My DB Template')).toBeTruthy()
  })
})
