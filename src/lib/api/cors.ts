/**
 * CORS headers for all /api/v1/* responses.
 *
 * Wildcard origin is intentional: this is a public Bearer-token API
 * (no cookies), so restrictive CORS adds no security value.
 */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers':
      'X-RateLimit-Limit, X-RateLimit-Remaining, x-credits-remaining, x-credits-used, Retry-After',
  }
}
