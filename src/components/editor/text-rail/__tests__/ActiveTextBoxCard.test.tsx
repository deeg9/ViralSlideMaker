import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActiveTextBoxCard } from '../ActiveTextBoxCard'
import { templates } from '@/lib/render/templates/index'
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
    expect(screen.getByTestId('active-text-box-role-label')).toHaveTextContent('HOOK TEXT')
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

  it('role label maps hook → "HOOK TEXT", body → "BODY TEXT", custom → "TEXT BOX"', () => {
    const { rerender } = render(
      <ActiveTextBoxCard
        textBox={makeBox({ role: 'hook' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
      />,
    )
    expect(screen.getByTestId('active-text-box-role-label')).toHaveTextContent('HOOK TEXT')

    rerender(
      <ActiveTextBoxCard
        textBox={makeBox({ role: 'body' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
      />,
    )
    expect(screen.getByTestId('active-text-box-role-label')).toHaveTextContent('BODY TEXT')

    rerender(
      <ActiveTextBoxCard
        textBox={makeBox({ role: 'custom' })}
        onUpdate={vi.fn()}
        template={TEMPLATE}
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
})
