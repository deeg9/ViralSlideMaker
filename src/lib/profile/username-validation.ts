import { z } from 'zod'
import { RESERVED_USERNAMES } from './reserved-usernames'

export const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9_.]{1,22}[a-z0-9])?$/

export const usernameSchema = z
  .string()
  .min(3, 'Must be at least 3 characters')
  .max(24, 'Must be at most 24 characters')
  .regex(USERNAME_REGEX, 'Use letters, numbers, _ or .')
  .refine((s) => !/[._]{2,}/.test(s), 'No consecutive dots or underscores')
  .refine((s) => !RESERVED_USERNAMES.has(s), 'That username is reserved')

export function validateUsernameFormat(s: string): string | null {
  const result = usernameSchema.safeParse(s)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid username'
}

export function isReservedUsername(s: string): boolean {
  return RESERVED_USERNAMES.has(s)
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}
