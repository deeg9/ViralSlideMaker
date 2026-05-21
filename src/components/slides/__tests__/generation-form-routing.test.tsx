// quick-260515-dwu: Routing regression tests for the prompt-arrow handler.
//
// The bug-report DB evidence showed Copy Style generations landing as
// topic-flow rows (style_spec NULL, template_id_override='magazine-bold').
// Even though GenerationForm.handleSubmit already branches on inlineSpec,
// the branch was firing on `spec != null` alone — these tests pin the
// hardened gate (spec + status==='preview' + non-empty references) and
// assert references[] flow all the way through to regenerateAction.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'
import type { StyleSpec } from '@/lib/types/style-spec'
import type {
  SpecPreviewState,
  SpecPreviewAspects,
} from '@/components/style-from-reference/state-machine'

// ---- Hoisted mocks ----
const {
  mockGenerateCarousel,
  mockRegenerateAction,
  mockCreateUploadUrl,
  mockRouterRefresh,
  mockRouterPush,
  shellFixture,
} = vi.hoisted(() => ({
  mockGenerateCarousel: vi.fn(),
  mockRegenerateAction: vi.fn(),
  mockCreateUploadUrl: vi.fn(),
  mockRouterRefresh: vi.fn(),
  mockRouterPush: vi.fn(),
  // Module-mutable: each test installs the SpecPreviewState the shell
  // should emit on mount. null means "don't emit" (initial null state).
  shellFixture: { current: null as SpecPreviewState | null },
}))

vi.mock('@/app/(dashboard)/project/[id]/actions', () => ({
  generateCarousel: mockGenerateCarousel,
}))

vi.mock('@/app/(dashboard)/style-from-reference/actions', () => ({
  regenerateAction: mockRegenerateAction,
}))

vi.mock('@/app/(dashboard)/project/[id]/editor-actions', () => ({
  createUploadUrl: mockCreateUploadUrl,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn(), refresh: mockRouterRefresh }),
}))

// Stub the shell — fires shellFixture.current onto onSpecChange once on mount.
// Keeps the test independent of Phase 76 internals (uploader, extraction,
// reducer). We don't need real spec extraction here — only that the form
// reads whatever state the shell hands it and routes accordingly.
vi.mock('@/components/style-from-reference/style-from-reference-shell', () => ({
  StyleFromReferenceShell: (props: {
    onSpecChange?: (state: SpecPreviewState) => void
  }) => {
    // Fire on mount (acts as the Phase 76 "extraction completed" emit).
    // useEffect-equivalent via a microtask so React state updates flush.
    if (shellFixture.current && props.onSpecChange) {
      const state = shellFixture.current
      queueMicrotask(() => props.onSpecChange!(state))
    }
    return <div data-testid="shell-stub" />
  },
}))

import { GenerationForm } from '../generation-form'

function makeSpec(): StyleSpec {
  // Cast: discriminated-union spec — concrete archetype variant.
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#A8E0B0' },
    typography: { hookFontCategory: 'sans-serif' },
    layout: { hookPosition: 'top', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'Bold magazine voice',
  } as StyleSpec
}

function makeRefRow(i = 1): ReferenceAssetRow {
  return {
    url: `user-1/ref-${i}.png`,
    sha256: `sha-${i}`,
    uploaded_at: '2026-05-15T00:00:00.000Z',
    mime_type: 'image/png',
    size_bytes: 1024,
    original_filename: `ref-${i}.png`,
  }
}

function makeAspects(): SpecPreviewAspects {
  return { palette: true, typography: true, layout: true, decorations: true }
}

function makePreviewState(overrides: Partial<SpecPreviewState> = {}): SpecPreviewState {
  return {
    status: 'preview',
    references: [makeRefRow(1), makeRefRow(2)],
    spec: makeSpec(),
    retriesRemaining: 2,
    aspects: makeAspects(),
    error: null,
    lastTelemetry: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateCarousel.mockReset()
  mockRegenerateAction.mockReset()
  mockCreateUploadUrl.mockReset()
  mockRouterRefresh.mockReset()
  mockRouterPush.mockReset()
  shellFixture.current = null
  // Default happy returns
  mockGenerateCarousel.mockResolvedValue({ success: true, slideCount: 7 })
  mockRegenerateAction.mockResolvedValue({ ok: true, projectId: 'p1', slideCount: 7 })
})

