'use client'

import { Icon } from '@/components/ui/icon'
import { FontPicker } from '@/components/editor/font-picker'
import { EffectRow } from './EffectRow'
import { AccentWordsDisclosure } from './AccentWordsDisclosure'
import { COLOR_SWATCHES } from './color-swatches'
import { splitToSegments } from '@/lib/editor/text-segments'

// Phase 50 (UI-REVIEW BLOCKER + WARNINGs): keyboard focus ring + general a11y
// classes shared by every interactive control inside the card. Browser default
// outlines are clipped by rounded-full / rounded-lg shapes; an explicit
// focus-visible ring matching the brand primary fixes both contrast and shape.
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1'
import type {
  TextBox,
  TextEffects,
  TextSegment,
  TextShadowEffect,
  TextOutlineEffect,
  TextHighlightEffect,
} from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

interface ActiveTextBoxCardProps {
  textBox: TextBox | null
  onUpdate: (updates: Partial<TextBox>) => void
  template: SlideTemplate
  brandKit?: BrandKit | null
}

const DEFAULT_SHADOW: TextShadowEffect = {
  enabled: true,
  color: '#00000099',
  size: 'md',
}
const DEFAULT_OUTLINE: TextOutlineEffect = {
  enabled: true,
  color: '#000000',
  width: 2,
}
const DEFAULT_HIGHLIGHT: TextHighlightEffect = {
  enabled: true,
  color: '#00000088',
  style: 'tight',
  padding: 8,
}

function roleLabel(role: TextBox['role']): string {
  switch (role) {
    case 'hook':
      return 'HOOK TEXT'
    case 'body':
      return 'BODY TEXT'
    case 'custom':
    default:
      return 'TEXT BOX'
  }
}

function sizeLabel(role: TextBox['role']): string {
  switch (role) {
    case 'hook':
      return 'Hook size'
    case 'body':
      return 'Body size'
    case 'custom':
    default:
      return 'Size'
  }
}

/**
 * Phase 50 (D-03/D-04): a single bordered card that mirrors only the active
 * TextBox's properties. Section order top-to-bottom: role label → textarea →
 * font picker → bold/italic style → AccentWordsDisclosure → size slider →
 * color swatches → align row → "Effects" subhead → 3× EffectRow.
 *
 * The card uses `bg-white border-2 border-[#3d0000]/20 focus-within:border-[#3d0000]`
 * so the editable surface visually pops from the cream `#fff0f0` panel
 * background (D-03).
 *
 * Empty state (Plan 50-02 T-05): when `textBox` is null (no selection),
 * renders a dashed placeholder card directing the user to add a text box.
 */
