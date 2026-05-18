import { getTemplate } from '@/lib/render/templates'
import { getCategory } from '@/lib/ai/categories'
import { isPremiumTemplate } from './validate-slides'
import { AI_HOOK_VARIETY_ADDENDUM, AI_SLOP_AVOID_ADDENDUM } from './slop-guardrails'
import type { SlideTemplate } from '@/lib/render/templates'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { SlideArchetype } from '@/lib/types/style-spec-archetypes'
import type { ContentSource } from '@/lib/ai/generate-from-style-spec.types'
import {
  CAPTION_BAR_BOTTOM_HOOK_Y_RANGE,
  CAPTION_BAR_BOTTOM_BODY_Y_RANGE,
} from './style-spec-projector-constants'

// Templates that share the news-carousel prompt branch + skip-default-effects
// behavior. News Cyan reuses the entire News Drop generation flow — only the
// accent color (and a few visual tokens) differ. News Oracle (quick task
// 260518-jhg) is the picker-facing news keeper and joins the branch so it
// gets the news prompt addendum exactly like news-cyan.
const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan', 'news-oracle'])

export function buildSystemPrompt(templateId?: string, category?: string): string {
  // Phase 82 (R1): the CONTENT CATEGORY — not the templateId — drives the copy.
  // When a category resolves, its headline-first prompt module is the authority
  // on how Gemini writes; it takes precedence over the base SLIDE STRUCTURE
  // RULES and the legacy NEWS_TEMPLATES template-based branch. When no category
  // is supplied (legacy callers, tests, pre-Phase-82 paths), this block is empty
  // and the original templateId-based behavior is preserved unchanged.
  const categoryModule = category ? getCategory(category) : undefined
  const categoryBlock = categoryModule
    ? `

================================================================
${categoryModule.buildPrompt()}

The CONTENT CATEGORY rules above are AUTHORITATIVE. Where they conflict with the
generic "SLIDE STRUCTURE RULES" below (which mandate hook + body on middle
slides), the CONTENT CATEGORY rules WIN — write headline-first, omit body text.
================================================================
`
    : ''

  const newsDropAddendum = templateId && NEWS_TEMPLATES.has(templateId) ? `

NEWS DROP TEMPLATE (active):
You are writing in the style of a serious news Instagram carousel (think sovereignty.ai, AJ+, NowThis).
- Hooks should sound like a tabloid headline: short, declarative, all about the most newsworthy fact (proper nouns, statistics, scary verbs).
- For EVERY slide, populate \`hook_segments\`: split the hook into 4–8 short runs (typically one word each, but 2-word phrases like "DARK WEB" or "19 MILLION" are OK to keep together).
- Mark 1–3 segments per hook as \`accent: true\` to highlight the most newsworthy nouns and numbers. Never mark connector words ("a", "the", "of", "on", "and", "is", "was", "to", "for") as accent.
- For body copy, you may also populate \`body_segments\` to highlight 1–2 key phrases — but body accenting is optional.
- The very first slide should set \`layout: "cover"\` (image fills the top, headline sits in a bold black bar at the bottom).
- All other slides should set \`layout: "body"\` (small headline at top, large image at the bottom).
- The CTA slide (last slide, \`is_cta: true\`) should set \`layout: "body"\` and the hook should be a strong call to action like "FOLLOW FOR MORE" or "SHARE THIS NOW".
- Keep hook text uppercase-friendly. Avoid emoji entirely in this template.
- Image queries should be photojournalism-style: real subjects, news events, documentary photography.
` : ''

  // Phase 47 (TPLAI-04): per-template voice note. Reads from the template's
  // aiVoiceNote field. Existing 5 legacy templates leave aiVoiceNote undefined
  // → block is empty string → prompt unchanged. NEWS_TEMPLATES newsDropAddendum
  // stays as-is — the two systems coexist.
  const template = templateId ? getTemplate(templateId) : undefined
  const voiceNoteBlock = template?.aiVoiceNote
    ? `

TEMPLATE VOICE NOTE:
${template.aiVoiceNote}
`
    : ''

  // Phase 47 (TPLAI-01 + TPLAI-03): premium-tier addendum. Length caps,
  // highlight pill rules, accent color. Gated on isPremiumTemplate so
  // legacy templates skip this entirely. Documentary opts out of highlights
  // via an explicit "do NOT populate highlightColor" instruction.
  const accentHex = template?.accentColor ?? '#ffffff'
  const isDocumentary = templateId === 'documentary'
  const premiumAddendum = isPremiumTemplate(templateId)
    ? `

PREMIUM TEMPLATE TIER (active for ${templateId}):
- LENGTH CAPS — STRICT: hook_text MUST be 12 words or fewer; body_text MUST be 35 words or fewer. Count whitespace-separated tokens. Hyphenated words ("state-of-the-art") count as one. Compound dollar/number tokens ("$50M", "12-minute") count as one.
- NO ORPHANS: a slide's hook_text and body_text MUST be substantively different (less than 80% word overlap). Never duplicate the hook line in the body.
- SPELLING: spell every word correctly. Common AI mis-spellings to AVOID: MUSICAN, BUSSINESS, CARROUSEL, RECIEVE, SEPERATE, OCCURENCE, DEFINATELY, ACCOMODATE.
${
  isDocumentary
    ? `- HIGHLIGHTS: documentary template uses a minimal aesthetic. You do NOT populate highlightColor or highlightStyle on any segment. Leave hook_segments and body_segments unset OR provide segments WITHOUT highlightColor/highlightStyle fields.`
    : `- HIGHLIGHTS: populate hook_segments AND optionally body_segments with per-word color spans. On 1-2 segments per hook (and 0-1 per body), set highlightColor: '${accentHex}' and highlightStyle: 'pill'. Choose ACTION VERBS, PROPER NOUNS, and NUMBERS/QUANTITIES for highlights — never connector words ("a", "the", "of", "on", "and", "is", "to", "for"). Examples that match the desired aesthetic: "FIGHTS BACK", "CLONED HER VOICE", "$50M", "12 MINUTES".`
}

HOOK VARIETY (Phase 54 SLOP-04, D-12):
${AI_HOOK_VARIETY_ADDENDUM}
`
    : ''

  // Phase 58 (AIROLE-02, D-04): per-role copy guidance, verbatim. Unconditional —
  // applies to every templateId. Inserted BEFORE the HOOK PATTERNS section so it
  // informs all hooks (premium or not).
  const perRoleGuidance = `

PER-ROLE COPY GUIDANCE — every slide has a role; write each accordingly:
- cover (slide 1): pattern-interrupt hook, ≤8 words, designed to stop the scroll
- reframe: introduce a "wait, but" tension that contradicts the cover
- support: concrete evidence, example, or specific number
- pivot: unexpected angle that reframes what came before
- close (last slide): action / CTA / bookmark prompt — tell the viewer what to do next
`

  return `You are an expert TikTok carousel content creator. You generate slide content for vertical carousel posts (1080x1920 images).${categoryBlock}${newsDropAddendum}${voiceNoteBlock}${premiumAddendum}${perRoleGuidance}
HOOK PATTERNS — proven 2025-26 viral carousel formulas. Pick whichever fits the slide's role and the active TEMPLATE VOICE NOTE; vary across slides:
- Insider / gatekept knowledge: "the strategy viral creators don't tell you" — implies hidden value.
- Simplicity promise: "the only 3 things you need to [outcome]" — cuts through noise with a small number.
- Paradox: "why does [thing that seems wrong] actually work?" — the brain wants resolution.
- Proof-led, not promise-led: "this got me [specific result]" — specific number = credibility. Never fake the number.
- Contrarian, but grounded: "[take that runs against the consensus]" — must be defensible, not contrarian-for-its-own-sake.
- Counterintuitive truth: "Staying is the default." / "most people quit before the boring part." — confessional, single sentence, no setup.
- The silent X: "the silent way burnout starts" / "the quiet reason X stops working" — hints at a hidden process.
- Micro-story open (3-beat fragment): "I quit my job to sell paintings. 6 months. 47 canvases. One sold yesterday." — setup, count, payoff.

REGISTER — match hook voice to template family:
- Editorial / quiet templates (paper-essay, editorial-serif, documentary): lowercase serif headlines, restrained declaratives, ONE idea per slide. NO listicle openers, NO hype, NO ALL-CAPS. Short confessional truths read best.
- Tabloid / news templates (news-drop, news-cyan, magazine-bold, tr3nding-news): ALL-CAPS proper nouns, statistics, action verbs ("FIGHTS BACK", "$50M", "12 MINUTES"). Tabloid headline cadence.
- Personal / first-person templates (notes-app-chic, brutalist-grid, highlight-bar, bold-yellow, y2k-pop): fragmented short clauses, lowercase, ransom-note rhythm, "i" statements. Talk-to-me feel.
The TEMPLATE VOICE NOTE above (when present) overrides any conflict with this register guidance.

${AI_SLOP_AVOID_ADDENDUM}

SLIDE STRUCTURE RULES:
1. First slide: Must be a powerful hook that stops scrolling. Short, punchy, max 10 words.
2. Middle slides (2-6): One key point per slide. Hook text (bold) + body text (supporting detail).
3. Last slide: Clear CTA. Tell them what to do next (follow, save, share, comment).
4. Generate exactly the number of slides the user requests. The user controls the count.
5. Image queries: Provide specific Pexels search terms. Prefer lifestyle, aesthetic, and mood shots. Add "vertical" or "portrait" to queries.

WRITING STYLE:
- Conversational, not corporate
- Short sentences. Punchy. Direct.
- Use line breaks for emphasis
- Numbers and statistics when relevant
- Emoji sparingly (1-2 per carousel max, or zero)

LAYOUT & DESIGN RULES (for TikTok/Instagram posting):
- Text should be centered vertically on each slide. Avoid placing text near the bottom — that's where platform captions, comments, and UI buttons appear.
- Keep the top ~15% of the slide clear or minimal — the user's profile name and follow button overlay this area on TikTok/Instagram.
- The safe zone for text is roughly the middle 60-70% of the slide vertically.
- Use a semi-transparent overlay on background images so text remains readable. The background image adds mood, not information.
- Hook text should be large and bold. Body text should be smaller and have reduced opacity for visual hierarchy.
- Keep text concise per slide — aim for a glanceable read (under 3 seconds per slide).`
}

