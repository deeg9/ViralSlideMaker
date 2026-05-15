// Phase 77 Plan 02 (EMIT-05): buildFromSpecPrompt tests.
//
// EMIT-05 contract: when spec.voice_note is defined, it REPLACES the
// template's aiVoiceNote in the assembled system prompt. This is the
// load-bearing precedence rule — the spec is the design source-of-truth
// for style-from-reference, so it wins over any template-level voice note.
//
// Tests also verify content-mode handling (ai-copy vs user-copy), spec
// section serialization, and decoration allowlist visibility in the prompt
// (defense-in-depth alongside the closed-enum responseSchema in
// generate-from-style-spec.ts).

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { buildFromSpecPrompt, buildSystemPrompt } from '../prompts'
import { templates, getTemplate } from '@/lib/render/templates'
import {
  CAPTION_BAR_BOTTOM_HOOK_Y_RANGE,
  CAPTION_BAR_BOTTOM_BODY_Y_RANGE,
} from '@/lib/ai/style-spec-projector-constants'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { ContentSource } from '@/lib/ai/generate-from-style-spec.types'

function makeSpec(overrides?: Partial<StyleSpec>): StyleSpec {
  // Cast: Partial<StyleSpec> over a discriminated union (StyleSpec is intersected
  // with ArchetypeSlots in Phase 80) cannot be spread back into the union without
  // collapsing the discriminator. Spec contract is concrete here:
  // slideArchetype='full-bleed-text-overlay' (EmptySlots variant).
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#A8E0B0', accent: '#11AABB' },
    typography: {
      hookFontCategory: 'sans-serif',
      bodyFontCategory: 'serif',
    },
    layout: { hookPosition: 'center', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: {
      preferredLucide: ['Star', 'Heart'],
      preferredShapes: ['circle', 'rect'],
      density: 'moderate',
    },
    rhythm: { cadence: 'punchy' },
    voice_note: 'spec-voice: lowercase essay tone, slow cadence',
    ...overrides,
  } as StyleSpec
}

