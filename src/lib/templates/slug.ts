// Phase 86 (ADMIN-01): template-id slug derivation.
//
// The template id shares ONE id space with projects.template_id and the 13
// code-template ids. `templateSlug` derives the base id from the template
// name; `withSuffix` is used by the save endpoint on a collision so a DB
// template never shadows a code template (code wins per Phase 83).

const SLUG_MAX_LEN = 60
const SUFFIX_LEN = 6
const SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Derive a URL-safe slug from a template name. PURE — no I/O, no randomness.
 * Lowercases, collapses any run of non-alphanumerics to a single `-`, strips
 * edge dashes, caps at 60 chars, falls back to `'template'` when empty.
 */
export function templateSlug(name: string): string {
  return (
    (name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, SLUG_MAX_LEN) || 'template'
  )
}

/**
 * Append a `-` plus a 6-char lowercase-alphanumeric random suffix to a slug.
 * NOT pure (uses Math.random) — kept separate so `templateSlug` stays
 * deterministically testable. The base slug is truncated so the combined
 * length stays within the slug length budget.
 */
export function withSuffix(slug: string): string {
  let suffix = ''
  for (let i = 0; i < SUFFIX_LEN; i++) {
    suffix += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)]
  }
  const base = slug.slice(0, SLUG_MAX_LEN - SUFFIX_LEN - 1)
  return `${base}-${suffix}`
}
