/**
 * Stdio transport MCP server for ViralSlideMaker.
 *
 * Runs as a subprocess for local AI agents (Claude Code, Cursor, etc.).
 * Wraps the REST API via HTTP client -- no direct DB access needed.
 *
 * Auth: Reads VIRALSLIDEMAKER_API_KEY from env at startup.
 * Tools read userId from authInfo (HTTP path) or from env-based API key (stdio path).
 *
 * SECURITY:
 * - All output goes to stderr (stdout is reserved for JSON-RPC)
 * - API key is never included in tool responses or error messages
 * - Missing API key causes immediate exit with clear error
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  createCarousel,
  editSlide,
  renderCarousel,
  listTemplates,
} from './http-client.js'

export async function startStdioServer(): Promise<void> {
  // Validate API key at startup (T-17-08: exit early if missing)
  if (!process.env.VIRALSLIDEMAKER_API_KEY) {
    console.error(
      'Error: VIRALSLIDEMAKER_API_KEY environment variable is required.\n' +
        'Get your API key from the ViralSlideMaker dashboard.'
    )
    process.exit(1)
  }

  const server = new McpServer({
    name: 'viralslidemaker',
    version: '1.0.0',
  })

  // --- list_templates ---
  server.tool(
    'list_templates',
    'List available carousel visual styles/templates',
    {},
    async () => {
      try {
        const templates = await listTemplates()
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(templates, null, 2) }],
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
        }
      }
    }
  )

  // --- create_carousel ---
  server.tool(
    'create_carousel',
    'Create a new carousel from a topic. Generates AI content, fetches images, and returns download URLs. Costs 1 credit.',
    {
      topic: z.string().min(1).max(500).describe('The topic or prompt for the carousel'),
      templateId: z
        .string()
        .optional()
        .describe('Visual template ID (use list_templates to see options)'),
      slideCount: z
        .number()
        .int()
        .min(3)
        .max(20)
        .optional()
        .describe('Number of slides (default: 7)'),
      imageSource: z
        .enum(['stock', 'ai'])
        .optional()
        .describe('Image source: "stock" (Pexels) or "ai" (Imagen). Default: "stock"'),
    },
    async (params) => {
      try {
        const result = await createCarousel({
          topic: params.topic,
          templateId: params.templateId,
          slideCount: params.slideCount,
          imageSource: params.imageSource,
        })

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
        }
      }
    }
  )

  // --- edit_slide ---
  server.tool(
    'edit_slide',
    'Edit a slide in an existing carousel project. Update text, images, or background.',
    {
      projectId: z.string().uuid().describe('The project ID'),
      slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
      hookText: z.string().optional().describe('New hook/title text'),
      bodyText: z.string().optional().describe('New body text'),
      imageQuery: z.string().optional().describe('New image search query (triggers Pexels search)'),
      backgroundUrl: z
        .string()
        .url()
        .optional()
        .describe('Direct background image URL (must be https)'),
    },
    async (params) => {
      try {
        const result = await editSlide({
          projectId: params.projectId,
          slideIndex: params.slideIndex,
          hookText: params.hookText,
          bodyText: params.bodyText,
          imageQuery: params.imageQuery,
          backgroundUrl: params.backgroundUrl,
        })

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
        }
      }
    }
  )

  // --- render_carousel ---
  server.tool(
    'render_carousel',
    'Get download URLs for all slides in a carousel project. No credit cost -- uses already-generated data.',
    {
      projectId: z.string().uuid().describe('The project ID'),
    },
    async (params) => {
      try {
        const result = await renderCarousel(params.projectId)

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
        }
      }
    }
  )

  // Connect via stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // T-17-07: Log to stderr only (stdout is JSON-RPC)
  console.error('ViralSlideMaker MCP server running on stdio')
}
