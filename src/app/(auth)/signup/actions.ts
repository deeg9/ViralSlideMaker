'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (password !== confirmPassword) {
    redirect('/signup?error=Passwords do not match')
  }

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password,
  })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const headerList = await headers()
  const origin = headerList.get('origin') || headerList.get('x-forwarded-host') || 'http://localhost:3000'
  const protocol = headerList.get('x-forwarded-proto') || 'http'
  const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect('/signup?error=Could not connect to Google')
  }

  redirect(data.url)
}
