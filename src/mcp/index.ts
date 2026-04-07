#!/usr/bin/env node
/**
 * ViralSlideMaker MCP Server - npm package entry point.
 *
 * Usage:
 *   VIRALSLIDEMAKER_API_KEY=vsl_xxx viralslidemaker-mcp
 *
 * Or in Claude Code / Cursor MCP config:
 *   {
 *     "mcpServers": {
 *       "viralslidemaker": {
 *         "command": "npx",
 *         "args": ["viralslidemaker-mcp"],
 *         "env": {
 *           "VIRALSLIDEMAKER_API_KEY": "vsl_xxx",
 *           "VIRALSLIDEMAKER_BASE_URL": "https://viralslidemaker.com"
 *         }
 *       }
 *     }
 *   }
 */

import { startStdioServer } from './stdio-server.js'

startStdioServer().catch((err) => {
  console.error('Fatal error starting MCP server:', err)
  process.exit(1)
})
