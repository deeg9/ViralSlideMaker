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
import type { StyleSpec } from '@/lib/types/style-spec'
import type { ContentSource } from '@/lib/ai/generate-from-style-spec.types'

function makeSpec(overrides?: Partial<StyleSpec>): StyleSpec {
  return {
    schema_version: 1,
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
  }
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
