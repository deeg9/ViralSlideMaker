'use client'

import { Icon } from '@/components/ui/icon'
import { FontPicker } from './font-picker'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

interface TextEditorPanelProps {
  slide: Slide
  template: SlideTemplate
  onUpdate: (updates: Partial<Slide>) => void
}

const colorSwatches = ['#ffffff', '#3d0000', '#7d6161', '#fadbdb']

export function TextEditorPanel({ slide, template, onUpdate }: TextEditorPanelProps) {
  const overrides = slide.style_overrides ?? {}

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
            onClick={() =>
              onUpdate({
                style_overrides: {
                  ...overrides,
                  hook_font_weight: overrides.hook_font_weight === 700 ? undefined : 700,
                },
              })
            }
            className={`p-2 rounded-lg transition-all ${
              overrides.hook_font_weight === 700
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
            onClick={() =>
              onUpdate({
                style_overrides: {
                  ...overrides,
                  body_font_weight: overrides.body_font_weight === 700 ? undefined : 700,
                },
              })
            }
            className={`p-2 rounded-lg transition-all ${
              overrides.body_font_weight === 700
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

      {/* Text Color Swatches */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Text Color</span>
        <div className="flex gap-3">
          {colorSwatches.map((color) => (
            <button
              key={color}
              onClick={() =>
                onUpdate({
                  style_overrides: { ...overrides, text_color: color },
                })
              }
              className={`w-8 h-8 rounded-full ${
                (overrides.text_color ?? template.textColor) === color
                  ? 'ring-2 ring-[#3d0000] ring-offset-2'
                  : ''
              }`}
              style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined }}
              title={color}
            />
          ))}
          <label className="w-8 h-8 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer">
            <Icon name="palette" size="sm" className="text-[#7d6161]" />
            <input
              type="color"
              value={overrides.text_color ?? template.textColor}
              onChange={(e) =>
                onUpdate({
                  style_overrides: { ...overrides, text_color: e.target.value },
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
    </div>
  )
}
