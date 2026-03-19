import type { Slide, GenerationStatus } from './slide'

export interface Project {
  id: string
  user_id: string
  title: string
  description: string | null
  slide_data: Slide[]
  template_id?: string
  topic?: string
  generation_status?: GenerationStatus
  created_at: string
  updated_at: string
}
