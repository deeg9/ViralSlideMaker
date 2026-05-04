// Phase 69 (Plan 69-01) — Lucide registry for decoration rendering.
//
// Closed-enum allowlist (~110 PascalCase names) + resolveDecorationSvg
// resolver with LRU cache. The single source of truth consumed by:
//   - decoration-renderer.tsx (Phase 69 — this plan)
//   - Decoration picker UI    (Phase 70)
//   - Gemini AI emit          (Phase 71)
//
// CRITICAL CONTRACTS (locked here, enforced by tests + Plan 69-03 grep gates):
//
//   1. lucide-static — NEVER lucide-react.
//      lucide-react emits React component trees that Satori cannot render
//      (vercel/satori#570). lucide-static ships per-icon SVG strings keyed
//      by PascalCase name; we substitute color + stroke-width tokens at
//      resolve-time and return inline SVG markup ready for data-URI wrapping
//      in decoration-renderer.tsx.
//
//   2. currentColor → explicit hex BEFORE returning.
//      Satori's currentColor cascade is unreliable across template /
//      fontSize / nested-element boundaries (vercel/satori#41). The resolver
//      output NEVER contains a currentColor token. PCL12 grep gate
//      (Plan 69-03) enforces zero currentColor literals in src/lib/render/
//      production code (comment-stripped).
//
//   3. CSS box-shadow — never SVG <filter>.
//      The renderer (decoration-renderer.tsx) applies box-shadow on the
//      wrapping <div>, never on the SVG itself. SVG <filter> is silently
//      dropped by Satori (vercel/satori#573). The resolver output does NOT
//      mutate filter/backdrop-filter/mix-blend-mode in the SVG string.
//      PCL13 grep gate (Plan 69-03) enforces.
//
//   4. Modifying LUCIDE_DECORATION_ALLOWLIST requires updating Phase 70
//      picker enumeration AND Phase 71 AI emit allowlist (single source of
//      truth — no duplication anywhere else in the codebase).

import * as Lucide from 'lucide-static'

// Closed-enum allowlist. Curated subset of Lucide's 1,703 icons spanning
// common categories: status / nav / arrows / shapes / weather / people /
// social / comms / media / awards / nature / travel / commerce / editing /
// files / time / charts / misc productivity. Includes all 10 PTF13 fixtures
// (Heart, Star, Check, Zap, ArrowRight, X, Plus, Crown, Sparkles, Circle).
//
// Total: 118 names. Within the [80, 120] sanity-floor band locked by Plan.
//
// Order is intentional (used by Phase 70 picker default sort); do NOT
// alphabetize blindly — categories cluster for editor browsing UX.
export const LUCIDE_DECORATION_ALLOWLIST = [
  // PTF13 fixtures (10) — locked test set
  'Heart', 'Star', 'Check', 'Zap', 'ArrowRight', 'X', 'Plus', 'Crown', 'Sparkles', 'Circle',
  // Status / nav (15)
  'CheckCheck', 'CircleCheck', 'XCircle', 'Minus', 'Info', 'HelpCircle', 'AlertCircle',
  'AlertTriangle', 'Ban', 'Power', 'Eye', 'EyeOff', 'Lock', 'Unlock', 'Key',
  // Arrows + direction (12)
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowUpRight', 'ChevronUp', 'ChevronDown',
  'ChevronLeft', 'ChevronRight', 'MoveUp', 'MoveDown', 'MoveLeft', 'MoveRight',
  // Shapes (7)
  'Square', 'Triangle', 'Diamond', 'Hexagon', 'Octagon', 'StarHalf', 'Sparkle',
  // Weather (8)
  'Sun', 'Moon', 'Cloud', 'CloudRain', 'Flame', 'Snowflake', 'Droplet', 'Rainbow',
  // People / social (10)
  'Smile', 'Frown', 'ThumbsUp', 'ThumbsDown', 'Hand', 'User', 'Users', 'UserPlus',
  'MessageCircle', 'MessageSquare',
  // Comms (6)
  'Send', 'Mail', 'Phone', 'Bell', 'BellRing', 'Megaphone',
  // Media (8)
  'Music', 'Headphones', 'Mic', 'Camera', 'Image', 'Video', 'Play', 'Pause',
  // Awards / celebration (6)
  'Award', 'Trophy', 'Medal', 'Gift', 'PartyPopper', 'Cake',
  // Nature (5)
  'Leaf', 'Flower', 'TreePine', 'Sprout', 'Bird',
  // Travel / commerce (8)
  'MapPin', 'Globe', 'Home', 'ShoppingCart', 'ShoppingBag', 'Package', 'Plane', 'Coffee',
  // Editing / files (10)
  'Pen', 'Pencil', 'Edit', 'Brush', 'Palette', 'Scissors', 'Save', 'Trash2', 'Folder', 'FileText',
  // Time (4)
  'Calendar', 'Clock', 'Hourglass', 'Timer',
  // Charts (4)
  'TrendingUp', 'TrendingDown', 'BarChart', 'PieChart',
  // Misc productivity (5)
  'Target', 'Lightbulb', 'Search', 'Settings', 'Tag',
] as const

