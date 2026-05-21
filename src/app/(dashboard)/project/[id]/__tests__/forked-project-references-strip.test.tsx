// Phase 78 Plan 02 Task 4 (REMIX-04 verification):
// Integration test proving that AFTER a fork, the forked project's detail
// page renders <ReferenceThumbnailsStrip> with the inherited reference_assets.
//
// What this proves end-to-end:
//   - Plan 78-01's fork RPC extension (`fork_published_carousel`) populates
//     the new projects row's `reference_assets` from the published row
//   - Phase 77-03's <ReferenceThumbnailsStrip> renders by-construction when
//     `project.reference_assets` is non-null + non-empty
//   - Therefore: a forker landing on /project/{forkId} sees the inherited
//     reference thumbnails — REMIX-04 satisfied.
//
// We mock the fork RPC's RETURN STATE (the projects row that exists after
// the fork has run) — the actual SQL is exercised by the migration tests in
// Plan 78-01. This test sits at the seam where the page reads the row and
// renders the strip.
//
// All Supabase / credit calls are mocked at the module boundary; the editor +
// dialog children are stubbed because their internal trees are out of scope
// for the REMIX-04 invariant under test.
//
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

// ---- Hoisted mocks ----
const {
  mockGetUser,
  mockProjectsSingle,
  mockPublishedMaybeSingle,
  mockGetUserTier,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProjectsSingle: vi.fn(),
  mockPublishedMaybeSingle: vi.fn(),
  mockGetUserTier: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => {
  // Build a chainable mock that routes the two `.from('...')` calls in the
  // page (`projects` for row read, `published_carousels` for status badge).
  const fromProjects = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockProjectsSingle,
  }
  const fromPublished = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: mockPublishedMaybeSingle,
  }
  return {
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn((table: string) =>
        table === 'projects' ? fromProjects : fromPublished,
      ),
    }),
  }
})

vi.mock('@/lib/credits/check-credits', () => ({
  getUserTier: mockGetUserTier,
}))

// Stub the editor — its internal tree (history, toolbars, undo, ...) is
// orthogonal to the REMIX-04 invariant under test. Render a marker so we
// can confirm the page IS in the editor branch.
vi.mock('@/components/editor/slide-editor', () => ({
  SlideEditor: () => <div data-testid="slide-editor-stub" />,
}))

vi.mock('@/components/projects/project-naming-dialog', () => ({
  ProjectNamingDialog: () => null,
}))

vi.mock('@/components/slides/generation-form', () => ({
  GenerationForm: () => null,
}))

// Notably, we do NOT mock <ReferenceThumbnailsStrip> or
// <RegenerateFromReferencesButton> — they are exactly what we want to verify
// renders end-to-end with the inherited reference_assets.

// However, the button's transitively-imported server actions module (which
// reaches Gemini + Pexels clients that error at module-load when API keys
// are unset in jsdom test env) is mocked at the boundary the button sees.
// The button only calls regenerateFromReferencesAction on click, never at
// mount, so an inert mock is sufficient for the REMIX-04 invariant under
// test (which asserts MOUNT-time render of the strip + button trigger).
vi.mock('@/app/(dashboard)/style-from-reference/actions', () => ({
  regenerateFromReferencesAction: vi.fn(),
}))

// Stub next/navigation.notFound — if it gets called, the test should fail
// loud (we always feed a row from the projects mock).
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound() called — test setup did not return a project row')
  }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

// Import AFTER mocks
import ProjectPage from '../page'

function makeReferenceRow(i: number): ReferenceAssetRow {
  return {
    url: `https://example.com/inherited-ref-${i}.png`,
    sha256: `sha-${i}`,
    uploaded_at: '2026-05-10T00:00:00Z',
    mime_type: 'image/png',
    size_bytes: 1024 + i,
    original_filename: `inherited-ref-${i}.png`,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockReset()
  mockProjectsSingle.mockReset()
  mockPublishedMaybeSingle.mockReset()
  mockGetUserTier.mockReset()
})

