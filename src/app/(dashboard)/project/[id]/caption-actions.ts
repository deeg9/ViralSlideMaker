'use server'

import { createClient } from '@/lib/supabase/server'
import { generateCaptions } from '@/lib/captions/generate-captions'
import type { CaptionResult } from '@/lib/captions/generate-captions'
import type { Slide } from '@/lib/types/slide'

export async function generateCaptionsAction(
  projectId: string,
): Promise<CaptionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('slide_data, topic')
    .eq('id', projectId)
    .single()

  if (error || !project) {
    return { error: 'Project not found' }
  }

  const slides = (project.slide_data ?? []) as Slide[]
  const topic = (project.topic as string) ?? 'carousel'

  return generateCaptions(slides, topic)
}