// ========================================================================= //
// Phase 77 Plan 02 (EMIT-01..05): buildFromSpecPrompt                       //
// ========================================================================= //
//
// SIBLING to buildSystemPrompt — NOT a branch. The legacy generate-slides.ts
// path keeps using buildSystemPrompt unchanged (regression-guarded by
// `prompts.test.ts` Test 9). The new style-from-reference emit path
// (generate-from-style-spec.ts) uses buildFromSpecPrompt.
//
// Why a sibling instead of branching the existing function? CONTEXT.md
// decisions §New endpoint pair — clean separation keeps the legacy path
// stable + makes the spec-driven path's contract obvious at the call site.
//
// EMIT-05 PRECEDENCE (load-bearing):
//   spec.voice_note REPLACES template.aiVoiceNote when both are present.
//   The whole point of style-from-reference is that the EXTRACTED spec is
//   the design source-of-truth — it wins over template defaults.
//
// Token-budget discipline (EMIT-06):
//   This function is invoked by the 12K-token CI gate
//   (scripts/grep-gates/prompt-token-budget.cjs). Keep the spec block
//   COMPACT — one line per section where possible, no decorative
//   whitespace. Adding verbose sections will trip the gate at build time.

/**
 * Format the spec as a Gemini-friendly compact block. Token-cheap
 * (~150 tokens for a max-size spec). Order is locked: palette →
 * typography → layout → imagery → decorations → rhythm.
 */
