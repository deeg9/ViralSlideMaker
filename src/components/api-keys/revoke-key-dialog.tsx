'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { revokeApiKey } from '@/app/(dashboard)/settings/api-keys/actions'

interface RevokeKeyDialogProps {
  keyId: string
  keyName: string
  onRevoked: () => void
}

export function RevokeKeyDialog({ keyId, keyName, onRevoked }: RevokeKeyDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRevoke() {
    setLoading(true)
    try {
      const result = await revokeApiKey(keyId)
      if (result.success) {
        setOpen(false)
        onRevoked()
      }
    } catch {
      // Error handling - could add toast here
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <button
            aria-label={`Revoke API key ${keyName}`}
            className="text-sm text-[#ba1a1a] hover:bg-red-50 px-3 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2"
          >
            Revoke
          </button>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8 shadow-[0px_40px_80px_rgba(61,0,0,0.15)]">
          <Dialog.Title className="mb-1 text-lg font-bold text-[#3d0000]">
            Revoke API Key
          </Dialog.Title>
          <Dialog.Description className="mb-6 text-sm text-[#7d6161]">
            Any applications using the key{' '}
            <span className="font-semibold">{keyName}</span>{' '}
            will lose access immediately. This cannot be undone.
          </Dialog.Description>
          <div className="flex justify-end gap-3">
            <Dialog.Close
              render={
                <button className="px-6 py-3 rounded-xl border border-[#dbc1bc] text-[#7d6161] font-bold text-sm focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2">
                  Keep Key
                </button>
              }
            />
            <button
              onClick={handleRevoke}
              disabled={loading}
              className="bg-[#ba1a1a] text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              Revoke Key
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