export function ActiveTextBoxCard({
  textBox,
  onUpdate,
  template,
  brandKit: _brandKit,
}: ActiveTextBoxCardProps) {
  if (!textBox) {
    return (
      <div
        className="bg-[#fff0f0] border-2 border-dashed border-[#fadbdb] rounded-2xl p-8 text-center text-[#7d6161]"
        data-testid="active-text-box-card-empty"
      >
        <p className="text-sm">No text box selected</p>
        <p className="text-xs mt-1">Click &ldquo;+ Add Text Box&rdquo; above to start</p>
      </div>
    )
  }

  const effects: TextEffects = textBox.effects ?? {}
  const segments: TextSegment[] = textBox.segments ?? splitToSegments(textBox.text)
  const accentColor = template.accentColor ?? '#3d0000'
  const currentColor =
    textBox.color ?? template.textColor

  const isBold = (textBox.font_weight ?? 400) >= 700
  const isItalic = textBox.font_style === 'italic'

  function setEffects(next: TextEffects) {
    onUpdate({ effects: next })
  }

  function setShadow(partial: Partial<TextShadowEffect>) {
    setEffects({
      ...effects,
      shadow: {
        ...(effects.shadow ?? DEFAULT_SHADOW),
        ...partial,
      },
    })
  }

  function setOutline(partial: Partial<TextOutlineEffect>) {
    setEffects({
      ...effects,
      outline: {
        ...(effects.outline ?? DEFAULT_OUTLINE),
        ...partial,
      },
    })
  }

  function setHighlight(partial: Partial<TextHighlightEffect>) {
    setEffects({
      ...effects,
      highlight: {
        ...(effects.highlight ?? DEFAULT_HIGHLIGHT),
        ...partial,
      },
    })
  }

  function toggleAccent(index: number) {
    const next = segments.map((s, i) =>
      i === index ? { ...s, accent: !s.accent } : s,
    )
    onUpdate({ segments: next })
  }

  return (
    <div
      className="bg-white border-2 border-[#3d0000]/20 focus-within:border-[#3d0000] rounded-2xl p-5 space-y-4 transition-colors"
      data-testid="active-text-box-card"
      data-role={textBox.role}
    >
      {/* Role label */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]"
          data-testid="active-text-box-role-label"
        >
          {roleLabel(textBox.role)}
        </span>
      </div>

      {/* Textarea — segments cleared on text edit (mirrors current panel
          behavior at text-editor-panel.tsx:99). Without this, edits leave
          stale per-word accents that mismatch the new word boundaries. */}
      <div className="relative">
        <textarea
          data-testid="active-text-box-textarea"
          value={textBox.text}
          onChange={(e) => onUpdate({ text: e.target.value, segments: undefined })}
          rows={textBox.role === 'body' ? 4 : 3}
          aria-label={roleLabel(textBox.role)}
          className={`w-full bg-white border border-[#dbc1bc]/30 focus:border-[#3d0000] rounded-xl p-4 text-sm text-[#3d0000] leading-relaxed resize-none ${FOCUS_RING}`}
          placeholder={textBox.role === 'hook' ? 'Enter headline...' : 'Enter text...'}
        />
      </div>

      {/* Font row */}
      <FontPicker
        value={textBox.font_family}
        onChange={(family) => onUpdate({ font_family: family || undefined })}
        templateFont={template.fontFamily}
      />

      {/* Style row: Bold + Italic */}
      <div className="flex gap-2 items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mr-1">
          Style
        </span>
        <button
          type="button"
          data-testid="active-text-box-bold"
          data-active={isBold ? 'true' : 'false'}
          onClick={() => onUpdate({ font_weight: isBold ? 400 : 700 })}
          className={`p-2 rounded-lg transition-all ${FOCUS_RING} ${
            isBold
              ? 'bg-[#3d0000] text-white'
              : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
          }`}
          aria-label="Bold"
          aria-pressed={isBold}
          title="Bold"
        >
          <Icon name="format_bold" size="sm" />
        </button>
        <button
          type="button"
          data-testid="active-text-box-italic"
          data-active={isItalic ? 'true' : 'false'}
          onClick={() => onUpdate({ font_style: isItalic ? 'normal' : 'italic' })}
          className={`p-2 rounded-lg transition-all ${FOCUS_RING} ${
            isItalic
              ? 'bg-[#3d0000] text-white'
              : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
          }`}
          aria-label="Italic"
          aria-pressed={isItalic}
          title="Italic"
        >
          <Icon name="format_italic" size="sm" />
        </button>
      </div>

      {/* Highlight words (collapsed by default) — chips render only when
          there's actual text. Empty text → 0 segments → component skips. */}
      {segments.length > 0 && (
        <AccentWordsDisclosure
          segments={segments}
          onToggle={toggleAccent}
          accentColor={accentColor}
        />
      )}

      {/* Size slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            {sizeLabel(textBox.role)}
          </span>
          <span className="text-[10px] font-bold text-[#3d0000]">
            {textBox.font_size ?? defaultSizeForRole(textBox.role, template)}
          </span>
        </div>
        <input
          type="range"
          data-testid="active-text-box-size"
          min={textBox.role === 'body' ? 14 : 16}
          max={textBox.role === 'body' ? 56 : 96}
          step={2}
          value={textBox.font_size ?? defaultSizeForRole(textBox.role, template)}
          onChange={(e) => onUpdate({ font_size: Number(e.target.value) })}
          aria-label={sizeLabel(textBox.role)}
          className={`w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000] ${FOCUS_RING}`}
        />
      </div>

      {/* Color swatches */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Color
        </span>
        <div className="flex gap-3">
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              data-testid={`active-text-box-swatch-${color}`}
              onClick={() => onUpdate({ color })}
              className={`w-6 h-6 rounded-full ${FOCUS_RING} ${
                currentColor === color ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
              }`}
              style={{
                backgroundColor: color,
                border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined,
              }}
              aria-label={`Set text color to ${color}`}
              aria-pressed={currentColor === color}
              title={color}
            />
          ))}
          <label className={`w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1`}>
            <Icon name="palette" size="sm" className="text-[#7d6161]" aria-hidden />
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onUpdate({ color: e.target.value })}
              aria-label="Set custom text color"
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {/* Align row */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Align
        </span>
        <div className="flex gap-2">
          {([
            { value: 'left', icon: 'format_align_left' },
            { value: 'center', icon: 'format_align_center' },
            { value: 'right', icon: 'format_align_right' },
          ] as const).map(({ value, icon }) => {
            const active = (textBox.text_align ?? template.textAlign) === value
            return (
              <button
                key={value}
                type="button"
                data-testid={`active-text-box-align-${value}`}
                data-active={active ? 'true' : 'false'}
                onClick={() => onUpdate({ text_align: value })}
                className={`p-2 rounded-lg transition-all ${FOCUS_RING} ${
                  active
                    ? 'bg-[#3d0000] text-white'
                    : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
                }`}
                aria-label={`Align ${value}`}
                aria-pressed={active}
                title={value}
              >
                <Icon name={icon} size="sm" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Effects subhead */}
      <div className="pt-2 border-t border-[#fadbdb]">
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]"
          data-testid="active-text-box-effects-subhead"
        >
          Effects
        </span>
      </div>

      {/* Shadow */}
      <EffectRow
        label="Shadow"
        enabled={!!effects.shadow?.enabled}
        onToggle={(on) => setShadow({ enabled: on })}
      >
        <ShadowControls
          shadow={effects.shadow ?? DEFAULT_SHADOW}
          onChange={setShadow}
        />
      </EffectRow>

      {/* Outline */}
      <EffectRow
        label="Outline"
        enabled={!!effects.outline?.enabled}
        onToggle={(on) => setOutline({ enabled: on })}
      >
        <OutlineControls
          outline={effects.outline ?? DEFAULT_OUTLINE}
          onChange={setOutline}
        />
      </EffectRow>

      {/* Highlight */}
      <EffectRow
        label="Highlight"
        enabled={!!effects.highlight?.enabled}
        onToggle={(on) => setHighlight({ enabled: on })}
      >
        <HighlightControls
          highlight={effects.highlight ?? DEFAULT_HIGHLIGHT}
          onChange={setHighlight}
        />
      </EffectRow>
    </div>
  )
}

function defaultSizeForRole(role: TextBox['role'], template: SlideTemplate): number {
  if (role === 'hook') return parseInt(template.hookFontSize) || 48
  if (role === 'body') return parseInt(template.bodyFontSize) || 24
  return 48
}

/**
 * Effect-specific control trios extracted as small inner components so
 * EffectRow stays generic and ActiveTextBoxCard reads top-down.
 *
 * Salvaged from text-effects-controls.tsx (the data shapes are unchanged
 * — only the framing moved from inline to EffectRow children).
 */
function ShadowControls({
  shadow,
  onChange,
}: {
  shadow: TextShadowEffect
  onChange: (partial: Partial<TextShadowEffect>) => void
}) {
  return (
    <>
      <div className="flex gap-3" data-testid="shadow-color-row">
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ color: color + '99' })}
            className={`w-6 h-6 rounded-full ${FOCUS_RING} ${
              shadow.color === color + '99'
                ? 'ring-2 ring-[#3d0000] ring-offset-1'
                : ''
            }`}
            style={{
              backgroundColor: color,
              border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined,
            }}
            aria-label={`Set shadow color to ${color}`}
            aria-pressed={shadow.color === color + '99'}
            title={color}
          />
        ))}
        <label className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1">
          <Icon name="palette" size="sm" className="text-[#7d6161]" aria-hidden />
          <input
            type="color"
            value={shadow.color.slice(0, 7)}
            onChange={(e) => onChange({ color: e.target.value + '99' })}
            aria-label="Set custom shadow color"
            className="sr-only"
          />
        </label>
      </div>
      <div className="flex gap-2">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <button
            key={size}
            type="button"
            data-testid={`shadow-size-${size}`}
            onClick={() => onChange({ size })}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${FOCUS_RING} ${
              shadow.size === size
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
            aria-label={`Shadow size ${size === 'sm' ? 'small' : size === 'md' ? 'medium' : 'large'}`}
            aria-pressed={shadow.size === size}
          >
            {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
          </button>
        ))}
      </div>
    </>
  )
}

