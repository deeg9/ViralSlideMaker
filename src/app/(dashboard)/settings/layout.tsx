'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'

const settingsNav = [
  { href: '/settings/profile', icon: 'person', label: 'Profile' },
  { href: '/settings/notifications', icon: 'notifications', label: 'Notifications' },
  { href: '/settings/subscription', icon: 'credit_card', label: 'Manage Subscription' },
  { href: '/settings/api-keys', icon: 'key', label: 'API Keys' },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {/* Mobile: horizontal scrollable tab bar.
          POLISH-02 (Phase 94): the strip overflows 393px (~564px), so the
          trailing tabs were silently hidden. A right-edge gradient fade now
          signals that more tabs exist beyond the viewport, and the active tab
          scroll-snaps so it can't be left half-clipped. Desktop (md+) renders
          the sidebar below and is untouched. */}
      <div className="md:hidden relative -mx-4">
        <div className="overflow-x-auto hide-scrollbar px-4 scroll-px-4 snap-x snap-mandatory">
          <div className="flex gap-2 min-w-max pb-2">
            {settingsNav.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors snap-start ${
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
        {/* Right-edge fade affordance — hints at scrollable, off-screen tabs.
            pointer-events-none so it never blocks taps on the last tab. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#fff8f7] to-transparent"
        />
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
