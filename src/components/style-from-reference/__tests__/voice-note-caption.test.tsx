// Phase 76 Plan 02 (PREVIEW-05):
// VoiceNoteCaption single-line caption tests.
//
// 5 tests pin: render with text, null when undefined, single-line CSS even
// for newline-bearing input (defense in depth post-Phase 74 sanitization),
// "Style notes:" prefix label, and LEGAL-03 forward-compat grep on the
// component file.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { VoiceNoteCaption } from '../voice-note-caption'

describe('Phase 76 Plan 02: VoiceNoteCaption (PREVIEW-05)', () => {
  it('Test 1: renders the voice_note text in a single-line caption', () => {
    render(<VoiceNoteCaption voiceNote="Editorial, brutalist, big type" />)
    const caption = screen.getByTestId('voice-note-caption')
    expect(caption).toBeTruthy()
    expect(caption.textContent).toMatch(/Editorial, brutalist, big type/)
  })

  it('Test 2: voiceNote undefined → component renders null (no empty caption row)', () => {
    const { container } = render(<VoiceNoteCaption voiceNote={undefined} />)
    expect(container.querySelector('[data-testid="voice-note-caption"]')).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('Test 3: voiceNote with newlines stays single-line via white-space:nowrap + ellipsis CSS', () => {
    render(<VoiceNoteCaption voiceNote={'line one\nline two'} />)
    const caption = screen.getByTestId('voice-note-caption')
    // The value-bearing element carries the truncate styles
    const value = caption.querySelector('[data-testid="voice-note-value"]') as HTMLElement | null
    expect(value).toBeTruthy()
    const styleAttr = (value!.getAttribute('style') ?? '').toLowerCase()
    const className = value!.className.toLowerCase()
    expect(
      styleAttr.includes('white-space: nowrap') ||
        className.includes('whitespace-nowrap') ||
        className.includes('truncate'),
    ).toBe(true)
  })

  it('Test 4: prefix label "Style notes:" is rendered before the value', () => {
    render(<VoiceNoteCaption voiceNote="Bold magazine voice" />)
    const label = screen.getByTestId('voice-note-label')
    expect(label).toBeTruthy()
    expect(label.textContent).toMatch(/Style notes:/i)
  })

  it('Test 5: LEGAL-03 forward-compat — zero forbidden tokens in the component file', () => {
    const filePath = path.resolve(__dirname, '../voice-note-caption.tsx')
    const src = fs.readFileSync(filePath, 'utf-8')
    const forbidden = [/exactly\s+like/i, /\bclone\b/i, /copy\s+this\s+style/i, /\bduplicate\b/i]
    for (const re of forbidden) {
      const hits = (src.match(new RegExp(re.source, re.flags + 'g')) ?? []).length
      expect(hits, `forbidden token ${re} in voice-note-caption.tsx`).toBe(0)
    }
  })
})
