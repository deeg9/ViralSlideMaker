import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideEditor } from '@/components/editor/slide-editor'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 70 Plan 03 (KBD-11): I/S picker-open keyboard shortcuts.
 *
 *   i → openPicker = 'lucide' → LucidePickerDynamic mounts; isPickerOpenRef.current = true
 *   s → openPicker = 'shape'  → ShapePicker mounts;          isPickerOpenRef.current = true
 *
 * State-machine invariant: only ONE picker open at a time. Pressing 's'
 * while LucidePicker is open does NOT swap to ShapePicker — both bindings
 * short-circuit on isPickerOpenRef. Pressing 'i' while LucidePicker is
 * already open is a silent no-op (no remount race).
 *
 * Firewall ordering same as KBD-10:
 *   isEditingTarget BEFORE isPickerOpenRef BEFORE preventDefault BEFORE setOpenPicker.
 *
 * After the picker calls onClose, openPicker resets to null AND
 * isPickerOpenRef.current = false (synchronous in setOpenPicker callback)
 * — subsequent 'i' / 's' presses open the picker again.
 */

vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: () => <div data-testid="text-editor-panel" />,
}))

vi.mock('@/components/editor/text-editor-panel-legacy', () => ({
  LegacyTextEditorPanel: () => <div data-testid="legacy-panel" />,
}))

vi.mock('@/components/editor/slide-list', () => ({
  SlideList: () => <div data-testid="slide-list" />,
}))

vi.mock('@/components/editor/slide-canvas', () => ({
  SlideCanvas: () => <div data-testid="slide-canvas" />,
}))

vi.mock('@/components/editor/image-picker-panel', () => ({
  ImagePickerPanel: () => <div data-testid="image-picker-panel" />,
}))

vi.mock('@/components/editor/visibility-dropdown', () => ({
  VisibilityDropdown: () => <div data-testid="visibility-dropdown" />,
}))

vi.mock('@/components/captions/caption-panel', () => ({
  CaptionPanel: () => <div data-testid="caption-panel" />,
}))

// Mock the picker barrel — both LucidePickerDynamic + ShapePicker as simple
// presence-probing stubs that ALSO surface their `open` prop + an onClose
// trigger so the round-trip "open → close → reopen" test can drive close.
vi.mock('@/components/editor/decoration-picker', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/editor/decoration-picker')
  >('@/components/editor/decoration-picker')
  return {
    ...actual,
    LucidePickerDynamic: ({
      open,
      onClose,
    }: {
      open: boolean
      onClose: () => void
    }) =>
      open ? (
        <div data-testid="lucide-picker-mock">
          <button data-testid="lucide-picker-close-btn" onClick={onClose} />
        </div>
      ) : null,
    ShapePicker: ({
      open,
      onClose,
    }: {
      open: boolean
      onClose: () => void
    }) =>
      open ? (
        <div data-testid="shape-picker-mock">
          <button data-testid="shape-picker-close-btn" onClick={onClose} />
        </div>
      ) : null,
  }
})

vi.mock('@/app/(dashboard)/project/[id]/editor-actions', () => ({
  saveSlideData: vi.fn().mockResolvedValue(undefined),
  saveTemplateId: vi.fn().mockResolvedValue(undefined),
  regenerateSlideText: vi.fn(),
  regenerateSlideImageQuery: vi.fn(),
  updateSlideTreatment: vi.fn().mockResolvedValue({ success: true, slide: {} }),
  updateProjectWatermark: vi.fn().mockResolvedValue({ success: true }),
  createUploadUrl: vi.fn().mockResolvedValue({ signedUrl: '', publicUrl: '' }),
}))

vi.mock('@/lib/download/zip-slides', () => ({
  downloadSlidesAsZip: vi.fn().mockResolvedValue(undefined),
}))

