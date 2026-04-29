'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icon'

const AGENT_PROMPT = `You can use the ViralSlideMaker API to generate TikTok and Instagram carousel slides on my behalf.

Base URL: https://viralslidemaker.com/api/v1
OpenAPI spec: https://viralslidemaker.com/docs
Auth header: Authorization: Bearer vsl_YOUR_KEY

Read the OpenAPI spec for exact request and response shapes. Common operations:
- POST /carousel — create a carousel from a topic (1 credit)
- GET  /projects — list my projects
- POST /projects/{id}/render — get download URLs for slides
- GET  /projects/{id}/download — download all slides as a ZIP

When I ask you to make a carousel, call the API and report back the project ID and a link to https://viralslidemaker.com/project/<id>.`

const CURSOR_PROMPT = `In this project, when you need to create or edit TikTok carousel slides, use the ViralSlideMaker REST API.

- Base URL: https://viralslidemaker.com/api/v1
- OpenAPI 3.1 spec: https://viralslidemaker.com/docs
- Auth: Authorization: Bearer \${process.env.VIRALSLIDEMAKER_API_KEY}

Read the OpenAPI spec when you need exact endpoint shapes. Don't hard-code the key — read it from the environment.`

const CURL_SNIPPET = `curl -X POST https://viralslidemaker.com/api/v1/carousel \\
  -H "Authorization: Bearer vsl_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"topic":"5 productivity tips","templateId":"highlight-bar","slideCount":5}'`

const MCP_INSTALL_SNIPPET = `npx -y viralslidemaker-mcp`
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
      className="p-1.5 rounded-lg hover:bg-[#fadbdb] transition-colors focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-2"
    >
      <Icon name={copied ? 'check' : 'content_copy'} size="sm" className="text-[#3d0000]" />
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
        <pre className="bg-[#fff0f0] rounded-xl p-4 pr-12 font-mono text-[13px] text-[#281718] border border-[#dbc1bc]/30 overflow-x-auto whitespace-pre-wrap">
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
          icon="smart_toy"
          title="Use with Claude or ChatGPT"
          description="Paste this into a new Claude or ChatGPT conversation (or save it as a Project / Custom GPT instruction). The model will read the OpenAPI spec and call the API for you. For tighter integration, see the MCP server card below."
          snippetLabel="Paste into Claude / ChatGPT"
          snippet={AGENT_PROMPT}
          copyLabel="Copy Claude/ChatGPT prompt"
        />

        <GuideCard
          icon="terminal"
          title="Use in Cursor or other IDE agents"
          description="Drop this into your project's AGENTS.md, .cursorrules, or .github/copilot-instructions.md. Set VIRALSLIDEMAKER_API_KEY in your shell so the key never lands in source."
          snippetLabel="Add to your repo's agent rules"
          snippet={CURSOR_PROMPT}
          copyLabel="Copy Cursor / IDE prompt"
        />

        <GuideCard
          icon="code"
          title="Call directly from code"
          description="Any HTTP client works. Hit /carousel to generate, /projects/{id}/download to grab a ZIP. Full reference at /docs."
          snippetLabel="curl"
          snippet={CURL_SNIPPET}
          copyLabel="Copy curl example"
        />

        <GuideCard
          icon="extension"
          title="Use as a native MCP server"
          description="Connect Claude Desktop, Cursor, Windsurf, or ChatGPT directly to your account. The model calls our tools natively — no prompt-engineering needed. Tightest integration of all the options here."
          snippetLabel="Install"
          snippet={MCP_INSTALL_SNIPPET}
          copyLabel="Copy install command"
          linkLabel="Read the full setup guide"
          linkHref={MCP_GUIDE_URL}
        />
      </div>
    </div>
  )
}
