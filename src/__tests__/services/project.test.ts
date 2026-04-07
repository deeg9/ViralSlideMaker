import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => {
  const singleFn = vi.fn()
  const maybeSingleFn = vi.fn()
  const orderFn = vi.fn().mockResolvedValue({ data: [], error: null })
  const eqFn = vi.fn().mockReturnValue({ single: singleFn, maybeSingle: maybeSingleFn, order: orderFn, eq: vi.fn() })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn, order: orderFn })
  const insertFn = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: singleFn }) })
  const deleteFn = vi.fn().mockReturnValue({ eq: eqFn })
  const fromFn = vi.fn().mockReturnValue({
    select: selectFn,
    insert: insertFn,
    delete: deleteFn,
    eq: eqFn,
  })
  return {
    createAdminClient: vi.fn().mockReturnValue({ from: fromFn }),
    _mocks: { fromFn, selectFn, eqFn, singleFn, maybeSingleFn, insertFn, deleteFn, orderFn },
  }
})

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import {
  listProjects,
  getProject,
  createProjectService,
  deleteProjectService,
} from '@/lib/services/project'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { _mocks } = await import('@/lib/supabase/admin') as any

describe('listProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns projects filtered by userId', async () => {
    _mocks.orderFn.mockResolvedValueOnce({
      data: [
        { id: 'proj-1', title: 'Test Project', created_at: '2026-01-01' },
      ],
      error: null,
    })
    const result = await listProjects('user-123')
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('id', 'proj-1')
  })

  it('returns empty array when no projects', async () => {
    _mocks.orderFn.mockResolvedValueOnce({ data: [], error: null })
    const result = await listProjects('user-123')
    expect(result).toEqual([])
  })
})

describe('getProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns project when owned by user', async () => {
    _mocks.maybeSingleFn.mockResolvedValueOnce({
      data: { id: 'proj-1', user_id: 'user-123', title: 'Test', slide_data: [] },
      error: null,
    })
    const result = await getProject('proj-1', 'user-123')
    expect(result).toHaveProperty('id', 'proj-1')
  })

  it('returns null when project not found or not owned', async () => {
    _mocks.maybeSingleFn.mockResolvedValueOnce({ data: null, error: null })
    const result = await getProject('proj-999', 'user-123')
    expect(result).toBeNull()
  })
})

describe('createProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates project with user_id, title, and empty slide_data', async () => {
    _mocks.singleFn.mockResolvedValueOnce({
      data: { id: 'proj-new' },
      error: null,
    })
    const result = await createProjectService('user-123', 'My Carousel')
    expect(result).toHaveProperty('id')
  })

  it('returns created project id', async () => {
    _mocks.singleFn.mockResolvedValueOnce({
      data: { id: 'proj-new' },
      error: null,
    })
    const result = await createProjectService('user-123', 'My Carousel')
    expect(result.id).toBe('proj-new')
  })
})

describe('deleteProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes project owned by user', async () => {
    // Mock successful delete (at least one row affected)
    _mocks.eqFn.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: [{ id: 'proj-1' }], error: null, count: 1 }),
    })
    await expect(deleteProjectService('proj-1', 'user-123')).resolves.not.toThrow()
  })

  it('throws NOT_FOUND when project does not exist', async () => {
    _mocks.eqFn.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: [], error: null, count: 0 }),
    })
    await expect(deleteProjectService('proj-999', 'user-123')).rejects.toThrow()
  })
})
