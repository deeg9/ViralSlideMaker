// Stub: Will be implemented in Plan 01
// Bearer token authentication for API keys
import { NextRequest } from 'next/server'

export interface ApiKeyAuth {
  userId: string
  keyId: string
  tier: string
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuth> {
  throw new Error('Not implemented -- Plan 01 will implement this')
}
