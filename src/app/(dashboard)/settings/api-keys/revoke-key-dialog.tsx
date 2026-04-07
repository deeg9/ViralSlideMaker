'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { revokeApiKey } from './actions'

interface RevokeKeyDialogProps {
  keyId: string
  keyLabel: string
}

export function RevokeKeyDialog({ keyId, keyLabel }: RevokeKeyDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRevoke = useCallback(async () => {
    setLoading(true)
    const result = await revokeApiKey(keyId)

    if (result.success) {
      toast.success(`API key "${keyLabel}" has been revoked.`)
      setOpen(false)
      router.refresh()
    } else {
      toast.error('Failed to revoke API key. Please try again.')
    }
    setLoading(false)
  }, [keyId, keyLabel, router])

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" className="text-destructive hover:text-destructive">
            Revoke
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
          <AlertDialogDescription>
            Any application using &quot;{keyLabel}&quot; will immediately lose
            API access. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep Key</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleRevoke()
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Revoking...' : 'Revoke Key'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
