// -----------------------------------------------------------------------------
// Quick task 260515-8xx — reactive overlap-prevention pass for AI-emitted text boxes.
//
// Pure unit tests. No React, no DOM, no I/O.
//
// Covers the 6 cases enumerated in 260515-8xx-PLAN.md task 1 plus an
// integration-style assertion (Task 2) that runs the helper against a literal
// shape mimicking the Meta-workers `legacyToTextBoxes` repro output.
// -----------------------------------------------------------------------------

import { describe, test, expect } from 'vitest'
import type { TextBox } from '@/lib/types/slide'
import {
  separateOverlappingTextBoxes,
  estimateTextBoxHeightPct,
} from '@/lib/editor/separate-overlapping-text-boxes'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCustomTextBox(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  extras: Partial<TextBox> = {},
): TextBox {
  return {
    id,
    role: 'custom',
    text,
    position: { anchor: 'custom', x, y, width },
    ...extras,
  }
}

function makeStructuralTextBox(
  id: string,
  role: 'hook' | 'body' | 'custom',
  text: string,
  anchor: 'top' | 'center' | 'bottom',
  extras: Partial<TextBox> = {},
): TextBox {
  return {
    id,
    role,
    text,
    position: { anchor },
    ...extras,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// estimateTextBoxHeightPct
// ─────────────────────────────────────────────────────────────────────────────

describe('estimateTextBoxHeightPct', () => {
  test('returns >0 for non-empty text', () => {
    const tb = makeCustomTextBox('t', 'Hello world', 20, 10, 60, { font_size: 64 })
    const h = estimateTextBoxHeightPct(tb)
    expect(h).toBeGreaterThan(0)
  })

  test('multi-line text wraps and reports a larger height than single-line', () => {
    const short = makeCustomTextBox('s', 'Hi', 20, 10, 60, { font_size: 64 })
    const long = makeCustomTextBox(
      'l',
      'This is a substantially longer string that will absolutely have to wrap onto multiple lines at narrow widths.',
      20,
      10,
      60,
      { font_size: 80 },
    )
    expect(estimateTextBoxHeightPct(long)).toBeGreaterThan(
      estimateTextBoxHeightPct(short),
    )
  })

  test('honors a custom canvas size + line-height + char-width factor', () => {
    const tb = makeCustomTextBox('t', 'one two three', 20, 10, 60, { font_size: 100 })
    const h = estimateTextBoxHeightPct(tb, {
      canvasWidthPx: 1080,
      canvasHeightPx: 1920,
      lineHeight: 1.2,
      avgCharWidthFactor: 0.55,
    })
    // sanity bound: a single line at 100px / 1920px ≈ 5.2% × line-height 1.2 ≈ 6.25%
    expect(h).toBeGreaterThan(5)
    expect(h).toBeLessThan(15)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// separateOverlappingTextBoxes — behavioral tests
// ─────────────────────────────────────────────────────────────────────────────

describe('separateOverlappingTextBoxes', () => {
  test('Test 1 — non-overlapping pair stays put', () => {
    const a = makeCustomTextBox('a', 'Hi', 20, 10, 60, { font_size: 48 })
    const b = makeCustomTextBox('b', 'Bye', 20, 70, 60, { font_size: 48 })

    const out = separateOverlappingTextBoxes([a, b])
    expect(out).toHaveLength(2)
    expect(out[0].position.y).toBeCloseTo(10, 9)
    expect(out[1].position.y).toBeCloseTo(70, 9)
  })

  test('Test 2 — overlapping pair: lower box pushed down', () => {
    const a = makeCustomTextBox(
      'a',
      'A multi-line headline that wraps several times. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.',
      20,
      20,
      60,
      { font_size: 80 },
    )
    const b = makeCustomTextBox('b', 'Short', 20, 30, 60, { font_size: 48 })

    const hA = estimateTextBoxHeightPct(a)
    // sanity: A's height should comfortably exceed 10% (the y-gap to B)
    expect(hA).toBeGreaterThan(10)

    const out = separateOverlappingTextBoxes([a, b])
    expect(out).toHaveLength(2)

    // A stays put
    expect(out[0].position.y).toBeCloseTo(20, 9)
    // B is pushed at LEAST to A.y + estimated(A) + default-gap(1)
    expect(out[1].position.y).toBeGreaterThanOrEqual(20 + hA + 1 - 1e-9)
  })

  test('Test 3 — three stacked overlapping boxes — all separated', () => {
    const a = makeCustomTextBox(
      'a',
      'AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA',
      20,
      10,
      60,
      { font_size: 64 },
    )
    const b = makeCustomTextBox(
      'b',
      'BBBB BBBB BBBB BBBB BBBB BBBB BBBB BBBB BBBB BBBB BBBB',
      20,
      12,
      60,
      { font_size: 56 },
    )
    const c = makeCustomTextBox(
      'c',
      'CCCC CCCC CCCC CCCC CCCC CCCC CCCC',
      20,
      15,
      60,
      { font_size: 48 },
    )

    const out = separateOverlappingTextBoxes([a, b, c])
    expect(out).toHaveLength(3)

    // Adjacent-pair non-overlap check (sorted by final y)
    const sorted = [...out].sort(
      (x, y) => (x.position.y ?? 0) - (y.position.y ?? 0),
    )
    for (let i = 0; i < sorted.length - 1; i++) {
      const top = sorted[i].position.y ?? 0
      const bottom = top + estimateTextBoxHeightPct(sorted[i])
      const nextTop = sorted[i + 1].position.y ?? 0
      expect(nextTop).toBeGreaterThanOrEqual(bottom - 1e-9)
    }
  })

  test('Test 4 — structural hook+body anchor=bottom (Meta-workers repro)', () => {
    const hook = makeStructuralTextBox(
      'hook',
      'hook',
      "TRUMP'S SHOCKING CHIP DEAL THAT NOBODY SAW COMING",
      'bottom',
      { font_size: 96 },
    )
    const body = makeStructuralTextBox(
      'body',
      'body',
      'EXPOSED!',
      'bottom',
      { font_size: 64 },
    )

    const out = separateOverlappingTextBoxes([hook, body])
    expect(out).toHaveLength(2)

    const outHook = out[0]
    const outBody = out[1]
    expect(outHook.position.anchor).toBe('custom')
    expect(outBody.position.anchor).toBe('custom')

    expect(outHook.position.x).toBeDefined()
    expect(outHook.position.y).toBeDefined()
    expect(outHook.position.width).toBeDefined()
    expect(outBody.position.x).toBeDefined()
    expect(outBody.position.y).toBeDefined()
    expect(outBody.position.width).toBeDefined()

    const hookY = outHook.position.y as number
    const bodyY = outBody.position.y as number
    const hookH = estimateTextBoxHeightPct(outHook)

    // Body sits below the (potentially adjusted) hook
    expect(bodyY).toBeGreaterThanOrEqual(hookY + hookH - 1e-9)

    // Both fit within the canvas (bottom <= 100)
    const bodyH = estimateTextBoxHeightPct(outBody)
    expect(bodyY + bodyH).toBeLessThanOrEqual(100 + 1e-9)
  })

  test('Test 5 — non-custom anchor on a custom-role box is left alone', () => {
    const tb: TextBox = {
      id: 'x',
      role: 'custom',
      text: 'Free-floating decoration text',
      position: { anchor: 'top' },
      font_size: 48,
    }
    const out = separateOverlappingTextBoxes([tb])
    expect(out).toHaveLength(1)
    // Pass-through: anchor stays 'top'; no x/y/width synthesized.
    expect(out[0].position.anchor).toBe('top')
    expect(out[0].position.x).toBeUndefined()
    expect(out[0].position.y).toBeUndefined()
    expect(out[0].position.width).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Purity / determinism
// ─────────────────────────────────────────────────────────────────────────────

describe('separateOverlappingTextBoxes — purity', () => {
  test('does not mutate input; running twice with the same input is deterministic', () => {
    const a = makeCustomTextBox('a', 'AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA', 20, 10, 60, { font_size: 80 })
    const b = makeCustomTextBox('b', 'BBBB', 20, 12, 60, { font_size: 48 })
    const inputs = [a, b]
    const snapshot = JSON.parse(JSON.stringify(inputs))

    const out1 = separateOverlappingTextBoxes(inputs)
    const out2 = separateOverlappingTextBoxes(inputs)

    // Inputs unchanged.
    expect(inputs).toEqual(snapshot)
    // Same inputs → deep-equal outputs.
    expect(out1).toEqual(out2)
    // Output is a different array reference than input.
    expect(out1).not.toBe(inputs)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration-style assertion (added in Task 2 — see PLAN)
// ─────────────────────────────────────────────────────────────────────────────

describe('separateOverlappingTextBoxes — integration shape (Meta-workers repro)', () => {
  test('hook + body both anchor=bottom emerge non-overlapping', () => {
    // Mimic the legacyToTextBoxes output for a Meta-workers caption-bar-bottom
    // slide whose style_overrides.text_position === 'bottom'. Both boxes share
    // the structural 'bottom' anchor.
    const fromAdapter: TextBox[] = [
      {
        id: 'hook-1',
        role: 'hook',
        text:
          "TRUMP'S SHOCKING CHIP DEAL THAT WILL SHAKE THE GLOBAL SEMICONDUCTOR INDUSTRY",
        font_size: 96,
        position: { anchor: 'bottom' },
      },
      {
        id: 'body-1',
        role: 'body',
        text: 'EXPOSED!',
        font_size: 64,
        position: { anchor: 'bottom' },
      },
    ]

    const out = separateOverlappingTextBoxes(fromAdapter)
    expect(out).toHaveLength(2)

    const hook = out[0]
    const body = out[1]
    expect(hook.position.anchor).toBe('custom')
    expect(body.position.anchor).toBe('custom')

    const hookY = hook.position.y as number
    const bodyY = body.position.y as number
    const hookH = estimateTextBoxHeightPct(hook)
    expect(bodyY).toBeGreaterThanOrEqual(hookY + hookH - 1e-9)
  })
})
