// Phase 76 Plan 01 (PREVIEW-01, PREVIEW-09):
// Composition tests for the shell that wires the uploader, the sticky
// reference strip, the spec-preview panel, and the state machine to
// extractStyleSpecAction.
//
// Tests 5 + 9 are SOURCE-GREP gates — they read the shell file as text
// and assert structural invariants that protect against future refactor
// drift (PREVIEW-01 invariant + LEGAL-03 forward-compat copy gate).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'
import type { ExtractResult } from '@/lib/ai/extract-style-spec.types'
import type { StyleSpec } from '@/lib/types/style-spec'

// ---- Hoisted mocks ----
const { mockExtractStyleSpecAction } = vi.hoisted(() => ({
  mockExtractStyleSpecAction: vi.fn(),
}))

vi.mock('@/app/(dashboard)/style-from-reference/actions', () => ({
  extractStyleSpecAction: mockExtractStyleSpecAction,
  regenerateAction: vi.fn(),
}))

// Stub the existing ReferenceImageUploader to a minimal harness exposing the
// two callbacks Phase 74 contractually provides. Avoids re-testing Phase 74
// internals here.
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
          type="button"
          data-testid="stub-upload-btn"
          onClick={() => props.onUploadComplete?.(row('a.png'))}
        >
          stub upload
        </button>
        <button
          type="button"
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
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#A8E0B0' },
    typography: { hookFontCategory: 'sans-serif' },
    layout: { hookPosition: 'top', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'Bold magazine voice',
  }
}

function successResult(): ExtractResult {
  return {
    ok: true,
    spec: makeSpec(),
    cached: false,
    telemetry: { vision_calls_count: 1, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1234 },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExtractStyleSpecAction.mockReset()
})

