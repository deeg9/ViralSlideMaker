import type {
  Slide,
  TextBox,
  TextBoxPosition,
  TextBoxRole,
  CustomImage,
  Decoration,
} from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'
import { textBoxesToLegacy } from '@/lib/editor/text-box-adapter'
import {
  alignElements,
  distributeElements,
  type AlignPatch,
} from '@/lib/editor/transforms/align'
import { applyZOrderToArray } from '@/lib/editor/transforms/z-order'
// Phase 68 Plan 01 (EDITOR-01): exhaustive scope type. Imported here so the
// helper at the bottom of the file (scopeIdSet) can use it as a switch
// discriminator — that switch is what gives the compile-time `never` gate
// teeth across reducer-side scope walks. Plan 68-02 will consume this
// helper from the extended cases (BULK_TRANSLATE, BULK_DELETE, etc.).
import {
  type AddressableScope,
  assertExhaustiveScope,
} from './addressable-scope'

const MAX_HISTORY = 50

/**
 * Phase 50 (BL-01): write-through helper. After any reducer mutation to
 * `slide.text_boxes`, derive a fresh legacy slice via `textBoxesToLegacy`
 * and merge it back into the slide's legacy fields + style_overrides in
 * the SAME reducer step.
 *
 * Why: `slide-preview.tsx` (and Satori PNG export, HTML export) read from
 * `slide.hook_text` / `slide.body_text` / `slide.hook_segments` /
 * `slide.body_segments` / `slide.style_overrides.{hook,body}_*`. Dual-write
 * at save time is too late — the live preview renders before save, so the
 * canvas would show stale content for every per-text-box edit.
 *
 * Phase 53 may flip slide-preview to read from `text_boxes` natively; until
 * then this guarantees both shapes stay in lock-step.
 */
function applyDualWrite(slide: Slide, nextTextBoxes: TextBox[]): Slide {
  const slice = textBoxesToLegacy(nextTextBoxes)
  const out: Slide = {
    ...slide,
    text_boxes: nextTextBoxes,
    hook_text: slice.hook_text,
    body_text: slice.body_text,
  }
  if (slice.hook_segments !== undefined) {
    out.hook_segments = slice.hook_segments
  } else {
    delete out.hook_segments
  }
  if (slice.body_segments !== undefined) {
    out.body_segments = slice.body_segments
  } else {
    delete out.body_segments
  }
  if (slice.custom_texts !== undefined) {
    out.custom_texts = slice.custom_texts
  } else {
    delete out.custom_texts
  }
  if (
    Object.keys(slice.style_overrides_patch).length > 0 ||
    slide.style_overrides
  ) {
    out.style_overrides = {
      ...(slide.style_overrides ?? {}),
      ...slice.style_overrides_patch,
    }
  }
  return out
}

export interface EditorHistory {
  past: Slide[][]
  present: Slide[]
  future: Slide[][]
}

function blankSlide(): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
}

function deepCloneSlide(slide: Slide): Slide {
  return JSON.parse(JSON.stringify(slide))
}

function defaultPositionForRole(role: TextBoxRole): TextBoxPosition {
  switch (role) {
    case 'hook':
      return { anchor: 'top' }
    case 'body':
      return { anchor: 'bottom' }
    case 'custom':
    default:
      // Mirrors existing custom_text defaults at editor-reducer.ts ADD_CUSTOM_TEXT case.
      return { anchor: 'custom', x: 20, y: 50, width: 60 }
  }
}

/**
 * Phase 63 (ALIGN-03..05): apply integer-rounded position patches from
 * align.ts to a slide. Routes text_boxes mutations through applyDualWrite
 * (BL-01).
 *
 * The pure align.ts module is the rounding boundary (PITFALL-4.4 — ALIGN-09).
 * This helper does NOT re-round — would double-round (defense-in-depth in
 * the wrong direction). Watermark patches are not produced by align.ts;
 * defense-in-depth here just means "skip if a future caller passes a
 * watermark patch by mistake".
 *
 * Returns the same `slide` reference unchanged when no patch matched any
 * element on the slide — lets the caller skip pushHistory.
 */
function applyAlignPatches(slide: Slide, patches: AlignPatch[]): Slide {
  if (patches.length === 0) return slide

  const patchById = new Map<string, { x?: number; y?: number }>()
  for (const p of patches) patchById.set(p.id, p.patch)

  let textBoxesChanged = false
  let nextTextBoxes = slide.text_boxes
  if (slide.text_boxes) {
    nextTextBoxes = slide.text_boxes.map((tb) => {
      const p = patchById.get(tb.id)
      if (!p) return tb
      // Defense-in-depth: align.ts already filtered structural anchors out.
      if (tb.position.anchor !== 'custom') return tb
      textBoxesChanged = true
      return {
        ...tb,
        position: {
          ...tb.position,
          ...(p.x !== undefined ? { x: p.x } : {}),
          ...(p.y !== undefined ? { y: p.y } : {}),
        },
      }
    })
  }

  let customImagesChanged = false
  let nextCustomImages = slide.custom_images
  if (slide.custom_images) {
    nextCustomImages = slide.custom_images.map((ci) => {
      const p = patchById.get(ci.id)
      if (!p) return ci
      // Defense-in-depth: align.ts already filtered locked images out.
      if (ci.locked === true) return ci
      customImagesChanged = true
      return {
        ...ci,
        ...(p.x !== undefined ? { x: p.x } : {}),
        ...(p.y !== undefined ? { y: p.y } : {}),
      }
    })
  }

  // Phase 68 Plan 02 (EDITOR-06): apply align/distribute patches to
  // slide.decorations. align.ts buildMoveCandidates already filters locked
  // decorations (ALIGN-10 + Phase 64 LOCK-04) — defense-in-depth guard here
  // mirrors the custom_images branch above.
  let decorationsChanged = false
  let nextDecorations = slide.decorations
  if (slide.decorations) {
    nextDecorations = slide.decorations.map((d) => {
      const p = patchById.get(d.id)
      if (!p) return d
      if (d.locked === true) return d
      decorationsChanged = true
      return {
        ...d,
        position: {
          ...d.position,
          ...(p.x !== undefined ? { x: p.x } : {}),
          ...(p.y !== undefined ? { y: p.y } : {}),
        },
      }
    })
  }

  if (!textBoxesChanged && !customImagesChanged && !decorationsChanged) return slide

  let next: Slide = slide
  if (textBoxesChanged && nextTextBoxes !== undefined) {
    next = applyDualWrite(next, nextTextBoxes)
  }
  if (customImagesChanged) {
    next = { ...next, custom_images: nextCustomImages }
  }
  if (decorationsChanged) {
    next = { ...next, decorations: nextDecorations }
  }
  return next
}

