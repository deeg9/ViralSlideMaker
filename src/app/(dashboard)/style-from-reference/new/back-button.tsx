'use client'

// Back affordance for /style-from-reference/new. Reads the `from` query
// param the in-app callers pass (the new References pill on the
// generation-form sets it to /project/<projectId>) so "Back" returns to
// the exact prompt page the user came from. Direct-URL arrivals lack the
// param and fall back to /dashboard.
//
// Validation: only accepts same-origin in-app paths starting with `/` and
// rejects protocol-relative (`//evil.com`) and external (`http(s)://`)
// URLs. This is a navigation surface so an open-redirect would let a
// crafted referrer URL silently send the next click off-site.

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const DEFAULT_FALLBACK = '/dashboard'

function safeInAppPath(raw: string | null): string {
  if (!raw) return DEFAULT_FALLBACK
  // Must start with a single `/` (not `//` — protocol-relative) and not
  // contain `:` (`http://`, `javascript:`, etc.).
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes(':')) {
    return DEFAULT_FALLBACK
  }
  return raw
}

export function BackButton() {
  const params = useSearchParams()
  const href = safeInAppPath(params.get('from'))
  return (
    <Link
      href={href}
      data-testid="style-from-reference-back"
      className="inline-flex items-center text-sm text-[#7d6161] hover:text-[#3d0000] mb-4"
    >
      ← Back
    </Link>
  )
}
