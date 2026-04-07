import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError, ApiError } from '@/lib/api/errors'
import { buildResponseHeaders, corsOptions } from '@/lib/api/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProject, deleteProjectService } from '@/lib/services/project'

export async function OPTIONS() {
  return corsOptions()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    const rateLimit = await checkRateLimit(auth.keyId, auth.tier)
    const adminClient = createAdminClient()
    const { id } = await params

    const project = await getProject(auth.userId, id, { adminClient })
    if (!project) {
      throw new ApiError('NOT_FOUND', 'Project not found')
    }

    const headers = await buildResponseHeaders(auth.userId, 0, rateLimit)
    return NextResponse.json({ data: project }, { headers })
  } catch (err) {
    return apiError(err)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    const rateLimit = await checkRateLimit(auth.keyId, auth.tier)
    const adminClient = createAdminClient()
    const { id } = await params

    await deleteProjectService(auth.userId, id, { adminClient })

    const headers = await buildResponseHeaders(auth.userId, 0, rateLimit)
    return NextResponse.json({ data: { deleted: true } }, { headers })
  } catch (err) {
    return apiError(err)
  }
}
