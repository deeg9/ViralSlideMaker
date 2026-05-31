'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { ProfileMenu } from './profile-menu'
import { useNavigationLoader } from './navigation-loader'

interface TopNavbarProps {
  variant: 'marketing' | 'app'
  userName?: string
  creditDisplay?: React.ReactNode
  signedIn?: boolean
}

// quick-260510-modal-on-prompt-page: Create is no longer a route — it
// triggers StartNewProject inline. Dashboard + Explore are inlined as Link
// items in the JSX below.

function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/logo.png" alt="ViralSlideMaker" width={size} height={size} className="rounded-lg" />
      <span className="text-xl font-semibold tracking-tighter text-[#3d0000]">ViralSlideMaker</span>
    </div>
  )
}

// Map nav-icon keys to the loading message shown while routing there.
const NAV_LOAD_MESSAGES: Record<string, string> = {
  dashboard: 'Loading dashboard…',
  explore: 'Loading explore…',
  settings: 'Loading settings…',
}

export function TopNavbar({ variant, userName, creditDisplay, signedIn = true }: TopNavbarProps) {
  const pathname = usePathname()
  const { startNavigation } = useNavigationLoader()
  // Skip the overlay when the click would land on the page we're already on
  // (e.g. clicking "Dashboard" while on /dashboard) — Next short-circuits the
  // navigation and never commits, so the overlay would hang until the 15s
  // safety timeout. Same for ?new=1 toggling the create dialog open.
  function navigateMaybe(href: string, message: string) {
    const targetPath = href.split('?')[0]
    if (targetPath === pathname) return
    startNavigation(message)
  }

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
              className="inline-flex items-center whitespace-nowrap font-medium text-sm tracking-wide text-[#3d0000] hover:text-[#3d0000]/70 transition-colors duration-200 py-2.5"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-[#3d0000] text-white px-4 md:px-6 py-3 md:py-2.5 rounded-xl font-medium text-sm transition-transform active:scale-90 whitespace-nowrap"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>
    )
  }

  const isDashboard = pathname === '/dashboard'

  return (
    <header className="sticky top-0 z-30 bg-[#fff8f7]/80 backdrop-blur-md shadow-[0px_20px_40px_rgba(61,0,0,0.06)]">
      <div className="flex justify-between items-center w-full px-8 py-3">
        {/* Left: Logo */}
        <Link
          href="/dashboard"
          onClick={() => navigateMaybe('/dashboard', NAV_LOAD_MESSAGES.dashboard)}
        >
          <Logo size={30} />
        </Link>

        {/* Right: Nav icons + Profile */}
        <div className="flex items-center gap-2">
          {/* Nav icons (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-1">
            {/* Dashboard link */}
            <Link
              href="/dashboard"
              title="Dashboard"
              onClick={() => navigateMaybe('/dashboard', NAV_LOAD_MESSAGES.dashboard)}
              className={`p-2.5 rounded-full transition-colors ${
                isDashboard
                  ? 'bg-[#fadbdb] text-[#3d0000]'
                  : 'text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]'
              }`}
            >
              <Icon name="dashboard" size="sm" />
            </Link>
            {/* Explore link */}
            <Link
              href="/explore"
              title="Explore"
              onClick={() => navigateMaybe('/explore', NAV_LOAD_MESSAGES.explore)}
              className={`p-2.5 rounded-full transition-colors ${
                pathname === '/explore'
                  ? 'bg-[#fadbdb] text-[#3d0000]'
                  : 'text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]'
              }`}
            >
              <Icon name="explore" size="sm" />
            </Link>
            {/* Settings link */}
            <Link
              href="/settings"
              title="Settings"
              onClick={() => navigateMaybe('/settings', NAV_LOAD_MESSAGES.settings)}
              className={`p-2.5 rounded-full transition-colors ${
                pathname.startsWith('/settings')
                  ? 'bg-[#fadbdb] text-[#3d0000]'
                  : 'text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]'
              }`}
            >
              <Icon name="settings" size="sm" />
            </Link>
          </div>

          {/* Profile menu (identity zone) — or Log In/Sign Up for anonymous viewers */}
          {signedIn ? (
            <ProfileMenu userName={userName ?? 'User'} creditDisplay={creditDisplay} />
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="whitespace-nowrap font-medium text-sm tracking-wide text-[#3d0000] hover:text-[#3d0000]/70 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="bg-[#3d0000] text-white px-4 py-2 rounded-xl font-medium text-sm transition-transform active:scale-90 whitespace-nowrap"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
