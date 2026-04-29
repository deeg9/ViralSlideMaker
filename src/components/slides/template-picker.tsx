'use client'

import Link from 'next/link'
import { templates } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'
import { synthesizeBrandKitTemplate, BRAND_KIT_TEMPLATE_ID } from '@/lib/brand-kit/get-effective-template'
import { makeSampleSlide } from '@/lib/render/sample-slide'
import { SlidePreview } from './slide-preview'

interface TemplatePickerProps {
  selectedId: string
  onSelect: (id: string) => void
  brandKit?: BrandKit | null
}

/**
 * A brand kit is "configured" enough to render as a template tile when the user
 * has set at least colors + a font (otherwise the synthesized template would be
 * indistinguishable from defaults and confusing in the picker).
 */
function isBrandKitConfigured(bk: BrandKit | null | undefined): bk is BrandKit {
  if (!bk) return false
  const hasColors = !!(bk.background_color && bk.text_color)
  const hasFont = !!(bk.body_font_family || bk.heading_font_family || bk.font_family)
  return hasColors || hasFont
}

export function TemplatePicker({ selectedId, onSelect, brandKit }: TemplatePickerProps) {
  const configured = isBrandKitConfigured(brandKit)
  const brandKitTemplate = configured ? synthesizeBrandKitTemplate(brandKit) : null
  const isBrandKitSelected = selectedId === BRAND_KIT_TEMPLATE_ID

  return (
    <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
      {/* Your-Brand-Kit tile (260427-bkt) — first slot when configured */}
      {brandKitTemplate && (
        <button
          key={BRAND_KIT_TEMPLATE_ID}
          type="button"
          onClick={() => onSelect(BRAND_KIT_TEMPLATE_ID)}
          className="flex-none w-40 group text-left"
        >
          <div
            className={`aspect-[9/16] rounded-xl overflow-hidden mb-3 border-2 transition-all relative ${
              isBrandKitSelected
                ? 'border-[#3d0000]'
                : 'border-transparent group-hover:border-[#dbc1bc]'
            }`}
          >
            <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-500 pointer-events-none">
              <SlidePreview
                slide={makeSampleSlide(brandKitTemplate)}
                template={brandKitTemplate}
                index={0}
                slideIndex={0}
                totalSlides={1}
                editable={false}
                brandKit={brandKit}
              />
            </div>
          </div>
          <span className="block text-sm font-semibold text-[#3d0000]">
            Your Brand Kit
          </span>
          <span
            className={`block text-[10px] uppercase tracking-wider ${
              isBrandKitSelected ? 'text-[#3d0000] font-bold' : 'text-[#7d6161]'
            }`}
          >
            {isBrandKitSelected ? 'Selected' : 'Personalized'}
          </span>
        </button>
      )}

      {/* Build-your-brand-kit empty state — first slot when no brand kit configured */}
      {!brandKitTemplate && (
        <Link
          key="brand-kit-empty"
          href="/settings/brand-kit"
          className="flex-none w-40 group text-left"
        >
          <div className="aspect-[9/16] rounded-xl overflow-hidden mb-3 border-2 border-dashed border-[#dbc1bc] group-hover:border-[#3d0000] bg-[#fff8f7] flex items-center justify-center transition-colors">
            <div className="flex flex-col items-center gap-2 px-3 text-center">
              <div className="w-10 h-10 rounded-full bg-[#3d0000]/10 flex items-center justify-center text-[#3d0000] text-2xl leading-none">
                +
              </div>
              <span className="text-[11px] font-semibold text-[#3d0000] leading-tight">
                Build your<br />brand kit
              </span>
            </div>
          </div>
          <span className="block text-sm font-semibold text-[#3d0000]">
            Your Brand Kit
          </span>
          <span className="block text-[10px] uppercase tracking-wider text-[#7d6161]">
            Set up
          </span>
        </Link>
      )}

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
                  slideIndex={0}
                  totalSlides={1}
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
