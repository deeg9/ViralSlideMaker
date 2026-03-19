import { LogoutButton } from '@/components/auth/logout-button'

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-semibold">TikTok Slideshow Creator</h1>
        <LogoutButton />
      </header>
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Your Projects</h2>
          <p className="mt-2 text-muted-foreground">No projects yet. Create one to get started.</p>
        </div>
      </main>
    </div>
  )
}
