import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-bold text-lg">
          Slideshow Creator
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {/* Brand Kit hidden from production — feature not ready (260515-eey). Re-enable when complete.
          <Link
            href="/settings/brand-kit"
            className="text-gray-600 hover:text-gray-900"
          >
            Brand Kit
          </Link>
          */}
        </nav>
      </div>
      <LogoutButton />
    </header>
  )
}