async function openCopyStyleCollapsibleAndWaitForSpec() {
  // The shell only mounts (and our stub only fires) once the collapsible
  // is opened. Click "Copy style" to expand.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Copy style/i }))
  })
  // Wait for the microtask-scheduled onSpecChange to flush into state.
  await waitFor(() => {
    expect(screen.getByTestId('shell-stub')).toBeTruthy()
  })
  // Let the microtask + React state update settle.
  await act(async () => {
    await Promise.resolve()
  })
}

describe('GenerationForm routing (quick-260515-dwu)', () => {
  it('Test 1: routes to regenerateAction when inlineSpec has spec + status preview + non-empty references', async () => {
    const state = makePreviewState()
    shellFixture.current = state

    render(<GenerationForm projectId="p1" hasSlides={false} />)
    await openCopyStyleCollapsibleAndWaitForSpec()

    // Type topic
    const textarea = screen.getByPlaceholderText(/5 tips for growing/i)
    fireEvent.change(textarea, { target: { value: 'test topic' } })

    // Click the prompt-arrow (Generate carousel)
    await act(async () => {
      // Disambiguate: aria-label="Generate carousel" is unique to the
      // prompt-arrow button (the lower "Generate Carousel" submit button
      // has no aria-label — its accessible name comes from text content,
      // so getByLabelText only matches the arrow).
      fireEvent.click(screen.getByLabelText('Generate carousel'))
    })

    await waitFor(() => {
      expect(mockRegenerateAction).toHaveBeenCalledTimes(1)
    })
    expect(mockGenerateCarousel).not.toHaveBeenCalled()
    const arg = mockRegenerateAction.mock.calls[0][0]
    expect(arg).toEqual(
      expect.objectContaining({
        projectId: 'p1',
        spec: state.spec,
        references: state.references,
        content: { mode: 'ai-copy', topic: 'test topic' },
      }),
    )
  })

  it('Test 2: routes to generateCarousel (topic flow) when inlineSpec is null', async () => {
    shellFixture.current = null // shell doesn't fire onSpecChange

    render(<GenerationForm projectId="p1" hasSlides={false} />)
    // Don't open the collapsible — shell never mounts, inlineSpec stays null.

    const textarea = screen.getByPlaceholderText(/5 tips for growing/i)
    fireEvent.change(textarea, { target: { value: 'plain topic' } })

    await act(async () => {
      // Disambiguate: aria-label="Generate carousel" is unique to the
      // prompt-arrow button (the lower "Generate Carousel" submit button
      // has no aria-label — its accessible name comes from text content,
      // so getByLabelText only matches the arrow).
      fireEvent.click(screen.getByLabelText('Generate carousel'))
    })

    await waitFor(() => {
      expect(mockGenerateCarousel).toHaveBeenCalledTimes(1)
    })
    expect(mockRegenerateAction).not.toHaveBeenCalled()
    // Action signature: (projectId, topic, templateId, imageSource, slideCount, advancedOptions)
    const call = mockGenerateCarousel.mock.calls[0]
    expect(call[0]).toBe('p1')
    expect(call[1]).toBe('plain topic')
  })

  it('Test 3: falls back to generateCarousel when spec is extracted but references array is empty', async () => {
    // Belt-and-braces: the reducer should never emit status='preview' with
    // zero references, but the bug-report DB evidence shows routing leaking
    // somewhere — gate on references.length > 0 too.
    shellFixture.current = makePreviewState({ references: [] })

    render(<GenerationForm projectId="p1" hasSlides={false} />)
    await openCopyStyleCollapsibleAndWaitForSpec()

    const textarea = screen.getByPlaceholderText(/5 tips for growing/i)
    fireEvent.change(textarea, { target: { value: 'topic-no-refs' } })

    await act(async () => {
      // Disambiguate: aria-label="Generate carousel" is unique to the
      // prompt-arrow button (the lower "Generate Carousel" submit button
      // has no aria-label — its accessible name comes from text content,
      // so getByLabelText only matches the arrow).
      fireEvent.click(screen.getByLabelText('Generate carousel'))
    })

    await waitFor(() => {
      expect(mockGenerateCarousel).toHaveBeenCalledTimes(1)
    })
    expect(mockRegenerateAction).not.toHaveBeenCalled()
  })
})
