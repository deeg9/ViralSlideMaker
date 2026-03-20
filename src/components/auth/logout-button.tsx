'use client'

import { logout } from '@/app/(auth)/login/actions'
import { Icon } from '@/components/ui/icon'

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="p-2 text-[#7d6161] hover:bg-[#fadbdb] rounded-xl transition-colors"
        title="Log out"
      >
        <Icon name="logout" size="sm" />
      </button>
    </form>
  )
}
