import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { templates } from '@/lib/render/templates'

export const GET = withApiAuth(async (_req, _ctx) => {
  const data = templates.map(({ id, name, thumbnail, textPosition, textAlign }) => ({
    id,
    name,
    thumbnail,
    textPosition,
    textAlign,
  }))

  return apiSuccess({ data })
})