function OutlineControls({
  outline,
  onChange,
}: {
  outline: TextOutlineEffect
  onChange: (partial: Partial<TextOutlineEffect>) => void
}) {
  return (
    <>
      <div className="flex gap-3" data-testid="outline-color-row">
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ color })}
            className={`w-6 h-6 rounded-full ${FOCUS_RING} ${
              outline.color === color ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
            }`}
            style={{
              backgroundColor: color,
              border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined,
            }}
            aria-label={`Set outline color to ${color}`}
            aria-pressed={outline.color === color}
            title={color}
          />
        ))}
        <label className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1">
          <Icon name="palette" size="sm" className="text-[#7d6161]" aria-hidden />
          <input
            type="color"
            value={outline.color}
            onChange={(e) => onChange({ color: e.target.value })}
            aria-label="Set custom outline color"
            className="sr-only"
          />
        </label>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Thickness
          </span>
          <span className="text-[10px] font-bold text-[#3d0000]">{outline.width}px</span>
        </div>
        <input
          type="range"
          data-testid="outline-width"
          min={1}
          max={8}
          step={1}
          value={outline.width}
          onChange={(e) => onChange({ width: Number(e.target.value) })}
          aria-label="Outline thickness"
          className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1"
        />
      </div>
    </>
  )
}

