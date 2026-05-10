// Phase 74 Plan 01 (STYLESPEC-10, PARITY-03):
// Zod validator + per-call silent-drop counter for the StyleSpec ingest
// boundary. THE primary architectural defense for v2.13 against:
//   1. Legal exposure — closed enums prevent reference_artist free-text.
//   2. Prompt-injection-via-image-text — catchall(z.never()) on every
//      object prevents adversarial directive payloads from smuggling
//      through unknown fields (PITFALLS Pitfall 3).
//
// MIRROR pattern: src/lib/ai/schemas.ts parseDecorationsArraySafe (Phase 67
// DECOR-05). DIFFERENCE: this validator counts silent drops (PARITY-03)
// whereas decorations parser was uncounted.
//
// Strategy:
//   1. Per-field walker visits the input recursively, increments counter
//      per stripped field/value (granular telemetry — NOT one-per-call).
//   2. Returns a CLEANED candidate object with all unknown fields/values
//      stripped + voice_note sanitized.
//   3. Runs StyleSpecSchema.safeParse on the cleaned candidate; on any
//      remaining failure, returns ok:false + the counter so callers can
//      forensic-trace what was dropped.
//
// Phase 75 (extract-style-spec.ts) will consume:
//   const counter = createSilentDropCounter({ onDrop: emitTelemetry })
//   const result = parseStyleSpecSafe(geminiRawJson, { counter })
//   if (!result.ok) throw new StyleExtractionError(...)
//   const validated: StyleSpec = result.spec

import { z } from 'zod'

import type { StyleSpec } from '@/lib/types/style-spec'
import { STYLE_SPEC_VERSION } from '@/lib/types/style-spec'
import {
  createSilentDropCounter,
  type SilentDropCounter,
} from './silent-drop-counter'

import { FONT_CATALOG, type FontEntry } from '@/lib/fonts/font-catalog'
import {
  LUCIDE_DECORATION_ALLOWLIST,
  type LucideDecorationName,
} from '@/lib/render/decorations/registry'

// =====================================================================
// Closed-enum source-of-truth tuples — derived from existing modules.
// =====================================================================

const FONT_CATEGORIES = ['sans-serif', 'serif', 'display', 'handwriting'] as const satisfies readonly FontEntry['category'][]

const SHAPE_KINDS = [
  'rect', 'circle', 'ellipse', 'triangle',
  'polygon', 'star', 'arrow', 'line',
] as const

const TEXT_POSITIONS = ['top', 'center', 'bottom'] as const

const TREATMENT_KINDS = [
  'bw', 'duotone-cream', 'duotone-cobalt', 'contrast-bump',
] as const

const PALETTE_MODES = ['solid', 'duotone', 'gradient', 'photo'] as const
const LAYOUT_DENSITIES = ['tight', 'medium', 'airy'] as const
const DECORATION_DENSITIES = ['sparse', 'moderate', 'dense'] as const
const RHYTHM_CADENCES = ['punchy', 'flowing', 'sparse'] as const

const FONT_CATEGORY_SET: ReadonlySet<string> = new Set(FONT_CATEGORIES)
const SHAPE_KIND_SET: ReadonlySet<string> = new Set(SHAPE_KINDS)
const TEXT_POSITION_SET: ReadonlySet<string> = new Set(TEXT_POSITIONS)
const TREATMENT_KIND_SET: ReadonlySet<string> = new Set(TREATMENT_KINDS)
const PALETTE_MODE_SET: ReadonlySet<string> = new Set(PALETTE_MODES)
const LAYOUT_DENSITY_SET: ReadonlySet<string> = new Set(LAYOUT_DENSITIES)
const DECORATION_DENSITY_SET: ReadonlySet<string> = new Set(DECORATION_DENSITIES)
const RHYTHM_CADENCE_SET: ReadonlySet<string> = new Set(RHYTHM_CADENCES)
const LUCIDE_ALLOWLIST_SET: ReadonlySet<string> = new Set(LUCIDE_DECORATION_ALLOWLIST)

