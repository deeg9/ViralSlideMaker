'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icon } from '@/components/ui/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { createApiKey } from './actions'

interface CreateKeyDialogProps {
  keyCount: number
  triggerLabel?: string
}

export function CreateKeyDialog({
  keyCount,
  triggerLabel = 'Create API Key',
}: CreateKeyDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const atLimit = keyCount >= 3

  const handleCreate = useCallback(async () => {
    if (!label.trim()) return
    setLoading(true)
    setError(null)

    const result = await createApiKey(label.trim())

    if (result.success) {
      setCreatedKey(result.key)
    } else {
      setError(result.error)
      toast.error('Failed to create API key. Please try again.')
    }
    setLoading(false)
  }, [label])

  const handleCopy = useCallback(async () => {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    toast('API key copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }, [createdKey])

  const handleClose = useCallback(() => {
    setOpen(false)
    setLabel('')
    setCreatedKey(null)
    setError(null)
    setCopied(false)
    router.refresh()
  }, [router])

  const handleOpenChange = useCallback(
    (nextOpen: boolean, details: { reason?: string }) => {
      // When key is displayed, block all dismissal except our explicit close
      if (!nextOpen && createdKey) {
        if (
          details?.reason === 'outside-press' ||
          details?.reason === 'escape-key' ||
          details?.reason === 'outsidePress' ||
          details?.reason === 'escapeKey'
        ) {
          return
        }
        handleClose()
        return
      }
      if (!nextOpen) {
        setLabel('')
        setError(null)
      }
      setOpen(nextOpen)
    },
    [createdKey, handleClose],
  )

  if (atLimit) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button disabled>
              <Icon name="add" size="sm" />
              {triggerLabel}
            </Button>
          }
        />
        <TooltipContent>
          <p>
            You&apos;ve reached the maximum of 3 API keys. Revoke an existing
            key to create a new one.
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      {...(createdKey ? { disablePointerDismissal: true } : {})}
    >
      <DialogTrigger
        render={
          <Button>
            <Icon name="add" size="sm" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent
        className="sm:max-w-[420px]"
        showCloseButton={!createdKey}
      >
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Your API key</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <Icon name="warning" size="sm" className="mt-0.5 shrink-0" />
                <p>
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <code className="flex-1 break-all font-mono text-sm">
                  {createdKey}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copy API key"
                >
                  <Icon
                    name={copied ? 'check' : 'content_copy'}
                    size="sm"
                  />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Close Dialog</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Give this key a name (e.g., Production, Development)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="key-label">Label</Label>
                <Input
                  id="key-label"
                  placeholder="My API key"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && label.trim()) {
                      handleCreate()
                    }
                  }}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!label.trim() || loading}
              >
                {loading ? 'Creating...' : 'Create Key'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
