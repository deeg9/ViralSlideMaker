import { GoogleGenAI, Type, type Schema } from '@google/genai'
import { CarouselSchema, type Carousel } from './schemas'
import { buildSystemPrompt } from './prompts'
import { validateAndRepair, isPremiumTemplate } from './validate-slides'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const segmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: 'A single run of text (typically one word)' },
    accent: { type: Type.BOOLEAN, description: 'Highlight this run with the template accent color' },
    // Phase 47 (TPLAI-03): optional pill highlight on premium templates.
    // Both fields are optional — `required` stays at ['text', 'accent'] for
    // backward compat with pre-Phase-47 responses.
    highlightColor: {
      type: Type.STRING,
      description:
        "Optional accent pill background hex — premium templates only (e.g. '#A8E0B0' for magazine-bold/tr3nding-news). Leave unset for documentary or legacy templates.",
    },
    highlightStyle: {
      type: Type.STRING,
      enum: ['pill'],
      description:
        "Optional pill style for highlightColor segments. Currently only 'pill' is supported.",
    },
  },
  required: ['text', 'accent'],
}

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Carousel title/topic' },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hook_text: { type: Type.STRING, description: 'Attention-grabbing hook for this slide' },
          hook_segments: {
            type: Type.ARRAY,
            description: 'Optional: per-word color spans for two-color news headlines',
            items: segmentSchema,
          },
          body_text: { type: Type.STRING, description: 'Supporting body copy' },
          body_segments: {
            type: Type.ARRAY,
            description: 'Optional: per-word color spans for body copy',
            items: segmentSchema,
          },
          image_query: { type: Type.STRING, description: 'Pexels search query for background image' },
          layout: {
            type: Type.STRING,
            description: "News-carousel layout: 'cover' (image top, text bar bottom) or 'body' (text top, image bottom)",
            enum: ['cover', 'body'],
          },
          is_cta: { type: Type.BOOLEAN, description: 'Whether this is the closing CTA slide' },
        },
        required: ['hook_text', 'body_text', 'image_query', 'is_cta'],
      },
    },
  },
  required: ['title', 'slides'],
}

export async function generateSlideContent(
  topic: string,
  slideCount: number = 7,
  imageStyleHint?: string,
  templateId?: string,
): Promise<Carousel> {
  const imageHintText = imageStyleHint
    ? `\n\nWhen generating image_query values, incorporate this visual preference: "${imageStyleHint}"`
    : ''
  const baseContents = `Create a TikTok carousel about: ${topic}\n\nGenerate exactly ${slideCount} slides (including the opening hook and closing CTA).${imageHintText}`
  const systemInstruction = buildSystemPrompt(templateId)

  async function callGemini(contents: string): Promise<unknown> {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
      },
    })
    return JSON.parse(response.text!)
  }

  // First call.
  let parsed = (await callGemini(baseContents)) as { slides: unknown[] }
  let { data, warnings } = validateAndRepair(parsed as never, { templateId })

  // Retry-once gate: only when warnings exist AND the template is premium
  // (legacy templates are out of length/orphan-cap scope per D-01) OR there
  // are typo warnings (typo gate applies to ALL templates per D-02).
  const hasTypoWarning = warnings.some((w) => w.includes('contains typo'))
  const hasPremiumWarning = isPremiumTemplate(templateId) && warnings.length > 0

  if (hasPremiumWarning || hasTypoWarning) {
    const diagnostic = warnings.map((w) => `- ${w}`).join('\n')
    const retryContents = `${baseContents}\n\nThe previous response had issues that must be fixed:\n${diagnostic}\n\nGenerate again, ensuring all length caps, no orphans, and correct spelling.`
    parsed = (await callGemini(retryContents)) as { slides: unknown[] }
    const retried = validateAndRepair(parsed as never, { templateId })
    data = retried.data
    warnings = retried.warnings
    if (warnings.length > 0) {
      console.warn(
        `[generate-slides] retry still produced ${warnings.length} warning(s) for templateId=${templateId ?? '<none>'}; persisting anyway:`,
        warnings,
      )
    }
  }

  // Emit a trace for warnings that were not acted upon (no retry fired).
  // Covers legacy templates with orphan/length warnings that are out of
  // retry scope — gives production debugging a visible signal.
  if (warnings.length > 0 && !hasPremiumWarning && !hasTypoWarning) {
    console.warn(
      `[generate-slides] ${warnings.length} validation warning(s) (no retry) for templateId=${templateId ?? '<none>'}:`,
      warnings,
    )
  }

  // Validate final shape with Zod (schema gate — separate from validateAndRepair).
  return CarouselSchema.parse(data)
}