function makeSlide(): Slide {
  const slide: Slide = {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_texts: [],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return slide
}

function renderEditor() {
  return render(
    <SlideEditor
      initialSlides={[makeSlide()]}
      projectId="p1"
      templateId="highlight-bar"
      topic="test"
    />,
  )
}

describe('Phase 70 Plan 03 (KBD-11) — I/S picker-open shortcuts', () => {
  beforeEach(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })

  it('I opens LucidePickerDynamic', () => {
    renderEditor()
    expect(screen.queryByTestId('lucide-picker-mock')).toBeNull()

    fireEvent.keyDown(window, { key: 'i' })

    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()
    expect(screen.queryByTestId('shape-picker-mock')).toBeNull()
  })

  it('S opens ShapePicker', () => {
    renderEditor()
    expect(screen.queryByTestId('shape-picker-mock')).toBeNull()

    fireEvent.keyDown(window, { key: 's' })

    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()
    expect(screen.queryByTestId('lucide-picker-mock')).toBeNull()
  })

  it('I pressed twice in a row is a silent no-op (LucidePicker stays mounted, no flicker)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()

    // Second press — isPickerOpenRef firewall blocks; openPicker stays 'lucide'.
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()
    expect(screen.queryByTestId('shape-picker-mock')).toBeNull()
  })

  it('S pressed while ShapePicker is already open is a silent no-op', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()

    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()
    expect(screen.queryByTestId('lucide-picker-mock')).toBeNull()
  })

  it('I pressed while ShapePicker is open is a no-op (state-machine invariant — no swap)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()

    fireEvent.keyDown(window, { key: 'i' })
    // Both pickers locked: ShapePicker stays open, LucidePicker does NOT mount.
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()
    expect(screen.queryByTestId('lucide-picker-mock')).toBeNull()
  })

  it('S pressed while LucidePicker is open is a no-op (state-machine invariant — no swap)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()

    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()
    expect(screen.queryByTestId('shape-picker-mock')).toBeNull()
  })

  it('I is ignored when typing in a textarea (isEditingTarget firewall)', () => {
    renderEditor()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    fireEvent.keyDown(window, { key: 'i' })

    expect(screen.queryByTestId('lucide-picker-mock')).toBeNull()
    document.body.removeChild(textarea)
  })

  it('S is ignored when typing in an input (isEditingTarget firewall)', () => {
    renderEditor()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(window, { key: 's' })

    expect(screen.queryByTestId('shape-picker-mock')).toBeNull()
    document.body.removeChild(input)
  })

  it('I → onClose → I opens LucidePicker again (firewall lifts on close)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()

    // Trigger onClose via the mock's close button (mirrors Esc / click outside).
    fireEvent.click(screen.getByTestId('lucide-picker-close-btn'))
    expect(screen.queryByTestId('lucide-picker-mock')).toBeNull()

    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()
  })

  it('S → onClose → S opens ShapePicker again (firewall lifts on close)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 's' })
    fireEvent.click(screen.getByTestId('shape-picker-close-btn'))
    expect(screen.queryByTestId('shape-picker-mock')).toBeNull()

    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()
  })

  it('I → close → S → close → I round-trip works (firewall sync across both pickers)', () => {
    renderEditor()
    // Open LucidePicker
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()
    fireEvent.click(screen.getByTestId('lucide-picker-close-btn'))

    // Open ShapePicker
    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()
    fireEvent.click(screen.getByTestId('shape-picker-close-btn'))

    // Open LucidePicker again
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()
    expect(screen.queryByTestId('shape-picker-mock')).toBeNull()
  })

  it('I calls preventDefault to suppress browser-default keystrokes', () => {
    renderEditor()
    const ev = new KeyboardEvent('keydown', {
      key: 'i',
      bubbles: true,
      cancelable: true,
    })
    const pd = vi.spyOn(ev, 'preventDefault')
    window.dispatchEvent(ev)
    expect(pd).toHaveBeenCalled()
  })

  it('I does NOT call preventDefault when typing in a textarea', () => {
    renderEditor()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    const ev = new KeyboardEvent('keydown', {
      key: 'i',
      bubbles: true,
      cancelable: true,
    })
    const pd = vi.spyOn(ev, 'preventDefault')
    textarea.dispatchEvent(ev)
    expect(pd).not.toHaveBeenCalled()

    document.body.removeChild(textarea)
  })
})
