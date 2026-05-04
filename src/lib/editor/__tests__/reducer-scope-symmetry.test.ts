import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Phase 68 Plan 03 (PARITY-15 / PRA1..PRA12): source-grep audit gate.
 *
 * Asserts that every multi-select reducer case body in `editor-reducer.ts`
 * mentions all 4 AddressableScope values: 'text_boxes', 'custom_images',
 * 'watermark', 'decorations'. This is the runtime grep gate that pairs
 * with the compile-time `assertExhaustiveScope(scope: never): never`
 * exhaustiveness gate (Plan 68-01) — double protection so a future
 * refactor that drops a scope reference fails CI.
 *
 * Methodology (mirror of Phase 67 lucide-brand-icon-grep.test.ts):
 *  1. Read editor-reducer.ts as text.
 *  2. For each PRA action, slice from the leading documentation comment
 *     block (contiguous `//`, `/*`, ` * ` lines above the case label)
 *     through the case body's matching closing `}` (brace-depth count).
 *  3. Strip `//` line comments — defends SELF-CTRL-3 contract: a
 *     ` // decorations branch — TODO` line MUST NOT count as a code
 *     mention. Block comments (`/*  ... *\/`) are RETAINED so the
 *     v2.11 documentation pattern of `/* watermark: skipped — enum-only
 *     position *\/` counts as a documented no-op mention.
 *  4. Run scope-literal regex per action; report missing scopes with
 *     the case label + action name in the failure message.
 *
 * SELF-CTRL tests pin the methodology: a synthetic body lacking a scope
 * MUST be reported missing; the line-comment stripper MUST actually
 * strip `// decorations` so it doesn't false-green.
 */

const REDUCER_PATH = resolve(__dirname, '..', 'editor-reducer.ts')
const REDUCER_SRC = readFileSync(REDUCER_PATH, 'utf-8')

const ALL_4_SCOPES = ['text_boxes', 'custom_images', 'watermark', 'decorations'] as const

/**
 * Strip `//` line comments from a block. Preserves `/* ... *\/` block
 * comments because the v2.11 codebase uses block comments to document
 * scopes that participate as no-ops (e.g. watermark in BULK_TRANSLATE,
 * which has no freeform x/y position to translate).
 */
function stripLineComments(block: string): string {
  return block
    .split('\n')
    .map((line) => {
      // Find `//` outside of a string literal. A naive scan suffices here
      // because the reducer source uses only single-quoted string literals
      // and no `//` patterns appear inside them today. If that ever
      // changes, this stripper would over-strip — and SELF-CTRL-3 would
      // catch it via the methodology pin.
      const idx = line.indexOf('//')
      return idx === -1 ? line : line.slice(0, idx)
    })
    .join('\n')
}

/**
 * Slice the leading documentation comment block + the matching case
 * body for `action`. Returns the joined text WITH line-comments stripped.
 *
 * Walks BACKWARD from the `case 'X':` label through contiguous comment-
 * only and blank lines to capture the JSDoc-style block that documents
 * the case (where v2.11 puts its scope-skip rationales).
 *
 * Walks FORWARD via brace-depth counting from the case body's opening
 * `{` to the matching closing `}` to capture the body itself.
 */
function sliceCaseBody(src: string, actionType: string): string {
  const lines = src.split('\n')
  const labelToken = `case '${actionType}':`
  const labelLine = lines.findIndex((l) => l.includes(labelToken))
  if (labelLine === -1) {
    throw new Error(
      `[reducer-scope-symmetry] case '${actionType}' not found in editor-reducer.ts`,
    )
  }

  // Walk backward over contiguous comment / blank lines
  let startLine = labelLine
  for (let j = labelLine - 1; j >= 0; j--) {
    const trimmed = lines[j].trim()
    if (
      trimmed === '' ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    ) {
      startLine = j
    } else {
      break
    }
  }

  // Walk forward via brace-depth count from the case's opening `{`
  let depth = 0
  let started = false
  let endLine = labelLine
  for (let j = labelLine; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === '{') {
        depth++
        started = true
      } else if (ch === '}') {
        depth--
        if (started && depth === 0) {
          endLine = j
          break
        }
      }
    }
    if (started && depth === 0) {
      endLine = j
      break
    }
  }

  const raw = lines.slice(startLine, endLine + 1).join('\n')
  return stripLineComments(raw)
}

function mentionsScope(body: string, scope: string): boolean {
  return body.includes(scope)
}

