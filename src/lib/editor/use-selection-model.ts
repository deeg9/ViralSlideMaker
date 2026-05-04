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
 *
 * Phase 62 (GROUP-07, GROUP-08): adds `currentlyInsideGroup: string | null`
 * + `enterGroup(elementId, slide)` + `exitGroup()`. The "inside group" flag
 * carries forward the Plan 60-03 selection-state-outside-reducer-history
 * invariant: it lives in `useState` (mirrored via `useRef` for synchronous
 * reads), NEVER inside the editor reducer's pushHistory pipeline. The
 * SEL-10 (slide-switch) and SEL-11 (stale-id prune) effects ALSO clear the
 * flag so it stays in lock-step with the rest of the selection state.
 *
 * Known gap: `enterGroup` takes the slide as a 2nd arg by design — the hook
 * resolves the element's groupId without holding a slide reference internally
 * (avoids a useEffect explosion). Phase 65 (layers panel) may want a
 * slide-bound variant; defer.
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
  /** Phase 62 (GROUP-07): groupId of the group the user is currently editing
      "inside" (set by double-click; cleared by Esc / click-outside / slide-
      switch / stale-id prune). When null, click selects the group; when set,
      click selects the leaf element inside the group. State lives in React
      useState — NEVER inside the editor reducer history (Plan 60-03 invariant
      carry-forward). */
  currentlyInsideGroup: string | null
  /** Phase 62 (GROUP-07): set `currentlyInsideGroup` to the element's groupId.
      No-op when the element has no groupId or the id is not on the slide.
      Takes `slide` as a 2nd arg so the hook can resolve groupId without
      holding a slide reference internally (avoids a useEffect explosion). */
  enterGroup(elementId: string, slide: Slide): void
  /** Phase 62 (GROUP-08): clear `currentlyInsideGroup` to null. Idempotent —
      the callback ref is stable, and a second call when already null produces
      no observable state change. */
  exitGroup(): void
}