describe('Phase 78 Plan 02 Task 4: REMIX-04 verification — forked project shows inherited references', () => {
  it('Test 1: forked project (with inherited reference_assets) renders <ReferenceThumbnailsStrip>', async () => {
    // Inherited shape from Plan 78-01 fork RPC: published row's
    // reference_assets has been copied into the new projects row.
    const inheritedRefs = [makeReferenceRow(1), makeReferenceRow(2), makeReferenceRow(3)]

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'forker-user-id' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: {
        id: 'forked-project-id',
        user_id: 'forker-user-id', // forker now owns the new row
        title: 'Forked: Urban Gardening',
        description: null,
        slide_data: [
          {
            // minimal slide so hasSlides === true (renders editor branch)
            hook_text: 'Hook',
            body_text: 'Body',
            background_url: null,
            pexels_photo_id: null,
            image_query: '',
            is_cta: false,
          },
        ],
        template_id: 'highlight-bar',
        topic: 'urban gardening',
        generation_status: 'complete',
        created_at: '2026-05-10T00:00:00Z',
        updated_at: '2026-05-10T00:00:00Z',
        reference_assets: inheritedRefs,
        style_spec: null,
      },
      error: null,
    })
    mockPublishedMaybeSingle.mockResolvedValueOnce({ data: null })
    mockGetUserTier.mockResolvedValueOnce('free')

    // RSC: ProjectPage is an async component returning JSX.
    const ui = await ProjectPage({
      params: Promise.resolve({ id: 'forked-project-id' }),
    })
    const { getByTestId, getAllByAltText } = render(ui)

    // The strip rendered with the 3 inherited references.
    expect(getByTestId('reference-thumbnails-strip')).toBeInTheDocument()
    const imgs = getAllByAltText(/inspired by reference/i)
    expect(imgs).toHaveLength(3)
    expect(imgs[0].getAttribute('src')).toBe('https://example.com/inherited-ref-1.png')
    expect(imgs[2].getAttribute('src')).toBe('https://example.com/inherited-ref-3.png')

    // Sanity: the editor branch was taken (proves slide_data path).
    expect(getByTestId('slide-editor-stub')).toBeInTheDocument()

    // The "Regenerate from references" CTA — REMIX-05's UX entry — is
    // mounted on the same surface (Task 3 wire). Co-tested here since
    // both REMIX-04 and REMIX-05 surfaces ride the same conditional gate.
    expect(getByTestId('regenerate-from-references-button')).toBeInTheDocument()
  })

  it('Test 2: legacy project (reference_assets=null) does NOT render the strip — back-compat invariant', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: {
        id: 'legacy-project-id',
        user_id: 'u1',
        title: 'Legacy Project',
        description: null,
        slide_data: [
          {
            hook_text: 'Hook',
            body_text: 'Body',
            background_url: null,
            pexels_photo_id: null,
            image_query: '',
            is_cta: false,
          },
        ],
        template_id: 'highlight-bar',
        topic: 't',
        generation_status: 'complete',
        created_at: '2026-05-10T00:00:00Z',
        updated_at: '2026-05-10T00:00:00Z',
        reference_assets: null, // legacy — every pre-v2.13 project
        style_spec: null,
      },
      error: null,
    })
    mockPublishedMaybeSingle.mockResolvedValueOnce({ data: null })
    mockGetUserTier.mockResolvedValueOnce('free')

    const ui = await ProjectPage({
      params: Promise.resolve({ id: 'legacy-project-id' }),
    })
    const { queryByTestId, getByTestId } = render(ui)

    expect(queryByTestId('reference-thumbnails-strip')).not.toBeInTheDocument()
    expect(queryByTestId('regenerate-from-references-button')).not.toBeInTheDocument()
    // Editor still mounts — back-compat invariant: legacy projects render
    // exactly as they did pre-Phase-77.
    expect(getByTestId('slide-editor-stub')).toBeInTheDocument()
  })
})
