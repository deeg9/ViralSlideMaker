'use client'

import Link from 'next/link'
import { useState, useEffect, useTransition } from 'react'
import { Icon } from '@/components/ui/icon'
import {
  generateAIImageAction,
  generateImagePromptAction,
} from '@/app/(dashboard)/project/[id]/imagen-actions'
import type { Slide } from '@/lib/types/slide'

interface AIGenerateTabProps {
  slide: Slide
  slideIndex: number
  projectId: string
  topic: string
  onUpdate: (updates: Partial<Slide>) => void
}

type GenerateStatus =
  | 'idle'
  | 'loading-prompt'
  | 'prompt-ready'
  | 'generating'
  | 'success'
  | 'safety-filtered'
  | 'insufficient-credits'
  | 'error'

export function AIGenerateTab({
  slide,
  slideIndex,
  projectId,
  topic,
  onUpdate,
}: AIGenerateTabProps) {
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Auto-generate a starter prompt on mount — available on every tier.
  useEffect(() => {
    let cancelled = false
    setStatus('loading-prompt')

    generateImagePromptAction(
      topic,
      slide.hook_text,
      slide.body_text ?? '',
      slide.is_cta,
    )
      .then((result) => {
        if (!cancelled) {
          setPrompt(result)
          setStatus('prompt-ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrompt('')
          setStatus('prompt-ready')
        }
      })

    return () => {
      cancelled = true
    }
  }, [slide.hook_text, slide.body_text, slide.is_cta, topic])

  function handleGenerate() {
    if (!prompt.trim() || isPending) return

    startTransition(async () => {
      setStatus('generating')
      setErrorMessage('')

      try {
        const result = await generateAIImageAction(projectId, slideIndex, prompt)

        if ('url' in result) {
          onUpdate({ background_url: result.url, pexels_photo_id: null })
          setStatus('success')
        } else if ('error' in result) {
          const err = result.error.toLowerCase()
          if (err.includes('safety') || err.includes('blocked') || err.includes('filter')) {
            setStatus('safety-filtered')
          } else if (err.includes('credit') || err.includes('insufficient')) {
            setStatus('insufficient-credits')
          } else {
            setErrorMessage(result.error)
            setStatus('error')
          }
        }
      } catch {
        setStatus('error')
        setErrorMessage('Generation failed. Your credit has been refunded. Please try again.')
      }
    })
  }

  const isGenerating = status === 'generating' || isPending
  const isLoadingPrompt = status === 'loading-prompt'

  return (
    <div className="flex flex-col gap-4 p-6">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] block">
        AI Background
      </span>

      {/* Prompt textarea */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={isLoadingPrompt || isGenerating}
        rows={4}
        placeholder="Describe the background image you want..."
        aria-label="Image generation prompt"
        aria-busy={isLoadingPrompt}
        className={`w-full rounded-xl border border-[#dbc1bc]/30 bg-white px-4 py-3 text-base md:text-sm text-[#3d0000] focus:border-[#3d0000] focus:ring-0 placeholder:text-[#7d6161]/60 resize-none disabled:opacity-60 ${
          isLoadingPrompt ? 'animate-pulse bg-[#fff0f0]' : ''
        }`}
      />

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || isLoadingPrompt || !prompt.trim()}
        aria-label="Generate AI background image, costs 1 credit"
        className="w-full bg-[#3d0000] text-white rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <Icon name="progress_activity" size="sm" className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Icon name="auto_awesome" size="sm" />
            Generate Image
          </>
        )}
      </button>
      <p className="text-[10px] text-[#7d6161] text-center" aria-label="This action costs 1 credit">
        Uses 1 credit per generation
      </p>

      {/* Generating state message */}
      {isGenerating && (
        <p className="text-xs text-[#7d6161]">
          Generating image... this may take up to 15 seconds.
        </p>
      )}

      {/* Success state */}
      {status === 'success' && (
        <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          Image generated and applied to slide.
        </p>
      )}

      {/* Safety filtered (refunded) */}
      {status === 'safety-filtered' && (
        <div role="alert" className="bg-[#fff0f0] rounded-lg px-3 py-2 flex items-start gap-2">
          <Icon name="warning" size="sm" className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-[#3d0000]">
            Image was blocked by content safety filter. Your credit has been refunded. Try a different description.
          </p>
        </div>
      )}

      {/* Insufficient credits */}
      {status === 'insufficient-credits' && (
        <div role="status" className="text-xs text-[#7d6161]">
          Not enough credits.{' '}
          <Link href="/settings/subscription" className="underline text-[#3d0000] font-medium">
            Buy more credits
          </Link>
        </div>
      )}

      {/* API error (refunded) */}
      {status === 'error' && (
        <div role="alert" className="bg-[#fff0f0] rounded-lg px-3 py-2">
          <p className="text-xs text-[#3d0000]">
            {errorMessage || 'Generation failed. Your credit has been refunded. Please try again.'}
          </p>
        </div>
      )}
    </div>
  )
}
