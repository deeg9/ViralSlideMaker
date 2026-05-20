'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || password.length < 6) {
    redirect('/reset-password?error=Password must be at least 6 characters')
  }
  if (password !== confirmPassword) {
    redirect('/reset-password?error=Passwords do not match')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?error=Reset link expired or invalid')
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    redirect('/reset-password?error=Could not update password. Please try again.')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
