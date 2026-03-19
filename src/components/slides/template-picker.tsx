'use client'

import { templates } from '@/lib/render/templates/index'

interface TemplatePickerProps {
  selectedId: string
  onSelect: (id: string) => void
}

export function TemplatePicker({ selectedId, onSelect }: TemplatePickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onSelect(template.id)}
          className={`
            flex flex-col items-center gap-2 rounded-lg border p-3 transition-all
            hover:border-foreground/30
            ${selectedId === template.id
              ? 'border-foreground ring-2 ring-foreground/20'
              : 'border-border'
            }
          `}
        >
          <div
            className="w-full aspect-[9/16] rounded-md"
            style={{
              backgroundColor: template.backgroundColor,
              border: `1px solid ${template.overlayColor}`,
            }}
          >
            <div
              className="w-full h-full rounded-md flex items-center justify-center p-2"
              style={{
                backgroundColor: template.overlayColor,
                opacity: template.overlayOpacity,
              }}
            >
              <span
                className="text-[8px] font-bold leading-tight text-center"
                style={{
                  color: template.textColor,
                  fontFamily: template.fontFamily,
                }}
              >
                Aa
              </span>
            </div>
          </div>
          <span className="text-xs font-medium truncate w-full text-center">
            {template.name}
          </span>
        </button>
      ))}
    </div>
  )
}
