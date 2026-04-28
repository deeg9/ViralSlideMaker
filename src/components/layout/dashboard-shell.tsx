'use client'

import { usePathname } from 'next/navigation'
import { TopNavbar } from './top-navbar'
import { BottomNavbar } from './bottom-navbar'

export function DashboardShell({ userName, creditDisplay, children }: { userName: string; creditDisplay?: React.ReactNode; children: React.ReactNode }) {
  // Editor pages manage their own viewport-fit height. We pin the shell to the
  // viewport with position:fixed so the slide-list's intrinsic 1080×1920
  // absolute children don't leak through overflow:hidden ancestors and inflate
  // body height. <main> is scrollable inside the fixed shell so the creation-
  // form state of /project/[id] (no slides yet) can still scroll vertically.
  const pathname = usePathname()
  const isFullBleed = pathname?.startsWith('/project/') ?? false

  return (
    <div className={isFullBleed ? 'fixed inset-0 overflow-hidden bg-[#fff8f7] flex flex-col' : 'min-h-screen bg-[#fff8f7]'}>
      <TopNavbar variant="app" userName={userName} creditDisplay={creditDisplay} />
      <main className={isFullBleed ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
        <div className={isFullBleed ? '' : 'px-8 py-8 max-w-screen-2xl mx-auto pb-24 md:pb-8'}>
          {children}
        </div>
      </main>
      <BottomNavbar />
    </div>
  )
}