describe('Phase 76 Plan 01: StyleFromReferenceShell — composition + invariants', () => {
  it('Test 1: renders the uploader on initial mount; no SpecPreviewPanel until preview state', () => {
    render(
      <StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />,
    )
    expect(screen.getByTestId('uploader-stub')).toBeTruthy()
    expect(screen.queryByTestId('spec-preview-panel')).toBeNull()
  })

  it('Test 2: Extract click invokes extractStyleSpecAction with { projectId, references }', async () => {
    let resolve!: (r: ExtractResult) => void
    mockExtractStyleSpecAction.mockReturnValueOnce(
      new Promise<ExtractResult>((res) => { resolve = res }),
    )
    render(
      <StyleFromReferenceShell projectId="proj-42" brandKit={null} brandKitAvailable={false} />,
    )
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(mockExtractStyleSpecAction).toHaveBeenCalledTimes(1)
    })
    const arg = mockExtractStyleSpecAction.mock.calls[0][0] as {
      projectId: string
      references: ReferenceAssetRow[]
    }
    expect(arg.projectId).toBe('proj-42')
    expect(arg.references).toHaveLength(2)
    expect(arg.references[0].url).toBe('user_x/a.png')
    // Resolve to avoid dangling promise warning in jsdom teardown
    await act(async () => { resolve(successResult()) })
  })

  it('Test 3: while action is in flight, an explicit "extracting" state is rendered', async () => {
    let resolve!: (r: ExtractResult) => void
    mockExtractStyleSpecAction.mockReturnValueOnce(
      new Promise<ExtractResult>((res) => { resolve = res }),
    )
    render(
      <StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />,
    )
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('extracting-state')).toBeTruthy()
    })
    const node = screen.getByTestId('extracting-state')
    expect(node.textContent).toMatch(/Analyzing your references/i)
    expect(node.getAttribute('role')).toBe('status')
    // Uploader is no longer rendered while extracting
    expect(screen.queryByTestId('uploader-stub')).toBeNull()
    await act(async () => { resolve(successResult()) })
  })

  it('Test 4: on ok:true the SpecPreviewPanel slot becomes visible with the spec', async () => {
    mockExtractStyleSpecAction.mockResolvedValueOnce(successResult())
    render(
      <StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />,
    )
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('spec-preview-panel')).toBeTruthy()
    })
    // Skeleton slots Plan 76-02 fills
    expect(screen.getByTestId('palette-slot')).toBeTruthy()
    expect(screen.getByTestId('typography-slot')).toBeTruthy()
    expect(screen.getByTestId('layout-slot')).toBeTruthy()
    expect(screen.getByTestId('voice-note-slot')).toBeTruthy()
    expect(screen.getByTestId('aspects-slot')).toBeTruthy()
    expect(screen.getByTestId('credit-cost-slot')).toBeTruthy()
    expect(screen.getByTestId('generate-cta')).toBeTruthy()
    expect(screen.getByTestId('re-extract-cta')).toBeTruthy()
  })

  it('Test 5: PREVIEW-01 INVARIANT — Generate CTA only appears inside the preview-gated subtree', () => {
    const filePath = path.resolve(__dirname, '../style-from-reference-shell.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')

    // (a) The shell renders SpecPreviewPanel ONLY behind a status==='preview' guard.
    //     Match either single or double quotes.
    const previewGuardRe = /state\.status\s*===\s*['"]preview['"]/
    expect(previewGuardRe.test(src)).toBe(true)

    // (b) The shell file itself must NOT contain a generate-cta testid OUTSIDE
    //     the SpecPreviewPanel — the CTA lives in SpecPreviewPanel which is
    //     gated by the status check. Easiest enforcement: zero generate-cta
    //     occurrences in the shell file at all.
    const generateCtaHits = (src.match(/data-testid=["']generate-cta["']/g) ?? []).length
    expect(generateCtaHits).toBe(0)
  })

  it('Test 6: sticky strip renders both thumbnails OUTSIDE the conditional spec-preview block', async () => {
    mockExtractStyleSpecAction.mockResolvedValueOnce(successResult())
    render(
      <StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />,
    )
    // Uploads two refs via the stub (one upload click) + a second
    fireEvent.click(screen.getByTestId('stub-upload-btn'))
    fireEvent.click(screen.getByTestId('stub-upload-btn'))
    const strip = screen.getByTestId('sticky-reference-strip')
    expect(strip).toBeTruthy()
    // Tailwind sticky class present (Phase 79 gate doesn't care about this token)
    expect(strip.className).toMatch(/sticky/)
    // After extract success, strip is STILL rendered
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('spec-preview-panel')).toBeTruthy()
    })
    expect(screen.getByTestId('sticky-reference-strip')).toBeTruthy()
  })

  it('Test 7: on safety_blocked, SafetyBlockRecovery renders and SpecPreviewPanel does NOT', async () => {
    // Plan 76-03 replaced the placeholder ErrorMount with ErrorRouter, which
    // for kind=safety_blocked routes to <SafetyBlockRecovery /> (PREVIEW-12
    // full-panel surface). PREVIEW-12 spec: the recovery panel REPLACES the
    // spec-preview, not a sibling banner. Recovery-integration Test 11 asserts
    // the same invariant from the integration angle; this test owns the
    // shell-composition angle.
    mockExtractStyleSpecAction.mockResolvedValueOnce({
      ok: false,
      error: 'safety_blocked',
      detail: { x: 1 },
      reason: 'IMAGE_SAFETY',
      recovery_suggestion: 'try cropping',
      telemetry: { vision_calls_count: 1, tokens_in: 0, tokens_out: 0, cache_hit: false, duration_ms: 1 },
    })
    render(
      <StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />,
    )
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('safety-block-recovery')).toBeTruthy()
    })
    expect(screen.queryByTestId('spec-preview-panel')).toBeNull()
    // Old placeholder is gone — ErrorRouter routes to a specific surface.
    expect(screen.queryByTestId('error-mount')).toBeNull()
    // Recovery surface surfaces the Phase 75 recovery_suggestion verbatim
    expect(screen.getByTestId('recovery-suggestion-text').textContent).toContain(
      'try cropping',
    )
  })

  it('Test 8: brandKitAvailable prop flows into reducer state', async () => {
    mockExtractStyleSpecAction.mockResolvedValueOnce(successResult())
    const { unmount } = render(
      <StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={true} />,
    )
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('spec-preview-panel')).toBeTruthy()
    })
    // brand-kit-slot is present whether or not the toggle is on; Plan 76-02
    // will conditionally render the toggle inside the slot. We assert the
    // slot exists; reducer integration is exercised via prop pass-through.
    expect(screen.getByTestId('brand-kit-slot')).toBeTruthy()
    unmount()

    // Now mount with brandKitAvailable=false and assert the slot ALSO renders
    // (visibility toggle is Plan 76-02's concern; our shell hands the prop
    // through). The relevant assertion is that no runtime error occurs.
    mockExtractStyleSpecAction.mockResolvedValueOnce(successResult())
    render(
      <StyleFromReferenceShell projectId="p" brandKit={null} brandKitAvailable={false} />,
    )
    fireEvent.click(screen.getByTestId('stub-extract-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('spec-preview-panel')).toBeTruthy()
    })
    expect(screen.getByTestId('brand-kit-slot')).toBeTruthy()
  })

  it('Test 9: LEGAL-03 forward-compat copy gate — zero forbidden tokens in shell-owned files', () => {
    const files = [
      path.resolve(__dirname, '../style-from-reference-shell.tsx'),
      path.resolve(__dirname, '../sticky-reference-strip.tsx'),
      path.resolve(__dirname, '../spec-preview-panel.tsx'),
    ]
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const filePath of files) {
      const src = fs.readFileSync(filePath, 'utf-8')
      for (const re of forbidden) {
        const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
        expect(hits, `forbidden token ${re} in ${path.basename(filePath)}`).toBe(0)
      }
    }
  })
})
