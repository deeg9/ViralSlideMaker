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
//
// Phase 62 (Plan 62-03) probe extension: also surface a JSON serialization
// of every text_box's `groupId` field (in array order) so Cmd+G / Cmd+Shift+G
// tests can assert the GROUP / UNGROUP reducer dispatch landed. We expose
// this via a separate data-attribute (data-groupids) so existing tests stay
// green — they only read data-active-id + data-textbox-count.
//
// Also surface `selection.ids` (canonical multi-select state from
// useSelectionModel via the `selection` prop) as data-selected-ids — so
// Cmd+G tests can drive selection (Cmd+A or per-shortcut) and observe the
// resulting GROUP dispatch via groupId mutation.
vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: (props: {
    selectedTextBoxId: string | null
    slide: Slide
    selection?: { ids: string[]; primary: string | null }
  }) => (
    <div
      data-testid="text-editor-panel"
      data-active-id={props.selectedTextBoxId ?? ''}
      data-textbox-count={props.slide.text_boxes?.length ?? 0}
      data-groupids={(props.slide.text_boxes ?? [])
        .map((tb) => tb.groupId ?? '')
        .join(',')}
      data-selected-ids={(props.selection?.ids ?? []).join(',')}
    />
  ),
}))

vi.mock('@/components/editor/text-editor-panel-legacy', () => ({
  LegacyTextEditorPanel: () => <div data-testid="legacy-panel" />,
}))

vi.mock('@/components/editor/slide-list', () => ({
  SlideList: () => <div data-testid="slide-list" />,
}))

