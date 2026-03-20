'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'

const tabs = [
  { href: '/dashboard', icon: 'home', label: 'Home' },
  { href: '/dashboard', icon: 'edit', label: 'Edit' },
  { href: '/dashboard', icon: 'inventory_2', label: 'Files' },
  { href: '/settings/profile', icon: 'person', label: 'Me' },
]

export function BottomNavbar() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-2 bg-[#fff8f7] shadow-[0_-10px_30px_rgba(61,0,0,0.04)] rounded-t-2xl z-50">
      {tabs.map((tab) => {
        const isActive =
          tab.label === 'Me'
            ? pathname.startsWith('/settings')
            : tab.label === 'Home' && pathname === '/dashboard'
        return (
          <Link
            key={tab.label}
            href={tab.href}
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
