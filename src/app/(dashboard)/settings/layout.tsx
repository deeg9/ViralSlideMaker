'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'

const settingsNav = [
  { href: '/settings/profile', icon: 'person', label: 'Profile' },
  { href: '/settings/notifications', icon: 'notifications', label: 'Notifications' },
  { href: '/settings/subscription', icon: 'credit_card', label: 'Manage Subscription' },
  { href: '/settings/brand-kit', icon: 'palette', label: 'Brand Kit' },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="md:hidden overflow-x-auto -mx-4 px-4">
        <div className="flex gap-2 min-w-max pb-2">
          {settingsNav.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#fadbdb] text-[#3d0000] font-bold'
                    : 'text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]'
                }`}
              >
                <Icon name={item.icon} size="sm" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="flex items-center gap-2 mb-6 px-3">
            <Icon name="settings" size="lg" className="text-[#3d0000]" />
            <h1 className="text-xl font-bold text-[#3d0000]">Settings</h1>
          </div>
          <nav className="space-y-1">
            {settingsNav.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    isActive
                      ? 'bg-[#fadbdb] text-[#3d0000] font-bold'
                      : 'text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]'
                  }`}
                >
                  <Icon name={item.icon} size="sm" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
