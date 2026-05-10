'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { MorphingSquare } from '@/components/ui/morphing-square'

// quick-260510: shared navigation overlay for the signed-in shell. Any chrome
// that triggers a route change (top-navbar, bottom-navbar, profile menu items,
// logout form) calls `startNavigation(message)` before the click bubbles into
// Next's router. The provider observes pathname + searchParams and clears the
// overlay automatically on the first commit that changes either — covers both
// "/dashboard → /explore" and "/dashboard → /dashboard?new=1" without needing
// per-link bookkeeping.

interface NavigationLoaderContextValue {
  startNavigation: (message?: string) => void
  stopNavigation: () => void
}

const NavigationLoaderContext = createContext<NavigationLoaderContextValue | null>(null)

export function useNavigationLoader() {
  const ctx = useContext(NavigationLoaderContext)
  if (!ctx) {
    // Fail soft: in non-shell contexts (marketing pages, login, etc.) the
    // overlay simply won't show. No-op stub keeps callers untyped.
    return { startNavigation: () => undefined, stopNavigation: () => undefined }
  }
  return ctx
}

interface NavigationLoaderProviderProps {
  children: React.ReactNode
}

export function NavigationLoaderProvider({ children }: NavigationLoaderProviderProps) {
  const [navigating, setNavigating] = useState(false)
  const [message, setMessage] = useState<string | undefined>(undefined)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Capture the route signature at the moment startNavigation fired. The
  // overlay clears as soon as we observe a different signature post-commit,
  // even if Next.js coalesces paint+overlay-mount in the same frame.
  const startedAtRef = useRef<string | null>(null)

  const startNavigation = useCallback((nextMessage?: string) => {
    startedAtRef.current = `${pathname}?${searchParams.toString()}`
    setMessage(nextMessage)
    setNavigating(true)
  }, [pathname, searchParams])

  const stopNavigation = useCallback(() => {
    startedAtRef.current = null
    setNavigating(false)
  }, [])

  useEffect(() => {
    if (!navigating) return
    const current = `${pathname}?${searchParams.toString()}`
    if (startedAtRef.current !== null && current !== startedAtRef.current) {
      setNavigating(false)
      startedAtRef.current = null
    }
  }, [navigating, pathname, searchParams])

  // Safety: if the navigation never lands (server action threw, network
  // dropped) clear after 15s so the user can recover.
  useEffect(() => {
    if (!navigating) return
    const t = window.setTimeout(() => setNavigating(false), 15000)
    return () => window.clearTimeout(t)
  }, [navigating])

  return (
    <NavigationLoaderContext.Provider value={{ startNavigation, stopNavigation }}>
      {children}
      {navigating && (
        <div
          role="status"
          aria-live="polite"
          aria-label={message ?? 'Loading'}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#fff5f5]/80 backdrop-blur-sm"
        >
          <MorphingSquare className="bg-[#3d0000]" message={message} />
        </div>
      )}
    </NavigationLoaderContext.Provider>
  )
}
