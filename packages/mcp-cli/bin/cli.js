#!/usr/bin/env node

/**
 * viralslidemaker-mcp — stdio bridge for ViralSlideMaker MCP server
 *
 * Spawns mcp-remote to connect a local AI agent (Claude Desktop, Cursor, etc.)
 * to the hosted ViralSlideMaker MCP endpoint over stdio transport.
 *
 * Required env:
 *   VIRALSLIDEMAKER_API_KEY — your vsl_ API key
 * Optional env:
 *   VIRALSLIDEMAKER_BASE_URL — override base URL (default: https://viralslidemaker.com)
 */

import { spawn } from 'node:child_process';

const apiKey = process.env.VIRALSLIDEMAKER_API_KEY;
if (!apiKey) {
  process.stderr.write(
    'Error: VIRALSLIDEMAKER_API_KEY environment variable is not set.\n' +
    'Get your API key at https://viralslidemaker.com/settings/api-keys\n'
  );
  process.exit(1);
}

const baseUrl = process.env.VIRALSLIDEMAKER_BASE_URL || 'https://viralslidemaker.com';
const mcpEndpoint = `${baseUrl}/api/mcp`;

const child = spawn(
  'npx',
  ['-y', 'mcp-remote', mcpEndpoint, '--header', `Authorization:Bearer ${apiKey}`],
  { stdio: 'inherit' }
);

child.on('error', (err) => {
  process.stderr.write(`Failed to start mcp-remote: ${err.message}\n`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});

// Forward termination signals to child process
function cleanup(signal) {
  child.kill(signal);
}

process.once('SIGINT', () => cleanup('SIGINT'));
process.once('SIGTERM', () => cleanup('SIGTERM'));
