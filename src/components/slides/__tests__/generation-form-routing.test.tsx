// Routing smoke test for GenerationForm's prompt-arrow submit handler.
//
// History: this file once pinned a spec-vs-topic routing branch — the
// "Copy style" / style-from-reference path that routed through
// regenerateAction. That collapsible was removed from the prompt form, so
// the branch is gone; submitting the prompt now always routes through
// generateCarousel. This is the surviving topic-flow regression guard.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ---- Hoisted mocks ----
const {
  mockGenerateCarousel,
  mockCreateUploadUrl,
  mockRouterRefresh,
  mockRouterPush,
} = vi.hoisted(() => ({
  mockGenerateCarousel: vi.fn(),
  mockCreateUploadUrl: vi.fn(),
  mockRouterRefresh: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock('@/app/(dashboard)/project/[id]/actions', () => ({
  generateCarousel: mockGenerateCarousel,
}))

vi.mock('@/app/(dashboard)/project/[id]/editor-actions', () => ({
  createUploadUrl: mockCreateUploadUrl,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn(), refresh: mockRouterRefresh }),
}))

import { GenerationForm } from '../generation-form'

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateCarousel.mockReset()
  mockCreateUploadUrl.mockReset()
  mockRouterRefresh.mockReset()
  mockRouterPush.mockReset()
  mockGenerateCarousel.mockResolvedValue({ success: true, slideCount: 7 })
})

describe('GenerationForm routing', () => {
  it('routes a plain topic submit to generateCarousel', async () => {
    render(<GenerationForm projectId="p1" hasSlides={false} />)

    const textarea = screen.getByPlaceholderText(/5 tips for growing/i)
    fireEvent.change(textarea, { target: { value: 'plain topic' } })

    await act(async () => {
      // aria-label="Generate carousel" is unique to the prompt-arrow button
      // (the lower "Generate Carousel" submit button has no aria-label).
      fireEvent.click(screen.getByLabelText('Generate carousel'))
    })

    await waitFor(() => {
      expect(mockGenerateCarousel).toHaveBeenCalledTimes(1)
    })
    // Action signature: (projectId, topic, templateId, imageSource, slideCount, advancedOptions, category)
    const call = mockGenerateCarousel.mock.calls[0]
    expect(call[0]).toBe('p1')
    expect(call[1]).toBe('plain topic')
  })
})
