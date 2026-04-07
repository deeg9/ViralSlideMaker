'use client'

import { Icon } from '@/components/ui/icon'
import type { TextEffects } from '@/lib/types/slide'

interface TextEffectsControlsProps {
  effects: TextEffects | undefined
  onChange: (effects: TextEffects) => void
}

const colorSwatches = ['#ffffff', '#3d0000', '#7d6161', '#fadbdb']

export function TextEffectsControls({ effects, onChange }: TextEffectsControlsProps) {
  return (
    <div className="space-y-4">
      {/* Shadow */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Shadow</span>
          <button
            onClick={() =>
              onChange({
                ...effects,
                shadow: effects?.shadow
                  ? { ...effects.shadow, enabled: !effects.shadow.enabled }
                  : { enabled: true, color: '#00000099', size: 'md' },
              })
            }
            className={`p-2 rounded-lg transition-all ${
              effects?.shadow?.enabled
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
            title="Toggle shadow"
          >
            <Icon name="shadow" size="sm" />
          </button>
        </div>

        {effects?.shadow?.enabled && (
          <div className="space-y-2 pl-1">
            {/* Shadow Color */}
            <div className="flex gap-3">
              {colorSwatches.map((color) => (
                <button
                  key={color}
                  onClick={() =>
                    onChange({
                      ...effects,
                      shadow: { ...effects.shadow!, color: color + '99' },
                    })
                  }
                  className={`w-6 h-6 rounded-full ${
                    effects.shadow!.color === color + '99'
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
                  value={effects.shadow!.color.slice(0, 7)}
                  onChange={(e) =>
                    onChange({
                      ...effects,
                      shadow: { ...effects.shadow!, color: e.target.value + '99' },
                    })
                  }
                  className="sr-only"
                />
              </label>
            </div>

            {/* Shadow Size */}
            <div className="flex gap-2">
              {(['sm', 'md', 'lg'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() =>
                    onChange({
                      ...effects,
                      shadow: { ...effects.shadow!, size },
                    })
                  }
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    effects.shadow!.size === size
                      ? 'bg-[#3d0000] text-white'
                      : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
                  }`}
                >
                  {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Outline */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Outline</span>
          <button
            onClick={() =>
              onChange({
                ...effects,
                outline: effects?.outline
                  ? { ...effects.outline, enabled: !effects.outline.enabled }
                  : { enabled: true, color: '#000000', width: 2 },
              })
            }
            className={`p-2 rounded-lg transition-all ${
              effects?.outline?.enabled
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
            title="Toggle outline"
          >
            <Icon name="border_color" size="sm" />
          </button>
        </div>

        {effects?.outline?.enabled && (
          <div className="space-y-2 pl-1">
            {/* Outline Color */}
            <div className="flex gap-3">
              {colorSwatches.map((color) => (
                <button
                  key={color}
                  onClick={() =>
                    onChange({
                      ...effects,
                      outline: { ...effects.outline!, color },
                    })
                  }
                  className={`w-6 h-6 rounded-full ${
                    effects.outline!.color === color
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
                  value={effects.outline!.color}
                  onChange={(e) =>
                    onChange({
                      ...effects,
                      outline: { ...effects.outline!, color: e.target.value },
                    })
                  }
                  className="sr-only"
                />
              </label>
            </div>

            {/* Outline Thickness */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Thickness</span>
                <span className="text-[10px] font-bold text-[#3d0000]">{effects.outline!.width}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={effects.outline!.width}
                onChange={(e) =>
                  onChange({
                    ...effects,
                    outline: { ...effects.outline!, width: Number(e.target.value) },
                  })
                }
                className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Highlight */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Highlight</span>
          <button
            onClick={() =>
              onChange({
                ...effects,
                highlight: effects?.highlight
                  ? { ...effects.highlight, enabled: !effects.highlight.enabled }
                  : { enabled: true, color: '#00000088', style: 'tight', padding: 8 },
              })
            }
            className={`p-2 rounded-lg transition-all ${
              effects?.highlight?.enabled
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
            title="Toggle highlight"
          >
            <Icon name="highlight" size="sm" />
          </button>
        </div>

        {effects?.highlight?.enabled && (
          <div className="space-y-2 pl-1">
            {/* Highlight Color */}
            <div className="flex gap-3">
              {colorSwatches.map((color) => (
                <button
                  key={color}
                  onClick={() =>
                    onChange({
                      ...effects,
                      highlight: { ...effects.highlight!, color: color + '88' },
                    })
                  }
                  className={`w-6 h-6 rounded-full ${
                    effects.highlight!.color === color + '88'
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
                  value={effects.highlight!.color.slice(0, 7)}
                  onChange={(e) =>
                    onChange({
                      ...effects,
                      highlight: { ...effects.highlight!, color: e.target.value + '88' },
                    })
                  }
                  className="sr-only"
                />
              </label>
            </div>

            {/* Highlight Style */}
            <div className="flex gap-2">
              {(['tight', 'full'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() =>
                    onChange({
                      ...effects,
                      highlight: { ...effects.highlight!, style },
                    })
                  }
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    effects.highlight!.style === style
                      ? 'bg-[#3d0000] text-white'
                      : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
                  }`}
                >
                  {style === 'tight' ? 'Tight' : 'Full'}
                </button>
              ))}
            </div>

            {/* Highlight Padding */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Padding</span>
                <span className="text-[10px] font-bold text-[#3d0000]">{effects.highlight!.padding}px</span>
              </div>
              <input
                type="range"
                min={4}
                max={24}
                step={2}
                value={effects.highlight!.padding}
                onChange={(e) =>
                  onChange({
                    ...effects,
                    highlight: { ...effects.highlight!, padding: Number(e.target.value) },
                  })
                }
                className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
