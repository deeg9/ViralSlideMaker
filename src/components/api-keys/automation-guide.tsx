'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icon'

const CURL_SNIPPET = `curl -X POST https://viralslidemaker.com/api/v1/carousel \\
  -H "Authorization: Bearer vsl_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"topic":"5 productivity tips","templateId":"highlight-bar","slideCount":5}'`

const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "viralslidemaker": {
      "command": "npx",
      "args": ["-y", "viralslidemaker-mcp"],
      "env": {
        "VIRALSLIDEMAKER_API_KEY": "vsl_YOUR_KEY"
      }
    }
  }
}`
const MCP_GUIDE_URL = 'https://github.com/deeg9/ViralSlideMaker/blob/main/docs/MCP-GUIDE.md'

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

interface GuideCardProps {
  icon: string
  title: string
  description: string
  snippetLabel: string
  snippet: string
  copyLabel: string
  linkLabel?: string
  linkHref?: string
}

function GuideCard({ icon, title, description, snippetLabel, snippet, copyLabel, linkLabel, linkHref }: GuideCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-[#dbc1bc]/10">
      <div className="flex items-center gap-3 mb-2">
        <Icon name={icon} size="md" className="text-[#3d0000]" />
        <h3 className="text-base font-bold text-[#3d0000]">{title}</h3>
      </div>
      <p className="text-sm text-[#7d6161] mb-4">{description}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-2">
        {snippetLabel}
      </p>
      <div className="relative">
        <pre className="bg-[#fff0f0] rounded-xl p-4 pr-14 font-mono text-[13px] text-[#281718] border border-[#dbc1bc]/30 overflow-x-auto whitespace-pre-wrap">
          {snippet}
        </pre>
        <div className="absolute top-3 right-3">
          <CopyButton text={snippet} label={copyLabel} />
        </div>
      </div>
      {linkHref && linkLabel ? (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#3d0000] hover:underline"
        >
          {linkLabel}
          <Icon name="open_in_new" size="sm" />
        </a>
      ) : null}
    </div>
  )
}

export function AutomationGuide() {
  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#3d0000]">Connect to your tools</h2>
        <p className="text-sm text-[#7d6161]">
          Replace <span className="font-mono text-[#3d0000]">vsl_YOUR_KEY</span> with the key shown when you created it.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <GuideCard
          icon="extension"
          title="Use with Claude Desktop or Claude Code (MCP)"
          description="Connect your AI agent natively via MCP. Tools appear in the model's tool picker — no prompt engineering, no copy-pasting credentials into chat. Recommended path for non-developers."
          snippetLabel="Paste into claude_desktop_config.json"
          snippet={MCP_CONFIG_SNIPPET}
          copyLabel="Copy Claude Desktop config"
          linkLabel="Read the full setup guide (Claude Desktop, Claude Code, Cursor, ChatGPT)"
          linkHref={MCP_GUIDE_URL}
        />

        <GuideCard
          icon="code"
          title="Call directly from code"
          description="Any HTTP client works. Hit /carousel to generate, /projects/{id}/download to grab a ZIP. Full reference at /docs."
          snippetLabel="curl"
          snippet={CURL_SNIPPET}
          copyLabel="Copy curl example"
        />
      </div>
    </div>
  )
}
