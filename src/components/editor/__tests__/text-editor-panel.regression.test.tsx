import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextEditorPanel } from '../text-editor-panel'
import { templates, getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide, TextBox, CustomText } from '@/lib/types/slide'

/**
 * Phase 50 Plan 50-02 T-06 — DOM signature regression suite.
 *
 * Locks the new TextEditorPanel against the 8 representative slide shapes
 * called out in 50-CONTEXT.md D-21. Each test asserts the count and
 * presence of key DOM markers (data-testid attributes), NOT pixel layout.
 * Pixel-perfect snapshots live in Phase 53's render parity suite.
 */

const NON_NEWS_TEMPLATE = templates.find((t) => !t.accentColor) ?? templates[0]
const NEWS_TEMPLATE = templates.find((t) => !!t.accentColor) ?? getTemplate('news-drop')
const MAGAZINE_TEMPLATE = getTemplate('magazine-bold')

function makeBox(partial: Partial<TextBox> & Pick<TextBox, 'role' | 'text'>): TextBox {
  return {
    id: partial.id ?? `tb-${Math.random().toString(36).slice(2, 10)}`,
    position: partial.position ?? { anchor: partial.role === 'body' ? 'bottom' : 'top' },
    ...partial,
  }
}

function makeSlide(partial: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...partial,
  }
}

function renderPanel(opts: {
  slide: Slide
  template?: typeof NON_NEWS_TEMPLATE
  selectedTextBoxId?: string | null
  selectedCustomTextId?: string | null
  customTexts?: CustomText[]
}) {
  const template = opts.template ?? NON_NEWS_TEMPLATE
  const selectedTextBoxId =
    opts.selectedTextBoxId ?? opts.slide.text_boxes?.[0]?.id ?? null
  return render(
    <TextEditorPanel
      slide={opts.slide}
      template={template}
      selectedTextBoxId={selectedTextBoxId}
      onSelectTextBox={vi.fn()}
      onTextBoxAction={vi.fn()}
      onUpdate={vi.fn()}
      selectedCustomTextId={opts.selectedCustomTextId ?? null}
      customTexts={opts.customTexts ?? opts.slide.custom_texts}
      onCustomTextUpdate={vi.fn()}
      onCustomTextRemove={vi.fn()}
    />,
  )
}

