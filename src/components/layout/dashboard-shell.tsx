'use client'

import { TopNavbar } from './top-navbar'
import { BottomNavbar } from './bottom-navbar'
import { Footer } from './footer'

export function DashboardShell({ userName, creditDisplay, children }: { userName: string; creditDisplay?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fff8f7]">
      <TopNavbar variant="app" userName={userName} creditDisplay={creditDisplay} />
      <main>
        <div className="px-8 py-8 max-w-screen-2xl mx-auto pb-24 md:pb-8">
          {children}
        </div>
        <Footer />
      </main>
      <BottomNavbar />
    </div>
  )
}
