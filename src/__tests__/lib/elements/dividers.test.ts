import { describe, it, expect } from 'vitest'
import { DIVIDERS } from '@/lib/elements/dividers'

describe('DIVIDERS registry', () => {
  it('has 10 entries', () => {
    expect(DIVIDERS).toHaveLength(10)
  })

  it('every divider has unique id, non-empty label, and a build function', () => {
    const ids = new Set<string>()
    for (const d of DIVIDERS) {
      expect(d.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(d.id)).toBe(false)
      ids.add(d.id)
      expect(d.label.length).toBeGreaterThan(0)
      expect(typeof d.build).toBe('function')
    }
  })

  it('build() returns a base64 data URI for SVG', () => {
    for (const d of DIVIDERS) {
      const uri = d.build('#1F1F1F')
      expect(uri).toMatch(/^data:image\/svg\+xml;base64,/)
      // Decoded payload must be valid SVG.
      const base64 = uri.replace(/^data:image\/svg\+xml;base64,/, '')
      const svg = Buffer.from(base64, 'base64').toString('utf8')
      expect(svg).toContain('<svg')
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(svg).toContain('</svg>')
    }
  })

  it('build() interpolates the color into the SVG', () => {
    const colors = ['#1F1F1F', '#F5EFE6', '#6B6354']
    for (const color of colors) {
      for (const d of DIVIDERS) {
        const uri = d.build(color)
        const svg = Buffer.from(
          uri.replace(/^data:image\/svg\+xml;base64,/, ''),
          'base64',
        ).toString('utf8')
        expect(svg).toContain(color)
      }
    }
  })

  it('different colors produce different data URIs (no caching collision)', () => {
    for (const d of DIVIDERS) {
      const a = d.build('#1F1F1F')
      const b = d.build('#F5EFE6')
      expect(a).not.toBe(b)
    }
  })

  it('viewBox is consistent across the registry (600x40)', () => {
    for (const d of DIVIDERS) {
      const svg = Buffer.from(
        d.build('#000').replace(/^data:image\/svg\+xml;base64,/, ''),
        'base64',
      ).toString('utf8')
      expect(svg).toContain('viewBox="0 0 600 40"')
    }
  })
})