function serializeSpecForPrompt(spec: StyleSpec): string {
  const lines: string[] = []
  // Palette
  const palette = spec.palette
  const palParts = [`mode=${palette.mode}`, `primary=${palette.primary}`]
  if (palette.secondary) palParts.push(`secondary=${palette.secondary}`)
  if (palette.accent) palParts.push(`accent=${palette.accent}`)
  lines.push(`PALETTE: ${palParts.join(' ')}`)
  // Typography
  const typo = spec.typography
  const typoParts: string[] = []
  if (typo.hookFontCategory) typoParts.push(`hook=${typo.hookFontCategory}`)
  if (typo.bodyFontCategory) typoParts.push(`body=${typo.bodyFontCategory}`)
  lines.push(`TYPOGRAPHY: ${typoParts.length > 0 ? typoParts.join(' ') : '(template default)'}`)
  // Layout
  const layout = spec.layout
  const layoutParts: string[] = []
  if (layout.hookPosition) layoutParts.push(`hookPosition=${layout.hookPosition}`)
  if (layout.density) layoutParts.push(`density=${layout.density}`)
  lines.push(`LAYOUT: ${layoutParts.length > 0 ? layoutParts.join(' ') : '(template default)'}`)
  // Imagery
  const imagery = spec.imagery
  const imgParts: string[] = []
  if (imagery.treatmentPreset) imgParts.push(`treatment=${imagery.treatmentPreset}`)
  lines.push(`IMAGERY: ${imgParts.length > 0 ? imgParts.join(' ') : '(template default)'}`)
  // Decorations
  const dec = spec.decorations
  const lucide = dec.preferredLucide && dec.preferredLucide.length > 0
    ? dec.preferredLucide.join(',')
    : '(any)'
  const shapes = dec.preferredShapes && dec.preferredShapes.length > 0
    ? dec.preferredShapes.join(',')
    : '(any)'
  const decDensity = dec.density ? ` density=${dec.density}` : ''
  lines.push(`DECORATIONS: lucide=[${lucide}] shapes=[${shapes}]${decDensity}`)
  // Rhythm
  const rhythm = spec.rhythm
  lines.push(`RHYTHM: ${rhythm.cadence ? `cadence=${rhythm.cadence}` : '(template default)'}`)
  // Phase 80 R8: archetype + slot-params line. Token-cheap (~15-30 tokens).
  // ArchetypeSlots is a discriminated union keyed on `slideArchetype` — we
  // surface the archetype and any declared slot fields so the AI generation
  // prompt downstream can steer text_position / custom_images / highlight
  // rhythm consistent with the reference's composition.
  const archetype = spec.slideArchetype as SlideArchetype | undefined
  if (archetype) {
    const slotParts: string[] = []
    if (archetype === 'caption-bar-bottom' || archetype === 'caption-bar-top') {
      // Narrow to CaptionBarSlots — conservative cast keeps this compile-stable
      // across the discriminated-union narrowing edge cases.
      const caption = (spec as { caption?: { heightFraction?: number; background?: string } }).caption
      if (caption?.heightFraction !== undefined) slotParts.push(`caption.heightFraction=${caption.heightFraction}`)
      if (caption?.background !== undefined) slotParts.push(`caption.background=${caption.background}`)
    } else if (archetype === 'photo-collage-2up') {
      const split = (spec as { split?: { direction?: string; ratio?: string } }).split
      if (split?.direction !== undefined) slotParts.push(`split.direction=${split.direction}`)
      if (split?.ratio !== undefined) slotParts.push(`split.ratio=${split.ratio}`)
    }
    const archetypeLine = slotParts.length > 0
      ? `ARCHETYPE: ${archetype} (${slotParts.join(' ')})`
      : `ARCHETYPE: ${archetype}`
    lines.push(archetypeLine)
  }
  return lines.join('\n')
}

