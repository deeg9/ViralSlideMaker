import { listApiKeys } from './actions'
import { ApiKeyList } from './api-key-list'
import { CreateKeyDialog } from './create-key-dialog'
import { Icon } from '@/components/ui/icon'

export default async function ApiKeysPage() {
  const keys = await listApiKeys()
  const activeKeyCount = keys.filter((k) => !k.revoked_at).length

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Icon name="key" size="lg" className="text-[#3d0000]" />
          <div>
            <h1 className="text-2xl font-bold text-[#3d0000]">API Keys</h1>
            <p className="text-sm text-[#7d6161]">
              Manage API keys for programmatic access to Viral Slide Maker.
            </p>
          </div>
        </div>
        <CreateKeyDialog keyCount={activeKeyCount} />
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Rate limits: Free 10/min, Plus 30/min, Pro 60/min
      </p>
      <ApiKeyList keys={keys} />
    </div>
  )
}
