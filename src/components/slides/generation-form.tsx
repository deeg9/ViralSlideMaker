'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { generateCarousel } from '@/app/(dashboard)/project/[id]/actions'
import { TemplatePicker } from './template-picker'
import { Icon } from '@/components/ui/icon'
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt'
import { useRouter } from 'next/navigation'
import { FONT_CATALOG } from '@/lib/fonts/font-catalog'

export type ImageSource = 'stock' | 'ai'

const FREE_TIER_MAX_SLIDES = 3

interface GenerationFormProps {
  projectId: string
  currentTopic?: string
  currentTemplateId?: string
  hasSlides: boolean
  userTier?: 'free' | 'pro' | 'plus'
}

export function GenerationForm({
  projectId,
  currentTopic,
  currentTemplateId,
  hasSlides,
  userTier = 'free',
}: GenerationFormProps) {
  const [topic, setTopic] = useState(currentTopic ?? '')
  const [templateId, setTemplateId] = useState(currentTemplateId ?? 'bold-minimal')
  const [imageSource, setImageSource] = useState<ImageSource>('stock')
  const isPaidUser = userTier !== 'free'
  const sliderMax = isPaidUser ? 20 : FREE_TIER_MAX_SLIDES
  const [slideCount, setSlideCount] = useState(isPaidUser ? 7 : FREE_TIER_MAX_SLIDES)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedFont, setAdvancedFont] = useState<string>('')
  const [advancedFontColor, setAdvancedFontColor] = useState<string>('')
  const [advancedImagePrompt, setAdvancedImagePrompt] = useState('')
  const router = useRouter()

  const fontsByCategory = useMemo(() => {
    const groups: Record<string, typeof FONT_CATALOG> = {}
    for (const font of FONT_CATALOG) {
      if (!groups[font.category]) groups[font.category] = []
      groups[font.category].push(font)
    }
    return groups
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return

    setError(null)
    setShowUpgradePrompt(false)
    const effectiveSlideCount = isPaidUser ? slideCount : Math.min(slideCount, FREE_TIER_MAX_SLIDES)
    startTransition(async () => {
      const result = await generateCarousel(projectId, topic.trim(), templateId, imageSource, effectiveSlideCount, {
        font: advancedFont || undefined,
        fontColor: advancedFontColor || undefined,
        imagePrompt: advancedImagePrompt || undefined,
      })
      if (!result.success) {
        setError(result.error)
        if ('upgradeEligible' in result && result.upgradeEligible) {
          setShowUpgradePrompt(true)
        }
      } else {
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Textarea */}
      <div>
        <label className="block text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-3 ml-1">
          Presentation Prompt
        </label>
        <div className="relative">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 5 tips for growing your Instagram following, benefits of morning routines, how to start investing..."
            rows={6}
            disabled={isPending}
            maxLength={500}
            className="w-full bg-white p-6 rounded-xl border-b-2 border-[#dbc1bc]/30 focus:border-[#3d0000] focus:ring-0 transition-all text-lg resize-none placeholder:text-[#dbc1bc] disabled:opacity-50"
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[#dbc1bc]">
            <Icon name="auto_awesome" size="sm" />
            <span className="text-xs font-medium">AI Assisted</span>
          </div>
        </div>
      </div>

      {/* Template Picker */}
      <div>
        <div className="flex justify-between items-end mb-6">
          <label className="text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161]">
            Select Visual Style
          </label>
        </div>
        <TemplatePicker selectedId={templateId} onSelect={setTemplateId} />
      </div>

      {/* Slide Count */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] ml-1">
            Number of Slides
          </label>
          <span className="text-sm font-bold text-[#3d0000]">{slideCount}</span>
        </div>
        <input
          type="range"
          min={isPaidUser ? 3 : 1}
          max={sliderMax}
          step={1}
          value={slideCount}
          onChange={(e) => setSlideCount(Number(e.target.value))}
          disabled={isPending}
          className="w-full h-1.5 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000] disabled:opacity-50"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[#7d6161]">{isPaidUser ? 3 : 1}</span>
          <span className="text-[10px] text-[#7d6161]">{sliderMax}</span>
        </div>
        {!isPaidUser && (
          <div className="flex items-center gap-1.5 mt-2 ml-1">
            <Icon name="lock" size="sm" className="text-[#7d6161]" />
            <Link
              href="/settings/subscription"
              className="text-[11px] font-semibold text-[#3d0000] hover:underline"
            >
              Upgrade for more slides
            </Link>
          </div>
        )}
      </div>

      {/* Image Source Toggle */}
      <div>
        <label className="block text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-4 ml-1">
          Background Images
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setImageSource('stock')}
            disabled={isPending}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              imageSource === 'stock'
                ? 'border-[#3d0000] bg-[#fff0f0]'
                : 'border-[#dbc1bc]/20 bg-white hover:border-[#dbc1bc]/40'
            } disabled:opacity-50`}
          >
            <Icon name="image" size="lg" className={imageSource === 'stock' ? 'text-[#3d0000]' : 'text-[#7d6161]'} />
            <span className={`text-sm font-semibold ${imageSource === 'stock' ? 'text-[#3d0000]' : 'text-[#7d6161]'}`}>
              Stock Photos
            </span>
            <span className="text-[10px] text-[#7d6161]">Included free</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isPaidUser) {
                setShowUpgradePrompt(true)
                return
              }
              setImageSource('ai')
            }}
            disabled={isPending}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              imageSource === 'ai'
                ? 'border-[#3d0000] bg-[#fff0f0]'
                : 'border-[#dbc1bc]/20 bg-white hover:border-[#dbc1bc]/40'
            } disabled:opacity-50`}
          >
            <Icon name="auto_awesome" size="lg" className={imageSource === 'ai' ? 'text-[#3d0000]' : 'text-[#7d6161]'} />
            <span className={`text-sm font-semibold ${imageSource === 'ai' ? 'text-[#3d0000]' : 'text-[#7d6161]'}`}>
              AI Generated
            </span>
            <span className="text-[10px] text-[#7d6161]">
              {isPaidUser ? '1 credit per slide' : 'Plus / Pro only'}
            </span>
          </button>
        </div>
        {imageSource === 'ai' && (
          <p className="text-[10px] text-[#7d6161] mt-2 ml-1">
            Uses ~{slideCount} credits for AI backgrounds. Takes ~{Math.ceil(slideCount / 2) * 10}-{Math.ceil(slideCount / 2) * 15}s. Slides that fail will use stock photos instead.
          </p>
        )}
      </div>

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] ml-1"
        >
          Advanced Options
          <Icon
            name="expand_more"
            size="sm"
            className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
        </button>
        {showAdvanced && (
          <div className="mt-4 space-y-5">
            {/* Font */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-2 ml-1">
                Font
              </label>
              <select
                value={advancedFont}
                onChange={(e) => setAdvancedFont(e.target.value)}
                disabled={isPending}
                className="w-full bg-white rounded-xl border-b-2 border-[#dbc1bc]/30 px-4 py-3 text-sm text-[#3d0000] focus:border-[#3d0000] focus:ring-0 disabled:opacity-50"
              >
                <option value="">Template Default</option>
                {Object.entries(fontsByCategory).map(([category, fonts]) => (
                  <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                    {fonts.map((font) => (
                      <option key={font.family} value={font.family}>
                        {font.family}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Font Color */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-2 ml-1">
                Font Color
              </label>
              <div className="flex items-center gap-2">
                {['#ffffff', '#3d0000', '#000000', '#7d6161'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAdvancedFontColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      advancedFontColor === color
                        ? 'border-[#3d0000] scale-110'
                        : 'border-[#dbc1bc]/30 hover:border-[#dbc1bc]'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <input
                  type="color"
                  value={advancedFontColor || '#000000'}
                  onChange={(e) => setAdvancedFontColor(e.target.value)}
                  className="w-8 h-8 rounded-full border-2 border-[#dbc1bc]/30 cursor-pointer"
                  title="Custom color"
                />
                {advancedFontColor && (
                  <button
                    type="button"
                    onClick={() => setAdvancedFontColor('')}
                    className="text-[10px] text-[#7d6161] hover:text-[#3d0000] ml-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* AI Image Prompt */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-2 ml-1">
                AI Image Style Hint
              </label>
              <textarea
                value={advancedImagePrompt}
                onChange={(e) => setAdvancedImagePrompt(e.target.value)}
                placeholder="e.g. minimalist watercolor illustrations, dark moody photography..."
                rows={2}
                disabled={isPending}
                className="w-full bg-white rounded-xl border-b-2 border-[#dbc1bc]/30 px-4 py-3 text-sm text-[#3d0000] focus:border-[#3d0000] focus:ring-0 resize-none placeholder:text-[#dbc1bc] disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {showUpgradePrompt && (
        <UpgradePrompt context="generation" />
      )}

      {/* Submit */}
      <div className="flex flex-col items-center gap-6">
        <button
          type="submit"
          disabled={isPending || !topic.trim()}
          className="w-full bg-[#3d0000] text-white py-5 rounded-xl font-semibold tracking-wide flex items-center justify-center gap-3 shadow-[0px_20px_40px_rgba(61,0,0,0.1)] hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {imageSource === 'ai' ? 'Generating with AI images (~30s)...' : 'Generating slides...'}
            </>
          ) : (
            <>
              {hasSlides ? 'Regenerate Carousel' : 'Generate Carousel'}
              <Icon name="bolt" />
            </>
          )}
        </button>
        {!hasSlides && (
          <p className="text-[10px] text-[#7d6161] uppercase tracking-widest font-bold">
            {imageSource === 'ai' ? 'Estimated time: 30-45 seconds' : 'Estimated time: 15 seconds'}
          </p>
        )}
      </div>
    </form>
  )
}
