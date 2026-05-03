'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 60 (SEL-01..04, SEL-10, SEL-11, SEL-15): canonical multi-select state.
 *
 * Selection lives OUTSIDE reducer history — mirrors the v2.8 single-id pattern
 * at use-slide-editor.ts:29 ("selection changes never push undo/redo"). This
 * hook generalizes that single slot into an insertion-ordered array of element
 * ids plus a "primary" pointer (most-recently-touched id).
 *
 * Two effects keep selection in sync with slide content WITHOUT putting the
 * selection itself inside the editor history:
 *
 *   1. SEL-10 — `useEffect` keyed on `slideIndex` clears selection on slide
 *      switch (matches existing single-select clear-on-slide-switch behavior).
 *
 *   2. SEL-11 — `useEffect` keyed on `presentSlides` prunes stale ids whenever
 *      slide content mutates (REMOVE_*, DUPLICATE_SLIDE id-regen, undo/redo).
 *      Stale ids drop silently; if the primary id is among them, primary
 *      clears to null (NOT auto-promoted to "next remaining" — the right rail
 *      has no key-object UX, see PITFALLS 12.3).
 *
 * The mutator API exposes 6 ops: replaceWith / addToSelection /
 * removeFromSelection / toggleInSelection / clear / selectAll. ALL spread
 * via `[...prev, id]` (NEVER `prev.add(id)` or Set-mutation, see PITFALLS
 * 1.4) so reference identity changes only when content changes — keeping
 * effect deps stable.
 *
 * The returned object is wrapped in `useMemo` so consumers don't see a new
 * `model` reference on every render unless `ids` / `primary` actually change
 * (mirrors use-slide-editor.ts:51-65 pattern).
 */
export interface Selection {
  /** Insertion-ordered list of selected element ids. Order matters for
      Phase 63 distribute-edge math; do NOT replace with Set. */
  ids: string[]
  /** Most-recently-added id. Drives "primary" visual indicator in the
      layer chip. NOTE: NOT exposed to the right rail — there is NO
      key-object UX (PITFALL-12.3). */
  primary: string | null
}

export interface SelectionModel {
  ids: string[]
  primary: string | null
  /** Replace the entire selection. primary becomes the LAST id (or null if empty). */
  replaceWith(ids: string[]): void
  /** Append id to selection if not already present. primary becomes id. */
  addToSelection(id: string): void
  /** Remove id from selection. primary clears if it matched. */
  removeFromSelection(id: string): void
  /** Toggle id in/out. If toggling out the primary, primary clears. */
  toggleInSelection(id: string): void
  /** Clear selection entirely. */
  clear(): void
  /** Select all addressable elements on the given slide:
      text_boxes ∪ custom_images ∪ (watermark if present). */
  selectAll(slide: Slide): void
  /** Phase 60 (SEL-02/03/09): React-style setter accepting a {Selection} or
      a `(prev: Selection) => Selection` updater. Used by slide-preview's
      Shift-click handlers + canvas-empty-onClick (SEL-09). The model's
      replaceWith / toggleInSelection / clear already cover discrete ops; this
      setter is for callers that need to compute the next selection from prev
      synchronously inside an event handler. */
  setSelection(next: Selection | ((prev: Selection) => Selection)): void
}

export function useSelectionModel(opts: {
  slideIndex: number
  presentSlides: Slide[]
}): SelectionModel {
  const [ids, setIds] = useState<string[]>([])
  const [primary, setPrimary] = useState<string | null>(null)

  // Phase 60 (SEL-02/03): mirror current state in a ref so setSelection's
  // functional-updater branch can compute `(prev) => next` synchronously
  // without nesting setState calls. Refs are read-only outside the render
  // (no re-render triggered), and the effects below keep them in sync.
  const idsRef = useRef<string[]>(ids)
  const primaryRef = useRef<string | null>(primary)
  useEffect(() => {
    idsRef.current = ids
  }, [ids])
  useEffect(() => {
    primaryRef.current = primary
  }, [primary])

  // SEL-10: clear on slide switch.
  // Independent of stale-id logic — slide-switch ALWAYS clears, even if the
  // selected id would have remained valid on the new slide.
  useEffect(() => {
    setIds([])
    setPrimary(null)
  }, [opts.slideIndex])

  // SEL-11: prune stale ids when slide content mutates (undo/redo + removals
  // + DUPLICATE_SLIDE id-regen). Filters `ids` against the union of valid ids
  // on the currently-selected slide; clears `primary` if it's no longer valid.
  useEffect(() => {
    const slide = opts.presentSlides[opts.slideIndex]
    if (!slide) {
      setIds((prev) => (prev.length === 0 ? prev : []))
      setPrimary((prev) => (prev === null ? prev : null))
      return
    }
    const validIds = new Set<string>([
      ...(slide.text_boxes ?? []).map((tb) => tb.id),
      ...(slide.custom_images ?? []).map((ci) => ci.id),
      ...(slide.watermark ? [slide.watermark.id] : []),
    ])
    setIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
    setPrimary((prev) => (prev && validIds.has(prev) ? prev : null))
  }, [opts.presentSlides, opts.slideIndex])

  const replaceWith = useCallback((next: string[]) => {
    setIds(next)
    setPrimary(next.length > 0 ? next[next.length - 1] : null)
  }, [])

  const addToSelection = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setPrimary(id)
  }, [])

  const removeFromSelection = useCallback((id: string) => {
    setIds((prev) => prev.filter((x) => x !== id))
    setPrimary((prev) => (prev === id ? null : prev))
  }, [])

  const toggleInSelection = useCallback((id: string) => {
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
    setPrimary((prev) => (prev === id ? null : id))
  }, [])

  const clear = useCallback(() => {
    setIds([])
    setPrimary(null)
  }, [])

  const selectAll = useCallback((slide: Slide) => {
    const all: string[] = [
      ...(slide.text_boxes ?? []).map((tb) => tb.id),
      ...(slide.custom_images ?? []).map((ci) => ci.id),
      ...(slide.watermark ? [slide.watermark.id] : []),
    ]
    setIds(all)
    setPrimary(all.length > 0 ? all[all.length - 1] : null)
  }, [])

  const setSelection = useCallback(
    (next: Selection | ((prev: Selection) => Selection)) => {
      if (typeof next === 'function') {
        // Phase 60 (SEL-02/03): functional updater branch — compute next state
        // from refs (kept in sync via the effects above). Refs hold the most
        // recent committed values, so a Shift-click handler firing in rapid
        // succession reads the post-commit state. Both setters then receive
        // the computed values directly (no nested setState).
        const result = (next as (prev: Selection) => Selection)({
          ids: idsRef.current,
          primary: primaryRef.current,
        })
        setIds(result.ids)
        setPrimary(result.primary)
        return
      }
      setIds(next.ids)
      setPrimary(next.primary)
    },
    [],
  )

  return useMemo(
    () => ({
      ids,
      primary,
      replaceWith,
      addToSelection,
      removeFromSelection,
      toggleInSelection,
      clear,
      selectAll,
      setSelection,
    }),
    [
      ids,
      primary,
      replaceWith,
      addToSelection,
      removeFromSelection,
      toggleInSelection,
      clear,
      selectAll,
      setSelection,
    ],
  )
}
