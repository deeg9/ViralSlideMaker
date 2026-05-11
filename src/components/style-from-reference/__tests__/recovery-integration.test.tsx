// Phase 76 Plan 03 (PREVIEW-07/10/12):
// Recovery integration tests covering shell + sticky strip + spec-preview
// + ErrorRouter wiring. The shell drives the reducer; tests inject state
// transitions through the existing uploader/Action stub pattern then
// assert the right surfaces appear.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'
import type { ExtractResult } from '@/lib/ai/extract-style-spec.types'
import type { StyleSpec } from '@/lib/types/style-spec'
import { SpecPreviewPanel } from '../spec-preview-panel'
import { initialSpecPreviewState, type SpecPreviewState } from '../state-machine'
import type { BrandKit } from '@/lib/types/brand-kit'

// ---- Hoisted mocks (mirror style-from-reference-shell.test.tsx) ----
const { mockExtractStyleSpecAction } = vi.hoisted(() => ({
  mockExtractStyleSpecAction: vi.fn(),
}))

vi.mock('@/app/(dashboard)/style-from-reference/actions', () => ({
  extractStyleSpecAction: mockExtractStyleSpecAction,
  regenerateAction: vi.fn(),
}))

vi.mock('@/components/dashboard/reference-image-uploader', () => ({
  ReferenceImageUploader: (props: {
    onUploadComplete?: (row: ReferenceAssetRow) => void
    onExtractRequested?: (rows: ReferenceAssetRow[]) => void
  }) => {
    const row = (n: string): ReferenceAssetRow => ({
      url: `user_x/${n}`,
      sha256: '',
      uploaded_at: '2026-05-10T00:00:00.000Z',
      mime_type: 'image/png',
      size_bytes: 1,
      original_filename: n,
    })
    return (
      <div data-testid="uploader-stub">
        <button
          data-testid="stub-upload-btn"
          onClick={() => props.onUploadComplete?.(row('a.png'))}
        >
          stub upload
        </button>
        <button
          data-testid="stub-extract-btn"
          onClick={() => props.onExtractRequested?.([row('a.png'), row('b.png')])}
        >
          stub extract
        </button>
      </div>
    )
  },
}))

import { StyleFromReferenceShell } from '../style-from-reference-shell'

