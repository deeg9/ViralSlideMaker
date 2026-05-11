// Phase 79 Plan 02 Task 4 (LEGAL-03 + PARITY-05):
// Contract tests for the final close-out grep gate that locks "Inspired by"
// framing across every v2.13 user-facing UI surface file.
//
// Surfaces in scope (per Phase 79 CONTEXT.md / Plan 79-02 grounding):
//   - src/components/style-from-reference/
//   - src/components/projects/
//   - src/app/(dashboard)/style-from-reference/
//   - src/app/(dashboard)/dashboard/page.tsx
//
// Forbidden tokens (the close-out list LEGAL-03 enforces):
//   exactly like, clone, copy this, duplicate the, stolen from, ripped from
//
// What this pins:
//   T1: clean checkout exits 0 + emits the success line
//   T2: a forbidden token introduced into a v2.13 UI surface file fails CI
//       and the failure output names the offending file
//   T3: the SAME token in a comment line does NOT trip the gate (mirrors
//       the closed-enum gate's self-invalidating-grep defense)
//   T4: the SAME token in a TEST file (anywhere in __tests__/) is excluded
//       (test fixtures legitimately list forbidden tokens to prove the
//       component does not output them — see e.g.
//       src/components/projects/__tests__/from-references-badge.test.tsx)
//   T5: the gate exits 0 with the success line when run on the current tree
//       (proves all surface files already use safe framing)
//   T6: package.json `lint:gates` script chains all THREE gates
//       (closed-enum + token-budget + inspired-by-framing) with `&&`
//   T7: a forbidden token in a file OUTSIDE the scoped surfaces (e.g. an
//       editor component or an unrelated lib file) is NOT flagged — the
//       gate intentionally narrows to the v2.13 surface to avoid false
//       positives in pre-existing UI

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import {
  writeFileSync,
  unlinkSync,
  existsSync,
  readFileSync,
  mkdirSync,
  rmdirSync,
} from 'node:fs'
import { resolve, dirname } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const SCRIPT_PATH = resolve(REPO_ROOT, 'scripts/grep-gates/inspired-by-framing.sh')

function runGate(): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`bash ${SCRIPT_PATH}`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    return { exitCode: 0, stdout, stderr: '' }
  } catch (err) {
    const e = err as { status: number; stdout?: Buffer | string; stderr?: Buffer | string }
    return {
      exitCode: e.status,
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? ''),
    }
  }
}

function withTempFile(relPath: string, contents: string, fn: () => void): void {
  const abs = resolve(REPO_ROOT, relPath)
  const dir = dirname(abs)
  let createdDir = false
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    createdDir = true
  }
  writeFileSync(abs, contents, 'utf8')
  try {
    fn()
  } finally {
    if (existsSync(abs)) unlinkSync(abs)
    if (createdDir) {
      try {
        rmdirSync(dir)
      } catch {
        // Directory not empty or already removed; ignore.
      }
    }
  }
}

describe('Phase 79 Plan 02 Task 4: inspired-by-framing.sh final grep gate (LEGAL-03 + PARITY-05)', () => {
  it('Test T1: clean checkout exits 0 + emits the success line', () => {
    const { exitCode, stdout } = runGate()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('PARITY-05')
    expect(stdout.toLowerCase()).toContain('zero forbidden framing tokens')
  })

  it('Test T2: forbidden token in a v2.13 surface file fails CI + names the file', () => {
    const fixturePath = 'src/components/style-from-reference/__forbidden_fixture__.tsx'
    withTempFile(
      fixturePath,
      "export const x = 'this looks exactly like the source'\n",
      () => {
        const { exitCode, stderr } = runGate()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('__forbidden_fixture__')
      },
    )
  })

  it('Test T3: same token in a COMMENT line does NOT trip the gate', () => {
    const fixturePath = 'src/components/style-from-reference/__commented_fixture__.tsx'
    withTempFile(
      fixturePath,
      '// "exactly like" is forbidden by LEGAL-03 — this comment is fine\nexport const y = 1\n',
      () => {
        const { exitCode } = runGate()
        expect(exitCode).toBe(0)
      },
    )
  })

  it('Test T4: same token in a __tests__/ file is excluded', () => {
    const fixturePath = 'src/components/style-from-reference/__tests__/__fixture__.test.ts'
    withTempFile(
      fixturePath,
      "export const z = 'exactly like'\n",
      () => {
        const { exitCode } = runGate()
        expect(exitCode).toBe(0)
      },
    )
  })

  it('Test T5: current tree passes the gate (success line present)', () => {
    const { exitCode, stdout } = runGate()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('PARITY-05 final close-out')
  })

  it('Test T6: package.json lint:gates chains all THREE gates with &&', () => {
    const pkgPath = resolve(REPO_ROOT, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      scripts: Record<string, string>
    }
    const lintGates = pkg.scripts['lint:gates']
    expect(lintGates).toBeDefined()
    expect(lintGates).toMatch(/closed-enum-styleSpec/)
    expect(lintGates).toMatch(/prompt-token-budget/)
    expect(lintGates).toMatch(/inspired-by-framing/)
    // All chained with && so any failure fails the script
    const ampCount = (lintGates.match(/&&/g) ?? []).length
    expect(ampCount).toBeGreaterThanOrEqual(2)
  })

  it('Test T7: forbidden token OUTSIDE scoped surfaces is NOT flagged (no false positives)', () => {
    // A v2.13-irrelevant editor file should be allowed to contain forbidden
    // tokens (we don't want to break unrelated existing UI). The gate is
    // intentionally narrow to the four surface paths.
    const fixturePath = 'src/components/editor/__off_surface_fixture__.tsx'
    withTempFile(
      fixturePath,
      "export const w = 'exactly like a real editor would'\n",
      () => {
        const { exitCode } = runGate()
        expect(exitCode).toBe(0)
      },
    )
  })
})
