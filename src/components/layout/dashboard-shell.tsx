'use client'

import { usePathname } from 'next/navigation'
import { TopNavbar } from './top-navbar'
import { BottomNavbar } from './bottom-navbar'
import { NavigationLoaderProvider } from './navigation-loader'

export function DashboardShell({ userName, creditDisplay, children }: { userName: string; creditDisplay?: React.ReactNode; children: React.ReactNode }) {
  // Editor pages manage their own viewport-fit height. We pin the shell to the
  // viewport with position:fixed so the slide-list's intrinsic 1080×1920
  // absolute children don't leak through overflow:hidden ancestors and inflate
  // body height. <main> is scrollable inside the fixed shell so the creation-
  // form state of /project/[id] (no slides yet) can still scroll vertically.
  const pathname = usePathname()
  const isFullBleed = pathname?.startsWith('/project/') ?? false

  return (
    <NavigationLoaderProvider>
      <div className={isFullBleed ? 'fixed inset-0 overflow-hidden bg-[#fff8f7] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]' : 'min-h-screen bg-[#fff8f7]'}>
        {/* The editor (full-bleed /project/*) has its own top bar (back / title /
            layers) on mobile, so the global app header is redundant chrome that
            squeezes the 9:16 canvas. Hide it below lg there; desktop keeps it. */}
        {isFullBleed ? (
          <div className="hidden lg:block">
            <TopNavbar variant="app" userName={userName} creditDisplay={creditDisplay} />
          </div>
        ) : (
          <TopNavbar variant="app" userName={userName} creditDisplay={creditDisplay} />
        )}
        <main className={isFullBleed ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
          <div className={isFullBleed ? '' : 'px-8 py-8 max-w-screen-2xl mx-auto pb-24 md:pb-8'}>
            {children}
          </div>
        </main>
        {/* The editor (full-bleed /project/*) has its own persistent bottom
            action bar (EDIT-06). Rendering the global mobile tab nav there too
            stacks two fixed bars at the viewport bottom — it overlaps the
            editor's Export/Public bar and eats the bottom of the scroll area. */}
        {!isFullBleed && <BottomNavbar />}
      </div>
    </NavigationLoaderProvider>
  )
}
