import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideEditor } from '@/components/editor/slide-editor'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 52 (T-03) — keyboard shortcut regression suite.
 * Phase 60 (60-04) — migrated from hand-rolled keydown switch to tinykeys.
 *
 * Asserts behavior of the window keydown listener wired in SlideEditor:
 *   • $mod+1 / $mod+2 select Nth text box on current slide (mirrors selectedTextBoxId)
 *   • $mod+D adds a new custom text box and auto-selects it
 *   • Delete on a CUSTOM text box removes it (clears selection)
 *   • Delete on hook/body is a no-op (structural — preserved for legacy compat)
 *   • Shortcuts ignored when typing in input/textarea/contentEditable
 *
 * The test asserts via `data-active-id` exposed on the mocked TextEditorPanel
 * (a thin probe) — keyboard events are dispatched on `window` since the
 * listener attaches there.
 *
 * Test-infra note (Phase 60-04): jsdom's `navigator.platform` is empty, which
 * causes tinykeys to resolve `$mod` to `Control` (its non-Mac default). We
 * therefore fire shortcuts with `ctrlKey: true` instead of `ctrlKey: true`.
 * In production the `$mod` token resolves correctly per-OS at runtime — these
 * tests still exercise the same binding via the cross-platform path.
 */

// Probe that surfaces selectedTextBoxId + the current slide's text-box count
// via data-* attributes so tests can assert the listener's effect on state.
vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: (props: {
    selectedTextBoxId: string | null
    slide: Slide
  }) => (
    <div
      data-testid="text-editor-panel"
      data-active-id={props.selectedTextBoxId ?? ''}
      data-textbox-count={props.slide.text_boxes?.length ?? 0}
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

vi.mock('@/app/(dashboard)/project/[id]/editor-actions', () => ({
  saveSlideData: vi.fn().mockResolvedValue(undefined),
  saveTemplateId: vi.fn().mockResolvedValue(undefined),
  regenerateSlideText: vi.fn(),
  regenerateSlideImageQuery: vi.fn(),
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
  // Eager-migrate so text_boxes is the canonical source
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

describe('SlideEditor — Phase 52 keyboard shortcuts', () => {
  beforeEach(() => {
    // Reset focus to body before each test so isEditing detection starts clean
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })

  it('Cmd+1 selects the first text box (hook)', () => {
    renderEditor()
    const panel = screen.getByTestId('text-editor-panel')
    const initialId = panel.getAttribute('data-active-id') ?? ''
    // The slide is seeded with selectedTextBoxId = first text box's id
    // by the existing slide-switch effect in slide-editor. Confirm baseline.
    expect(initialId).toBeTruthy()

    // Now select something else (Cmd+2) then press Cmd+1
    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    const panelAfter2 = screen.getByTestId('text-editor-panel')
    const idAfter2 = panelAfter2.getAttribute('data-active-id') ?? ''
    expect(idAfter2).not.toBe(initialId)

    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    const panelAfter1 = screen.getByTestId('text-editor-panel')
    expect(panelAfter1.getAttribute('data-active-id')).toBe(initialId)
  })

  it('Cmd+2 selects the second text box (body)', () => {
    renderEditor()
    const before = screen.getByTestId('text-editor-panel').getAttribute('data-active-id') ?? ''
    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    const after = screen.getByTestId('text-editor-panel').getAttribute('data-active-id') ?? ''
    expect(after).toBeTruthy()
    expect(after).not.toBe(before)
  })

  it('Cmd+D adds a new custom text box and auto-selects it', () => {
    renderEditor()
    const before = screen.getByTestId('text-editor-panel')
    const beforeCount = parseInt(before.getAttribute('data-textbox-count') ?? '0', 10)
    const beforeId = before.getAttribute('data-active-id') ?? ''

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })

    const after = screen.getByTestId('text-editor-panel')
    const afterCount = parseInt(after.getAttribute('data-textbox-count') ?? '0', 10)
    const afterId = after.getAttribute('data-active-id') ?? ''

    expect(afterCount).toBe(beforeCount + 1)
    expect(afterId).toBeTruthy()
    expect(afterId).not.toBe(beforeId)
  })

  it('Delete removes a custom text box (preserves hook/body)', () => {
    renderEditor()
    // Programmatically select the seeded custom box (id 'ct-fixed-1') by
    // dispatching Cmd+3 (hook=1, body=2, custom=3)
    fireEvent.keyDown(window, { key: '3', ctrlKey: true })
    const beforeDel = screen.getByTestId('text-editor-panel')
    expect(beforeDel.getAttribute('data-active-id')).toBe('ct-fixed-1')
    const beforeCount = parseInt(beforeDel.getAttribute('data-textbox-count') ?? '0', 10)
    expect(beforeCount).toBe(3)

    fireEvent.keyDown(window, { key: 'Delete' })

    const afterDel = screen.getByTestId('text-editor-panel')
    expect(afterDel.getAttribute('data-textbox-count')).toBe(String(beforeCount - 1))
    // Selection cleared (custom was removed)
    expect(afterDel.getAttribute('data-active-id')).toBe('')

    // Now select hook (Cmd+1) and try to Delete it — must be a no-op
    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    const hookSelected = screen.getByTestId('text-editor-panel').getAttribute('data-active-id')
    expect(hookSelected).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Delete' })
    const afterHookDel = screen.getByTestId('text-editor-panel')
    // Count unchanged (hook NOT removed) and selection still on hook
    expect(afterHookDel.getAttribute('data-textbox-count')).toBe('2')
    expect(afterHookDel.getAttribute('data-active-id')).toBe(hookSelected)
  })

  it('shortcuts do nothing when typing in a textarea', () => {
    renderEditor()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    const before = screen.getByTestId('text-editor-panel')
    const beforeId = before.getAttribute('data-active-id') ?? ''
    const beforeCount = parseInt(before.getAttribute('data-textbox-count') ?? '0', 10)

    // Cmd+2 should be ignored
    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    // Cmd+D should be ignored (no new box added)
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })

    const after = screen.getByTestId('text-editor-panel')
    expect(after.getAttribute('data-active-id') ?? '').toBe(beforeId)
    expect(parseInt(after.getAttribute('data-textbox-count') ?? '0', 10)).toBe(beforeCount)

    document.body.removeChild(textarea)
  })
})
