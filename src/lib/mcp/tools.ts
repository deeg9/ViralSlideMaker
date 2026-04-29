// src/lib/mcp/tools.ts
//
// Registers the 4 v2.6 MCP tools (list_templates, create_carousel, edit_slide, render_carousel)
// on the McpServer instance from createMcpHandler's setup callback.
//
// Cross-phase contract (Phase 40 → Phase 41):
//   - Tool handlers read userId via `extra.authInfo?.extra?.userId` (set by withMcpAuth → verifyToken).
//   - Tool handlers RETURN errors in-band: { isError: true, content: [{ type: 'text', text }] }.
//     They do NOT throw OAuthError (those are auth-layer only — see
//     node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js:140-162).
//
// Service-layer contract (locked decision in 41-CONTEXT.md):
//   Tool handlers MUST NOT fetch() to /api/v1/* — that would re-trigger auth/rate-limit/credit
//   deduction. They call src/lib/services/* directly with an admin Supabase client.
//
// Anti-patterns explicitly avoided here:
//   1. Wrapping inputSchema in z.object({...}) — SDK expects a raw shape; wrapping fails silently.
//   2. Throwing OAuthError/InvalidTokenError from a tool handler — auth-layer only.
//   3. Calling fetch('http://localhost:3000/api/v1/...') — re-triggers auth+rate-limit+credit.
//   4. Defaulting templateId to 'bold-minimal' — that template no longer exists; field is REQUIRED.
//   5. Inlining base64 image data in render_carousel response — explicitly forbidden by MCP-TOOL-04.
//   6. Hardcoding `https://viralslidemaker.com` — use env-derived getAppUrl() helper.
//   7. Auto-fetching Pexels when image_query is patched in edit_slide — REST does not, MCP must not.

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { templates } from '@/lib/render/templates'
import { generateCarousel } from '@/lib/services/carousel'
import { getProject, updateProjectService } from '@/lib/services/projects'
import {
  deductCreditAdmin,
  getCreditBalanceAdmin,
  getUserTier,
  checkProjectLimit,
  FREE_TIER_PROJECT_LIMIT,
} from '@/lib/credits/check-credits'
import { createAdminClient } from '@/lib/supabase/admin'

// Mirrors src/lib/services/publish.ts:70-75 (appOrigin) and
// src/app/(dashboard)/project/[id]/publish-actions.ts:120 — single env precedence rule.
function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

