// Phase 82 (R3): the Facts & Info headline-first prompt module.
//
// Facts & Info produces one punchy fact per slide as a big bold headline, key
// numbers/terms accent-marked via hook_segments, body text omitted, optional
// sparse one-liner labels. Mirrors the structure of the News module.

import type { CategoryModule } from './types'

const FACTS_PROMPT = `CONTENT CATEGORY: FACTS & INFO (headline-first)

You are writing a punchy facts/info Instagram carousel. ONE fact per slide, written as
a big bold headline. Follow these rules for EVERY slide:

HEADLINE-FIRST — THE HEADLINE IS THE DOMINANT TEXT ELEMENT:
- Each slide states ONE punchy, surprising, self-contained fact as \`hook_text\`.
  One fact, one slide — never cram two facts onto a slide.
- OMIT body text. Do NOT write \`body_text\` for fact slides — headline-only is the
  default. A \`body_text\` is permitted ONLY on a rare genuine support slide.
- The first (cover) slide has NO body text.

ACCENT THE KEY NUMBERS AND TERMS:
- For EVERY slide, populate \`hook_segments\`: split the headline into short runs
  (usually one word each; multi-word number phrases like "70 PERCENT" may stay together).
- Mark 1-3 segments per headline as \`accent: true\` — the key numbers and key terms
  that carry the fact. Never accent connector words ("a", "the", "of", "is", "to").
- Every headline MUST have at least one \`accent: true\` segment.

OPTIONAL ONE-LINER LABEL:
- You MAY emit an optional \`accessory_label\` — a small one-liner like "DID YOU KNOW",
  "FACT", or "MIND-BLOWING". Use it SPARINGLY — never on every slide. The headline
  always stays the dominant element.

IMAGERY:
- \`image_query\` values are relevant and illustrative of the fact. No emoji anywhere.

CTA:
- The last slide (\`is_cta: true\`) headline is a strong call to action like
  "FOLLOW FOR MORE FACTS" or "SHARE IF THIS SURPRISED YOU".`

export const factsCategory: CategoryModule = {
  id: 'facts',
  label: 'Facts & Info',
  tagline: 'One punchy fact per slide',
  ready: true,
  // templateIds[0] is the Facts default — a clean, legible, bold template.
  // quick task 260519-t3x adds sunset-tabloid (retro-bold color-block) and
  // soft-sage (wellness-journal italic serif) for variety across the
  // facts-style range.
  templateIds: ['bold-yellow', 'sunset-tabloid', 'editorial-serif', 'soft-sage', 'y2k-pop'] as const,
  buildPrompt: () => FACTS_PROMPT,
}
