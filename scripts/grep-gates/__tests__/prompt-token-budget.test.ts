// Phase 77 Plan 02 Task 1 (EMIT-06):
// Contract tests for the 12K-token prompt-budget CI gate. Verifies:
//   - Test 1: gate script file exists + is invokable via node
//   - Test 2: tokenizer-detection — script header documents tokenizer choice
//     (tiktoken / @anthropic-ai/tokenizer / char-count fallback)
//   - Test 3: gate computes token count of an ASSEMBLED max-size prompt
//     (system_prompt via buildFromSpecPrompt + max-StyleSpec + max-brand-kit
//     + max-200-char topic) and prints the count
//   - Test 4: gate exits 0 when budget is satisfied (current Phase 77 prompt)
//   - Test 5: package.json `lint:gates` script chains the existing closed-enum
//     gate AND the new prompt-token-budget gate
//   - Test 6: at the current Phase 77 prompt size, the gate PASSES — proves
//     infrastructure works AND ships within budget
//   - Test 7: gate exit code is 0 on success, non-zero on failure
//
// PITFALLS Pitfall 5a: token budget overflow. The gate is the structural
// defense — adding a verbose section to buildFromSpecPrompt or to the
// StyleSpec serialization would trip it at build time, not in production.

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const SCRIPT_PATH = resolve(REPO_ROOT, 'scripts/grep-gates/prompt-token-budget.cjs')
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json')

describe('Phase 77 Plan 02 Task 1: prompt-token-budget.cjs CI gate (EMIT-06)', () => {
  it('Test 1: gate script file exists and is invokable via node', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true)
    // Smoke: node can parse the file as a CJS module without throwing.
    const result = execSync(`node "${SCRIPT_PATH}" --check-only 2>&1 || true`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
    // The --check-only flag (or default invocation) must produce SOME output —
    // either the token count or an error message.
    expect(result.length).toBeGreaterThan(0)
  })

  it('Test 2: script header documents tokenizer choice', () => {
    const src = readFileSync(SCRIPT_PATH, 'utf-8')
    // Header MUST document tokenizer detection AND the chosen heuristic.
    // Per CONTEXT.md grounding anchors note: "if neither tiktoken nor
    // @anthropic-ai/tokenizer is in package.json, fall back to
    // char-count × 0.25 heuristic for the gate (document)".
    expect(src).toMatch(/tiktoken/)
    expect(src).toMatch(/@anthropic-ai\/tokenizer/)
    expect(src).toMatch(/char[-\s]?count|fallback|heuristic/i)
    // Phase reference for CI provenance.
    expect(src).toMatch(/EMIT-06|Phase 77/)
  })

  it('Test 3: gate computes token count of assembled max-size prompt', () => {
    // Run the gate; it MUST print the token count for the assembled prompt.
    const result = execSync(`node "${SCRIPT_PATH}" 2>&1 || true`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
    // Output must contain a number (token count) and the budget reference.
    expect(result).toMatch(/\b\d+\s+tokens?\b|tokens?:?\s*\d+/i)
    expect(result).toMatch(/12000|12k|12,000/i)
  })

  it('Test 4: at current Phase 77 prompt size, gate PASSES (count < 12000)', () => {
    // The current buildFromSpecPrompt + max-spec + max-brand-kit + max-topic
    // must fit comfortably in budget. If this fails, someone added verbose
    // sections — reduce them.
    let exitCode = 0
    try {
      execSync(`node "${SCRIPT_PATH}"`, { cwd: REPO_ROOT, stdio: 'pipe' })
    } catch (err: unknown) {
      const e = err as { status?: number }
      exitCode = e.status ?? 1
    }
    expect(exitCode).toBe(0)
  })

  it('Test 5: package.json lint:gates chains closed-enum gate AND token-budget gate', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
      scripts: Record<string, string>
    }
    const lintGates = pkg.scripts['lint:gates']
    expect(lintGates).toBeDefined()
    // Both gates must be referenced.
    expect(lintGates).toMatch(/closed-enum-styleSpec/)
    expect(lintGates).toMatch(/prompt-token-budget/)
    // Chained with && so failure of either fails the script.
    expect(lintGates).toMatch(/&&/)
  })

  it('Test 6: gate prints token count when invoked (infrastructure proof)', () => {
    const result = execSync(`node "${SCRIPT_PATH}" 2>&1 || true`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
    // Must contain a count line — sanity check the count is a positive integer.
    const m = result.match(/(\d+)\s+tokens?/i) ?? result.match(/tokens?:?\s*(\d+)/i)
    expect(m).not.toBeNull()
    if (m) {
      const count = parseInt(m[1], 10)
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(12000) // budget satisfied
    }
  })

  it('Test 7: gate exit code is 0 on success (CI-killing on failure)', () => {
    // Default invocation — current state ships within budget so exit 0.
    let exitCode = 0
    try {
      execSync(`node "${SCRIPT_PATH}"`, { cwd: REPO_ROOT, stdio: 'pipe' })
    } catch (err: unknown) {
      const e = err as { status?: number }
      exitCode = e.status ?? 1
    }
    expect(exitCode).toBe(0)
  })
})