describe('TextEditorPanel — DOM signature regression (Phase 50)', () => {
  it('shape 1: hook + body only — 2 chips in LayerStrip', () => {
    const slide = makeSlide()
    slide.text_boxes = legacyToTextBoxes(slide)
    renderPanel({ slide })

    const chips = screen
      .getByTestId('layer-strip')
      .querySelectorAll('[data-testid^="layer-chip-"]')
    expect(chips.length).toBe(2)
    expect(screen.getByTestId('active-text-box-card')).toBeInTheDocument()
    expect(screen.getByTestId('slide-settings')).toBeInTheDocument()
  })

  it('shape 2: hook + body + 1 custom_text → 3 chips in LayerStrip', () => {
    const slide = makeSlide({
      custom_texts: [
        {
          id: 'ct-1',
          text: 'Sticker',
          x: 50,
          y: 50,
          width: 40,
        },
      ],
    })
    slide.text_boxes = legacyToTextBoxes(slide)
    renderPanel({ slide })
    const chips = screen
      .getByTestId('layer-strip')
      .querySelectorAll('[data-testid^="layer-chip-"]')
    expect(chips.length).toBe(3)
  })

  it('shape 3: hook + body + shadow + outline on hook → 2 effect rows enabled', () => {
    const hookId = 'hook-1'
    const bodyId = 'body-1'
    const slide = makeSlide({
      text_boxes: [
        makeBox({
          id: hookId,
          role: 'hook',
          text: 'Hook',
          effects: {
            shadow: { enabled: true, color: '#00000099', size: 'md' },
            outline: { enabled: true, color: '#000000', width: 2 },
          },
        }),
        makeBox({ id: bodyId, role: 'body', text: 'Body' }),
      ],
    })
    renderPanel({ slide, selectedTextBoxId: hookId })

    const shadowRow = screen.getByTestId('effect-row-shadow')
    const outlineRow = screen.getByTestId('effect-row-outline')
    const highlightRow = screen.getByTestId('effect-row-highlight')
    expect(shadowRow).toHaveAttribute('data-enabled', 'true')
    expect(outlineRow).toHaveAttribute('data-enabled', 'true')
    expect(highlightRow).toHaveAttribute('data-enabled', 'false')
    expect(screen.getByTestId('effect-row-shadow-content')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-outline-content')).toBeInTheDocument()
    expect(screen.queryByTestId('effect-row-highlight-content')).toBeNull()
  })

  it('shape 4: news template with accent segments → AccentWordsDisclosure shows count badge', () => {
    const slide = makeSlide({
      hook_text: 'Big news today',
      hook_segments: [
        { text: 'Big', accent: true },
        { text: 'news', accent: false },
        { text: 'today', accent: true },
      ],
    })
    slide.text_boxes = legacyToTextBoxes(slide)
    renderPanel({ slide, template: NEWS_TEMPLATE })

    expect(screen.getByTestId('accent-words-disclosure')).toBeInTheDocument()
    expect(screen.getByTestId('accent-words-count-badge')).toBeInTheDocument()
    expect(screen.getByTestId('accent-words-count-badge').textContent).toMatch(
      /2 highlighted/,
    )
  })

  it('shape 5: magazine-bold with overlays → all major sections render', () => {
    const slide = makeSlide({
      style_overrides: { overlay_opacity: 70 },
    })
    slide.text_boxes = legacyToTextBoxes(slide)
    renderPanel({ slide, template: MAGAZINE_TEMPLATE })

    expect(screen.getByTestId('text-editor-panel')).toBeInTheDocument()
    expect(screen.getByTestId('layer-strip')).toBeInTheDocument()
    expect(screen.getByTestId('active-text-box-card')).toBeInTheDocument()
    expect(screen.getByTestId('slide-settings')).toBeInTheDocument()
    expect(screen.getByTestId('slide-settings-overlay-slider')).toBeInTheDocument()
  })

  it('shape 6: all 3 effects on for hook → 3 effect rows enabled, all 3 contents visible', () => {
    const hookId = 'hook-1'
    const slide = makeSlide({
      text_boxes: [
        makeBox({
          id: hookId,
          role: 'hook',
          text: 'Hook',
          effects: {
            shadow: { enabled: true, color: '#00000099', size: 'md' },
            outline: { enabled: true, color: '#000000', width: 3 },
            highlight: { enabled: true, color: '#00000088', style: 'tight', padding: 8 },
          },
        }),
        makeBox({ id: 'body-1', role: 'body', text: 'Body' }),
      ],
    })
    renderPanel({ slide, selectedTextBoxId: hookId })

    expect(screen.getByTestId('effect-row-shadow')).toHaveAttribute('data-enabled', 'true')
    expect(screen.getByTestId('effect-row-outline')).toHaveAttribute('data-enabled', 'true')
    expect(screen.getByTestId('effect-row-highlight')).toHaveAttribute('data-enabled', 'true')
    expect(screen.getByTestId('effect-row-shadow-content')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-outline-content')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-highlight-content')).toBeInTheDocument()
  })

  it('shape 7: AccentWords disclosure can be expanded → chip wall visible', async () => {
    const slide = makeSlide({
      hook_text: 'Three test words',
      hook_segments: [
        { text: 'Three', accent: false },
        { text: 'test', accent: false },
        { text: 'words', accent: true },
      ],
    })
    slide.text_boxes = legacyToTextBoxes(slide)
    renderPanel({ slide, template: NEWS_TEMPLATE })

    // Closed by default
    expect(screen.queryByTestId('accent-words-chips')).toBeNull()
    // Expand
    const trigger = screen.getByTestId('accent-words-trigger')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(trigger)
    expect(screen.getByTestId('accent-words-chips')).toBeInTheDocument()
    const chipNodes = screen
      .getByTestId('accent-words-chips')
      .querySelectorAll('[data-testid^="accent-word-chip-"]')
    expect(chipNodes.length).toBe(3)
  })

  it('shape 8: 5 text boxes (hook + body + 3 custom) → 5 chips in LayerStrip', () => {
    const slide = makeSlide({
      custom_texts: [
        { id: 'ct-1', text: 'Caption', x: 10, y: 10, width: 30 },
        { id: 'ct-2', text: 'Tag', x: 50, y: 50, width: 20 },
        { id: 'ct-3', text: 'Source', x: 70, y: 80, width: 25 },
      ],
    })
    slide.text_boxes = legacyToTextBoxes(slide)
    renderPanel({ slide })

    const chips = screen
      .getByTestId('layer-strip')
      .querySelectorAll('[data-testid^="layer-chip-"]')
    expect(chips.length).toBe(5)
    // The Add chip is separate from layer-chip-* and should still be present
    expect(screen.getByTestId('layer-strip-add')).toBeInTheDocument()
  })
})

describe('TextEditorPanel — empty state and selection resolution', () => {
  it('renders empty state when text_boxes is empty', () => {
    const slide = makeSlide({ text_boxes: [] })
    renderPanel({ slide, selectedTextBoxId: null })
    expect(screen.getByTestId('active-text-box-card-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('active-text-box-card')).toBeNull()
  })

  it('falls back to first text box when selectedTextBoxId is stale', () => {
    const hookId = 'hook-1'
    const bodyId = 'body-1'
    const slide = makeSlide({
      text_boxes: [
        makeBox({ id: hookId, role: 'hook', text: 'Hook line' }),
        makeBox({ id: bodyId, role: 'body', text: 'Body line' }),
      ],
    })
    renderPanel({ slide, selectedTextBoxId: 'does-not-exist' })
    // Active card should render with the FIRST text box (the hook).
    expect(screen.getByTestId('active-text-box-card')).toHaveAttribute(
      'data-role',
      'hook',
    )
  })
})
