'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Icon } from '@/components/ui/icon'
import { createApiKey } from '@/app/(dashboard)/settings/api-keys/actions'

const REST_TABS = ['curl', 'JavaScript', 'Python'] as const
const MCP_TABS = ['Claude Desktop', 'Claude Code'] as const
type SnippetTab = (typeof REST_TABS)[number] | (typeof MCP_TABS)[number]

function getSnippet(tab: SnippetTab, key: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://viralslidemaker.com'
  switch (tab) {
    case 'curl':
      return `curl -X GET ${baseUrl}/api/v1/templates \\
  -H "Authorization: Bearer ${key}"`
    case 'JavaScript':
      return `const res = await fetch('${baseUrl}/api/v1/templates', {
  headers: { 'Authorization': 'Bearer ${key}' }
});
const data = await res.json();`
    case 'Python':
      return `import requests

res = requests.get(
    '${baseUrl}/api/v1/templates',
    headers={'Authorization': 'Bearer ${key}'}
)
data = res.json()`
    case 'Claude Desktop':
      return `{
  "mcpServers": {
    "viralslidemaker": {
      "command": "npx",
      "args": ["-y", "viralslidemaker-mcp"],
      "env": {
        "VIRALSLIDEMAKER_API_KEY": "${key}"
      }
    }
  }
}`
    case 'Claude Code':
      return `claude mcp add --transport stdio --env VIRALSLIDEMAKER_API_KEY=${key} --scope local viralslidemaker -- npx -y viralslidemaker-mcp`
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={label}
      className="p-1.5 rounded-md bg-white border border-[#dbc1bc]/50 text-[#3d0000] hover:border-[#3d0000]/40 hover:shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2"
    >
      <Icon name={copied ? 'check' : 'content_copy'} size="sm" />
    </button>
  )
}

interface CreateKeyDialogProps {
  onKeyCreated: () => void
  disabled?: boolean
  triggerClassName?: string
}

export function CreateKeyDialog({ onKeyCreated, disabled, triggerClassName }: CreateKeyDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'name' | 'reveal'>('name')
  const [name, setName] = useState('')
  const [rawKey, setRawKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<SnippetTab>('curl')

  function handleClose() {
    if (step === 'reveal') {
      onKeyCreated()
    }
    setOpen(false)
    // Reset after close animation
    setTimeout(() => {
      setStep('name')
      setName('')
      setRawKey('')
      setError('')
      setActiveTab('curl')
    }, 200)
  }

  async function handleCreate() {
    setError('')
    setLoading(true)
    try {
      const result = await createApiKey(name)
      if (result.success) {
        setRawKey(result.rawKey)
        setStep('reveal')
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to create API key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose()
      } else {
        setOpen(true)
      }
    }}>
      <Dialog.Trigger
        disabled={disabled}
        render={
          <button
            className={triggerClassName ?? `bg-[#3d0000] text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Icon name="add" size="sm" />
            Create API Key
          </button>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Popup className={`fixed left-1/2 top-1/2 z-50 w-full ${step === 'reveal' ? 'max-w-lg' : 'max-w-md'} -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8 shadow-[0px_40px_80px_rgba(61,0,0,0.15)]`}>
          {step === 'name' ? (
            <>
              <Dialog.Title className="mb-1 text-lg font-bold text-[#3d0000]">
                Create API Key
              </Dialog.Title>
              <Dialog.Description className="mb-6 text-sm text-[#7d6161]">
                Give your key a name to identify it later.
              </Dialog.Description>
              <div className="flex flex-col gap-1.5 mb-6">
                <label
                  htmlFor="key-name"
                  className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]"
                >
                  Key Name
                </label>
                <input
                  id="key-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production App"
                  disabled={loading}
                  className="h-12 rounded-xl border border-[#dbc1bc]/30 bg-[#fff0f0] px-4 text-sm text-[#3d0000] outline-none focus:border-[#3d0000] focus:ring-1 focus:ring-[#3d0000] focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2"
                />
                {error && (
                  <p className="text-sm text-[#ba1a1a]">{error}</p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Dialog.Close
                  render={
                    <button className="px-6 py-3 rounded-xl border border-[#dbc1bc] text-[#7d6161] font-bold text-sm focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2">
                      Never mind
                    </button>
                  }
                />
                <button
                  onClick={handleCreate}
                  disabled={loading || !name.trim()}
                  className="bg-[#3d0000] text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  Create Key
                </button>
              </div>
            </>
          ) : (
            <>
              <Dialog.Title className="mb-1 text-lg font-bold text-[#3d0000]">
                API Key Created
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Your new API key has been created. Copy it now.
              </Dialog.Description>

              {/* Warning banner */}
              <div className="bg-[#fff0f0] border border-[#dbc1bc]/30 rounded-xl p-4 mb-3 flex items-start gap-3">
                <Icon name="warning" size="sm" className="text-[#3d0000] flex-shrink-0 mt-0.5" />
                <p className="text-[#3d0000] font-semibold text-sm">
                  Copy your API key now. It will not be shown again.
                </p>
              </div>

              {/* Security tip */}
              <p className="text-xs text-[#7d6161] mb-4 px-1">
                Don&apos;t paste this key into chat windows (ChatGPT, Claude.ai, etc.). Use the MCP Server tabs below to configure AI agents properly.
              </p>

              {/* Key display */}
              <div className="relative mb-6">
                <div className="bg-[#fff0f0] rounded-xl p-4 pr-14 font-mono text-[13px] text-[#3d0000] border border-[#dbc1bc]/30 break-all select-all">
                  {rawKey}
                </div>
                <div className="absolute top-3 right-3">
                  <CopyButton text={rawKey} label="Copy API key to clipboard" />
                </div>
              </div>

              {/* Quick-start tabs — split into REST API and MCP Server rows */}
              <div className="mb-6">
                <div className="mb-3 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-1.5">
                      REST API
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {REST_TABS.map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={
                            activeTab === tab
                              ? 'bg-[#fadbdb] text-[#3d0000] font-bold px-3 py-2 rounded-lg text-sm'
                              : 'text-[#7d6161] px-3 py-2 rounded-lg text-sm hover:bg-[#fff0f0]'
                          }
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-1.5">
                      MCP Server
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {MCP_TABS.map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={
                            activeTab === tab
                              ? 'bg-[#fadbdb] text-[#3d0000] font-bold px-3 py-2 rounded-lg text-sm'
                              : 'text-[#7d6161] px-3 py-2 rounded-lg text-sm hover:bg-[#fff0f0]'
                          }
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <pre className="bg-[#fff0f0] rounded-xl p-4 pr-14 font-mono text-[13px] text-[#281718] border border-[#dbc1bc]/30 overflow-x-auto whitespace-pre-wrap">
                    {getSnippet(activeTab, rawKey)}
                  </pre>
                  <div className="absolute top-3 right-3">
                    <CopyButton
                      text={getSnippet(activeTab, rawKey)}
                      label="Copy code snippet to clipboard"
                    />
                  </div>
                </div>
              </div>

              {/* Done button */}
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="bg-[#3d0000] text-white px-6 py-3 rounded-xl font-bold text-sm focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2"
                >
                  Done
                </button>
              </div>

              {/* Accessibility live region */}
              <div aria-live="polite" className="sr-only" />
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
