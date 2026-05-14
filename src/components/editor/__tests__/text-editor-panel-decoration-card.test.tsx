/**
 * quick-260514-jn5: decoration editing moved from the Text tab to the
 * Elements tab. TextEditorPanel no longer renders <DecorationCard> — the
 * Text tab is consistently about text boxes (single or multi-select).
 *
 * Branch precedence in TextEditorPanel is now 2-way:
 *   1. selection.ids.length >= 2 && onBulkDelete → MultiSelectTypeBar
 *   2. otherwise → ActiveTextBoxCard
 *
 * Decoration editing lives in ElementsPanel — covered by
 * elements-panel-decoration-card.test.tsx.
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

describe('TextEditorPanel composition (post quick-260514-jn5)', () => {
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

  it('selection.primary maps to a decoration → DecorationCard does NOT render in Text tab', () => {
    // Post-jn5: decoration editing lives in the Elements tab, not here.
    // Even when selection.primary is a decoration, the Text tab keeps
    // rendering ActiveTextBoxCard (text-only focus).
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
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeNull()
    // ActiveTextBoxCard (or its empty variant) renders in place.
    const hasActive = container.querySelector('[data-testid="active-text-box-card"]')
    const hasEmpty = container.querySelector('[data-testid="active-text-box-card-empty"]')
    expect(hasActive || hasEmpty).toBeTruthy()
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
    const hasActive = container.querySelector('[data-testid="active-text-box-card"]')
    const hasEmpty = container.querySelector('[data-testid="active-text-box-card-empty"]')
    expect(hasActive || hasEmpty).toBeTruthy()
    expect(container.querySelector('[data-testid="decoration-card"]')).toBeNull()
  })

  it('selection.ids.length >= 2 → MultiSelectTypeBar takes precedence', () => {
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
})
