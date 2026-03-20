'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { LogoutButton } from '@/components/auth/logout-button'

interface TopNavbarProps {
  variant: 'marketing' | 'app'
  userName?: string
}

const navItems = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
]

function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/logo.png" alt="ViralSlideMaker" width={size} height={size} className="rounded-lg" />
      <span className="text-xl font-semibold tracking-tighter text-[#3d0000]">ViralSlideMaker</span>
    </div>
  )
}

export function TopNavbar({ variant, userName }: TopNavbarProps) {
  const pathname = usePathname()

  if (variant === 'marketing') {
    return (
      <nav className="fixed top-0 z-50 w-full bg-[#fff8f7]/80 backdrop-blur-md shadow-[0px_20px_40px_rgba(61,0,0,0.06)]">
        <div className="flex justify-between items-center w-full px-8 py-4">
          <Link href="/">
            <Logo size={36} />
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="font-medium text-sm tracking-wide text-[#3d0000] hover:text-[#3d0000]/70 transition-colors duration-200"
            >
              Log In
            </Link>
            <Link
              href="/waitlist"
              className="bg-[#3d0000] text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-transform active:scale-90"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <header className="sticky top-0 z-30 bg-[#fff8f7]/80 backdrop-blur-md shadow-[0px_20px_40px_rgba(61,0,0,0.06)]">
      <div className="flex justify-between items-center w-full px-8 py-3">
        {/* Left: Logo */}
        <Link href="/dashboard">
          <Logo size={30} />
        </Link>

        {/* Right: Nav icons + Profile */}
        <div className="flex items-center gap-2">
          {/* Nav icons (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.label === 'Settings'
                  ? pathname.startsWith('/settings')
                  : pathname === item.href
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  title={item.label}
                  className={`p-2 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-[#fadbdb] text-[#3d0000]'
                      : 'text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]'
                  }`}
                >
                  <Icon name={item.icon} size="sm" />
                </Link>
              )
            })}
          </div>

          {/* Profile */}
          <div className="flex items-center gap-3 pl-3 border-l border-[#dbc1bc]/30 ml-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-[#3d0000]">{userName ?? 'User'}</p>
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[#7d6161]">Pro Member</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#fadbdb] flex items-center justify-center overflow-hidden">
              <Icon name="person" size="sm" className="text-[#3d0000]" />
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  )
}
