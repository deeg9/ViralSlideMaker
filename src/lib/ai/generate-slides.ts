import { GoogleGenAI, Type, type Schema } from '@google/genai'
import { CarouselSchema, type Carousel, type SlideContent } from './schemas'
import { buildSystemPrompt } from './prompts'
import { validateAndRepair, isPremiumTemplate } from './validate-slides'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide, TextBox } from '@/lib/types/slide'

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
          // Phase 58 (AIROLE-01, D-01, D-02): closed 5-value enum. Required on AI
          // emit side; validator (validate-slides.ts) backfills missing values
          // via assignSlideRoles so post-validation code can rely on `role` being
          // set. Never-throws contract preserved.
          role: {
            type: Type.STRING,
            enum: ['cover', 'reframe', 'support', 'pivot', 'close'],
            description:
              'Slide role: cover (slide 1), reframe, support, pivot, or close (last slide)',
          },
          // Phase 58 (AIROLE-03, D-03): closed enum from registry. Optional —
          // null/undefined = use project template. Invalid IDs (not in TEMPLATE_IDS)
          // silently stripped server-side by validateAndRepair (D-06, D-08).
          template_id_override: {
            type: Type.STRING,
            description:
              'Optional per-slide template_id override for visual rhythm. Leave unset to use the project template. Closed enum — invalid IDs silently stripped server-side.',
          },
        },
        required: ['hook_text', 'body_text', 'image_query', 'is_cta', 'role'],
      },
    },
  },
  required: ['title', 'slides'],
}

/**
 * Phase 51: Carousel returned to callers includes `text_boxes[]` populated server-side
 * via `legacyToTextBoxes` so the AI-ingest boundary produces the same observable shape
 * as the eager-migration path on slide load (Phase 49). AIGEN-01 (rewriting Gemini's
 * JSON schema to natively emit `text_boxes`) is deferred to v2.9 — this light-touch
 * adapter delivers identical state with zero regression risk to v2.7's audit-passed
 * premium tier.
 */
export type SlideContentWithTextBoxes = SlideContent & { text_boxes: TextBox[] }
export type CarouselWithTextBoxes = Omit<Carousel, 'slides'> & {
  slides: SlideContentWithTextBoxes[]
}

export async function generateSlideContent(
  topic: string,
  slideCount: number = 7,
  imageStyleHint?: string,
  templateId?: string,
): Promise<CarouselWithTextBoxes> {
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
    if (!response.text) {
      throw new Error(
        `[generate-slides] Gemini returned empty response.text (templateId=${templateId ?? '<none>'})`,
      )
    }
    return JSON.parse(response.text)
  }

  // First call.
  let parsed = (await callGemini(baseContents)) as { slides: unknown[] }

  // Phase 58 (AIROLE-01): trace emitted roles for production debugging.
  const emittedRoles = (parsed.slides as Array<{ role?: string }>).map(
    (s) => s.role ?? '<missing>',
  )
  console.info(
    `[generate-slides] roles emitted (templateId=${templateId ?? '<none>'}):`,
    emittedRoles,
  )

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
  const parsedCarousel = CarouselSchema.parse(data)

  // Phase 51: populate `text_boxes[]` server-side at the AI-ingest boundary so every
  // path that hits Supabase carries the unified shape. `legacyToTextBoxes` only reads
  // hook_text/body_text/hook_segments/body_segments/style_overrides/custom_texts —
  // all of which are present (or safely undefined) on `SlideContent`. We cast to the
  // structural minimum the adapter requires; the adapter is defensive on missing fields.
  const slidesWithTextBoxes: SlideContentWithTextBoxes[] = parsedCarousel.slides.map(
    (slide) => ({
      ...slide,
      text_boxes: legacyToTextBoxes(slide as unknown as Slide),
    }),
  )

  return { ...parsedCarousel, slides: slidesWithTextBoxes }
}