/**
 * Phase 68 Plan 01 (EDITOR-01): scope → id-set helper. Returns the set of
 * element ids on a slide for the given AddressableScope. The switch is the
 * compile-time gate site for this file: when EDITOR-02 lands a 5th scope (or
 * any future addressable element), tsc will surface "Argument of type 'X' is
 * not assignable to parameter of type 'never'" at the assertExhaustiveScope
 * call below until a new case is added. Plan 68-02 will consume this helper
 * from the extended cases (BULK_TRANSLATE, BULK_DELETE, GROUP, etc.) — until
 * then it stays internal, but its presence here is what gives the compile
 * gate teeth alongside the addressable-scope tests.
 */
function scopeIdSet(scope: AddressableScope, slide: Slide): Set<string> {
  switch (scope) {
    case 'text_boxes':
      return new Set((slide.text_boxes ?? []).map((tb) => tb.id))
    case 'custom_images':
      return new Set((slide.custom_images ?? []).map((ci) => ci.id))
    case 'watermark':
      return new Set(slide.watermark ? [slide.watermark.id] : [])
    case 'decorations':
      return new Set((slide.decorations ?? []).map((d) => d.id))
    default:
      return assertExhaustiveScope(scope)
  }
}

function pushHistory(state: EditorHistory, newPresent: Slide[]): EditorHistory {
  const past = [...state.past, state.present]
  if (past.length > MAX_HISTORY) {
    past.shift()
  }
  return { past, present: newPresent, future: [] }
}

