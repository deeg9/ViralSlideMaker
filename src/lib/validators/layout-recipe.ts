// Phase 84 Plan 02 (RECIPE-01):
// parseLayoutRecipeSafe — zod validation firewall for the LayoutRecipe
// model. Mirrors parseStyleSpecSafe (src/lib/validators/style-spec.ts).
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
//   1. Two-phase firewall: a per-field pre-clean walker strips unknown
//      keys + bad enum values + clamps numeric ranges BEFORE the final
//      safeParse runs. Every dropped/clamped field emits a granular
//      silent-drop counter event.
//   2. Every zod object ends with .catchall(z.never()) — belt-and-
//      suspenders prompt-injection defense (mirror the Phase 74 pattern).
//   3. Closed-enum silent-drop: an unrecognized enum value is dropped (or
//      defaulted), never errors the parse.
//   4. Numeric range clamp: caption-card geometry stays numeric; values
//      outside the validated range are clamped to the nearest bound (not
//      rejected) — losing precision is acceptable, losing the field is not.
//   5. A role may be entirely absent — a recipe with `roles: {}` or any
//      subset is valid. A missing role is never synthesized.
// =====================================================================
//
// DO NOT add free-text fields (reference_artist / reference_brand /
// copy_exactly / style_freetext) — the PARITY-05 CI grep gate WILL fail.

import { z } from 'zod'

import type { LayoutRecipe } from '@/lib/types/layout-recipe'
import {
  LAYOUT_RECIPE_VERSION,
  RECIPE_ROLES,
  HOOK_POSITION_BANDS,
  HOOK_FONT_SIZE_BANDS,
  RECIPE_TEXT_ALIGNS,
  CAPTION_POSITIONS,
  ACCENT_CADENCES,
  ACCESSORY_LABEL_BANDS,
  type RecipeRole,
} from '@/lib/types/layout-recipe'
import {
  SLIDE_ARCHETYPES,
  DEFAULT_FALLBACK_ARCHETYPE,
} from '@/lib/types/style-spec-archetypes'
import {
  createSilentDropCounter,
  type SilentDropCounter,
} from './silent-drop-counter'

// =====================================================================
// Closed-enum membership sets — O(1) silent-drop checks.
// =====================================================================

const SLIDE_ARCHETYPE_SET: ReadonlySet<string> = new Set(SLIDE_ARCHETYPES)
const HOOK_POSITION_BAND_SET: ReadonlySet<string> = new Set(HOOK_POSITION_BANDS)
const HOOK_FONT_SIZE_BAND_SET: ReadonlySet<string> = new Set(HOOK_FONT_SIZE_BANDS)
const RECIPE_TEXT_ALIGN_SET: ReadonlySet<string> = new Set(RECIPE_TEXT_ALIGNS)
const CAPTION_POSITION_SET: ReadonlySet<string> = new Set(CAPTION_POSITIONS)
const ACCENT_CADENCE_SET: ReadonlySet<string> = new Set(ACCENT_CADENCES)
const ACCESSORY_LABEL_BAND_SET: ReadonlySet<string> = new Set(ACCESSORY_LABEL_BANDS)

// =====================================================================
// Numeric range table for caption-card geometry. Clamp-on-parse — values
// outside the bound are clamped, never rejected.
// =====================================================================

const GEOMETRY_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  x: [0, 100],
  y: [0, 100],
  width: [0, 100],
  height_pct: [0, 100],
  blend_pct: [0, 50],
  opacity: [0, 1],
}

// =====================================================================
// zod schemas — every object terminated with .catchall(z.never()).
// Clamping happens in the pre-clean walker BEFORE safeParse; the schema
// only type-checks the cleaned candidate.
// =====================================================================

