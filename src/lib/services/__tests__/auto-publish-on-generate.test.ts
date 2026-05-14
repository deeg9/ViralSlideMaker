// quick-260514-k3j: autoPublishOnGenerate is the single source of truth for
// "newly-generated carousels default to Public". Every generation entry point
// calls it. These tests assert:
//   1. The success path forwards admin/userId/projectId/title to publishProjectAdmin.
//   2. A failed publish result is logged and swallowed (best-effort).
//   3. A thrown error from publishProjectAdmin is logged and swallowed.
// Failure must never unwind generation — the slide data is already persisted.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockPublishProjectAdmin = vi.hoisted(() => vi.fn())

vi.mock('../publish', () => ({
  publishProjectAdmin: mockPublishProjectAdmin,
}))

import { autoPublishOnGenerate } from '../auto-publish-on-generate'
import type { SupabaseClient } from '@supabase/supabase-js'

const FAKE_ADMIN = {} as SupabaseClient

beforeEach(() => {
  mockPublishProjectAdmin.mockReset()
})

describe('autoPublishOnGenerate', () => {
  it('forwards admin/userId/projectId/title to publishProjectAdmin on success', async () => {
    mockPublishProjectAdmin.mockResolvedValueOnce({
      success: true,
      publishedId: 'pub-1',
      slug: 'pub-slug-1',
      heroUrl: 'https://cdn.example.com/hero.png',
    })
    await autoPublishOnGenerate(FAKE_ADMIN, 'user-1', 'proj-1', 'My Carousel')
    expect(mockPublishProjectAdmin).toHaveBeenCalledTimes(1)
    expect(mockPublishProjectAdmin).toHaveBeenCalledWith(FAKE_ADMIN, 'user-1', 'proj-1', {
      title: 'My Carousel',
    })
  })

  describe('best-effort failure handling', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>
    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
      warnSpy.mockRestore()
    })

    it('swallows a returned failure result and logs a warning', async () => {
      mockPublishProjectAdmin.mockResolvedValueOnce({
        success: false,
        error: 'Hero render failed',
        status: 500,
      })
      await expect(
        autoPublishOnGenerate(FAKE_ADMIN, 'user-1', 'proj-1', 'My Carousel'),
      ).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][0]).toContain('proj-1')
      expect(warnSpy.mock.calls[0][0]).toContain('Hero render failed')
    })

    it('swallows a thrown error and logs a warning', async () => {
      mockPublishProjectAdmin.mockRejectedValueOnce(new Error('boom'))
      await expect(
        autoPublishOnGenerate(FAKE_ADMIN, 'user-1', 'proj-1', 'My Carousel'),
      ).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][0]).toContain('proj-1')
    })
  })
})