export type LucideDecorationName = (typeof LUCIDE_DECORATION_ALLOWLIST)[number]

const ALLOWLIST_SET: ReadonlySet<string> = new Set(LUCIDE_DECORATION_ALLOWLIST)

/**
 * Closed-enum gate: returns true only if `name` is in the curated allowlist.
 * The picker UI (Phase 70) and AI emit boundary (Phase 71) consume this.
 */
export function isAllowedLucideName(name: string): boolean {
  return ALLOWLIST_SET.has(name)
}

// =====================================================================
// In-house LRU cache — ~30 LOC, no dependency.
// Map iterates in insertion order; on `get` we delete-and-reinsert to
// refresh recency; on `set` if size > cap we delete the first key.
// =====================================================================

class LRU<K, V> {
  private readonly map = new Map<K, V>()
  constructor(private readonly cap: number) {}

  get(key: K): V | undefined {
    const v = this.map.get(key)
    if (v === undefined) return undefined
    // Refresh recency: delete-and-reinsert moves the entry to the tail.
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key) // refresh recency on overwrite
    this.map.set(key, value)
    if (this.map.size > this.cap) {
      const oldest = this.map.keys().next().value as K | undefined
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }
}

const SVG_CACHE = new LRU<string, string>(500)

// =====================================================================
// Token-substitution regexes.
// Both are PRE-COMPILED (avoid per-call construction); both are
// scoped to substitutions safely covered by the closed-enum integrity
// of lucide-static SVG strings.
// =====================================================================

// Lucide SVG strings ALWAYS contain stroke="currentColor" and
// fill="currentColor" tokens (verified empirically across all 118 allowlist
// entries). The /g flag covers both occurrences in a single pass.
const RE_CURRENT_COLOR = /currentColor/g

// Lucide SVG strings ship `stroke-width="2"` by default. Replace ONLY the
// numeric value (preserving the attribute shape) so callers can swap in
// arbitrary fractional widths (e.g. 1.5).
const RE_STROKE_WIDTH = /stroke-width="\d+(?:\.\d+)?"/g

/**
 * Resolve a Lucide icon name to its inline SVG string with explicit hex
 * color + custom stroke-width. Returns null for unknown / un-allowlisted
 * names (silent — no throw). LRU-cached at cap 500 keyed by
 * `${name}|${color}|${strokeWidth}` — repeat calls return the IDENTICAL
 * string reference until evicted.
 *
 * The returned string contains ZERO `currentColor` tokens (substituted
 * with `color` at resolve time) — locked by registry.test.ts + PCL12.
 *
 * Caller (decoration-renderer.tsx) wraps the returned string in a
 * `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` URI and embeds it
 * via `<img src="...">` per the documented Satori-safe inline-SVG path.
 */
export function resolveDecorationSvg(
  name: string,
  color: string,
  strokeWidth: number,
): string | null {
  if (!isAllowedLucideName(name)) return null

  const key = `${name}|${color}|${strokeWidth}`
  const cached = SVG_CACHE.get(key)
  if (cached !== undefined) return cached

  // Closed-enum integrity: every allowlist entry SHOULD have a corresponding
  // lucide-static export (verified by the registry round-trip test). Defensive
  // null-return below covers any future allowlist edit that drifts ahead of a
  // lucide-static version bump.
  const raw = (Lucide as unknown as Record<string, string>)[name]
  if (typeof raw !== 'string') return null

  // Order matters: substitute color before stroke-width so the regex doesn't
  // accidentally hit a hex color that happens to look like a stroke-width.
  const colored = raw.replace(RE_CURRENT_COLOR, color)
  const result = colored.replace(RE_STROKE_WIDTH, `stroke-width="${strokeWidth}"`)

  SVG_CACHE.set(key, result)
  return result
}
