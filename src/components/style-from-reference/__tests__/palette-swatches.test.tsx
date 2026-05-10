// Phase 76 Plan 02 (PREVIEW-02):
// PaletteSwatches display component tests.
//
// 6 tests assert: count by populated fields, hex labels rendered, inline
// background colors, mode badge for non-solid modes, copy-friendly hex via
// <code>, and PREVIEW-02 4–6 swatch range when extras are supplied.
//
// LEGAL-03 forward-compat: zero forbidden mimicry-framing tokens in either
// the test fixtures or the component (the integration test in
// spec-preview-panel-integration.test.tsx grep-gates the panel file too).

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaletteSwatches } from '../palette-swatches'
import type { StyleSpecPalette } from '@/lib/types/style-spec'

describe('Phase 76 Plan 02: PaletteSwatches (PREVIEW-02)', () => {
  it('Test 1: renders 1 swatch when only primary is set; 2 with primary+secondary; 3 with all three set', () => {
    const oneOnly: StyleSpecPalette = { mode: 'solid', primary: '#FF3366' }
    const { unmount, container } = render(<PaletteSwatches palette={oneOnly} />)
    expect(container.querySelectorAll('[data-testid="palette-swatch"]')).toHaveLength(1)
    unmount()

    const twoColors: StyleSpecPalette = {
      mode: 'duotone',
      primary: '#FF3366',
      secondary: '#3366FF',
    }
    const { unmount: unmount2, container: c2 } = render(<PaletteSwatches palette={twoColors} />)
    expect(c2.querySelectorAll('[data-testid="palette-swatch"]')).toHaveLength(2)
    unmount2()

    const threeColors: StyleSpecPalette = {
      mode: 'gradient',
      primary: '#FF3366',
      secondary: '#3366FF',
      accent: '#33FF66',
    }
    const { container: c3 } = render(<PaletteSwatches palette={threeColors} />)
    expect(c3.querySelectorAll('[data-testid="palette-swatch"]')).toHaveLength(3)
  })

  it('Test 2: each swatch has a hex label rendered as text', () => {
    const palette: StyleSpecPalette = {
      mode: 'gradient',
      primary: '#FF3366',
      secondary: '#3366FF',
      accent: '#33FF66',
    }
    render(<PaletteSwatches palette={palette} />)
    expect(screen.getByText('#FF3366')).toBeTruthy()
    expect(screen.getByText('#3366FF')).toBeTruthy()
    expect(screen.getByText('#33FF66')).toBeTruthy()
  })

  it('Test 3: each swatch DIV has inline backgroundColor matching the hex value', () => {
    const palette: StyleSpecPalette = { mode: 'solid', primary: '#a8e0b0' }
    const { container } = render(<PaletteSwatches palette={palette} />)
    const swatch = container.querySelector('[data-testid="palette-swatch-color"]') as HTMLElement
    expect(swatch).toBeTruthy()
    // jsdom normalizes to rgb(...) — assert the inline style.backgroundColor is a non-empty string
    // and the inline style attribute contains the hex (case-insensitive).
    expect(swatch.style.backgroundColor.length).toBeGreaterThan(0)
    expect((swatch.getAttribute('style') ?? '').toLowerCase()).toContain('#a8e0b0')
  })

  it('Test 4: when palette.mode === "duotone", renders a "Duotone" mode badge', () => {
    const palette: StyleSpecPalette = {
      mode: 'duotone',
      primary: '#FF3366',
      secondary: '#3366FF',
    }
    render(<PaletteSwatches palette={palette} />)
    const badge = screen.getByTestId('palette-mode-badge')
    expect(badge).toBeTruthy()
    expect(badge.textContent).toMatch(/duotone/i)
  })

  it('Test 5: hex labels are wrapped in <code> for copy-friendly selection', () => {
    const palette: StyleSpecPalette = { mode: 'solid', primary: '#FF3366' }
    const { container } = render(<PaletteSwatches palette={palette} />)
    const code = container.querySelector('code')
    expect(code).toBeTruthy()
    expect(code?.textContent).toBe('#FF3366')
  })

  it('Test 6: PREVIEW-02 — when extras are supplied with the 3 role colors, total swatch count is 6 (4–6 range)', () => {
    const palette: StyleSpecPalette = {
      mode: 'gradient',
      primary: '#111111',
      secondary: '#222222',
      accent: '#333333',
    }
    const extras = ['#aaaaaa', '#bbbbbb', '#cccccc']
    const { container } = render(<PaletteSwatches palette={palette} extras={extras} />)
    expect(container.querySelectorAll('[data-testid="palette-swatch"]')).toHaveLength(6)
    expect(screen.getByText('#aaaaaa')).toBeTruthy()
    expect(screen.getByText('#bbbbbb')).toBeTruthy()
    expect(screen.getByText('#cccccc')).toBeTruthy()
  })
})
