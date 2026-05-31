'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { logout } from '@/app/(auth)/login/actions'
import { useNavigationLoader } from './navigation-loader'

interface ProfileMenuProps {
  userName: string
  creditDisplay?: React.ReactNode
}

interface MenuRow {
  label: string
  icon: string
  href: string
  message: string
  isActive: (pathname: string) => boolean
}

const rows: MenuRow[] = [
  {
    label: 'Bookmarks',
    icon: 'bookmark',
    href: '/bookmarks',
    message: 'Loading bookmarks…',
    isActive: (p) => p.startsWith('/bookmarks'),
  },
  {
    label: 'Resources',
    icon: 'science',
    href: '/resources',
    message: 'Loading resources…',
    isActive: (p) => p.startsWith('/resources'),
  },
]

export function ProfileMenu({ userName, creditDisplay }: ProfileMenuProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const { startNavigation } = useNavigationLoader()

  // Outside-click listener (mainly for touch devices)
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Cleanup any pending timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [])

  // Hover-intent is mouse-only. On touch, a tap fires pointerenter→click in
  // one gesture; if hover opened the menu, the click-toggle would immediately
  // close it again (the menu "won't stay open"). Gating these to mouse leaves
  // touch entirely governed by the click-toggle + outside-click handlers.
  function handlePointerEnter(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setOpen(true)
  }

  function handlePointerLeave(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimeoutRef.current = null
    }, 80)
  }

  function handleAvatarClick() {
    setOpen((prev) => !prev)
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center gap-4 pl-4 border-l border-[#dbc1bc]/20 ml-3"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className="text-right hidden sm:block">
        <p className="text-xs font-semibold text-[#3d0000] leading-tight">
          {userName}
        </p>
        {creditDisplay}
      </div>
      <button
        type="button"
        onClick={handleAvatarClick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        className="w-8 h-8 rounded-full bg-[#fadbdb] flex items-center justify-center transition-transform active:scale-95"
      >
        <Icon name="person" size="sm" className="text-[#3d0000]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0px_20px_40px_rgba(61,0,0,0.12)] border border-[#dbc1bc]/20 py-2 z-50"
        >
          {rows.map((row) => {
            const active = row.isActive(pathname)
            return (
              <Link
                key={row.label}
                href={row.href}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  if (!active) startNavigation(row.message)
                }}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm text-[#3d0000] hover:bg-[#fff0f0] transition-colors w-full text-left ${
                  active ? 'bg-[#fadbdb]' : ''
                }`}
              >
                <Icon name={row.icon} size="sm" />
                <span>{row.label}</span>
              </Link>
            )
          })}

          <div className="my-2 border-t border-[#dbc1bc]/20" />

          <form
            action={logout}
            onSubmit={() => {
              // logout server action redirects to /login. Show overlay for the
              // round-trip; safety timeout in NavigationLoaderProvider covers
              // any case where the redirect doesn't land.
              setOpen(false)
              startNavigation('Logging out…')
            }}
          >
            <button
              type="submit"
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#3d0000] hover:bg-[#fff0f0] transition-colors w-full text-left"
            >
              <Icon name="logout" size="sm" />
              <span>Log out</span>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