// Touch FONT_CATALOG to keep the dependency import alive (the closed enum
// derivation is the 4 categories; FONT_CATALOG is the canonical source).
void FONT_CATALOG.length

// =====================================================================
// Hex color regex — mirror src/lib/ai/schemas.ts HexColorSchema (WR-02).
// =====================================================================

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/
const HexColorSchema = z.string().regex(HEX_COLOR_RE, {
  message: 'Color must be hex format (#rrggbb or #rrggbbaa)',
})

// =====================================================================
// StyleSpecSchema — Zod schema mirroring StyleSpec.
// EVERY object MUST end with .catchall(z.never()) so unknown keys reaching
// safeParse fail loudly. The walker pre-strips unknowns into the counter
// BEFORE safeParse, so by the time safeParse runs the input is clean.
// catchall(z.never()) is the belt-AND-suspenders defense.
// =====================================================================

const PaletteSchema = z.object({
  mode: z.enum(PALETTE_MODES),
  primary: HexColorSchema,
  secondary: HexColorSchema.optional(),
  accent: HexColorSchema.optional(),
}).catchall(z.never())

const TypographySchema = z.object({
  hookFontCategory: z.enum(FONT_CATEGORIES).optional(),
  bodyFontCategory: z.enum(FONT_CATEGORIES).optional(),
}).catchall(z.never())

const LayoutSchema = z.object({
  hookPosition: z.enum(TEXT_POSITIONS).optional(),
  density: z.enum(LAYOUT_DENSITIES).optional(),
}).catchall(z.never())

const ImagerySchema = z.object({
  treatmentPreset: z.enum(TREATMENT_KINDS).optional(),
}).catchall(z.never())

const DecorationsSchema = z.object({
  preferredLucide: z.array(
    z.enum(LUCIDE_DECORATION_ALLOWLIST as unknown as [string, ...string[]]),
  ).optional(),
  preferredShapes: z.array(z.enum(SHAPE_KINDS)).optional(),
  density: z.enum(DECORATION_DENSITIES).optional(),
}).catchall(z.never())

const RhythmSchema = z.object({
  cadence: z.enum(RHYTHM_CADENCES).optional(),
}).catchall(z.never())

export const StyleSpecSchema = z.object({
  schema_version: z.literal(STYLE_SPEC_VERSION),
  palette: PaletteSchema,
  typography: TypographySchema,
  layout: LayoutSchema,
  imagery: ImagerySchema,
  decorations: DecorationsSchema,
  rhythm: RhythmSchema,
  voice_note: z.string().optional(),
}).catchall(z.never())

export type StyleSpecParsed = z.infer<typeof StyleSpecSchema>

// =====================================================================
// Per-section closed-enum gate descriptors used by the walker.
// =====================================================================

interface ScalarFieldGate {
  type: 'scalar-enum'
  set: ReadonlySet<string>
}

interface ArrayFieldGate {
  type: 'array-enum'
  set: ReadonlySet<string>
}

type FieldGate = ScalarFieldGate | ArrayFieldGate

const SECTION_GATES: Record<string, Record<string, FieldGate>> = {
  palette: {
    mode: { type: 'scalar-enum', set: PALETTE_MODE_SET },
  },
  typography: {
    hookFontCategory: { type: 'scalar-enum', set: FONT_CATEGORY_SET },
    bodyFontCategory: { type: 'scalar-enum', set: FONT_CATEGORY_SET },
  },
  layout: {
    hookPosition: { type: 'scalar-enum', set: TEXT_POSITION_SET },
    density: { type: 'scalar-enum', set: LAYOUT_DENSITY_SET },
  },
  imagery: {
    treatmentPreset: { type: 'scalar-enum', set: TREATMENT_KIND_SET },
  },
  decorations: {
    preferredLucide: { type: 'array-enum', set: LUCIDE_ALLOWLIST_SET },
    preferredShapes: { type: 'array-enum', set: SHAPE_KIND_SET },
    density: { type: 'scalar-enum', set: DECORATION_DENSITY_SET },
  },
  rhythm: {
    cadence: { type: 'scalar-enum', set: RHYTHM_CADENCE_SET },
  },
}

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'schema_version', 'palette', 'typography', 'layout',
  'imagery', 'decorations', 'rhythm', 'voice_note',
])

