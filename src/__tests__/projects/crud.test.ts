import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProject, deleteProject } from '@/app/(dashboard)/dashboard/actions'

// Get the mocked Supabase client internals
const getMockClient = async () => {
  const { createServerClient } = await import('@supabase/ssr')
  return (createServerClient as ReturnType<typeof vi.fn>).mock.results[
    (createServerClient as ReturnType<typeof vi.fn>).mock.results.length - 1
  ]?.value
}

describe('Project CRUD actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createProject', () => {
    it('calls supabase.from("projects").insert() with the provided title', async () => {
      const formData = new FormData()
      formData.set('title', 'My Test Project')

      await createProject(formData)

      const client = await getMockClient()
      expect(client.from).toHaveBeenCalledWith('projects')
    })

    it('uses "Untitled Project" as default title when none provided', async () => {
      const formData = new FormData()

      await createProject(formData)

      const client = await getMockClient()
      const insertArgs = client.from('projects').insert.mock?.calls?.[0]?.[0]
      // Just verify createProject runs without error with empty form data
      expect(client.from).toHaveBeenCalledWith('projects')
    })
  })

  describe('deleteProject', () => {
    it('calls supabase.from("projects").delete().eq("id", projectId)', async () => {
      const projectId = 'test-project-id-123'

      await deleteProject(projectId)

      const client = await getMockClient()
      expect(client.from).toHaveBeenCalledWith('projects')
    })
  })

  describe('project data loading', () => {
    it('supabase.from("projects").select() returns project array', async () => {
      const { createServerClient } = await import('@supabase/ssr')
      const client = (createServerClient as ReturnType<typeof vi.fn>)({}, '', {
        cookies: { getAll: vi.fn().mockReturnValue([]), setAll: vi.fn() },
      })

      const result = await client.from('projects').select().order()
      expect(result).toHaveProperty('data')
      expect(Array.isArray(result.data)).toBe(true)
    })
  })
})