describe('Phase 77 Plan 02: buildFromSpecPrompt — EMIT-05 spec-replaces-template-voice-note', () => {
  it('Test 1: spec.voice_note PRESENT in assembled prompt when set', () => {
    // EMIT-05: spec.voice_note must be visible to Gemini.
    const spec = makeSpec({ voice_note: 'spec-voice: lowercase essay tone' })
    const template = getTemplate('documentary') // has aiVoiceNote set
    const content: ContentSource = { mode: 'ai-copy', topic: 'X' }
    const prompt = buildFromSpecPrompt(spec, template, content)
    expect(prompt).toContain('spec-voice: lowercase essay tone')
  })

  it('Test 2: template.aiVoiceNote is REPLACED (NOT present) when spec.voice_note is also set', () => {
    // EMIT-05 precedence: spec wins. The whole point of style-from-reference.
    const spec = makeSpec({ voice_note: 'spec-voice: lowercase essay tone' })
    const template = getTemplate('documentary')
    expect(template.aiVoiceNote).toBeDefined()
    const content: ContentSource = { mode: 'ai-copy', topic: 'X' }
    const prompt = buildFromSpecPrompt(spec, template, content)
    // Template's voice note must NOT appear (replaced by spec)
    expect(prompt).not.toContain(template.aiVoiceNote!)
  })

  it('Test 3: spec.voice_note ABSENT → fallback to template.aiVoiceNote', () => {
    // When spec has no voice note, the template's voice note still flows in.
    const spec = makeSpec({ voice_note: undefined })
    const template = getTemplate('documentary')
    expect(template.aiVoiceNote).toBeDefined()
    const content: ContentSource = { mode: 'ai-copy', topic: 'X' }
    const prompt = buildFromSpecPrompt(spec, template, content)
    expect(prompt).toContain(template.aiVoiceNote!)
  })

  it('Test 4: ai-copy mode includes topic instruction', () => {
    const spec = makeSpec()
    const template = templates[0]
    const content: ContentSource = { mode: 'ai-copy', topic: 'sustainable urban gardening' }
    const prompt = buildFromSpecPrompt(spec, template, content)
    expect(prompt).toContain('sustainable urban gardening')
    // Sanity: assembled prompt contains a generation instruction marker
    expect(prompt.toLowerCase()).toMatch(/generate|create|about/i)
  })

  it('Test 5: user-copy mode includes user lines verbatim + structure-only instruction', () => {
    const spec = makeSpec()
    const template = templates[0]
    const content: ContentSource = {
      mode: 'user-copy',
      lines: ['First user line.', 'Second user line.'],
    }
    const prompt = buildFromSpecPrompt(spec, template, content)
    // Lines verbatim
    expect(prompt).toContain('First user line.')
    expect(prompt).toContain('Second user line.')
    // Structure-only instruction (Gemini must NOT change wording)
    expect(prompt.toLowerCase()).toMatch(/do not change wording|only structure|structure these/i)
  })

  it('Test 6: assembled prompt CONTAINS spec.palette serialization (primary + accent hex)', () => {
    const spec = makeSpec({ palette: { mode: 'solid', primary: '#ABCDEF', accent: '#123456' } })
    const template = templates[0]
    const content: ContentSource = { mode: 'ai-copy', topic: 'X' }
    const prompt = buildFromSpecPrompt(spec, template, content)
    expect(prompt).toContain('#ABCDEF')
    expect(prompt).toContain('#123456')
  })

  it('Test 7: assembled prompt CONTAINS spec.decorations.preferredLucide subset names', () => {
    const spec = makeSpec({
      decorations: {
        preferredLucide: ['Star', 'Sparkles'],
        preferredShapes: ['rect'],
      },
    })
    const template = templates[0]
    const content: ContentSource = { mode: 'ai-copy', topic: 'X' }
    const prompt = buildFromSpecPrompt(spec, template, content)
    expect(prompt).toContain('Star')
    expect(prompt).toContain('Sparkles')
    expect(prompt).toContain('rect')
  })

  it('Test 8: code comment near voice-note substitution explicitly cites EMIT-05', () => {
    // Defense at code-review time — the EMIT-05 precedence is documented in source.
    const filePath = path.resolve(__dirname, '../prompts.ts')
    const src = fs.readFileSync(filePath, 'utf-8')
    expect(src).toMatch(/EMIT-05/)
  })

  it('Test 9: existing buildSystemPrompt is UNCHANGED — pre-Phase-77 behavior preserved', () => {
    // Regression guard: the legacy generate-slides.ts path keeps working.
    // Sanity-test some load-bearing strings the existing system prompt emits.
    const prompt = buildSystemPrompt('documentary')
    expect(prompt).toContain('TikTok carousel content creator')
    expect(prompt).toContain('PER-ROLE COPY GUIDANCE')
    // documentary has aiVoiceNote — template voice note flows through legacy path
    expect(prompt).toContain('TEMPLATE VOICE NOTE')
  })
})

