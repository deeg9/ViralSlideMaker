'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { ProfileMenu } from './profile-menu'

interface TopNavbarProps {
  variant: 'marketing' | 'app'
  userName?: string
  creditDisplay?: React.ReactNode
}

const navItems = [
  { key: 'dashboard', icon: 'dashboard',  label: 'Dashboard', href: '/dashboard' },
  { key: 'create',    icon: 'add_circle', label: 'Create',    href: '/dashboard?new=1' },
  { key: 'discover',  icon: 'explore',    label: 'Discover',  href: '/discover' },
] as const

function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/logo.png" alt="ViralSlideMaker" width={size} height={size} className="rounded-lg" />
      <span className="text-xl font-semibold tracking-tighter text-[#3d0000]">ViralSlideMaker</span>
    </div>
  )
}

export function TopNavbar({ variant, userName, creditDisplay }: TopNavbarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (variant === 'marketing') {
    return (
      <nav className="fixed top-0 z-50 w-full bg-[#fff8f7]/80 backdrop-blur-md shadow-[0px_20px_40px_rgba(61,0,0,0.06)]">
        <div className="flex justify-between items-center w-full px-4 md:px-8 py-4">
          <Link href="/">
            <Logo size={36} />
          </Link>
          <div className="flex items-center gap-3 md:gap-6">
            <Link
              href="/login"
              className="whitespace-nowrap font-medium text-sm tracking-wide text-[#3d0000] hover:text-[#3d0000]/70 transition-colors duration-200"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="bg-[#3d0000] text-white px-4 md:px-6 py-2.5 rounded-xl font-medium text-sm transition-transform active:scale-90 whitespace-nowrap"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>
    )
  }

  const isCreate = searchParams.get('new') === '1'
  const isDashboard = pathname === '/dashboard' && !isCreate
  const isDiscover = pathname.startsWith('/discover')

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
                item.key === 'dashboard'
                  ? isDashboard
                  : item.key === 'create'
                    ? isCreate
                    : isDiscover
              return (
                <Link
                  key={item.key}
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

          {/* Profile menu (identity zone) */}
          <ProfileMenu userName={userName ?? 'User'} creditDisplay={creditDisplay} />
        </div>
      </div>
    </header>
  )
}
