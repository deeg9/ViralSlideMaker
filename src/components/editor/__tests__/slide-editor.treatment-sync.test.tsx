import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SlideEditor } from '@/components/editor/slide-editor'
import { PhotoTreatmentControls } from '@/components/editor/photo-treatment-controls'
import type { TreatmentSpec } from '@/components/editor/photo-treatment-controls'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

/**
 * quick-260502-fv9 — regression suite for the photo-treatment dispatch
 * sync bug. The TextEditorPanel mock is a thin probe that mounts the real
 * <PhotoTreatmentControls> so the dispatch ↔ active-button ↔ preview path
 * stays real, sparing the test from the panel's full surface area. Heavy
 * children are stubbed.
 */

function makeSlide(
  style?: Partial<NonNullable<Slide['style_overrides']>>,
  backgroundUrl?: string,
): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: backgroundUrl ?? 'https://example.com/photo.png',
    original_source_url: 'https://example.com/photo.png',
    pexels_photo_id: null,
    ...(style ? { style_overrides: style as SlideStyleOverrides } : {}),
  }
}

const updateSlideTreatmentMock = vi.fn(async () => ({
  success: true as const,
  slide: makeSlide(
    { treatment_applied: 'duotone-cream', grain_intensity: 'off' },
    'https://x.test/treated.png',
  ),
}))

vi.mock('@/app/(dashboard)/project/[id]/editor-actions', () => ({
  saveSlideData: vi.fn().mockResolvedValue(undefined),
  saveTemplateId: vi.fn().mockResolvedValue(undefined),
  regenerateSlideText: vi.fn(),
  regenerateSlideImageQuery: vi.fn(),
  updateSlideTreatment: (...args: unknown[]) => updateSlideTreatmentMock(...args),
  updateSlideWatermark: vi.fn(async () => ({ success: true })),
  createUploadUrl: vi.fn(async () => ({
    signedUrl: 'https://x.test/sig',
    publicUrl: 'https://x.test/pub.png',
  })),
}))

// Probe: render the real PhotoTreatmentControls so we click the actual
// duotone/grain buttons and B&W Switch. Pass the props TextEditorPanel forwards.
vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: (props: {
    slide: Slide
    template: SlideTemplate
    onSlideTreatmentChange?: (spec: TreatmentSpec) => void
    isTreatmentPending?: boolean
  }) => (
    <PhotoTreatmentControls
      slide={props.slide}
      template={props.template}
      isPending={props.isTreatmentPending ?? false}
      onTreatmentChange={props.onSlideTreatmentChange}
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

describe('SlideEditor — treatment dispatch sync (quick-260502-fv9)', () => {
  beforeEach(() => {
    updateSlideTreatmentMock.mockClear()
  })

  it('pick Cream from Off: button flips synchronously AND server fires with the right spec', async () => {
    renderEditor(makeSlide())
    const creamBtn = screen.getByRole('radio', { name: 'Cream' })
    expect(creamBtn.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(creamBtn)

    // Local state synced — the active duotone button flips to Cream
    // without awaiting the network (optimistic dispatch).
    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: 'Cream' }).getAttribute('aria-checked'),
      ).toBe('true'),
    )
    expect(updateSlideTreatmentMock).toHaveBeenCalledTimes(1)
    expect(updateSlideTreatmentMock).toHaveBeenCalledWith(
      'p-test',
      0,
      { kind: 'duotone-cream', grain: 'off' },
    )
  })

  it('Off→Off no-op: dispatch resilient, server still fires once with kind=none', async () => {
    renderEditor(makeSlide())
    // Two "Off" radios exist — duotone Off is rendered first per DUOTONE_OPTIONS
    // (none, cream, cobalt) before the grain row.
    const offButtons = screen.getAllByRole('radio', { name: 'Off' })
    expect(offButtons.length).toBeGreaterThanOrEqual(2)
    const duotoneOff = offButtons[0]
    expect(duotoneOff.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(duotoneOff)

    // Active state of duotone Off persists across optimistic + server dispatches.
    await waitFor(() => {
      const stillOff = screen.getAllByRole('radio', { name: 'Off' })[0]
      expect(stillOff.getAttribute('aria-checked')).toBe('true')
    })
    expect(updateSlideTreatmentMock).toHaveBeenCalledTimes(1)
    expect(updateSlideTreatmentMock).toHaveBeenCalledWith(
      'p-test',
      0,
      { kind: 'none', grain: 'off' },
    )
  })

  it('grain switch while Cream active: Medium flips, Cream stays, server gets {duotone-cream, medium}', async () => {
    renderEditor(
      makeSlide(
        { treatment_applied: 'duotone-cream', grain_intensity: 'off' },
        'https://x.test/cream-already.png',
      ),
    )
    // Sanity: Cream + grain Off both active before the click.
    expect(
      screen.getByRole('radio', { name: 'Cream' }).getAttribute('aria-checked'),
    ).toBe('true')
    const mediumBtn = screen.getByRole('radio', { name: 'Medium' })
    expect(mediumBtn.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(mediumBtn)

    // Optimistic: Medium flips on, Cream remains (emit forwards activeKind).
    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked'),
      ).toBe('true')
      expect(
        screen.getByRole('radio', { name: 'Cream' }).getAttribute('aria-checked'),
      ).toBe('true')
    })
    expect(updateSlideTreatmentMock).toHaveBeenCalledTimes(1)
    expect(updateSlideTreatmentMock).toHaveBeenCalledWith(
      'p-test',
      0,
      { kind: 'duotone-cream', grain: 'medium' },
    )
  })
})
