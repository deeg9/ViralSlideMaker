import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { ReferenceImageUploader } from '../reference-image-uploader'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

// Phase 74 Plan 03 (REF-02..REF-06): contract tests for the reference image
// uploader. Verifies REF-06 separation invariant (upload ≠ extraction trigger),
// REF-03 1–8 cap, REF-04 drag-drop + click-to-add + MIME enforcement, REF-05
// 20 MB cap, and the `onUploadComplete` / `onExtractRequested` callback API
// that Phase 75 + Phase 76 will consume.

// ---- Polyfills for jsdom ----
let createObjectURLCalls = 0
let revokeObjectURLCalls: string[] = []

beforeEach(() => {
  createObjectURLCalls = 0
  revokeObjectURLCalls = []
  // Fresh fetch mock per test
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/style-references/upload-url')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              uploadUrl: 'https://supabase.example/upload/signed/abc',
              token: 'tok',
              method: 'PUT',
              headers: { 'Content-Type': 'image/png' },
              path: 'user_123/uuid-pic.png',
            },
          }),
        }
      }
      // Storage PUT
      return { ok: true, json: async () => ({}) }
    }),
  )
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn().mockImplementation(() => {
      createObjectURLCalls++
      return `blob:fake-${createObjectURLCalls}`
    }),
    revokeObjectURL: vi.fn().mockImplementation((url: string) => {
      revokeObjectURLCalls.push(url)
    }),
  } as unknown as typeof URL)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeFile(name: string, type: string, sizeBytes: number): File {
  // Construct a File with a controlled .size — File's native constructor
  // computes size from the blob parts, so we override the getter.
  const f = new File([new Uint8Array(0)], name, { type })
  Object.defineProperty(f, 'size', { value: sizeBytes, configurable: true })
  return f
}