export function useSelectionModel(opts: {
  slideIndex: number
  presentSlides: Slide[]
}): SelectionModel {
  const [ids, setIds] = useState<string[]>([])
  const [primary, setPrimary] = useState<string | null>(null)
  // Phase 62 (GROUP-07): "inside group" flag — groupId the user has
  // double-clicked into, or null. Lives in React useState so it never
  // enters the editor reducer history (Plan 60-03 carry-forward).
  const [currentlyInsideGroup, setCurrentlyInsideGroup] = useState<string | null>(null)

  // Phase 60 (SEL-02/03): mirror current state in a ref so setSelection's
  // functional-updater branch can compute `(prev) => next` synchronously
  // without nesting setState calls. Refs are read-only outside the render
  // (no re-render triggered), and the effects below keep them in sync.
  const idsRef = useRef<string[]>(ids)
  const primaryRef = useRef<string | null>(primary)
  // Phase 62 (GROUP-07): mirror the in-group flag for synchronous reads
  // in event handlers (matches the idsRef/primaryRef pattern).
  const insideGroupRef = useRef<string | null>(currentlyInsideGroup)
  useEffect(() => {
    idsRef.current = ids
  }, [ids])
  useEffect(() => {
    primaryRef.current = primary
  }, [primary])
  useEffect(() => {
    insideGroupRef.current = currentlyInsideGroup
  }, [currentlyInsideGroup])

  // SEL-10: clear on slide switch.
  // Independent of stale-id logic — slide-switch ALWAYS clears, even if the
  // selected id would have remained valid on the new slide.
  // Phase 62: ALSO clears currentlyInsideGroup (a group never spans slides;
  // the in-group flag is meaningless after a slide switch).
  useEffect(() => {
    setIds([])
    setPrimary(null)
    setCurrentlyInsideGroup(null)
  }, [opts.slideIndex])

  // SEL-11: prune stale ids when slide content mutates (undo/redo + removals
  // + DUPLICATE_SLIDE id-regen). Filters `ids` against the union of valid ids
  // on the currently-selected slide; clears `primary` if it's no longer valid.
  // Phase 62: ALSO computes the union of groupIds reachable from surviving
  // elements; if `currentlyInsideGroup` is no longer in that set, the flag
  // clears. Mirrors the SEL-11 stale-id contract for the in-group state.
  useEffect(() => {
    const slide = opts.presentSlides[opts.slideIndex]
    if (!slide) {
      setIds((prev) => (prev.length === 0 ? prev : []))
      setPrimary((prev) => (prev === null ? prev : null))
      setCurrentlyInsideGroup((prev) => (prev === null ? prev : null))
      return
    }
    // Phase 68 Plan 01 (EDITOR-03): validIds set walks all 4 AddressableScopes
    // — decorations participate in stale-id prune identically to text_boxes /
    // custom_images / watermark. When `slide.decorations === undefined`, the
    // `?? []` produces zero entries (backward-compat preserved).
    const validIds = new Set<string>([
      ...(slide.text_boxes ?? []).map((tb) => tb.id),
      ...(slide.custom_images ?? []).map((ci) => ci.id),
      ...(slide.decorations ?? []).map((d) => d.id),
      ...(slide.watermark ? [slide.watermark.id] : []),
    ])
    const validGroupIds = new Set<string>()
    for (const tb of slide.text_boxes ?? []) {
      if (tb.groupId !== undefined) validGroupIds.add(tb.groupId)
    }
    for (const ci of slide.custom_images ?? []) {
      if (ci.groupId !== undefined) validGroupIds.add(ci.groupId)
    }
    // Phase 68 Plan 01 (EDITOR-03): validGroupIds set walks decorations.
    // Without this loop, a decoration carrying a groupId would have its
    // group's "currentlyInsideGroup" flag wrongly cleared by the stale-id
    // prune when the only group-carrier is a decoration.
    for (const d of slide.decorations ?? []) {
      if (d.groupId !== undefined) validGroupIds.add(d.groupId)
    }
    if (slide.watermark && slide.watermark.groupId !== undefined) {
      validGroupIds.add(slide.watermark.groupId)
    }
    setIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
    setPrimary((prev) => (prev && validIds.has(prev) ? prev : null))
    setCurrentlyInsideGroup((prev) =>
      prev !== null && !validGroupIds.has(prev) ? null : prev,
    )
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

  // Phase 68 Plan 01 (EDITOR-03): selectAll walks all 4 AddressableScopes.
  // Composition order: text_boxes ∪ custom_images ∪ decorations ∪ watermark
  // (ARCHITECTURE.md R4 — decorations BEFORE watermark; watermark trails
  // because it is a singleton and Phase 60 SEL-01 ordering pinned watermark
  // last in selection composition). This order is DIFFERENT from the
  // ALL_ADDRESSABLE_SCOPES tuple in addressable-scope.ts which puts
  // decorations LAST — the tuple is the canonical AUDIT order; selectAll's
  // sequence is the canonical SELECTION composition.
  const selectAll = useCallback((slide: Slide) => {
    const all: string[] = [
      ...(slide.text_boxes ?? []).map((tb) => tb.id),
      ...(slide.custom_images ?? []).map((ci) => ci.id),
      ...(slide.decorations ?? []).map((d) => d.id),
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

  // Phase 62 (GROUP-07): enter group by element id. Walks text_boxes ∪
  // custom_images ∪ watermark on the supplied slide; if the element exists
  // and carries a groupId, set currentlyInsideGroup to that groupId.
  // Otherwise no-op (unknown id OR ungrouped element). Caller passes the
  // slide so the hook stays decoupled from the slide reference (avoids a
  // useEffect explosion).
  const enterGroup = useCallback((elementId: string, slide: Slide) => {
    const tb = (slide.text_boxes ?? []).find((t) => t.id === elementId)
    if (tb) {
      if (tb.groupId !== undefined) setCurrentlyInsideGroup(tb.groupId)
      return
    }
    const ci = (slide.custom_images ?? []).find((c) => c.id === elementId)
    if (ci) {
      if (ci.groupId !== undefined) setCurrentlyInsideGroup(ci.groupId)
      return
    }
    // Phase 68 Plan 01 (EDITOR-03): walk decorations. Order matches the
    // existing scope-walk pattern; decoration is the 4th branch alongside
    // text_boxes / custom_images / watermark. When `decoration.groupId`
    // is undefined, fall through silently (matches v2.11 ungrouped-element
    // contract — no-op rather than throw).
    const d = (slide.decorations ?? []).find((x) => x.id === elementId)
    if (d) {
      if (d.groupId !== undefined) setCurrentlyInsideGroup(d.groupId)
      return
    }
    if (slide.watermark && slide.watermark.id === elementId) {
      if (slide.watermark.groupId !== undefined) {
        setCurrentlyInsideGroup(slide.watermark.groupId)
      }
      return
    }
    // Unknown id → no-op (silent, no throw)
  }, [])

  // Phase 62 (GROUP-08): exit group → clear the in-group flag. Idempotent
  // when already null (functional updater preserves the prev reference).
  const exitGroup = useCallback(() => {
    setCurrentlyInsideGroup((prev) => (prev === null ? prev : null))
  }, [])

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
      currentlyInsideGroup,
      enterGroup,
      exitGroup,
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
      currentlyInsideGroup,
      enterGroup,
      exitGroup,
    ],
  )
}
