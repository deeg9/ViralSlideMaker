export interface Project {
  id: string
  user_id: string
  title: string
  description: string | null
  slide_data: unknown[] // jsonb -- Phase 2 will define slide structure
  created_at: string
  updated_at: string
}
