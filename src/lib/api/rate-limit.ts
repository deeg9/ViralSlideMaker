// Stub: Will be implemented in Plan 01
// Upstash rate limiting for API keys
export async function checkRateLimit(
  keyId: string,
  tier: string
): Promise<{ limit: number; remaining: number; reset: number }> {
  throw new Error('Not implemented -- Plan 01 will implement this')
}
