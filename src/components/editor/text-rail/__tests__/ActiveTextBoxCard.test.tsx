import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActiveTextBoxCard } from '../ActiveTextBoxCard'
import { templates } from '@/lib/render/templates/index'
import { highlightBar } from '@/lib/render/templates/highlight-bar'
import { editorialSerif } from '@/lib/render/templates/editorial-serif'
import type { TextBox } from '@/lib/types/slide'

const TEMPLATE = templates[0]

function makeBox(partial: Partial<TextBox> = {}): TextBox {
  return {
    id: 'tb-1',
    role: 'hook',
    text: 'Hello world',
    position: { anchor: 'top' },
    ...partial,
  }
}

describe('<ActiveTextBoxCard>', () => {
  it('renders empty state when textBox is null', () => {
    render(
      <ActiveTextBoxCard textBox={null} onUpdate={vi.fn()} template={TEMPLATE} />,
    )
    expect(screen.getByTestId('active-text-box-card-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('active-text-box-card')).toBeNull()
  })

  it('renders all expected child sections in order', () => {
    render(
      <ActiveTextBoxCard textBox={makeBox()} onUpdate={vi.fn()} template={TEMPLATE} />,
    )
    expect(screen.getByTestId('active-text-box-card')).toBeInTheDocument()
    // quick-260514-textbox-numeric-labels: role label is now position-based.
    // The default render here doesn't pass textBoxNumber, so the fallback
    // "TEXT BOX" applies (defensive plain label, no number).
    expect(screen.getByTestId('active-text-box-role-label')).toHaveTextContent('TEXT BOX')
    expect(screen.getByTestId('active-text-box-textarea')).toBeInTheDocument()
    expect(screen.getByTestId('font-picker')).toBeInTheDocument()
    expect(screen.getByTestId('active-text-box-bold')).toBeInTheDocument()
    expect(screen.getByTestId('active-text-box-italic')).toBeInTheDocument()
    expect(screen.getByTestId('active-text-box-size')).toBeInTheDocument()
    expect(screen.getByTestId('active-text-box-effects-subhead')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-shadow')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-outline')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-highlight')).toBeInTheDocument()
  })

  // quick-260515-ihk: trash button in the card header.
  it('renders trash button when onRemove is provided and box is not locked', () => {
    const onRemove = vi.fn()
    render(
      <ActiveTextBoxCard
        textBox={makeBox()}
        onUpdate={vi.fn()}
        template={TEMPLATE}
        onRemove={onRemove}
      />,
    )
    const trash = screen.getByTestId('active-text-box-card-delete')
    expect(trash).toBeInTheDocument()
    expect(trash).toHaveAttribute('aria-label', 'Delete text box')
    fireEvent.click(trash)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('hides trash button when onRemove is not provided', () => {
    render(
      <ActiveTextBoxCard textBox={makeBox()} onUpdate={vi.fn()} template={TEMPLATE} />,
    )
    expect(screen.queryByTestId('active-text-box-card-delete')).toBeNull()
  })

  it('hides trash button when text box is locked', () => {
    render(
      <ActiveTextBoxCard
        textBox={makeBox({ locked: true })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('active-text-box-card-delete')).toBeNull()
  })

  it('typing in the textarea calls onUpdate({ text, segments: undefined })', () => {
    const onUpdate = vi.fn()
    render(
      <ActiveTextBoxCard textBox={makeBox()} onUpdate={onUpdate} template={TEMPLATE} />,
    )
    const ta = screen.getByTestId('active-text-box-textarea') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'Hello world!' } })
    // The onChange call should pass updated text and clear segments.
    const firstCall = onUpdate.mock.calls[0][0]
    expect(firstCall.text).toBe('Hello world!')
    expect(firstCall.segments).toBeUndefined()
    // Explicit key check — segments must be PRESENT (with undefined value), so
    // the reducer overwrites stale segments rather than leaving them in place.
    expect('segments' in firstCall).toBe(true)
  })

  it('B button toggles font_weight 400 ↔ 700', () => {
    const onUpdate = vi.fn()
    render(
      <ActiveTextBoxCard
        textBox={makeBox({ font_weight: 400 })}
        onUpdate={onUpdate}
        template={TEMPLATE}
      />,
    )
    fireEvent.click(screen.getByTestId('active-text-box-bold'))
    expect(onUpdate).toHaveBeenCalledWith({ font_weight: 700 })
  })

  it('B button toggles 700 → 400 when already bold', () => {
    const onUpdate = vi.fn()
    render(
      <ActiveTextBoxCard
        textBox={makeBox({ font_weight: 700 })}
        onUpdate={onUpdate}
        template={TEMPLATE}
      />,
    )
    fireEvent.click(screen.getByTestId('active-text-box-bold'))
    expect(onUpdate).toHaveBeenCalledWith({ font_weight: 400 })
  })

  it('Italic button toggles font_style normal ↔ italic', () => {
    const onUpdate = vi.fn()
    render(
      <ActiveTextBoxCard textBox={makeBox()} onUpdate={onUpdate} template={TEMPLATE} />,
    )
    fireEvent.click(screen.getByTestId('active-text-box-italic'))
    expect(onUpdate).toHaveBeenCalledWith({ font_style: 'italic' })
  })

  it('color swatch click calls onUpdate({ color })', () => {
    const onUpdate = vi.fn()
    render(
      <ActiveTextBoxCard textBox={makeBox()} onUpdate={onUpdate} template={TEMPLATE} />,
    )
    fireEvent.click(screen.getByTestId('active-text-box-swatch-#3d0000'))
    expect(onUpdate).toHaveBeenCalledWith({ color: '#3d0000' })
  })

  it('Shadow toggle on reveals shadow controls; toggle off hides them', () => {
    const onUpdate = vi.fn()
    const { rerender } = render(
      <ActiveTextBoxCard textBox={makeBox()} onUpdate={onUpdate} template={TEMPLATE} />,
    )
    expect(screen.queryByTestId('effect-row-shadow-content')).toBeNull()

    fireEvent.click(screen.getByTestId('effect-row-shadow-switch'))
    // Click should call onUpdate with effects.shadow.enabled=true. Verify the
    // call shape.
    const shadowCall = onUpdate.mock.calls.find(
      (c) => c[0]?.effects?.shadow?.enabled === true,
    )
    expect(shadowCall).toBeDefined()

    // Re-render with effects.shadow on to confirm controls reveal.
    rerender(
      <ActiveTextBoxCard
        textBox={makeBox({ effects: { shadow: { enabled: true, color: '#00000099', size: 'md' } } })}
        onUpdate={onUpdate}
        template={TEMPLATE}
      />,
    )
    expect(screen.getByTestId('effect-row-shadow-content')).toBeInTheDocument()
    expect(screen.getByTestId('shadow-color-row')).toBeInTheDocument()
    expect(screen.getByTestId('shadow-size-md')).toBeInTheDocument()
  })

  it('all 3 effects can be on simultaneously', () => {
    render(
      <ActiveTextBoxCard
        textBox={makeBox({
          effects: {
            shadow: { enabled: true, color: '#00000099', size: 'md' },
            outline: { enabled: true, color: '#000000', width: 2 },
            highlight: { enabled: true, color: '#00000088', style: 'tight', padding: 8 },
          },
        })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
      />,
    )
    expect(screen.getByTestId('effect-row-shadow-content')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-outline-content')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-highlight-content')).toBeInTheDocument()
  })

  it('role label is position-based: textBoxNumber 1 → "TEXT BOX 1", 2 → "TEXT BOX 2", null → "TEXT BOX"', () => {
    const { rerender } = render(
      <ActiveTextBoxCard
        textBox={makeBox({ role: 'hook' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
        textBoxNumber={1}
      />,
    )
    expect(screen.getByTestId('active-text-box-role-label')).toHaveTextContent('TEXT BOX 1')

    rerender(
      <ActiveTextBoxCard
        textBox={makeBox({ role: 'body' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
        textBoxNumber={2}
      />,
    )
    expect(screen.getByTestId('active-text-box-role-label')).toHaveTextContent('TEXT BOX 2')

    rerender(
      <ActiveTextBoxCard
        textBox={makeBox({ role: 'custom' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
        textBoxNumber={3}
      />,
    )
    expect(screen.getByTestId('active-text-box-role-label')).toHaveTextContent('TEXT BOX 3')

    rerender(
      <ActiveTextBoxCard
        textBox={makeBox({ role: 'custom' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
        textBoxNumber={null}
      />,
    )
    expect(screen.getByTestId('active-text-box-role-label')).toHaveTextContent('TEXT BOX')
  })

  it('align button click calls onUpdate({ text_align })', () => {
    const onUpdate = vi.fn()
    render(
      <ActiveTextBoxCard textBox={makeBox()} onUpdate={onUpdate} template={TEMPLATE} />,
    )
    fireEvent.click(screen.getByTestId('active-text-box-align-right'))
    expect(onUpdate).toHaveBeenCalledWith({ text_align: 'right' })
  })

  it('does not render AccentWordsDisclosure when text is empty', () => {
    render(
      <ActiveTextBoxCard
        textBox={makeBox({ text: '   ' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
      />,
    )
    expect(screen.queryByTestId('accent-words-disclosure')).toBeNull()
  })

  it('renders AccentWordsDisclosure when text is non-empty', () => {
    render(
      <ActiveTextBoxCard
        textBox={makeBox({ text: 'Some words here' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
      />,
    )
    expect(screen.getByTestId('accent-words-disclosure')).toBeInTheDocument()
  })

  // quick-260515-999: "Highlight words" must paint a marker-style pill behind
  // the word, not flip its text color. The right-panel toggle is the entry
  // point; toggling ON writes highlightColor + highlightStyle so the
  // renderer's pill branch fires, toggling OFF strips them so the segment
  // renders as a plain run again. The "Highlight color" picker must repaint
  // every already-accented segment so the picker controls the actual visible
  // marker color, not just the default for the next toggle.
  describe('Highlight words (pill marker behavior)', () => {
    function openDisclosure() {
      fireEvent.click(screen.getByTestId('accent-words-trigger'))
    }

    it('toggles a segment ON with pill fields written alongside accent:true', () => {
      const onUpdate = vi.fn()
      render(
        <ActiveTextBoxCard
          textBox={makeBox({
            text: 'controversial move',
            accent_color: '#FFD166',
            segments: [
              { text: 'controversial' },
              { text: 'move' },
            ],
          })}
          onUpdate={onUpdate}
          template={TEMPLATE}
        />,
      )
      openDisclosure()
      fireEvent.click(screen.getByTestId('accent-word-chip-0'))
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const payload = onUpdate.mock.calls[0][0]
      expect(payload.segments).toEqual([
        {
          text: 'controversial',
          accent: true,
          highlightColor: '#FFD166',
          highlightStyle: 'pill',
        },
        { text: 'move' },
      ])
    })

    it('toggling a segment OFF strips highlightColor and highlightStyle', () => {
      const onUpdate = vi.fn()
      render(
        <ActiveTextBoxCard
          textBox={makeBox({
            text: 'controversial move',
            accent_color: '#FFD166',
            segments: [
              {
                text: 'controversial',
                accent: true,
                highlightColor: '#FFD166',
                highlightStyle: 'pill',
              },
              { text: 'move' },
            ],
          })}
          onUpdate={onUpdate}
          template={TEMPLATE}
        />,
      )
      openDisclosure()
      fireEvent.click(screen.getByTestId('accent-word-chip-0'))
      const payload = onUpdate.mock.calls[0][0]
      expect(payload.segments[0]).toEqual({
        text: 'controversial',
        accent: false,
      })
      expect(payload.segments[0]).not.toHaveProperty('highlightColor')
      expect(payload.segments[0]).not.toHaveProperty('highlightStyle')
    })

    it('toggling ON falls back to template.accentColor when accent_color is unset', () => {
      const onUpdate = vi.fn()
      render(
        <ActiveTextBoxCard
          textBox={makeBox({
            text: 'word',
            segments: [{ text: 'word' }],
          })}
          onUpdate={onUpdate}
          template={TEMPLATE}
        />,
      )
      openDisclosure()
      fireEvent.click(screen.getByTestId('accent-word-chip-0'))
      const payload = onUpdate.mock.calls[0][0]
      // Template default accent color drives the highlight when the box has
      // no per-box override.
      expect(payload.segments[0].highlightColor).toBe(
        TEMPLATE.accentColor ?? '#3d0000',
      )
      expect(payload.segments[0].highlightStyle).toBe('pill')
    })

    it('picking a new highlight color repaints every accented segment AND updates accent_color', () => {
      const onUpdate = vi.fn()
      render(
        <ActiveTextBoxCard
          textBox={makeBox({
            text: 'one two three',
            accent_color: '#FFD166',
            segments: [
              {
                text: 'one',
                accent: true,
                highlightColor: '#FFD166',
                highlightStyle: 'pill',
              },
              { text: 'two' },
              {
                text: 'three',
                accent: true,
                highlightColor: '#FFD166',
                highlightStyle: 'pill',
              },
            ],
          })}
          onUpdate={onUpdate}
          template={TEMPLATE}
        />,
      )
      openDisclosure()
      // Pick the mint swatch from the brand row.
      fireEvent.click(screen.getByTestId('accent-color-swatch-#A8E0B0'))
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const payload = onUpdate.mock.calls[0][0]
      expect(payload.accent_color).toBe('#A8E0B0')
      expect(payload.segments).toEqual([
        {
          text: 'one',
          accent: true,
          highlightColor: '#A8E0B0',
          highlightStyle: 'pill',
        },
        { text: 'two' },
        {
          text: 'three',
          accent: true,
          highlightColor: '#A8E0B0',
          highlightStyle: 'pill',
        },
      ])
    })

    it('picking a new highlight color with no accented segments only updates accent_color', () => {
      const onUpdate = vi.fn()
      render(
        <ActiveTextBoxCard
          textBox={makeBox({
            text: 'plain words here',
            segments: [
              { text: 'plain' },
              { text: 'words' },
              { text: 'here' },
            ],
          })}
          onUpdate={onUpdate}
          template={TEMPLATE}
        />,
      )
      openDisclosure()
      fireEvent.click(screen.getByTestId('accent-color-swatch-#A8E0B0'))
      const payload = onUpdate.mock.calls[0][0]
      expect(payload).toEqual({ accent_color: '#A8E0B0' })
      // No segments override — we don't want to repaint plain words.
      expect(payload).not.toHaveProperty('segments')
    })
  })

  // quick-260515-nhf: hook casing toggle. Lets the user escape a template's
  // hardcoded `hookStyle: 'uppercase'` (e.g. highlight-bar — the reported bug).
  describe('Uppercase toggle (quick-260515-nhf)', () => {
    it('renders the uppercase toggle for a hook box', () => {
      render(
        <ActiveTextBoxCard
          textBox={makeBox({ role: 'hook' })}
          onUpdate={vi.fn()}
          template={highlightBar}
        />,
      )
      expect(screen.getByTestId('active-text-box-uppercase')).toBeInTheDocument()
    })

    it('does NOT render the uppercase toggle for a body box', () => {
      render(
        <ActiveTextBoxCard
          textBox={makeBox({ role: 'body' })}
          onUpdate={vi.fn()}
          template={highlightBar}
        />,
      )
      expect(screen.queryByTestId('active-text-box-uppercase')).toBeNull()
    })

    it('reflects pressed state from an uppercase template default', () => {
      // highlight-bar.hookStyle === 'uppercase' → toggle reads as pressed.
      render(
        <ActiveTextBoxCard
          textBox={makeBox({ role: 'hook' })}
          onUpdate={vi.fn()}
          template={highlightBar}
        />,
      )
      const btn = screen.getByTestId('active-text-box-uppercase')
      expect(btn).toHaveAttribute('aria-pressed', 'true')
      expect(btn).toHaveAttribute('data-active', 'true')
    })

    it('reflects un-pressed state from a normal-hookStyle template default', () => {
      // editorial-serif.hookStyle === 'normal' → toggle reads as un-pressed.
      render(
        <ActiveTextBoxCard
          textBox={makeBox({ role: 'hook' })}
          onUpdate={vi.fn()}
          template={editorialSerif}
        />,
      )
      expect(screen.getByTestId('active-text-box-uppercase')).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })

    it('the per-box text_transform override wins over the template default', () => {
      render(
        <ActiveTextBoxCard
          textBox={makeBox({ role: 'hook', text_transform: 'none' })}
          onUpdate={vi.fn()}
          template={highlightBar}
        />,
      )
      // template is uppercase, but the box explicitly opted out.
      expect(screen.getByTestId('active-text-box-uppercase')).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })

    it('clicking a pressed (uppercase) toggle writes text_transform: none', () => {
      const onUpdate = vi.fn()
      render(
        <ActiveTextBoxCard
          textBox={makeBox({ role: 'hook' })}
          onUpdate={onUpdate}
          template={highlightBar}
        />,
      )
      fireEvent.click(screen.getByTestId('active-text-box-uppercase'))
      expect(onUpdate).toHaveBeenCalledWith({ text_transform: 'none' })
    })

    it('clicking an un-pressed toggle writes text_transform: uppercase', () => {
      const onUpdate = vi.fn()
      render(
        <ActiveTextBoxCard
          textBox={makeBox({ role: 'hook' })}
          onUpdate={onUpdate}
          template={editorialSerif}
        />,
      )
      fireEvent.click(screen.getByTestId('active-text-box-uppercase'))
      expect(onUpdate).toHaveBeenCalledWith({ text_transform: 'uppercase' })
    })
  })
})
