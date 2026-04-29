import type { SlideTemplate, OverlaySlot, OverlayContent, TemplateOverlay } from './index'

// Phase 44: registry validator. Runs at module load via a top-level call in
// templates/index.ts so dev, npm run build, vitest, and the first prod request
// all surface a misconfigured template fast.
//
// Error format (per CONTEXT.md <specifics>):
//   [template-registry] Template '${id}' overlay[${i}]: ${reason}

const VALID_SLOTS: ReadonlyArray<OverlaySlot> = ['top-left', 'top-right', 'mid', 'bottom-card', 'free']
const VALID_SLIDE_FIELDS: ReadonlyArray<'topic' | 'hook_text' | 'body_text'> = ['topic', 'hook_text', 'body_text']
const PAGE_COUNTER_ALLOWED_KEYS = new Set(['type', 'format'])

function fail(templateId: string, overlayIndex: number, reason: string): never {
  throw new Error(`[template-registry] Template '${templateId}' overlay[${overlayIndex}]: ${reason}`)
}

function validateContent(templateId: string, i: number, content: OverlayContent): void {
  // Discriminated by `type`. The bad cases below come in via `as never` from tests, so we
  // narrow defensively and treat unknown shapes as misconfigurations.
  const t = (content as { type?: string }).type
  if (t === 'literal') {
    if (typeof (content as { text?: unknown }).text !== 'string') {
      fail(templateId, i, `literal content must include string 'text'`)
    }
    return
  }
  if (t === 'page-counter') {
    for (const key of Object.keys(content)) {
      if (!PAGE_COUNTER_ALLOWED_KEYS.has(key)) {
        fail(templateId, i, `page-counter content has extraneous field '${key}'`)
      }
    }
    return
  }
  if (t === 'slide-field') {
    const field = (content as { field?: unknown }).field
    if (typeof field !== 'string' || !VALID_SLIDE_FIELDS.includes(field as never)) {
      fail(templateId, i, `slide-field has invalid field '${String(field)}' (must be one of ${VALID_SLIDE_FIELDS.join(', ')})`)
    }
    return
  }
  fail(templateId, i, `unknown content type '${String(t)}'`)
}

function validateOverlay(templateId: string, i: number, overlay: TemplateOverlay): void {
  if (!VALID_SLOTS.includes(overlay.position)) {
    fail(templateId, i, `invalid slot '${String(overlay.position)}' (must be one of ${VALID_SLOTS.join(', ')})`)
  }
  validateContent(templateId, i, overlay.content)
}

export function validateTemplateRegistry(registry: ReadonlyArray<SlideTemplate>): void {
  for (const template of registry) {
    const overlays = template.overlays
    if (!overlays || overlays.length === 0) continue

    const seenSlots = new Set<OverlaySlot>()
    for (let i = 0; i < overlays.length; i++) {
      const overlay = overlays[i]
      validateOverlay(template.id, i, overlay)
      // Duplicate-slot check skips the 'free' slot per CONTEXT.md.
      if (overlay.position !== 'free') {
        if (seenSlots.has(overlay.position)) {
          fail(template.id, i, `slot '${overlay.position}' duplicated`)
        }
        seenSlots.add(overlay.position)
      }
    }
  }
}
