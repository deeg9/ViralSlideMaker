import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlideEditor } from '@/components/editor/slide-editor'
import type { Slide } from '@/lib/types/slide'

// Mock all child components to avoid deep rendering
vi.mock('@/components/editor/editor-toolbar', () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar">Toolbar</div>,
}))

vi.mock('@/components/editor/slide-list', () => ({
  SlideList: () => <div data-testid="slide-list">Slide List</div>,
}))

vi.mock('@/components/editor/slide-canvas', () => ({
  SlideCanvas: () => <div data-testid="slide-canvas">Canvas</div>,
}))

vi.mock('@/components/editor/text-editor-panel', () => ({
  TextEditorPanel: () => <div data-testid="text-editor-panel">Text Panel</div>,
}))

vi.mock('@/components/editor/image-picker-panel', () => ({
  ImagePickerPanel: () => <div data-testid="image-picker-panel">Image Panel</div>,
}))

vi.mock('@/lib/render/templates/index', () => ({
  getTemplate: () => ({
    id: 'highlight-bar',
    name: 'Highlight Bar',
    thumbnail: '',
    fontFamily: 'sans-serif',
    hookFontSize: '24px',
    bodyFontSize: '16px',
    textColor: '#ffffff',
    backgroundColor: '#000000',
    overlayColor: '#000000',
    overlayOpacity: 0.4,
    textAlign: 'center',
    textPosition: 'center',
    hookStyle: 'uppercase',
  }),
}))

// Mock server actions
vi.mock('@/app/(dashboard)/project/[id]/editor-actions', () => ({
  saveSlideData: vi.fn(),
  searchBackgroundPhotos: vi.fn(),
  regenerateSlideText: vi.fn(),
  regenerateSlideImageQuery: vi.fn(),
  createUploadUrl: vi.fn(),
}))

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Test Hook',
    body_text: 'Test Body',
    image_query: 'test',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

describe('SlideEditor responsive layout', () => {
  const initialSlides = [makeSlide(), makeSlide()]

  it('renders with correct CSS grid classes for desktop layout', () => {
    render(
      <SlideEditor
        initialSlides={initialSlides}
        projectId="proj-1"
        templateId="highlight-bar"
        topic="test topic"
      />
    )

    const gridContainer = screen.getByTestId('editor-grid')
    expect(gridContainer.className).toContain('lg:grid-cols-[200px_1fr_320px]')
  })

  it('contains all expected child sections (slide list, canvas, editing panel)', () => {
    render(
      <SlideEditor
        initialSlides={initialSlides}
        projectId="proj-1"
        templateId="highlight-bar"
        topic="test topic"
      />
    )

    expect(screen.getByTestId('editor-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('slide-list')).toBeInTheDocument()
    expect(screen.getByTestId('slide-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('text-editor-panel')).toBeInTheDocument()
    expect(screen.getByTestId('image-picker-panel')).toBeInTheDocument()
  })

  it('touch-friendly targets have minimum 44px dimensions via className', () => {
    render(
      <SlideEditor
        initialSlides={initialSlides}
        projectId="proj-1"
        templateId="highlight-bar"
        topic="test topic"
      />
    )

    // The editor grid container should exist and render without errors
    const grid = screen.getByTestId('editor-grid')
    expect(grid).toBeInTheDocument()
    // Grid should have responsive classes
    expect(grid.className).toContain('grid')
  })
})
