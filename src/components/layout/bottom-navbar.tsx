'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { useNavigationLoader } from './navigation-loader'

const tabs = [
  { href: '/dashboard',         icon: 'home',        label: 'Home',   message: 'Loading dashboard…' },
  { href: '/dashboard?new=1',   icon: 'add_circle',  label: 'Create', message: 'Loading…' },
  { href: '/settings/profile',  icon: 'person',      label: 'Me',     message: 'Loading settings…' },
] as const

export function BottomNavbar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isCreate = searchParams.get('new') === '1'
  const { startNavigation } = useNavigationLoader()
  function navigateMaybe(href: string, message: string) {
    const isCreateHref = href.includes('new=1')
    const targetPath = href.split('?')[0]
    if (targetPath === pathname && (isCreateHref ? isCreate : !isCreate)) return
    startNavigation(message)
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-2 bg-[#fff8f7] shadow-[0_-10px_30px_rgba(61,0,0,0.04)] rounded-t-2xl z-50">
      {tabs.map((tab) => {
        const isActive =
          tab.label === 'Create' ? isCreate :
          tab.label === 'Home'   ? pathname === '/dashboard' && !isCreate :
          tab.label === 'Me'     ? pathname.startsWith('/settings') :
          false
        return (
          <Link
            key={tab.label}
            href={tab.href}
            onClick={() => navigateMaybe(tab.href, tab.message)}
            className={`flex flex-col items-center justify-center px-6 py-2 rounded-2xl transition-all ${
              isActive
                ? 'bg-[#fadbdb] text-[#3d0000]'
                : 'text-[#7d6161] active:bg-[#ffe0e0]'
            }`}
          >
            <Icon name={tab.icon} filled={isActive} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
