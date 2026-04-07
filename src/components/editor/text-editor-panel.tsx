'use client'

import { Icon } from '@/components/ui/icon'
import { FontPicker } from './font-picker'
import { TextEffectsControls } from './text-effects-controls'
import type { Slide, CustomText } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

interface TextEditorPanelProps {
  slide: Slide
  template: SlideTemplate
  onUpdate: (updates: Partial<Slide>) => void
  selectedCustomTextId?: string | null
  customTexts?: CustomText[]
  onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void
  onCustomTextRemove?: (id: string) => void
}

const colorSwatches = ['#ffffff', '#3d0000', '#7d6161', '#fadbdb']

export function TextEditorPanel({
  slide, template, onUpdate,
  selectedCustomTextId, customTexts,
  onCustomTextUpdate, onCustomTextRemove,
}: TextEditorPanelProps) {
  const overrides = slide.style_overrides ?? {}

  const selectedCustomText = selectedCustomTextId
    ? (customTexts ?? []).find((ct) => ct.id === selectedCustomTextId)
    : null

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="text-editor-panel">
      {/* Hook Text */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Hook Text</label>
        <div className="relative">
          <textarea
            value={slide.hook_text}
            onChange={(e) => onUpdate({ hook_text: e.target.value })}
            rows={3}
            className="w-full bg-white border-none border-b border-[#dbc1bc]/30 focus:border-[#3d0000] focus:ring-0 rounded-xl p-4 text-sm text-[#3d0000] leading-relaxed resize-none"
            placeholder="Enter headline..."
          />
          <button className="absolute bottom-3 right-3 p-1 text-[#dbc1bc] hover:text-[#3d0000] transition-colors" title="AI rewrite">
            <Icon name="auto_awesome" size="sm" />
          </button>
        </div>
        <FontPicker
          value={overrides.hook_font_family}
          onChange={(family) => onUpdate({
            style_overrides: { ...overrides, hook_font_family: family || undefined }
          })}
          templateFont={template.fontFamily}
        />
        {/* Hook Style: Bold / Italic */}
        <div className="flex gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] self-center mr-1">Style</span>
          <button
            onClick={() => {
              // Hook default is 900 (extra-bold). Bold toggle: 900 <-> 400
              const currentWeight = overrides.hook_font_weight ?? 900
              const isBold = currentWeight >= 700
              onUpdate({
                style_overrides: {
                  ...overrides,
                  hook_font_weight: isBold ? 400 : 900,
                },
              })
            }}
            className={`p-2 rounded-lg transition-all ${
              (overrides.hook_font_weight ?? 900) >= 700
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
                style_overrides: {
                  ...overrides,
                  hook_font_style: overrides.hook_font_style === 'italic' ? undefined : 'italic',
                },
              })
            }
            className={`p-2 rounded-lg transition-all ${
              overrides.hook_font_style === 'italic'
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
            title="Italic"
          >
            <Icon name="format_italic" size="sm" />
          </button>
        </div>
        <TextEffectsControls
          effects={overrides.hook_text_effects}
          onChange={(hookFx) =>
            onUpdate({
              style_overrides: { ...overrides, hook_text_effects: hookFx },
            })
          }
        />
      </div>

      {/* Body Text */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Body Text</label>
        <textarea
          value={slide.body_text}
          onChange={(e) => onUpdate({ body_text: e.target.value })}
          rows={4}
          className="w-full bg-white border-none border-b border-[#dbc1bc]/30 focus:border-[#3d0000] focus:ring-0 rounded-xl p-4 text-sm text-[#3d0000] leading-relaxed resize-none"
          placeholder="Enter details..."
        />
        <FontPicker
          value={overrides.body_font_family}
          onChange={(family) => onUpdate({
            style_overrides: { ...overrides, body_font_family: family || undefined }
          })}
          templateFont={template.fontFamily}
        />
        {/* Body Style: Bold / Italic */}
        <div className="flex gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] self-center mr-1">Style</span>
          <button
            onClick={() => {
              // Body default is 400 (normal). Bold toggle: 400 <-> 700
              const currentWeight = overrides.body_font_weight ?? 400
              const isBold = currentWeight >= 700
              onUpdate({
                style_overrides: {
                  ...overrides,
                  body_font_weight: isBold ? 400 : 700,
                },
              })
            }}
            className={`p-2 rounded-lg transition-all ${
              (overrides.body_font_weight ?? 400) >= 700
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
                style_overrides: {
                  ...overrides,
                  body_font_style: overrides.body_font_style === 'italic' ? undefined : 'italic',
                },
              })
            }
            className={`p-2 rounded-lg transition-all ${
              overrides.body_font_style === 'italic'
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
            title="Italic"
          >
            <Icon name="format_italic" size="sm" />
          </button>
        </div>
        <TextEffectsControls
          effects={overrides.body_text_effects}
          onChange={(bodyFx) =>
            onUpdate({
              style_overrides: { ...overrides, body_text_effects: bodyFx },
            })
          }
        />
      </div>

      {/* Font Size */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Hook Size</span>
          <span className="text-[10px] font-bold text-[#3d0000]">
            {overrides.hook_font_size ?? template.hookFontSize}
          </span>
        </div>
        <input
          type="range"
          min={16}
          max={72}
          step={2}
          value={overrides.hook_font_size ?? parseInt(template.hookFontSize)}
          onChange={(e) =>
            onUpdate({
              style_overrides: {
                ...overrides,
                hook_font_size: Number(e.target.value),
              },
            })
          }
          className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
        />
      </div>

      {/* Hook Text Color */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Hook Color</span>
        <div className="flex gap-3">
          {colorSwatches.map((color) => (
            <button
              key={color}
              onClick={() =>
                onUpdate({
                  style_overrides: { ...overrides, hook_text_color: color },
                })
              }
              className={`w-6 h-6 rounded-full ${
                (overrides.hook_text_color ?? overrides.text_color ?? template.textColor) === color
                  ? 'ring-2 ring-[#3d0000] ring-offset-1'
                  : ''
              }`}
              style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined }}
              title={color}
            />
          ))}
          <label className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer">
            <Icon name="palette" size="sm" className="text-[#7d6161]" />
            <input
              type="color"
              value={overrides.hook_text_color ?? overrides.text_color ?? template.textColor}
              onChange={(e) =>
                onUpdate({
                  style_overrides: { ...overrides, hook_text_color: e.target.value },
                })
              }
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {/* Body Text Color */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Body Color</span>
        <div className="flex gap-3">
          {colorSwatches.map((color) => (
            <button
              key={color}
              onClick={() =>
                onUpdate({
                  style_overrides: { ...overrides, body_text_color: color },
                })
              }
              className={`w-6 h-6 rounded-full ${
                (overrides.body_text_color ?? overrides.text_color ?? template.textColor) === color
                  ? 'ring-2 ring-[#3d0000] ring-offset-1'
                  : ''
              }`}
              style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined }}
              title={color}
            />
          ))}
          <label className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer">
            <Icon name="palette" size="sm" className="text-[#7d6161]" />
            <input
              type="color"
              value={overrides.body_text_color ?? overrides.text_color ?? template.textColor}
              onChange={(e) =>
                onUpdate({
                  style_overrides: { ...overrides, body_text_color: e.target.value },
                })
              }
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {/* Text Position Presets */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Text Position</span>
        <div className="flex gap-2">
          {([
            { label: 'top', hookY: 12, bodyY: 30 },
            { label: 'center', hookY: 30, bodyY: 48 },
            { label: 'bottom', hookY: 48, bodyY: 62 },
          ] as const).map(({ label, hookY, bodyY }) => (
            <button
              key={label}
              onClick={() =>
                onUpdate({
                  style_overrides: {
                    ...overrides,
                    text_position: label,
                    hook_position: { x: 11, y: hookY },
                    body_position: { x: 11, y: bodyY },
                  },
                })
              }
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                (overrides.text_position ?? template.textPosition) === label
                  ? 'bg-[#3d0000] text-white'
                  : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-[#7d6161]">Drag text on the canvas for custom positioning</p>
      </div>

      {/* Overlay Opacity */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Overlay</span>
          <span className="text-[10px] font-bold text-[#3d0000]">
            {overrides.overlay_opacity ?? Math.round(template.overlayOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={overrides.overlay_opacity ?? Math.round(template.overlayOpacity * 100)}
          onChange={(e) =>
            onUpdate({
              style_overrides: {
                ...overrides,
                overlay_opacity: Number(e.target.value),
              },
            })
          }
          className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
        />
        <p className="text-[9px] text-[#7d6161]">Lower for vivid backgrounds, higher for readable text</p>
      </div>

      {/* Text Alignment */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Text Align</span>
        <div className="flex gap-2">
          {([
            { value: 'left', icon: 'format_align_left' },
            { value: 'center', icon: 'format_align_center' },
            { value: 'right', icon: 'format_align_right' },
          ] as const).map(({ value, icon }) => (
            <button
              key={value}
              onClick={() =>
                onUpdate({
                  style_overrides: { ...overrides, text_align: value },
                })
              }
              className={`p-2 rounded-lg transition-all ${
                (overrides.text_align ?? template.textAlign) === value
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

      {/* Custom Texts Section */}
      {(customTexts ?? []).length > 0 && (
        <div className="space-y-4 border-t border-[#dbc1bc]/20 pt-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Custom Texts</span>
            <span className="text-[9px] bg-[#fadbdb] text-[#3d0000] px-1.5 py-0.5 rounded-full font-bold">
              {(customTexts ?? []).length}
            </span>
          </div>

          {selectedCustomText ? (
            <div className="space-y-4">
              {/* Font Size */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Size</span>
                  <span className="text-[10px] font-bold text-[#3d0000]">
                    {selectedCustomText.font_size ?? 48}
                  </span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={120}
                  step={2}
                  value={selectedCustomText.font_size ?? 48}
                  onChange={(e) =>
                    onCustomTextUpdate?.(selectedCustomText.id, {
                      font_size: Number(e.target.value),
                    })
                  }
                  className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
                />
              </div>

              {/* Color */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Color</span>
                <div className="flex gap-3">
                  {colorSwatches.map((color) => (
                    <button
                      key={color}
                      onClick={() => onCustomTextUpdate?.(selectedCustomText.id, { color })}
                      className={`w-6 h-6 rounded-full ${
                        (selectedCustomText.color ?? '#ffffff') === color
                          ? 'ring-2 ring-[#3d0000] ring-offset-1'
                          : ''
                      }`}
                      style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined }}
                      title={color}
                    />
                  ))}
                  <label className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer">
                    <Icon name="palette" size="sm" className="text-[#7d6161]" />
                    <input
                      type="color"
                      value={selectedCustomText.color ?? '#ffffff'}
                      onChange={(e) =>
                        onCustomTextUpdate?.(selectedCustomText.id, { color: e.target.value })
                      }
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Bold / Italic */}
              <div className="flex gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] self-center mr-1">Style</span>
                <button
                  onClick={() =>
                    onCustomTextUpdate?.(selectedCustomText.id, {
                      font_weight: (selectedCustomText.font_weight ?? 400) >= 700 ? 400 : 700,
                    })
                  }
                  className={`p-2 rounded-lg transition-all ${
                    (selectedCustomText.font_weight ?? 400) >= 700
                      ? 'bg-[#3d0000] text-white'
                      : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
                  }`}
                  title="Bold"
                >
                  <Icon name="format_bold" size="sm" />
                </button>
                <button
                  onClick={() =>
                    onCustomTextUpdate?.(selectedCustomText.id, {
                      font_style: selectedCustomText.font_style === 'italic' ? 'normal' : 'italic',
                    })
                  }
                  className={`p-2 rounded-lg transition-all ${
                    selectedCustomText.font_style === 'italic'
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Align</span>
                <div className="flex gap-2">
                  {([
                    { value: 'left', icon: 'format_align_left' },
                    { value: 'center', icon: 'format_align_center' },
                    { value: 'right', icon: 'format_align_right' },
                  ] as const).map(({ value, icon }) => (
                    <button
                      key={value}
                      onClick={() => onCustomTextUpdate?.(selectedCustomText.id, { text_align: value })}
                      className={`p-2 rounded-lg transition-all ${
                        (selectedCustomText.text_align ?? 'left') === value
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
                value={selectedCustomText.font_family}
                onChange={(family) =>
                  onCustomTextUpdate?.(selectedCustomText.id, {
                    font_family: family || undefined,
                  })
                }
                templateFont={template.fontFamily}
              />

              <TextEffectsControls
                effects={selectedCustomText.text_effects}
                onChange={(ctFx) =>
                  onCustomTextUpdate?.(selectedCustomText.id, { text_effects: ctFx })
                }
              />

              {/* Delete */}
              <button
                onClick={() => onCustomTextRemove?.(selectedCustomText.id)}
                className="w-full py-2 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="delete" size="sm" />
                Delete Text Box
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-[#7d6161]">
              Tap a custom text box on the canvas to edit its style
            </p>
          )}
        </div>
      )}
    </div>
  )
}