function HighlightControls({
  highlight,
  onChange,
}: {
  highlight: TextHighlightEffect
  onChange: (partial: Partial<TextHighlightEffect>) => void
}) {
  return (
    <>
      <div className="flex gap-3" data-testid="highlight-color-row">
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ color: color + '88' })}
            className={`w-6 h-6 rounded-full ${FOCUS_RING} ${
              highlight.color === color + '88'
                ? 'ring-2 ring-[#3d0000] ring-offset-1'
                : ''
            }`}
            style={{
              backgroundColor: color,
              border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined,
            }}
            aria-label={`Set highlight color to ${color}`}
            aria-pressed={highlight.color === color + '88'}
            title={color}
          />
        ))}
        <label className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1">
          <Icon name="palette" size="sm" className="text-[#7d6161]" aria-hidden />
          <input
            type="color"
            value={highlight.color.slice(0, 7)}
            onChange={(e) => onChange({ color: e.target.value + '88' })}
            aria-label="Set custom highlight color"
            className="sr-only"
          />
        </label>
      </div>
      <div className="flex gap-2">
        {(['tight', 'full'] as const).map((style) => (
          <button
            key={style}
            type="button"
            data-testid={`highlight-style-${style}`}
            onClick={() => onChange({ style })}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${FOCUS_RING} ${
              highlight.style === style
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
            aria-label={`Highlight style ${style}`}
            aria-pressed={highlight.style === style}
          >
            {style === 'tight' ? 'Tight' : 'Full'}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Padding
          </span>
          <span className="text-[10px] font-bold text-[#3d0000]">{highlight.padding}px</span>
        </div>
        <input
          type="range"
          data-testid="highlight-padding"
          min={4}
          max={24}
          step={2}
          value={highlight.padding}
          onChange={(e) => onChange({ padding: Number(e.target.value) })}
          aria-label="Highlight padding"
          className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1"
        />
      </div>
    </>
  )
}
