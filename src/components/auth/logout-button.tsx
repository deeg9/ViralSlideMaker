'use client'

import { logout } from '@/app/(auth)/login/actions'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm">
        Log out
      </Button>
    </form>
  )
}
