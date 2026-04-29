// src/lib/api/auth.ts
import { NextRequest } from 'next/server'
import { verifyApiKeyHash, InvalidApiKeyError } from './auth-core'

export async function authenticateApiKey(
  request: NextRequest
): Promise<{ userId: string; keyId: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer vsl_')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const rawKey = authHeader.slice(7) // Remove "Bearer "
  try {
    return await verifyApiKeyHash(rawKey)
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      throw new Error('Invalid API key')
    }
    throw err
  }
}
