import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'

const ALLOWED_FIELDS = [
  'name',
  'primary_color',
  'secondary_color',
  'text_color',
  'background_color',
  'font_family',
  'logo_url',
  'logo_position',
  'logo_size_pct',
  'logo_opacity_pct',
  'heading_font_family',
  'body_font_family',
  'accent_color',
  'text_align',
  'text_position',
  'hook_style',
  'overlay_opacity_pct',
] as const

const ALLOWED_LOGO_POSITIONS = new Set([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
])
const ALLOWED_TEXT_ALIGN = new Set(['left', 'center', 'right'])
const ALLOWED_TEXT_POSITION = new Set(['top', 'center', 'bottom'])
const ALLOWED_HOOK_STYLE = new Set(['uppercase', 'normal', 'italic'])

export const GET = withApiAuth(async (_req, ctx) => {
  const { data: brandKit } = await ctx.supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle()
  return apiSuccess({ data: brandKit ?? null })
})

export const PUT = withApiAuth(async (req, ctx) => {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const update: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field]
  }

  // Lightweight validation on enum + range fields
  if (update.logo_position !== undefined && update.logo_position !== null
    && !ALLOWED_LOGO_POSITIONS.has(String(update.logo_position))) {
    return apiError('VALIDATION_ERROR', 'logo_position must be one of the 9 keypad positions', 400)
  }
  if (update.text_align !== undefined && update.text_align !== null
    && !ALLOWED_TEXT_ALIGN.has(String(update.text_align))) {
    return apiError('VALIDATION_ERROR', 'text_align must be left | center | right', 400)
  }
  if (update.text_position !== undefined && update.text_position !== null
    && !ALLOWED_TEXT_POSITION.has(String(update.text_position))) {
    return apiError('VALIDATION_ERROR', 'text_position must be top | center | bottom', 400)
  }
  if (update.hook_style !== undefined && update.hook_style !== null
    && !ALLOWED_HOOK_STYLE.has(String(update.hook_style))) {
    return apiError('VALIDATION_ERROR', 'hook_style must be uppercase | normal | italic', 400)
  }
  for (const pctField of ['logo_size_pct', 'logo_opacity_pct', 'overlay_opacity_pct'] as const) {
    if (update[pctField] !== undefined && update[pctField] !== null) {
      const n = Number(update[pctField])
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return apiError('VALIDATION_ERROR', `${pctField} must be a number between 0 and 100`, 400)
      }
    }
  }

  // Upsert: brand_kits has a unique user_id constraint
  const { data: upserted, error } = await ctx.supabase
    .from('brand_kits')
    .upsert({ user_id: ctx.userId, name: 'My Brand Kit', ...update }, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) return apiError('INTERNAL_ERROR', error.message, 500)

  return apiSuccess({ data: upserted })
})
