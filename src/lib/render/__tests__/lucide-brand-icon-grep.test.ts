import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Phase 67 (DEPS-01): brand-icon grep gate.
 *
 * Lucide v1.0.0 removed all brand icons (corporate logos) from the package
 * because of trademark concerns; only generic glyphs ship in v1+. If any
 * production code in src/ tries to import a removed brand icon from
 * 'lucide-react', the build will fail post-upgrade — but TypeScript may
 * surface that as a non-obvious error message. This grep gate fails fast
 * with a clear list of offenders.
 *
 * Reference: lucide-icons/lucide v1 release notes; CONTEXT.md decision.
 */

// Removed-in-v1 brand-icon set (sample — covers the most likely accidental imports).
// Add entries if a brand icon survives the cut and gets imported anyway.
const REMOVED_BRAND_ICONS = [
  'Github',
  'Slack',
  'Figma',
  'Twitter',
  'Facebook',
  'Linkedin',
  'Youtube',
  'Apple',
  'Chrome',
  'Trello',
  'Dribbble',
  'Gitlab',
  'Codepen',
  'Codesandbox',
] as const

const REPO_ROOT = resolve(__dirname, '../../../..')
const SRC_DIR = resolve(REPO_ROOT, 'src')

// Path of THIS test file — excluded from scans because the test itself contains
// example import strings (e.g. "import { A, B, Github, C } from 'lucide-react'")
// inside its own comments / string literals that would otherwise self-match.
const SELF_PATH = resolve(__dirname, 'lucide-brand-icon-grep.test.ts')

function grepImports(needle: string): string[] {
  // grep -rE 'from .lucide-react.' src/ — narrow to lucide-react import lines first,
  // then filter for the icon name. Use try/catch since grep exits 1 on no matches.
  try {
    const out = execSync(
      `grep -rE "from ['\\\"]lucide-react['\\\"]" "${SRC_DIR}" --include="*.ts" --include="*.tsx" -l`,
      { encoding: 'utf8' },
    )
    const files = out
      .split('\n')
      .filter(Boolean)
      .filter((f) => f !== SELF_PATH) // exclude the test file itself
    const offenders: string[] = []
    for (const f of files) {
      const content = readFileSync(f, 'utf8')
      // Find the lucide-react import block(s) and check for the needle.
      // Match patterns like:  import { A, B, Github, C } from 'lucide-react'
      // Multi-line imports captured via [\s\S]* (works without the dotall 's' flag,
      // which requires ES2018+ regex target — our tsconfig is older).
      const importBlocks =
        content.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]lucide-react['"]/g) ?? []
      for (const block of importBlocks) {
        const re = new RegExp(`\\b${needle}\\b`)
        if (re.test(block)) {
          offenders.push(`${f}: imports ${needle}`)
        }
      }
    }
    return offenders
  } catch (err: unknown) {
    // grep exits 1 when no matches — that's a clean state for our gate.
    const stderr =
      err && typeof err === 'object' && 'stderr' in err
        ? String((err as { stderr: unknown }).stderr)
        : ''
    if (stderr.includes('No such file')) throw err
    return []
  }
}

describe('Phase 67 (DEPS-01): lucide-react v1 brand-icon grep gate', () => {
  it('Test 1: zero removed-brand-icons imported from lucide-react in src/', () => {
    const allOffenders: string[] = []
    for (const name of REMOVED_BRAND_ICONS) {
      const offenders = grepImports(name)
      allOffenders.push(...offenders)
    }
    expect(allOffenders).toEqual([])
  })

  it('Test 2: package.json declares lucide-react at ^1.x', () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'))
    const ver: string = pkg.dependencies['lucide-react']
    expect(ver).toMatch(/^\^1\./)
  })

  it('Test 3 (positive control): the grep methodology finds at least one real lucide-react import in src/', () => {
    // Sanity: if Test 1 passes because grep is silently broken, Test 3
    // would also pass with zero matches and we'd ship a false-green gate.
    // Pin a known-imported icon (Check is used in subscription/pricing pages,
    // verified at plan time). If this test fails, the grep methodology is broken.
    const checkOffenders = grepImports('Check')
    expect(checkOffenders.length).toBeGreaterThan(0)
  })

  it('Test 4 (typecheck smoke): the upgraded lucide-react resolves cleanly', () => {
    // Indirect smoke — `npx tsc --noEmit` runs in the verify gate of this task.
    // This test inline asserts that the package can be `require`d without throwing.
    expect(() => require.resolve('lucide-react')).not.toThrow()
  })
})
