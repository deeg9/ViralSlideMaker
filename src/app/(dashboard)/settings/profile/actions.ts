'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface Profile {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  return {
    firstName: (user.user_metadata?.first_name as string) ?? '',
    lastName: (user.user_metadata?.last_name as string) ?? '',
    email: user.email ?? '',
    phone: (user.user_metadata?.phone as string) ?? '',
  }
}

export async function saveProfile(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const first_name = formData.get('first_name') as string
    const last_name = formData.get('last_name') as string
    const phone = formData.get('phone') as string

    const { error } = await supabase.auth.updateUser({
      data: { first_name, last_name, phone },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings/profile')
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
