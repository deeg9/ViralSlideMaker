'use client'

import { useState, useTransition } from 'react'
import { generateCarousel } from '@/app/(dashboard)/project/[id]/actions'
import { TemplatePicker } from './template-picker'
import { Icon } from '@/components/ui/icon'
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt'
import { useRouter } from 'next/navigation'

export type ImageSource = 'stock' | 'ai'

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
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return

    setError(null)
    setShowUpgradePrompt(false)
    startTransition(async () => {
      const result = await generateCarousel(projectId, topic.trim(), templateId, imageSource)
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
            placeholder="e.g. A 10-slide deck about the future of sustainable architecture in urban environments..."
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

      {/* Image Source */}
      <div>
        <label className="block text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-4 ml-1">
          Background Images
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setImageSource('stock')}
            disabled={isPending}
            className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${
              imageSource === 'stock'
                ? 'border-[#3d0000] bg-[#fff0f0]'
                : 'border-[#dbc1bc]/20 bg-white hover:border-[#dbc1bc]/40'
            } disabled:opacity-50`}
          >
            <Icon name="image" size="lg" className={imageSource === 'stock' ? 'text-[#3d0000]' : 'text-[#7d6161]'} />
            <span className={`text-sm font-semibold ${imageSource === 'stock' ? 'text-[#3d0000]' : 'text-[#7d6161]'}`}>
              Stock Photos
            </span>
            <span className="text-[10px] text-[#7d6161]">Free with generation</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (userTier === 'free') {
                setShowUpgradePrompt(true)
                return
              }
              setImageSource('ai')
            }}
            disabled={isPending}
            className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${
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
              {userTier === 'free' ? 'Pro / Plus only' : '1 credit per image'}
            </span>
          </button>
        </div>
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
              Generating slides...
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
            Estimated time: 45 seconds
          </p>
        )}
      </div>
    </form>
  )
}
