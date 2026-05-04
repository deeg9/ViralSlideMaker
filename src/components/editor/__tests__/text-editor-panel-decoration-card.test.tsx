/**
 * Phase 70 Plan 04 (CARD-01): TextEditorPanel composition switch.
 *
 * When the active selection's primary id resolves to a decoration on the
 * slide, the panel renders <DecorationCard> instead of <ActiveTextBoxCard>.
 *
 * Branch precedence (3-way ternary):
 *   1. selection.ids.length >= 2 && onBulkDelete → MultiSelectTypeBar
 *   2. activeDecoration !== null → DecorationCard
 *   3. otherwise → ActiveTextBoxCard (legacy single-box flow)
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { TextEditorPanel } from '../text-editor-panel'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide, TextBox } from '@/lib/types/slide'
import type { Decoration } from '@/lib/types/decoration'
import type { Selection } from '@/lib/editor/use-selection-model'

const TMPL = getTemplate('editorial-serif')

const TB_HOOK: TextBox = {
  id: 'tb-hook',
  role: 'hook',
  text: 'Hello',
  font_size: 48,
  position: { anchor: 'custom', x: 10, y: 10, width: 80 },
}

const DECO_SHAPE: Decoration = {
  id: 'd-shape',
  kind: 'shape',
  shapeKind: 'rect',
  fill: '#FF0000',
  position: { x: 0, y: 0, width: 10, height: 10 },
}

function makeSlide(opts: { withDecoration?: boolean } = {}): Slide {
  return {
    hook_text: 'Hello',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: [TB_HOOK],
    ...(opts.withDecoration ? { decorations: [DECO_SHAPE] } : {}),
  }
}

function makeSelection(ids: string[]): Selection {
  return { ids, primary: ids.length > 0 ? ids[ids.length - 1] : null }
}

describe('Phase 70 Plan 04 — TextEditorPanel decoration composition (CARD-01)', () => {
  it('selection.primary maps to text_box → ActiveTextBoxCard renders', () => {
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide({ withDecoration: true })}
        template={TMPL}
        selectedTextBoxId={TB_HOOK.id}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        selection={makeSelection([TB_HOOK.id])}
      />,
    )
    expect(container.querySelector('[data-testid="active-text-box-card"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeNull()
  })

  it('selection.primary maps to a decoration → DecorationCard renders', () => {
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide({ withDecoration: true })}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        selection={makeSelection([DECO_SHAPE.id])}
      />,
    )
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="active-text-box-card"]')).toBeNull()
  })

  it('selection.primary is null → ActiveTextBoxCard (or empty) renders', () => {
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide()}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        selection={makeSelection([])}
      />,
    )
    // Either active-text-box-card or its empty variant.
    const hasActive = container.querySelector('[data-testid="active-text-box-card"]')
    const hasEmpty = container.querySelector('[data-testid="active-text-box-card-empty"]')
    expect(hasActive || hasEmpty).toBeTruthy()
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeNull()
  })

  it('selection.ids.length >= 2 → MultiSelectTypeBar takes precedence over DecorationCard', () => {
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide({ withDecoration: true })}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        selection={makeSelection([TB_HOOK.id, DECO_SHAPE.id])}
        onBulkDelete={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="multi-select-type-bar"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeNull()
  })

  it('stale decoration id → DecorationCard does NOT render; falls back to ActiveTextBoxCard', () => {
    // selection.primary points to a decoration that doesn't exist on slide.
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide({ withDecoration: false })}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        selection={makeSelection(['ghost-decoration-id'])}
      />,
    )
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeNull()
  })

  it('decoration update routes through onDecorationAction with UPDATE_DECORATION', () => {
    const onDecorationAction = vi.fn()
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide({ withDecoration: true })}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        selection={makeSelection([DECO_SHAPE.id])}
        onDecorationAction={onDecorationAction}
      />,
    )
    // Click a swatch isn't directly available without brand-kit. Instead
    // exercise the wire by clicking a known commit-immediately control:
    // the stroke style "dashed" button.
    const dashed = container.querySelector(
      '[data-testid="decoration-stroke-style-dashed"]',
    ) as HTMLElement | null
    expect(dashed).toBeTruthy()
    dashed!.click()
    expect(onDecorationAction).toHaveBeenCalledTimes(1)
    const arg = onDecorationAction.mock.calls[0][0]
    expect(arg.type).toBe('UPDATE_DECORATION')
    expect(arg.id).toBe(DECO_SHAPE.id)
    expect(arg.updates).toBeDefined()
  })

  it('switching slides re-resolves activeDecoration (re-mount)', () => {
    const slideA = makeSlide({ withDecoration: true })
    const slideB: Slide = {
      ...makeSlide({ withDecoration: false }),
      hook_text: 'Other',
    }
    const { container, rerender } = render(
      <TextEditorPanel
        slide={slideA}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        selection={makeSelection([DECO_SHAPE.id])}
      />,
    )
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeTruthy()
    // Switch slide; selection state would be cleared by the SEL-10 effect
    // upstream, but in isolation we model that by sending an empty selection.
    rerender(
      <TextEditorPanel
        slide={slideB}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        selection={makeSelection([])}
      />,
    )
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeNull()
  })
})
