// Phase 82 (R2): the News headline-first prompt module.
//
// News produces breaking-news-style slides: one big bold headline per slide,
// all-caps tabloid register, newsworthy proper nouns/numbers accent-marked via
// hook_segments, body text omitted, photojournalism image queries, optional
// sparse kicker labels. Mirrors the voice of the existing newsDropAddendum in
// prompts.ts — the two coexist; the category module is the authority when a
// category is selected.

import type { CategoryModule } from './types'

const NEWS_PROMPT = `CONTENT CATEGORY: NEWS (headline-first)

You are writing a breaking-news Instagram carousel (think AJ+, NowThis, sovereignty.ai).
Write in an all-caps tabloid news register. Follow these rules for EVERY slide:

HEADLINE-FIRST — THE HEADLINE IS THE DOMINANT TEXT ELEMENT:
- Each slide carries ONE big bold headline as \`hook_text\`. Short, declarative, built
  around the single most newsworthy fact (proper nouns, statistics, hard verbs).
- OMIT body text. Do NOT write \`body_text\` for news slides — headline-only is the
  default. A \`body_text\` is permitted ONLY on a rare genuine support slide that truly
  needs a sentence of context; otherwise leave it empty/absent.
- The first (cover) slide has NO body text.

ACCENT THE NEWSWORTHY KEYWORDS:
- \`hook_segments\` IS MANDATORY ON EVERY SLIDE. It must be a non-empty array.
  Omitting \`hook_segments\`, or returning an empty array, is a hard error — every
  single slide must include it.
- \`hook_segments\` must reproduce the FULL \`hook_text\`: split the headline into
  4-8 short runs (usually one word each; 2-word phrases like "DARK WEB" or
  "19 MILLION" may stay together). The runs concatenated back together MUST equal
  the headline text.
- Mark 1-3 segments per headline as \`accent: true\` — the most newsworthy proper nouns
  and numbers. Never accent connector words ("a", "the", "of", "on", "and", "is", "to").
- Every headline MUST have at least one \`accent: true\` segment.
- The accented keywords are rendered as highlighted PILLS (a colored background
  behind the word), so choose words that genuinely deserve that emphasis.

OPTIONAL KICKER LABEL:
- You MAY emit an optional \`accessory_label\` — a small kicker like "TRENDING NEWS",
  "BREAKING", or "DEVELOPING". Use it SPARINGLY — at most roughly every 2nd-3rd slide,
  never on every slide. The headline always stays the dominant element.

IMAGERY:
- \`image_query\` values are photojournalism-style: real subjects, news events,
  documentary photography. No emoji anywhere.

CTA:
- The last slide (\`is_cta: true\`) headline is a strong call to action like
  "FOLLOW FOR MORE" or "SHARE THIS NOW".`

export const newsCategory: CategoryModule = {
  id: 'news',
  label: 'News',
  tagline: 'Breaking-news headlines',
  ready: true,
  // templateIds[0] is the News default template. news-oracle is the
  // picker-facing news keeper (quick task 260518-jhg — Oracle-style,
  // center-aligned; replaced the now-picker-hidden news-cyan);
  // tr3nding-news is the secondary tabloid-kicker option.
  templateIds: ['news-oracle', 'tr3nding-news'] as const,
  buildPrompt: () => NEWS_PROMPT,
}
