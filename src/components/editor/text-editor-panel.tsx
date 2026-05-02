'use client'

import { Icon } from '@/components/ui/icon'
import { FontPicker } from './font-picker'
import { TextEffectsControls } from './text-effects-controls'
import { LayerStrip } from './text-rail/LayerStrip'
import { ActiveTextBoxCard } from './text-rail/ActiveTextBoxCard'
import { SlideSettings } from './text-rail/SlideSettings'
import { COLOR_SWATCHES } from './text-rail/color-swatches'
import { PhotoTreatmentControls, type TreatmentSpec } from './photo-treatment-controls'
import { WatermarkControls, type WatermarkSpec } from './watermark-controls'
import type { Slide, CustomText, TextBox } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

/**
 * Phase 50 (D-10): TextEditorPanel is now a composition shell that mounts
 * LayerStrip → ActiveTextBoxCard → SlideSettings → CustomTextEditor (when
 * a free-positioned custom text is selected on the canvas).
 *
 * Selection lives OUTSIDE the reducer in React state (Phase 49 D-16) and
 * arrives via `selectedTextBoxId`. To swap selection, parent passes
 * `onSelectTextBox`. To dispatch ADD/UPDATE/REMOVE_TEXT_BOX into the
 * reducer, parent passes `onTextBoxAction` — the parent resolves
 * `slideIndex` from its own `selectedIndex`.
 *
 * Slide-level edits (overlay, news layout, watermark) still flow through
 * the existing `onUpdate` prop unchanged.
 */
export type TextBoxAction =
  | { type: 'ADD_TEXT_BOX'; role: TextBox['role'] }
  | { type: 'UPDATE_TEXT_BOX'; textBoxId: string; updates: Partial<TextBox> }
  | { type: 'REMOVE_TEXT_BOX'; textBoxId: string }

export interface TextEditorPanelProps {
  slide: Slide
  template: SlideTemplate
  /** Phase 50 — current selection from useSlideEditor React state. */
  selectedTextBoxId: string | null
  /** Phase 50 — swap selection (calls setSelectedTextBoxId at parent). */
  onSelectTextBox: (textBoxId: string | null) => void
  /** Phase 50 — dispatches ADD/UPDATE/REMOVE_TEXT_BOX. Parent injects slideIndex. */
  onTextBoxAction: (action: TextBoxAction) => void
  /** Existing — slide-level updates (overlay, news layout, watermark). */
  onUpdate: (updates: Partial<Slide>) => void
  // Existing custom-text editor surface (free-positioned text box selected on canvas).
  // Preserved for Phase 50 — Phase 52 will reduce this surface as canvas selection
  // unifies with the LayerStrip flow.
  selectedCustomTextId?: string | null
  customTexts?: CustomText[]
  onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void
  onCustomTextRemove?: (id: string) => void
  brandKit?: BrandKit | null
  /** Phase 57 (D-08, D-29): per-slide photo-treatment override callback. Optional —
      when omitted, PhotoTreatmentControls renders read-only. */
  onSlideTreatmentChange?: (spec: TreatmentSpec) => void
  /** Phase 57: spinner state from useTransition() at the parent (slide-editor). */
  isTreatmentPending?: boolean
  /** quick-260502-er5: per-slide watermark override callback. Optional — when
      omitted, WatermarkControls renders read-only. */
  userTier?: 'free' | 'plus' | 'pro'
  onSlideWatermarkChange?: (spec: WatermarkSpec) => void
  onWatermarkLogoUpload?: (file: File) => void
  onWatermarkLogoRemove?: () => void
  isWatermarkPending?: boolean
}

export function TextEditorPanel({
  slide,
  template,
  selectedTextBoxId,
  onSelectTextBox,
  onTextBoxAction,
  onUpdate,
  selectedCustomTextId,
  customTexts,
  onCustomTextUpdate,
  onCustomTextRemove,
  brandKit,
  onSlideTreatmentChange,
  isTreatmentPending,
  userTier = 'free',
  onSlideWatermarkChange,
  onWatermarkLogoUpload,
  onWatermarkLogoRemove,
  isWatermarkPending,
}: TextEditorPanelProps) {
  const textBoxes = slide.text_boxes ?? []

  // Resolve the active TextBox: prefer the explicitly selected one, fall
  // back to the first box if selection is stale, else null (empty state).
  const activeTextBox =
    textBoxes.find((tb) => tb.id === selectedTextBoxId) ?? textBoxes[0] ?? null

  function updateActiveTextBox(updates: Partial<TextBox>) {
    if (!activeTextBox) return
    onTextBoxAction({
      type: 'UPDATE_TEXT_BOX',
      textBoxId: activeTextBox.id,
      updates,
    })
  }

  // Custom-text editor surface (free-positioned text box selected on canvas).
  // Resolved here so the section only renders when there's something to edit.
  const selectedCustomText = selectedCustomTextId
    ? (customTexts ?? []).find((ct) => ct.id === selectedCustomTextId)
    : null

  return (
    <div className="flex flex-col gap-4 p-6 bg-[#fff0f0]" data-testid="text-editor-panel">
      <LayerStrip
        textBoxes={textBoxes}
        selectedTextBoxId={selectedTextBoxId}
        onSelect={onSelectTextBox}
        onAdd={() => onTextBoxAction({ type: 'ADD_TEXT_BOX', role: 'custom' })}
      />

      <ActiveTextBoxCard
        textBox={activeTextBox}
        onUpdate={updateActiveTextBox}
        template={template}
        brandKit={brandKit}
      />

      <SlideSettings
        slide={slide}
        template={template}
        onUpdate={onUpdate}
        brandKit={brandKit}
      />

      <PhotoTreatmentControls
        slide={slide}
        template={template}
        isPending={isTreatmentPending ?? false}
        onTreatmentChange={onSlideTreatmentChange}
      />

      <WatermarkControls
        slide={slide}
        userTier={userTier}
        isPending={isWatermarkPending ?? false}
        onWatermarkChange={onSlideWatermarkChange}
        onCustomLogoUpload={onWatermarkLogoUpload}
        onCustomLogoRemove={onWatermarkLogoRemove}
      />

      {selectedCustomText && onCustomTextUpdate && onCustomTextRemove && (
        <CustomTextEditor
          customText={selectedCustomText}
          template={template}
          onUpdate={(updates) => onCustomTextUpdate(selectedCustomText.id, updates)}
          onRemove={() => onCustomTextRemove(selectedCustomText.id)}
        />
      )}
    </div>
  )
}

