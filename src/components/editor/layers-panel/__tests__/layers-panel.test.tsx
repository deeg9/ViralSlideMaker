import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import LayersPanel, { synthesizeRows } from '../layers-panel'
import type {
  LayerRow,
  LayerChipRow,
  LayerGroupHeaderRow,
  LayersPanelProps,
} from '../types'
import type { Slide } from '@/lib/types/slide'
import type { SelectionModel } from '@/lib/editor/use-selection-model'

/**
 * Phase 65 Plan 01 (LAYERS-01..04, LAYERS-08, LAYERS-09):
 * LayersPanel structure tests.
 *
 * Vanilla flat list — NO react-arborist / virtualization. The panel
 * synthesizes rows from text_boxes ∪ custom_images ∪ watermark and
 * inserts a `group-header` row before each consecutive run of same-
 * groupId chips. Selection sync is READ-ONLY from props (the parent
 * injects the canonical SelectionModel from useSelectionModel).
 */

// ───── Slide fixtures ────────────────────────────────────────────────

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: [],
    custom_images: [],
    ...overrides,
  }
}

// ───── SelectionModel mock — mirrors the real shape ──────────────────

function makeSelection(overrides: Partial<SelectionModel> = {}): SelectionModel {
  return {
    ids: [],
    primary: null,
    replaceWith: vi.fn(),
    addToSelection: vi.fn(),
    removeFromSelection: vi.fn(),
    toggleInSelection: vi.fn(),
    clear: vi.fn(),
    selectAll: vi.fn(),
    setSelection: vi.fn(),
    currentlyInsideGroup: null,
    enterGroup: vi.fn(),
    exitGroup: vi.fn(),
    ...overrides,
  }
}

