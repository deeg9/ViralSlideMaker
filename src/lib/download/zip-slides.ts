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
  saveAs(content, `${projectTitle}.zip`)
}
