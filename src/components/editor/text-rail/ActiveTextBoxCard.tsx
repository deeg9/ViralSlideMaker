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
  /** quick-260514-textbox-numeric-labels: 1-indexed position in the slide's
   *  text_boxes array. Used to render "TEXT BOX 1" / "TEXT BOX 2" / etc.
   *  in the role-label slot instead of the legacy "HOOK TEXT" / "BODY TEXT"
   *  per-role copy. Parent (TextEditorPanel) computes the index. */
  textBoxNumber?: number | null
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

function textBoxLabel(number: number | null | undefined): string {
  // quick-260514-textbox-numeric-labels: every box gets "TEXT BOX N" by
  // 1-indexed position. Falls back to plain "TEXT BOX" when the parent
  // can't resolve a position (defensive — typically only the empty-state
  // path passes null).
  return typeof number === 'number' && number > 0 ? `TEXT BOX ${number}` : 'TEXT BOX'
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
  textBoxNumber,
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

  // quick-260502-pw8: list type + indent helpers. list_type undefined = plain
  // text; setting clears any indent at level 0 (no-op for the user). Indent
  // clamps to 0..2 inclusive — enforced both here and at render time.
  const listType = textBox.list_type
  const listIndent = Math.max(0, Math.min(2, Math.floor(textBox.list_indent ?? 0)))
  function setListType(next: 'numbered' | 'bulleted' | undefined) {
    onUpdate({ list_type: next })
  }
  function bumpIndent(delta: 1 | -1) {
    const nextIndent = Math.max(0, Math.min(2, listIndent + delta))
    if (nextIndent === listIndent) return
    onUpdate({ list_indent: nextIndent })
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
          {textBoxLabel(textBoxNumber)}
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
          aria-label={textBoxLabel(textBoxNumber)}
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

      {/* Font size — quick-260514-text-rail-cleanup: replaces the old "Hook size"
          slider. Sits directly under the FontPicker so it visually pairs with
          Font (Word / Canva pattern). Min/max mirror the old slider ranges so
          existing fixtures stay in-range; commit on every change still pushes
          one history entry per dispatch (KBD-09 unchanged). */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Font size
        </span>
        <input
          type="number"
          data-testid="active-text-box-size"
          aria-label="Font size"
          min={textBox.role === 'body' ? 14 : 16}
          max={textBox.role === 'body' ? 120 : 240}
          step={1}
          value={textBox.font_size ?? defaultSizeForRole(textBox.role, template)}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isFinite(n)) return
            onUpdate({ font_size: n })
          }}
          className={`w-24 bg-white border border-[#dbc1bc]/30 focus:border-[#3d0000] rounded-lg px-3 py-2 text-sm text-[#3d0000] tabular-nums focus:outline-none ${FOCUS_RING}`}
        />
      </div>

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

      {/* List row (quick-260502-pw8). Three-way segmented control for list_type.
          Behaves like Word / Figma / Canva: each line of `text` (\n-separated)
          becomes a list item with a literal-text marker prefix in both renderers. */}
      <div className="flex gap-2 items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mr-1">
          List
        </span>
        <button
          type="button"
          data-testid="active-text-box-list-none"
          data-active={!listType ? 'true' : 'false'}
          onClick={() => setListType(undefined)}
          className={`p-2 rounded-lg transition-all ${FOCUS_RING} ${
            !listType
              ? 'bg-[#3d0000] text-white'
              : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
          }`}
          aria-label="No list"
          aria-pressed={!listType}
          title="No list"
        >
          <Icon name="format_align_left" size="sm" />
        </button>
        <button
          type="button"
          data-testid="active-text-box-list-numbered"
          data-active={listType === 'numbered' ? 'true' : 'false'}
          onClick={() => setListType('numbered')}
          className={`p-2 rounded-lg transition-all ${FOCUS_RING} ${
            listType === 'numbered'
              ? 'bg-[#3d0000] text-white'
              : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
          }`}
          aria-label="Numbered list"
          aria-pressed={listType === 'numbered'}
          title="Numbered list"
        >
          <Icon name="format_list_numbered" size="sm" />
        </button>
        <button
          type="button"
          data-testid="active-text-box-list-bulleted"
          data-active={listType === 'bulleted' ? 'true' : 'false'}
          onClick={() => setListType('bulleted')}
          className={`p-2 rounded-lg transition-all ${FOCUS_RING} ${
            listType === 'bulleted'
              ? 'bg-[#3d0000] text-white'
              : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
          }`}
          aria-label="Bulleted list"
          aria-pressed={listType === 'bulleted'}
          title="Bulleted list"
        >
          <Icon name="format_list_bulleted" size="sm" />
        </button>
      </div>

      {/* Indent row — moved below List per quick-260514-text-rail-cleanup so
          the two controls stack vertically instead of wrapping onto one
          ambiguous flex row. */}
      <div className="flex gap-2 items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mr-1">
          Indent
        </span>
        <button
          type="button"
          data-testid="active-text-box-indent-decrease"
          onClick={() => bumpIndent(-1)}
          disabled={listIndent <= 0}
          className={`p-2 rounded-lg transition-all bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb] disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`}
          aria-label="Decrease indent"
          title="Decrease indent"
        >
          <Icon name="format_indent_decrease" size="sm" />
        </button>
        <button
          type="button"
          data-testid="active-text-box-indent-increase"
          onClick={() => bumpIndent(1)}
          disabled={listIndent >= 2}
          className={`p-2 rounded-lg transition-all bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb] disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`}
          aria-label="Increase indent"
          title="Increase indent"
        >
          <Icon name="format_indent_increase" size="sm" />
        </button>
        <span className="text-[10px] font-bold text-[#3d0000] tabular-nums" data-testid="active-text-box-indent-level">
          {listIndent}
        </span>
      </div>

      {/* Highlight words (collapsed by default) — chips render only when
          there's actual text. Empty text → 0 segments → component skips. */}
      {segments.length > 0 && (
        <AccentWordsDisclosure
          segments={segments}
          onToggle={toggleAccent}
          // quick-260514-laa: prefer the box-level override; fall back to the
          // template default. The disclosure's chip wall + new color row both
          // read from this single resolved value.
          accentColor={textBox.accent_color ?? accentColor}
          onChangeAccentColor={(hex) => onUpdate({ accent_color: hex })}
        />
      )}

      {/* quick-260514-text-rail-cleanup: BoldWordsDisclosure removed per user
          request — the per-segment bold-toggle chip surface was adding noise
          without clear user value. Per-segment styling is still reachable via
          the AccentWordsDisclosure highlight path, and the global Bold toggle
          (Style row) still flips font_weight 400 ↔ 700 for the whole box.
          The old "Hook size" slider that sat here moved up to a numeric
          "Font size" input under the FontPicker. */}

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
