import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-bold text-lg">
          Slideshow Creator
        </Link>
      </div>
      <LogoutButton />
    </header>
  )
}
