import { listApiKeys } from './actions'
import { Icon } from '@/components/ui/icon'
import { ApiKeyTable } from '@/components/api-keys/api-key-table'

export default async function ApiKeysPage() {
  const keys = await listApiKeys()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Icon name="key" size="lg" className="text-[#3d0000]" />
        <div>
          <h1 className="text-2xl font-bold text-[#3d0000]">API Keys</h1>
          <p className="text-sm text-[#7d6161]">
            Create and manage API keys to access the ViralSlideMaker REST API.
          </p>
        </div>
      </div>
      <div className="bg-white rounded-xl p-8 border border-[#dbc1bc]/10">
        <ApiKeyTable keys={keys} />
      </div>
    </div>
  )
}
