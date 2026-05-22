import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'

// Mock file-saver
const mockSaveAs = vi.fn()
vi.mock('file-saver', () => ({
  saveAs: mockSaveAs,
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

/**
 * The slide-render fetch URLs, in order — excludes the fire-and-forget
 * `track-download` POST so assertions focus on the render calls.
 */
function renderFetchUrls(): string[] {
  return mockFetch.mock.calls
    .map((c) => c[0] as string)
    .filter((url) => url.startsWith('/api/render'))
}

describe('downloadSlidesAsZip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake-png'], { type: 'image/png' })),
    })
  })

  it('creates a ZIP with correct number of files named slide-01.png, slide-02.png, etc.', async () => {
    const { downloadSlidesAsZip } = await import('@/lib/download/zip-slides')
    await downloadSlidesAsZip('project-123', 3, 'Test Project')

    expect(renderFetchUrls()).toEqual([
      '/api/render?projectId=project-123&slide=0',
      '/api/render?projectId=project-123&slide=1',
      '/api/render?projectId=project-123&slide=2',
    ])

    // Verify saveAs was called with a blob and filename
    expect(mockSaveAs).toHaveBeenCalledTimes(1)
    const [blob, filename] = mockSaveAs.mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(filename).toBe('Test Project.zip')

    // Verify the ZIP contents
    const zip = await JSZip.loadAsync(blob)
    const files = Object.keys(zip.files)
    expect(files).toHaveLength(3)
    expect(files).toContain('slide-01.png')
    expect(files).toContain('slide-02.png')
    expect(files).toContain('slide-03.png')
  })

  it('forwards the chosen carousel format to /api/render and into the filename', async () => {
    const { downloadSlidesAsZip } = await import('@/lib/download/zip-slides')
    await downloadSlidesAsZip('project-123', 2, 'Test Project', 'instagram')

    // Every slide fetch carries the `&format=` override.
    expect(renderFetchUrls()).toEqual([
      '/api/render?projectId=project-123&slide=0&format=instagram',
      '/api/render?projectId=project-123&slide=1&format=instagram',
    ])

    // Filename is suffixed with the format id + ratio so two exports of the
    // same carousel don't collide.
    const [, filename] = mockSaveAs.mock.calls[0]
    expect(filename).toBe('Test Project-instagram-4x5.zip')
  })
})
