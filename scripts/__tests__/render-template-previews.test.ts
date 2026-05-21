/**
 * Phase 90 Plan 01 Task 2 (PREVIEW-03) — render-template-previews.ts pure-helper
 * contract tests.
 *
 * These tests import the script's side-effect-free helpers DIRECTLY (no
 * execSync, no live Supabase, no Gemini spend). The script is structured so the
 * pure helpers — previewStoragePath, buildGapMap, rewriteTemplateSource — are
 * exported separately from `main()`; importing them does not run the pipeline.
 * (`generateCarousel` is imported lazily inside the live path of `main()`, so
 * even importing the helpers never pulls in the Pexels/Gemini clients.)
 *
 * The live pipeline itself is exercised manually in Plan 02.
 */
import { describe, it, expect } from 'vitest'
import {
  previewStoragePath,
  buildGapMap,
  rewriteTemplateSource,
  type ProjectRow,
} from '../render-template-previews'
import type { SlideTemplate } from '../../src/lib/render/templates/index'

// ─── previewStoragePath ─────────────────────────────────────────────────────

describe('previewStoragePath — deterministic, path-injection-guarded', () => {
  it('builds code-templates/{slug}.png', () => {
    expect(previewStoragePath('news-oracle')).toBe(
      'code-templates/news-oracle.png',
    )
    expect(previewStoragePath('y2k-pop')).toBe('code-templates/y2k-pop.png')
  })

  it('throws on a slash (path injection)', () => {
    expect(() => previewStoragePath('bad/id')).toThrow()
  })

  it('throws on uppercase characters', () => {
    expect(() => previewStoragePath('BadId')).toThrow()
  })

  it('throws on whitespace', () => {
    expect(() => previewStoragePath('a b')).toThrow()
  })

  it('throws on path-traversal dots', () => {
    expect(() => previewStoragePath('../secret')).toThrow()
  })
})

// ─── rewriteTemplateSource ──────────────────────────────────────────────────

// A minimal flat SlideTemplate literal — the shape every template file follows.
const SRC = `import type { SlideTemplate } from './index'

export const x: SlideTemplate = {
  id: 'x',
  name: 'X',
}
`

describe('rewriteTemplateSource — insert-or-replace, idempotent', () => {
  it('inserts a preview: line before the closing brace when none exists', () => {
    const out = rewriteTemplateSource(SRC, 'https://x/p.png')
    expect(out).toContain("preview: 'https://x/p.png',")
    // The closing brace of the literal is still intact.
    expect(out).toMatch(/\n}\n?$/)
    // The original fields survive untouched.
    expect(out).toContain("id: 'x',")
    expect(out).toContain("name: 'X',")
  })

  it('is idempotent — a second run with the same url is a no-op', () => {
    const once = rewriteTemplateSource(SRC, 'https://x/p.png')
    const twice = rewriteTemplateSource(once, 'https://x/p.png')
    expect(twice).toBe(once)
  })

  it('REPLACES an existing preview value rather than appending a duplicate', () => {
    const withA = rewriteTemplateSource(SRC, 'https://x/A.png')
    const withB = rewriteTemplateSource(withA, 'https://x/B.png')
    // Exactly one preview: line, and it carries the new value.
    const previewLines = withB.match(/preview:/g) ?? []
    expect(previewLines.length).toBe(1)
    expect(withB).toContain("preview: 'https://x/B.png',")
    expect(withB).not.toContain('A.png')
  })

  it('preserves indentation when replacing an existing preview line', () => {
    const tabIndented = `export const x: SlideTemplate = {
\tid: 'x',
\tpreview: 'https://x/old.png',
}
`
    const out = rewriteTemplateSource(tabIndented, 'https://x/new.png')
    expect(out).toContain("\tpreview: 'https://x/new.png',")
  })
})

// ─── buildGapMap ────────────────────────────────────────────────────────────

// Two template-like fixtures — only `id` matters to buildGapMap.
const fixtureTemplates = [
  { id: 'alpha' },
  { id: 'beta' },
] as unknown as SlideTemplate[]

function projectFixture(over: Partial<ProjectRow>): ProjectRow {
  return {
    id: 'p-default',
    title: 'T',
    topic: 'topic',
    template_id: null,
    slide_data: [],
    generation_status: 'complete',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('buildGapMap — exemplar vs gap, freshest-wins', () => {
  it('marks a template with a matching project as an exemplar', () => {
    const projects = [projectFixture({ id: 'p-alpha', template_id: 'alpha' })]
    const map = buildGapMap(fixtureTemplates, projects)
    const alpha = map.get('alpha')
    expect(alpha?.kind).toBe('exemplar')
    expect(alpha?.kind === 'exemplar' && alpha.project.id).toBe('p-alpha')
  })

  it('marks a template with no matching project as a gap', () => {
    const projects = [projectFixture({ id: 'p-alpha', template_id: 'alpha' })]
    const map = buildGapMap(fixtureTemplates, projects)
    expect(map.get('beta')?.kind).toBe('gap')
  })

  it('includes every supplied template id as a key', () => {
    const map = buildGapMap(fixtureTemplates, [])
    expect([...map.keys()].sort()).toEqual(['alpha', 'beta'])
  })

  it('picks the freshest project (latest updated_at) when several match', () => {
    const projects = [
      projectFixture({
        id: 'p-old',
        template_id: 'alpha',
        updated_at: '2026-01-01T00:00:00Z',
      }),
      projectFixture({
        id: 'p-new',
        template_id: 'alpha',
        updated_at: '2026-05-01T00:00:00Z',
      }),
      projectFixture({
        id: 'p-mid',
        template_id: 'alpha',
        updated_at: '2026-03-01T00:00:00Z',
      }),
    ]
    const map = buildGapMap(fixtureTemplates, projects)
    const alpha = map.get('alpha')
    expect(alpha?.kind === 'exemplar' && alpha.project.id).toBe('p-new')
  })
})
