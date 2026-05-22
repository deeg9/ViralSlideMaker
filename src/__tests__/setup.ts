import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Phase 45-03 — jsdom polyfills for layout APIs that <SlidePreview> uses to
// compute its container-relative scale factor. Without these, the component
// bails out at scale === 0 before any overlay/pill JSX renders. Adding them
// here also unblocks the 2 pre-existing slide-preview tests noted in
// deferred-items.md (Rule 3 — auto-fix blocking issue, scoped strictly to
// test-environment plumbing; no production code change).
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).ResizeObserver = ResizeObserverStub
}

// Phase 69 Plan 02: defensive IntersectionObserver mock — @tanstack/react-virtual
// (Phase 70 picker dependency) reads IntersectionObserver in some grid configs.
// Adding it here (not in Phase 70) keeps Phase 69's integration tests clean
// if any component pathway happens to trip the global access.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).IntersectionObserver = IntersectionObserverStub
}

// jsdom returns 0×0 from getBoundingClientRect on detached / unstyled elements.
// <SlidePreview> reads it once on mount to seed containerWidth; without a
// non-zero width, scale stays 0 and the component never renders its inner JSX.
// Stub returns the 1080-wide REF_WIDTH for the slide-preview container so
// tests can exercise the real DOM tree.
//
// Gate on `typeof Element !== 'undefined'` so node-environment tests
// (`// @vitest-environment node` in MCP/api/lib suites) don't crash trying to
// patch a global that does not exist in node.
if (typeof Element !== 'undefined') {
  const _origGetBoundingClientRect =
    Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (): DOMRect {
    const rect = _origGetBoundingClientRect.call(this)
    // If jsdom returned a real measurement, honor it.
    if (rect.width > 0) return rect
    // Otherwise inject a 1080×1920 baseline matching the SlidePreview canvas.
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1080,
      bottom: 1920,
      width: 1080,
      height: 1920,
      toJSON() {
        return {}
      },
    } as DOMRect
  }

  // jsdom does not implement Element.scrollIntoView. The useScrollFlash hook
  // (right-rail click-to-focus) calls it when a section card is focused; stub
  // it so component tests that mount those cards don't throw.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function () {}
  }
}

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => {
  const mockAuth = {
    signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }

  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  })

  const mockClient = {
    auth: mockAuth,
    from: mockFrom,
  }

  return {
    createBrowserClient: vi.fn().mockReturnValue(mockClient),
    createServerClient: vi.fn().mockReturnValue(mockClient),
  }
})

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
