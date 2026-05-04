import { GoogleGenAI, Type, type Schema } from '@google/genai'
import {
  CarouselSchema,
  DecorationSchema,
  DecorationEmitSchema,
  AI_LUCIDE_ALLOWLIST,
  AI_COLOR_TOKENS,
  AI_POSITION_ANCHORS,
  AI_SHAPE_KINDS,
  parseDecorationsArraySafe,
  type Carousel,
  type SlideContent,
  type DecorationContent,
} from './schemas'

// Phase 67 (DECOR-05): re-export the Decoration validator at the AI-ingest
// boundary so Phase 71 (AI-01..05) can wire Gemini emit + post-parse silent
// drop without modifying this file's import surface. Plan 67-01 only
// registers the schema — there is no consumer yet.
export { DecorationSchema, parseDecorationsArraySafe }
export type { DecorationContent }
import { buildSystemPrompt } from './prompts'
import { validateAndRepair, isPremiumTemplate } from './validate-slides'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import { resolveAIDecoration } from './resolve-ai-decoration'
import { getTemplate } from '@/lib/render/templates'
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
          // Phase 71 (AI-01, AI-02): Optional 0–2 decorations per slide.
          // CLOSED-ENUM AI EMIT — AI emits NAMED COLOR TOKENS (never raw hex)
          // and SEMANTIC POSITION ANCHORS (never raw % coords). Server-side
          // resolveAIDecoration maps tokens → hex + anchors → safe-zone
          // % coords. Triple-layer silent-drop on per-entry validation
          // failure: DecorationEmitSchema → resolveAIDecoration → final
          // DecorationSchema gate. maxItems=2 is the SOFT cap (Gemini-side);
          // post-parse `resolved.length < 2` while-bound is the HARD cap.
          decorations: {
            type: Type.ARRAY,
            description:
              'Optional 0..2 decorations per slide. Closed-enum lucideName + named color tokens + semantic position anchors. Server-side resolved to explicit hex + safe-zone % coords.',
            // @google/genai types maxItems as string (gRPC int64 wire format).
            maxItems: '2',
            items: {
              type: Type.OBJECT,
              properties: {
                kind: { type: Type.STRING, enum: ['icon', 'shape'] },
                lucideName: {
                  type: Type.STRING,
                  enum: [...AI_LUCIDE_ALLOWLIST],
                  description: "Required when kind='icon'. PascalCase Lucide name from the closed allowlist.",
                },
                shapeKind: {
                  type: Type.STRING,
                  enum: [...AI_SHAPE_KINDS],
                  description: "Required when kind='shape'.",
                },
                color: {
                  type: Type.STRING,
                  enum: [...AI_COLOR_TOKENS],
                  description:
                    "Named color token. 'accent'=template accent, 'palette-vibrant'=photo palette[0], 'palette-dark-muted'=palette[4], 'palette-light'=palette[5], 'on-light'/'on-dark'=fixed contrast pair.",
                },
                position: {
                  type: Type.STRING,
                  enum: [...AI_POSITION_ANCHORS],
                  description:
                    "Semantic anchor. Resolved to safe-zone % coords that don't occlude central hook+body band.",
                },
                rotation: { type: Type.NUMBER, description: 'Optional rotation -180..180.' },
                cornerRadius: { type: Type.NUMBER, description: "Optional rect rounded corner radius (shape only)." },
                points: { type: Type.NUMBER, description: 'Optional polygon point count (shape only).' },
              },
              required: ['kind', 'color', 'position'],
            },
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
// Phase 71 (AI-01..04): the public output replaces the loose
// `decorations?: unknown[]` from SlideContentSchema with the canonical
// resolved Decoration[] (DecorationContent — full DecorationSchema-validated
// hex + rect + id). Slides that emitted 0 valid decorations have
// `decorations === undefined` (Phase 67 PTF16 idempotent-absence baseline).
export type SlideContentWithTextBoxes = Omit<SlideContent, 'decorations'> & {
  text_boxes: TextBox[]
  decorations?: DecorationContent[]
}
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

  // Phase 71 (AI-01..04): server-side decorations ingest. AI emits named
  // tokens + semantic anchors via DecorationEmitSchema; we resolve to
  // explicit hex + safe-zone % coords; silent-drop on any per-entry
  // validation failure. Triple-layer silent-drop pipeline:
  //   1. DecorationEmitSchema.safeParse — closed-enum gate (lucideName,
  //      color token, position anchor, shapeKind, kind discriminator)
  //   2. resolveAIDecoration wrapped in try/catch — defense in depth
  //   3. DecorationSchema.safeParse — final canonical-shape gate
  //   4. resolved.length < 2 while-bound — hard maxItems=2 clamp
  //      (Gemini schema's responseSchema.items.maxItems = 2 is the soft cap)
  // Mirror v2.9 D-08 template_id_override defaulting pattern. Slides
  // emitting 0 valid decorations preserve `decorations === undefined`
  // (Phase 67 PTF16 idempotent-absence baseline).
  const slidesWithDecorations = parsedCarousel.slides.map((slide, slideIndex) => {
    const rawEmitted = (slide as { decorations?: unknown }).decorations
    // Drop the raw passthrough field unconditionally — only canonical resolved
    // DecorationContent[] survive past the ingest boundary. When no valid
    // entries resolve, the field is omitted entirely (preserves Phase 67
    // PTF16 idempotent-absence baseline: `decorations === undefined`).
    const { decorations: _rawDrop, ...slideWithoutRaw } =
      slide as SlideContent & { decorations?: unknown }
    void _rawDrop

    if (!Array.isArray(rawEmitted) || rawEmitted.length === 0) {
      return slideWithoutRaw
    }

    const slideTemplateId = (slide as { template_id_override?: string }).template_id_override ?? templateId
    const template = slideTemplateId ? getTemplate(slideTemplateId) : getTemplate('highlight-bar')

    const resolved: DecorationContent[] = []
    for (let i = 0; i < rawEmitted.length && resolved.length < 2; i++) {
      const emitParse = DecorationEmitSchema.safeParse(rawEmitted[i])
      if (!emitParse.success) continue
      try {
        const fullDeco = resolveAIDecoration(
          emitParse.data,
          slide as unknown as Slide,
          template,
          slideIndex,
          i,
        )
        const finalParse = DecorationSchema.safeParse(fullDeco)
        if (finalParse.success) resolved.push(finalParse.data)
        // else: silent drop — defense in depth for any divergence between
        // DecorationEmitSchema and the canonical DecorationSchema.
      } catch {
        // Never throw at AI ingest — silent drop (AI-04 contract).
      }
    }
    if (resolved.length === 0) return slideWithoutRaw
    return { ...slideWithoutRaw, decorations: resolved }
  })

  // Phase 51: populate `text_boxes[]` server-side at the AI-ingest boundary so every
  // path that hits Supabase carries the unified shape. `legacyToTextBoxes` only reads
  // hook_text/body_text/hook_segments/body_segments/style_overrides/custom_texts —
  // all of which are present (or safely undefined) on `SlideContent`. We cast to the
  // structural minimum the adapter requires; the adapter is defensive on missing fields.
  const slidesWithTextBoxes: SlideContentWithTextBoxes[] = slidesWithDecorations.map(
    (slide) => ({
      ...slide,
      text_boxes: legacyToTextBoxes(slide as unknown as Slide),
    }),
  )

  return { ...parsedCarousel, slides: slidesWithTextBoxes }
}
