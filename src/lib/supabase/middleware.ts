import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // If an auth code lands at the root (Supabase redirect misconfiguration),
  // forward it to /auth/callback where it can be properly exchanged
  if (
    request.nextUrl.pathname === '/' &&
    request.nextUrl.searchParams.has('code')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Use getClaims() not getSession() -- getClaims revalidates the token
  // Fall back to getUser() if getClaims is not available
  let user = null
  if (typeof supabase.auth.getClaims === 'function') {
    const { data } = await supabase.auth.getClaims()
    user = data?.claims ?? null
  } else {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  }

  // Redirect unauthenticated users to login
  // Exclude: /, /login, /signup, /forgot-password, /reset-password, /auth routes
  // (/reset-password is reached via /auth/callback which sets a recovery session;
  // the page itself re-asserts the session and bounces with a friendly error if
  // it's missing or expired — letting it through here means the in-page error
  // copy gets a chance to render instead of a silent middleware redirect.)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/forgot-password') &&
    !request.nextUrl.pathname.startsWith('/reset-password') &&
    !request.nextUrl.pathname.startsWith('/privacy') &&
    !request.nextUrl.pathname.startsWith('/terms') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
