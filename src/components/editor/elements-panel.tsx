'use client'

/**
 * Editor right-sidebar — Elements tab.
 *
 * Two modes:
 *   1. Selection mode (activeDecoration !== null): renders <DecorationCard>
 *      so the user edits the selected icon/shape (color, W/H/X/Y, rotation,
 *      opacity, drop shadow, delete). Selecting a decoration on the canvas
 *      auto-switches activeTab to 'elements' in slide-editor.tsx — this card
 *      is its home.
 *   2. Library mode (no decoration selected): renders the insert library —
 *      icons (LucidePicker modal), shapes (ShapePicker popover), and
 *      lines/dividers (existing inline tiles).
 *
 * Visual conventions match the rest of the editor right rail:
 *   - Material Symbols (`Icon` component) for section headers
 *   - #3d0000 primary, #fff0f0 hover, 10px uppercase tracked labels
 *   - rounded buttons with #dbc1bc border tones
 */

import { Icon } from '@/components/ui/icon'
import { DIVIDERS } from '@/lib/elements/dividers'
import { DecorationCard } from './text-rail/decoration-card'
import { SlideSettings } from './text-rail/SlideSettings'
import { WatermarkControls, type WatermarkSpec } from './watermark-controls'
import type { Decoration } from '@/lib/types/decoration'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

/**
 * Stroke color used for the in-picker preview tiles only — distinct from
 * the templateTextColor baked into the actual insert. Picker tile bg is
 * `#fdf7f2` (light cream); 7 of 12 built-in templates have white or cream
 * textColor which would render invisibly against that bg. `#3d0000` (the
 * project's primary brand color) gives every preview tile high contrast
 * regardless of which template the user is editing.
 */
const PREVIEW_STROKE = '#3d0000'

interface ElementsPanelProps {
  /** Active slide — sibling panels (TextEditorPanel, ImagePickerPanel) take
   *  the slide as well, both for derivedPalette swatches and for future
   *  per-slide library behavior. Optional so unit tests can render the
   *  panel in isolation. */
  slide?: Slide
  /** Full active template — quick-260514-move-slide-cards-to-elements:
   *  SlideSettings (mounted at the bottom of this panel) needs the template
   *  to know whether NewsLayout controls apply. Optional so existing unit
   *  tests that render the panel in isolation don't need to construct a
   *  template fixture. */
  template?: SlideTemplate
  /** Active template's text color — baked into every inserted divider. */
  templateTextColor: string
  /** Caller dispatches ADD_CUSTOM_IMAGE with the data URI + centered defaults. */
  onInsertDivider: (dataUri: string) => void
  /** Slide-level dispatch — wired by slide-editor to its `handleUpdate`
   *  callback. Used by the mounted SlideSettings card (News Layout +
   *  Overlay). Optional in isolated tests. */
  onSlideUpdate?: (updates: Partial<Slide>) => void
  /** User tier for the Watermark card's "show/hide" affordance. */
  userTier?: 'free' | 'plus' | 'pro'
  /** Wired by slide-editor to dispatch + persist project-wide watermark
   *  changes. Mirrors the prop the TextEditorPanel used to consume before
   *  the card moved here. */
  onSlideWatermarkChange?: (spec: WatermarkSpec) => void
  onWatermarkLogoUpload?: (file: File) => void
  onWatermarkLogoRemove?: () => void
  isWatermarkPending?: boolean
  /** When set, the panel renders DecorationCard for this decoration in place
   *  of the library. Mirrors the TextEditorPanel CARD-01 contract. */
  activeDecoration?: Decoration | null
  /** Dispatches UPDATE_DECORATION for the active decoration. */
  onDecorationUpdate?: (updates: Partial<Decoration>) => void
  /** Dispatches REMOVE_DECORATION for the active decoration + clears selection. */
  onDecorationRemove?: () => void
  /** Transient live-preview dispatch — wired by slide-editor to fire
   *  UPDATE_DECORATION with noHistory:true so per-keystroke / per-drag-tick
   *  updates land on the canvas without polluting the undo stack. The committing
   *  dispatch still flows through `onDecorationUpdate`. */
  onDecorationPreview?: (updates: Partial<Decoration>) => void
  /** Opens the icon picker in SWAP mode — replaces the currently selected
   *  icon's lucideName in place rather than inserting a new decoration. Only
   *  wired when the active decoration is an icon. */
  onSwapIcon?: () => void
  /** Clears selection so the panel returns to library mode (icons/shapes/
   *  dividers tiles). Used by the back-to-library link rendered above the
   *  inspector when a decoration is selected. */
  onBackToLibrary?: () => void
  /** Opens the lazy-loaded LucidePicker modal (118-icon Lucide library). */
  onOpenIconPicker?: () => void
  /** Opens the ShapePicker popover (rect, circle, polygon, star, etc.). */
  onOpenShapePicker?: () => void
  /** Brand-kit palette + extracted palette piped to DecorationCard swatches. */
  brandKit?: BrandKit | null
  derivedPalette?: string[]
}

