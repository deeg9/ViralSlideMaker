import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError } from '@/lib/api/errors'
import { buildResponseHeaders, corsOptions } from '@/lib/api/headers'
import { updateSlide, getSlide } from '@/lib/services/editor'
import { createAdminClient } from '@/lib/supabase/admin'

const styleOverridesSchema = z
  .object({
    hook_font_size: z.number().optional(),
    body_font_size: z.number().optional(),
    text_color: z.string().optional(),
    hook_text_color: z.string().optional(),
    body_text_color: z.string().optional(),
    text_position: z.enum(['top', 'center', 'bottom']).optional(),
    text_align: z.enum(['left', 'center', 'right']).optional(),
    hook_font_weight: z.number().optional(),
    body_font_weight: z.number().optional(),
    hook_font_style: z.enum(['normal', 'italic']).optional(),
    body_font_style: z.enum(['normal', 'italic']).optional(),
    hook_font_family: z.string().optional(),
    body_font_family: z.string().optional(),
    overlay_opacity: z.number().min(0).max(100).optional(),
  })
  .optional()

const patchSchema = z
  .object({
    hook_text: z.string().optional(),
    body_text: z.string().optional(),
    image_query: z.string().optional(),
    background_url: z
      .string()
      .url()
      .refine((url) => url.startsWith('https://'), {
        message: 'background_url must use https://',
      })
      .optional(),
    style_overrides: styleOverridesSchema,
  })
  .refine(
    (data) =>
      data.hook_text !== undefined ||
      data.body_text !== undefined ||
      data.image_query !== undefined ||
      data.background_url !== undefined ||
      data.style_overrides !== undefined,
    { message: 'At least one field must be provided' }
  )

export async function OPTIONS() {
  return corsOptions()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)
    const { id, index } = await params

    const slideIndex = parseInt(index, 10)
    if (isNaN(slideIndex) || slideIndex < 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid slide index' } },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    const slide = await getSlide(auth.userId, id, slideIndex, { adminClient })
    const headers = await buildResponseHeaders(auth.userId, 0, { limit, remaining })

    return NextResponse.json({ data: slide }, { headers })
  } catch (err) {
    return apiError(err)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)
    const { id, index } = await params

    const slideIndex = parseInt(index, 10)
    if (isNaN(slideIndex) || slideIndex < 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid slide index' } },
        { status: 400 }
      )
    }

    const body = await req.json()
    const updates = patchSchema.parse(body)

    const adminClient = createAdminClient()
    const updatedSlide = await updateSlide(auth.userId, id, slideIndex, updates, {
      adminClient,
    })
    const headers = await buildResponseHeaders(auth.userId, 0, { limit, remaining })

    return NextResponse.json({ data: updatedSlide }, { headers })
  } catch (err) {
    return apiError(err)
  }
}
