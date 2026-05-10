// Phase 76 Plan 02 (PREVIEW-08):
// BrandKitRemixToggle conditional + merged-palette preview tests.
//
// 7 tests: hidden when no brand kit, visible when present, dispatches
// TOGGLE_BRAND_KIT_REMIX, two-column preview when ON, hidden when OFF,
// per-field arrow indicators, and LEGAL-03 forward-compat grep on the file.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BrandKitRemixToggle } from '../brand-kit-remix-toggle'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { StyleSpec } from '@/lib/types/style-spec'

function makeBrandKit(overrides: Partial<BrandKit> = {}): BrandKit {
  return {
    id: 'bk-1',
    user_id: 'u-1',
    name: 'My Brand',
    primary_color: '#0000FF',
    secondary_color: '#00FF00',
    accent_color: '#FF0000',
    text_color: null,
    background_color: null,
    font_family: null,
    logo_url: null,
    logo_position: null,
    logo_size_pct: null,
    logo_opacity_pct: null,
    heading_font_family: null,
    body_font_family: null,
    text_align: null,
    text_position: null,
    hook_style: null,
    overlay_opacity_pct: null,
    created_at: '2026-05-10T00:00:00.000Z',
    updated_at: '2026-05-10T00:00:00.000Z',
    ...overrides,
  }
}

const EXTRACTED_PALETTE: StyleSpec['palette'] = {
  mode: 'gradient',
  primary: '#111111',
  secondary: '#222222',
  accent: '#333333',
}

describe('Phase 76 Plan 02: BrandKitRemixToggle (PREVIEW-08)', () => {
  it('Test 1: brandKitAvailable=false → renders null (no toggle DOM)', () => {
    const { container } = render(
      <BrandKitRemixToggle
        brandKit={null}
        brandKitAvailable={false}
        useBrandKitRemix={false}
        extractedPalette={EXTRACTED_PALETTE}
        dispatch={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
    expect(container.querySelector('[data-testid="brand-kit-remix-toggle"]')).toBeNull()
  })

  it('Test 2: brandKitAvailable=true and brandKit present → renders the toggle labeled "Remix with Brand Kit"', () => {
    render(
      <BrandKitRemixToggle
        brandKit={makeBrandKit()}
        brandKitAvailable={true}
        useBrandKitRemix={false}
        extractedPalette={EXTRACTED_PALETTE}
        dispatch={vi.fn()}
      />,
    )
    const toggle = screen.getByTestId('brand-kit-remix-toggle')
    expect(toggle).toBeTruthy()
    expect(toggle.textContent).toMatch(/remix with brand kit/i)
    const checkbox = screen.getByLabelText(/remix with brand kit/i) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('Test 3: clicking the toggle dispatches TOGGLE_BRAND_KIT_REMIX', () => {
    const dispatch = vi.fn()
    render(
      <BrandKitRemixToggle
        brandKit={makeBrandKit()}
        brandKitAvailable={true}
        useBrandKitRemix={false}
        extractedPalette={EXTRACTED_PALETTE}
        dispatch={dispatch}
      />,
    )
    fireEvent.click(screen.getByLabelText(/remix with brand kit/i))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_BRAND_KIT_REMIX' })
  })

  it('Test 4: when toggle is ON, renders two-column "Extracted vs Brand Kit" preview with matching swatch counts', () => {
    const { container } = render(
      <BrandKitRemixToggle
        brandKit={makeBrandKit()}
        brandKitAvailable={true}
        useBrandKitRemix={true}
        extractedPalette={EXTRACTED_PALETTE}
        dispatch={vi.fn()}
      />,
    )
    const extractedSwatches = container.querySelectorAll('[data-testid="swatch-extracted"]')
    const brandKitSwatches = container.querySelectorAll('[data-testid="swatch-brand-kit"]')
    // Extracted: primary + secondary + accent = 3
    expect(extractedSwatches).toHaveLength(3)
    // Brand kit: primary + secondary + accent = 3 (all set in fixture)
    expect(brandKitSwatches).toHaveLength(3)
    // Preview wrapper visible
    expect(container.querySelector('[data-testid="merge-preview"]')).toBeTruthy()
  })

  it('Test 5: when toggle is OFF, the two-column preview is NOT rendered', () => {
    const { container } = render(
      <BrandKitRemixToggle
        brandKit={makeBrandKit()}
        brandKitAvailable={true}
        useBrandKitRemix={false}
        extractedPalette={EXTRACTED_PALETTE}
        dispatch={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="merge-preview"]')).toBeNull()
    expect(container.querySelectorAll('[data-testid="swatch-extracted"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="swatch-brand-kit"]')).toHaveLength(0)
  })

  it('Test 6: per-field arrow indicator appears once per overridable field when toggle is ON', () => {
    // Brand kit has all 3 colors set; extracted has all 3 → 3 arrows.
    const { container, rerender } = render(
      <BrandKitRemixToggle
        brandKit={makeBrandKit()}
        brandKitAvailable={true}
        useBrandKitRemix={true}
        extractedPalette={EXTRACTED_PALETTE}
        dispatch={vi.fn()}
      />,
    )
    expect(container.querySelectorAll('[data-testid="merge-arrow"]')).toHaveLength(3)

    // If brand kit accent is null, the arrow for accent disappears (2 arrows).
    rerender(
      <BrandKitRemixToggle
        brandKit={makeBrandKit({ accent_color: null })}
        brandKitAvailable={true}
        useBrandKitRemix={true}
        extractedPalette={EXTRACTED_PALETTE}
        dispatch={vi.fn()}
      />,
    )
    expect(container.querySelectorAll('[data-testid="merge-arrow"]')).toHaveLength(2)
  })

  it('Test 7: LEGAL-03 forward-compat — zero forbidden tokens in the component file', () => {
    const filePath = path.resolve(__dirname, '../brand-kit-remix-toggle.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in brand-kit-remix-toggle.tsx`).toBe(0)
    }
  })
})
