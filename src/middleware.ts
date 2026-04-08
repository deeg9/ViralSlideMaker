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

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
