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
import type { Decoration } from '@/lib/types/decoration'
import type { Slide } from '@/lib/types/slide'
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
  /** Active template's text color — baked into every inserted divider. */
  templateTextColor: string
  /** Caller dispatches ADD_CUSTOM_IMAGE with the data URI + centered defaults. */
  onInsertDivider: (dataUri: string) => void
  /** When set, the panel renders DecorationCard for this decoration in place
   *  of the library. Mirrors the TextEditorPanel CARD-01 contract. */
  activeDecoration?: Decoration | null
  /** Dispatches UPDATE_DECORATION for the active decoration. */
  onDecorationUpdate?: (updates: Partial<Decoration>) => void
  /** Dispatches REMOVE_DECORATION for the active decoration + clears selection. */
  onDecorationRemove?: () => void
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
  templateTextColor,
  onInsertDivider,
  activeDecoration,
  onDecorationUpdate,
  onDecorationRemove,
  onSwapIcon,
  onBackToLibrary,
  onOpenIconPicker,
  onOpenShapePicker,
  brandKit,
  derivedPalette,
}: ElementsPanelProps) {
  // `slide` is taken for consistency with sibling panels (TextEditorPanel,
  // ImagePickerPanel both receive `slide`). The current implementation only
  // needs derivedPalette + brandKit for swatches; the slide reference is
  // forwarded so future slide-aware library behavior (e.g. recently-used
  // icons per slide) can wire in without a prop-signature churn.
  void slide
  // ───────────────────────────────────────────────────────────────────
  // Selection mode — a decoration is currently selected on the canvas.
  // Render the inspector card so the user can edit + delete it here.
  // ───────────────────────────────────────────────────────────────────
  if (activeDecoration) {
    const isIcon = activeDecoration.kind === 'icon'
    return (
      <div className="p-4 space-y-3">
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
          brandKit={brandKit}
          derivedPalette={derivedPalette}
        />
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────
  // Library mode — no decoration selected. Show the insert tiles.
  // ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-6">
      {/* Icons + shapes — open the existing pickers wired in slide-editor. */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="apps" size="sm" className="text-[#3d0000]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#3d0000]">
            Icons &amp; Shapes
          </h3>
        </div>
        <p className="text-xs text-[#7d6161] mb-3 leading-snug">
          Click to browse — pick one to insert at slide center.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenIconPicker?.()}
            disabled={!onOpenIconPicker}
            data-testid="elements-panel-open-icons"
            className="flex flex-col items-center justify-center gap-1.5 aspect-square rounded-md border border-[#dbc1bc]/40 bg-[#fdf7f2] hover:bg-[#fff0f0] hover:border-[#3d0000]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="flex flex-col items-center justify-center gap-1.5 aspect-square rounded-md border border-[#dbc1bc]/40 bg-[#fdf7f2] hover:bg-[#fff0f0] hover:border-[#3d0000]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Browse shapes"
          >
            <Icon name="category" size="md" className="text-[#3d0000]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#3d0000]">
              Shapes
            </span>
          </button>
        </div>
      </section>

      <section className="pt-4 border-t border-[#dbc1bc]/20">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="horizontal_rule" size="sm" className="text-[#3d0000]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#3d0000]">
            Lines &amp; Dividers
          </h3>
        </div>
        <p className="text-xs text-[#7d6161] mb-3 leading-snug">
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
                className="group relative aspect-[3/1] rounded-md border border-[#dbc1bc]/40 bg-[#fdf7f2] hover:bg-[#fff0f0] hover:border-[#3d0000]/40 transition-colors flex items-center justify-center px-2 py-1"
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
    </div>
  )
}
