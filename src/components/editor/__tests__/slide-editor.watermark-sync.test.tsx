import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SlideEditor } from '@/components/editor/slide-editor'
import { WatermarkControls } from '@/components/editor/watermark-controls'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

/**
 * quick-260502-ik8 — regression suite for the project-wide watermark
 * broadcast. The TextEditorPanel mock mounts the real <WatermarkControls>
 * so the dispatch ↔ Switch ↔ preview path stays real. The SlideList stub
 * captures the latest `slides` prop so tests can assert the broadcast hit
 * EVERY slide (not just the active one), which is the whole point of the
 * fix vs. the prior per-slide write path.
 *
 * Supersedes the quick-260502-fai dispatch-sync test — same probe pattern,
 * retargeted to the broadcast server action and broadened to two-slide
 * projects.
 */

let lastSlidesSnapshot: Slide[] = []
let lastProbedSlide: Slide | null = null

const updateProjectWatermarkMock = vi.fn(async () => ({
  success: true as const,
  slides: [] as Slide[],
}))
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
  updateProjectWatermark: (...args: unknown[]) => updateProjectWatermarkMock(...(args as [])),
  createUploadUrl: (...args: unknown[]) => createUploadUrlMock(...(args as [])),
}))

// Probe: render the real WatermarkControls so we can click the actual
// Switch / Remove button. Pass the same props TextEditorPanel forwards.
// Stash the active `slide` prop so tests can introspect the active-slide
// view if needed (lastSlidesSnapshot below covers cross-slide assertions).
vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: (props: {
    slide: Slide
    userTier?: 'free' | 'plus' | 'pro'
    onSlideWatermarkChange?: (spec: NonNullable<SlideStyleOverrides['watermark']>) => void
    onWatermarkLogoUpload?: (file: File) => void
    onWatermarkLogoRemove?: () => void
    isWatermarkPending?: boolean
  }) => {
    lastProbedSlide = props.slide
    return (
      <WatermarkControls
        slide={props.slide}
        userTier={props.userTier ?? 'free'}
        isPending={props.isWatermarkPending ?? false}
        onWatermarkChange={props.onSlideWatermarkChange}
        onCustomLogoUpload={props.onWatermarkLogoUpload}
        onCustomLogoRemove={props.onWatermarkLogoRemove}
      />
    )
  },
}))

// SlideList probe: capture the full slides prop so tests can assert the
// broadcast applied to every slide. The real SlideList receives `slides`
// from the editor's reducer state, so this snapshot reflects the post-
// dispatch present state.
vi.mock('@/components/editor/slide-list', () => ({
  SlideList: (props: { slides: Slide[] }) => {
    lastSlidesSnapshot = props.slides
    return null
  },
}))

// Stub heavy children we don't exercise.
vi.mock('@/components/editor/text-editor-panel-legacy', () => ({ LegacyTextEditorPanel: () => null }))
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

function renderEditor(slides: Slide[]) {
  return render(
    <SlideEditor
      initialSlides={slides}
      projectId="p-test"
      templateId="highlight-bar"
      topic="test"
      userTier="pro"
    />,
  )
}

