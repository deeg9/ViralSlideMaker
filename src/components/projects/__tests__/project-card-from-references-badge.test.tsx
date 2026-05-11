// Phase 77 Plan 03 (EDITOR-02 + EDITOR-03 integration):
// 1) ProjectCard renders FromReferencesBadge iff project.style_spec is non-null.
// 2) Project detail page (server component) imports + renders
//    ReferenceThumbnailsStrip in the hasSlides branch (source-grep test —
//    server components are not directly mountable in vitest jsdom without
//    heavy supabase + auth scaffolding; the source-grep is the practical
//    integration check, plus the 11 GREEN tests on the strip itself prove
//    its conditional-render behavior).

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { ProjectCard } from '../project-card'
import type { Project } from '@/lib/types/project'
import type { StyleSpec } from '@/lib/types/style-spec'

// Minimal valid StyleSpec for the "has style_spec" case.
const fakeStyleSpec: StyleSpec = {
  schema_version: 1,
  palette: { mode: 'solid', primary: '#000000' },
  typography: {},
  layout: {},
  imagery: {},
  decorations: {},
  rhythm: {},
}

const baseProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  user_id: 'user-1',
  title: 'Test Project',
  description: null,
  slide_data: [],
  template_id: 'highlight-bar',
  topic: 'cooking',
  created_at: '2026-05-10T00:00:00Z',
  updated_at: '2026-05-10T00:00:00Z',
  ...overrides,
})

describe('ProjectCard × FromReferencesBadge integration (EDITOR-02)', () => {
  it('Test 1: badge IS rendered when project.style_spec is non-null', () => {
    const project = baseProject({ style_spec: fakeStyleSpec })
    render(<ProjectCard project={project} />)
    expect(screen.getByTestId('from-references-badge')).toBeInTheDocument()
  })

  it('Test 2: badge is NOT rendered when project.style_spec is null', () => {
    const project = baseProject({ style_spec: null })
    render(<ProjectCard project={project} />)
    expect(screen.queryByTestId('from-references-badge')).not.toBeInTheDocument()
  })

  it('Test 3: badge is NOT rendered when project.style_spec field is absent (defensive)', () => {
    const project = baseProject() // no style_spec field at all
    render(<ProjectCard project={project} />)
    expect(screen.queryByTestId('from-references-badge')).not.toBeInTheDocument()
  })

  it('Test 4: existing card chrome still renders (regression — title visible)', () => {
    const project = baseProject({
      title: 'Cooking carousel',
      style_spec: fakeStyleSpec,
    })
    render(<ProjectCard project={project} />)
    expect(screen.getByText('Cooking carousel')).toBeInTheDocument()
  })

  it('Test 5: badge container has pointer-events-none so it does not intercept card click', () => {
    const project = baseProject({ style_spec: fakeStyleSpec })
    const { container } = render(<ProjectCard project={project} />)
    const badge = screen.getByTestId('from-references-badge')
    // Walk up to find the wrapper with pointer-events-none
    let cur: HTMLElement | null = badge as HTMLElement
    let foundPointerEventsNone = false
    while (cur && cur !== container) {
      if (cur.className && cur.className.includes('pointer-events-none')) {
        foundPointerEventsNone = true
        break
      }
      cur = cur.parentElement
    }
    expect(foundPointerEventsNone).toBe(true)
  })
})

describe('Project detail page × ReferenceThumbnailsStrip integration (EDITOR-03)', () => {
  // Server component — direct mount needs supabase auth + RLS scaffolding that
  // the rest of this repo's vitest suite does NOT exercise. The Phase 77 strip
  // component's conditional-render is already proven by 11 GREEN tests in
  // reference-thumbnails-strip.test.tsx; here we source-grep the page file to
  // prove the wiring exists.
  const pageSrc = readFileSync(
    path.resolve(
      __dirname,
      '../../../app/(dashboard)/project/[id]/page.tsx',
    ),
    'utf8',
  )

  it('Test 6: project detail page imports ReferenceThumbnailsStrip', () => {
    expect(pageSrc).toMatch(
      /import\s+\{\s*ReferenceThumbnailsStrip\s*\}\s+from\s+['"]@\/components\/projects\/reference-thumbnails-strip['"]/,
    )
  })

  it('Test 7: project detail page renders ReferenceThumbnailsStrip with reference_assets prop', () => {
    // Renders the JSX in the hasSlides branch (above the SlideEditor). Strip
    // itself returns null when empty — legacy projects keep full-bleed editor.
    expect(pageSrc).toMatch(/<ReferenceThumbnailsStrip\s+references=\{[^}]*reference_assets/)
  })

  it('Test 7b: SlideEditor mount is preserved in the hasSlides branch (no regression)', () => {
    // Defends against an accidental delete of the SlideEditor render call.
    expect(pageSrc).toMatch(/<SlideEditor\b/)
    expect(pageSrc).toMatch(/initialSlides=\{slides\}/)
  })
})
