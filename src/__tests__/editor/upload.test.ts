import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client -- must use inline factory to avoid hoisting issues
vi.mock('@/lib/supabase/server', () => {
  const createSignedUploadUrl = vi.fn()
  const getPublicUrl = vi.fn()
  const storageFrom = vi.fn().mockReturnValue({
    createSignedUploadUrl,
    getPublicUrl,
  })

  return {
    createClient: vi.fn().mockResolvedValue({
      storage: { from: storageFrom },
    }),
    __mocks: { createSignedUploadUrl, getPublicUrl, storageFrom },
  }
})

// Mock GoogleGenAI to prevent constructor error at module load
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = { generateContent: vi.fn() }
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
  }
})

// Mock pexels
vi.mock('@/lib/pexels/search-photos', () => ({
  searchPhotos: vi.fn(),
}))

import { createUploadUrl } from '@/app/(dashboard)/project/[id]/editor-actions'
import { createClient } from '@/lib/supabase/server'

// Access the internal mocks
const mocks = (await import('@/lib/supabase/server')) as unknown as {
  __mocks: {
    createSignedUploadUrl: ReturnType<typeof vi.fn>
    getPublicUrl: ReturnType<typeof vi.fn>
    storageFrom: ReturnType<typeof vi.fn>
  }
}

describe('createUploadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.__mocks.storageFrom.mockReturnValue({
      createSignedUploadUrl: mocks.__mocks.createSignedUploadUrl,
      getPublicUrl: mocks.__mocks.getPublicUrl,
    })
  })

  it('returns { signedUrl, path, publicUrl } with correct path format', async () => {
    const projectId = 'proj-123'
    const fileName = 'photo.jpg'

    mocks.__mocks.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: 'https://supabase.co/storage/upload/signed-token',
        path: `${projectId}/1234567890-${fileName}`,
        token: 'token-123',
      },
      error: null,
    })

    mocks.__mocks.getPublicUrl.mockReturnValue({
      data: {
        publicUrl: `https://supabase.co/storage/slide-backgrounds/${projectId}/1234567890-${fileName}`,
      },
    })

    const result = await createUploadUrl(projectId, fileName)

    expect(result).toHaveProperty('signedUrl')
    expect(result).toHaveProperty('path')
    expect(result).toHaveProperty('publicUrl')
    expect(typeof result.signedUrl).toBe('string')
    expect(typeof result.publicUrl).toBe('string')
  })

  it('path follows pattern ${projectId}/${timestamp}-${fileName}', async () => {
    const projectId = 'proj-456'
    const fileName = 'image.png'

    mocks.__mocks.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: 'https://supabase.co/storage/upload/signed',
        path: `${projectId}/9999999-${fileName}`,
        token: 'tok',
      },
      error: null,
    })

    mocks.__mocks.getPublicUrl.mockReturnValue({
      data: {
        publicUrl: `https://supabase.co/storage/slide-backgrounds/${projectId}/9999999-${fileName}`,
      },
    })

    const result = await createUploadUrl(projectId, fileName)

    // Path should match the pattern projectId/timestamp-fileName
    expect(result.path).toMatch(new RegExp(`^${projectId}/\\d+-${fileName}$`))
  })
})
