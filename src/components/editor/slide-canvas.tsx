'use client'

import { Icon } from '@/components/ui/icon'
import { HintPill } from '@/components/ui/hint-pill'
import { SlidePreview } from '@/components/slides/slide-preview'
import type { Slide, TextPosition, CustomText, SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
// quick-260515-epn: canvas resolves per-slide template_id_override for the
// SELECTED slide so the right archetype-matched template paints behind the
// editor controls. Shared helper guarantees the precedence chain matches
// every other render surface (TPLREND-05 single-source-of-truth).
import { resolvePerSlideTemplate } from '@/lib/render/resolve-per-slide-template'
import type { Selection } from '@/lib/editor/use-selection-model'
import type { AlignAxis, DistributeAxis } from '@/lib/editor/transforms/align'
import { CAROUSEL_FORMATS, type CarouselFormat } from '@/lib/render/carousel-formats'

// Re-export so consumers can type the new group-state props symmetrically.
type GroupEnterFn = (elementId: string, slide: Slide) => void
type GroupExitFn = () => void

interface SlideCanvasProps {
  slides: Slide[]
  template: SlideTemplate
  selectedIndex: number
  onSelectIndex: (index: number) => void
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
  // quick-260514-l9z: in-place text edit commit (double-click → type → blur).
  // slide-editor wires this to dispatch UPDATE_TEXT_BOX.
  onTextBoxTextEdit?: (id: string, text: string) => void
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
  // quick-260515-k54: decoration resize commit pass-through. slide-editor wires
  // this to dispatch({ type: 'UPDATE_DECORATION', ... }) with width/height.
  onDecorationSizeChange?: (
    id: string,
    size: { width: number; height: number },
  ) => void
  // quick-260517-k2n: caption-card geometry commit pass-through. SlideCanvas is
  // a thin forwarding wrapper — slide-editor.tsx wires this to handleUpdate.
  onCaptionBarUpdate?: (updates: Partial<SlideStyleOverrides>) => void
  // Click-to-focus pass-through. SlideCanvas is a thin forwarding wrapper —
  // slide-editor.tsx wires these to requestPanelFocus so clicking the caption
  // card / watermark on the canvas surfaces its controls in the right rail.
  onCaptionCardSelect?: () => void
  onWatermarkSelect?: () => void
  // Phase 90: carousel output format. Defaults to `tiktok` — drives the live
  // preview's canvas dimensions + the wrapper aspect ratio.
  format?: CarouselFormat
}

export function SlideCanvas({
  slides,
  template,
  selectedIndex,
  onSelectIndex,
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
  onTextBoxTextEdit,
  selection,
  onSelectionChange,
  currentlyInsideGroup,
  onEnterGroup,
  onExitGroup,
  onGroupDrag,
  onAltDuplicate,
  onAlign,
  onDecorationPositionChange,
  onDecorationSizeChange,
  onCaptionBarUpdate,
  onCaptionCardSelect,
  onWatermarkSelect,
  format = CAROUSEL_FORMATS.tiktok,
}: SlideCanvasProps) {
  const currentSlide = slides[selectedIndex]
  if (!currentSlide) return null

  const isFirst = selectedIndex === 0
  const isLast = selectedIndex === slides.length - 1

  // quick-260515-epn: resolve per-slide template_id_override for the selected
  // slide. No override → returns `template` by reference (TPLREND-05 byte-
  // identity gate). The right-rail control panels keep receiving the project-
  // level `template` (their color-picker / font-picker defaults stay anchored
  // to the user-selected template so toggling the override on/off is reversible
  // from the control panel — see slide-editor.tsx comment at TextEditorPanel).
  const perSlideTemplate = resolvePerSlideTemplate(currentSlide, template)

  // quick-260519-hnp: surface the new card-bound headline drag affordance.
  // Mirror the captionCardHeadline predicate from slide-preview so the hint
  // only shows on slides where the headline is actually card-managed (and
  // therefore where the d7g drag-forwarding behaviour applies).
  const overrides = currentSlide?.style_overrides ?? {}
  const isNewsLayoutSlide =
    perSlideTemplate.backgroundMode == null && overrides.layout != null
  const captionCardActive =
    overrides.caption_bar_enabled === true ||
    (overrides.caption_bar_enabled == null && isNewsLayoutSlide)
  const showCaptionCardDragHint = !!(isNewsLayoutSlide && captionCardActive)

  return (
    <div
      className="bg-[#fff8f7] flex flex-col items-center justify-center p-3 lg:p-8 overflow-hidden"
      data-testid="slide-canvas"
    >
      {/* quick-260514-ku2: slide counter moved above the canvas (was below
          the navigation arrows). Same chip, same testid; just relocated. */}
      <div className="mb-4 bg-white px-4 py-2 rounded-full flex items-center gap-3 shadow-sm border border-[#dbc1bc]/10">
        <span className="text-[10px] font-bold text-[#3d0000] uppercase tracking-widest">
          Slide {selectedIndex + 1} / {slides.length}
        </span>
      </div>

      {/* quick-260519-hnp: contextual hint for the d7g card-headline drag
          affordance. Shows once per device until the user dismisses it. */}
      {showCaptionCardDragHint && (
        <HintPill hintKey="caption-card-drag-headline-v1" className="mb-3">
          Drag the headline to move the card
        </HintPill>
      )}

      <div className="w-full max-w-md relative">
        <div className="rounded-xl shadow-[0px_20px_40px_rgba(61,0,0,0.06)] overflow-hidden">
          <SlidePreview
            slide={currentSlide}
            template={perSlideTemplate}
            index={selectedIndex}
            slideIndex={selectedIndex}
            totalSlides={slides.length}
            topic={topic}
            editable={true}
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
            onTextBoxTextEdit={onTextBoxTextEdit}
            selection={selection}
            onSelectionChange={onSelectionChange}
            currentlyInsideGroup={currentlyInsideGroup}
            onEnterGroup={onEnterGroup}
            onExitGroup={onExitGroup}
            onGroupDrag={onGroupDrag}
            onAltDuplicate={onAltDuplicate}
            onAlign={onAlign}
            onDecorationPositionChange={onDecorationPositionChange}
            onDecorationSizeChange={onDecorationSizeChange}
            onCaptionBarUpdate={onCaptionBarUpdate}
            onCaptionCardSelect={onCaptionCardSelect}
            onWatermarkSelect={onWatermarkSelect}
            format={format}
          />
          {/* quick-260514-ksh: IG feed safe-zone overlay + IG Grid toggle
              chip removed per user request. */}
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
    </div>
  )
}
