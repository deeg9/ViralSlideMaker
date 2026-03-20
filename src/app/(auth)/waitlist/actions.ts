'use server'

import { createClient } from '@/lib/supabase/server'

export async function joinWaitlist(
  email: string
): Promise<{ success: boolean; message: string }> {
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('waitlist').insert({ email: email.toLowerCase().trim() })

  if (error) {
    if (error.code === '23505') {
      return { success: true, message: "You're already on the waitlist! We'll be in touch soon." }
    }
    return { success: false, message: 'Something went wrong. Please try again.' }
  }

  return { success: true, message: "You've been added to the waitlist! We'll notify you when you're let in." }
}
