// Stub: Will be implemented in Plan 01
// API key CRUD server actions
'use server'

export interface ApiKeyRecord {
  id: string
  label: string
  prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export async function createApiKey(
  label: string
): Promise<{ success: true; key: string } | { success: false; error: string }> {
  throw new Error('Not implemented -- Plan 01 will implement this')
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  throw new Error('Not implemented -- Plan 01 will implement this')
}

export async function revokeApiKey(
  keyId: string
): Promise<{ success: true } | { success: false; error: string }> {
  throw new Error('Not implemented -- Plan 01 will implement this')
}
