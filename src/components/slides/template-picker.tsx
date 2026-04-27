'use client'

import { templates } from '@/lib/render/templates/index'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'
import { SlidePreview } from './slide-preview'

interface TemplatePickerProps {
  selectedId: string
  onSelect: (id: string) => void
}

// Build a minimal Slide from the template's `sample` for the picker preview.
// `background_url: null` keeps the preview snappy (no remote image fetch),
// `is_cta: false` keeps any CTA-only render branches off.
function makeSampleSlide(template: SlideTemplate): Slide {
  const sample = template.sample
  return {
    hook_text: sample?.hook_text ?? 'Sample headline',
    body_text: sample?.body_text ?? 'Sample body text.',
    hook_segments: sample?.hook_segments,
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: sample?.layout ? { layout: sample.layout } : {},
  }
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
            className="flex-none w-40 group text-left"
          >
            <div
              className={`aspect-[9/16] rounded-xl overflow-hidden mb-3 border-2 transition-all relative ${
                isSelected
                  ? 'border-[#3d0000]'
                  : 'border-transparent group-hover:border-[#dbc1bc]'
              }`}
            >
              <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-500 pointer-events-none">
                <SlidePreview
                  slide={makeSampleSlide(template)}
                  template={template}
                  index={0}
                  editable={false}
                />
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
