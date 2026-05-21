// Phase 76 Plan 02 (PREVIEW-01..06 + 08 + 11):
// Integration tests for SpecPreviewPanel after Plan 76-02 fills the slots.
//
// Integration tests — the PREVIEW slots render in one composed panel;
// conditionals (voice_note absence) behave; Generate CTA disable rule still
// holds; re-extract counter visible; PREVIEW-01 single-CTA invariant +
// LEGAL-03 forward-compat grep gates continue to hold against this file's
// edits. Phase 89 (BKSHELVE-06): the removed feature's remix toggle and its
// visibility test (former Test 2) are gone.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { SpecPreviewPanel } from '../spec-preview-panel'
import { initialSpecPreviewState, type SpecPreviewState } from '../state-machine'
import type { StyleSpec } from '@/lib/types/style-spec'

function makeSpec(overrides: Partial<StyleSpec> = {}): StyleSpec {
  // Cast: Partial<StyleSpec> over a discriminated union (StyleSpec is intersected
  // with ArchetypeSlots in Phase 80) cannot be spread back into the union without
  // collapsing the discriminator. Spec contract is concrete here:
  // slideArchetype='full-bleed-text-overlay' (EmptySlots variant).
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'gradient', primary: '#FF3366', secondary: '#3366FF', accent: '#33FF66' },
    typography: { hookFontCategory: 'display', bodyFontCategory: 'sans-serif' },
    layout: { hookPosition: 'top', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { density: 'moderate' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'Bold magazine voice',
    ...overrides,
  } as StyleSpec
}

function fullState(overrides: Partial<SpecPreviewState> = {}): SpecPreviewState {
  return {
    ...initialSpecPreviewState,
    status: 'preview',
    spec: makeSpec(),
    aspects: { palette: true, typography: true, layout: true, decorations: true },
    retriesRemaining: 2,
    ...overrides,
  }
}

describe('Phase 76 Plan 02: SpecPreviewPanel integration', () => {
  it('Test 1: with full state, every PREVIEW slot testid renders', () => {
    render(
      <SpecPreviewPanel
        state={fullState()}
        dispatch={vi.fn()}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    // PREVIEW-02..05
    expect(screen.getByTestId('palette-swatches')).toBeTruthy()
    expect(screen.getByTestId('font-badges-list')).toBeTruthy()
    expect(screen.getByTestId('layout-sketch-svg')).toBeTruthy()
    expect(screen.getByTestId('voice-note-caption')).toBeTruthy()
    // PREVIEW-06
    expect(screen.getByTestId('aspects-checkbox-group')).toBeTruthy()
    // PREVIEW-11
    expect(screen.getByTestId('credit-cost-display')).toBeTruthy()
    // PREVIEW-01 (76-01)
    expect(screen.getByTestId('generate-cta')).toBeTruthy()
    expect(screen.getByTestId('re-extract-cta')).toBeTruthy()
  })

  // Test 2 (former remix-toggle visibility test) deleted — Phase 89
  // (BKSHELVE-06): the removed feature's panel slot and toggle no longer
  // render.

  it('Test 3: voice-note-caption is ABSENT when spec.voice_note is undefined', () => {
    const { container } = render(
      <SpecPreviewPanel
        state={fullState({ spec: makeSpec({ voice_note: undefined }) })}
        dispatch={vi.fn()}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="voice-note-caption"]')).toBeNull()
    // Slot wrapper still present
    expect(screen.getByTestId('voice-note-slot')).toBeTruthy()
  })

  it('Test 4: Generate CTA disabled and aspect-empty-hint visible when zero aspects checked', () => {
    render(
      <SpecPreviewPanel
        state={fullState({
          aspects: { palette: false, typography: false, layout: false, decorations: false },
        })}
        dispatch={vi.fn()}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    const generate = screen.getByTestId('generate-cta') as HTMLButtonElement
    expect(generate.disabled).toBe(true)
    expect(screen.getByTestId('aspect-empty-hint')).toBeTruthy()
  })

  it('Test 5: Re-extract CTA shows the retries-remaining count and disables at 0', () => {
    const two = render(
      <SpecPreviewPanel
        state={fullState({ retriesRemaining: 2 })}
        dispatch={vi.fn()}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    const reExtract = two.getByTestId('re-extract-cta') as HTMLButtonElement
    // The count appears either in the visible label or the aria-label.
    const labelText = (reExtract.textContent ?? '') + ' ' + (reExtract.getAttribute('aria-label') ?? '')
    expect(labelText).toMatch(/\b2\b/)
    expect(reExtract.disabled).toBe(false)
    two.unmount()

    const zero = render(
      <SpecPreviewPanel
        state={fullState({ retriesRemaining: 0 })}
        dispatch={vi.fn()}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
      />,
    )
    const reExtractZero = zero.getByTestId('re-extract-cta') as HTMLButtonElement
    expect(reExtractZero.disabled).toBe(true)
    const zeroLabelText =
      (reExtractZero.textContent ?? '') + ' ' + (reExtractZero.getAttribute('aria-label') ?? '')
    expect(zeroLabelText).toMatch(/\b0\b/)
  })

  it('Test 6: PREVIEW-01 invariant — exactly ONE generate-cta testid in spec-preview-panel.tsx', () => {
    const filePath = path.resolve(__dirname, '../spec-preview-panel.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')
    const matches = src.match(/data-testid=["']generate-cta["']/g) ?? []
    expect(matches).toHaveLength(1)
  })

  it('Test 7: LEGAL-03 forward-compat — zero forbidden tokens in spec-preview-panel.tsx', () => {
    const filePath = path.resolve(__dirname, '../spec-preview-panel.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in spec-preview-panel.tsx`).toBe(0)
    }
  })

  it('Test 8 (quick-260515-dwu): hideGenerateCta helper text points to the prompt above, not a phantom button below', () => {
    // The inline-collapsible mode in GenerationForm hides the panel's own
    // Generate button — the outer prompt-arrow IS the entry point. The
    // pre-fix copy ("Use Generate Carousel below to render.") told users
    // to look for a button that doesn't exist in that layout. Replaced
    // with copy that points at the actual entry point above.
    render(
      <SpecPreviewPanel
        state={fullState()}
        dispatch={vi.fn()}
        onGenerate={vi.fn()}
        onReExtract={vi.fn()}
        hideGenerateCta
      />,
    )
    expect(screen.queryByText(/Generate Carousel below/i)).toBeNull()
    expect(screen.getByText(/Send your prompt above to apply it/i)).toBeInTheDocument()
  })
})
