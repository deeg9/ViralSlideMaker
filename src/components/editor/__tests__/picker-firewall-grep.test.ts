import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Phase 70 Plan 03 (PICKER-07 + KBD-12): structural grep audit for the
 * isPickerOpenRef firewall sweep across slide-editor.tsx.
 *
 * Mirrors the v2.11 SWEEP-1..4 grep gates (slide-editor.keyboard-sweep.test.tsx)
 * — codifies the manual-grep contract from the plan as automated regression
 * tests so v2.12+ refactors that add a NEW tinykeys binding without the
 * paired isPickerOpenRef short-circuit FAIL CI on the next commit.
 *
 * Audit invariants:
 *   1. isPickerOpenRef.current appears at least 33 times in non-comment code
 *      (32 existing tinykeys binding sites swept + 5 new R/C/L/I/S = 37
 *      binding-body mentions; we use 33 as a conservative floor matching
 *      the plan's "33 sites" inventory).
 *   2. Every non-comment isEditingTarget(e.target) call lives on the same
 *      line as `|| isPickerOpenRef.current` — prevents a future binding
 *      from reusing the single-firewall pattern.
 *   3. Every non-comment isPickerOpenRef.current mention is part of an
 *      OR-chain with an isEditingTarget(e.target) call OR is the ref's
 *      declaration / synchronous setter — prevents drift where a binding
 *      checks the ref but forgets the editing-target firewall.
 *   4. Count of isPickerOpenRef.current >= count of isEditingTarget(e.target)
 *      — strict pairing invariant.
 *
 * Comment-strip pattern matches v2.11 PCL gate (block-comment + line-comment
 * heuristic — same pattern as Plan 65-03 / Plan 68-03 PRA gates).
 */

const FILE = resolve(__dirname, '../slide-editor.tsx')
const SRC = readFileSync(FILE, 'utf8')

// Lines that begin with `//` or block-comment continuation `*` (after any
// leading whitespace). Same heuristic as v2.11 SWEEP — conservative enough
// to strip JSDoc + inline rationale comments without false-positive on real
// code (no real binding body line starts with `*`).
const NON_COMMENT = SRC.split('\n')
  .filter((line) => !/^\s*(\/\/|\*)/.test(line))
  .join('\n')

describe('Phase 70 Plan 03 PICKER-07 — slide-editor.tsx firewall sweep grep audit', () => {
  it('SWEEP-PICK-GREP-1: isPickerOpenRef.current appears at least 33 times in non-comment code', () => {
    const matches = NON_COMMENT.match(/isPickerOpenRef\.current/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(33)
  })

  it('SWEEP-PICK-GREP-2: every non-comment isEditingTarget(e.target) call is paired with isPickerOpenRef.current on the same line', () => {
    const lines = NON_COMMENT.split('\n')
    const orphans = lines.filter(
      (line) =>
        /isEditingTarget\(e\.target\)/.test(line) &&
        !/isPickerOpenRef\.current/.test(line),
    )
    expect(
      orphans,
      `Orphan firewall sites (missing || isPickerOpenRef.current):\n${orphans.join('\n')}`,
    ).toEqual([])
  })

  it('SWEEP-PICK-GREP-3: every non-comment isPickerOpenRef.current usage is part of an OR-chain with isEditingTarget OR is the ref declaration/setter', () => {
    const lines = NON_COMMENT.split('\n')
    const orphans = lines.filter((line) => {
      if (!/isPickerOpenRef\.current/.test(line)) return false
      // Allowed contexts:
      //   - paired with isEditingTarget on same line (binding-body firewall)
      //   - the ref declaration: `useRef<boolean>(false)`
      //   - the synchronous setter inside setOpenPicker: `isPickerOpenRef.current = ...`
      if (/isEditingTarget/.test(line)) return false
      if (/useRef<boolean>/.test(line)) return false
      if (/isPickerOpenRef\.current\s*=/.test(line)) return false
      return true
    })
    expect(
      orphans,
      `Orphan isPickerOpenRef.current sites (not paired with isEditingTarget and not ref declaration/setter):\n${orphans.join('\n')}`,
    ).toEqual([])
  })

  it('SWEEP-PICK-GREP-4: count of isPickerOpenRef.current >= count of isEditingTarget(e.target) calls', () => {
    const pickerCount = (NON_COMMENT.match(/isPickerOpenRef\.current/g) ?? []).length
    const editingCount = (
      NON_COMMENT.match(/isEditingTarget\(e\.target\)/g) ?? []
    ).length
    expect(pickerCount).toBeGreaterThanOrEqual(editingCount)
  })

  it('SWEEP-PICK-GREP-5: imports isEditingTarget from keyboard-utils', () => {
    expect(SRC).toMatch(/import\s*\{\s*isEditingTarget\s*\}\s*from\s*['"]@\/lib\/editor\/keyboard-utils['"]/)
  })

  it('SWEEP-PICK-GREP-6: declares isPickerOpenRef = useRef<boolean>(false)', () => {
    expect(SRC).toMatch(/isPickerOpenRef\s*=\s*useRef<boolean>\(\s*false\s*\)/)
  })
})
