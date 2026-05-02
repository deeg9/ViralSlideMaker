import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SlideEditor } from '@/components/editor/slide-editor'
import { WatermarkControls } from '@/components/editor/watermark-controls'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

/**
 * quick-260502-fai — regression suite for the paid-tier watermark
 * dispatch-sync bug. The TextEditorPanel mock is a thin probe that
 * mounts the real <WatermarkControls> so the dispatch ↔ Switch ↔
 * preview path stays real, sparing the test from the panel's full
 * surface area. The other heavy children are stubbed out.
 */

const updateSlideWatermarkMock = vi.fn(async () => ({ success: true as const }))
const createUploadUrlMock = vi.fn(async () => ({
  signedUrl: 'https://x.test/sig',
  publicUrl: 'https://x.test/pub.png',
}))

vi.mock('@/app/(dashboard)/project/[id]/editor-actions', () => ({
  saveSlideData: vi.fn().mockResolvedValue(undefined),
  saveTemplateId: vi.fn().mockResolvedValue(undefined),
  regenerateSlideText: vi.fn(),
  regenerateSlideImageQuery: vi.fn(),
  updateSlideTreatment: vi.fn(async () => ({ success: true })),
  updateSlideWatermark: (...args: unknown[]) => updateSlideWatermarkMock(...args),
  createUploadUrl: (...args: unknown[]) => createUploadUrlMock(...args),
}))

// Probe: render the real WatermarkControls so we can click the actual
// Switch / Remove button. Pass the same props TextEditorPanel forwards.
vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: (props: {
    slide: Slide
    userTier?: 'free' | 'plus' | 'pro'
    onSlideWatermarkChange?: (spec: NonNullable<SlideStyleOverrides['watermark']>) => void
    onWatermarkLogoUpload?: (file: File) => void
    onWatermarkLogoRemove?: () => void
    isWatermarkPending?: boolean
  }) => (
    <WatermarkControls
      slide={props.slide}
      userTier={props.userTier ?? 'free'}
      isPending={props.isWatermarkPending ?? false}
      onWatermarkChange={props.onSlideWatermarkChange}
      onCustomLogoUpload={props.onWatermarkLogoUpload}
      onCustomLogoRemove={props.onWatermarkLogoRemove}
    />
  ),
}))

// Stub heavy children we don't exercise.
vi.mock('@/components/editor/text-editor-panel-legacy', () => ({ LegacyTextEditorPanel: () => null }))
vi.mock('@/components/editor/slide-list', () => ({ SlideList: () => null }))
vi.mock('@/components/editor/slide-canvas', () => ({ SlideCanvas: () => null }))
vi.mock('@/components/editor/image-picker-panel', () => ({ ImagePickerPanel: () => null }))
vi.mock('@/components/editor/visibility-dropdown', () => ({ VisibilityDropdown: () => null }))
vi.mock('@/components/captions/caption-panel', () => ({ CaptionPanel: () => null }))
vi.mock('@/lib/download/zip-slides', () => ({ downloadSlidesAsZip: vi.fn() }))

function makeSlide(watermark?: NonNullable<SlideStyleOverrides['watermark']>): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: 'https://example.com/photo.png',
    pexels_photo_id: null,
    ...(watermark ? { style_overrides: { watermark } } : {}),
  }
}

function renderEditor(slide: Slide) {
  return render(
    <SlideEditor
      initialSlides={[slide]}
      projectId="p-test"
      templateId="highlight-bar"
      topic="test"
      userTier="pro"
    />,
  )
}

describe('SlideEditor — watermark dispatch sync (quick-260502-fai)', () => {
  beforeEach(() => {
    updateSlideWatermarkMock.mockClear()
    createUploadUrlMock.mockClear()
  })

  it('toggle ON: Switch flips immediately AND server action fires', async () => {
    renderEditor(makeSlide())
    const switchEl = screen.getByLabelText('Show watermark')
    expect(switchEl.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(switchEl)

    // Local state synced — Switch reflects enabled:true without awaiting the network.
    await waitFor(() =>
      expect(screen.getByLabelText('Show watermark').getAttribute('aria-checked')).toBe('true'),
    )
    expect(updateSlideWatermarkMock).toHaveBeenCalledTimes(1)
    expect(updateSlideWatermarkMock).toHaveBeenCalledWith(
      'p-test',
      0,
      expect.objectContaining({ enabled: true }),
    )
  })

  it('toggle OFF: Switch flips immediately AND server action fires', async () => {
    renderEditor(makeSlide({ enabled: true }))
    const switchEl = screen.getByLabelText('Show watermark')
    expect(switchEl.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(switchEl)

    await waitFor(() =>
      expect(screen.getByLabelText('Show watermark').getAttribute('aria-checked')).toBe('false'),
    )
    expect(updateSlideWatermarkMock).toHaveBeenCalledTimes(1)
    expect(updateSlideWatermarkMock).toHaveBeenCalledWith(
      'p-test',
      0,
      expect.objectContaining({ enabled: false }),
    )
  })

  it('logo remove: thumbnail disappears, Upload button returns, server action fires', async () => {
    renderEditor(makeSlide({ enabled: true, customLogoUrl: 'https://x.test/logo.png' }))
    // Sanity: thumbnail rendered, Upload button hidden
    expect(screen.getByAltText('Custom watermark logo')).toBeTruthy()
    expect(screen.queryByText(/Upload logo/i)).toBeNull()

    fireEvent.click(screen.getByText(/^Remove$/))

    // Local state synced — preview gone, upload button back.
    await waitFor(() => {
      expect(screen.queryByAltText('Custom watermark logo')).toBeNull()
      expect(screen.getByText(/Upload logo/i)).toBeTruthy()
    })
    expect(updateSlideWatermarkMock).toHaveBeenCalledTimes(1)
    expect(updateSlideWatermarkMock).toHaveBeenCalledWith(
      'p-test',
      0,
      expect.objectContaining({ customLogoUrl: undefined }),
    )
  })
})
