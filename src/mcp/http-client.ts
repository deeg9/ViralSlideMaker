/**
 * HTTP client for the ViralSlideMaker REST API.
 * Used by the stdio MCP server to call the deployed app.
 *
 * Requires env vars:
 *   VIRALSLIDEMAKER_API_KEY - API key for authentication (vsl_ prefixed)
 *   VIRALSLIDEMAKER_BASE_URL - Base URL of the deployed app (e.g. https://viralslidemaker.com)
 *
 * SECURITY: API key is only sent in Authorization headers, never logged or included in responses.
 */

function getConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.VIRALSLIDEMAKER_API_KEY
  if (!apiKey) {
    throw new Error(
      'VIRALSLIDEMAKER_API_KEY environment variable is required. ' +
        'Get your API key from the ViralSlideMaker dashboard.'
    )
  }

  const baseUrl = (process.env.VIRALSLIDEMAKER_BASE_URL || 'https://viralslidemaker.com').replace(
    /\/$/,
    ''
  )

  return { apiKey, baseUrl }
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const { apiKey, baseUrl } = getConfig()
  const url = `${baseUrl}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    // Mask any potential API key leak in error messages
    const safeError = errorBody.replace(/vsl_[a-zA-Z0-9]+/g, 'vsl_***')
    throw new Error(`API request failed (${response.status}): ${safeError}`)
  }

  return response.json() as Promise<T>
}

// --- API Types ---

export interface CreateCarouselParams {
  topic: string
  templateId?: string
  slideCount?: number
  imageSource?: 'stock' | 'ai'
}

export interface CreateCarouselResult {
  success: boolean
  projectId?: string
  slideCount?: number
  error?: string
}

export interface EditSlideParams {
  projectId: string
  slideIndex: number
  hookText?: string
  bodyText?: string
  imageQuery?: string
  backgroundUrl?: string
}

export interface TemplateInfo {
  id: string
  name: string
  thumbnail?: string
  textPosition: string
  textAlign: string
}

export interface RenderResult {
  slides: Array<{ index: number; download_url: string }>
  zip_url: string
}

// --- API Functions ---

export async function createCarousel(params: CreateCarouselParams): Promise<CreateCarouselResult> {
  const body: Record<string, unknown> = {
    topic: params.topic,
    templateId: params.templateId ?? 'bold-minimal',
    imageSource: params.imageSource ?? 'stock',
    slideCount: params.slideCount ?? 7,
  }

  return apiRequest<CreateCarouselResult>('POST', '/api/v1/carousel', body)
}

export async function listTemplates(): Promise<TemplateInfo[]> {
  const result = await apiRequest<{ data: TemplateInfo[] }>('GET', '/api/v1/templates')
  return result.data
}

export async function editSlide(params: EditSlideParams): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {}
  if (params.hookText !== undefined) body.hook_text = params.hookText
  if (params.bodyText !== undefined) body.body_text = params.bodyText
  if (params.imageQuery !== undefined) body.image_query = params.imageQuery
  if (params.backgroundUrl !== undefined) body.background_url = params.backgroundUrl

  const result = await apiRequest<{ data: Record<string, unknown> }>(
    'PATCH',
    `/api/v1/projects/${params.projectId}/slides/${params.slideIndex}`,
    body
  )
  return result.data
}

export async function renderCarousel(
  projectId: string
): Promise<RenderResult> {
  const result = await apiRequest<{ data: RenderResult }>(
    'POST',
    `/api/v1/projects/${projectId}/render`
  )
  return result.data
}
