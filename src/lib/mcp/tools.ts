import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/render/templates/index'
import { generateCarousel } from '@/lib/services/carousel'
import { getProject, updateProjectService } from '@/lib/services/projects'
import {
  deductCreditAdmin,
  getCreditBalanceAdmin,
} from '@/lib/credits/check-credits'
import { searchPhotos } from '@/lib/pexels/search-photos'

function errorResult(code: string, message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: code, message }) }],
  }
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
  }
}

function getUserId(extra: { authInfo?: { extra?: Record<string, unknown> } }): string | null {
  return (extra.authInfo?.extra?.userId as string) ?? null
}

export function registerTools(server: McpServer) {
  // Tool 1: list_templates
  server.tool(
    'list_templates',
    'List available carousel visual styles/templates. Call this first to discover template IDs before creating a carousel. Returns id, name, textPosition, and textAlign for each template. No credit cost.',
    {},
    (_args, extra) => {
      const userId = getUserId(extra)
      if (!userId) return errorResult('UNAUTHORIZED', 'Authentication required')

      return jsonResult({
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          textPosition: t.textPosition,
          textAlign: t.textAlign,
        })),
      })
    }
  )

  // Tool 2: create_carousel
  server.tool(
    'create_carousel',
    'Create a new carousel from a topic. Generates AI content, fetches background images, and returns a project with download URLs. Costs 1 credit. Use list_templates first to pick a templateId, or omit for the default \'bold-minimal\' style.',
    {
      topic: z
        .string()
        .min(1)
        .max(500)
        .describe('The topic or prompt for the carousel'),
      templateId: z
        .string()
        .optional()
        .default('bold-minimal')
        .describe('Template ID from list_templates. Default: bold-minimal'),
      slideCount: z
        .number()
        .int()
        .min(3)
        .max(20)
        .optional()
        .default(7)
        .describe('Number of slides (3-20). Default: 7'),
      imageSource: z
        .enum(['stock', 'ai'])
        .optional()
        .default('stock')
        .describe(
          'Image source: "stock" for Pexels photos, "ai" for AI-generated. Default: stock'
        ),
    },
    async (args, extra) => {
      const userId = getUserId(extra)
      if (!userId) return errorResult('UNAUTHORIZED', 'Authentication required')

      try {
        const supabase = createAdminClient()

        // Check credit balance before deducting
        const balance = await getCreditBalanceAdmin(supabase, userId)
        if (balance < 1) {
          return errorResult(
            'INSUFFICIENT_CREDITS',
            'You need at least 1 credit to create a carousel'
          )
        }

        // Deduct 1 credit
        const deducted = await deductCreditAdmin(
          supabase,
          userId,
          'carousel_generation',
          'MCP: ' + args.topic
        )
        if (!deducted) {
          return errorResult(
            'INSUFFICIENT_CREDITS',
            'You need at least 1 credit to create a carousel'
          )
        }

        // Generate carousel
        const { projectId, slideCount } = await generateCarousel(
          supabase,
          userId,
          {
            topic: args.topic,
            templateId: args.templateId,
            slideCount: args.slideCount,
            imageSource: args.imageSource,
          }
        )

        // Build download URLs
        const downloadUrls = Array.from({ length: slideCount }, (_, i) =>
          `/api/render?projectId=${projectId}&slide=${i}&download`
        )
        const zipUrl = `/api/v1/projects/${projectId}/download`

        // Check remaining credits
        const creditsRemaining = await getCreditBalanceAdmin(supabase, userId)

        return jsonResult({
          projectId,
          slideCount,
          downloadUrls,
          zipUrl,
          creditsRemaining,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return errorResult('GENERATION_FAILED', message)
      }
    }
  )

  // Tool 3: edit_slide
  server.tool(
    'edit_slide',
    'Edit a slide in an existing carousel project. You can change the hook text, body text, search for a new background image, or set a direct image URL. Does not cost any credits. After editing, use render_carousel to get updated download URLs.',
    {
      projectId: z.string().uuid().describe('Project ID from create_carousel'),
      slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
      hookText: z
        .string()
        .optional()
        .describe('New hook/title text for the slide'),
      bodyText: z
        .string()
        .optional()
        .describe('New body/description text for the slide'),
      imageQuery: z
        .string()
        .optional()
        .describe('New search query for a Pexels background image'),
      backgroundUrl: z
        .string()
        .url()
        .optional()
        .describe('Direct background image URL (must be https)'),
    },
    async (args, extra) => {
      const userId = getUserId(extra)
      if (!userId) return errorResult('UNAUTHORIZED', 'Authentication required')

      try {
        const supabase = createAdminClient()

        // Fetch project (scoped to user)
        const project = await getProject(supabase, userId, args.projectId)
        if (!project) {
          return errorResult('NOT_FOUND', 'Project not found')
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const slideData = (project.slide_data ?? []) as any[]
        if (args.slideIndex >= slideData.length) {
          return errorResult(
            'INVALID_INDEX',
            `Slide index ${args.slideIndex} is out of bounds (${slideData.length} slides)`
          )
        }

        // Validate at least one edit field is provided
        if (
          !args.hookText &&
          !args.bodyText &&
          !args.imageQuery &&
          !args.backgroundUrl
        ) {
          return errorResult(
            'NO_CHANGES',
            'At least one of hookText, bodyText, imageQuery, or backgroundUrl must be provided'
          )
        }

        // Validate backgroundUrl scheme (T-27-02)
        if (args.backgroundUrl && !args.backgroundUrl.startsWith('https://')) {
          return errorResult(
            'INVALID_URL',
            'backgroundUrl must use https:// scheme'
          )
        }

        // Build patch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch: Record<string, any> = {}

        if (args.hookText !== undefined) patch.hook_text = args.hookText
        if (args.bodyText !== undefined) patch.body_text = args.bodyText

        // Handle image query (search Pexels for new background)
        if (args.imageQuery && !args.backgroundUrl) {
          const photos = await searchPhotos(args.imageQuery, {
            orientation: 'portrait',
            per_page: 1,
          })
          if (photos.length > 0) {
            patch.background_url = photos[0].src.portrait
            patch.pexels_photo_id = photos[0].id ?? null
          }
          patch.image_query = args.imageQuery
        }

        // Direct background URL takes precedence
        if (args.backgroundUrl) {
          patch.background_url = args.backgroundUrl
          patch.pexels_photo_id = null
        }

        // Apply patch to slide
        const updatedSlide = { ...slideData[args.slideIndex], ...patch }
        const updatedArray = [...slideData]
        updatedArray[args.slideIndex] = updatedSlide

        // Save back to DB
        await updateProjectService(supabase, userId, args.projectId, {
          slide_data: updatedArray,
        })

        return jsonResult({ slide: updatedSlide, slideIndex: args.slideIndex })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return errorResult('UPDATE_FAILED', message)
      }
    }
  )

  // Tool 4: render_carousel
  server.tool(
    'render_carousel',
    'Get download URLs for all slides in a carousel project. Use this after create_carousel or edit_slide to get fresh image download links. No credit cost.',
    {
      projectId: z.string().uuid().describe('Project ID from create_carousel'),
    },
    async (args, extra) => {
      const userId = getUserId(extra)
      if (!userId) return errorResult('UNAUTHORIZED', 'Authentication required')

      try {
        const supabase = createAdminClient()

        const project = await getProject(supabase, userId, args.projectId)
        if (!project) {
          return errorResult('NOT_FOUND', 'Project not found')
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const slideData = (project.slide_data ?? []) as any[]
        if (slideData.length === 0) {
          return errorResult('NO_SLIDES', 'Project has no slides')
        }

        const slideCount = slideData.length
        const downloadUrls = Array.from({ length: slideCount }, (_, i) =>
          `/api/render?projectId=${args.projectId}&slide=${i}&download`
        )
        const zipUrl = `/api/v1/projects/${args.projectId}/download`

        return jsonResult({ projectId: args.projectId, slideCount, downloadUrls, zipUrl })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return errorResult('NOT_FOUND', message)
      }
    }
  )
}
