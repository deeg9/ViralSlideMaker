'use client'

import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

interface TextEditorPanelProps {
  slide: Slide
  template: SlideTemplate
  onUpdate: (updates: Partial<Slide>) => void
}

export function TextEditorPanel({ slide, template, onUpdate }: TextEditorPanelProps) {
  const overrides = slide.style_overrides ?? {}

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="text-editor-panel">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Text Content
      </h3>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="hook-text" className="text-sm font-medium">
          Hook Text
        </label>
        <textarea
          id="hook-text"
          value={slide.hook_text}
          onChange={(e) => onUpdate({ hook_text: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
          placeholder="Enter hook text..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body-text" className="text-sm font-medium">
          Body Text
        </label>
        <textarea
          id="body-text"
          value={slide.body_text}
          onChange={(e) => onUpdate({ body_text: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
          placeholder="Enter body text..."
        />
      </div>

      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-2">
        Style Controls
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="hook-font-size" className="text-xs text-muted-foreground">
            Hook Size ({overrides.hook_font_size ?? template.hookFontSize})
          </label>
          <input
            id="hook-font-size"
            type="number"
            min={16}
            max={72}
            step={2}
            value={overrides.hook_font_size ?? ''}
            placeholder={template.hookFontSize}
            onChange={(e) =>
              onUpdate({
                style_overrides: {
                  ...overrides,
                  hook_font_size: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="body-font-size" className="text-xs text-muted-foreground">
            Body Size ({overrides.body_font_size ?? template.bodyFontSize})
          </label>
          <input
            id="body-font-size"
            type="number"
            min={12}
            max={48}
            step={2}
            value={overrides.body_font_size ?? ''}
            placeholder={template.bodyFontSize}
            onChange={(e) =>
              onUpdate({
                style_overrides: {
                  ...overrides,
                  body_font_size: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="text-color" className="text-xs text-muted-foreground">
            Text Color
          </label>
          <input
            id="text-color"
            type="color"
            value={overrides.text_color ?? template.textColor}
            onChange={(e) =>
              onUpdate({
                style_overrides: {
                  ...overrides,
                  text_color: e.target.value,
                },
              })
            }
            className="w-full h-[44px] rounded-md border border-border bg-background cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="text-position" className="text-xs text-muted-foreground">
            Text Position
          </label>
          <select
            id="text-position"
            value={overrides.text_position ?? template.textPosition}
            onChange={(e) =>
              onUpdate({
                style_overrides: {
                  ...overrides,
                  text_position: e.target.value as 'top' | 'center' | 'bottom',
                },
              })
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
          >
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>
      </div>
    </div>
  )
}
