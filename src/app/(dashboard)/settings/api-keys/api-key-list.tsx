'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RevokeKeyDialog } from './revoke-key-dialog'
import { CreateKeyDialog } from './create-key-dialog'
import type { listApiKeys } from './actions'

type ApiKeyItem = Awaited<ReturnType<typeof listApiKeys>>[number]

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface ApiKeyListProps {
  keys: ApiKeyItem[]
}

export function ApiKeyList({ keys }: ApiKeyListProps) {
  const activeKeyCount = keys.filter((k) => !k.revoked_at).length

  if (keys.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 px-4">
        <Icon
          name="vpn_key"
          size="xl"
          className="text-muted-foreground mb-4"
        />
        <h2 className="text-base font-bold mb-2">No API keys yet</h2>
        <p className="text-sm text-muted-foreground max-w-xs text-center mb-6">
          Create an API key to access the Viral Slide Maker API. Keys
          authenticate your requests and track usage against your credit balance.
        </p>
        <CreateKeyDialog keyCount={activeKeyCount} triggerLabel="Create your first key" />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => {
            const isRevoked = !!key.revoked_at
            return (
              <TableRow
                key={key.id}
                className={isRevoked ? 'opacity-50' : undefined}
              >
                <TableCell className="font-medium">{key.label}</TableCell>
                <TableCell className="font-mono text-sm">
                  {key.prefix}****
                </TableCell>
                <TableCell>
                  {new Date(key.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </TableCell>
                <TableCell>
                  {key.last_used_at
                    ? formatRelativeTime(key.last_used_at)
                    : 'Never'}
                </TableCell>
                <TableCell className="text-right">
                  {isRevoked ? (
                    <Badge variant="secondary">Revoked</Badge>
                  ) : (
                    <RevokeKeyDialog keyId={key.id} keyLabel={key.label} />
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
