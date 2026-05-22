'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { FormatPicker } from '@/components/editor/format-picker'
import { Icon } from '@/components/ui/icon'
import { downloadSlidesAsZip } from '@/lib/download/zip-slides'
import {
  CAROUSEL_FORMATS,
  type CarouselFormatId,
} from '@/lib/render/carousel-formats'

interface ExportFormatDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  slideCount: number
  projectTitle: string
  /** The project's own format — what the picker starts on each time it opens. */
  defaultFormat: CarouselFormatId
}

/** A one-line tip per format so the user understands the trade-off. */
const FORMAT_TIP: Record<CarouselFormatId, string> = {
  tiktok: 'Full-screen on TikTok. Gets cropped if posted to an Instagram carousel.',
  instagram: 'Best fit for Instagram feed carousels — fills the most space without cropping.',
  square: 'Never cropped on any platform — safe for TikTok and Instagram alike.',
}

/**
 * Phase 90: download-time format picker. Opened by the editor's Export button.
 * The user designs once and picks the aspect ratio (TikTok 9:16 / Instagram
 * 4:5 / Square 1:1) at download time; the chosen format is forwarded to
 * `/api/render` so every slide PNG renders at that ratio.
 */
export function ExportFormatDialog({
  open,
  onClose,
  projectId,
  slideCount,
  projectTitle,
  defaultFormat,
}: ExportFormatDialogProps) {
  const [selected, setSelected] = useState<CarouselFormatId>(defaultFormat)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset to the project's format (and clear any stale error) every time the
  // dialog reopens — the component stays mounted between opens.
  useEffect(() => {
    if (open) {
      setSelected(defaultFormat)
      setError(null)
    }
  }, [open, defaultFormat])

  const fmt = CAROUSEL_FORMATS[selected]

  async function handleDownload() {
    setExporting(true)
    setError(null)
    try {
      await downloadSlidesAsZip(projectId, slideCount, projectTitle, selected)
      onClose()
    } catch {
      setError('Export failed — please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Ignore close attempts (Escape / backdrop / X) while a download is
        // in flight so the user can't lose the export mid-render.
        if (!next && !exporting) onClose()
      }}
    >
      <DialogContent hideCloseButton={exporting}>
        <div className="p-6 flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Export carousel</DialogTitle>
            <DialogDescription>
              Choose the aspect ratio for this download. All {slideCount}{' '}
              {slideCount === 1 ? 'slide' : 'slides'} export at the same size —
              a carousel can&apos;t mix ratios.
            </DialogDescription>
          </DialogHeader>

          <FormatPicker value={selected} onChange={setSelected} />

          <div className="rounded-xl bg-[#fff0f0] px-4 py-3 text-center">
            <p className="text-sm font-semibold text-[#3d0000]">
              {fmt.w} × {fmt.h} px
              <span className="font-normal text-[#7d6161]">
                {' '}
                · {fmt.ratioLabel}
              </span>
            </p>
            <p className="mt-1 text-xs leading-snug text-[#7d6161]">
              {FORMAT_TIP[selected]}
            </p>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600 text-center">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[#795e5e] hover:bg-[#fadbdb] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={exporting}
              className="px-4 py-2 bg-[#3d0000] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              <Icon name="download" size="sm" />
              <span>{exporting ? 'Exporting...' : `Download ${fmt.label}`}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
