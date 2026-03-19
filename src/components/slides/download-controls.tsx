'use client'

import { useState } from 'react'
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
      <div className="flex items-center gap-3">
        <button
          onClick={handleDownloadZip}
          disabled={isDownloading}
          className="rounded-lg bg-foreground text-background px-6 py-2.5 text-sm font-medium
            hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-2"
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
            'Download All (ZIP)'
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: slideCount }, (_, i) => (
          <a
            key={i}
            href={`/api/render?projectId=${projectId}&slide=${i}&download=1`}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium
              hover:bg-muted transition-colors"
          >
            Slide {i + 1}
          </a>
        ))}
      </div>
    </div>
  )
}
