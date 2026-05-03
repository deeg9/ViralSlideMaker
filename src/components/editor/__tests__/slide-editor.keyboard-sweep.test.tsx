import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Phase 66 Plan 02 (KBD-08, KBD-04 carry-forward, KBD-02 carry-forward):
 * final v2.11 keyboard sweep — codifies the manual grep gates from Plan 66-02
 * as automated regression tests so v2.12+ refactors can't silently break the
 * shortcut firewall, the modifier-state-blur-reset wiring, or the disallowed
 * `e.metaKey || e.ctrlKey` anti-pattern.
 *
 * SWEEP-1: `grep -c "isEditingTarget(e.target)"` slide-editor.tsx returns 33
 *          (Plan 66-01 carry-forward; pre-Plan-66 baseline 25 + 8 new arrow
 *          bindings = 33; ARROW-GREP test in slide-editor.shortcuts.test.tsx
 *          already asserts >=33; this sweep gives a TIGHT floor for v2.12+).
 *
 * SWEEP-2: `grep -c "e.preventDefault()"` slide-editor.tsx returns >=25
 *          (every binding's preventDefault site; conservative floor).
 *
 * SWEEP-3: `grep -c "addEventListener.*(blur|visibilitychange)"`
 *          use-modifier-state.ts returns >=2 (Plan 60-04 KBD-04 contract —
 *          modifier flags reset on window-blur AND visibility-hide).
 *
 * SWEEP-4: `! grep "e\\.metaKey \\|\\| e\\.ctrlKey"` slide-editor.tsx —
 *          anti-pattern absent. Plan 60-04 replaced direct property reads
 *          with the `cmd: e.metaKey || e.ctrlKey` aliasing inside
 *          useModifierState; bindings then read `modifiers.get().cmd`.
 */

function readFile(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')
}

describe('Phase 66 Plan 02 — final v2.11 keyboard sweep', () => {
  it('SWEEP-1: isEditingTarget(e.target) firewall has at least 33 call sites in slide-editor.tsx', () => {
    const file = readFile('../slide-editor.tsx')
    const matches = file.match(/isEditingTarget\(e\.target\)/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(33)
  })

  it('SWEEP-2: e.preventDefault() appears at >=25 sites in slide-editor.tsx (one per binding)', () => {
    const file = readFile('../slide-editor.tsx')
    const matches = file.match(/e\.preventDefault\(\)/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(25)
  })

  it('SWEEP-3: useModifierState wires window blur + visibilitychange listeners (KBD-04 carry-forward)', () => {
    const file = readFile('../../../lib/editor/use-modifier-state.ts')
    // Two distinct listener types are required: blur AND visibilitychange.
    expect(file).toMatch(/addEventListener\(\s*['"]blur['"]/)
    expect(file).toMatch(/addEventListener\(\s*['"]visibilitychange['"]/)
  })

  it('SWEEP-4: anti-pattern `e.metaKey || e.ctrlKey` is absent from slide-editor.tsx (Plan 60-04)', () => {
    const file = readFile('../slide-editor.tsx')
    expect(file).not.toMatch(/e\.metaKey\s*\|\|\s*e\.ctrlKey/)
  })
})
