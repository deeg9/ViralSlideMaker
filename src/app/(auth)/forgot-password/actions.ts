'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const hdrs = await headers()
  const origin =
    hdrs.get('origin') ??
    (hdrs.get('host') ? `https://${hdrs.get('host')}` : 'http://localhost:3000')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  // Do NOT leak whether the email exists. Only surface infrastructure-class errors
  // (rate limit, network). Supabase returns these via `error.status` >= 500.
  if (error && error.status && error.status >= 500) {
    redirect('/forgot-password?error=Something went wrong. Please try again.')
  }

  redirect('/forgot-password?sent=1')
}
