'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { SlidePreview } from '@/components/slides/slide-preview'
import type { Slide, TextPosition, CustomText } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { Selection } from '@/lib/editor/use-selection-model'
import type { AlignAxis, DistributeAxis } from '@/lib/editor/transforms/align'

// Re-export so consumers can type the new group-state props symmetrically.
type GroupEnterFn = (elementId: string, slide: Slide) => void
type GroupExitFn = () => void

interface SlideCanvasProps {
  slides: Slide[]
  template: SlideTemplate
  selectedIndex: number
  onSelectIndex: (index: number) => void
  brandKit?: BrandKit | null
  userTier?: 'free' | 'plus' | 'pro'
  // Phase 45 — project topic forwarded for slide-field overlay resolution.
  // Optional: when omitted, slide-field topic overlays render '' per Plan 45-01.
  topic?: string
  onPositionChange?: (field: 'hook' | 'body', position: TextPosition) => void
  onWidthChange?: (field: 'hook' | 'body', width: number) => void
  // phase-59-02: corner-drag size callbacks (width + optional font_size). Forwarded
  // to SlidePreview unchanged. Side drags supply { width } only; corner drags supply
  // { width, font_size } (FONTSCALE-01..04).
  onSizeChange?: (field: 'hook' | 'body', size: { width: number; font_size?: number }) => void
  onCustomTextPositionChange?: (id: string, position: TextPosition) => void
  onCustomTextWidthChange?: (id: string, width: number) => void
  onCustomTextSizeChange?: (id: string, size: { width: number; font_size?: number }) => void
  onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void
  onCustomTextSelect?: (id: string | null) => void
  onCustomTextRemove?: (id: string) => void
  selectedCustomTextId?: string | null
  onCustomImagePositionChange?: (id: string, position: { x: number; y: number }) => void
  onCustomImageSizeChange?: (id: string, size: { width: number; height: number }) => void
  onCustomImageSelect?: (id: string | null) => void
  onCustomImageRemove?: (id: string) => void
  selectedCustomImageId?: string | null
  // Phase 52 (T-01): canvas → right-rail selection wiring. Click on hook/body/custom
  // wrappers in editable mode dispatches the matching TextBox.id; right rail mirrors.
  onTextBoxSelect?: (id: string | null) => void
  selectedTextBoxId?: string | null
  // Phase 60 (SEL-01..04, SEL-09, SEL-13): multi-select state forwarded to
  // SlidePreview for click handlers + union-AABB ring rendering.
  selection?: Selection
  onSelectionChange?: (next: Selection | ((prev: Selection) => Selection)) => void
  // Phase 62 (GROUP-06, GROUP-07, GROUP-08, GROUP-10): group-state
  // pass-through to SlidePreview. SlideCanvas is a thin forwarding wrapper —
  // these props are read by SlidePreview's group-bounding-ring + group-aware
  // click handlers + canvas-empty exitGroup branch.
  currentlyInsideGroup?: string | null
  onEnterGroup?: GroupEnterFn
  onExitGroup?: GroupExitFn
  // Phase 62 (GROUP-09, KBD-09): group drag fan-out callback. Forwarded to
  // SlidePreview's onDragStop branch. slide-editor.tsx wires this to
  // dispatch({ type: 'BULK_TRANSLATE', ... }) so the gesture lands as one
  // history entry (KBD-09).
  onGroupDrag?: (payload: {
    slideIndex: number
    ids: string[]
    deltaX: number
    deltaY: number
  }) => void
  // Phase 66 Plan 02 (DIFF-01, KBD-09): Alt+drag duplicate fan-out. Forwarded
  // verbatim to SlidePreview. slide-editor.tsx wires this to
  // dispatch({ type: 'DUPLICATE_ELEMENTS_AT', ... }).
  onAltDuplicate?: (payload: {
    slideIndex: number
    ids: string[]
    deltaX: number
    deltaY: number
    newGroupId?: string
  }) => void
  // Phase 63 Plan 02 (ALIGN-07): pass-through for the FloatingAlignmentToolbar
  // action callback. SlideCanvas is a thin forwarding wrapper — slide-editor
  // wires this to dispatch({ type: 'ALIGN' | 'DISTRIBUTE', ... }).
  onAlign?: (
    action:
      | { kind: 'align'; axis: AlignAxis }
      | { kind: 'distribute'; axis: DistributeAxis },
  ) => void
  // quick-260514-kct: decoration drag commit pass-through. slide-editor wires
  // this to dispatch({ type: 'UPDATE_DECORATION', ... }).
  onDecorationPositionChange?: (
    id: string,
    position: { x: number; y: number },
  ) => void
}

