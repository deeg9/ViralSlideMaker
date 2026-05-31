'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { useNavigationLoader } from './navigation-loader'
import { StartNewProject } from '@/components/projects/start-new-project'

// quick-260510-modal-on-prompt-page: Create is no longer a route — it
// triggers StartNewProject inline. Home + Me stay as Link items.
const tabs = [
  { href: '/dashboard',        icon: 'home',   label: 'Home', message: 'Loading dashboard…' },
  { href: '/settings/profile', icon: 'person', label: 'Me',   message: 'Loading settings…'  },
] as const

export function BottomNavbar() {
  const pathname = usePathname()
  const { startNavigation } = useNavigationLoader()
  function navigateMaybe(href: string, message: string) {
    if (pathname === href.split('?')[0]) return
    startNavigation(message)
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 bg-[#fff8f7] shadow-[0_-10px_30px_rgba(61,0,0,0.04)] rounded-t-2xl z-50">
      {/* Home */}
      {(() => {
        const tab = tabs[0]
        const isActive = pathname === '/dashboard'
        return (
          <Link
            key={tab.label}
            href={tab.href}
            onClick={() => navigateMaybe(tab.href, tab.message)}
            className={`flex flex-col items-center justify-center px-6 py-2 rounded-2xl transition-all ${
              isActive ? 'bg-[#fadbdb] text-[#3d0000]' : 'text-[#7d6161] active:bg-[#ffe0e0]'
            }`}
          >
            <Icon name={tab.icon} filled={isActive} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{tab.label}</span>
          </Link>
        )
      })()}

      {/* Create — triggers StartNewProject inline (not a route) */}
      <StartNewProject>
        {({ start, pending }) => (
          <button
            type="button"
            onClick={start}
            disabled={pending}
            className="flex flex-col items-center justify-center px-6 py-2 rounded-2xl transition-all text-[#7d6161] active:bg-[#ffe0e0] disabled:opacity-60"
          >
            <Icon name="add_circle" />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Create</span>
          </button>
        )}
      </StartNewProject>

      {/* Me (Settings) */}
      {(() => {
        const tab = tabs[1]
        const isActive = pathname.startsWith('/settings')
        return (
          <Link
            key={tab.label}
            href={tab.href}
            onClick={() => navigateMaybe(tab.href, tab.message)}
            className={`flex flex-col items-center justify-center px-6 py-2 rounded-2xl transition-all ${
              isActive ? 'bg-[#fadbdb] text-[#3d0000]' : 'text-[#7d6161] active:bg-[#ffe0e0]'
            }`}
          >
            <Icon name={tab.icon} filled={isActive} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{tab.label}</span>
          </Link>
        )
      })()}
    </nav>
  )
}
