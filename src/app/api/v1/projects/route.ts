import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError } from '@/lib/api/errors'
import { buildResponseHeaders, corsOptions } from '@/lib/api/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { listProjects, createProjectService } from '@/lib/services/project'
import { z } from 'zod'

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  topic: z.string().max(500).optional(),
  templateId: z.string().optional(),
})

export async function OPTIONS() {
  return corsOptions()
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    const rateLimit = await checkRateLimit(auth.keyId, auth.tier)
    const adminClient = createAdminClient()

    const projects = await listProjects(auth.userId, { adminClient })
    const headers = await buildResponseHeaders(auth.userId, 0, rateLimit)

    return NextResponse.json({ data: projects }, { headers })
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    const rateLimit = await checkRateLimit(auth.keyId, auth.tier)
    const adminClient = createAdminClient()

    const body = await req.json()
    const params = createProjectSchema.parse(body)

    const { id } = await createProjectService(auth.userId, params, { adminClient })
    const headers = await buildResponseHeaders(auth.userId, 0, rateLimit)

    return NextResponse.json({ data: { id } }, { status: 201, headers })
  } catch (err) {
    return apiError(err)
  }
}
