// Phase 77 Plan 03 (EDITOR-03): tests for ReferenceThumbnailsStrip.
// Pure presentation horizontal strip; reads project.reference_assets;
// LEGAL-03 framing; lazy-loaded thumbs; safe with empty/undefined input.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { ReferenceThumbnailsStrip } from '../reference-thumbnails-strip'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

// LEGAL-03 forbidden tokens (mirror Task 2 grep). Zero matches required.
const LEGAL_03_FORBIDDEN = [
  'exactly like',
  'exactly the same',
  'copied from',
  'cloned from',
  'clone of',
  'duplicate of',
  'copy of',
] as const

const makeRow = (i: number): ReferenceAssetRow => ({
  url: `https://example.com/ref-${i}.png`,
  sha256: `sha-${i}`,
  uploaded_at: '2026-05-10T00:00:00Z',
  mime_type: 'image/png',
  size_bytes: 1024 + i,
  original_filename: `ref-${i}.png`,
})

describe('ReferenceThumbnailsStrip (EDITOR-03)', () => {
  it('Test 1: renders null when references=[] (empty array)', () => {
    const { container } = render(<ReferenceThumbnailsStrip references={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('reference-thumbnails-strip')).not.toBeInTheDocument()
  })

  it('Test 2: renders null when references=undefined (defensive)', () => {
    const { container } = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <ReferenceThumbnailsStrip references={undefined as any} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('Test 2b: renders null when references=null (defensive)', () => {
    const { container } = render(<ReferenceThumbnailsStrip references={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('Test 3: renders one <img> with src=row.url for a single-reference input', () => {
    const rows = [makeRow(1)]
    const { container } = render(<ReferenceThumbnailsStrip references={rows} />)
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0].getAttribute('src')).toBe('https://example.com/ref-1.png')
  })

  it('Test 4: renders three <img> elements in order for a 3-reference input', () => {
    const rows = [makeRow(1), makeRow(2), makeRow(3)]
    const { container } = render(<ReferenceThumbnailsStrip references={rows} />)
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(3)
    expect(imgs[0].getAttribute('src')).toBe('https://example.com/ref-1.png')
    expect(imgs[1].getAttribute('src')).toBe('https://example.com/ref-2.png')
    expect(imgs[2].getAttribute('src')).toBe('https://example.com/ref-3.png')
  })

  it('Test 5: every <img> has loading="lazy" and decoding="async" (perf)', () => {
    const rows = [makeRow(1), makeRow(2)]
    const { container } = render(<ReferenceThumbnailsStrip references={rows} />)
    const imgs = container.querySelectorAll('img')
    imgs.forEach((img) => {
      expect(img.getAttribute('loading')).toBe('lazy')
      expect(img.getAttribute('decoding')).toBe('async')
    })
  })

  it('Test 6: every <img> has alt text matching /reference/i (a11y; LEGAL-03 framing)', () => {
    const rows = [makeRow(1), makeRow(2)]
    const { container } = render(<ReferenceThumbnailsStrip references={rows} />)
    const imgs = container.querySelectorAll('img')
    imgs.forEach((img) => {
      const alt = img.getAttribute('alt') ?? ''
      expect(alt.toLowerCase()).toMatch(/inspired by reference|reference/)
    })
  })

  it('Test 7: visible "Inspired by" caption present in rendered output', () => {
    const rows = [makeRow(1)]
    const { container } = render(<ReferenceThumbnailsStrip references={rows} />)
    expect(container.innerHTML.toLowerCase()).toMatch(/inspired by/)
  })

  it('Test 8: rendered HTML contains ZERO LEGAL-03 forbidden tokens', () => {
    const rows = [makeRow(1), makeRow(2), makeRow(3)]
    const { container } = render(<ReferenceThumbnailsStrip references={rows} />)
    const html = container.innerHTML.toLowerCase()
    for (const token of LEGAL_03_FORBIDDEN) {
      expect(html, `forbidden token found: "${token}"`).not.toContain(token)
    }
  })

  it('Test 9: strip has data-testid="reference-thumbnails-strip"', () => {
    const rows = [makeRow(1)]
    render(<ReferenceThumbnailsStrip references={rows} />)
    expect(screen.getByTestId('reference-thumbnails-strip')).toBeInTheDocument()
  })

  it('Test 10: source imports zero data-fetching modules (pure presentation)', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../reference-thumbnails-strip.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/from\s+['"]@supabase/)
    expect(src).not.toMatch(/from\s+['"]@\/lib\/supabase/)
    expect(src).not.toMatch(/from\s+['"]next\/navigation['"]/)
    expect(src).not.toMatch(/useRouter\b/)
    expect(src).not.toMatch(/useState\b/)
    expect(src).not.toMatch(/useEffect\b/)
    expect(src).not.toMatch(/from\s+['"]swr['"]/)
  })
})