const CaptionCardGeometryZ = z
  .object({
    enabled: z.boolean(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height_pct: z.number(),
    blend_pct: z.number(),
    opacity: z.number(),
    position: z.enum(CAPTION_POSITIONS),
  })
  .catchall(z.never())

const HookPlacementZ = z
  .object({
    position_band: z.enum(HOOK_POSITION_BANDS),
    font_size_band: z.enum(HOOK_FONT_SIZE_BANDS),
    text_align: z.enum(RECIPE_TEXT_ALIGNS),
  })
  .catchall(z.never())

const AccessoryLabelSlotZ = z
  .object({
    enabled: z.boolean(),
    position_band: z.enum(ACCESSORY_LABEL_BANDS),
  })
  .catchall(z.never())

const RoleLayoutZ = z
  .object({
    layout_mode: z.enum(SLIDE_ARCHETYPES),
    caption_card: CaptionCardGeometryZ.optional(),
    hook: HookPlacementZ.optional(),
    accessory_label: AccessoryLabelSlotZ.optional(),
  })
  .catchall(z.never())

const RolesZ = z
  .object({
    cover: RoleLayoutZ.optional(),
    body: RoleLayoutZ.optional(),
    cta: RoleLayoutZ.optional(),
  })
  .catchall(z.never())

export const LayoutRecipeSchema = z
  .object({
    schema_version: z.literal(LAYOUT_RECIPE_VERSION),
    accent_cadence: z.enum(ACCENT_CADENCES),
    roles: RolesZ,
  })
  .catchall(z.never())

// =====================================================================
// Pre-clean walker helpers.
// =====================================================================

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Clamp a numeric geometry value into [min, max]. Non-finite input → the
 * range midpoint + a `parse_error` event. Out-of-range → clamped to the
 * nearest bound + a `range_clamp` event. Pure / deterministic.
 */
function clampNumber(
  value: unknown,
  field: string,
  range: readonly [number, number],
  counter: SilentDropCounter,
): number {
  const [min, max] = range
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    counter.increment({
      field,
      reason: 'parse_error',
      raw_value: value,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
    return (min + max) / 2
  }
  if (value < min || value > max) {
    counter.increment({
      field,
      reason: 'range_clamp',
      raw_value: value,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
    return value < min ? min : max
  }
  return value
}

const ALLOWED_TOP_LEVEL_KEYS = new Set(['schema_version', 'accent_cadence', 'roles'])
const ALLOWED_ROLE_KEYS = new Set(['layout_mode', 'caption_card', 'hook', 'accessory_label'])
const ALLOWED_CAPTION_KEYS = new Set([
  'enabled', 'x', 'y', 'width', 'height_pct', 'blend_pct', 'opacity', 'position',
])
const ALLOWED_HOOK_KEYS = new Set(['position_band', 'font_size_band', 'text_align'])
const ALLOWED_ACCESSORY_KEYS = new Set(['enabled', 'position_band'])

/** Strip unknown keys from a nested object, emitting one event per key. */
function stripUnknownKeys(
  obj: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  prefix: string,
  counter: SilentDropCounter,
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      counter.increment({
        field: `${prefix}.${key}`,
        reason: 'unknown_field',
        raw_value: obj[key],
        schema_version: LAYOUT_RECIPE_VERSION,
      })
      delete obj[key]
    }
  }
}

/** Coerce a value to boolean; non-boolean emits an `unknown_enum_value`. */
function cleanBoolean(
  value: unknown,
  field: string,
  counter: SilentDropCounter,
): boolean {
  if (typeof value === 'boolean') return value
  counter.increment({
    field,
    reason: 'unknown_enum_value',
    raw_value: value,
    schema_version: LAYOUT_RECIPE_VERSION,
  })
  return false
}

/** Clean one role's caption_card block (numeric clamp + enum silent-drop). */
function cleanCaptionCard(
  raw: unknown,
  prefix: string,
  counter: SilentDropCounter,
): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined
  const obj: Record<string, unknown> = { ...raw }
  stripUnknownKeys(obj, ALLOWED_CAPTION_KEYS, prefix, counter)

  const out: Record<string, unknown> = {
    enabled: cleanBoolean(obj.enabled, `${prefix}.enabled`, counter),
  }
  for (const numField of ['x', 'y', 'width', 'height_pct', 'blend_pct', 'opacity'] as const) {
    out[numField] = clampNumber(
      obj[numField],
      `${prefix}.${numField}`,
      GEOMETRY_RANGES[numField],
      counter,
    )
  }
  if (typeof obj.position === 'string' && CAPTION_POSITION_SET.has(obj.position)) {
    out.position = obj.position
  } else {
    counter.increment({
      field: `${prefix}.position`,
      reason: 'unknown_enum_value',
      raw_value: obj.position,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
    out.position = 'bottom'
  }
  return out
}

/** Clean one role's hook block — skip-emit the whole block on any bad enum. */
function cleanHook(
  raw: unknown,
  prefix: string,
  counter: SilentDropCounter,
): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined
  const obj: Record<string, unknown> = { ...raw }
  stripUnknownKeys(obj, ALLOWED_HOOK_KEYS, prefix, counter)

  let valid = true
  const checks: Array<[string, ReadonlySet<string>]> = [
    ['position_band', HOOK_POSITION_BAND_SET],
    ['font_size_band', HOOK_FONT_SIZE_BAND_SET],
    ['text_align', RECIPE_TEXT_ALIGN_SET],
  ]
  for (const [field, set] of checks) {
    const v = obj[field]
    if (typeof v !== 'string' || !set.has(v)) {
      counter.increment({
        field: `${prefix}.${field}`,
        reason: 'unknown_enum_value',
        raw_value: v,
        schema_version: LAYOUT_RECIPE_VERSION,
      })
      valid = false
    }
  }
  // Skip-emit the whole hook block if any sub-field is invalid.
  if (!valid) return undefined
  return {
    position_band: obj.position_band,
    font_size_band: obj.font_size_band,
    text_align: obj.text_align,
  }
}

/** Clean one role's accessory_label block — skip-emit on a bad band. */
function cleanAccessoryLabel(
  raw: unknown,
  prefix: string,
  counter: SilentDropCounter,
): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined
  const obj: Record<string, unknown> = { ...raw }
  stripUnknownKeys(obj, ALLOWED_ACCESSORY_KEYS, prefix, counter)

  const band = obj.position_band
  if (typeof band !== 'string' || !ACCESSORY_LABEL_BAND_SET.has(band)) {
    counter.increment({
      field: `${prefix}.position_band`,
      reason: 'unknown_enum_value',
      raw_value: band,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
    return undefined
  }
  return {
    enabled: cleanBoolean(obj.enabled, `${prefix}.enabled`, counter),
    position_band: band,
  }
}

/** Clean one role object. */
function cleanRole(
  raw: unknown,
  role: RecipeRole,
  counter: SilentDropCounter,
): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined
  const obj: Record<string, unknown> = { ...raw }
  const prefix = `roles.${role}`
  stripUnknownKeys(obj, ALLOWED_ROLE_KEYS, prefix, counter)

  const out: Record<string, unknown> = {}

  // layout_mode — silent-drop bad archetype → DEFAULT_FALLBACK_ARCHETYPE.
  const mode = obj.layout_mode
  if (typeof mode === 'string' && SLIDE_ARCHETYPE_SET.has(mode)) {
    out.layout_mode = mode
  } else {
    counter.increment({
      field: `${prefix}.layout_mode`,
      reason: 'unknown_enum_value',
      raw_value: mode,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
    out.layout_mode = DEFAULT_FALLBACK_ARCHETYPE
  }

  if ('caption_card' in obj) {
    const cc = cleanCaptionCard(obj.caption_card, `${prefix}.caption_card`, counter)
    if (cc !== undefined) out.caption_card = cc
  }
  if ('hook' in obj) {
    const h = cleanHook(obj.hook, `${prefix}.hook`, counter)
    if (h !== undefined) out.hook = h
  }
  if ('accessory_label' in obj) {
    const a = cleanAccessoryLabel(obj.accessory_label, `${prefix}.accessory_label`, counter)
    if (a !== undefined) out.accessory_label = a
  }
  return out
}

// =====================================================================
// parseLayoutRecipeSafe — public entry point.
// =====================================================================

export type ParseLayoutRecipeResult =
  | { ok: true; recipe: LayoutRecipe; counter: SilentDropCounter }
  | { ok: false; counter: SilentDropCounter; error: z.ZodError }

export function parseLayoutRecipeSafe(
  input: unknown,
  opts?: { counter?: SilentDropCounter },
): ParseLayoutRecipeResult {
  const counter = opts?.counter ?? createSilentDropCounter()

  if (!isPlainObject(input)) {
    counter.increment({
      field: '<root>',
      reason: 'parse_error',
      raw_value: input,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
    return {
      ok: false,
      counter,
      error: new z.ZodError([
        {
          code: 'custom',
          path: [],
          message: 'LayoutRecipe input must be a plain object',
          input,
        },
      ]),
    }
  }

  const cleaned: Record<string, unknown> = {}

  // Top-level: strip unknown keys (core injection defense).
  for (const key of Object.keys(input)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      counter.increment({
        field: key,
        reason: 'unknown_field',
        raw_value: input[key],
        schema_version: LAYOUT_RECIPE_VERSION,
      })
    }
  }

  // schema_version — forced to the literal.
  cleaned.schema_version = LAYOUT_RECIPE_VERSION

  // accent_cadence — silent-drop bad value → 'none'.
  const cadence = input.accent_cadence
  if (typeof cadence === 'string' && ACCENT_CADENCE_SET.has(cadence)) {
    cleaned.accent_cadence = cadence
  } else {
    counter.increment({
      field: 'accent_cadence',
      reason: 'unknown_enum_value',
      raw_value: cadence,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
    cleaned.accent_cadence = 'none'
  }

  // roles — clean each present role; absent roles stay absent (skip-emit).
  const rolesIn = isPlainObject(input.roles) ? input.roles : {}
  if (!isPlainObject(input.roles) && input.roles !== undefined) {
    counter.increment({
      field: 'roles',
      reason: 'unknown_enum_value',
      raw_value: input.roles,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
  }
  // Strip unknown role keys (anything not cover/body/cta).
  for (const key of Object.keys(rolesIn)) {
    if (!(RECIPE_ROLES as readonly string[]).includes(key)) {
      counter.increment({
        field: `roles.${key}`,
        reason: 'unknown_field',
        raw_value: rolesIn[key],
        schema_version: LAYOUT_RECIPE_VERSION,
      })
    }
  }
  const roles: Record<string, unknown> = {}
  for (const role of RECIPE_ROLES) {
    if (role in rolesIn && rolesIn[role] !== undefined) {
      const cleanedRole = cleanRole(rolesIn[role], role, counter)
      if (cleanedRole !== undefined) roles[role] = cleanedRole
    }
  }
  cleaned.roles = roles

  // Final safeParse — loud failure if the cleaned candidate still fails.
  const result = LayoutRecipeSchema.safeParse(cleaned)
  if (!result.success) {
    counter.increment({
      field: '<schema>',
      reason: 'parse_error',
      raw_value: result.error.message,
      schema_version: LAYOUT_RECIPE_VERSION,
    })
    return { ok: false, counter, error: result.error }
  }

  return { ok: true, recipe: result.data as LayoutRecipe, counter }
}