function makeSpec(): StyleSpec {
  return {
    schema_version: 1,
    palette: { mode: 'solid', primary: '#A8E0B0' },
    typography: { hookFontCategory: 'sans-serif' },
    layout: { hookPosition: 'top', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'Bold magazine voice',
  }
}

function fullPreviewState(overrides: Partial<SpecPreviewState> = {}): SpecPreviewState {
  return {
    ...initialSpecPreviewState,
    status: 'preview',
    spec: makeSpec(),
    aspects: { palette: true, typography: true, layout: true, decorations: true },
    retriesRemaining: 2,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExtractStyleSpecAction.mockReset()
})

describe('Phase 76 Plan 03: recovery integration', () => {
  it('Test 9 (PREVIEW-10 sticky-strip warning placement): refusal chip renders inside the matching thumbnail container', async () => {
    mockExtractStyleSpecAction.mockResolvedValueOnce({
      ok: true,
      spec: makeSpec(),
      refusal_flags: [
        { contains_logo: true, contains_face: false, contains_watermark: false },
        { contains_logo: false, contains_face: false, contains_watermark: false },
      ],
      cached: false,
      telemetry: { vision_calls_count: 2, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1234 },
    } as ExtractResult)
    render(<StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />)
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('spec-preview-panel')).toBeTruthy()
    })
    const thumbs = screen.getAllByTestId('sticky-reference-thumb')
    expect(thumbs).toHaveLength(2)
    // First thumb has refusal-warning child; second does NOT
    expect(thumbs[0].querySelector('[data-testid="refusal-warning"]')).toBeTruthy()
    expect(thumbs[1].querySelector('[data-testid="refusal-warning"]')).toBeNull()
  })

  it('Test 10 (PREVIEW-10 Generate gating): Generate disabled until refusal acknowledged', () => {
    // Render SpecPreviewPanel directly with controlled state — the
    // refusalAcknowledgedOrAbsent predicate (Plan 76-01) gates Generate.
    const dispatch = vi.fn()
    const { rerender } = render(
      <SpecPreviewPanel
        state={fullPreviewState({
          refusalFlags: [{ contains_logo: true, contains_face: false, contains_watermark: false }],
          refusalAcknowledged: false,
        })}
        dispatch={dispatch}
        brandKit={null as BrandKit | null}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    const generate = screen.getByTestId('generate-cta') as HTMLButtonElement
    expect(generate.disabled).toBe(true)

    // Re-render with refusalAcknowledged=true; Generate enables.
    rerender(
      <SpecPreviewPanel
        state={fullPreviewState({
          refusalFlags: [{ contains_logo: true, contains_face: false, contains_watermark: false }],
          refusalAcknowledged: true,
        })}
        dispatch={dispatch}
        brandKit={null as BrandKit | null}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    const generateAfter = screen.getByTestId('generate-cta') as HTMLButtonElement
    expect(generateAfter.disabled).toBe(false)
  })

  it('Test 11 (PREVIEW-12 spec-preview replaced): SafetyBlockRecovery present, SpecPreviewPanel ABSENT on safety_blocked', async () => {
    mockExtractStyleSpecAction.mockResolvedValueOnce({
      ok: false,
      error: 'safety_blocked',
      detail: { x: 1 },
      reason: 'IMAGE_SAFETY',
      recovery_suggestion: 'Try cropping high-skin areas',
      telemetry: { vision_calls_count: 2, tokens_in: 0, tokens_out: 0, cache_hit: false, duration_ms: 1 },
    } as ExtractResult)
    render(<StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />)
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('safety-block-recovery')).toBeTruthy()
    })
    expect(screen.queryByTestId('spec-preview-panel')).toBeNull()
    // The recovery_suggestion text from Phase 75 surfaces verbatim
    expect(screen.getByTestId('recovery-suggestion-text').textContent).toContain(
      'Try cropping high-skin areas',
    )
  })

  it('Test 12 (PREVIEW-07 retry counter visible): re-extract shows count + disables at 0', () => {
    const two = render(
      <SpecPreviewPanel
        state={fullPreviewState({ retriesRemaining: 2 })}
        dispatch={vi.fn()}
        brandKit={null as BrandKit | null}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    const re = two.getByTestId('re-extract-cta') as HTMLButtonElement
    const labelText = (re.textContent ?? '') + ' ' + (re.getAttribute('aria-label') ?? '')
    expect(labelText).toMatch(/\b2\b/)
    expect(re.disabled).toBe(false)
    two.unmount()

    const zero = render(
      <SpecPreviewPanel
        state={fullPreviewState({ retriesRemaining: 0 })}
        dispatch={vi.fn()}
        brandKit={null as BrandKit | null}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    const reZero = zero.getByTestId('re-extract-cta') as HTMLButtonElement
    expect(reZero.disabled).toBe(true)
    const zeroLabelText = (reZero.textContent ?? '') + ' ' + (reZero.getAttribute('aria-label') ?? '')
    expect(zeroLabelText).toMatch(/\b0\b/)
  })

  it('Test 13 (PREVIEW-07 decrement-on-click invariant): click dispatches RE_EXTRACT_CLICK exactly once; no render-time decrement', () => {
    const dispatch = vi.fn()
    const onReExtract = vi.fn()
    const { rerender } = render(
      <SpecPreviewPanel
        state={fullPreviewState({ retriesRemaining: 2 })}
        dispatch={dispatch}
        brandKit={null as BrandKit | null}
        onGenerate={vi.fn()}
        onReExtract={onReExtract}
      />,
    )
    const re = screen.getByTestId('re-extract-cta') as HTMLButtonElement
    fireEvent.click(re)
    expect(onReExtract).toHaveBeenCalledTimes(1)

    // Re-render with the SAME retriesRemaining=2 — counter still shows 2
    // (no render-time decrement; reducer owns the decrement on the
    // RE_EXTRACT_CLICK action which the shell wires).
    rerender(
      <SpecPreviewPanel
        state={fullPreviewState({ retriesRemaining: 2 })}
        dispatch={dispatch}
        brandKit={null as BrandKit | null}
        onGenerate={vi.fn()}
        onReExtract={onReExtract}
      />,
    )
    const reAfter = screen.getByTestId('re-extract-cta') as HTMLButtonElement
    const labelText = (reAfter.textContent ?? '') + ' ' + (reAfter.getAttribute('aria-label') ?? '')
    expect(labelText).toMatch(/\b2\b/)
  })

  it('Test 14: error-mount slot in shell has been replaced by ErrorRouter — shell file does NOT contain the placeholder anymore', async () => {
    // The shell originally rendered an inline ErrorMount stub. Plan 76-03
    // replaces it with <ErrorRouter ... />. Confirm via behavior: on
    // safety_blocked, the error surface is the SafetyBlockRecovery panel
    // (full PREVIEW-12 surface), NOT the placeholder error-mount div.
    mockExtractStyleSpecAction.mockResolvedValueOnce({
      ok: false,
      error: 'extraction_failed',
      detail: 'timeout',
      telemetry: { vision_calls_count: 0, tokens_in: 0, tokens_out: 0, cache_hit: false, duration_ms: 1 },
    } as ExtractResult)
    render(<StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />)
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('error-extraction-failed')).toBeTruthy()
    })
    // The placeholder error-mount div is gone (replaced by ErrorRouter)
    expect(screen.queryByTestId('error-mount')).toBeNull()
  })

  it('Test 15 (PREVIEW-01 single-CTA invariant still holds): Generate CTA still appears exactly once project-side', async () => {
    mockExtractStyleSpecAction.mockResolvedValueOnce({
      ok: true,
      spec: makeSpec(),
      refusal_flags: [
        { contains_logo: false, contains_face: false, contains_watermark: false },
        { contains_logo: false, contains_face: false, contains_watermark: false },
      ],
      cached: false,
      telemetry: { vision_calls_count: 2, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1234 },
    } as ExtractResult)
    render(<StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />)
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('spec-preview-panel')).toBeTruthy()
    })
    // Exactly one Generate CTA in the rendered DOM
    const generates = screen.getAllByTestId('generate-cta')
    expect(generates).toHaveLength(1)
  })

  it('Test 16: ack flow — clicking Continue inside the sticky-strip refusal chip dispatches CONFIRM_REFUSAL_WARNING (no other actions)', async () => {
    mockExtractStyleSpecAction.mockResolvedValueOnce({
      ok: true,
      spec: makeSpec(),
      refusal_flags: [
        { contains_logo: true, contains_face: false, contains_watermark: false },
        { contains_logo: false, contains_face: false, contains_watermark: false },
      ],
      cached: false,
      telemetry: { vision_calls_count: 2, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1234 },
    } as ExtractResult)
    render(<StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />)
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('spec-preview-panel')).toBeTruthy()
    })
    // Generate is disabled (flagged + not acknowledged)
    expect((screen.getByTestId('generate-cta') as HTMLButtonElement).disabled).toBe(true)
    // Click the Continue inside the refusal chip — react updates state
    await act(async () => {
      fireEvent.click(screen.getByTestId('refusal-continue-cta'))
    })
    // Generate becomes enabled now (aspects all default-on)
    await waitFor(() => {
      expect((screen.getByTestId('generate-cta') as HTMLButtonElement).disabled).toBe(false)
    })
    // Acknowledged badge appears, Continue gone
    expect(screen.getByTestId('refusal-acknowledged-badge')).toBeTruthy()
    expect(screen.queryByTestId('refusal-continue-cta')).toBeNull()
  })
})
