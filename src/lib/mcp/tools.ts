import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { templates } from '@/lib/render/templates'
import { createProjectService, getProject } from '@/lib/services/project'
import { generateCarouselService } from '@/lib/services/carousel'
import { updateSlide } from '@/lib/services/editor'
import { getBrandKitForUser } from '@/lib/services/render'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Extract userId from MCP auth context.
 * Returns null if auth info is missing.
 */
function getUserId(extra: { authInfo?: { extra?: Record<string, unknown> } }): string | null {
  return (extra.authInfo?.extra?.userId as string) ?? null
}

/**
 * Register all MCP tools on the server instance.
 * Tools call existing service layer directly -- no HTTP round-trips.
 */
export function registerTools(server: McpServer): void {
  // --- list_templates ---
  server.tool(
    'list_templates',
    'List available carousel visual styles/templates',
    {},
    async () => {
      const templateList = templates.map((t) => ({
        id: t.id,
        name: t.name,
        textPosition: t.textPosition,
        textAlign: t.textAlign,
      }))
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(templateList, null, 2) }],
      }
    }
  )

  // --- create_carousel ---
  server.tool(
    'create_carousel',
    'Create a new carousel from a topic. Generates AI content, fetches images, and returns download URLs. Costs 1 credit.',
    {
      topic: z.string().min(1).max(500).describe('The topic or prompt for the carousel'),
      templateId: z.string().optional().describe('Visual template ID (use list_templates to see options)'),
      slideCount: z.number().int().min(3).max(20).optional().describe('Number of slides (default: 7)'),
      imageSource: z.enum(['stock', 'ai']).optional().describe('Image source: "stock" (Pexels) or "ai" (Imagen). Default: "stock"'),
    },
    async (params, extra) => {
      const userId = getUserId(extra)
      if (!userId) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Authentication required' }],
        }
      }

      const adminClient = createAdminClient()
      const templateId = params.templateId ?? 'bold-minimal'
      const slideCount = params.slideCount ?? 7
      const imageSource = params.imageSource ?? 'stock'

      try {
        // Create project
        const project = await createProjectService(
          userId,
          { title: `MCP: ${params.topic}`, topic: params.topic, templateId },
          { adminClient }
        )

        // Generate carousel content + images
        const result = await generateCarouselService(
          userId,
          {
            projectId: project.id,
            topic: params.topic,
            templateId,
            imageSource,
            slideCount,
          },
          { adminClient }
        )

        if (!result.success) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Generation failed: ${result.error}` }],
          }
        }

        // Fetch the project to get actual slide count
        const projectData = await getProject(userId, project.id, { adminClient })
        const actualSlideCount = Array.isArray(projectData?.slide_data)
          ? (projectData.slide_data as unknown[]).length
          : result.slideCount

        // Build download URLs
        const downloadUrls = Array.from({ length: actualSlideCount }, (_, i) =>
          `/api/v1/projects/${project.id}/download/${i}`
        )

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              projectId: project.id,
              slideCount: actualSlideCount,
              downloadUrls,
              zipUrl: `/api/v1/projects/${project.id}/download`,
            }, null, 2),
          }],
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
      backgroundUrl: z.string().url().optional().describe('Direct background image URL (must be https)'),
    },
    async (params, extra) => {
      const userId = getUserId(extra)
      if (!userId) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Authentication required' }],
        }
      }

      const adminClient = createAdminClient()

      // Map camelCase input to snake_case service params
      const updates: Record<string, unknown> = {}
      if (params.hookText !== undefined) updates.hook_text = params.hookText
      if (params.bodyText !== undefined) updates.body_text = params.bodyText
      if (params.imageQuery !== undefined) updates.image_query = params.imageQuery
      if (params.backgroundUrl !== undefined) updates.background_url = params.backgroundUrl

      try {
        const slide = await updateSlide(
          userId,
          params.projectId,
          params.slideIndex,
          updates,
          { adminClient }
        )

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(slide, null, 2) }],
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
    async (params, extra) => {
      const userId = getUserId(extra)
      if (!userId) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Authentication required' }],
        }
      }

      const adminClient = createAdminClient()

      try {
        const project = await getProject(userId, params.projectId, { adminClient })
        if (!project) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: 'Project not found' }],
          }
        }

        const slides = Array.isArray(project.slide_data) ? project.slide_data as unknown[] : []
        const slideCount = slides.length

        const downloadUrls = Array.from({ length: slideCount }, (_, i) =>
          `/api/v1/projects/${params.projectId}/download/${i}`
        )

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              projectId: params.projectId,
              slideCount,
              downloadUrls,
              zipUrl: `/api/v1/projects/${params.projectId}/download`,
            }, null, 2),
          }],
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
}
