'use client'

// Phase 76 Plan 02 (PREVIEW-05):
// Pure display component — single-line caption with the sanitized voice_note.
// Renders null when voice_note is undefined (no empty caption row).
//
// Defense in depth: even though Phase 74's Zod validator HTML-strips and
// single-lines voice_note, this component applies CSS truncate + nowrap so
// any future schema drift cannot leak a multi-line render into the panel.
//
// Copy: prefix label "Style notes:" — zero forbidden mimicry-framing tokens.

export interface VoiceNoteCaptionProps {
  voiceNote?: string
}

export function VoiceNoteCaption({ voiceNote }: VoiceNoteCaptionProps) {
  if (!voiceNote) return null

  return (
    <p
      data-testid="voice-note-caption"
      className="flex items-baseline gap-2 text-[13px] text-[#3d0000]"
    >
      <span
        data-testid="voice-note-label"
        className="shrink-0 font-semibold"
      >
        Style notes:
      </span>
      <span
        data-testid="voice-note-value"
        className="truncate whitespace-nowrap italic"
        style={{ whiteSpace: 'nowrap' }}
        title={voiceNote}
      >
        {voiceNote}
      </span>
    </p>
  )
}