describe('Phase 74 Plan 03 (REF-02..REF-06): ReferenceImageUploader', () => {
  it('Test C1: renders dropzone div and file input with restricted accept attribute', () => {
    render(<ReferenceImageUploader />)
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    expect(dropzone).toBeTruthy()
    // The hidden input should restrict to the 4 allowed MIME types
    const inputs = document.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBe(1)
    const accept = (inputs[0] as HTMLInputElement).accept
    expect(accept).toContain('image/png')
    expect(accept).toContain('image/jpeg')
    expect(accept).toContain('image/webp')
    expect(accept).toContain('image/heic')
    expect(accept).not.toContain('image/svg')
    expect(accept).not.toContain('image/gif')
  })

  it('Test C2: clicking the dropzone fires the hidden file input click', () => {
    render(<ReferenceImageUploader />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const inputClickSpy = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByTestId('reference-uploader-dropzone'))
    expect(inputClickSpy).toHaveBeenCalledTimes(1)
  })

  it('Test C3: drag-drop path triggers upload via fetch (signed-URL + PUT)', async () => {
    const onUploadComplete = vi.fn()
    render(<ReferenceImageUploader onUploadComplete={onUploadComplete} />)
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    const file = makeFile('pic.png', 'image/png', 1000)

    // dragOver flips the dropzone "active" state
    fireEvent.dragOver(dropzone, { dataTransfer: { files: [file] } })
    expect(dropzone.className).toMatch(/active|drag/i)

    // drop triggers the upload pipeline
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalled())
    // Two fetch calls: signed-URL mint + storage PUT
    expect(fetch).toHaveBeenCalledTimes(2)
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      '/api/style-references/upload-url',
    )
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain(
      'supabase.example',
    )
  })

  it('Test C4: adding a 9th image (when 8 are already present) shows inline error and does NOT call fetch', async () => {
    // Pre-seed component with 8 thumbnails by passing initial.
    const initial: ReferenceAssetRow[] = Array.from({ length: 8 }, (_, i) => ({
      url: `seed/path-${i}.png`,
      sha256: '',
      uploaded_at: new Date().toISOString(),
      mime_type: 'image/png',
      size_bytes: 1000,
      original_filename: `seed-${i}.png`,
    }))
    render(<ReferenceImageUploader initial={initial} />)

    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    const file = makeFile('extra.png', 'image/png', 1000)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(screen.getByTestId('uploader-error')).toBeTruthy())
    expect(screen.getByTestId('uploader-error').textContent).toMatch(/8/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('Test C5: disallowed MIME (image/gif) shows inline error and does NOT call fetch (client-side validation)', async () => {
    render(<ReferenceImageUploader />)
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    const file = makeFile('animated.gif', 'image/gif', 1000)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(screen.getByTestId('uploader-error')).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('Test C6: 25 MB file shows inline error and does NOT call fetch', async () => {
    render(<ReferenceImageUploader />)
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    const file = makeFile('huge.png', 'image/png', 25_000_000)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(screen.getByTestId('uploader-error')).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('Test C7: uploaded thumbnail renders <img> + X-to-remove; remove revokes the object URL', async () => {
    render(<ReferenceImageUploader />)
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    const file = makeFile('pic.png', 'image/png', 1000)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      const imgs = document.querySelectorAll('[data-testid="thumb-row"] img')
      expect(imgs.length).toBe(1)
    })

    // The img must have a source pointing at the object URL we minted
    const img = document.querySelector('[data-testid="thumb-row"] img') as HTMLImageElement
    expect(img.src).toContain('blob:fake-1')

    // Click the X (aria-label includes the original filename)
    const removeBtn = screen.getByLabelText(/Remove pic\.png/)
    fireEvent.click(removeBtn)

    // After removal: object URL revoked, thumbnail gone
    expect(revokeObjectURLCalls).toContain('blob:fake-1')
    await waitFor(() => {
      const imgs = document.querySelectorAll('[data-testid="thumb-row"] img')
      expect(imgs.length).toBe(0)
    })
  })

  it('Test C8: Extract style CTA is disabled when 0 thumbs, enabled when 1–8, and clicking does NOT call vision endpoint (REF-06)', async () => {
    const onExtractRequested = vi.fn()
    render(<ReferenceImageUploader onExtractRequested={onExtractRequested} />)

    const cta = screen.getByTestId('extract-style-cta') as HTMLButtonElement
    // 0 thumbs → disabled
    expect(cta.disabled).toBe(true)

    // Add a file → upload → CTA enabled
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    const file = makeFile('pic.png', 'image/png', 1000)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(cta.disabled).toBe(false))

    // Click CTA → onExtractRequested fires with assembled rows; no extra fetch
    const fetchCallsBefore = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length
    fireEvent.click(cta)

    expect(onExtractRequested).toHaveBeenCalledTimes(1)
    const rows = onExtractRequested.mock.calls[0][0] as ReferenceAssetRow[]
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(1)
    expect(rows[0].original_filename).toBe('pic.png')

    // No NEW fetch calls (no vision endpoint invoked)
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      fetchCallsBefore,
    )
  })

  it('Test C9: ReferenceAssetRow shape on upload completion (sha256 placeholder, all required fields)', async () => {
    const onUploadComplete = vi.fn()
    render(<ReferenceImageUploader onUploadComplete={onUploadComplete} />)
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    const file = makeFile('pic.png', 'image/png', 1234)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalled())
    const row = onUploadComplete.mock.calls[0][0] as ReferenceAssetRow
    // url is the storage path returned by the route (NOT a blob URL — blob is
    // only for thumbnail rendering; the row stored to projects.reference_assets
    // must reference the durable storage path)
    expect(row.url).toBe('user_123/uuid-pic.png')
    // sha256 is intentionally a placeholder; Phase 73 prepareForVision computes
    // the real SHA at extraction time. Empty string is the agreed sentinel.
    expect(row.sha256).toBe('')
    expect(typeof row.uploaded_at).toBe('string')
    expect(row.mime_type).toBe('image/png')
    expect(row.size_bytes).toBe(1234)
    expect(row.original_filename).toBe('pic.png')
  })

  it('Test C10: REF-06 separation invariant — onUploadComplete fires on upload, onExtractRequested does NOT (only fires when CTA clicked)', async () => {
    const onUploadComplete = vi.fn()
    const onExtractRequested = vi.fn()
    render(
      <ReferenceImageUploader
        onUploadComplete={onUploadComplete}
        onExtractRequested={onExtractRequested}
      />,
    )
    const dropzone = screen.getByTestId('reference-uploader-dropzone')
    const file = makeFile('pic.png', 'image/png', 1000)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1))
    // Upload alone does NOT fire the extract callback
    expect(onExtractRequested).not.toHaveBeenCalled()

    // Source-grep invariant: component file must NOT call any vision/extraction
    // endpoint. Phase 75 owns extraction; this component is the affordance only.
    // The grep is narrow on purpose — it targets endpoint paths and function
    // calls that would indicate the component is doing extraction itself, NOT
    // the local affordance identifiers ("Extract style" CTA label, the
    // onExtractRequested prop name, the extract-style-cta testid). Those are
    // the contracted UI surface this plan ships.
    const src = fs.readFileSync(
      path.resolve(__dirname, '../reference-image-uploader.tsx'),
      'utf-8',
    )
    // No extraction endpoint paths
    expect(src).not.toMatch(/\/api\/style-references\/extract/)
    expect(src).not.toMatch(/\/api\/(?:vision|gemini)/)
    // No vision/LLM client imports
    expect(src).not.toMatch(/['"]@google\/genai['"]/)
    expect(src).not.toMatch(/from ['"][^'"]*vision[^'"]*['"]/)
    // No call to a function literally named extractStyleSpec (Phase 75's name)
    expect(src).not.toMatch(/\bextractStyleSpec\s*\(/)
  })
})
