'use client'

import { useState, useEffect, useCallback } from 'react'
import { Icon } from '@/components/ui/icon'
import { generateCaptionsAction } from '@/app/(dashboard)/project/[id]/caption-actions'

interface CaptionPanelProps {
  projectId: string
  visible: boolean
  onClose: () => void
}

type Platform = 'tiktok' | 'instagram' | 'linkedin'

interface Captions {
  tiktok: string
  instagram: string
  linkedin: string
}

const platformConfig: Record<Platform, { label: string; icon: string }> = {
  tiktok: { label: 'TikTok', icon: 'tag' },
  instagram: { label: 'Instagram', icon: 'photo_camera' },
  linkedin: { label: 'LinkedIn', icon: 'work' },
}

export function CaptionPanel({ projectId, visible, onClose }: CaptionPanelProps) {
  const [activeTab, setActiveTab] = useState<Platform>('tiktok')
  const [captions, setCaptions] = useState<Captions | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedPlatform, setCopiedPlatform] = useState<Platform | null>(null)

  const fetchCaptions = useCallback(async () => {
    setLoading(true)
    setError('')
    setCaptions(null)

    try {
      const result = await generateCaptionsAction(projectId)

      if ('error' in result) {
        setError(result.error)
      } else {
        setCaptions(result)
      }
    } catch {
      setError('Caption generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (visible && !captions && !loading) {
      fetchCaptions()
    }
  }, [visible, captions, loading, fetchCaptions])

  if (!visible) return null

  async function handleCopy(platform: Platform) {
    if (!captions) return
    try {
      await navigator.clipboard.writeText(captions[platform])
      setCopiedPlatform(platform)
      setTimeout(() => setCopiedPlatform(null), 2000)
    } catch {
      // Clipboard API may fail in non-secure contexts
    }
  }

  const platforms: Platform[] = ['tiktok', 'instagram', 'linkedin']

  return (
    <div className="bg-white border-t border-[#dbc1bc]/20 rounded-b-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#dbc1bc]/10">
        <div className="flex items-center gap-2">
          <Icon name="auto_awesome" size="sm" className="text-[#3d0000]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#3d0000]">
            Captions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCaptions(null)
              fetchCaptions()
            }}
            disabled={loading}
            className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-colors disabled:opacity-50"
            title="Regenerate Captions"
          >
            <Icon name="refresh" size="sm" className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-colors"
            title="Close"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex border-b border-[#dbc1bc]/10" role="tablist">
        {platforms.map((platform) => (
          <button
            key={platform}
            role="tab"
            aria-selected={activeTab === platform}
            onClick={() => setActiveTab(platform)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === platform
                ? 'border-[#3d0000] text-[#3d0000]'
                : 'border-transparent text-[#7d6161] hover:text-[#3d0000]'
            }`}
          >
            <Icon name={platformConfig[platform].icon} size="sm" />
            {platformConfig[platform].label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" className="p-4">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            <div className="h-4 bg-[#fff0f0] rounded animate-pulse w-full" />
            <div className="h-4 bg-[#fff0f0] rounded animate-pulse w-5/6" />
            <div className="h-4 bg-[#fff0f0] rounded animate-pulse w-4/6" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-xs text-[#7d6161]">Caption generation failed. Please try again.</p>
            <button
              onClick={fetchCaptions}
              className="text-xs font-bold text-[#3d0000] underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Caption content */}
        {captions && !loading && (
          <div className="flex flex-col gap-3">
            <pre className="whitespace-pre-wrap text-sm text-[#3d0000] p-3 bg-[#fff8f7] rounded-lg">
              {captions[activeTab]}
            </pre>
            <button
              onClick={() => handleCopy(activeTab)}
              aria-label={`Copy ${platformConfig[activeTab].label} caption to clipboard`}
              className="self-end flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#3d0000] bg-[#fff0f0] hover:bg-[#fadbdb] rounded-lg transition-colors"
            >
              <Icon
                name={copiedPlatform === activeTab ? 'check' : 'content_copy'}
                size="sm"
              />
              <span className="hidden sm:inline">Copy Caption</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
