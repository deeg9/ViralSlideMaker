'use client'

import { templates } from '@/lib/render/templates/index'

interface TemplatePickerProps {
  selectedId: string
  onSelect: (id: string) => void
}

export function TemplatePicker({ selectedId, onSelect }: TemplatePickerProps) {
  return (
    <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
      {templates.map((template) => {
        const isSelected = selectedId === template.id
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className="flex-none w-48 group text-left"
          >
            <div
              className={`aspect-[4/3] rounded-xl overflow-hidden mb-3 border-2 transition-all ${
                isSelected
                  ? 'border-[#3d0000]'
                  : 'border-transparent group-hover:border-[#dbc1bc]'
              }`}
            >
              <div
                className="w-full h-full flex items-center justify-center group-hover:scale-105 transition-transform duration-500"
                style={{ backgroundColor: template.backgroundColor }}
              >
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: template.overlayColor,
                    opacity: Math.max(template.overlayOpacity, 0.3),
                  }}
                >
                  <span
                    className="text-2xl font-bold"
                    style={{
                      color: template.textColor,
                      fontFamily: template.fontFamily,
                    }}
                  >
                    Aa
                  </span>
                </div>
              </div>
            </div>
            <span className={`block text-sm font-semibold ${isSelected ? 'text-[#3d0000]' : 'text-[#3d0000]'}`}>
              {template.name}
            </span>
            <span className={`block text-[10px] uppercase tracking-wider ${
              isSelected
                ? 'text-[#3d0000] font-bold'
                : 'text-[#7d6161]'
            }`}>
              {isSelected ? 'Selected' : 'Style'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
