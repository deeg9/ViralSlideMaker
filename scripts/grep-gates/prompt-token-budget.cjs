#!/usr/bin/env node
/**
 * Phase 77 Plan 02 Task 1 (EMIT-06): 12K-token prompt-budget CI gate.
 *
 * PITFALLS Pitfall 5a: token budget overflow on Gemini 2.5 Flash. We
 * assemble a worst-case prompt (system_prompt via the production
 * buildFromSpecPrompt + max-size StyleSpec + max-size brand-kit + max
 * 200-char topic) and assert the count is BELOW 12,000 tokens. Failing
 * this gate means a recent edit to buildFromSpecPrompt or the StyleSpec
 * serialization added verbose content that won't fit Gemini's headroom
 * once a real-world spec lands at request time.
 *
 * Tokenizer detection (CONTEXT.md grounding anchors):
 *   1. Try `require('tiktoken')` — exact GPT-style BPE, used by Gemini
 *      tokenizer-equivalence research (see PITFALLS Pitfall 5a).
 *   2. Try `require('@anthropic-ai/tokenizer')` — close approximation.
 *   3. Fallback to char-count × 0.25 heuristic. Documented choice
 *      (Latin text averages ~4 chars/token; safe overestimate at this
 *      scale for the budget gate).
 *
 * As of Phase 77, NEITHER tokenizer is in package.json — we ship with
 * the char/4 heuristic. Adding tiktoken later requires no edits here;
 * the require() is auto-detected.
 *
 * Wired into `npm run lint:gates` — exits 0 on success, exits 1 with
 * a "reduce X tokens" hint on failure. CI-killing on failure.
 */

const path = require('node:path')
const { execSync } = require('node:child_process')

const BUDGET = 12000
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const HELPER_PATH = path.resolve(__dirname, 'prompt-token-budget-helper.ts')

/**
 * Detect a tokenizer in this order: tiktoken → @anthropic-ai/tokenizer →
 * char-count × 0.25 fallback. Returns { name, count(text) }.
 */
function detectTokenizer() {
  // Tier 1: tiktoken
  try {
    const tiktoken = require('tiktoken')
    const enc = tiktoken.encoding_for_model
      ? tiktoken.encoding_for_model('gpt-4')
      : tiktoken.get_encoding('cl100k_base')
    return {
      name: 'tiktoken',
      count: (text) => enc.encode(text).length,
    }
  } catch (_e) {
    // not installed — fall through
  }
  // Tier 2: @anthropic-ai/tokenizer
  try {
    const anth = require('@anthropic-ai/tokenizer')
    return {
      name: '@anthropic-ai/tokenizer',
      count: (text) => anth.countTokens(text),
    }
  } catch (_e) {
    // not installed — fall through
  }
  // Tier 3: char-count × 0.25 fallback (4 chars/token approx for Latin
  // text). Documented in header.
  return {
    name: 'char-count × 0.25 (fallback heuristic)',
    count: (text) => Math.ceil(text.length / 4),
  }
}

function main() {
  // Smoke-only mode for the test that calls `node script.cjs --check-only`.
  // We still need to print *something* so the test's "output non-empty" check
  // passes, but we want to be fast for that path.
  const isCheckOnly = process.argv.includes('--check-only')

  // Build the worst-case assembled prompt by invoking the production
  // buildFromSpecPrompt via tsx (runs the helper which prints to stdout).
  let assembled
  try {
    assembled = execSync(`npx tsx "${HELPER_PATH}"`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    console.error('prompt-token-budget gate: failed to assemble prompt via helper:')
    console.error(err.message ?? err)
    process.exit(2)
  }

  const tokenizer = detectTokenizer()
  const tokens = tokenizer.count(assembled)
  const chars = assembled.length

  console.log(
    `prompt-token-budget gate: assembled prompt = ${chars} chars, ${tokens} tokens (budget: ${BUDGET})`,
  )
  console.log(`tokenizer: ${tokenizer.name}`)

  if (tokens >= BUDGET) {
    console.error('')
    console.error(
      `FAIL: assembled prompt (${tokens} tokens) exceeds 12000-token budget by ${tokens - BUDGET} tokens.`,
    )
    console.error(
      `Reduce verbose sections in src/lib/ai/prompts.ts buildFromSpecPrompt or the StyleSpec serialization to bring the count under 12000.`,
    )
    process.exit(1)
  }

  if (isCheckOnly) {
    console.log('check-only mode — gate not enforced.')
  }
  // Successful exit (0).
}

main()
