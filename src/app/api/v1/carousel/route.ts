import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { generateCarouselService } from '@/lib/services/carousel'
import { apiError } from '@/lib/api/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const carouselSchema = z.object({
  topic: z.string().min(1).max(500),
  templateId: z.string(),
  imageSource: z.enum(['stock', 'ai']).default('stock'),
  slideCount: z.coerce.number().int().min(3).max(20).default(7),
  advancedOptions: z
    .object({
      font: z.string().optional(),
      fontColor: z.string().optional(),
      imagePrompt: z.string().optional(),
    })
    .optional(),
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateApiKey(req)

    // 2. Rate limit
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)

    // 3. Validate request body
    const body = await req.json()
    const params = carouselSchema.parse(body)

    // 4. Auto-create project for one-shot API generation
    const adminClient = createAdminClient()
    const projectId = crypto.randomUUID()

    const { error: projectError } = await adminClient.from('projects').insert({
      id: projectId,
      user_id: auth.userId,
      title: `API: ${params.topic}`,
      topic: params.topic,
      template_id: params.templateId,
    })

    if (projectError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to create project' } },
        { status: 500, headers: CORS_HEADERS }
      )
    }

    // 5. Generate carousel via shared service
    const result = await generateCarouselService(
      auth.userId,
      {
        projectId,
        topic: params.topic,
        templateId: params.templateId,
        imageSource: params.imageSource,
        slideCount: params.slideCount,
        advancedOptions: params.advancedOptions,
      },
      { adminClient }
    )

    // 6. Return result with rate limit headers
    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
      headers: {
        ...CORS_HEADERS,
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
      },
    })
  } catch (err) {
    const response = apiError(err)
    // Add CORS headers to error responses
    CORS_HEADERS && Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    return response
  }
}