/**
 * Phase 77 EMIT-01..05: build the system prompt for the style-from-reference
 * emit endpoint. SIBLING to buildSystemPrompt — does NOT touch the legacy
 * path.
 *
 * EMIT-05: spec.voice_note REPLACES template.aiVoiceNote when both present.
 *
 * @param spec     The (Phase-75-validated, possibly aspect-filtered, possibly
 *                 brand-kit-merged) StyleSpec.
 * @param template The slide template — used for aiVoiceNote fallback only.
 * @param content  The content source (ai-copy with topic OR user-copy with
 *                 per-slide lines).
 * @returns        The assembled system prompt for Gemini.
 */
export function buildFromSpecPrompt(
  spec: StyleSpec,
  template: SlideTemplate,
  content: ContentSource,
): string {
  // EMIT-05: spec.voice_note REPLACES template.aiVoiceNote when present.
  // Explicit precedence — spec wins (the whole point of style-from-reference).
  // This is the load-bearing precedence rule for Phase 77.
  const voiceNote = spec.voice_note ?? template.aiVoiceNote ?? null
  const voiceNoteBlock = voiceNote
    ? `\n\nVOICE NOTE:\n${voiceNote}\n`
    : ''

  // Compact spec serialization — one line per section, token-cheap.
  // Token-budget gate (scripts/grep-gates/prompt-token-budget.cjs) computes
  // a worst-case prompt and asserts < 12K tokens; verbose sections here
  // would trip the gate.
  const specBlock = `\n\nSTYLE SPEC (extracted from reference; closed-enum design template):\n${serializeSpecForPrompt(spec)}\n`

  // Phase 80 R8: per-archetype guidance — directs Gemini's slide structure
  // choices (text_position, custom_images count, highlight rhythm) to match
  // the reference's composition. Token-cheap (~80-120 tokens worst-case,
  // single branch fires).
  const archetype = spec.slideArchetype as SlideArchetype | undefined
  let archetypeGuidance = ''
  switch (archetype) {
    case 'caption-bar-bottom':
      // quick-260515-i56: tighten guidance from the vague "set text_position
      // to bottom" to explicit y-ranges interpolated from
      // CAPTION_BAR_BOTTOM_HOOK_Y_RANGE / BODY_Y_RANGE (single source of
      // truth with the projector's caption-bar-bottom y-override branch in
      // src/lib/ai/style-spec-projector.ts). Belt-and-suspenders: even
      // though the projector deterministically overrides Gemini's emitted
      // y values, steering the AI toward in-band positions reduces drift
      // and produces cleaner regenerate-text output where the projector
      // doesn't re-run.
      archetypeGuidance =
        `\nARCHETYPE GUIDANCE: caption-bar-bottom — set text_position to "bottom" for each slide. ` +
        `For every slide's hook + body text_boxes: hook position.y MUST be in range ` +
        `[${CAPTION_BAR_BOTTOM_HOOK_Y_RANGE[0]}, ${CAPTION_BAR_BOTTOM_HOOK_Y_RANGE[1]}]; ` +
        `body position.y MUST be in range ` +
        `[${CAPTION_BAR_BOTTOM_BODY_Y_RANGE[0]}, ${CAPTION_BAR_BOTTOM_BODY_Y_RANGE[1]}]. ` +
        `anchor: 'custom'. The hook and body MUST visually sit centered inside the lower ` +
        `caption bar — not at the top edge of the bar. ` +
        `If palette.accent is present, emit ≥3 segments with highlightColor=palette.accent ` +
        `and highlightStyle="pill" on the hook to recreate the highlight rhythm pattern.\n`
      break
    case 'caption-bar-top':
      archetypeGuidance =
        '\nARCHETYPE GUIDANCE: caption-bar-top — set text_position to "top" for each slide. ' +
        'Use layout="cover" if Gemini emits layout.\n'
      break
    case 'full-bleed-text-overlay':
      archetypeGuidance =
        '\nARCHETYPE GUIDANCE: full-bleed-text-overlay — single full-bleed background photo per slide; ' +
        'text floats over the image. Choose text_position based on photo composition.\n'
      break
    case 'photo-collage-2up':
      archetypeGuidance =
        '\nARCHETYPE GUIDANCE: photo-collage-2up — emit EXACTLY 2 entries in custom_images for each slide ' +
        'to populate the split composition.\n'
      break
    case 'photo-collage-grid':
      archetypeGuidance =
        '\nARCHETYPE GUIDANCE: photo-collage-grid — emit EXACTLY 4 entries in custom_images for each slide ' +
        'to populate the 2x2 grid.\n'
      break
    case 'flat-color-background':
      archetypeGuidance =
        '\nARCHETYPE GUIDANCE: flat-color-background — solid color background, no photo. ' +
        'Do not emit image_query unless absolutely necessary.\n'
      break
    case 'editorial-serif':
      archetypeGuidance =
        '\nARCHETYPE GUIDANCE: editorial-serif — editorial magazine layout. Use serif typography for the hook.\n'
      break
    case 'notes-sticker':
      archetypeGuidance =
        '\nARCHETYPE GUIDANCE: notes-sticker — iOS notes / sticker aesthetic. Treat each slide as a short note.\n'
      break
  }

  // Per-content-mode block.
  let contentBlock = ''
  if (content.mode === 'ai-copy') {
    contentBlock = `\nGenerate slides about: ${content.topic}\n\nWrite copy in the spec's voice (palette/typography/layout/imagery + voice note above) — the spec is the design template extracted from the user's reference image.\n`
  } else {
    // user-copy: structure these lines into Slide segments. Gemini MUST NOT
    // change wording — only assign role, segment accents, decoration choices,
    // layout. Defends EMIT-04 contract at the prompt layer.
    const numbered = content.lines.map((line, idx) => `${idx + 1}. ${line}`).join('\n')
    contentBlock = `\nStructure these ${content.lines.length} lines into slides — DO NOT change wording, only structure (assign role, segment accents, decoration choices, layout):\n${numbered}\n`
  }

  return `You are an expert TikTok carousel content creator generating slides from a style spec extracted from a reference image. You generate slide content for vertical carousel posts (1080x1920 images).${voiceNoteBlock}${specBlock}${archetypeGuidance}${contentBlock}
PER-ROLE COPY GUIDANCE — every slide has a role; write each accordingly:
- cover (slide 1): pattern-interrupt hook, ≤8 words, designed to stop the scroll
- reframe: introduce a "wait, but" tension that contradicts the cover
- support: concrete evidence, example, or specific number
- pivot: unexpected angle that reframes what came before
- close (last slide): action / CTA / bookmark prompt — tell the viewer what to do next

DECORATIONS: when emitting decorations, use the lucide/shape names listed above (closed allowlist enforced by the responseSchema enum). Color tokens: 'accent', 'palette-vibrant', 'palette-dark-muted', 'palette-light', 'on-light', 'on-dark'. Position anchors: top-left, top-right, top-center, center, bottom-left, bottom-right, bottom-center. Max 2 per slide.

LAYOUT & DESIGN RULES (TikTok/Instagram posting):
- Text centered vertically; avoid bottom 15% (platform UI overlays).
- Top ~15% should be clear (profile name + follow button overlay).
- Hook text large + bold; body text smaller with reduced opacity for visual hierarchy.
- Keep text concise — glanceable read (under 3 seconds per slide).

${AI_SLOP_AVOID_ADDENDUM}

HOOK VARIETY:
${AI_HOOK_VARIETY_ADDENDUM}`
}
