import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { CAROUSEL_FORMATS, type CarouselFormatId } from '@/lib/render/carousel-formats'

/**
 * Fetch every slide as a PNG, bundle them into a ZIP and trigger a download.
 *
 * Phase 90: `format` is the aspect ratio chosen in the Export dialog. When set
 * it is forwarded to `/api/render` as `?format=` so the slides render at that
 * ratio (TikTok 9:16 / Instagram 4:5 / Square 1:1), and is folded into the ZIP
 * filename so two different-ratio exports of the same carousel don't collide.
 * When omitted the project's own stored format is used (legacy callers).
 */
export async function downloadSlidesAsZip(
  projectId: string,
  slideCount: number,
  projectTitle: string,
  format?: CarouselFormatId
): Promise<void> {
  const zip = new JSZip()

  const formatQuery = format ? `&format=${format}` : ''

  // Fetch all slides in parallel
  const fetchPromises = Array.from({ length: slideCount }, (_, i) =>
    fetch(`/api/render?projectId=${projectId}&slide=${i}${formatQuery}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch slide ${i + 1}`)
        return res.blob()
      })
  )

  const blobs = await Promise.all(fetchPromises)

  // Add each slide to the ZIP
  blobs.forEach((blob, i) => {
    const num = String(i + 1).padStart(2, '0')
    zip.file(`slide-${num}.png`, blob)
  })

  // Generate and trigger download
  const content = await zip.generateAsync({ type: 'blob' })

  // Phase 54 (METRIC-01, D-18): fire-and-forget download tracking. NEVER
  // block the user's download on tracking failure. Server reads template_id
  // and user_tier from the project record server-side; client provides
  // slide_count for cheap denormalization.
  try {
    void fetch(`/api/v1/projects/${projectId}/track-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slide_count: slideCount }),
      keepalive: true,
    })
  } catch {
    // swallow — tracking failure must NOT prevent the user's download
  }

  // Format-aware filename — e.g. "My Carousel-instagram-4x5.zip".
  const suffix = format
    ? `-${format}-${CAROUSEL_FORMATS[format].ratioLabel.replace(':', 'x')}`
    : ''
  saveAs(content, `${projectTitle}${suffix}.zip`)
}
