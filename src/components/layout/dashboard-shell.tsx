'use client'

import { usePathname } from 'next/navigation'
import { TopNavbar } from './top-navbar'
import { BottomNavbar } from './bottom-navbar'

export function DashboardShell({ userName, creditDisplay, children }: { userName: string; creditDisplay?: React.ReactNode; children: React.ReactNode }) {
  // The editor manages its own viewport-fit height; suppress shell padding so the
  // page doesn't scroll past the editor into empty space.
  const pathname = usePathname()
  const isFullBleed = pathname?.startsWith('/project/') ?? false

  return (
    <div className={isFullBleed ? 'h-screen overflow-hidden bg-[#fff8f7]' : 'min-h-screen bg-[#fff8f7]'}>
      <TopNavbar variant="app" userName={userName} creditDisplay={creditDisplay} />
      <main>
        <div className={isFullBleed ? '' : 'px-8 py-8 max-w-screen-2xl mx-auto pb-24 md:pb-8'}>
          {children}
        </div>
      </main>
      <BottomNavbar />
    </div>
  )
}