describe('quick-260515-i56: caption-bar-bottom archetype guidance contains explicit y-ranges', () => {
  // Helper: build a caption-bar-bottom spec. Optional `caption` slot satisfies
  // the discriminated-union narrowing for CaptionBarSlots but the prompt-test
  // doesn't depend on it being populated.
  function makeCaptionBarSpec(overrides?: Partial<StyleSpec>): StyleSpec {
    return {
      schema_version: 2,
      slideArchetype: 'caption-bar-bottom',
      palette: { mode: 'solid', primary: '#0f0f0f', accent: '#ff00aa' },
      typography: { hookFontCategory: 'display', bodyFontCategory: 'sans-serif' },
      layout: { hookPosition: 'bottom', density: 'tight' },
      imagery: { treatmentPreset: 'bw' },
      decorations: { preferredLucide: [], preferredShapes: [], density: 'sparse' },
      rhythm: { cadence: 'punchy' },
      voice_note: 'magazine bold',
      ...overrides,
    } as StyleSpec
  }

  it('Test 7: caption-bar-bottom prompt contains explicit hook + body y-range strings (interpolated from constants)', () => {
    const spec = makeCaptionBarSpec()
    const template = getTemplate('magazine-bold')
    const content: ContentSource = { mode: 'ai-copy', topic: 'test' }
    const prompt = buildFromSpecPrompt(spec, template, content)

    // Construct expected substrings from the SAME constants the runtime
    // reads. Drift between this test and the prompt is impossible — both
    // pull from style-spec-projector-constants.ts.
    const expectedHookRange = `[${CAPTION_BAR_BOTTOM_HOOK_Y_RANGE[0]}, ${CAPTION_BAR_BOTTOM_HOOK_Y_RANGE[1]}]`
    const expectedBodyRange = `[${CAPTION_BAR_BOTTOM_BODY_Y_RANGE[0]}, ${CAPTION_BAR_BOTTOM_BODY_Y_RANGE[1]}]`

    expect(prompt).toContain(`hook position.y MUST be in range ${expectedHookRange}`)
    expect(prompt).toContain(`body position.y MUST be in range ${expectedBodyRange}`)
    // Belt-and-suspenders steering for Gemini (even though the projector
    // enforces anchor='custom' deterministically downstream).
    expect(prompt).toContain("anchor: 'custom'")
  })

  it('Test 8: non-caption-bar archetypes do NOT contain the caption-bar-bottom y-range text', () => {
    const template = getTemplate('magazine-bold')
    const content: ContentSource = { mode: 'ai-copy', topic: 'test' }

    const fullBleedPrompt = buildFromSpecPrompt(
      makeCaptionBarSpec({ slideArchetype: 'full-bleed-text-overlay' }),
      template,
      content,
    )
    expect(fullBleedPrompt).not.toContain('hook position.y MUST be in range')
    expect(fullBleedPrompt).not.toContain('body position.y MUST be in range')

    const captionTopPrompt = buildFromSpecPrompt(
      makeCaptionBarSpec({ slideArchetype: 'caption-bar-top' }),
      template,
      content,
    )
    expect(captionTopPrompt).not.toContain('hook position.y MUST be in range')
    expect(captionTopPrompt).not.toContain('body position.y MUST be in range')
  })

  it('Test 9: assembled caption-bar-bottom prompt remains under the 12K-token budget (~48K char proxy)', () => {
    // Char-length proxy at ~4 chars/token, conservative. Token-budget gate
    // (scripts/grep-gates/prompt-token-budget.cjs) is the production check;
    // this smoke test catches the rough order-of-magnitude regression in unit
    // tests. The new ARCHETYPE GUIDANCE block adds ~250 chars at most.
    const spec = makeCaptionBarSpec()
    const template = getTemplate('magazine-bold')
    const content: ContentSource = { mode: 'ai-copy', topic: 'test' }
    const prompt = buildFromSpecPrompt(spec, template, content)
    expect(prompt.length).toBeLessThan(48000)
  })

  it('Test 10: caption-bar-bottom case body has zero literal y-band numbers (single source of truth)', () => {
    // Grep gate: 70/76/82/88 must NEVER appear as raw integer literals inside
    // the caption-bar-bottom case body of prompts.ts. They MUST only flow via
    // CAPTION_BAR_BOTTOM_HOOK_Y_RANGE / BODY_Y_RANGE interpolation.
    //
    // We scope to JUST the caption-bar-bottom switch case (between the `case`
    // line and the next `case` / `}`) so that unrelated occurrences elsewhere
    // in the file (e.g. the "middle 60-70%" safe-zone comment) don't trip the
    // gate. The drift the test is guarding against is: "did someone hard-code
    // the y-bands inside this specific branch?"
    const filePath = path.resolve(__dirname, '../prompts.ts')
    const src = fs.readFileSync(filePath, 'utf-8')
    const caseMatch = src.match(/case 'caption-bar-bottom':[\s\S]*?break/)
    expect(caseMatch).not.toBeNull()
    const caseBody = caseMatch![0]
    const matches = caseBody.match(/\b(70|76|82|88)\b/g) ?? []
    expect(matches.length).toBe(0)
  })
})