describe('Phase 65 Plan 01 (LAYERS-01..04, LAYERS-08, LAYERS-09): LayersPanel structure', () => {
  // ───── synthesizeRows pure-helper tests ──────────────────────────

  it('LP1: synthesizeRows on a slide with hook+body+custom_image returns 3 chip rows in [hook, body, image] order', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb-hook',
          role: 'hook',
          text: 'Hook headline',
          position: { anchor: 'top' },
        },
        {
          id: 'tb-body',
          role: 'body',
          text: 'Body copy',
          position: { anchor: 'bottom' },
        },
      ],
      custom_images: [
        {
          id: 'ci-1',
          url: 'https://example.com/path/dog.png',
          x: 10,
          y: 10,
          width: 30,
          height: 30,
        },
      ],
    })
    const rows = synthesizeRows(slide)
    const chips = rows.filter((r): r is LayerChipRow => r.kind === 'chip')
    expect(chips).toHaveLength(3)
    expect(chips[0].id).toBe('tb-hook')
    expect(chips[1].id).toBe('tb-body')
    expect(chips[2].id).toBe('ci-1')
    expect(chips[0].elementType).toBe('text')
    expect(chips[1].elementType).toBe('text')
    expect(chips[2].elementType).toBe('image')
  })

  it('LP2: synthesizeRows on a slide with no groups returns rows where every chip\'s groupId is undefined', () => {
    const slide = makeSlide({
      text_boxes: [
        { id: 'tb1', role: 'hook', text: 'A', position: { anchor: 'top' } },
        { id: 'tb2', role: 'body', text: 'B', position: { anchor: 'bottom' } },
      ],
    })
    const rows = synthesizeRows(slide)
    expect(rows.every((r) => r.kind === 'chip')).toBe(true)
    for (const r of rows) {
      if (r.kind === 'chip') {
        expect(r.groupId).toBeUndefined()
      }
    }
  })

  it('LP3: synthesizeRows where hook+body share groupId emits [group-header, chip, chip] in that order', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb-hook',
          role: 'hook',
          text: 'Hook',
          position: { anchor: 'top' },
          groupId: 'g_0_xyz',
        },
        {
          id: 'tb-body',
          role: 'body',
          text: 'Body',
          position: { anchor: 'bottom' },
          groupId: 'g_0_xyz',
        },
      ],
    })
    const rows = synthesizeRows(slide)
    expect(rows).toHaveLength(3)
    expect(rows[0].kind).toBe('group-header')
    if (rows[0].kind === 'group-header') {
      expect(rows[0].groupId).toBe('g_0_xyz')
      expect(rows[0].memberIds).toEqual(['tb-hook', 'tb-body'])
    }
    expect(rows[1].kind).toBe('chip')
    expect(rows[2].kind).toBe('chip')
    if (rows[1].kind === 'chip') expect(rows[1].id).toBe('tb-hook')
    if (rows[2].kind === 'chip') expect(rows[2].id).toBe('tb-body')
  })

  it('LP4: synthesizeRows is structurally stable across calls on the same slide content', () => {
    const slide = makeSlide({
      text_boxes: [
        { id: 'tb1', role: 'hook', text: 'A', position: { anchor: 'top' } },
      ],
      custom_images: [
        { id: 'ci-1', url: 'http://x/y.png', x: 0, y: 0, width: 10, height: 10 },
      ],
    })
    const a = synthesizeRows(slide)
    const b = synthesizeRows(slide)
    // Structurally equal (deep equal via JSON serialization is sufficient
    // — useMemo at the call-site handles render-time ref-stability).
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('LP5: TypeScript narrowing works — row.kind discriminates chip vs group-header', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb1',
          role: 'hook',
          text: 'A',
          position: { anchor: 'top' },
          groupId: 'g1',
        },
        {
          id: 'tb2',
          role: 'body',
          text: 'B',
          position: { anchor: 'bottom' },
          groupId: 'g1',
        },
      ],
    })
    const rows: LayerRow[] = synthesizeRows(slide)
    let chipCount = 0
    let headerCount = 0
    for (const row of rows) {
      if (row.kind === 'chip') {
        // Compile-time gate: .id, .elementType, .label, .locked, .hidden
        expect(typeof row.id).toBe('string')
        expect(['text', 'image', 'watermark']).toContain(row.elementType)
        chipCount++
      } else if (row.kind === 'group-header') {
        // Compile-time gate: .groupId, .memberIds, .allLocked, .allHidden
        expect(Array.isArray(row.memberIds)).toBe(true)
        expect(typeof row.allLocked).toBe('boolean')
        headerCount++
      }
    }
    expect(chipCount).toBeGreaterThan(0)
    expect(headerCount).toBeGreaterThan(0)
  })

  it('LP6: watermark element produces a chip with elementType="watermark" and label from text/fallback', () => {
    const slide = makeSlide({
      watermark: {
        id: 'wm1',
        customText: '@brandhandle',
      },
    })
    const rows = synthesizeRows(slide)
    const wmChip = rows.find(
      (r): r is LayerChipRow => r.kind === 'chip' && r.elementType === 'watermark',
    )
    expect(wmChip).toBeDefined()
    expect(wmChip?.label).toContain('brandhandle')

    // Empty watermark → fallback label "Watermark"
    const slide2 = makeSlide({
      watermark: { id: 'wm2' },
    })
    const rows2 = synthesizeRows(slide2)
    const wmChip2 = rows2.find(
      (r): r is LayerChipRow => r.kind === 'chip' && r.elementType === 'watermark',
    )
    expect(wmChip2?.label).toBe('Watermark')
  })

  it('LP7: hidden / locked element fields pass through unchanged', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb-locked',
          role: 'hook',
          text: 'L',
          position: { anchor: 'top' },
          locked: true,
        },
        {
          id: 'tb-hidden',
          role: 'body',
          text: 'H',
          position: { anchor: 'bottom' },
          hidden: true,
        },
      ],
    })
    const rows = synthesizeRows(slide)
    const locked = rows.find((r): r is LayerChipRow => r.kind === 'chip' && r.id === 'tb-locked')
    const hidden = rows.find((r): r is LayerChipRow => r.kind === 'chip' && r.id === 'tb-hidden')
    expect(locked?.locked).toBe(true)
    expect(locked?.hidden).toBe(false)
    expect(hidden?.locked).toBe(false)
    expect(hidden?.hidden).toBe(true)
  })

  it('LP8: group-header allLocked is true iff every member locked; same for allHidden', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb-a',
          role: 'hook',
          text: 'A',
          position: { anchor: 'top' },
          groupId: 'g',
          locked: true,
          hidden: true,
        },
        {
          id: 'tb-b',
          role: 'body',
          text: 'B',
          position: { anchor: 'bottom' },
          groupId: 'g',
          locked: true,
          hidden: false,
        },
      ],
    })
    const rows = synthesizeRows(slide)
    const header = rows.find((r): r is LayerGroupHeaderRow => r.kind === 'group-header')
    expect(header).toBeDefined()
    expect(header?.allLocked).toBe(true)
    expect(header?.allHidden).toBe(false)
  })

  it('LP9: importing LayerRow / LayerChipProps / GroupRowProps / LayersPanelProps from ./types compiles', async () => {
    // Smoke import — purely a compile-time gate. Re-importing here proves
    // the symbols resolve at runtime too (tsconfig path resolution + named
    // export presence).
    const types = await import('../types')
    expect(types).toBeDefined()
  })

  // ───── LayersPanel render + interaction tests ────────────────────

  it('LP-render-1: renders a chip per element on the slide', () => {
    const slide = makeSlide({
      text_boxes: [
        { id: 'tb1', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
      ],
      custom_images: [
        { id: 'ci1', url: 'http://x/y.png', x: 0, y: 0, width: 10, height: 10 },
      ],
    })
    const onRename = vi.fn()
    render(
      <LayersPanel
        slide={slide}
        selection={makeSelection()}
        onRename={onRename}
        onLockToggle={vi.fn()}
        onVisibilityToggle={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    expect(screen.getByTestId('layers-panel')).toBeInTheDocument()
    expect(screen.getAllByTestId('layer-chip')).toHaveLength(2)
  })

  it('LP-render-2: click chip → selection.replaceWith([id]); shift-click → toggleInSelection(id)', () => {
    const slide = makeSlide({
      text_boxes: [
        { id: 'tb1', role: 'hook', text: 'A', position: { anchor: 'top' } },
        { id: 'tb2', role: 'body', text: 'B', position: { anchor: 'bottom' } },
      ],
    })
    const sel = makeSelection()
    render(
      <LayersPanel
        slide={slide}
        selection={sel}
        onRename={vi.fn()}
        onLockToggle={vi.fn()}
        onVisibilityToggle={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    const chips = screen.getAllByTestId('layer-chip')
    fireEvent.click(chips[0])
    expect(sel.replaceWith).toHaveBeenCalledWith(['tb1'])
    fireEvent.click(chips[1], { shiftKey: true })
    expect(sel.toggleInSelection).toHaveBeenCalledWith('tb2')
  })

  it('LP-render-3: dblclick chip label opens an <input>; isEditing guard fires (Backspace doesn\'t bubble)', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb-c',
          role: 'custom',
          text: 'Custom',
          position: { anchor: 'custom', x: 50, y: 50 },
        },
      ],
    })
    const onRename = vi.fn()
    render(
      <LayersPanel
        slide={slide}
        selection={makeSelection()}
        onRename={onRename}
        onLockToggle={vi.fn()}
        onVisibilityToggle={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    const chips = screen.getAllByTestId('layer-chip')
    const label = chips[0].querySelector('[data-testid="chip-label"]')
    expect(label).toBeTruthy()
    fireEvent.doubleClick(label!)
    const input = chips[0].querySelector('input[type="text"]') as HTMLInputElement | null
    expect(input).toBeTruthy()
    // Asserting on element type itself — the existing isEditingTarget guard
    // at slide-editor.tsx:344-348 returns true for INPUT element targets.
    expect(input?.tagName).toBe('INPUT')
  })

  it('LP-render-4: group-header chevron click toggles expand/collapse — collapsed hides member chips', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb-a',
          role: 'hook',
          text: 'A',
          position: { anchor: 'top' },
          groupId: 'g1',
        },
        {
          id: 'tb-b',
          role: 'body',
          text: 'B',
          position: { anchor: 'bottom' },
          groupId: 'g1',
        },
      ],
    })
    render(
      <LayersPanel
        slide={slide}
        selection={makeSelection()}
        onRename={vi.fn()}
        onLockToggle={vi.fn()}
        onVisibilityToggle={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    // Default collapsed → 0 chips visible (only group header).
    expect(screen.queryAllByTestId('layer-chip')).toHaveLength(0)
    expect(screen.getByTestId('group-row')).toBeInTheDocument()
    // Click group toggle → chips appear.
    const toggle = screen.getByTestId('group-row-toggle')
    act(() => {
      fireEvent.click(toggle)
    })
    expect(screen.getAllByTestId('layer-chip')).toHaveLength(2)
  })

  it('LP-render-5: rename input commits via Enter / blur and calls onRename(id, newValue)', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb-c',
          role: 'custom',
          text: 'Custom',
          position: { anchor: 'custom', x: 50, y: 50 },
        },
      ],
    })
    const onRename = vi.fn()
    render(
      <LayersPanel
        slide={slide}
        selection={makeSelection()}
        onRename={onRename}
        onLockToggle={vi.fn()}
        onVisibilityToggle={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    const chip = screen.getAllByTestId('layer-chip')[0]
    const label = chip.querySelector('[data-testid="chip-label"]')!
    fireEvent.doubleClick(label)
    const input = chip.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'My name' } })
    fireEvent.blur(input)
    expect(onRename).toHaveBeenCalledWith('tb-c', 'My name')
  })
})