export function SlideCanvas({
  slides,
  template,
  selectedIndex,
  onSelectIndex,
  brandKit,
  userTier,
  topic,
  onPositionChange,
  onWidthChange,
  onSizeChange,
  onCustomTextPositionChange,
  onCustomTextWidthChange,
  onCustomTextSizeChange,
  onCustomTextUpdate,
  onCustomTextSelect,
  onCustomTextRemove,
  selectedCustomTextId,
  onCustomImagePositionChange,
  onCustomImageSizeChange,
  onCustomImageSelect,
  onCustomImageRemove,
  selectedCustomImageId,
  onTextBoxSelect,
  selectedTextBoxId,
  selection,
  onSelectionChange,
  currentlyInsideGroup,
  onEnterGroup,
  onExitGroup,
  onGroupDrag,
  onAltDuplicate,
  onAlign,
  onDecorationPositionChange,
}: SlideCanvasProps) {
  const currentSlide = slides[selectedIndex]
  // Phase 57 (EDITOR-03, D-21): IG feed crop preview toggle. Component-local
  // session-scoped state — not persisted to project, not lifted to parent.
  const [igGridOn, setIgGridOn] = useState(false)
  if (!currentSlide) return null

  const isFirst = selectedIndex === 0
  const isLast = selectedIndex === slides.length - 1

  return (
    <div
      className="bg-[#fff8f7] flex flex-col items-center justify-center p-3 lg:p-8 overflow-hidden"
      data-testid="slide-canvas"
    >
      <div className="w-full max-w-md relative">
        <div className="rounded-xl shadow-[0px_20px_40px_rgba(61,0,0,0.06)] overflow-hidden">
          <SlidePreview
            slide={currentSlide}
            template={template}
            index={selectedIndex}
            slideIndex={selectedIndex}
            totalSlides={slides.length}
            topic={topic}
            editable={true}
            brandKit={brandKit}
            userTier={userTier}
            onPositionChange={onPositionChange}
            onWidthChange={onWidthChange}
            onSizeChange={onSizeChange}
            onCustomTextPositionChange={onCustomTextPositionChange}
            onCustomTextWidthChange={onCustomTextWidthChange}
            onCustomTextSizeChange={onCustomTextSizeChange}
            onCustomTextUpdate={onCustomTextUpdate}
            onCustomTextSelect={onCustomTextSelect}
            onCustomTextRemove={onCustomTextRemove}
            selectedCustomTextId={selectedCustomTextId}
            onCustomImagePositionChange={onCustomImagePositionChange}
            onCustomImageSizeChange={onCustomImageSizeChange}
            onCustomImageSelect={onCustomImageSelect}
            onCustomImageRemove={onCustomImageRemove}
            selectedCustomImageId={selectedCustomImageId}
            onTextBoxSelect={onTextBoxSelect}
            selectedTextBoxId={selectedTextBoxId}
            selection={selection}
            onSelectionChange={onSelectionChange}
            currentlyInsideGroup={currentlyInsideGroup}
            onEnterGroup={onEnterGroup}
            onExitGroup={onExitGroup}
            onGroupDrag={onGroupDrag}
            onAltDuplicate={onAltDuplicate}
            onAlign={onAlign}
            onDecorationPositionChange={onDecorationPositionChange}
          />
          {/* Phase 57 (EDITOR-03, D-20, D-23): IG feed safe-zone overlay.
              CSS outline (not border) so layout is unaffected. Top-aligned —
              IG center-crops portrait carousels to the top 4:5 (1080×1350).
              Bottom inset 28.125% = (1920-1350)/1920 ≈ 29.7%, snapped to a
              clean fraction so dashes align cleanly. */}
          {igGridOn && (
            <div
              data-testid="ig-grid-overlay"
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: '28.125%',
                outline: '2px dashed rgba(255, 255, 255, 0.85)',
                outlineOffset: '-2px',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />
          )}
        </div>

        {/* Navigation arrows */}
        <button
          onClick={() => onSelectIndex(selectedIndex - 1)}
          disabled={isFirst}
          aria-label="Previous slide"
          className="absolute left-1 lg:left-[-20px] top-1/2 -translate-y-1/2 z-20 bg-white/90 lg:bg-white shadow-lg hover:bg-[#fadbdb] text-[#3d0000] rounded-full p-1.5 lg:p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center"
        >
          <Icon name="chevron_left" size="sm" />
        </button>

        <button
          onClick={() => onSelectIndex(selectedIndex + 1)}
          disabled={isLast}
          aria-label="Next slide"
          className="absolute right-1 lg:right-[-20px] top-1/2 -translate-y-1/2 z-20 bg-white/90 lg:bg-white shadow-lg hover:bg-[#fadbdb] text-[#3d0000] rounded-full p-1.5 lg:p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center"
        >
          <Icon name="chevron_right" size="sm" />
        </button>
      </div>

      {/* Slide counter -- below the canvas */}
      <div className="mt-4 bg-white px-4 py-2 rounded-full flex items-center gap-3 shadow-sm border border-[#dbc1bc]/10">
        <span className="text-[10px] font-bold text-[#3d0000] uppercase tracking-widest">
          Slide {selectedIndex + 1} / {slides.length}
        </span>
        <span className="w-px h-3 bg-[#dbc1bc]/40" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setIgGridOn((v) => !v)}
          aria-label="Toggle Instagram feed crop preview"
          aria-pressed={igGridOn}
          data-testid="ig-grid-chip"
          className={
            igGridOn
              ? 'bg-[#3d0000] text-white px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest'
              : 'bg-transparent text-[#7d6161] hover:bg-[#fadbdb] px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#dbc1bc]/30'
          }
        >
          IG Grid
        </button>
      </div>
    </div>
  )
}