export function ElementsPanel({
  slide,
  template,
  templateTextColor,
  onInsertDivider,
  activeDecoration,
  onDecorationUpdate,
  onDecorationRemove,
  onDecorationPreview,
  onSwapIcon,
  onBackToLibrary,
  onOpenIconPicker,
  onOpenShapePicker,
  onSlideUpdate,
  userTier,
  onSlideWatermarkChange,
  onWatermarkLogoUpload,
  onWatermarkLogoRemove,
  isWatermarkPending,
  brandKit,
  derivedPalette,
}: ElementsPanelProps) {
  // quick-260514-move-slide-cards-to-elements: shared slide-level cards
  // mounted at the bottom of BOTH selection-mode and library-mode renders.
  // The cards are slide-scoped, not selection-scoped, so they stay visible
  // regardless of whether a decoration is currently selected.
  const slideLevelCards =
    slide && template && onSlideUpdate ? (
      <>
        <SlideSettings
          slide={slide}
          template={template}
          onUpdate={onSlideUpdate}
          brandKit={brandKit}
        />
        <WatermarkControls
          slide={slide}
          userTier={userTier ?? 'free'}
          isPending={isWatermarkPending ?? false}
          onWatermarkChange={onSlideWatermarkChange}
          onCustomLogoUpload={onWatermarkLogoUpload}
          onCustomLogoRemove={onWatermarkLogoRemove}
        />
      </>
    ) : null
  // ───────────────────────────────────────────────────────────────────
  // Selection mode — a decoration is currently selected on the canvas.
  // Render the inspector card so the user can edit + delete it here.
  // ───────────────────────────────────────────────────────────────────
  if (activeDecoration) {
    const isIcon = activeDecoration.kind === 'icon'
    return (
      <div className="p-4 space-y-3 bg-[#fff0f0]">
        {onBackToLibrary && (
          <button
            type="button"
            onClick={onBackToLibrary}
            data-testid="elements-panel-back-to-library"
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#7d6161] hover:text-[#3d0000] transition-colors focus:outline-none focus-visible:underline"
          >
            <span aria-hidden="true">←</span>
            <span>Browse {isIcon ? 'icon' : 'element'} library</span>
          </button>
        )}
        <DecorationCard
          decoration={activeDecoration}
          onUpdate={(updates) => onDecorationUpdate?.(updates)}
          onRemove={onDecorationRemove}
          onSwapIcon={isIcon ? onSwapIcon : undefined}
          onPreview={onDecorationPreview}
          brandKit={brandKit}
          derivedPalette={derivedPalette}
        />
        {slideLevelCards}
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────
  // Library mode — no decoration selected. Show the insert tiles.
  // ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 bg-[#fff0f0]">
      {/* quick-260514-portlet-cards: each library section is its own white
          card with subtle brown border + top-left title, mirroring the
          WatermarkControls / SlideSettings shell. */}
      <section className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Icons &amp; Shapes
        </h3>
        <p className="text-xs text-[#7d6161] leading-snug">
          Click to browse — pick one to insert at slide center.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenIconPicker?.()}
            disabled={!onOpenIconPicker}
            data-testid="elements-panel-open-icons"
            className="flex flex-col items-center justify-center gap-1.5 aspect-square rounded-md border border-[#dbc1bc]/30 bg-white hover:bg-[#fadbdb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Browse icons"
          >
            <Icon name="emoji_symbols" size="md" className="text-[#3d0000]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#3d0000]">
              Icons
            </span>
          </button>
          <button
            type="button"
            onClick={() => onOpenShapePicker?.()}
            disabled={!onOpenShapePicker}
            data-testid="elements-panel-open-shapes"
            className="flex flex-col items-center justify-center gap-1.5 aspect-square rounded-md border border-[#dbc1bc]/30 bg-white hover:bg-[#fadbdb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Browse shapes"
          >
            <Icon name="category" size="md" className="text-[#3d0000]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#3d0000]">
              Shapes
            </span>
          </button>
        </div>
      </section>

      <section className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Lines &amp; Dividers
        </h3>
        <p className="text-xs text-[#7d6161] leading-snug">
          Click to add. Drag to move, resize from the corners.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {DIVIDERS.map((divider) => {
            const previewDataUri = divider.build(PREVIEW_STROKE)
            return (
              <button
                key={divider.id}
                type="button"
                onClick={() => onInsertDivider(divider.build(templateTextColor))}
                className="group relative aspect-[3/1] rounded-md border border-[#dbc1bc]/30 bg-white hover:bg-[#fadbdb] transition-colors flex items-center justify-center px-2 py-1"
                aria-label={`Add ${divider.label} divider`}
                title={divider.label}
              >
                {/* Preview stroke is PREVIEW_STROKE for tile legibility; the
                    actual insert uses templateTextColor (baked at click time)
                    so the placed divider matches the active template tone. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewDataUri}
                  alt=""
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
                <span className="absolute -bottom-4 left-0 right-0 text-[9px] uppercase tracking-wide text-[#7d6161] opacity-0 group-hover:opacity-100 transition-opacity text-center">
                  {divider.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {slideLevelCards}
    </div>
  )
}
