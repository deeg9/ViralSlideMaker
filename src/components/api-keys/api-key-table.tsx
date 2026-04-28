'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { CreateKeyDialog } from './create-key-dialog'
import { RevokeKeyDialog } from './revoke-key-dialog'

interface ApiKey {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffMins > 0) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  return 'Just now'
}

interface ApiKeyTableProps {
  keys: ApiKey[]
}

export function ApiKeyTable({ keys: initialKeys }: ApiKeyTableProps) {
  const [keys, setKeys] = useState(initialKeys)
  const router = useRouter()

  function handleRefresh() {
    router.refresh()
  }

  const atLimit = keys.length >= 10

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Icon name="key" size="xl" className="text-[#dbc1bc] mb-4 !text-5xl" />
        <h2 className="text-lg font-bold text-[#3d0000] mb-6">No API keys yet</h2>
        <CreateKeyDialog onKeyCreated={handleRefresh} />
      </div>
    )
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-[#7d6161]">
          {keys.length} of 10 keys used
        </p>
        <CreateKeyDialog
          onKeyCreated={handleRefresh}
          disabled={atLimit}
        />
      </div>

      {atLimit && (
        <p className="text-sm text-[#7d6161] mb-4">
          Maximum of 10 API keys reached. Revoke an existing key to create a new one.
        </p>
      )}

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr>
            <th scope="col" className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7d6161] pb-3">
              Name
            </th>
            <th scope="col" className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7d6161] pb-3">
              Key
            </th>
            <th scope="col" className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7d6161] pb-3">
              Created
            </th>
            <th scope="col" className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7d6161] pb-3">
              Last Used
            </th>
            <th scope="col" className="text-right text-[10px] font-bold uppercase tracking-widest text-[#7d6161] pb-3">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key, index) => (
            <tr
              key={key.id}
              className={index < keys.length - 1 ? 'border-b border-[#dbc1bc]/10' : ''}
            >
              <td className="py-3 text-sm text-[#281718] font-medium">
                {key.name}
              </td>
              <td className="py-3">
                <span className="bg-[#fadbdb] text-[#3d0000] px-2 py-1 rounded-md font-mono text-[13px]">
                  vsl_{key.prefix}...
                </span>
              </td>
              <td className="py-3 text-sm text-[#7d6161]">
                {formatRelativeDate(key.created_at)}
              </td>
              <td className="py-3 text-sm text-[#7d6161]">
                {key.last_used_at ? formatRelativeDate(key.last_used_at) : 'Never'}
              </td>
              <td className="py-3 text-right">
                <RevokeKeyDialog
                  keyId={key.id}
                  keyName={key.name}
                  onRevoked={handleRefresh}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
