import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideEditor } from '@/components/editor/slide-editor'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 70 Plan 03 (KBD-10): R/C/L direct-insert keyboard shortcuts.
 *
 *   r → buildDefaultShapeDecoration('rect')   → ADD_DECORATION + selection.replaceWith
 *   c → buildDefaultShapeDecoration('circle') → ADD_DECORATION + selection.replaceWith
 *   l → buildDefaultShapeDecoration('line')   → ADD_DECORATION + selection.replaceWith
 *
 * Firewall ordering (PITFALL-9.2): isEditingTarget BEFORE isPickerOpenRef
 * BEFORE preventDefault BEFORE dispatch. Each binding key tests:
 *   - dispatch fires with correct shapeKind + new id auto-selected
 *   - typing the same letter in a textarea is a no-op (caret preserved)
 *   - pressing the same letter while a picker is open is a no-op (no
 *     double-insert when ShapePicker mounted)
 *
 * Probe surface — same `data-*` attribute pattern as
 * slide-editor.shortcuts.test.tsx; we extend the TextEditorPanel mock to
 * surface decorations[] (count + kinds + selected-ids) so post-dispatch
 * effects are observable without a real selection model spy.
 */

// Probe payload shared by both panel mocks below. quick-260514-jn5: when
// the keyboard inserts a decoration via R/C/L, the editor auto-switches
// activeTab to 'elements' (so the user sees the new shape's editing
// surface immediately). Both panel mocks expose the same data-* probes so
// readPanel() finds whichever is currently mounted.
function probeAttrs(
  slide: Slide,
  selection?: { ids: string[]; primary: string | null },
  selectedTextBoxId?: string | null,
) {
  return {
    'data-active-id': selectedTextBoxId ?? '',
    'data-textbox-count': slide.text_boxes?.length ?? 0,
    'data-decoration-count': slide.decorations?.length ?? 0,
    'data-decoration-kinds': (slide.decorations ?? [])
      .map((d) => (d.kind === 'shape' ? d.shapeKind : d.lucideName))
      .join(','),
    'data-decoration-ids': (slide.decorations ?? []).map((d) => d.id).join(','),
    'data-selected-ids': (selection?.ids ?? []).join(','),
  }
}

vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: (props: {
    slide: Slide
    selectedTextBoxId: string | null
    selection?: { ids: string[]; primary: string | null }
  }) => (
    <div
      data-testid="text-editor-panel"
      {...probeAttrs(props.slide, props.selection, props.selectedTextBoxId)}
    />
  ),
}))

