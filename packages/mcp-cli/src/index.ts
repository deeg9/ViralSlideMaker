/**
 * viralslidemaker-mcp — stdio bridge for ViralSlideMaker MCP server
 *
 * TypeScript source reference for the bin/cli.js entry point.
 * This file documents the implementation intent; bin/cli.js is the
 * actual executable (plain JS, zero-build).
 *
 * Spawns mcp-remote to connect a local AI agent (Claude Desktop, Cursor, etc.)
 * to the hosted ViralSlideMaker MCP endpoint over stdio transport.
 *
 * Required env:
 *   VIRALSLIDEMAKER_API_KEY — your vsl_ API key
 * Optional env:
 *   VIRALSLIDEMAKER_BASE_URL — override base URL (default: https://viralslidemaker.com)
 */

import { spawn, type ChildProcess } from 'node:child_process'

const apiKey: string | undefined = process.env.VIRALSLIDEMAKER_API_KEY
if (!apiKey) {
  process.stderr.write(
    'Error: VIRALSLIDEMAKER_API_KEY environment variable is not set.\n' +
      'Get your API key at https://viralslidemaker.com → Account Settings → API Keys\n'
  )
  process.exit(1)
}

const baseUrl: string =
  process.env.VIRALSLIDEMAKER_BASE_URL || 'https://viralslidemaker.com'
const mcpEndpoint = `${baseUrl}/api/mcp`

const child: ChildProcess = spawn(
  'npx',
  ['-y', 'mcp-remote', mcpEndpoint, '--header', `Authorization:Bearer ${apiKey}`],
  { stdio: 'inherit' }
)

child.on('error', (err: Error) => {
  process.stderr.write(`Failed to start mcp-remote: ${err.message}\n`)
  process.exit(1)
})

child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
  if (signal) {
    process.exit(1)
  }
  process.exit(code ?? 0)
})

// Forward termination signals to child process
function cleanup(signal: NodeJS.Signals): void {
  child.kill(signal)
}

process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGTERM', () => cleanup('SIGTERM'))
