'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { downloadSlidesAsZip } from '@/lib/download/zip-slides'

interface DownloadControlsProps {
  projectId: string
  slideCount: number
  projectTitle: string
}

export function DownloadControls({
  projectId,
  slideCount,
  projectTitle,
}: DownloadControlsProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  async function handleDownloadZip() {
    setIsDownloading(true)
    try {
      await downloadSlidesAsZip(projectId, slideCount, projectTitle)
    } catch (err) {
      console.error('ZIP download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  if (slideCount === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={handleDownloadZip}
        disabled={isDownloading}
        className="inline-flex items-center justify-center gap-2 bg-[#3d0000] text-white px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 w-fit"
      >
        {isDownloading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Downloading...
          </>
        ) : (
          <>
            <Icon name="download" size="sm" />
            Download All (ZIP)
          </>
        )}
      </button>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: slideCount }, (_, i) => (
          <a
            key={i}
            href={`/api/render?projectId=${projectId}&slide=${i}&download=1`}
            className="rounded-xl border border-[#dbc1bc]/30 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#3d0000] hover:bg-[#fadbdb] transition-colors"
          >
            Slide {i + 1}
          </a>
        ))}
      </div>
    </div>
  )
}
