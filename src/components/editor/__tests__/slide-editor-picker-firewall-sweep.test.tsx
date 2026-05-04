import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideEditor } from '@/components/editor/slide-editor'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 70 Plan 03 (PICKER-07 + KBD-12) — SWEEP-PICK behavioral grid.
 *
 * Behavioral counterpart to picker-firewall-grep.test.ts's structural
 * audit. For each critical editor tinykeys binding, this file:
 *   1. Renders <SlideEditor> with a fixture seeded for the action
 *      (pre-grouped fixture for ungroup, multi-element fixture for
 *      group / nudge / z-order / align / lock / bulk-delete, etc.)
 *   2. Opens a picker (LucidePicker via 'i' OR ShapePicker via 's')
 *   3. Fires the editor shortcut keystroke
 *   4. Asserts NO observable reducer effect (no groupId mutation, no
 *      position change, no count change, no z-order shuffle, no lock
 *      flag flip, no decoration insertion)
 *   5. Closes the picker and asserts the SAME shortcut now fires (the
 *      firewall LIFTS — round-trip / regression net for the
 *      isPickerOpenRef sync inside setOpenPicker)
 *
 * Test grid (one binding per test; SWEEP-PICK-1..18):
 *   1. Cmd+G        — picker open → no GROUP dispatch
 *   2. Cmd+Shift+G  — picker open → no UNGROUP dispatch
 *   3. Cmd+]        — picker open → no Z_ORDER (forward) dispatch
 *   4. Cmd+[        — picker open → no Z_ORDER (backward) dispatch
 *   5. Cmd+Alt+]    — picker open → no Z_ORDER (front) dispatch
 *   6. Cmd+Alt+[    — picker open → no Z_ORDER (back) dispatch
 *   7. Delete       — picker open → no removeTextBox / BULK_DELETE
 *   8. Backspace    — picker open → no removeTextBox / BULK_DELETE
 *   9. Cmd+D        — picker open → no ADD_TEXT_BOX (duplicate)
 *  10. ArrowUp      — picker open → no BULK_TRANSLATE (1px nudge)
 *  11. Shift+ArrowDown — picker open → no BULK_TRANSLATE (10px nudge)
 *  12. Alt+H        — picker open → no ALIGN dispatch
 *  13. Cmd+Alt+H    — picker open → no DISTRIBUTE dispatch
 *  14. Cmd+Shift+L  — picker open → no SET_LOCKED dispatch
 *  15. Cmd+A        — picker open → no selectAll
 *  16. R            — picker open → no rect insert (no double-insert race)
 *  17. ShapePicker variant: Cmd+G with ShapePicker open → no GROUP dispatch
 *  18. Round-trip: open → close → Cmd+G fires GROUP normally
 */

// ──────────────────────────────────────────────────────────────────────
// Mocks (mirror slide-editor.shortcuts.test.tsx + slide-editor-keyboard-rcl)
// ──────────────────────────────────────────────────────────────────────

vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: (props: {
    slide: Slide
    selectedTextBoxId: string | null
    selection?: { ids: string[]; primary: string | null }
  }) => (
    <div
      data-testid="text-editor-panel"
      data-active-id={props.selectedTextBoxId ?? ''}
      data-textbox-count={props.slide.text_boxes?.length ?? 0}
      data-selected-ids={(props.selection?.ids ?? []).join(',')}
      data-groupids={(props.slide.text_boxes ?? [])
        .map((tb) => tb.groupId ?? '')
        .join(',')}
      data-textbox-ids={(props.slide.text_boxes ?? [])
        .map((tb) => tb.id)
        .join(',')}
      data-customimage-ids={(props.slide.custom_images ?? [])
        .map((ci) => ci.id)
        .join(',')}
      data-image-positions={(props.slide.custom_images ?? [])
        .map((ci) => `${ci.id}:${ci.x},${ci.y}`)
        .join(';')}
      data-locked-state={[
        ...(props.slide.text_boxes ?? []).map(
          (tb) => `${tb.id}:${tb.locked === true ? '1' : '0'}`,
        ),
        ...(props.slide.custom_images ?? []).map(
          (ci) => `${ci.id}:${ci.locked === true ? '1' : '0'}`,
        ),
      ].join(';')}
      data-decoration-count={props.slide.decorations?.length ?? 0}
      data-textbox-positions={(props.slide.text_boxes ?? [])
        .map((tb) => {
          const a = tb.position.anchor
          const x = tb.position.x ?? ''
          const y = tb.position.y ?? ''
          return `${tb.id}:${a}:${x},${y}`
        })
        .join(';')}
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

// ──────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────

function makeRichSlide(): Slide {
  // Fixture wide enough to exercise group, z-order, nudge, align, lock,
  // and duplicate paths. Pre-groups the 2 customs so Cmd+Shift+G has
  // something to ungroup.
  const slide: Slide = {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_texts: [
      { id: 'ct-a', text: 'A', x: 10, y: 10, width: 30 },
      { id: 'ct-b', text: 'B', x: 50, y: 50, width: 30 },
    ],
    custom_images: [
      { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 10, height: 10 },
      { id: 'img-b', url: 'data:,', x: 50, y: 20, width: 10, height: 10 },
      { id: 'img-c', url: 'data:,', x: 80, y: 30, width: 10, height: 10 },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  slide.text_boxes = slide.text_boxes!.map((tb) =>
    tb.role === 'custom' ? { ...tb, groupId: 'g_seed' } : tb,
  )
  return slide
}

function renderEditor() {
  return render(
    <SlideEditor
      initialSlides={[makeRichSlide()]}
      projectId="p1"
      templateId="highlight-bar"
      topic="test"
    />,
  )
}

function readPanel() {
  return screen.getByTestId('text-editor-panel')
}

function readImagePositions(): Record<string, { x: number; y: number }> {
  const raw = readPanel().getAttribute('data-image-positions') ?? ''
  const out: Record<string, { x: number; y: number }> = {}
  for (const entry of raw.split(';').filter(Boolean)) {
    const [id, xy] = entry.split(':')
    const [x, y] = xy.split(',').map(Number)
    out[id] = { x, y }
  }
  return out
}

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe('Phase 70 Plan 03 SWEEP-PICK — every critical editor shortcut no-ops while picker is open', () => {
  beforeEach(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })

  it('SWEEP-PICK-1: Cmd+G does not fire GROUP while LucidePicker is open', () => {
    renderEditor()
    // Pre-state: 4 text_boxes, all 2 customs already in g_seed.
    // Open picker.
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()

    // Try Cmd+A then Cmd+G. Cmd+A is ALSO blocked by firewall (correct),
    // so selection stays as-is. We assert groupId state stays IDENTICAL
    // (no new g_<index>_<...> generated).
    const before = readPanel().getAttribute('data-groupids') ?? ''
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    const after = readPanel().getAttribute('data-groupids') ?? ''
    expect(after).toBe(before)
  })

  it('SWEEP-PICK-2: Cmd+Shift+G does not fire UNGROUP while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'i' })

    // Pre-grouped 2 customs in g_seed. Try Cmd+Shift+G with picker open.
    const before = readPanel().getAttribute('data-groupids') ?? ''
    expect(before.split(',').filter((g) => g === 'g_seed').length).toBe(2)

    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })

    const after = readPanel().getAttribute('data-groupids') ?? ''
    expect(after).toBe(before) // g_seed still on both customs
  })

  it('SWEEP-PICK-3: Cmd+] does not fire Z_ORDER (forward) while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'i' })

    const before = readPanel().getAttribute('data-customimage-ids') ?? ''
    fireEvent.keyDown(window, { key: ']', ctrlKey: true })
    const after = readPanel().getAttribute('data-customimage-ids') ?? ''
    expect(after).toBe(before)
  })

  it('SWEEP-PICK-4: Cmd+[ does not fire Z_ORDER (backward) while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'i' })

    const before = readPanel().getAttribute('data-customimage-ids') ?? ''
    fireEvent.keyDown(window, { key: '[', ctrlKey: true })
    const after = readPanel().getAttribute('data-customimage-ids') ?? ''
    expect(after).toBe(before)
  })

  it('SWEEP-PICK-5: Cmd+Alt+] does not fire Z_ORDER (front) while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'i' })

    const before = readPanel().getAttribute('data-customimage-ids') ?? ''
    fireEvent.keyDown(window, { key: ']', ctrlKey: true, altKey: true })
    const after = readPanel().getAttribute('data-customimage-ids') ?? ''
    expect(after).toBe(before)
  })

  it('SWEEP-PICK-6: Cmd+Alt+[ does not fire Z_ORDER (back) while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'i' })

    const before = readPanel().getAttribute('data-customimage-ids') ?? ''
    fireEvent.keyDown(window, { key: '[', ctrlKey: true, altKey: true })
    const after = readPanel().getAttribute('data-customimage-ids') ?? ''
    expect(after).toBe(before)
  })

  it('SWEEP-PICK-7: Delete does not remove a text box while LucidePicker is open', () => {
    renderEditor()
    // Select a custom text first (Cmd+3 — body is index 1, customs start at 2)
    fireEvent.keyDown(window, { key: '3', ctrlKey: true })
    const beforeCount = readPanel().getAttribute('data-textbox-count') ?? '0'

    // Now open picker and try Delete.
    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'Delete' })

    expect(readPanel().getAttribute('data-textbox-count')).toBe(beforeCount)
  })

  it('SWEEP-PICK-8: Backspace does not remove a text box while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: '3', ctrlKey: true })
    const beforeCount = readPanel().getAttribute('data-textbox-count') ?? '0'

    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(readPanel().getAttribute('data-textbox-count')).toBe(beforeCount)
  })

  it('SWEEP-PICK-9: Cmd+D does not duplicate a text box while LucidePicker is open', () => {
    renderEditor()
    const beforeCount = readPanel().getAttribute('data-textbox-count') ?? '0'

    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })

    expect(readPanel().getAttribute('data-textbox-count')).toBe(beforeCount)
  })

  it('SWEEP-PICK-10: ArrowUp does not nudge selection while LucidePicker is open', () => {
    renderEditor()
    // Build selection first (before picker opens)
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const before = readImagePositions()

    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })

    const after = readImagePositions()
    expect(after).toEqual(before)
  })

  it('SWEEP-PICK-11: Shift+ArrowDown does not nudge selection while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const before = readImagePositions()

    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true })

    const after = readImagePositions()
    expect(after).toEqual(before)
  })

  it('SWEEP-PICK-12: Alt+H does not align selection while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const before = readImagePositions()

    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'h', altKey: true })

    const after = readImagePositions()
    expect(after).toEqual(before)
  })

  it('SWEEP-PICK-13: Cmd+Alt+H does not distribute selection while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const before = readImagePositions()

    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'h', ctrlKey: true, altKey: true })

    const after = readImagePositions()
    expect(after).toEqual(before)
  })

  it('SWEEP-PICK-14: Cmd+Shift+L does not toggle lock state while LucidePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const before = readPanel().getAttribute('data-locked-state') ?? ''

    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true, shiftKey: true })

    const after = readPanel().getAttribute('data-locked-state') ?? ''
    expect(after).toBe(before)
  })

  it('SWEEP-PICK-15: Cmd+A does not run selectAll while LucidePicker is open', () => {
    renderEditor()
    // Clear selection first.
    fireEvent.keyDown(window, { key: 'Escape' })
    const beforeIds =
      readPanel().getAttribute('data-selected-ids')?.split(',').filter(Boolean) ?? []

    fireEvent.keyDown(window, { key: 'i' })
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })

    const afterIds =
      readPanel().getAttribute('data-selected-ids')?.split(',').filter(Boolean) ?? []
    expect(afterIds).toEqual(beforeIds)
  })

  it('SWEEP-PICK-16: R does not insert a rect while ShapePicker is open (no double-insert race)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()

    fireEvent.keyDown(window, { key: 'r' })

    expect(readPanel().getAttribute('data-decoration-count')).toBe('0')
  })

  it('SWEEP-PICK-17 (sibling picker): Cmd+G does not fire GROUP while ShapePicker is open', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 's' })
    expect(screen.queryByTestId('shape-picker-mock')).not.toBeNull()

    const before = readPanel().getAttribute('data-groupids') ?? ''
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    const after = readPanel().getAttribute('data-groupids') ?? ''
    expect(after).toBe(before)
  })

  it('SWEEP-PICK-18 (round-trip / regression net): closing picker lifts firewall — Cmd+G then fires GROUP', () => {
    renderEditor()
    // Open + close picker.
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByTestId('lucide-picker-mock')).not.toBeNull()
    fireEvent.click(screen.getByTestId('lucide-picker-close-btn'))
    expect(screen.queryByTestId('lucide-picker-mock')).toBeNull()

    // Pre-grouped 2 customs + 2 structural anchors. Cmd+A → Cmd+G should
    // now fire GROUP and overwrite g_seed with a fresh g_0_<base36> on
    // the customs (and assign the same g_0_<base36> to hook + body since
    // they're also in selection.ids — group reducer doesn't filter by
    // role; it just stamps groupId on every selected element).
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const beforeGroupIds = readPanel().getAttribute('data-groupids') ?? ''
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    const afterGroupIds = readPanel().getAttribute('data-groupids') ?? ''

    // The fresh groupId is g_0_<base36> — different from g_seed.
    const afterValues = afterGroupIds.split(',').filter(Boolean)
    expect(afterValues.length).toBeGreaterThan(0)
    expect(afterValues.every((g) => /^g_0_[a-z0-9]+$/.test(g))).toBe(true)
    // The pre-state had 2 g_seed entries and 2 empties — the post-state
    // should have all 4 sharing one freshly-generated groupId.
    expect(afterGroupIds).not.toBe(beforeGroupIds)
    const uniqueAfter = new Set(afterValues)
    expect(uniqueAfter.size).toBe(1)
    expect([...uniqueAfter][0]).not.toBe('g_seed')
  })
})