/**
 * Phase 50 (D-18): the existing custom-text editor block from the legacy
 * panel preserved verbatim — handles selection of free-positioned text boxes
 * from the canvas. Phase 52 will reduce this surface (canvas click-to-select
 * will go through the LayerStrip flow), but for v2.8 the canvas still talks
 * to this section directly via `selectedCustomTextId`.
 *
 * Salvaged from text-editor-panel-legacy.tsx lines 508-666.
 */
function CustomTextEditor({
  customText,
  template,
  onUpdate,
  onRemove,
}: {
  customText: CustomText
  template: SlideTemplate
  onUpdate: (updates: Partial<CustomText>) => void
  onRemove: () => void
}) {
  return (
    <div
      className="space-y-4 border-t border-[#dbc1bc]/20 pt-6"
      data-testid="custom-text-editor"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Custom Text
        </span>
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Size
          </span>
          <span className="text-[10px] font-bold text-[#3d0000]">
            {customText.font_size ?? 48}
          </span>
        </div>
        <input
          type="range"
          min={16}
          max={120}
          step={2}
          value={customText.font_size ?? 48}
          onChange={(e) => onUpdate({ font_size: Number(e.target.value) })}
          className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
        />
      </div>

      {/* Color */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Color
        </span>
        <div className="flex gap-3">
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              onClick={() => onUpdate({ color })}
              className={`w-6 h-6 rounded-full ${
                (customText.color ?? '#ffffff') === color
                  ? 'ring-2 ring-[#3d0000] ring-offset-1'
                  : ''
              }`}
              style={{
                backgroundColor: color,
                border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined,
              }}
              title={color}
            />
          ))}
          <label className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer">
            <Icon name="palette" size="sm" className="text-[#7d6161]" />
            <input
              type="color"
              value={customText.color ?? '#ffffff'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {/* Bold / Italic */}
      <div className="flex gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] self-center mr-1">
          Style
        </span>
        <button
          onClick={() =>
            onUpdate({
              font_weight: (customText.font_weight ?? 400) >= 700 ? 400 : 700,
            })
          }
          className={`p-2 rounded-lg transition-all ${
            (customText.font_weight ?? 400) >= 700
              ? 'bg-[#3d0000] text-white'
              : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
          }`}
          title="Bold"
        >
          <Icon name="format_bold" size="sm" />
        </button>
        <button
          onClick={() =>
            onUpdate({
              font_style: customText.font_style === 'italic' ? 'normal' : 'italic',
            })
          }
          className={`p-2 rounded-lg transition-all ${
            customText.font_style === 'italic'
              ? 'bg-[#3d0000] text-white'
              : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
          }`}
          title="Italic"
        >
          <Icon name="format_italic" size="sm" />
        </button>
      </div>

      {/* Text Align */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Align
        </span>
        <div className="flex gap-2">
          {(
            [
              { value: 'left', icon: 'format_align_left' },
              { value: 'center', icon: 'format_align_center' },
              { value: 'right', icon: 'format_align_right' },
            ] as const
          ).map(({ value, icon }) => (
            <button
              key={value}
              onClick={() => onUpdate({ text_align: value })}
              className={`p-2 rounded-lg transition-all ${
                (customText.text_align ?? 'left') === value
                  ? 'bg-[#3d0000] text-white'
                  : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
              }`}
              title={value}
            >
              <Icon name={icon} size="sm" />
            </button>
          ))}
        </div>
      </div>

      {/* Font Picker */}
      <FontPicker
        value={customText.font_family}
        onChange={(family) => onUpdate({ font_family: family || undefined })}
        templateFont={template.fontFamily}
      />

      <TextEffectsControls
        effects={customText.text_effects}
        onChange={(ctFx) => onUpdate({ text_effects: ctFx })}
      />

      {/* Delete */}
      <button
        onClick={onRemove}
        className="w-full py-2 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
      >
        <Icon name="delete" size="sm" />
        Delete Text Box
      </button>
    </div>
  )
}