// Phase 62 (Plan 62-03) probe extension: surface group-state hooks so
// keyboard tests can drive selection.enterGroup before firing Escape, and
// observe currentlyInsideGroup through onExitGroup/onEnterGroup transitions.
// Existing tests don't read these probes — they remain green.
vi.mock('@/components/editor/slide-canvas', () => ({
  SlideCanvas: (props: {
    currentlyInsideGroup?: string | null
    onEnterGroup?: (id: string, slide: Slide) => void
    onExitGroup?: () => void
    slides?: Slide[]
    selectedIndex?: number
  }) => {
    const slide = props.slides?.[props.selectedIndex ?? 0]
    return (
      <div
        data-testid="slide-canvas"
        data-inside-group={props.currentlyInsideGroup ?? ''}
      >
        <button
          data-testid="probe-enter-group"
          onClick={() => {
            // Caller seeds an element id via a separate data-* mechanism.
            // We pull from a window.__probe slot for testability.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id = (window as any).__probeEnterId as string | undefined
            if (id && slide) props.onEnterGroup?.(id, slide)
          }}
        />
        <button
          data-testid="probe-exit-group"
          onClick={() => props.onExitGroup?.()}
        />
      </div>
    )
  },
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

  // ──────────────────────────────────────────────────────────────────────
  // Phase 62 (Plan 62-03): Cmd+G / Cmd+Shift+G / group-aware Esc.
  // ──────────────────────────────────────────────────────────────────────
  //
  // Tests KG1-KG4 cover Cmd+G; KU1-KU2 cover Cmd+Shift+G; KE1-KE2 cover the
  // group-aware Escape branch. All bindings preventDefault per KBD-03 and
  // respect the isEditingTarget firewall per KBD-02 (existing test below
  // already pins KBD-02 across the broader binding set).
  //
  // Mechanism: data-groupids on TextEditorPanel surfaces the post-dispatch
  // groupId state of every text_box. After Cmd+A → Cmd+G, all custom-text
  // entries should share the same generated groupId (g_${slideIndex}_${...}).
  // After Cmd+Shift+G on a pre-grouped fixture, all groupIds clear to ''.
  it('Cmd+G with N>=2 selected dispatches GROUP — all selected text_boxes get a shared groupId', () => {
    renderEditor()
    const panel = screen.getByTestId('text-editor-panel')
    expect(panel.getAttribute('data-textbox-count')).toBe('3') // hook + body + 1 custom
    // Add a second custom so we have 2 customs to group + Cmd+A picks them up.
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    expect(screen.getByTestId('text-editor-panel').getAttribute('data-textbox-count')).toBe('4')

    // Select all (Cmd+A) — populates selection.ids with hook + body + 2 customs.
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const selectedAfterA = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(selectedAfterA.split(',').filter(Boolean).length).toBeGreaterThanOrEqual(2)

    // Cmd+G fires GROUP — all selected text_boxes carry the new groupId.
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    const groupids = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    const groupIdValues = groupids.split(',').filter(Boolean)
    // All 4 text_boxes were selected; all 4 should now share one groupId.
    expect(groupIdValues.length).toBe(4)
    const uniqueGids = new Set(groupIdValues)
    expect(uniqueGids.size).toBe(1)
    // groupId format from Plan 62-03: g_${slideIndex}_${Date.now-base36}
    const sole = [...uniqueGids][0]
    expect(sole).toMatch(/^g_0_[a-z0-9]+$/)
  })

  it('Cmd+G with N<=1 selected is a silent no-op (no groupId mutation)', () => {
    renderEditor()
    // Default selection on first render = hook (selectedTextBoxId seeded;
    // selection.ids might be []). Verify no groupIds anywhere yet.
    const before = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    expect(before.split(',').filter(Boolean).length).toBe(0)
    // selection.ids could be either [] (default) or [hookId] depending on
    // wiring. Force [] by pressing Escape (existing single-press-clear from
    // Plan 60-04, still active when not inside a group).
    fireEvent.keyDown(window, { key: 'Escape' })
    const selectedIdsBefore = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(selectedIdsBefore).toBe('')

    // Cmd+G with N=0 → no-op
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    const after0 = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    expect(after0.split(',').filter(Boolean).length).toBe(0)

    // Now select 1 element via Cmd+1 and verify Cmd+G with N=1 is also a no-op
    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    const selectedIdsAfter1 = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(selectedIdsAfter1.split(',').filter(Boolean).length).toBe(1)

    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    const after1 = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    expect(after1.split(',').filter(Boolean).length).toBe(0)
  })

  it('Cmd+G is ignored when typing in a textarea (KBD-02 firewall)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const beforeIds = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(beforeIds.split(',').filter(Boolean).length).toBeGreaterThanOrEqual(2)

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    // Cmd+G must be ignored — no groupId mutation.
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    const after = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    expect(after.split(',').filter(Boolean).length).toBe(0)

    document.body.removeChild(textarea)
  })

  it('Cmd+G calls preventDefault even when N<=1 (Chrome Find Next suppression — PITFALL-9.3)', () => {
    renderEditor()
    // N=0 path: clear first.
    fireEvent.keyDown(window, { key: 'Escape' })
    const ev0 = new KeyboardEvent('keydown', {
      key: 'g',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    const pd0 = vi.spyOn(ev0, 'preventDefault')
    window.dispatchEvent(ev0)
    expect(pd0).toHaveBeenCalled()

    // N>=2 path: select all first.
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const ev2 = new KeyboardEvent('keydown', {
      key: 'g',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    const pd2 = vi.spyOn(ev2, 'preventDefault')
    window.dispatchEvent(ev2)
    expect(pd2).toHaveBeenCalled()
  })

  it('Cmd+Shift+G dispatches UNGROUP — pre-grouped text_boxes lose their groupId', () => {
    // Seed a slide with 2 customs already in group g_seed.
    function makeGroupedSlide(): Slide {
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
      }
      slide.text_boxes = legacyToTextBoxes(slide)
      // Manually assign groupId to the 2 customs so a Cmd+Shift+G dispatch
      // produces an observable groupId-clear effect.
      slide.text_boxes = slide.text_boxes!.map((tb) =>
        tb.role === 'custom' ? { ...tb, groupId: 'g_seed' } : tb,
      )
      return slide
    }
    render(
      <SlideEditor
        initialSlides={[makeGroupedSlide()]}
        projectId="p1"
        templateId="highlight-bar"
        topic="test"
      />,
    )
    // Confirm initial state: 2 customs carry 'g_seed'.
    const before = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    expect(before.split(',').filter((g) => g === 'g_seed').length).toBe(2)

    // Select all so Cmd+Shift+G has selected grouped elements to act on.
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    // Cmd+Shift+G fires UNGROUP.
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })

    const after = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    // No more 'g_seed' anywhere on the slide.
    expect(after.split(',').filter((g) => g === 'g_seed').length).toBe(0)
  })

  it('Cmd+Shift+G with no grouped elements selected is a silent no-op', () => {
    renderEditor()
    // Default fixture has 0 grouped text_boxes.
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const beforeIds = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(beforeIds.split(',').filter(Boolean).length).toBeGreaterThanOrEqual(2)
    const before = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    expect(before.split(',').filter(Boolean).length).toBe(0)
    const beforeCount = parseInt(
      screen.getByTestId('text-editor-panel').getAttribute('data-textbox-count') ?? '0',
      10,
    )

    // Cmd+Shift+G — no dispatch.
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })

    const after = screen.getByTestId('text-editor-panel')
      .getAttribute('data-groupids') ?? ''
    expect(after.split(',').filter(Boolean).length).toBe(0)
    // text_boxes count unchanged — no incidental dispatch.
    const afterCount = parseInt(
      screen.getByTestId('text-editor-panel').getAttribute('data-textbox-count') ?? '0',
      10,
    )
    expect(afterCount).toBe(beforeCount)
  })

  it('Esc inside group exits the group on first press (does not clear selection)', () => {
    // Seed a slide with 2 customs in group g_seed so we can enter the group.
    function makeGroupedSlide(): Slide {
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
      }
      slide.text_boxes = legacyToTextBoxes(slide)
      slide.text_boxes = slide.text_boxes!.map((tb) =>
        tb.role === 'custom' ? { ...tb, groupId: 'g_seed' } : tb,
      )
      return slide
    }
    render(
      <SlideEditor
        initialSlides={[makeGroupedSlide()]}
        projectId="p1"
        templateId="highlight-bar"
        topic="test"
      />,
    )
    // Drive enterGroup via the SlideCanvas probe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__probeEnterId = 'ct-a'
    // Also seed a selection so we can detect that Esc DID NOT clear it.
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const beforeIds = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(beforeIds.split(',').filter(Boolean).length).toBeGreaterThanOrEqual(2)
    // Enter the group via the probe.
    fireEvent.click(screen.getByTestId('probe-enter-group'))
    expect(screen.getByTestId('slide-canvas').getAttribute('data-inside-group'))
      .toBe('g_seed')

    // First Esc → exits group (data-inside-group clears) but selection survives.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('slide-canvas').getAttribute('data-inside-group'))
      .toBe('')
    const afterEsc1 = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(afterEsc1).toBe(beforeIds) // selection preserved
  })

  it('Esc outside group clears selection (Plan 60-04 behavior preserved when currentlyInsideGroup === null)', () => {
    renderEditor()
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    const beforeIds = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(beforeIds.split(',').filter(Boolean).length).toBeGreaterThanOrEqual(2)
    // No enter-group fired — currentlyInsideGroup === null.
    expect(screen.getByTestId('slide-canvas').getAttribute('data-inside-group'))
      .toBe('')

    fireEvent.keyDown(window, { key: 'Escape' })
    const afterIds = screen.getByTestId('text-editor-panel')
      .getAttribute('data-selected-ids') ?? ''
    expect(afterIds).toBe('')
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