describe('SlideEditor — watermark broadcast (quick-260502-ik8)', () => {
  beforeEach(() => {
    updateProjectWatermarkMock.mockClear()
    createUploadUrlMock.mockClear()
    lastProbedSlide = null
    lastSlidesSnapshot = []
  })

  it('toggle ON broadcasts enabled:true to ALL slides', async () => {
    renderEditor([makeSlide(), makeSlide()])
    const switchEl = screen.getByLabelText('Show watermark')
    expect(switchEl.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(switchEl)

    await waitFor(() => {
      expect(lastSlidesSnapshot.length).toBe(2)
      expect(lastSlidesSnapshot[0].style_overrides?.watermark?.enabled).toBe(true)
      expect(lastSlidesSnapshot[1].style_overrides?.watermark?.enabled).toBe(true)
    })
    // Active slide reflects the broadcast too (probe surface).
    expect(lastProbedSlide?.style_overrides?.watermark?.enabled).toBe(true)
    expect(updateProjectWatermarkMock).toHaveBeenCalledTimes(1)
    expect(updateProjectWatermarkMock).toHaveBeenCalledWith(
      'p-test',
      expect.objectContaining({ enabled: true }),
    )
  })

  it('toggle OFF broadcasts enabled:false to ALL slides', async () => {
    renderEditor([
      makeSlide({ enabled: true }),
      makeSlide({ enabled: true }),
    ])
    const switchEl = screen.getByLabelText('Show watermark')
    expect(switchEl.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(switchEl)

    await waitFor(() => {
      expect(lastSlidesSnapshot[0].style_overrides?.watermark?.enabled).toBe(false)
      expect(lastSlidesSnapshot[1].style_overrides?.watermark?.enabled).toBe(false)
    })
    expect(updateProjectWatermarkMock).toHaveBeenCalledTimes(1)
    expect(updateProjectWatermarkMock).toHaveBeenCalledWith(
      'p-test',
      expect.objectContaining({ enabled: false }),
    )
  })

  it('logo remove broadcasts customLogoUrl:undefined to ALL slides', async () => {
    renderEditor([
      makeSlide({ enabled: true, customLogoUrl: 'https://x.test/logo.png' }),
      makeSlide({ enabled: true, customLogoUrl: 'https://x.test/logo.png' }),
    ])
    // Sanity: thumbnail rendered on the active slide, Upload button hidden.
    expect(screen.getByAltText('Custom watermark logo')).toBeTruthy()
    expect(screen.queryByText(/Upload logo/i)).toBeNull()

    fireEvent.click(screen.getByText(/^Remove$/))

    await waitFor(() => {
      expect(lastSlidesSnapshot[0].style_overrides?.watermark?.customLogoUrl).toBeUndefined()
      expect(lastSlidesSnapshot[1].style_overrides?.watermark?.customLogoUrl).toBeUndefined()
    })
    // Local state synced — preview gone, upload button back.
    expect(screen.queryByAltText('Custom watermark logo')).toBeNull()
    expect(screen.getByText(/Upload logo/i)).toBeTruthy()
    expect(updateProjectWatermarkMock).toHaveBeenCalledTimes(1)
    expect(updateProjectWatermarkMock).toHaveBeenCalledWith(
      'p-test',
      expect.objectContaining({ customLogoUrl: undefined }),
    )
  })

  it('broadcast preserves sibling style_overrides on every slide', async () => {
    const s0: Slide = {
      ...makeSlide(),
      style_overrides: {
        hook_position: { x: 50, y: 10 },
        watermark: { enabled: false },
      },
    }
    const s1: Slide = {
      ...makeSlide(),
      style_overrides: {
        hook_position: { x: 50, y: 90 },
        treatment_applied: 'duotone-cream',
        grain_intensity: 'medium',
        watermark: { enabled: false },
      },
    }
    renderEditor([s0, s1])

    fireEvent.click(screen.getByLabelText('Show watermark'))

    await waitFor(() => {
      expect(lastSlidesSnapshot[0].style_overrides?.watermark?.enabled).toBe(true)
      expect(lastSlidesSnapshot[0].style_overrides?.hook_position).toEqual({ x: 50, y: 10 })
      expect(lastSlidesSnapshot[1].style_overrides?.watermark?.enabled).toBe(true)
      expect(lastSlidesSnapshot[1].style_overrides?.hook_position).toEqual({ x: 50, y: 90 })
      expect(lastSlidesSnapshot[1].style_overrides?.treatment_applied).toBe('duotone-cream')
      expect(lastSlidesSnapshot[1].style_overrides?.grain_intensity).toBe('medium')
    })
    expect(updateProjectWatermarkMock).toHaveBeenCalledWith(
      'p-test',
      expect.objectContaining({ enabled: true }),
    )
  })
})