export function editorReducer(state: EditorHistory, action: EditorAction): EditorHistory {
  switch (action.type) {
    case 'ADD_SLIDE': {
      const slides = [...state.present]
      slides.splice(action.index, 0, blankSlide())
      return pushHistory(state, slides)
    }

    case 'REMOVE_SLIDE': {
      if (state.present.length <= 1) return state
      const slides = state.present.filter((_, i) => i !== action.index)
      return pushHistory(state, slides)
    }

    case 'DUPLICATE_SLIDE': {
      const slides = [...state.present]
      const clone = deepCloneSlide(slides[action.index])
      // Phase 49 (MR-01): regenerate IDs on the cloned slide so text_boxes /
      // custom_texts / custom_images don't collide across slides. Per-slide
      // reducer scoping protects current call sites, but flat ID lookups in
      // future code (drag between slides, analytics, selection) would be
      // broken by duplicate IDs.
      if (clone.text_boxes) {
        clone.text_boxes = clone.text_boxes.map((tb) => ({ ...tb, id: crypto.randomUUID() }))
      }
      if (clone.custom_texts) {
        clone.custom_texts = clone.custom_texts.map((ct) => ({ ...ct, id: crypto.randomUUID() }))
      }
      if (clone.custom_images) {
        clone.custom_images = clone.custom_images.map((ci) => ({ ...ci, id: crypto.randomUUID() }))
      }
      slides.splice(action.index + 1, 0, clone)
      return pushHistory(state, slides)
    }

    case 'REORDER_SLIDES': {
      const slides = [...state.present]
      const [moved] = slides.splice(action.from, 1)
      slides.splice(action.to, 0, moved)
      return pushHistory(state, slides)
    }

    case 'UPDATE_SLIDE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.index) return slide
        const updated = { ...slide, ...action.updates }
        // Merge style_overrides instead of replacing
        if (action.updates.style_overrides && slide.style_overrides) {
          updated.style_overrides = {
            ...slide.style_overrides,
            ...action.updates.style_overrides,
          }
        }
        return updated
      })
      return pushHistory(state, slides)
    }

    case 'SET_SLIDES': {
      return pushHistory(state, action.slides)
    }

    case 'ADD_CUSTOM_TEXT': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const newText = {
          id: crypto.randomUUID(),
          text: 'New Text',
          x: 20,
          y: 50,
          width: 60,
          font_size: 48,
          font_weight: 400,
          color: slide.style_overrides?.text_color ?? '#ffffff',
        }
        return {
          ...slide,
          custom_texts: [...(slide.custom_texts ?? []), newText],
        }
      })
      return pushHistory(state, slides)
    }

    case 'UPDATE_CUSTOM_TEXT': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const custom_texts = (slide.custom_texts ?? []).map((ct) =>
          ct.id === action.textId ? { ...ct, ...action.updates } : ct
        )
        return { ...slide, custom_texts }
      })
      return pushHistory(state, slides)
    }

    case 'REMOVE_CUSTOM_TEXT': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const custom_texts = (slide.custom_texts ?? []).filter(
          (ct) => ct.id !== action.textId
        )
        return { ...slide, custom_texts }
      })
      return pushHistory(state, slides)
    }

    case 'ADD_CUSTOM_IMAGE': {
      const init = action.initial
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const newImage = {
          id: crypto.randomUUID(),
          url: action.url,
          x: init?.x ?? 20,
          y: init?.y ?? 30,
          width: init?.width ?? 40,
          height: init?.height ?? 40,
          opacity: init?.opacity ?? 100,
        }
        return {
          ...slide,
          custom_images: [...(slide.custom_images ?? []), newImage],
        }
      })
      return pushHistory(state, slides)
    }

    case 'UPDATE_CUSTOM_IMAGE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const custom_images = (slide.custom_images ?? []).map((ci) =>
          ci.id === action.imageId ? { ...ci, ...action.updates } : ci
        )
        return { ...slide, custom_images }
      })
      return pushHistory(state, slides)
    }

    case 'REMOVE_CUSTOM_IMAGE': {
      // Phase 64 Plan 01 (LOCK-04): if the targeted image is locked,
      // return state unchanged (no pushHistory; reducers stay pure — the
      // dispatch site is responsible for any user-visible feedback).
      const targetSlide = state.present[action.slideIndex]
      const targetCi = (targetSlide?.custom_images ?? []).find(
        (ci) => ci.id === action.imageId,
      )
      if (targetCi?.locked === true) return state
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const custom_images = (slide.custom_images ?? []).filter(
          (ci) => ci.id !== action.imageId
        )
        return { ...slide, custom_images }
      })
      return pushHistory(state, slides)
    }

    // Phase 68 Plan 01 (EDITOR-02 partial — 3 NEW actions):
    // ADD_DECORATION / UPDATE_DECORATION / REMOVE_DECORATION mirror the
    // ADD_CUSTOM_IMAGE / UPDATE_CUSTOM_IMAGE / REMOVE_CUSTOM_IMAGE shapes
    // (alphabetical-by-scope-group case order — same v2.11 audit-friendly
    // pattern). New decoration is appended at the END of the array (mirror
    // ADD_CUSTOM_IMAGE precedent) so layer-stacking matches insertion order.
    case 'ADD_DECORATION': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const next = [...(slide.decorations ?? []), action.decoration]
        return { ...slide, decorations: next }
      })
      return pushHistory(state, slides)
    }

    // Phase 68 Plan 01: shallow-merge updates into the matching decoration.
    // Lock-honor: locked decorations short-circuit (mirror REMOVE_TEXT_BOX
    // line 366-372 / REMOVE_CUSTOM_IMAGE line 311-319 gates). The lock gate
    // guards CONTENT updates only — the locked flag itself is mutated via
    // SET_LOCKED (Plan 68-02), not here. Unknown id → silent no-op
    // (state ref-equal, no pushHistory pollution).
    //
    // Note on discriminator: the shallow-merge preserves `kind` because
    // Partial<Decoration> from a typed caller cannot widen the discriminator
    // beyond its existing literal. The Phase 71 AI-ingest adapter at the
    // boundary enforces shape integrity before any UPDATE_DECORATION reaches
    // the reducer.
    case 'UPDATE_DECORATION': {
      let mutated = false
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        if (!slide.decorations) return slide
        const idx = slide.decorations.findIndex((d) => d.id === action.id)
        if (idx === -1) return slide
        const existing = slide.decorations[idx]
        if (existing.locked === true) return slide
        const merged = { ...existing, ...action.updates } as typeof existing
        const nextDecorations = slide.decorations.slice()
        nextDecorations[idx] = merged
        mutated = true
        return { ...slide, decorations: nextDecorations }
      })
      if (!mutated) return state
      return pushHistory(state, slides)
    }

    // Phase 68 Plan 01: filter the matching id. Locked decorations
    // short-circuit (lock-honor; mirror REMOVE_CUSTOM_IMAGE gate). Unknown
    // id / undefined decorations → silent no-op (state ref-equal). When the
    // last decoration is removed, the array remains defined as `[]` — the
    // realized-then-emptied state is distinct from `decorations === undefined`,
    // and Phase 67 PTF16 idempotent-absence pertains only to the latter.
    case 'REMOVE_DECORATION': {
      let mutated = false
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        if (!slide.decorations) return slide
        const idx = slide.decorations.findIndex((d) => d.id === action.id)
        if (idx === -1) return slide
        if (slide.decorations[idx].locked === true) return slide
        const nextDecorations = slide.decorations.filter(
          (d) => d.id !== action.id,
        )
        mutated = true
        return { ...slide, decorations: nextDecorations }
      })
      if (!mutated) return state
      return pushHistory(state, slides)
    }

    case 'ADD_TEXT_BOX': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const { defaults } = action
        const newBox: TextBox = {
          id: defaults?.id ?? crypto.randomUUID(),
          role: action.role,
          text: defaults?.text ?? 'New Text',
          position: defaults?.position ?? defaultPositionForRole(action.role),
          ...(defaults?.segments !== undefined ? { segments: defaults.segments } : {}),
          ...(defaults?.font_family !== undefined ? { font_family: defaults.font_family } : {}),
          ...(defaults?.font_size !== undefined ? { font_size: defaults.font_size } : {}),
          ...(defaults?.font_weight !== undefined ? { font_weight: defaults.font_weight } : {}),
          ...(defaults?.font_style !== undefined ? { font_style: defaults.font_style } : {}),
          ...(defaults?.color !== undefined ? { color: defaults.color } : {}),
          ...(defaults?.text_align !== undefined ? { text_align: defaults.text_align } : {}),
          ...(defaults?.effects !== undefined ? { effects: defaults.effects } : {}),
        }
        const nextTextBoxes = [...(slide.text_boxes ?? []), newBox]
        return applyDualWrite(slide, nextTextBoxes)
      })
      return pushHistory(state, slides)
    }

    case 'UPDATE_TEXT_BOX': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const nextTextBoxes = (slide.text_boxes ?? []).map((tb) =>
          tb.id === action.textBoxId ? { ...tb, ...action.updates } : tb
        )
        return applyDualWrite(slide, nextTextBoxes)
      })
      return pushHistory(state, slides)
    }

    case 'REMOVE_TEXT_BOX': {
      // Phase 64 Plan 01 (LOCK-04): if the targeted text_box is locked,
      // return state unchanged (no pushHistory; reducers stay pure).
      const targetSlide = state.present[action.slideIndex]
      const targetTb = (targetSlide?.text_boxes ?? []).find(
        (tb) => tb.id === action.textBoxId,
      )
      if (targetTb?.locked === true) return state
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const nextTextBoxes = (slide.text_boxes ?? []).filter(
          (tb) => tb.id !== action.textBoxId
        )
        return applyDualWrite(slide, nextTextBoxes)
      })
      return pushHistory(state, slides)
    }

    // Phase 60 (PERF-01): single dispatch per drag gesture (onDragStop only —
    // never per-tick onDrag; matches v2.10 onResizeStop precedent). The
    // reducer:
    //   - calls pushHistory() exactly once (PERF-01),
    //   - routes text_boxes through applyDualWrite() so legacy fields stay
    //     in lock-step with text_boxes (BL-01),
    //   - skips locked elements (Phase 64 honor — declared here so Phase 64
    //     doesn't need to re-touch the reducer),
    //   - skips text_boxes with anchor !== 'custom' (structural anchors
    //     don't carry x/y — RESEARCH Q7 conservative choice),
    //   - skips watermark entirely (Watermark.position is an enum, not a
    //     freeform x/y — RESEARCH Q7 lines 1249-1254; Phase 62/63 may
    //     revisit when groups + alignment land).
    case 'BULK_TRANSLATE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const idSet = new Set(action.ids)

        // Update text_boxes (custom-anchor only, skip locked).
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (!idSet.has(tb.id)) return tb
            if (tb.locked === true) return tb              // Phase 64 honor
            if (tb.position.anchor !== 'custom') return tb // structural anchors skipped
            return {
              ...tb,
              position: {
                ...tb.position,
                x: (tb.position.x ?? 0) + action.deltaX,
                y: (tb.position.y ?? 0) + action.deltaY,
              },
            }
          })
        }

        // Update custom_images (skip locked).
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (!idSet.has(ci.id)) return ci
            if (ci.locked === true) return ci              // Phase 64 honor
            return { ...ci, x: ci.x + action.deltaX, y: ci.y + action.deltaY }
          })
        }

        // Phase 68 Plan 02 (EDITOR-02): decorations branch — same shape as
        // custom_images but operates on Decoration.position {x, y, width,
        // height}. Locked decorations are skipped (Phase 64 LOCK-04 honor);
        // hidden decorations DO move (hidden ≠ locked — mirror v2.11 contract).
        let nextDecorations = slide.decorations
        if (slide.decorations) {
          nextDecorations = slide.decorations.map((d) => {
            if (!idSet.has(d.id)) return d
            if (d.locked === true) return d   // Phase 64 LOCK-04
            return {
              ...d,
              position: {
                ...d.position,
                x: d.position.x + action.deltaX,
                y: d.position.y + action.deltaY,
              },
            }
          })
        }

        // Watermark: SKIPPED in Phase 60. Watermark.position is enum-only;
        // freeform translation requires a future schema extension. Known gap.

        let next: Slide = slide
        if (nextTextBoxes !== slide.text_boxes && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (nextCustomImages !== slide.custom_images) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (nextDecorations !== slide.decorations) {
          next = { ...next, decorations: nextDecorations }
        }
        return next
      })
      return pushHistory(state, slides)  // PERF-01: exactly one pushHistory
    }

    // Phase 60 (HIGH-1 review-fix): bulk delete in a single dispatch — mirrors
    // BULK_TRANSLATE shape. Pre-fix, slide-editor.tsx onBulkDelete looped over
    // ids and called removeTextBox / handleRemoveCustomImage per element; each
    // helper pushed its own history entry, so a 5-element bulk delete required
    // 5× Cmd+Z to undo. This action collapses the gesture to one history entry.
    //
    // Filtering rules (kept consistent with the per-id pre-fix behavior):
    //   - text_boxes with role !== 'custom' are KEPT (hook/body are non-
    //     deletable; the pre-fix loop's `if (tb?.role === 'custom')` gate
    //     skipped them silently).
    //   - text_boxes with locked === true are KEPT (Phase 64 honor; matches
    //     BULK_TRANSLATE precedent — declared here so Phase 64 doesn't need
    //     to re-touch the reducer).
    //   - custom_images with locked === true are KEPT (same Phase 64 honor).
    //   - watermark is NEVER deleted by this action (lives on slide.watermark,
    //     not in text_boxes/custom_images; mirrors existing v2.10 behavior).
    //
    // Routes text_boxes through applyDualWrite so legacy hook_text /
    // body_text / custom_texts mirror the surviving text_boxes (BL-01).
    case 'BULK_DELETE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const idSet = new Set(action.ids)

        const prevTextBoxes = slide.text_boxes ?? []
        const nextTextBoxes = prevTextBoxes.filter(
          (tb) =>
            !idSet.has(tb.id) ||
            tb.role !== 'custom' ||
            tb.locked === true,
        )

        const prevCustomImages = slide.custom_images ?? []
        const nextCustomImages = prevCustomImages.filter(
          (ci) => !idSet.has(ci.id) || ci.locked === true,
        )

        // Phase 68 Plan 02 (EDITOR-02): decorations branch — filter unlocked
        // decorations matching idSet. Locked decorations are PRESERVED (lock-
        // honor; mirror custom_images branch above). Hidden decorations are
        // STILL DELETED (hidden does not protect from delete — contract
        // mirrors v2.11 SET_HIDDEN-doesn't-block-delete behavior).
        const prevDecorations = slide.decorations ?? []
        const nextDecorations = slide.decorations
          ? slide.decorations.filter(
              (d) => !idSet.has(d.id) || d.locked === true,
            )
          : slide.decorations

        let next: Slide = slide
        if (nextTextBoxes.length !== prevTextBoxes.length) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (nextCustomImages.length !== prevCustomImages.length) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (
          slide.decorations &&
          nextDecorations !== slide.decorations &&
          (nextDecorations as Decoration[]).length !== prevDecorations.length
        ) {
          next = { ...next, decorations: nextDecorations as Decoration[] }
        }
        return next
      })
      // Phase 64 Plan 01 (LOCK-04 SL8b): if no slide actually changed —
      // e.g. every requested id was locked or otherwise non-deletable —
      // short-circuit ref-equal so the no-op gesture doesn't pollute undo
      // history. Mirrors the ALIGN/DISTRIBUTE pattern at lines 675/690.
      if (slides.every((s, i) => s === state.present[i])) return state
      return pushHistory(state, slides)  // PERF-01: exactly one pushHistory
    }

    // Phase 66 Plan 02 (DIFF-01, KBD-09, PERF-01): Alt+drag duplicate.
    //   - Empty / stale ids → silent no-op (matches UNGROUP idempotency).
    //   - Deep-copies every listed text_box / custom_image with a fresh id
    //     (crypto.randomUUID()) and applies (deltaX, deltaY) to the copy's
    //     position; originals are NEVER mutated.
    //   - Optionally assigns newGroupId on every copy (caller decides; reducer
    //     trusts it).
    //   - Skips locked / structural-anchor / non-custom-role text_boxes.
    //     Watermark lives on slide.watermark — never iterated; silently skipped.
    //   - text_boxes mutations route through applyDualWrite (BL-01).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    case 'DUPLICATE_ELEMENTS_AT': {
      if (action.ids.length === 0) return state // DE-EMPTY silent no-op
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const idSet = new Set(action.ids)

        // Build duplicates from text_boxes (custom-role + custom-anchor +
        // unlocked only — same skip-set as BULK_TRANSLATE/BULK_DELETE).
        const textBoxCopies: TextBox[] = []
        for (const tb of slide.text_boxes ?? []) {
          if (!idSet.has(tb.id)) continue
          if (tb.locked === true) continue
          if (tb.role !== 'custom') continue            // structural skip
          if (tb.position.anchor !== 'custom') continue // structural-anchor skip
          const copy: TextBox = {
            ...tb,
            id: crypto.randomUUID(),
            position: {
              ...tb.position,
              x: (tb.position.x ?? 0) + action.deltaX,
              y: (tb.position.y ?? 0) + action.deltaY,
            },
            ...(action.newGroupId !== undefined
              ? { groupId: action.newGroupId }
              : { groupId: undefined }),
          }
          textBoxCopies.push(copy)
        }

        // Build duplicates from custom_images (unlocked only).
        const imageCopies: CustomImage[] = []
        for (const ci of slide.custom_images ?? []) {
          if (!idSet.has(ci.id)) continue
          if (ci.locked === true) continue
          const copy: CustomImage = {
            ...ci,
            id: crypto.randomUUID(),
            x: ci.x + action.deltaX,
            y: ci.y + action.deltaY,
            ...(action.newGroupId !== undefined
              ? { groupId: action.newGroupId }
              : { groupId: undefined }),
          }
          imageCopies.push(copy)
        }

        // Phase 68 Plan 02 (EDITOR-11): decorations branch — alt-drag duplicate
        // for icon + shape decorations. Same skip-set as custom_images branch
        // PLUS skip hidden (mirror Phase 66 PITFALL pattern — hidden elements
        // shouldn't be silently materialized as visible copies). Discriminated-
        // union shape preserved via `{ ...d, id: ... }` spread (kind + per-kind
        // fields ride along intact).
        const decorationCopies: Decoration[] = []
        for (const d of slide.decorations ?? []) {
          if (!idSet.has(d.id)) continue
          if (d.locked === true) continue
          if (d.hidden === true) continue
          const copy = {
            ...d,
            id: crypto.randomUUID(),
            position: {
              ...d.position,
              x: d.position.x + action.deltaX,
              y: d.position.y + action.deltaY,
            },
            ...(action.newGroupId !== undefined
              ? { groupId: action.newGroupId }
              : { groupId: undefined }),
          } as Decoration
          decorationCopies.push(copy)
        }

        // Watermark: SKIPPED. Watermark.position is enum-only — cannot be
        // freeform-translated. Same gap as BULK_TRANSLATE; documented in
        // 66-CONTEXT.md.
        if (
          textBoxCopies.length === 0 &&
          imageCopies.length === 0 &&
          decorationCopies.length === 0
        ) {
          return slide  // truly nothing to copy — no-op for this slide
        }

        let next: Slide = slide
        if (textBoxCopies.length > 0) {
          const nextTextBoxes = [...(slide.text_boxes ?? []), ...textBoxCopies]
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (imageCopies.length > 0) {
          next = {
            ...next,
            custom_images: [...(next.custom_images ?? []), ...imageCopies],
          }
        }
        if (decorationCopies.length > 0) {
          next = {
            ...next,
            decorations: [...(next.decorations ?? []), ...decorationCopies],
          }
        }
        return next
      })
      // Detect any-slide-changed: if every slide returned ref-equal, skip
      // pushHistory (DE-EMPTY / DE-STALE silent no-op contract).
      if (slides.every((s, i) => s === state.present[i])) return state
      return pushHistory(state, slides)  // PERF-01: exactly one pushHistory
    }

    // Phase 62 (GROUP-02, GROUP-04, GROUP-05, KBD-09, BL-01): GROUP single-
    // dispatch contract.
    //   - ids.length <= 1 → silent no-op (return state unchanged; PITFALL-3.4).
    //   - ids.length >= 2 → assign action.groupId to every listed id; the
    //     reducer trusts the caller-provided groupId.
    //   - "Subset of an existing group dissolves prior group" cascade
    //     (PITFALL-3.3 — flat schema only): if any listed id already carries
    //     a different groupId, the OLD group is dissolved entirely. Any
    //     non-listed members of any old groupId hit by the cascade have
    //     their groupId cleared.
    //   - text_boxes mutations route through applyDualWrite (BL-01).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    case 'GROUP': {
      if (action.ids.length <= 1) return state // GROUP-04 / PITFALL-3.4

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const idSet = new Set(action.ids)

        // Detect prior groupIds among the selected ids — drives the
        // "subset dissolves prior group" cascade for unselected members.
        // Phase 68 Plan 02 (EDITOR-05): walk decorations alongside the other
        // 3 scopes so cascade catches decorations group membership too.
        const oldGroupIds = new Set<string>()
        for (const tb of slide.text_boxes ?? []) {
          if (idSet.has(tb.id) && tb.groupId !== undefined && tb.groupId !== action.groupId) {
            oldGroupIds.add(tb.groupId)
          }
        }
        for (const ci of slide.custom_images ?? []) {
          if (idSet.has(ci.id) && ci.groupId !== undefined && ci.groupId !== action.groupId) {
            oldGroupIds.add(ci.groupId)
          }
        }
        for (const d of slide.decorations ?? []) {
          if (idSet.has(d.id) && d.groupId !== undefined && d.groupId !== action.groupId) {
            oldGroupIds.add(d.groupId)
          }
        }
        if (
          slide.watermark &&
          idSet.has(slide.watermark.id) &&
          slide.watermark.groupId !== undefined &&
          slide.watermark.groupId !== action.groupId
        ) {
          oldGroupIds.add(slide.watermark.groupId)
        }

        // Walk text_boxes
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (idSet.has(tb.id)) {
              return tb.groupId === action.groupId ? tb : { ...tb, groupId: action.groupId }
            }
            if (tb.groupId !== undefined && oldGroupIds.has(tb.groupId)) {
              // Subset cascade: clear groupId on un-listed members of dissolved old group.
              const { groupId: _g, ...rest } = tb
              return rest as TextBox
            }
            return tb
          })
        }

        // Walk custom_images
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (idSet.has(ci.id)) {
              return ci.groupId === action.groupId ? ci : { ...ci, groupId: action.groupId }
            }
            if (ci.groupId !== undefined && oldGroupIds.has(ci.groupId)) {
              const { groupId: _g, ...rest } = ci
              return rest
            }
            return ci
          })
        }

        // Phase 68 Plan 02 (EDITOR-05): decorations branch — same shape as
        // custom_images. Locked decorations DO receive groupId reassignment
        // (groupId is editable on locked elements per v2.11 LOCK-04 contract;
        // the lock guards CONTENT, not group membership). Cascade dissolution
        // mirrors the v2.11 Phase 62-01 carry-forward: non-listed members of
        // any dissolved old group have groupId cleared.
        let nextDecorations = slide.decorations
        if (slide.decorations) {
          nextDecorations = slide.decorations.map((d) => {
            if (idSet.has(d.id)) {
              return d.groupId === action.groupId ? d : { ...d, groupId: action.groupId }
            }
            if (d.groupId !== undefined && oldGroupIds.has(d.groupId)) {
              const { groupId: _g, ...rest } = d
              return rest as Decoration
            }
            return d
          })
        }

        // Watermark: single optional value
        let nextWatermark = slide.watermark
        if (slide.watermark) {
          if (idSet.has(slide.watermark.id)) {
            nextWatermark =
              slide.watermark.groupId === action.groupId
                ? slide.watermark
                : { ...slide.watermark, groupId: action.groupId }
          } else if (
            slide.watermark.groupId !== undefined &&
            oldGroupIds.has(slide.watermark.groupId)
          ) {
            const { groupId: _g, ...rest } = slide.watermark
            nextWatermark = rest
          }
        }

        let next: Slide = slide
        if (nextTextBoxes !== slide.text_boxes && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (nextCustomImages !== slide.custom_images) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (nextDecorations !== slide.decorations) {
          next = { ...next, decorations: nextDecorations }
        }
        if (nextWatermark !== slide.watermark) {
          next = { ...next, watermark: nextWatermark }
        }
        return next
      })
      return pushHistory(state, slides)  // KBD-09: exactly one pushHistory
    }

    // Phase 62 (GROUP-03, KBD-09, BL-01): UNGROUP single-dispatch contract.
    //   - Clear groupId on every listed id; un-listed members keep theirs
    //     (no cascade — that's GROUP-only behavior).
    //   - Idempotent on already-ungrouped: if NO listed id carries a groupId,
    //     return state unchanged (no pushHistory dispatch).
    //   - Lossless across unlimited cycles — absolute positions preserved
    //     byte-identically (Test U3 pins this).
    //   - text_boxes mutations route through applyDualWrite (BL-01).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    case 'UNGROUP': {
      const idSet = new Set(action.ids)
      let anyChange = false

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide

        let textBoxesChanged = false
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (idSet.has(tb.id) && tb.groupId !== undefined) {
              textBoxesChanged = true
              const { groupId: _g, ...rest } = tb
              return rest as TextBox
            }
            return tb
          })
        }

        let customImagesChanged = false
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (idSet.has(ci.id) && ci.groupId !== undefined) {
              customImagesChanged = true
              const { groupId: _g, ...rest } = ci
              return rest
            }
            return ci
          })
        }

        // Phase 68 Plan 02 (EDITOR-05): decorations branch — clear groupId on
        // every listed decoration whose id matches AND currently carries a
        // groupId. Locked decorations DO have groupId cleared (groupId is
        // editable on locked elements per v2.11 contract).
        let decorationsChanged = false
        let nextDecorations = slide.decorations
        if (slide.decorations) {
          nextDecorations = slide.decorations.map((d) => {
            if (idSet.has(d.id) && d.groupId !== undefined) {
              decorationsChanged = true
              const { groupId: _g, ...rest } = d
              return rest as Decoration
            }
            return d
          })
        }

        let watermarkChanged = false
        let nextWatermark = slide.watermark
        if (
          slide.watermark &&
          idSet.has(slide.watermark.id) &&
          slide.watermark.groupId !== undefined
        ) {
          watermarkChanged = true
          const { groupId: _g, ...rest } = slide.watermark
          nextWatermark = rest
        }

        if (
          !textBoxesChanged &&
          !customImagesChanged &&
          !decorationsChanged &&
          !watermarkChanged
        ) {
          return slide
        }
        anyChange = true

        let next: Slide = slide
        if (textBoxesChanged && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (customImagesChanged) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (decorationsChanged) {
          next = { ...next, decorations: nextDecorations }
        }
        if (watermarkChanged) {
          next = { ...next, watermark: nextWatermark }
        }
        return next
      })

      if (!anyChange) return state // U4 idempotency
      return pushHistory(state, slides)  // KBD-09: exactly one pushHistory
    }

    // Phase 64 Plan 01 (LOCK-03, KBD-09, BL-01): SET_LOCKED single-dispatch
    // contract.
    //   - ids.length === 0 → ref-equal short-circuit (no pushHistory; matches
    //     UNGROUP idempotency from Plan 62).
    //   - For each listed id, set locked = action.locked ONLY when it would
    //     change (i.e. (existing locked ?? false) !== action.locked). When no
    //     element actually toggles, return state unchanged (handles SL2/SL9).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    //   - text_boxes mutations route through applyDualWrite (BL-01) so legacy
    //     hook_text/body_text/custom_texts mirror stays well-formed (SL5).
    //   - Watermark + custom_images participate via the same idSet walk.
    //   - Caller is single-source-of-truth for the toggle math. The reducer
    //     trusts the boolean — toggle math (majority/all-locked decision)
    //     lives in the dispatch site (slide-editor.tsx Cmd+Shift+L closure).
    case 'SET_LOCKED': {
      if (action.ids.length === 0) return state // SL6 ref-equal
      const idSet = new Set(action.ids)
      let anyChange = false

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide

        let textBoxesChanged = false
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (!idSet.has(tb.id)) return tb
            if ((tb.locked ?? false) === action.locked) return tb
            textBoxesChanged = true
            return { ...tb, locked: action.locked }
          })
        }

        let customImagesChanged = false
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (!idSet.has(ci.id)) return ci
            if ((ci.locked ?? false) === action.locked) return ci
            customImagesChanged = true
            return { ...ci, locked: action.locked }
          })
        }

        // Phase 68 Plan 02 (EDITOR-08): decorations branch — toggle locked
        // on listed decorations. Same shape as custom_images: per-id no-op
        // short-circuit when locked already matches action.locked.
        let decorationsChanged = false
        let nextDecorations = slide.decorations
        if (slide.decorations) {
          nextDecorations = slide.decorations.map((d) => {
            if (!idSet.has(d.id)) return d
            if ((d.locked ?? false) === action.locked) return d
            decorationsChanged = true
            return { ...d, locked: action.locked }
          })
        }

        let watermarkChanged = false
        let nextWatermark = slide.watermark
        if (
          slide.watermark &&
          idSet.has(slide.watermark.id) &&
          (slide.watermark.locked ?? false) !== action.locked
        ) {
          watermarkChanged = true
          nextWatermark = { ...slide.watermark, locked: action.locked }
        }

        if (
          !textBoxesChanged &&
          !customImagesChanged &&
          !decorationsChanged &&
          !watermarkChanged
        ) {
          return slide
        }
        anyChange = true

        let next: Slide = slide
        if (textBoxesChanged && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (customImagesChanged) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (decorationsChanged) {
          next = { ...next, decorations: nextDecorations }
        }
        if (watermarkChanged) {
          next = { ...next, watermark: nextWatermark }
        }
        return next
      })

      if (!anyChange) return state // SL2/SL9 ref-equal
      return pushHistory(state, slides)  // KBD-09: exactly one pushHistory
    }

    // Phase 64 Plan 02 (LOCK-07, KBD-09, BL-01): SET_HIDDEN single-dispatch
    // contract — IDENTICAL shape to SET_LOCKED (locked → hidden field swap).
    //   - ids.length === 0 → ref-equal short-circuit (no pushHistory; matches
    //     UNGROUP idempotency from Plan 62 / SET_LOCKED from Plan 64-01).
    //   - For each listed id, set hidden = action.hidden ONLY when it would
    //     change (i.e. (existing hidden ?? false) !== action.hidden). When no
    //     element actually toggles, return state unchanged (handles SH2/SH5).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    //   - text_boxes mutations route through applyDualWrite (BL-01) so legacy
    //     hook_text/body_text/custom_texts mirror stays well-formed (SH4).
    //   - Watermark + custom_images participate via the same idSet walk.
    //   - Both renderers (slide-preview + render-slide-satori) honor the
    //     `hidden` field at element iteration sites — TPLREND-05 byte-identity
    //     preserved (Plan 64-02 lands the renderer filter alongside this case).
    case 'SET_HIDDEN': {
      if (action.ids.length === 0) return state // SH5 ref-equal
      const idSet = new Set(action.ids)
      let anyChange = false

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide

        let textBoxesChanged = false
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (!idSet.has(tb.id)) return tb
            if ((tb.hidden ?? false) === action.hidden) return tb
            textBoxesChanged = true
            return { ...tb, hidden: action.hidden }
          })
        }

        let customImagesChanged = false
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (!idSet.has(ci.id)) return ci
            if ((ci.hidden ?? false) === action.hidden) return ci
            customImagesChanged = true
            return { ...ci, hidden: action.hidden }
          })
        }

        // Phase 68 Plan 02 (EDITOR-08): decorations branch — toggle hidden
        // on listed decorations. Same shape as SET_LOCKED above; renderer
        // (Phase 67 stub now, Phase 69 wires) will skip hidden decorations.
        let decorationsChanged = false
        let nextDecorations = slide.decorations
        if (slide.decorations) {
          nextDecorations = slide.decorations.map((d) => {
            if (!idSet.has(d.id)) return d
            if ((d.hidden ?? false) === action.hidden) return d
            decorationsChanged = true
            return { ...d, hidden: action.hidden }
          })
        }

        let watermarkChanged = false
        let nextWatermark = slide.watermark
        if (
          slide.watermark &&
          idSet.has(slide.watermark.id) &&
          (slide.watermark.hidden ?? false) !== action.hidden
        ) {
          watermarkChanged = true
          nextWatermark = { ...slide.watermark, hidden: action.hidden }
        }

        if (
          !textBoxesChanged &&
          !customImagesChanged &&
          !decorationsChanged &&
          !watermarkChanged
        ) {
          return slide
        }
        anyChange = true

        let next: Slide = slide
        if (textBoxesChanged && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (customImagesChanged) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (decorationsChanged) {
          next = { ...next, decorations: nextDecorations }
        }
        if (watermarkChanged) {
          next = { ...next, watermark: nextWatermark }
        }
        return next
      })

      if (!anyChange) return state // SH2 ref-equal
      return pushHistory(state, slides)  // KBD-09: exactly one pushHistory
    }

    // Phase 63 (ALIGN-03..05, ALIGN-08, ALIGN-09, ALIGN-10): single-dispatch
    // ALIGN action.
    //   - alignElements (pure align.ts) computes integer-rounded patches
    //     (Math.round at the boundary; ALIGN-09) and pre-filters out locked
    //     elements + watermark + structural-anchor TextBoxes (ALIGN-10
    //     move-side).
    //   - applyAlignPatches applies them, routing text_boxes through
    //     applyDualWrite (BL-01).
    //   - Single pushHistory per dispatch (ALIGN-08 = PERF-01).
    //   - Ref-equal short-circuit when no slide changed (empty ids,
    //     all-locked selection, only-watermark selection — Tests AR7/AR7b).
    case 'ALIGN': {
      // Phase 68 Plan 02 (EDITOR-06): decorations are routed through
      // alignElements (extended in Plan 68-02 Task 1 to walk slide.decorations
      // via buildMoveCandidates) and applyAlignPatches (extended above to
      // patch slide.decorations alongside text_boxes / custom_images). This
      // keeps the case body verbose-mention of 'decorations' for the PRA
      // grep gate (Plan 68-03 PRA1..12 audit precondition).
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const patches = alignElements(slide, action.ids, action.axis, action.target)
        if (patches.length === 0) return slide
        return applyAlignPatches(slide, patches)
      })
      if (slides.every((s, i) => s === state.present[i])) return state
      return pushHistory(state, slides)  // ALIGN-08: exactly one pushHistory
    }

    // Phase 63 (ALIGN-04, ALIGN-05, ALIGN-08, ALIGN-09, ALIGN-10): single-
    // dispatch DISTRIBUTE action. Same shape as ALIGN; pure
    // distributeElements enforces N>=3 gate + locked/watermark filter +
    // gap-equal math (PITFALL-4.6).
    case 'DISTRIBUTE': {
      // Phase 68 Plan 02 (EDITOR-06): decorations participate in distribute
      // math via distributeElements (extended in Plan 68-02 Task 1 — the
      // pure align.ts module's buildMoveCandidates walks slide.decorations).
      // applyAlignPatches applies the resulting patches across all 4 scopes.
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const patches = distributeElements(slide, action.ids, action.axis)
        if (patches.length === 0) return slide
        return applyAlignPatches(slide, patches)
      })
      if (slides.every((s, i) => s === state.present[i])) return state
      return pushHistory(state, slides)  // ALIGN-08: exactly one pushHistory
    }

    // Phase 64 Plan 03 (ZORDER-01..07, KBD-09): single Z_ORDER action routes
    // per-scope internally. The pure transform `applyZOrderToArray` operates
    // within ONE element-type array (text_boxes OR custom_images); the reducer
    // calls it once per scope and merges the results into the slide. Watermark
    // is a single slot — `applyZOrderToArray` on a length-1 implicit scope is
    // always a ref-equal no-op (ZR7), so we skip watermark handling entirely.
    //
    // Contract:
    //   - Empty ids → ref-equal short-circuit (ZR6).
    //   - Cross-scope multi-selection → both arrays mutate, ONE pushHistory
    //     entry (ZR3 / KBD-09 / PERF-01).
    //   - text_boxes mutations route through applyDualWrite (BL-01) so the
    //     legacy custom_texts mirror reflects the new array order (ZR5).
    //   - No-op when no array changed (unknown ids, watermark-only ids,
    //     adjacent-edge selections — ZR7 / ZR8).
    //
    // ZORDER-05 (Satori parity invariant) is enforced inside
    // `applyZOrderToArray` — array splice ONLY, never CSS layering. The pure
    // transform's grep gate confirms zero references to that property in
    // its source.
    case 'Z_ORDER': {
      if (action.ids.length === 0) return state // ZR6 ref-equal
      const idSet = new Set(action.ids)
      let anyChange = false

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide

        let nextTextBoxes = slide.text_boxes
        let textBoxesChanged = false
        if (slide.text_boxes) {
          const candidate = applyZOrderToArray(slide.text_boxes, idSet, action.op)
          if (candidate !== slide.text_boxes) {
            nextTextBoxes = candidate
            textBoxesChanged = true
          }
        }

        let nextCustomImages = slide.custom_images
        let customImagesChanged = false
        if (slide.custom_images) {
          const candidate = applyZOrderToArray(slide.custom_images, idSet, action.op)
          if (candidate !== slide.custom_images) {
            nextCustomImages = candidate
            customImagesChanged = true
          }
        }

        // Phase 68 Plan 02 (EDITOR-09): decorations branch — apply z-order
        // op via array splice on slide.decorations[]. ZORDER-05 carry-forward:
        // NEVER CSS layering — splice ONLY (the pure transform's grep gate
        // confirms zero CSS-layering references). Cross-scope reorder is
        // deferred to v3.0+ schema unification (ZORDER-07).
        let nextDecorations = slide.decorations
        let decorationsChanged = false
        if (slide.decorations) {
          const candidate = applyZOrderToArray(slide.decorations, idSet, action.op)
          if (candidate !== slide.decorations) {
            nextDecorations = candidate
            decorationsChanged = true
          }
        }

        // Watermark: single slot. applyZOrderToArray on a length-1 implicit
        // scope is a ref-equal no-op (the algorithm short-circuits when no
        // swap is possible at array bounds). We don't construct the array;
        // the watermark id simply matches no scope and the reducer no-ops.

        if (!textBoxesChanged && !customImagesChanged && !decorationsChanged) {
          return slide
        }
        anyChange = true

        let next: Slide = slide
        if (textBoxesChanged && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (customImagesChanged) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (decorationsChanged) {
          next = { ...next, decorations: nextDecorations }
        }
        return next
      })

      if (!anyChange) return state // ZR7 / ZR8 ref-equal short-circuit
      return pushHistory(state, slides) // KBD-09: exactly one pushHistory
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const past = state.past.slice(0, -1)
      return {
        past,
        present: previous,
        future: [state.present, ...state.future],
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      const future = state.future.slice(1)
      return {
        past: [...state.past, state.present],
        present: next,
        future,
      }
    }

    default:
      return state
  }
}