describe('Phase 68 PARITY-15: reducer scope-symmetry audit (PRA1..PRA12)', () => {
  // ---------------------------------------------------------------------------
  // PRA1..PRA3: 3 NEW decoration-only actions (Plan 68-01).
  // These are SINGLE-SCOPE by design — they only need to mention 'decorations'.
  // ---------------------------------------------------------------------------
  const SINGLE_SCOPE_ACTIONS = [
    ['PRA1', 'ADD_DECORATION'],
    ['PRA2', 'UPDATE_DECORATION'],
    ['PRA3', 'REMOVE_DECORATION'],
  ] as const

  for (const [pra, action] of SINGLE_SCOPE_ACTIONS) {
    it(`${pra}: ${action} case body mentions 'decorations'`, () => {
      const body = sliceCaseBody(REDUCER_SRC, action)
      expect(
        mentionsScope(body, 'decorations'),
        `${action} case body must mention 'decorations'`,
      ).toBe(true)
    })
  }

  // ---------------------------------------------------------------------------
  // PRA4..PRA12: 9 multi-scope actions (Plan 68-02 EXTENDED cases).
  // Each case body MUST mention all 4 AddressableScope values. Watermark
  // mentions are typically inside `/* */` block comments (v2.11 documents
  // watermark as a no-op for several actions because its position is enum-
  // only — no freeform x/y to translate / align). Block comments are
  // PRESERVED by the slicer (only `//` line comments are stripped). This
  // matches PRA12 plan note: "watermark = no-op comment counts as mention".
  // ---------------------------------------------------------------------------
  const MULTI_SCOPE_ACTIONS = [
    ['PRA4', 'BULK_TRANSLATE'],
    ['PRA5', 'BULK_DELETE'],
    ['PRA6', 'DUPLICATE_ELEMENTS_AT'],
    ['PRA7', 'GROUP'],
    ['PRA8', 'UNGROUP'],
    ['PRA9', 'SET_LOCKED'],
    ['PRA10', 'SET_HIDDEN'],
    ['PRA11', 'ALIGN'],
    ['PRA12', 'Z_ORDER'],
  ] as const

  for (const [pra, action] of MULTI_SCOPE_ACTIONS) {
    it(`${pra}: ${action} case body mentions all 4 AddressableScope values`, () => {
      const body = sliceCaseBody(REDUCER_SRC, action)
      const missing = ALL_4_SCOPES.filter((s) => !mentionsScope(body, s))
      expect(
        missing,
        `${action} case body missing scope(s): ${missing.join(', ')}.\n` +
          `Stripped body (first 800 chars):\n${body.slice(0, 800)}`,
      ).toEqual([])
    })
  }

  // ---------------------------------------------------------------------------
  // Self-controls — pin the methodology so a future "fix" to the slicer
  // can't silently false-green the 12 PRA tests.
  // ---------------------------------------------------------------------------

  it('SELF-CTRL-1: helper detects missing scope on a synthetic broken body', () => {
    const synthetic = `
      const next = slide.text_boxes ?? []
      // a comment that mentions custom_images is stripped, so it should NOT count
    `.trim()
    const stripped = stripLineComments(synthetic)
    const missing = ALL_4_SCOPES.filter((s) => !mentionsScope(stripped, s))
    // After stripping: only 'text_boxes' code-mention remains.
    // 'custom_images' / 'watermark' / 'decorations' MUST be reported missing.
    expect(missing).toEqual(['custom_images', 'watermark', 'decorations'])
  })

  it('SELF-CTRL-2: helper passes a synthetic body that mentions all 4 scopes in code', () => {
    const synthetic = `
      slide.text_boxes; slide.custom_images; slide.watermark; slide.decorations
    `.trim()
    const stripped = stripLineComments(synthetic)
    const missing = ALL_4_SCOPES.filter((s) => !mentionsScope(stripped, s))
    expect(missing).toEqual([])
  })

  it('SELF-CTRL-3: line-comment stripper strips `// decorations` so it does NOT count as a code mention', () => {
    // Defense against the false-green class: a body that mentions the scope
    // ONLY in a `// decorations branch — TODO` line would self-invalidate
    // the grep gate (the test passes but the runtime never touches the
    // field). The slicer MUST strip the line comment.
    const synthetic = `
      // decorations branch — TODO not yet implemented
      const next = slide.text_boxes
    `.trim()
    const stripped = stripLineComments(synthetic)
    expect(stripped.includes('decorations')).toBe(false)
    expect(stripped.includes('text_boxes')).toBe(true)
  })

  it('SELF-CTRL-4: block comments are PRESERVED so `/* watermark: no-op */` DOES count', () => {
    // Mirror image of SELF-CTRL-3: v2.11 documents some scopes (notably
    // watermark) as no-ops via block comments. The slicer MUST NOT strip
    // these — block-comment documentation is the canonical way to say
    // "this scope is intentionally not touched here".
    const synthetic = `
      /* watermark: no-op — enum-only position, no freeform x/y to translate */
      slide.text_boxes; slide.custom_images; slide.decorations
    `.trim()
    const stripped = stripLineComments(synthetic)
    // All 4 scopes mentioned (watermark via block comment, others via code).
    const missing = ALL_4_SCOPES.filter((s) => !mentionsScope(stripped, s))
    expect(missing).toEqual([])
  })
})
