'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { useSidebar } from './sidebar-context'

const navItems = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/dashboard', icon: 'auto_awesome_motion', label: 'My Carousels' },
  { href: '/dashboard', icon: 'style', label: 'Templates' },
  { href: '/settings/brand-kit', icon: 'settings', label: 'Settings' },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebar()

  return (
    <aside
      className={`h-screen fixed left-0 top-0 bg-[#fff0f0] flex-col z-40 hidden md:flex transition-all duration-300 ${
        collapsed ? 'w-[72px] p-3' : 'w-64 p-6'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center mb-10 ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
        {!collapsed && (
          <Link href="/dashboard" className="flex flex-col">
            <span className="text-xl font-bold text-[#3d0000]">ViralSlide Pro</span>
            <span className="text-[0.75rem] font-bold uppercase tracking-widest text-[#7d6161] mt-1">Creative Plan</span>
          </Link>
        )}
        <button
          onClick={toggle}
          className="p-2 text-[#7d6161] hover:bg-[#fadbdb] rounded-xl transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size="sm" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-2 flex-grow">
        {navItems.map((item) => {
          const isActive = pathname === item.href && item.label === 'Dashboard'
          return (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl transition-all ${
                collapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'
              } ${
                isActive
                  ? 'bg-[#fadbdb] text-[#3d0000] shadow-sm'
                  : 'text-[#7d6161] hover:bg-[#fadbdb]/50'
              }`}
            >
              <Icon name={item.icon} />
              {!collapsed && (
                <span className="text-[0.75rem] font-bold uppercase tracking-widest">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* CTA button */}
      <Link
        href="/dashboard"
        title={collapsed ? 'Create New Slide' : undefined}
        className={`mt-auto bg-[#3d0000] text-white rounded-xl font-bold text-sm tracking-tight active:scale-90 transition-transform flex items-center justify-center gap-2 ${
          collapsed ? 'p-3' : 'px-4 py-4'
        }`}
      >
        <Icon name="add" size="sm" />
        {!collapsed && 'Create New Slide'}
      </Link>
    </aside>
  )
}
