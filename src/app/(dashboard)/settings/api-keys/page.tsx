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

      {/* MCP Setup Section */}
      <div className="mt-8 bg-white rounded-xl p-8 border border-[#dbc1bc]/10">
        <div className="flex items-center gap-3 mb-4">
          <Icon name="smart_toy" size="md" className="text-[#3d0000]" />
          <div>
            <h2 className="text-lg font-bold text-[#3d0000]">MCP Server</h2>
            <p className="text-sm text-[#7d6161]">
              Connect AI agents like Claude Desktop, Cursor, or Claude Code to create carousels with natural language.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#3d0000] mb-2">How it works</h3>
            <p className="text-sm text-[#7d6161]">
              ViralSlideMaker exposes an MCP server with 4 tools: <code className="bg-[#fff0f0] px-1.5 py-0.5 rounded text-[13px] font-mono text-[#3d0000]">create_carousel</code>, <code className="bg-[#fff0f0] px-1.5 py-0.5 rounded text-[13px] font-mono text-[#3d0000]">list_templates</code>, <code className="bg-[#fff0f0] px-1.5 py-0.5 rounded text-[13px] font-mono text-[#3d0000]">edit_slide</code>, and <code className="bg-[#fff0f0] px-1.5 py-0.5 rounded text-[13px] font-mono text-[#3d0000]">render_carousel</code>. Once connected, just ask your AI to create a carousel and it handles the rest.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#3d0000] mb-2">Quick setup</h3>
            <ol className="text-sm text-[#7d6161] space-y-2 list-decimal list-inside">
              <li>Create an API key above (if you haven&apos;t already)</li>
              <li>Open your Claude Desktop config file (<code className="bg-[#fff0f0] px-1.5 py-0.5 rounded text-[13px] font-mono text-[#3d0000]">claude_desktop_config.json</code>)</li>
              <li>Add the MCP server config — the &quot;Claude Desktop&quot; tab in the create key dialog has the exact JSON to paste</li>
              <li>Restart Claude Desktop and ask it to create a carousel</li>
            </ol>
          </div>

          <div className="bg-[#fff0f0] rounded-xl p-4 border border-[#dbc1bc]/20">
            <p className="text-sm text-[#7d6161]">
              <span className="font-bold text-[#3d0000]">Full documentation:</span>{' '}
              <a href="/docs" className="text-[#3d0000] underline hover:no-underline">
                API Reference &amp; MCP Guide →
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
