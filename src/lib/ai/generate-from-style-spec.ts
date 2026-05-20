// Phase 77 Plan 02 Task 3 (EMIT-01..04, EMIT-05, EMIT-08, EMIT-09):
// generateFromStyleSpec — text-only Gemini emit endpoint that consumes a
// validated StyleSpec and Plan 01 helpers (projectStyleSpecToSlideOverrides,
// narrowDecorationAllowlist) to produce a CarouselWithTextBoxes.
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
//   - SIBLING to generateSlideContent — does NOT touch the legacy emit
//     path (regression-guarded by Test 9 in generate-from-style-spec.test.ts).
//   - Closed-enum responseSchema NARROWED per spec.decorations.preferredLucide
//     and preferredShapes — when the spec specifies preferences, Gemini can
//     ONLY emit those subset names (closed-enum at the wire boundary).
//   - PROJECTOR FUSION: per-slide style_overrides MERGED with the projector's
//     output. Spec values WIN over Gemini values for the projected fields
//     (the spec is the design template).
//   - Triple-layer silent-drop pipeline at the emit boundary:
//       (a) CarouselSchema.safeParse on Gemini response; ONE retry on failure
//           with a diagnostic; THROW typed error on second failure.
//       (b) DecorationEmitSchema → resolveAIDecoration → DecorationSchema
//           per-decoration silent-drop (mirror generate-slides.ts pattern).
//       (c) silent-drop counter increments per dropped FIELD with key
//           'emit.{field}' for telemetry (EMIT-08).
//   - EMIT-05: spec.voice_note REPLACES template.aiVoiceNote — handled by
//     buildFromSpecPrompt; verified at emit boundary by Test 8.
//   - text_boxes populated server-side via legacyToTextBoxes (mirror
//     generate-slides.ts:240 pattern).
// =====================================================================
//
// FIREWALL: this file does NOT import from generate-slides.ts. Clean
// separation per CONTEXT.md decisions §New endpoint pair.
//
// EMIT-10 single-pushHistory satisfied by construction: this function returns
// a CarouselWithTextBoxes; the orchestrator (generateCarouselFromReferences)
// persists slides to projects.slide_data; the editor mounts via
// /project/{id} → SlideEditor → useSlideEditor(initialSlides). Initial state
// has past=[], present=slides; one Cmd+Z restores empty initial state.
// Same routing as today's emit flow (NO new editor wiring needed).

import { GoogleGenAI, Type, type Schema } from '@google/genai'
import {
  CarouselSchema,
  DecorationSchema,
  DecorationEmitSchema,
  AI_LUCIDE_ALLOWLIST,
  AI_COLOR_TOKENS,
  AI_POSITION_ANCHORS,
  AI_SHAPE_KINDS,
  type Carousel,
  type SlideContent,
  type DecorationContent,
} from './schemas'
import { buildFromSpecPrompt } from './prompts'
import { GEMINI_TEXT_MODEL } from '@/lib/ai/gemini-model'
import { legacyToTextBoxes, textBoxesToLegacy } from '@/lib/editor/text-box-adapter'
import { separateOverlappingTextBoxes } from '@/lib/editor/separate-overlapping-text-boxes'
import { resolveAIDecoration } from './resolve-ai-decoration'
import { getTemplate } from '@/lib/render/templates'
import { templates } from '@/lib/render/templates'
import {
  projectStyleSpecToSlideOverrides,
  narrowDecorationAllowlist,
} from './style-spec-projector'
import { createSilentDropCounter, type SilentDropCounter } from '@/lib/validators/silent-drop-counter'
import type { Slide, TextBox } from '@/lib/types/slide'
import type { StyleSpec } from '@/lib/types/style-spec'
import type {
  ContentSource,
  GenerateFromStyleSpecOptions,
} from './generate-from-style-spec.types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// Re-export the types for callers (orchestrator + tests).
export type { ContentSource, GenerateFromStyleSpecOptions } from './generate-from-style-spec.types'

// Mirror generate-slides.ts result shape for orchestrator-level uniformity.
export type SlideContentWithTextBoxes = Omit<SlideContent, 'decorations'> & {
  text_boxes: TextBox[]
  decorations?: DecorationContent[]
}
export type CarouselWithTextBoxes = Omit<Carousel, 'slides'> & {
  slides: SlideContentWithTextBoxes[]
}

const segmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: 'A single run of text (typically one word)' },
    accent: { type: Type.BOOLEAN, description: 'Highlight this run with the template accent color' },
    highlightColor: {
      type: Type.STRING,
      description: 'Optional accent pill background hex (premium templates only)',
    },
    highlightStyle: {
      type: Type.STRING,
      enum: ['pill'],
      description: "Optional pill style for highlightColor segments (only 'pill').",
    },
  },
  required: ['text', 'accent'],
}

