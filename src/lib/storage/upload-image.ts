import { randomUUID } from 'node:crypto'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { UploadMimeType } from '@/lib/upload-validation'

/**
 * Server-side image upload service shared by the REST endpoint
 * (POST /api/v1/images) and the MCP tool (upload_image).
 *
 * Takes a pre-validated buffer (the caller MUST run validateImageBuffer
 * first) and writes it to the slide-backgrounds Supabase Storage bucket
 * at a per-user, per-month path. Returns the public URL plus metadata
 * so the agent has dimensions/size for downstream decisions.
 */

const BUCKET = 'slide-backgrounds'

const EXT_BY_MIME: Record<UploadMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

export type UploadImageResult = {
  url: string
  mimeType: UploadMimeType
  sizeBytes: number
  width: number
  height: number
}

export type UploadImageInput = {
  buffer: Buffer
  mimeType: UploadMimeType
  width: number
  height: number
  userId: string
  supabase: SupabaseAdminClient
}

export async function uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
  const { buffer, mimeType, width, height, userId, supabase } = input

  const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM (UTC)
  const ext = EXT_BY_MIME[mimeType]
  const path = `${userId}/uploads/${monthKey}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
  })
  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return {
    url: data.publicUrl,
    mimeType,
    sizeBytes: buffer.length,
    width,
    height,
  }
}
