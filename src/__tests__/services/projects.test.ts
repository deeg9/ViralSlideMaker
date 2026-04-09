import { describe, it, expect, vi } from 'vitest'
import {
  listProjects,
  getProject,
  createProjectService,
  deleteProjectService,
  updateProjectService,
} from '@/lib/services/projects'

function createMockSupabase(options: {
  selectData?: unknown
  singleData?: unknown
  insertData?: unknown
  error?: { message: string } | null
} = {}) {
  const { selectData = [], singleData = null, insertData = null, error = null } = options

  const singleFn = vi.fn().mockResolvedValue({ data: singleData ?? insertData, error })
  const orderFn = vi.fn().mockResolvedValue({ data: selectData, error })

  // Create a chainable object that supports arbitrary .eq().eq().single()/.order() chains
  // and also resolves as a promise for terminal operations like delete
  const chainable: Record<string, unknown> = {}
  const eqFn = vi.fn().mockImplementation(() => chainable)
  chainable.eq = eqFn
  chainable.single = singleFn
  chainable.order = orderFn
  // Allow chainable to resolve as promise (for delete/update terminal .eq())
  chainable.then = (resolve: (v: unknown) => void) => resolve({ error })

  const selectFn = vi.fn().mockReturnValue({ eq: eqFn, order: orderFn })
  const insertFn = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: singleFn }) })
  const deleteFn = vi.fn().mockReturnValue(chainable)
  const updateFn = vi.fn().mockReturnValue(chainable)

  const fromFn = vi.fn().mockReturnValue({
    select: selectFn,
    insert: insertFn,
    delete: deleteFn,
    update: updateFn,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = { from: fromFn } as any

  return { supabase, fromFn, selectFn, insertFn, deleteFn, updateFn, eqFn, orderFn, singleFn }
}

describe('listProjects', () => {
  it('queries projects filtered by user_id and ordered by updated_at desc', async () => {
    const mockData = [{ id: '1', title: 'Project 1' }, { id: '2', title: 'Project 2' }]
    const { supabase, fromFn, selectFn, orderFn } = createMockSupabase({ selectData: mockData })

    const result = await listProjects(supabase, 'user-123')

    expect(fromFn).toHaveBeenCalledWith('projects')
    expect(selectFn).toHaveBeenCalledWith('id, title, topic, description, template_id, slide_data, created_at, updated_at')
    expect(orderFn).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(result).toEqual(mockData)
  })

  it('throws on error', async () => {
    const { supabase, orderFn } = createMockSupabase()
    orderFn.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    await expect(listProjects(supabase, 'user-123')).rejects.toEqual({ message: 'DB error' })
  })
})

describe('getProject', () => {
  it('queries single project filtered by id and user_id (ownership check)', async () => {
    const mockProject = { id: 'proj-1', title: 'My Project', user_id: 'user-123' }
    const { supabase, fromFn, singleFn } = createMockSupabase({ singleData: mockProject })

    const result = await getProject(supabase, 'user-123', 'proj-1')

    expect(fromFn).toHaveBeenCalledWith('projects')
    expect(singleFn).toHaveBeenCalled()
    expect(result).toEqual(mockProject)
  })
})

describe('createProjectService', () => {
  it('inserts project with user_id and returns id', async () => {
    const { supabase, fromFn, insertFn, singleFn } = createMockSupabase({
      insertData: { id: 'new-proj-1' },
    })

    const result = await createProjectService(supabase, 'user-123', {
      title: 'New Project',
      description: 'A description',
    })

    expect(fromFn).toHaveBeenCalledWith('projects')
    expect(insertFn).toHaveBeenCalledWith({
      user_id: 'user-123',
      title: 'New Project',
      description: 'A description',
      slide_data: [],
    })
    expect(singleFn).toHaveBeenCalled()
    expect(result).toEqual({ id: 'new-proj-1' })
  })
})

describe('deleteProjectService', () => {
  it('deletes project filtered by id and user_id', async () => {
    const { supabase, fromFn, deleteFn } = createMockSupabase()

    await deleteProjectService(supabase, 'user-123', 'proj-1')

    expect(fromFn).toHaveBeenCalledWith('projects')
    expect(deleteFn).toHaveBeenCalled()
  })
})

describe('updateProjectService', () => {
  it('updates project filtered by id and user_id', async () => {
    const { supabase, fromFn, updateFn } = createMockSupabase()

    await updateProjectService(supabase, 'user-123', 'proj-1', { title: 'Updated' })

    expect(fromFn).toHaveBeenCalledWith('projects')
    expect(updateFn).toHaveBeenCalledWith({ title: 'Updated' })
  })
})
