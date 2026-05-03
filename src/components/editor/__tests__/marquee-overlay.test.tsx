import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fs from 'fs'
import * as path from 'path'
import { MarqueeOverlay } from '../marquee-overlay'

/**
 * Phase 61 (SEL-05): MarqueeOverlay render-only tests.
 *
 * Component owns NO state. Plan 61-02 wires the selecto event handlers
 * and passes the current rect (or null) as a prop. Tests assert:
 *   - null prop → no DOM
 *   - non-null prop → single absolute-positioned div with correct geometry
 *   - pointer-events:none (PITFALLS Cat-2.5 prevents click blocking)
 *   - 'use client' directive present (it's a client-only render seam)
 *   - selecto package importable (Day-1 install gate)
 */

describe('MarqueeOverlay — render contract', () => {
  it('Test 1: rect=null → component returns null (no marquee testid in DOM)', () => {
    render(<MarqueeOverlay rect={null} />)
    expect(screen.queryByTestId('marquee-overlay')).toBeNull()
  })

  it('Test 2: rect non-null → renders single div with data-testid="marquee-overlay"', () => {
    render(
      <MarqueeOverlay rect={{ x: 10, y: 20, w: 100, h: 200 }} />,
    )
    const el = screen.getByTestId('marquee-overlay')
    expect(el).toBeInTheDocument()
    expect(el.tagName).toBe('DIV')
  })

  it('Test 3: geometry maps to inline px style', () => {
    render(
      <MarqueeOverlay rect={{ x: 10, y: 20, w: 100, h: 200 }} />,
    )
    const el = screen.getByTestId('marquee-overlay') as HTMLDivElement
    expect(el.style.left).toBe('10px')
    expect(el.style.top).toBe('20px')
    expect(el.style.width).toBe('100px')
    expect(el.style.height).toBe('200px')
  })

  it('Test 4: pointer-events:none so clicks pass through (PITFALL-2.5)', () => {
    render(
      <MarqueeOverlay rect={{ x: 0, y: 0, w: 50, h: 50 }} />,
    )
    const el = screen.getByTestId('marquee-overlay') as HTMLDivElement
    expect(el.style.pointerEvents).toBe('none')
  })

  it('Test 5: dashed border + translucent fill', () => {
    render(
      <MarqueeOverlay rect={{ x: 0, y: 0, w: 50, h: 50 }} />,
    )
    const el = screen.getByTestId('marquee-overlay') as HTMLDivElement
    // Border should be dashed style
    expect(el.style.border.toLowerCase()).toContain('dashed')
    // Background should use rgba (translucent fill)
    expect(el.style.backgroundColor.toLowerCase()).toMatch(/rgba/)
  })
})

describe("MarqueeOverlay — 'use client' directive present", () => {
  it("Test 6: source file's first non-blank line is a 'use client' directive", () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/components/editor/marquee-overlay.tsx',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    const firstNonBlank = src
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0)
    expect(firstNonBlank).toMatch(/^['"]use client['"]\s*;?$/)
  })
})

describe('selecto package — install gate', () => {
  it('Test 7: selecto is importable and exports a constructor', async () => {
    const imported = await import('selecto')
    // selecto has a default export Selecto class. Some bundlers flatten
    // ESM/CJS interop, so accept either default or top-level callable.
    const Selecto =
      typeof imported.default === 'function'
        ? imported.default
        : (imported as unknown as { default: unknown })
    expect(typeof Selecto).toBe('function')
  })
})
