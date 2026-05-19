// Phase 74 Plan 01 Task 1 (STYLESPEC-10, PARITY-03):
// Silent-drop counter — observability primitive for the StyleSpec
// AI-ingest boundary (Plan 74-01) and any other boundary that needs to
// silently drop unknown enum values / unknown fields without throwing.
//
// CONTRACT (locked here, exercised by silent-drop-counter.test.ts):
//
//   1. Per-instance, NOT singleton. Each parseStyleSpecSafe call gets its
//      own counter; the caller decides whether to aggregate. Two parses in
//      the same process never bleed events between each other.
//
//   2. Per-FIELD increments — granular telemetry. NOT one-per-parse-call.
//      A single parse that drops 4 fields produces 4 events, not 1.
//
//   3. Default `onDrop` hook emits a single-line JSON to console.warn so
//      logs can be grepped for `style_spec_drop` without a dedicated
//      telemetry sink. Caller-supplied hooks REPLACE the default (do NOT
//      ALSO log to console.warn — would double-log into the caller's sink).
//
//   4. The default hook NEVER throws. If console.warn itself throws (a
//      caller has a broken global logger) the increment STILL succeeds —
//      silent-drop is silent by contract; never crash the parse path on a
//      bad logger.
//
//   5. raw_value is truncated to <=200 stringified chars to defend against
//      adversarial payloads embedded in image text via prompt injection
//      (see PITFALLS.md Pitfall 3) — an attacker spamming a 5KB string
//      should NOT be able to flood the log via a single dropped field.
//
// This module MUST NOT import StyleSpec — counter is generic, reusable at
// any boundary (e.g. Phase 77 EMIT-08 emit boundary).

/** Reasons enumerated as a closed union — adding a new reason is an
    intentional architectural decision (PARITY-03). */
export type SilentDropReason =
  | 'unknown_enum_value'
  | 'unknown_field'
  | 'sanitization'
  | 'parse_error'
  // Phase 80 reasons (composition-aware extraction — Plan 02 firewall):
  | 'schema_version_rejected'   // parseStyleSpecSafe early-reject on schema_version != STYLE_SPEC_VERSION
  | 'archetype_fallback'         // slideArchetype absent/unrecognized; defaulted to DEFAULT_FALLBACK_ARCHETYPE
  | 'archetype_slot_mismatch'    // slot param (caption, split, …) supplied for an archetype that does not declare it
  // Phase 84 reason (LayoutRecipe validator — Plan 84-02 firewall):
  | 'range_clamp'                // numeric geometry field clamped to its validated range

export interface SilentDropEvent {
  /** Dotted path, e.g. "typography.hookFontCategory" or
      "decorations.preferredLucide[1]". */
  field: string
  reason: SilentDropReason
  /** Optional original value. Stringified + truncated to <=200 chars when
      logged to defend against adversarial payload spam (PITFALLS Pitfall 3). */
  raw_value?: unknown
  /** StyleSpec.schema_version for cross-version forensics. */
  schema_version: number
}

export interface SilentDropCounter {
  increment(event: SilentDropEvent): void
  getCount(): number
  /** Frozen snapshot — mutating the returned array MUST NOT affect the
      counter's canonical event list. */
  getEvents(): readonly SilentDropEvent[]
}

const RAW_VALUE_MAX_STRINGIFIED_CHARS = 200

/**
 * Truncate a value so its JSON.stringify form is <=200 chars without
 * throwing. Defends against adversarial payloads embedded in image text
 * via prompt injection (PITFALLS Pitfall 3) — a 5KB string from the AI
 * MUST NOT be able to flood the log via a single dropped field.
 *
 * NOTE: callers may stringify the returned value via JSON.stringify (which
 * wraps strings in quotes); we shrink the underlying string until the
 * SERIALIZED form fits the cap, not the raw character count.
 */
function truncateRawValue(value: unknown): unknown {
  if (value === undefined) return undefined
  let serialized: string
  try {
    serialized = JSON.stringify(value) ?? 'null'
  } catch {
    // Circular structure or otherwise unstringifiable — fall back to a tag.
    return '[unserializable]'
  }
  if (serialized.length <= RAW_VALUE_MAX_STRINGIFIED_CHARS) return value
  // For strings: the serialized form is "..." (2 extra quote chars), so we
  // slice the underlying string by 2 fewer than the cap. For non-strings,
  // we slice the serialized JSON itself and surface as a string (the
  // structured form is already lost once truncated mid-JSON).
  if (typeof value === 'string') {
    return value.slice(0, RAW_VALUE_MAX_STRINGIFIED_CHARS - 2)
  }
  return serialized.slice(0, RAW_VALUE_MAX_STRINGIFIED_CHARS)
}

/** Default observability hook: single-line JSON via console.warn. Wrapped
    in try/catch so a broken global logger NEVER blocks the parse path. */
function defaultOnDrop(event: SilentDropEvent): void {
  try {
    const payload = {
      tag: 'style_spec_drop',
      field: event.field,
      reason: event.reason,
      schema_version: event.schema_version,
      raw_value: truncateRawValue(event.raw_value),
    }
    // JSON.stringify with no indent → single line by default.
    console.warn(JSON.stringify(payload))
  } catch {
    // Silent — defense-in-depth.
  }
}

export function createSilentDropCounter(opts?: {
  onDrop?: (event: SilentDropEvent) => void
}): SilentDropCounter {
  const events: SilentDropEvent[] = []
  const hook = opts?.onDrop ?? defaultOnDrop

  return {
    increment(event: SilentDropEvent): void {
      // Truncate raw_value defensively at append time so getEvents() callers
      // can't accidentally surface a 5KB blob from a prompt-injection payload.
      const safeEvent: SilentDropEvent = {
        field: event.field,
        reason: event.reason,
        schema_version: event.schema_version,
        raw_value: truncateRawValue(event.raw_value),
      }
      events.push(safeEvent)
      try {
        hook(safeEvent)
      } catch {
        // Hook crashed; counter still advanced — silent-drop is silent by contract.
      }
    },
    getCount(): number {
      return events.length
    },
    getEvents(): readonly SilentDropEvent[] {
      // Freeze a snapshot copy: callers attempting to mutate trip TypeError
      // (Test 3) without affecting the canonical list.
      return Object.freeze([...events])
    },
  }
}