// =====================================================================
// voice_note sanitization helpers.
// Each transformation that CHANGES the string increments the counter
// once with reason: 'sanitization'. We compute the final string then
// emit at most ONE event (per the granular-per-field rule, voice_note is
// a single field — the increment count is per-field, so 1 event covers
// all sanitization steps that touched it).
// =====================================================================

// Strip script/style blocks ENTIRELY (tag + contents) before stripping
// remaining tags — defense against XSS-like payloads embedded in voice_note.
// PITFALLS Pitfall 3: assume reference image text + voice_note are
// adversarial input.
const HTML_BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi
const HTML_TAG_RE = /<[^>]*>/g
const WHITESPACE_RE = /\s+/g

function sanitizeVoiceNote(input: unknown): { value: string | undefined; changed: boolean } {
  if (input === undefined || input === null) return { value: undefined, changed: false }
  if (typeof input !== 'string') {
    // Non-string voice_note is a sanitization event — coerce to '' and drop.
    return { value: undefined, changed: true }
  }
  let s = input
  s = s.replace(HTML_BLOCK_RE, '')          // strip <script>...</script> + <style>...</style>
  s = s.replace(HTML_TAG_RE, '')            // strip remaining HTML tags
  s = s.replace(WHITESPACE_RE, ' ').trim()  // collapse whitespace + trim
  if (s.length > 200) s = s.slice(0, 200)   // length cap
  return { value: s, changed: s !== input }
}

// =====================================================================
// Per-field walker — strips unknowns + bad enum values; emits granular
// counter events.
// =====================================================================

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cleanSection(
  sectionName: string,
  raw: unknown,
  counter: SilentDropCounter,
): Record<string, unknown> {
  if (!isPlainObject(raw)) return {}
  const gates = SECTION_GATES[sectionName] ?? {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const gate = gates[key]
    if (!gate) {
      // No gate → either the field is freely typed (e.g. palette.primary
      // hex string) OR it's an unknown field. We only know the gated keys;
      // anything not in the schema's known surface is an unknown_field.
      if (KNOWN_SECTION_FIELDS[sectionName]?.has(key)) {
        // Known but ungated (e.g. palette.primary, palette.secondary, palette.accent).
        out[key] = value
      } else {
        counter.increment({
          field: `${sectionName}.${key}`,
          reason: 'unknown_field',
          raw_value: value,
          schema_version: STYLE_SPEC_VERSION,
        })
      }
      continue
    }
    if (gate.type === 'scalar-enum') {
      if (typeof value === 'string' && gate.set.has(value)) {
        out[key] = value
      } else {
        counter.increment({
          field: `${sectionName}.${key}`,
          reason: 'unknown_enum_value',
          raw_value: value,
          schema_version: STYLE_SPEC_VERSION,
        })
        // Drop: omit from out.
      }
    } else {
      // array-enum
      if (!Array.isArray(value)) {
        counter.increment({
          field: `${sectionName}.${key}`,
          reason: 'unknown_enum_value',
          raw_value: value,
          schema_version: STYLE_SPEC_VERSION,
        })
        continue
      }
      const cleaned: string[] = []
      value.forEach((entry, idx) => {
        if (typeof entry === 'string' && gate.set.has(entry)) {
          cleaned.push(entry)
        } else {
          counter.increment({
            field: `${sectionName}.${key}[${idx}]`,
            reason: 'unknown_enum_value',
            raw_value: entry,
            schema_version: STYLE_SPEC_VERSION,
          })
        }
      })
      out[key] = cleaned
    }
  }
  return out
}

