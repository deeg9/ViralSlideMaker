// Phase 74 Plan 01 Task 3 (PARITY-05):
// Contract tests for the closed-enum grep gate. Verifies:
//   - clean checkout exits 0 (G1)
//   - production source containing a forbidden token exits 1 (G2)
//   - the same token in a comment does NOT trip the gate (G3)
//   - the same token in a test file does NOT trip the gate (G4)
//   - package.json wires the gate via the lint:gates script (G5)
//
// Each test that creates a temp file uses try/finally for guaranteed
// cleanup (so a single test failure does not leave a fixture lying around
// to break subsequent runs).

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync, readFileSync, mkdirSync, rmdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const SCRIPT_PATH = resolve(REPO_ROOT, 'scripts/grep-gates/closed-enum-styleSpec.sh')

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

function withTempSrcFile(relPath: string, contents: string, fn: () => void): void {
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

describe('Phase 74 (PARITY-05): closed-enum-styleSpec.sh grep gate', () => {
  it('Test G1: clean checkout exits 0 + emits the success line', () => {
    const { exitCode, stdout } = runGate()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('PARITY-05')
    expect(stdout).toContain('zero free-text closed-enum violations')
  })

  it('Test G2: production source containing a forbidden token exits 1 + names the file', () => {
    const fixturePath = 'src/__forbidden_test_fixture__.ts'
    withTempSrcFile(fixturePath, "export const x = 'reference_artist'\n", () => {
      const { exitCode, stderr } = runGate()
      expect(exitCode).toBe(1)
      expect(stderr).toContain('PARITY-05 closed-enum gate FAILED')
      expect(stderr).toContain('__forbidden_test_fixture__')
    })
  })

  it('Test G3: same token in a comment does NOT trip the gate', () => {
    const fixturePath = 'src/__commented_test_fixture__.ts'
    withTempSrcFile(
      fixturePath,
      '// reference_artist is forbidden by PARITY-05\nexport const y = 1\n',
      () => {
        const { exitCode } = runGate()
        expect(exitCode).toBe(0)
      },
    )
  })

  it('Test G4: same token in a test file is excluded from the gate', () => {
    const fixturePath = 'src/__tests__/__test_fixture__.test.ts'
    withTempSrcFile(
      fixturePath,
      "export const z = 'reference_artist'\n",
      () => {
        const { exitCode } = runGate()
        expect(exitCode).toBe(0)
      },
    )
  })

  it('Test G5: package.json lint:gates script invokes this gate', () => {
    const pkgPath = resolve(REPO_ROOT, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['lint:gates']).toBeDefined()
    expect(pkg.scripts['lint:gates']).toContain('closed-enum-styleSpec.sh')
  })
})