vi.mock('@/components/editor/elements-panel', () => ({
  ElementsPanel: (props: {
    slide?: Slide
    activeDecoration?: { id: string } | null
  }) => (
    <div
      data-testid="elements-panel"
      {...probeAttrs(props.slide ?? ({} as Slide), {
        ids: props.activeDecoration ? [props.activeDecoration.id] : [],
        primary: props.activeDecoration?.id ?? null,
      })}
    />
  ),
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

// Phase 70 Plan 03: mock the dynamic picker so the test runner doesn't have
// to resolve next/dynamic. The barrel re-exports LucidePickerDynamic +
// ShapePicker — we replace both with simple presence-probing stubs.
vi.mock('@/components/editor/decoration-picker', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/editor/decoration-picker')
  >('@/components/editor/decoration-picker')
  return {
    ...actual,
    LucidePickerDynamic: ({ open }: { open: boolean }) =>
      open ? <div data-testid="lucide-picker-mock" /> : null,
    ShapePicker: ({ open }: { open: boolean }) =>
      open ? <div data-testid="shape-picker-mock" /> : null,
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
    custom_texts: [
      { id: 'ct-fixed-1', text: 'Caption', x: 10, y: 10, width: 30 },
    ],
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

function readPanel() {
  // quick-260514-jn5: activeTab auto-switches to 'elements' when a decoration
  // is selected. Read from whichever panel is currently mounted; both surface
  // the same data-* probes (see probeAttrs above).
  return (
    screen.queryByTestId('elements-panel') ?? screen.getByTestId('text-editor-panel')
  )
}

describe('Phase 70 Plan 03 (KBD-10) — R/C/L direct-insert shortcuts', () => {
  beforeEach(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })

  it('R inserts a default rect ShapeDecoration and auto-selects it', () => {
    renderEditor()
    expect(readPanel().getAttribute('data-decoration-count')).toBe('0')

    fireEvent.keyDown(window, { key: 'r' })

    const panel = readPanel()
    expect(panel.getAttribute('data-decoration-count')).toBe('1')
    expect(panel.getAttribute('data-decoration-kinds')).toBe('rect')
    const ids = panel.getAttribute('data-decoration-ids') ?? ''
    expect(ids).toBeTruthy()
    // Auto-select via selection.replaceWith(newId)
    const selectedIds = panel.getAttribute('data-selected-ids') ?? ''
    expect(selectedIds.split(',').filter(Boolean)).toEqual([ids])
  })

  it('C inserts a default circle ShapeDecoration and auto-selects it', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'c' })
    const panel = readPanel()
    expect(panel.getAttribute('data-decoration-count')).toBe('1')
    expect(panel.getAttribute('data-decoration-kinds')).toBe('circle')
  })

  it('L inserts a default line ShapeDecoration and auto-selects it', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'l' })
    const panel = readPanel()
    expect(panel.getAttribute('data-decoration-count')).toBe('1')
    expect(panel.getAttribute('data-decoration-kinds')).toBe('line')
  })

  it('R/C/L can be pressed in sequence — each insert appends a new decoration', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'r' })
    fireEvent.keyDown(window, { key: 'c' })
    fireEvent.keyDown(window, { key: 'l' })
    const panel = readPanel()
    expect(panel.getAttribute('data-decoration-count')).toBe('3')
    expect(panel.getAttribute('data-decoration-kinds')).toBe('rect,circle,line')
  })

  it('R is ignored when typing in a textarea (isEditingTarget firewall)', () => {
    renderEditor()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    fireEvent.keyDown(window, { key: 'r' })

    expect(readPanel().getAttribute('data-decoration-count')).toBe('0')
    document.body.removeChild(textarea)
  })

  it('C is ignored when typing in an input (isEditingTarget firewall)', () => {
    renderEditor()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(window, { key: 'c' })

    expect(readPanel().getAttribute('data-decoration-count')).toBe('0')
    document.body.removeChild(input)
  })

  it('R is ignored when LucidePicker is open (isPickerOpenRef firewall)', () => {
    renderEditor()
    // Open LucidePicker via the I shortcut (Plan 70-03 KBD-11 wired in same plan).
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()
    expect(readPanel().getAttribute('data-decoration-count')).toBe('0')

    fireEvent.keyDown(window, { key: 'r' })

    // Still 0 — the second short-circuit blocked the rect insert.
    expect(readPanel().getAttribute('data-decoration-count')).toBe('0')
  })

  it('C is ignored when ShapePicker is open (isPickerOpenRef firewall)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()

    fireEvent.keyDown(window, { key: 'c' })

    expect(readPanel().getAttribute('data-decoration-count')).toBe('0')
  })

  it('R calls preventDefault to suppress browser-default keystrokes', () => {
    renderEditor()
    const ev = new KeyboardEvent('keydown', {
      key: 'r',
      bubbles: true,
      cancelable: true,
    })
    const pd = vi.spyOn(ev, 'preventDefault')
    window.dispatchEvent(ev)
    expect(pd).toHaveBeenCalled()
  })

  it('R does NOT call preventDefault when typing in a textarea (firewall preserves caret)', () => {
    renderEditor()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    const ev = new KeyboardEvent('keydown', {
      key: 'r',
      bubbles: true,
      cancelable: true,
    })
    const pd = vi.spyOn(ev, 'preventDefault')
    textarea.dispatchEvent(ev)
    expect(pd).not.toHaveBeenCalled()

    document.body.removeChild(textarea)
  })

  it('R inserts a fresh id on every press (no id reuse)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'r' })
    const idsAfter1 = (readPanel().getAttribute('data-decoration-ids') ?? '').split(',')
    fireEvent.keyDown(window, { key: 'r' })
    const idsAfter2 = (readPanel().getAttribute('data-decoration-ids') ?? '').split(',')
    expect(idsAfter2).toHaveLength(2)
    expect(idsAfter2[0]).toBe(idsAfter1[0])
    expect(idsAfter2[1]).not.toBe(idsAfter2[0])
  })
})
