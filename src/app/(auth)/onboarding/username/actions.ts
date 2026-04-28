'use server'

import { createClient } from '@/lib/supabase/server'
import {
  isReservedUsername,
  normalizeUsername,
  validateUsernameFormat,
} from '@/lib/profile/username-validation'
import { suggestFromEmail } from '@/lib/profile/username-suggestions'

export type AvailabilityResult = {
  available: boolean
  reason: 'invalid' | 'reserved' | 'taken' | null
  message?: string
}

export async function getOnboardingPrefill(): Promise<{
  email: string | null
  suggestion: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email ?? null
  const suggestion = email ? suggestFromEmail(email) : ''
  return { email, suggestion }
}

export async function checkUsernameAvailable(
  raw: string,
): Promise<AvailabilityResult> {
  const username = normalizeUsername(raw)
  const formatErr = validateUsernameFormat(username)
  if (formatErr) {
    return { available: false, reason: 'invalid', message: formatErr }
  }
  if (isReservedUsername(username)) {
    return { available: false, reason: 'reserved', message: 'That username is reserved' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    return { available: false, reason: 'invalid', message: 'Could not check availability' }
  }
  if (data) {
    return { available: false, reason: 'taken', message: 'Username is taken' }
  }
  return { available: true, reason: null }
}

export async function claimUsername(
  raw: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const username = normalizeUsername(raw)

  const formatErr = validateUsernameFormat(username)
  if (formatErr) return { success: false, error: formatErr }
  if (isReservedUsername(username)) {
    return { success: false, error: 'That username is reserved' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('claim_username', { p_username: username })
  if (error) {
    return { success: false, error: 'Could not claim username — please try again' }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.ok) {
    const reason = row?.reason as string | undefined
    if (reason === 'taken') return { success: false, error: 'Username is taken' }
    if (reason === 'invalid_format') return { success: false, error: 'Invalid username format' }
    if (reason === 'unauthenticated') return { success: false, error: 'Not authenticated' }
    return { success: false, error: 'Could not claim username' }
  }

  return { success: true }
}