function getUserId(extra: unknown): string | undefined {
  const e = extra as { authInfo?: { extra?: Record<string, unknown> } } | undefined
  const v = e?.authInfo?.extra?.userId
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function errorContent(code: string, message: string, extra: Record<string, unknown> = {}) {
  return {
    isError: true as const,
    content: [
      { type: 'text' as const, text: JSON.stringify({ error: code, message, ...extra }) },
    ],
  }
}

function successContent(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

// Mirrors PATCH /api/v1/projects/{id}/slides/{index} whitelist
// (src/app/api/v1/projects/[id]/slides/[index]/route.ts:41-51).
const ALLOWED_PATCH_FIELDS = [
  'hook_text',
  'body_text',
  'hook_segments',
  'body_segments',
  'image_query',
  'background_url',
  'style_overrides',
  'custom_texts',
  'custom_images',
] as const

export function registerTools(server: McpServer): void {
  // ─── Tool 1: list_templates (free) ─────────────────────────────────────────
  server.registerTool(
    'list_templates',
    {
      description: [
        'List the available carousel visual styles (templates).',
        'Call this FIRST to discover valid templateId values BEFORE using create_carousel.',
        'Returns id, name, thumbnail, textPosition, and textAlign for each template — same projection as REST GET /api/v1/templates.',
        'No credit cost. No prerequisites beyond the standard Bearer-token MCP auth.',
        'Typical workflow: list_templates → create_carousel(topic, templateId) → edit_slide(...) → render_carousel(projectId).',
      ].join(' '),
      inputSchema: {},
    },
    async () => {
      const data = templates.map(({ id, name, thumbnail, textPosition, textAlign }) => ({
        id,
        name,
        thumbnail,
        textPosition,
        textAlign,
      }))
      return successContent({ templates: data })
    }
  )

  // ─── Tool 2: create_carousel (1 credit) ───────────────────────────────────
  server.registerTool(
    'create_carousel',
    {
      description: [
        'Create a new carousel from a topic. Generates AI text content + background images and saves a project.',
        'Costs 1 credit (matches POST /api/v1/carousel exactly). Returns { projectId, slideCount, dashboardUrl } so the user can immediately open the result in their browser.',
        'PREREQUISITE: call list_templates first and pass a valid templateId — there is no default (the v2.5 trim removed bold-minimal).',
        'Optional slideCount (3-10, default 7; free tier is capped at 3). Optional imageSource: "stock" (Pexels, fast) or "ai" (Imagen, slower, no extra credit cost).',
        'On insufficient credits, returns INSUFFICIENT_CREDITS as an in-band isError content block (NOT a thrown exception). On generation failure, the credit is automatically refunded.',
      ].join(' '),
      inputSchema: {
        topic: z
          .string()
          .min(1)
          .max(500)
          .describe('Carousel topic. Example: "5 productivity tips for remote workers".'),
        templateId: z
          .string()
          .min(1)
          .describe('Template ID from list_templates. REQUIRED. Example: "highlight-bar".'),
        slideCount: z
          .number()
          .int()
          .min(3)
          .max(10)
          .optional()
          .describe('Slide count 3-10. Default 7. Free plan capped at 3.'),
        imageSource: z
          .enum(['stock', 'ai'])
          .optional()
          .describe('"stock" = Pexels (free, fast). "ai" = Imagen (slower, higher visual quality). Default "stock".'),
      },
    },
    async (args, extra) => {
      const userId = getUserId(extra)
      if (!userId) return errorContent('UNAUTHORIZED', 'Missing auth context')

      const { topic, templateId, slideCount, imageSource } = args as {
        topic: string
        templateId: string
        slideCount?: number
        imageSource?: 'stock' | 'ai'
      }
      const supabase = createAdminClient()
      const validSlideCount = slideCount ?? 7
      const validImageSource = imageSource ?? 'stock'

      // Free-tier project-count cap (mirrors /api/v1/carousel/route.ts:63-71)
      const tier = await getUserTier(userId)
      const projectAllowed = await checkProjectLimit(userId, tier)
      if (!projectAllowed) {
        return errorContent(
          'PROJECT_LIMIT_EXCEEDED',
          `Free plan is limited to ${FREE_TIER_PROJECT_LIMIT} projects. Upgrade for unlimited.`
        )
      }

      // Free-tier slide-count cap (mirrors /api/v1/carousel/route.ts:54-61)
      if (tier === 'free' && validSlideCount > 3) {
        return errorContent(
          'VALIDATION_ERROR',
          'Free plan is limited to 3 slides per carousel. Upgrade to hobbyist or creator for up to 10.'
        )
      }

      // Credit balance check (mirrors /api/v1/carousel/route.ts:73-76)
      const balance = await getCreditBalanceAdmin(supabase, userId)
      if (balance < 1) {
        return errorContent(
          'INSUFFICIENT_CREDITS',
          'You need at least 1 credit to create a carousel.',
          { creditsRemaining: balance }
        )
      }

      // Atomic deduct (mirrors /api/v1/carousel/route.ts:78-89)
      const deducted = await deductCreditAdmin(
        supabase,
        userId,
        'carousel_generation',
        `Carousel: ${topic}`,
        undefined,
        1
      )
      if (!deducted) {
        return errorContent(
          'INSUFFICIENT_CREDITS',
          'Credit deduction failed (race condition or insufficient balance).'
        )
      }

      try {
        const result = await generateCarousel(supabase, userId, {
          topic,
          templateId,
          slideCount: validSlideCount,
          imageSource: validImageSource,
        })
        return successContent({
          projectId: result.projectId,
          slideCount: result.slideCount,
          dashboardUrl: `${getAppUrl()}/project/${result.projectId}`,
        })
      } catch (err) {
        // Refund — mirrors /api/v1/carousel/route.ts:106-114
        await supabase.from('credit_transactions').insert({
          user_id: userId,
          type: 'refund',
          amount: 1,
          description: 'Carousel generation failed (MCP)',
        })
        return errorContent(
          'GENERATION_FAILED',
          err instanceof Error ? err.message : 'Unknown error'
        )
      }
    }
  )

  // ─── Tool 3: edit_slide (free) ─────────────────────────────────────────────
  server.registerTool(
    'edit_slide',
    {
      description: [
        'Edit a single slide in an existing carousel project. No credit cost.',
        'Provide projectId from create_carousel, the zero-based slideIndex, and a patch object containing the fields to change.',
        'Patch supports any of: hook_text, body_text, hook_segments, body_segments, image_query, background_url (must be https://),',
        'style_overrides (deep-merged with existing values), custom_texts, custom_images. All other keys are silently dropped.',
        'IMPORTANT: setting image_query updates the metadata field only — it does NOT auto-fetch a new image.',
        'To swap an image, set background_url directly to an https:// URL.',
        'After editing, call render_carousel to get fresh download URLs reflecting the changes.',
      ].join(' '),
      inputSchema: {
        projectId: z.string().uuid().describe('Project ID returned from create_carousel.'),
        slideIndex: z.number().int().min(0).describe('Zero-based slide index.'),
        patch: z
          .record(z.string(), z.unknown())
          .describe(
            'Object containing one or more of the 9 allowed fields (hook_text, body_text, hook_segments, body_segments, image_query, background_url, style_overrides, custom_texts, custom_images). Other keys are ignored.'
          ),
      },
    },
    async (args, extra) => {
      const userId = getUserId(extra)
      if (!userId) return errorContent('UNAUTHORIZED', 'Missing auth context')

      const { projectId, slideIndex, patch } = args as {
        projectId: string
        slideIndex: number
        patch: Record<string, unknown>
      }

      // Filter to whitelisted fields (mirrors PATCH route lines 73-78)
      const patchFields: Record<string, unknown> = {}
      for (const field of ALLOWED_PATCH_FIELDS) {
        if (field in patch) patchFields[field] = patch[field]
      }
      if (Object.keys(patchFields).length === 0) {
        return errorContent(
          'VALIDATION_ERROR',
          `At least one of ${ALLOWED_PATCH_FIELDS.join(', ')} must be provided.`
        )
      }

      // Validate background_url scheme (mirrors PATCH route lines 84-87, threat T-41-04)
      if (
        typeof patchFields.background_url === 'string' &&
        !patchFields.background_url.startsWith('https://')
      ) {
        return errorContent('VALIDATION_ERROR', 'background_url must use https://')
      }

      const supabase = createAdminClient()
      let project
      try {
        project = await getProject(supabase, userId, projectId)
      } catch {
        return errorContent('NOT_FOUND', 'Project not found')
      }

      const slideData = (project.slide_data as Record<string, unknown>[] | null) ?? []
      if (slideIndex >= slideData.length) {
        return errorContent('NOT_FOUND', 'Slide not found')
      }
      const existingSlide = slideData[slideIndex]

      // Deep-merge style_overrides (mirrors PATCH route lines 105-117)
      let mergedStyleOverrides = existingSlide.style_overrides
      if (patchFields.style_overrides && typeof patchFields.style_overrides === 'object') {
        mergedStyleOverrides = {
          ...(existingSlide.style_overrides as Record<string, unknown> | undefined),
          ...(patchFields.style_overrides as Record<string, unknown>),
        }
      }
      const updatedSlide = {
        ...existingSlide,
        ...patchFields,
        ...(patchFields.style_overrides ? { style_overrides: mergedStyleOverrides } : {}),
      }

      const updatedArray = [...slideData]
      updatedArray[slideIndex] = updatedSlide
      await updateProjectService(supabase, userId, projectId, { slide_data: updatedArray })
      return successContent({ slide: updatedSlide })
    }
  )

  // ─── Tool 4: render_carousel (free) ────────────────────────────────────────
  server.registerTool(
    'render_carousel',
    {
      description: [
        'Get fresh download URLs for every slide in a carousel project, plus a single ZIP URL containing all slides.',
        'Use this AFTER create_carousel or edit_slide. No credit cost.',
        'Returns { slides: [{ index, downloadUrl }], zipUrl } — URLs only, NEVER inline binary image data.',
        'Note: download URLs require an authenticated user session (browser cookie) when fetched, since /api/render checks Supabase auth.',
        'For programmatic download in agent contexts, prefer opening dashboardUrl from create_carousel and using the in-app download UI.',
      ].join(' '),
      inputSchema: {
        projectId: z.string().uuid().describe('Project ID returned from create_carousel.'),
      },
    },
    async (args, extra) => {
      const userId = getUserId(extra)
      if (!userId) return errorContent('UNAUTHORIZED', 'Missing auth context')

      const { projectId } = args as { projectId: string }
      const supabase = createAdminClient()
      let project
      try {
        project = await getProject(supabase, userId, projectId)
      } catch {
        return errorContent('NOT_FOUND', 'Project not found')
      }
      const slides = (project.slide_data as unknown[] | null) ?? []
      if (slides.length === 0) {
        return errorContent('NOT_FOUND', 'Project has no slides')
      }

      const baseUrl = getAppUrl()
      const slideUrls = slides.map((_, index) => ({
        index,
        downloadUrl: `${baseUrl}/api/render?projectId=${projectId}&slide=${index}&download`,
      }))
      return successContent({
        slides: slideUrls,
        zipUrl: `${baseUrl}/api/v1/projects/${projectId}/download`,
      })
    }
  )
}
