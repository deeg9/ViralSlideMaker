import { LogoutButton } from '@/components/auth/logout-button'

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <span className="font-bold text-lg">Slideshow Creator</span>
      <LogoutButton />
    </header>
  )
}