const KNOWN_SECTION_FIELDS: Record<string, ReadonlySet<string>> = {
  palette: new Set(['mode', 'primary', 'secondary', 'accent']),
  typography: new Set(['hookFontCategory', 'bodyFontCategory']),
  layout: new Set(['hookPosition', 'density']),
  imagery: new Set(['treatmentPreset']),
  decorations: new Set(['preferredLucide', 'preferredShapes', 'density']),
  rhythm: new Set(['cadence']),
}

// =====================================================================
// parseStyleSpecSafe — public entry point.
// =====================================================================

export type ParseStyleSpecResult =
  | { ok: true; spec: StyleSpec; counter: SilentDropCounter }
  | { ok: false; counter: SilentDropCounter; error: z.ZodError }

export function parseStyleSpecSafe(
  input: unknown,
  opts?: { counter?: SilentDropCounter },
): ParseStyleSpecResult {
  const counter = opts?.counter ?? createSilentDropCounter()

  if (!isPlainObject(input)) {
    counter.increment({
      field: '<root>',
      reason: 'parse_error',
      raw_value: input,
      schema_version: STYLE_SPEC_VERSION,
    })
    // Build a synthetic ZodError for the contract.
    const fakeResult = StyleSpecSchema.safeParse(input)
    return {
      ok: false,
      counter,
      error: !fakeResult.success ? fakeResult.error : new z.ZodError([]),
    }
  }

  const cleaned: Record<string, unknown> = {}

  // Top-level: walk every key. Unknown top-level keys → counter +
  // dropped (THIS IS THE CORE INJECTION DEFENSE).
  for (const key of Object.keys(input)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      counter.increment({
        field: key,
        reason: 'unknown_field',
        raw_value: input[key],
        schema_version: STYLE_SPEC_VERSION,
      })
    }
  }

  // schema_version: enforce literal 1; mismatch → drop + record + fall
  // back to STYLE_SPEC_VERSION.
  const rawVersion = input['schema_version']
  if (rawVersion !== STYLE_SPEC_VERSION) {
    counter.increment({
      field: 'schema_version',
      reason: 'unknown_enum_value',
      raw_value: rawVersion,
      schema_version: STYLE_SPEC_VERSION,
    })
  }
  cleaned.schema_version = STYLE_SPEC_VERSION

  // Each section: clean per-field, populate output.
  for (const section of ['palette', 'typography', 'layout', 'imagery', 'decorations', 'rhythm'] as const) {
    cleaned[section] = cleanSection(section, input[section], counter)
  }

  // voice_note sanitization.
  if ('voice_note' in input) {
    const { value, changed } = sanitizeVoiceNote(input['voice_note'])
    if (changed) {
      counter.increment({
        field: 'voice_note',
        reason: 'sanitization',
        raw_value: input['voice_note'],
        schema_version: STYLE_SPEC_VERSION,
      })
    }
    if (value !== undefined) {
      cleaned.voice_note = value
    }
  }

  // Final safeParse — if even after cleaning we don't satisfy the schema
  // (e.g. palette.primary missing or not hex), fail loudly via the result.
  const result = StyleSpecSchema.safeParse(cleaned)
  if (!result.success) {
    counter.increment({
      field: '<schema>',
      reason: 'parse_error',
      raw_value: result.error.message,
      schema_version: STYLE_SPEC_VERSION,
    })
    return { ok: false, counter, error: result.error }
  }

  // result.data conforms to StyleSpecParsed which equals StyleSpec at the
  // type level (interface ↔ z.infer<typeof StyleSpecSchema>).
  return { ok: true, spec: result.data as unknown as StyleSpec, counter }
}

// Re-export the lucide name type for downstream consumers (Phase 75).
export type { LucideDecorationName }
