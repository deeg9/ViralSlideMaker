import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { deductCreditAdmin, getUserTier } from '@/lib/credits/check-credits'
import { generateCarousel } from '@/lib/services/carousel'

export const maxDuration = 60

export const POST = withApiAuth(async (req, ctx) => {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const { topic, templateId, imageSource, slideCount, advancedOptions } = body as {
    topic?: unknown
    templateId?: unknown
    imageSource?: unknown
    slideCount?: unknown
    advancedOptions?: unknown
  }

  // Validate required fields
  if (typeof topic !== 'string' || topic.length === 0 || topic.length > 500) {
    return apiError('VALIDATION_ERROR', 'topic must be a string between 1 and 500 characters', 400)
  }
  if (typeof templateId !== 'string' || templateId.length === 0) {
    return apiError('VALIDATION_ERROR', 'templateId is required and must be a non-empty string', 400)
  }

  // Validate optional fields
  const validImageSource = imageSource === undefined ? 'stock' : imageSource
  if (validImageSource !== 'stock' && validImageSource !== 'ai') {
    return apiError('VALIDATION_ERROR', 'imageSource must be "stock" or "ai"', 400)
  }

  const validSlideCount = slideCount === undefined ? 7 : Number(slideCount)
  if (isNaN(validSlideCount) || !Number.isInteger(validSlideCount) || validSlideCount < 3 || validSlideCount > 20) {
    return apiError('VALIDATION_ERROR', 'slideCount must be an integer between 3 and 20', 400)
  }

  if (advancedOptions !== undefined && (typeof advancedOptions !== 'object' || advancedOptions === null)) {
    return apiError('VALIDATION_ERROR', 'advancedOptions must be an object', 400)
  }

  // Free-tier slide-count cap
  const tier = await getUserTier(ctx.userId)
  if (tier === 'free' && validSlideCount > 3) {
    return apiError(
      'VALIDATION_ERROR',
      'Free plan is limited to 3 slides per carousel. Upgrade to plus or pro for up to 20.',
      400
    )
  }

  // Check credit balance
  if (ctx.creditBalance < 1) {
    return apiError('INSUFFICIENT_CREDITS', 'Insufficient credits', 402)
  }

  // Deduct 1 credit
  const deducted = await deductCreditAdmin(
    ctx.supabase,
    ctx.userId,
    'carousel_generation',
    `Carousel: ${topic}`,
    undefined,
    1
  )
  if (!deducted) {
    return apiError('INSUFFICIENT_CREDITS', 'Insufficient credits', 402)
  }

  try {
    const result = await generateCarousel(ctx.supabase, ctx.userId, {
      topic,
      templateId,
      slideCount: validSlideCount,
      imageSource: validImageSource as 'stock' | 'ai',
      advancedOptions: advancedOptions as { font?: string; fontColor?: string; imagePrompt?: string } | undefined,
    })

    return apiSuccess(
      { success: true, projectId: result.projectId, slideCount: result.slideCount },
      200,
      1
    )
  } catch {
    return apiError('INTERNAL_ERROR', 'Carousel generation failed', 500)
  }
})