/**
 * Build the Gemini responseSchema with NARROWED decoration enums per spec.
 * When spec.decorations.preferredLucide is non-empty, lucideName.enum is
 * REPLACED by that subset. Same for shapeKind.enum vs preferredShapes.
 *
 * Phase 80 CR-01: when the projected narrowed list is empty (post-R7 the
 * projector returns [] for empty/undefined preferred*), the responseSchema
 * MUST fall back to the FULL corpora (AI_LUCIDE_ALLOWLIST / AI_SHAPE_KINDS).
 * Passing `enum: []` to Gemini violates the JSON Schema spec — Gemini
 * rejects empty-enum schemas with 400 INVALID_ARGUMENT. The schema layer
 * is a Gemini-API protocol concern; zero-icon enforcement happens
 * downstream via the system prompt + projector's empty decorations list
 * (the AI is instructed to emit no decorations when none are preferred,
 * and any icons it does emit are dropped at the decoration ingest stage
 * because narrowDecorationAllowlist returned []).
 */
function buildNarrowedResponseSchema(spec: StyleSpec): Schema {
  const narrowed = narrowDecorationAllowlist(spec)
  // Phase 80 CR-01: fall back to full corpora when narrowed is empty.
  // Passing enum:[] to Gemini is invalid (JSON Schema spec). The
  // projector's empty narrowed list governs runtime emission via the
  // decoration ingest layer + system prompt — not the Gemini schema.
  const lucideEnum =
    narrowed.lucide.length > 0 ? [...narrowed.lucide] : [...AI_LUCIDE_ALLOWLIST]
  const shapeEnum =
    narrowed.shapes.length > 0 ? [...narrowed.shapes] : [...AI_SHAPE_KINDS]

  return {
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
              description: 'Optional per-word color spans for two-color news headlines',
              items: segmentSchema,
            },
            body_text: { type: Type.STRING, description: 'Supporting body copy' },
            body_segments: {
              type: Type.ARRAY,
              description: 'Optional per-word color spans for body copy',
              items: segmentSchema,
            },
            image_query: { type: Type.STRING, description: 'Pexels search query for background image' },
            layout: {
              type: Type.STRING,
              description: "News-carousel layout: 'cover' or 'body'",
              enum: ['cover', 'body'],
            },
            is_cta: { type: Type.BOOLEAN, description: 'Whether this is the closing CTA slide' },
            role: {
              type: Type.STRING,
              enum: ['cover', 'reframe', 'support', 'pivot', 'close'],
              description: 'Slide role: cover, reframe, support, pivot, or close',
            },
            decorations: {
              type: Type.ARRAY,
              description:
                'Optional 0..2 decorations per slide. Closed-enum lucideName narrowed per spec.decorations.preferredLucide.',
              maxItems: '2',
              items: {
                type: Type.OBJECT,
                properties: {
                  kind: { type: Type.STRING, enum: ['icon', 'shape'] },
                  lucideName: {
                    type: Type.STRING,
                    enum: lucideEnum,
                    description: "Required when kind='icon'. NARROWED per spec.decorations.preferredLucide.",
                  },
                  shapeKind: {
                    type: Type.STRING,
                    enum: shapeEnum,
                    description: "Required when kind='shape'. NARROWED per spec.decorations.preferredShapes.",
                  },
                  color: {
                    type: Type.STRING,
                    enum: [...AI_COLOR_TOKENS],
                    description: 'Named color token resolved server-side via resolveAIColor.',
                  },
                  position: {
                    type: Type.STRING,
                    enum: [...AI_POSITION_ANCHORS],
                    description: 'Semantic anchor resolved to safe-zone % coords server-side.',
                  },
                  rotation: { type: Type.NUMBER, description: 'Optional rotation -180..180.' },
                  cornerRadius: { type: Type.NUMBER, description: 'Optional shape corner radius.' },
                  points: { type: Type.NUMBER, description: 'Optional polygon point count.' },
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
}

/**
 * Triple-layer silent-drop decoration ingest — mirror of the pattern in
 * generate-slides.ts:268..307. Per-FIELD silent-drop counter increments
 * with key 'emit.decoration.{field}' (EMIT-08).
 */
function processSlideDecorations(
  slide: SlideContent,
  slideIndex: number,
  template: ReturnType<typeof getTemplate>,
  silentDrop: SilentDropCounter,
  schemaVersion: number,
): SlideContent {
  const rawEmitted = (slide as { decorations?: unknown }).decorations
  const { decorations: _drop, ...slideWithoutRaw } = slide as SlideContent & { decorations?: unknown }
  void _drop

  if (!Array.isArray(rawEmitted) || rawEmitted.length === 0) {
    return slideWithoutRaw as SlideContent
  }

  const resolved: DecorationContent[] = []
  for (let i = 0; i < rawEmitted.length && resolved.length < 2; i++) {
    const entry = rawEmitted[i]
    const emitParse = DecorationEmitSchema.safeParse(entry)
    if (!emitParse.success) {
      // Increment per-field counter — granular telemetry for emit boundary.
      silentDrop.increment({
        field: 'emit.decoration.lucideName',
        reason: 'unknown_enum_value',
        raw_value: entry,
        schema_version: schemaVersion,
      })
      continue
    }
    try {
      const fullDeco = resolveAIDecoration(
        emitParse.data,
        slide as unknown as Slide,
        template,
        slideIndex,
        i,
      )
      const finalParse = DecorationSchema.safeParse(fullDeco)
      if (finalParse.success) {
        resolved.push(finalParse.data)
      } else {
        silentDrop.increment({
          field: 'emit.decoration.shape',
          reason: 'parse_error',
          raw_value: entry,
          schema_version: schemaVersion,
        })
      }
    } catch {
      silentDrop.increment({
        field: 'emit.decoration.resolve',
        reason: 'parse_error',
        raw_value: entry,
        schema_version: schemaVersion,
      })
    }
  }

  if (resolved.length === 0) return slideWithoutRaw as SlideContent
  return { ...slideWithoutRaw, decorations: resolved } as SlideContent & { decorations: DecorationContent[] }
}

/**
 * Phase 77 EMIT-01..04: text-only Gemini emit endpoint for the
 * style-from-reference path. Called by generateCarouselFromReferences
 * (Plan 02 Task 4) — never called directly by route handlers / Server
 * Actions.
 *
 * Two content modes:
 *   - 'ai-copy': Gemini generates new slide copy in spec's voice.
 *   - 'user-copy': Gemini structures user-supplied lines (no copy generation).
 *
 * @param spec    The (validated, possibly aspect-filtered + brand-kit-merged) StyleSpec.
 * @param content The content source (ai-copy with topic OR user-copy with lines).
 * @param options { slideCount?, template? } — defaults to 5 slides + templates[0].
 * @returns       CarouselWithTextBoxes (text_boxes populated, decorations canonical).
 * @throws        Error('emit.carousel-shape-failed') on second-attempt
 *                CarouselSchema failure; Error('emit.gemini-empty-response')
 *                on empty Gemini text.
 */
export async function generateFromStyleSpec(
  spec: StyleSpec,
  content: ContentSource,
  options: GenerateFromStyleSpecOptions = {},
): Promise<CarouselWithTextBoxes> {
  const template = options.template ?? templates[0]
  const slideCount = options.slideCount ?? 5

  // Phase 1: assemble system prompt (EMIT-05 spec-replaces-template-voice-note
  // handled inside buildFromSpecPrompt).
  const systemInstruction = buildFromSpecPrompt(spec, template, content)

  // Phase 2: build narrowed responseSchema (closed-enum at the wire boundary
  // per spec.decorations preferences).
  const responseSchema = buildNarrowedResponseSchema(spec)

  // Phase 3: build per-mode contents prompt.
  let baseContents: string
  if (content.mode === 'ai-copy') {
    baseContents = `Create a TikTok carousel about: ${content.topic}\n\nGenerate exactly ${slideCount} slides (including the opening hook and closing CTA).`
  } else {
    baseContents = `Structure these ${content.lines.length} user-supplied lines into a TikTok carousel — DO NOT change wording, only assign role/structure/decoration choices:\n${content.lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
  }

  // Silent-drop counter for telemetry at the emit boundary (EMIT-08).
  const silentDrop = createSilentDropCounter()

  async function callGemini(contents: string): Promise<unknown> {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
      },
    })
    if (!response.text) {
      throw new Error('emit.gemini-empty-response')
    }
    return JSON.parse(response.text)
  }

  // Phase 4: triple-layer silent-drop layer (a) — CarouselSchema parse + retry-once.
  let parsed = await callGemini(baseContents)
  let parsedCarousel = CarouselSchema.safeParse(parsed)
  if (!parsedCarousel.success) {
    // Retry with diagnostic — mirror generate-slides.ts retry pattern.
    const errCount = parsedCarousel.error?.issues?.length ?? 0
    const retryContents = `${baseContents}\n\nThe previous response had ${errCount} schema error(s) and could not be used. Generate again with valid shape.`
    parsed = await callGemini(retryContents)
    parsedCarousel = CarouselSchema.safeParse(parsed)
    if (!parsedCarousel.success) {
      throw new Error('emit.carousel-shape-failed')
    }
  }

  // Phase 5: PROJECTOR FUSION — merge spec-projected style_overrides with
  // each slide's own. Spec values WIN over Gemini values for the projected
  // fields (the spec is the design template).
  const projected = projectStyleSpecToSlideOverrides(spec, template)

  // Phase 6: per-slide PROJECTOR FUSION FIRST, then decoration ingest.
  //
  // Order matters (load-bearing): the decoration resolver reads
  // slide.style_overrides.derived_palette to resolve the `palette-vibrant`
  // color token. We MUST fuse the projector's derived_palette into the
  // slide BEFORE decoration ingest runs, otherwise palette-vibrant always
  // falls back to template.accentColor instead of spec.palette.primary.
  //
  // PROJECTOR FUSION: spec's projected fields WIN over Gemini's emitted
  // ones (Gemini may not emit style_overrides at all in v1; projected
  // fields are the canonical visual contract).
  const carousel = parsedCarousel.data
  const slidesProcessed: SlideContent[] = carousel.slides.map((slide, slideIndex) => {
    // Step A: PROJECTOR FUSION — derived_palette + text_position + fonts
    // applied to the raw slide so the decoration resolver sees them.
    const mergedStyleOverrides = {
      ...((slide.style_overrides as Record<string, unknown> | undefined) ?? {}),
      ...projected.style_overrides,
    }
    // Phase 80 R6 LIFT: template_id_override flows from the projector via
    // style_overrides (the projector's Pick<>-typed carrier), but the
    // renderer reads it from Slide.template_id_override (top-level, Phase
    // 55 D-08). Lift the value onto the slide top-level so getTemplate()
    // sees it. The projected value WINS over any Gemini-emitted slide
    // override — the spec's archetype is the canonical routing decision.
    const liftedTemplateIdOverride: string | undefined =
      typeof mergedStyleOverrides.template_id_override === 'string'
        ? (mergedStyleOverrides.template_id_override as string)
        : ((slide as { template_id_override?: string }).template_id_override)
    const slideWithProjector: SlideContent = {
      ...slide,
      style_overrides: mergedStyleOverrides,
      ...(liftedTemplateIdOverride !== undefined
        ? { template_id_override: liftedTemplateIdOverride }
        : {}),
    }
    // Step B: decoration ingest (triple-layer silent-drop pipeline).
    return processSlideDecorations(
      slideWithProjector,
      slideIndex,
      template,
      silentDrop,
      spec.schema_version,
    )
  })

  // Phase 7: text_boxes population — server-side adapter (mirror generate-slides.ts:323-328).
  // quick-260520-064: resolve per-slide template (template_id_override → carousel
  // template) and thread it into legacyToTextBoxes so the D1 fallback injects
  // the news-oracle 'BREAKING NEWS' 'ruled' kicker on style-spec covers too.
  // Also mirror text_boxes → custom_texts so server-side renderers see the
  // adapter-injected custom-role boxes (TPLREND-05 / PARITY-01).
  const slidesWithTextBoxes: SlideContentWithTextBoxes[] = slidesProcessed.map((slide) => {
    const slideTemplate = slide.template_id_override
      ? getTemplate(slide.template_id_override)
      : template
    const nextTextBoxes = separateOverlappingTextBoxes(
      legacyToTextBoxes(slide as unknown as Slide, slideTemplate),
    )
    const slice = textBoxesToLegacy(nextTextBoxes)
    const result = {
      ...slide,
      text_boxes: nextTextBoxes,
    } as SlideContentWithTextBoxes
    if (slice.custom_texts !== undefined && slice.custom_texts.length > 0) {
      ;(result as SlideContentWithTextBoxes & { custom_texts?: unknown }).custom_texts =
        slice.custom_texts
    }
    return result
  }) as SlideContentWithTextBoxes[]

  // Telemetry: log silent-drop count if non-zero. Code review checklist
  // (T-77-12): MUST NOT log spec.voice_note text — only structural counts.
  if (silentDrop.getCount() > 0) {
    console.info(
      `[generate-from-style-spec] silent-drop count at emit boundary: ${silentDrop.getCount()}`,
    )
  }

  return {
    title: carousel.title,
    slides: slidesWithTextBoxes,
  }
}
