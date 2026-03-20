'use client'

import { useState } from 'react'
import { Search, Upload, RefreshCw, Image as ImageIcon } from 'lucide-react'
import type { Slide } from '@/lib/types/slide'
import {
  searchBackgroundPhotos,
  createUploadUrl,
} from '@/app/(dashboard)/project/[id]/editor-actions'

interface ImagePickerPanelProps {
  slide: Slide
  slideIndex: number
  projectId: string
  topic: string
  onUpdate: (updates: Partial<Slide>) => void
  onRegenerateText: () => void
  onRegenerateImage: () => void
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
}: ImagePickerPanelProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'upload'>('search')
  const [query, setQuery] = useState(slide.image_query)
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [regeneratingText, setRegeneratingText] = useState(false)
  const [regeneratingImage, setRegeneratingImage] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const results = await searchBackgroundPhotos(query)
      setPhotos(results)
    } catch {
      // Silently handle search errors
    } finally {
      setSearching(false)
    }
  }

  function handleSelectPhoto(photo: PexelsPhoto) {
    onUpdate({
      background_url: photo.url,
      pexels_photo_id: photo.id,
    })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB')
      return
    }

    setUploading(true)
    try {
      const { signedUrl, publicUrl } = await createUploadUrl(projectId, file.name)

      await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      onUpdate({
        background_url: publicUrl,
        pexels_photo_id: null,
      })
    } catch {
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRegenerateText() {
    setRegeneratingText(true)
    try {
      onRegenerateText()
    } finally {
      setRegeneratingText(false)
    }
  }

  async function handleRegenerateImage() {
    setRegeneratingImage(true)
    try {
      onRegenerateImage()
    } finally {
      setRegeneratingImage(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="image-picker-panel">
      {/* AI Regeneration buttons */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        AI Regenerate
      </h3>

      <div className="flex gap-2">
        <button
          onClick={handleRegenerateText}
          disabled={regeneratingText}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <RefreshCw className={`w-4 h-4 ${regeneratingText ? 'animate-spin' : ''}`} />
          Regen Text
        </button>
        <button
          onClick={handleRegenerateImage}
          disabled={regeneratingImage}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <RefreshCw className={`w-4 h-4 ${regeneratingImage ? 'animate-spin' : ''}`} />
          Regen Image
        </button>
      </div>

      {/* Tabs */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-2">
        Background Image
      </h3>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
            activeTab === 'search'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="w-4 h-4 inline mr-1.5" />
          Search Pexels
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
            activeTab === 'upload'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-1.5" />
          Upload
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search photos..."
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px]"
            >
              {searching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 max-h-[300px] overflow-y-auto">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => handleSelectPhoto(photo)}
                  className="relative group rounded-md overflow-hidden aspect-[9/16] hover:ring-2 hover:ring-primary transition-all"
                >
                  <img
                    src={photo.thumbnail}
                    alt={`Photo by ${photo.photographer}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.photographer}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors min-h-[120px]">
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
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
        </div>
      )}
    </div>
  )
}
