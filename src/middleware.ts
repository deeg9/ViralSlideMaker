import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Skip auth for webhook routes (Stripe webhooks)
  if (request.nextUrl.pathname.startsWith('/api/webhooks')) {
    return
  }

  // Skip session auth for API v1 routes (uses Bearer token auth)
  if (request.nextUrl.pathname.startsWith('/api/v1')) {
    return
  }

  // Skip session auth for MCP routes (uses Bearer token auth via mcp-handler)
  // Strict match: /api/mcp itself, or any subpath under /api/mcp/.
  // Avoids accidentally bypassing siblings like /api/mcps or /api/mcp-admin.
  if (
    request.nextUrl.pathname === '/api/mcp' ||
    request.nextUrl.pathname.startsWith('/api/mcp/')
  ) {
    return
  }

  // Skip session auth for dev-only admin routes (uses ADMIN_SEED_TOKEN bearer auth)
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    return
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
