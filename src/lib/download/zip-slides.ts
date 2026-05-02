import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export async function downloadSlidesAsZip(
  projectId: string,
  slideCount: number,
  projectTitle: string
): Promise<void> {
  const zip = new JSZip()

  // Fetch all slides in parallel
  const fetchPromises = Array.from({ length: slideCount }, (_, i) =>
    fetch(`/api/render?projectId=${projectId}&slide=${i}`)
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

  saveAs(content, `${projectTitle}.zip`)
}
