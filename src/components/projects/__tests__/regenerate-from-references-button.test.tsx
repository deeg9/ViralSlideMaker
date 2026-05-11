// Phase 78 Plan 02 Task 2 (REMIX-05):
// Tests for <RegenerateFromReferencesButton>. Asserts:
//   - Renders ONLY when project.reference_assets is non-null AND non-empty
//   - Click opens confirmation modal with LEGAL-03-compliant copy:
//     "Generate a new project inspired by these references"
//   - Visible "Generating will use 1 credit" cost indicator
//   - Confirm dispatches regenerateFromReferencesAction({sourceProjectId})
//   - Loading state during action
//   - Success → router.push('/project/{newProjectId}')
//   - Error → inline banner / toast surfaced to user
//   - LEGAL-03 grep on rendered output: zero forbidden tokens

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ---- Hoisted mocks ----
const { mockAction, mockPush } = vi.hoisted(() => ({
  mockAction: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('@/app/(dashboard)/style-from-reference/actions', () => ({
  regenerateFromReferencesAction: mockAction,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}))

import { RegenerateFromReferencesButton } from '../regenerate-from-references-button'
import type { Project } from '@/lib/types/project'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

// LEGAL-03 forbidden tokens (mirror reference-thumbnails-strip Test 8). Zero
// matches required across the rendered output of trigger + open modal.
const LEGAL_03_FORBIDDEN = [
  'exactly like',
  'exactly the same',
  'copied from',
  'cloned from',
  'clone of',
  'duplicate of',
  'copy of',
  'duplicate ',
] as const

function makeReferenceRow(i = 1): ReferenceAssetRow {
  return {
    url: `https://example.com/ref-${i}.png`,
    sha256: `sha-${i}`,
    uploaded_at: '2026-05-10T00:00:00Z',
    mime_type: 'image/png',
    size_bytes: 1024,
    original_filename: `ref-${i}.png`,
  }
}

function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: 'project-1',
    user_id: 'user-1',
    title: 'My Slideshow',
    description: null,
    slide_data: [],
    template_id: 'highlight-bar',
    topic: 'urban gardening',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    reference_assets: [makeReferenceRow(1), makeReferenceRow(2)],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAction.mockReset()
  mockPush.mockReset()
})

describe('<RegenerateFromReferencesButton> (REMIX-05)', () => {
  it('Test 1: renders nothing when reference_assets is null', () => {
    const { container } = render(
      <RegenerateFromReferencesButton project={makeProject({ reference_assets: null })} />,
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('regenerate-from-references-button')).not.toBeInTheDocument()
  })

  it('Test 2: renders nothing when reference_assets is empty []', () => {
    const { container } = render(
      <RegenerateFromReferencesButton project={makeProject({ reference_assets: [] })} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('Test 3: renders nothing when reference_assets is undefined', () => {
    const { container } = render(
      <RegenerateFromReferencesButton project={makeProject({ reference_assets: undefined })} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('Test 4: renders the trigger button when reference_assets has 1+ entries', () => {
    render(<RegenerateFromReferencesButton project={makeProject()} />)
    expect(screen.getByTestId('regenerate-from-references-button')).toBeInTheDocument()
  })

  it('Test 5: clicking the trigger opens the confirmation modal with LEGAL-03 copy', () => {
    render(<RegenerateFromReferencesButton project={makeProject()} />)
    fireEvent.click(screen.getByTestId('regenerate-from-references-button'))
    // The "Inspired by" copy must be visible in the modal.
    const modal = screen.getByTestId('regenerate-from-references-modal')
    expect(modal.textContent?.toLowerCase()).toMatch(/inspired by/)
    // The exact spec copy: "Generate a new project inspired by these references"
    expect(modal.textContent?.toLowerCase()).toContain('generate a new project')
  })

  it('Test 6: confirmation modal shows "Generating will use 1 credit" cost indicator', () => {
    render(<RegenerateFromReferencesButton project={makeProject()} />)
    fireEvent.click(screen.getByTestId('regenerate-from-references-button'))
    const modal = screen.getByTestId('regenerate-from-references-modal')
    expect(modal.textContent?.toLowerCase()).toContain('1 credit')
  })

  it('Test 7: confirm dispatches regenerateFromReferencesAction({sourceProjectId})', async () => {
    mockAction.mockResolvedValueOnce({ ok: true, projectId: 'new-proj-1' })
    render(<RegenerateFromReferencesButton project={makeProject({ id: 'src-1' })} />)
    fireEvent.click(screen.getByTestId('regenerate-from-references-button'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-from-references-confirm'))
    })
    expect(mockAction).toHaveBeenCalledTimes(1)
    expect(mockAction).toHaveBeenCalledWith({ sourceProjectId: 'src-1' })
  })

  it('Test 8: success → router.push("/project/{newProjectId}")', async () => {
    mockAction.mockResolvedValueOnce({ ok: true, projectId: 'new-proj-2' })
    render(<RegenerateFromReferencesButton project={makeProject()} />)
    fireEvent.click(screen.getByTestId('regenerate-from-references-button'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-from-references-confirm'))
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/project/new-proj-2')
    })
  })

  it('Test 9: loading state — confirm button disabled + label changes during pending action', async () => {
    let resolveAction!: (v: { ok: true; projectId: string }) => void
    const pending = new Promise<{ ok: true; projectId: string }>((r) => {
      resolveAction = r
    })
    mockAction.mockReturnValueOnce(pending)

    render(<RegenerateFromReferencesButton project={makeProject()} />)
    fireEvent.click(screen.getByTestId('regenerate-from-references-button'))
    fireEvent.click(screen.getByTestId('regenerate-from-references-confirm'))

    // Mid-flight: confirm button is disabled and shows loading text
    await waitFor(() => {
      const confirmBtn = screen.getByTestId('regenerate-from-references-confirm') as HTMLButtonElement
      expect(confirmBtn.disabled).toBe(true)
    })

    await act(async () => {
      resolveAction({ ok: true, projectId: 'proj-x' })
    })
  })

  it('Test 10: error → renders inline error banner; does NOT navigate', async () => {
    mockAction.mockResolvedValueOnce({
      ok: false,
      error: 'extract_failed',
      detail: 'gemini_5xx',
    })
    render(<RegenerateFromReferencesButton project={makeProject()} />)
    fireEvent.click(screen.getByTestId('regenerate-from-references-button'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-from-references-confirm'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('regenerate-from-references-error')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('Test 11: rendered output contains ZERO LEGAL-03 forbidden tokens (open modal)', () => {
    const { container } = render(<RegenerateFromReferencesButton project={makeProject()} />)
    fireEvent.click(screen.getByTestId('regenerate-from-references-button'))
    // body innerHTML may differ from container if modal portals — grep both.
    const html = (container.innerHTML + document.body.innerHTML).toLowerCase()
    for (const token of LEGAL_03_FORBIDDEN) {
      expect(html, `forbidden LEGAL-03 token found: "${token}"`).not.toContain(token)
    }
  })

  it('Test 12: source file uses LEGAL-03 framing — no forbidden tokens', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../regenerate-from-references-button.tsx'),
      'utf8',
    )
    const lowered = src.toLowerCase()
    for (const token of LEGAL_03_FORBIDDEN) {
      expect(lowered, `forbidden LEGAL-03 token in source: "${token}"`).not.toContain(token)
    }
    // Positive: must say "Inspired by" somewhere
    expect(lowered).toContain('inspired by')
  })
})
