// Phase 77 Plan 02 Task 1 (EMIT-06):
// Token-budget gate helper — builds a worst-case ASSEMBLED prompt by
// invoking the production buildFromSpecPrompt with max-size StyleSpec +
// max-size brand-kit-merged spec + a 200-char topic + the canonical
// templates[0]. Prints the prompt to stdout for the .cjs gate to count
// tokens against.
//
// This file lives next to the gate so any future change to the prompt
// assembly is automatically reflected in the gate's measurement (no
// fixture drift).

import { buildFromSpecPrompt } from '../../src/lib/ai/prompts'
import { templates } from '../../src/lib/render/templates'
import { AI_LUCIDE_ALLOWLIST, AI_SHAPE_KINDS } from '../../src/lib/ai/schemas'
import type { StyleSpec } from '../../src/lib/types/style-spec'

// MAX-SIZE StyleSpec: every section populated to its widest enum cardinality.
// This is the worst case the production code will ever see — if this fits
// 12K tokens, every real spec will too.
const MAX_SPEC: StyleSpec = {
  schema_version: 1,
  palette: {
    mode: 'gradient',
    primary: '#ABCDEF',
    secondary: '#123456',
    accent: '#FEDCBA',
  },
  typography: {
    hookFontCategory: 'sans-serif',
    bodyFontCategory: 'serif',
  },
  layout: {
    hookPosition: 'center',
    density: 'medium',
  },
  imagery: {
    treatmentPreset: 'duotone-cobalt',
  },
  decorations: {
    // Full AI_LUCIDE_ALLOWLIST — ~100 names, the wire-format max for the
    // narrowed allowlist. Production-side narrowDecorationAllowlist falls
    // back to this full list when the spec has no preference, so this is
    // the wire-format ceiling.
    preferredLucide: [...AI_LUCIDE_ALLOWLIST],
    preferredShapes: [...AI_SHAPE_KINDS],
    density: 'dense',
  },
  rhythm: {
    cadence: 'flowing',
  },
  // 200-char voice note (StyleSpec validator caps at 200 chars per
  // STYLESPEC-09, so this is the wire-format max).
  voice_note:
    'lowercase serif essay tone, restrained declaratives, one idea per slide, no listicles, no hype, no all-caps, short confessional truths, slow cadence, talk like the New Yorker not BuzzFeed pls.',
}

// Worst-case 200-char topic.
const MAX_TOPIC =
  'sustainable urban gardening in dense apartment buildings with limited light and space — how to grow food in containers on small balconies and inside windowsills using vertical hydroponics and grow lights'

const prompt = buildFromSpecPrompt(MAX_SPEC, templates[0], {
  mode: 'ai-copy',
  topic: MAX_TOPIC,
})

// Print to stdout — the .cjs gate reads this back.
process.stdout.write(prompt)
