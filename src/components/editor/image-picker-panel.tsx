'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icon'
import type { Slide } from '@/lib/types/slide'
import {
  searchBackgroundPhotos,
  createUploadUrl,
  stylizeSlidePhoto,
} from '@/app/(dashboard)/project/[id]/editor-actions'
import { AIGenerateTab } from '@/components/editor/ai-generate-tab'

interface ImagePickerPanelProps {
  slide: Slide
  slideIndex: number
  projectId: string
  topic: string
  onUpdate: (updates: Partial<Slide>) => void
  onRegenerateText: () => void | Promise<void>
  onRegenerateImage: () => void | Promise<void>
  onAddCanvasImage?: (url: string) => void
}

interface PexelsPhoto {
  id: number
  url: string
  thumbnail: string
  photographer: string
}

export function ImagePickerPanel({
  slide,
  slideIndex,
  projectId,
  topic,
  onUpdate,
  onRegenerateText,
  onRegenerateImage,
  onAddCanvasImage,
}: ImagePickerPanelProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'ai'>('search')
  const [query, setQuery] = useState(slide.image_query)
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [regeneratingText, setRegeneratingText] = useState(false)
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null)
  const [stylizing, setStylizing] = useState(false)
  const [stylizeError, setStylizeError] = useState<string | null>(null)

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const results = await searchBackgroundPhotos(query)
      setPhotos(results)
    } catch { /* silently handle */ }
    finally { setSearching(false) }
  }

  function handleSelectPhoto(photo: PexelsPhoto) {
    onUpdate({ background_url: photo.url, pexels_photo_id: photo.id })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('File must be under 5MB'); return }

    setUploading(true)
    try {
      const { signedUrl, publicUrl } = await createUploadUrl(projectId, file.name)
      const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      setLastUploadedUrl(publicUrl)
      onUpdate({ background_url: publicUrl, pexels_photo_id: null })
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed. Please try again.')
    }
    finally {
      setUploading(false)
      // Reset input so same file can be re-selected
      e.target.value = ''
    }
  }

  async function handleStylize() {
    if (!lastUploadedUrl || stylizing) return
    setStylizing(true)
    setStylizeError(null)
    try {
      const result = await stylizeSlidePhoto(projectId, slideIndex, lastUploadedUrl)
      if ('url' in result) {
        onUpdate({ background_url: result.url, pexels_photo_id: null })
      } else {
        setStylizeError(result.error)
      }
    } finally {
      setStylizing(false)
    }
  }

  async function handleRegenText() {
    setRegeneratingText(true)
    try { await onRegenerateText() } finally { setRegeneratingText(false) }
  }

  async function handleRegenImage() {
    setRegeneratingImage(true)
    try { await onRegenerateImage() } finally { setRegeneratingImage(false) }
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#fff0f0]" data-testid="image-picker-panel">
      {/* Regenerate — quick-260514-portlet-bottom-and-regen: wrapped in
          watermark-style white card with brown border. */}
      <div className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] block">Regenerate</span>
        <div className="flex gap-2">
          <button
            onClick={handleRegenText}
            disabled={regeneratingText}
            className="flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-[#dbc1bc]/30 bg-white text-[#7d6161] hover:bg-[#fadbdb] hover:text-[#3d0000] transition-colors disabled:opacity-50"
            title="Rewrite the text with AI — free"
          >
            <Icon name="refresh" size="sm" className={regeneratingText ? 'animate-spin' : ''} />
            <span>Text</span>
            <span className="text-[8px] font-medium normal-case tracking-normal text-[#7d6161]/60">Free</span>
          </button>
          <button
            onClick={handleRegenImage}
            disabled={regeneratingImage}
            className="flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-[#dbc1bc]/30 bg-white text-[#7d6161] hover:bg-[#fadbdb] hover:text-[#3d0000] transition-colors disabled:opacity-50"
            title="Find a new stock photo — free"
          >
            <Icon name="refresh" size="sm" className={regeneratingImage ? 'animate-spin' : ''} />
            <span>Image</span>
            <span className="text-[8px] font-medium normal-case tracking-normal text-[#7d6161]/60">New stock photo</span>
          </button>
        </div>
      </div>

      {/* Background Image section — quick-260514-portlet-bottom-and-regen:
          wrapped in watermark-style white card with brown border. Tabs + all
          tab content (search / upload / ai generate) sit inside the same card. */}
      <div className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] block">Background Image</span>

        <div className="flex border-b border-[#dbc1bc]/10">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === 'search'
                ? 'border-[#3d0000] text-[#3d0000]'
                : 'border-transparent text-[#7d6161] hover:text-[#3d0000]'
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-[#3d0000] text-[#3d0000]'
                : 'border-transparent text-[#7d6161] hover:text-[#3d0000]'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === 'ai'
                ? 'border-[#3d0000] text-[#3d0000]'
                : 'border-transparent text-[#7d6161] hover:text-[#3d0000]'
            }`}
          >
            AI Generate
          </button>
        </div>

      {/* Search */}
      {activeTab === 'search' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search photos..."
              className="flex-1 rounded-xl border border-[#dbc1bc]/30 bg-white px-4 py-2.5 text-sm text-[#3d0000] focus:border-[#3d0000] focus:ring-0 placeholder:text-[#dbc1bc]"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2.5 bg-[#3d0000] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Icon name="search" size="sm" />
            </button>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 max-h-[300px] overflow-y-auto">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group rounded-lg overflow-hidden aspect-[9/16] hover:ring-2 hover:ring-[#3d0000] transition-all"
                >
                  <button
                    onClick={() => handleSelectPhoto(photo)}
                    className="w-full h-full"
                  >
                    <img
                      src={photo.thumbnail}
                      alt={`Photo by ${photo.photographer}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-[#3d0000]/60 px-1 py-0.5 text-[10px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.photographer}
                  </div>
                  {onAddCanvasImage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddCanvasImage(photo.url)
                      }}
                      className="absolute top-1 right-1 p-1 bg-white/90 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                      title="Add to canvas"
                    >
                      <Icon name="add_circle" size="sm" className="text-[#3d0000]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload */}
      {activeTab === 'upload' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-[#3d0000]/20 rounded-xl cursor-pointer bg-white hover:bg-[#fff0f0] transition-colors">
            <Icon name="cloud_upload" size="xl" className="text-[#dbc1bc]" />
            <span className="text-xs text-[#7d6161] font-medium">
              {uploading ? 'Uploading...' : 'Click to upload (max 5MB)'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="sr-only"
            />
          </label>
          {lastUploadedUrl && (
            <>
              <button
                onClick={handleStylize}
                disabled={stylizing}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-[#3d0000] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                title="Restyle this photo with AI to match the carousel's visual style. Uses 1 credit."
              >
                <Icon name={stylizing ? 'progress_activity' : 'auto_awesome'} size="sm" className={stylizing ? 'animate-spin' : ''} />
                {stylizing ? 'Stylizing...' : 'AI-Stylize This Photo (1 credit)'}
              </button>
              {stylizeError && (
                <p className="text-[10px] text-red-700 px-1" role="alert">{stylizeError}</p>
              )}
              {onAddCanvasImage && (
                <button
                  onClick={() => {
                    onAddCanvasImage(lastUploadedUrl)
                    setLastUploadedUrl(null)
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-[#3d0000]/20 bg-white text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000] transition-colors"
                >
                  <Icon name="add_circle" size="sm" />
                  Add Last Upload to Canvas
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* AI Generate */}
      {activeTab === 'ai' && (
        <AIGenerateTab
          slide={slide}
          slideIndex={slideIndex}
          projectId={projectId}
          topic={topic}
          onUpdate={onUpdate}
        />
      )}
      </div>
    </div>
  )
}
