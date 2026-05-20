'use client'

import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { useSlideEditor } from '@/lib/editor/use-slide-editor'
import { getTemplate, TEMPLATE_IDS } from '@/lib/render/templates/index'
import type { PickerDbTemplate } from '@/lib/render/templates/registry'
import { synthesizeBrandKitTemplate, BRAND_KIT_TEMPLATE_ID } from '@/lib/brand-kit/get-effective-template'
import { SlideList } from '@/components/editor/slide-list'
import { SlideCanvas } from '@/components/editor/slide-canvas'
import { TextEditorPanel } from '@/components/editor/text-editor-panel'
import { LegacyTextEditorPanel } from '@/components/editor/text-editor-panel-legacy'
import { ImagePickerPanel } from '@/components/editor/image-picker-panel'
import { ElementsPanel } from '@/components/editor/elements-panel'
import LayersPanel from '@/components/editor/layers-panel/layers-panel'
import { Icon } from '@/components/ui/icon'
import { downloadSlidesAsZip } from '@/lib/download/zip-slides'
import { VisibilityDropdown } from '@/components/editor/visibility-dropdown'
import {
  saveSlideData,
  saveTemplateId,
  regenerateSlideText,
  regenerateSlideImageQuery,
  updateProjectWatermark,
  createUploadUrl,
  type WatermarkSpec,
} from '@/app/(dashboard)/project/[id]/editor-actions'
import { textBoxesToLegacy } from '@/lib/editor/text-box-adapter'
import { useSelectionModel } from '@/lib/editor/use-selection-model'
import { isEditingTarget } from '@/lib/editor/keyboard-utils'
import { getGroupMembers } from '@/lib/editor/transforms/group-membership'
// Phase 70 Plan 03 (PICKER-07 + KBD-10 + KBD-11): decoration picker mounts +
// R/C/L direct-insert + I/S picker-open shortcuts. The barrel re-exports the
// LAZY LucidePickerDynamic (next/dynamic, ssr:false) — never import the eager
// LucidePicker directly (DEPS-05 lazy-load contract).
import {
  LucidePickerDynamic,
  ShapePicker,
  buildDefaultShapeDecoration,
} from '@/components/editor/decoration-picker'
import type { Decoration } from '@/lib/types/decoration'
// Phase 63 Plan 02 (ALIGN-01..06): types for the 6-axis align + 2-axis distribute
// dispatch shape. Imported here so both the tinykeys handlers and the handleAlign
// callback wired to SlideCanvas.onAlign use the SAME ALIGN/DISTRIBUTE action
// shape. Plan 63-01 ships the reducer cases + pure transforms; this plan wires
// keyboard + toolbar to dispatch.
import type {
  AlignAxis,
  AlignTarget,
  DistributeAxis,
} from '@/lib/editor/transforms/align'
import type { ToolbarAction } from '@/components/editor/floating-alignment-toolbar'
import { tinykeys } from 'tinykeys'
import type { Slide, TextPosition, CustomText } from '@/lib/types/slide'
import type { BrandKit } from '@/lib/types/brand-kit'

// ──────────────────────────────────────────────────────────────────────────
// Phase 66 Plan 01 (KBD-05 / KBD-06 / DIFF-02): nudge magnitudes in % of
// canvas. REF_WIDTH=1080 / REF_HEIGHT=1920 are the canonical reference
// dimensions used by every position field in the schema (slide.text_boxes[]
// .position.x/y; slide.custom_images[].x/y are also % of REF_WIDTH/HEIGHT).
//
// Plain Arrow → 1 ref-px (Figma + Canva default; FEATURES F36/F37).
// Shift+Arrow → 10 ref-px (10× scale; KBD-06).
// DIFF-02 default duplicate offset → 20 ref-px right + down (matches Figma's
// Cmd+D fallback when no prior move-delta has been recorded).
// ──────────────────────────────────────────────────────────────────────────
const NUDGE_X_SMALL_PCT = 100 / 1080         // 1 ref-px horizontally  ≈ 0.0926%
const NUDGE_X_LARGE_PCT = 1000 / 1080        // 10 ref-px horizontally ≈ 0.9259%
const NUDGE_Y_SMALL_PCT = 100 / 1920         // 1 ref-px vertically    ≈ 0.0521%
const NUDGE_Y_LARGE_PCT = 1000 / 1920        // 10 ref-px vertically   ≈ 0.5208%
const DEFAULT_DUPLICATE_OFFSET_X_PCT = 2000 / 1080  // 20 ref-px ≈ 1.852%
const DEFAULT_DUPLICATE_OFFSET_Y_PCT = 2000 / 1920  // 20 ref-px ≈ 1.042%

export interface InitialPublishedState {
  publishedId: string
  slug: string
  tags: string[]
}

interface SlideEditorProps {
  initialSlides: Slide[]
  projectId: string
  templateId: string
  topic: string
  title?: string
  userTier?: 'free' | 'pro' | 'plus'
  brandKit?: BrandKit | null
  initialPublishedState?: InitialPublishedState | null
  /** Phase 88 (WIRE-03): DB-backed templates fetched server-side by the
   *  project page. The editor resolves a DB project template_id from this
   *  list (code templates still resolve via the sync getTemplate registry).
   *  Defaults to [] so existing callers / tests are unaffected. */
  dbTemplates?: PickerDbTemplate[]
}

export function SlideEditor({
  initialSlides,
  projectId,
  templateId,
  topic,
  title,
  userTier,
  brandKit,
  initialPublishedState,
  dbTemplates = [],
}: SlideEditorProps) {
  const {
    slides,
    dispatch,
    canUndo,
    canRedo,
    undo,
    redo,
    isDirty,
    selectedTextBoxId,
    setSelectedTextBoxId,
    removeTextBox,
  } = useSlideEditor(initialSlides)
  const [currentTemplateId, setCurrentTemplateId] = useState(templateId)
  // Phase 88 (WIRE-03): resolve currentTemplateId. Brand-kit synthesizes from
  // the user's brand_kit row at render time. A code template id resolves via
  // the sync getTemplate registry. A DB template id (not in TEMPLATE_IDS)
  // resolves from the server-fetched dbTemplates list; if not found there
  // either, getTemplate's templates[0] fallback applies (graceful — STYLESPEC
  // discipline). Falls back to the first registry entry when brand-kit is
  // selected but the brand kit was deleted.
  const dbMatch = dbTemplates.find((d) => d.template.id === currentTemplateId)
  const template =
    currentTemplateId === BRAND_KIT_TEMPLATE_ID && brandKit
      ? synthesizeBrandKitTemplate(brandKit)
      : TEMPLATE_IDS.includes(currentTemplateId)
        ? getTemplate(currentTemplateId)
        : (dbMatch?.template ?? getTemplate(currentTemplateId))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'text' | 'elements' | 'images'>('text')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [exporting, setExporting] = useState(false)
  const [selectedCustomTextId, setSelectedCustomTextId] = useState<string | null>(null)
  const [selectedCustomImageId, setSelectedCustomImageId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // quick-260502-fai: hoisted above the watermark handlers so they can read
  // the slide's existing style_overrides.watermark when dispatching UPDATE_SLIDE.
  // (Previously declared further down, near the keyboard-shortcut effect.)
  const currentSlide = slides[selectedIndex]

  // Phase 60 (60-04): canonical multi-select state. Layered ALONGSIDE the
  // existing legacy `selectedTextBoxId` (Phase 49) so v2.8 single-select
  // consumers (SlideCanvas, TextEditorPanel) keep working unchanged. Keyboard
  // handlers below write to BOTH so the new model and the legacy slot stay
  // in sync until Phase 66 retires the shim.
  const selection = useSelectionModel({ slideIndex: selectedIndex, presentSlides: slides })

  // quick-260514-jn5: resolve the active decoration at the editor level so:
  //   1. activeTab auto-switches to 'elements' when selection.primary is a
  //      decoration (clicking an icon/shape on the canvas routes the user to
  //      the Elements tab where editing controls live).
  //   2. ElementsPanel renders <DecorationCard> in selection mode — the
  //      Elements tab is now the single home for decoration editing.
  //      TextEditorPanel no longer renders the card (Text tab stays focused
  //      on text-box editing).
  // Mirrors the resolution previously in text-editor-panel.tsx (CARD-01).
  // Stale primary id (decoration removed or wrong slide) → null, which lets
  // the panel fall back to library mode and the effect leave activeTab alone.
  const activeDecoration = useMemo<Decoration | null>(() => {
    if (!selection?.primary || !currentSlide) return null
    return (
      (currentSlide.decorations ?? []).find((d) => d.id === selection.primary) ?? null
    )
  }, [selection?.primary, currentSlide])

  // Auto-switch to the Elements tab when a decoration becomes selected.
  // Only fires on selection transitions (we depend on the id, not the
  // object) so the user can still manually click Text/Images while a
  // decoration is selected without us yanking the tab back.
  useEffect(() => {
    if (activeDecoration && activeTab !== 'elements') {
      setActiveTab('elements')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDecoration?.id])

  // Phase 66 Plan 01 (DIFF-02): tracks the most recent BULK_TRANSLATE delta
  // (drag-stop OR arrow-nudge) in % of canvas. Read by the $mod+d (Cmd+D
  // smart-offset) handler — null on first use; falls back to
  // DEFAULT_DUPLICATE_OFFSET_*. useRef instead of useState because mutations
  // must NEVER trigger re-renders (PERF-01 carry-forward — refs for hot-path
  // state, matching Plan 60-04 useModifierState pattern).
  const lastMoveDeltaRef = useRef<{ x: number; y: number } | null>(null)

  // Phase 70 Plan 03 (PICKER-07 + KBD-11): picker open state + ref-only firewall.
  // openPicker is React state (drives JSX mount/unmount); isPickerOpenRef
  // mirrors `openPicker !== null` and is read INSIDE every tinykeys binding
  // body as a SECOND short-circuit `if (isEditingTarget(e.target) ||
  // isPickerOpenRef.current) return`. Refs-only contract from v2.11 SWEEP-1..4
  // — useRef avoids the re-render churn that useState would trigger on every
  // open/close, which matters because the keyboard handler closure captures
  // every render's snapshot of the binding map. setOpenPicker updates BOTH
  // the state and the ref synchronously to avoid the "stale ref read" race
  // that would happen if the ref only updated on next render.
  //
  // Single state-machine shape (`'lucide' | 'shape' | null`) was chosen over
  // two parallel boolean states because it makes the firewall sync trivial
  // and forbids the impossible "both pickers open simultaneously" state.
  const [openPicker, _setOpenPicker] = useState<'lucide' | 'shape' | null>(null)
  const isPickerOpenRef = useRef<boolean>(false)
  const setOpenPicker = useCallback((next: 'lucide' | 'shape' | null) => {
    _setOpenPicker(next)
    isPickerOpenRef.current = next !== null
  }, [])

  // quick-260514-icon-pill: picker mode. 'add' = default (insert a new
  // decoration). 'swap-icon' = the inspector's icon-pill was clicked, so when
  // the user picks an icon in the modal we UPDATE the currently selected
  // decoration's lucideName instead of inserting a new one. The target id is
  // captured here at click time so a stale activeDecoration during the picker
  // session can't redirect the swap.
  const [pickerMode, setPickerMode] = useState<
    { kind: 'add' } | { kind: 'swap-icon'; targetId: string }
  >({ kind: 'add' })

  // Phase 70 Plan 03 (PICKER-05 D-CLICK-INSERT carry-forward): the shared
  // onAddDecoration handler. Both pickers (LucidePicker + ShapePicker) call
  // this to dispatch ADD_DECORATION + auto-select the new id via
  // selection.replaceWith. Single pushHistory entry per insert (Phase 68
  // reducer invariant + KBD-09 carry-forward). The R/C/L direct-insert
  // bindings inline this same flow (they don't go through the picker so the
  // useCallback identity is irrelevant there).
  //
  // quick-260514-icon-pill: if pickerMode is 'swap-icon', dispatch
  // UPDATE_DECORATION on the captured target id instead. Position/color/size
  // are preserved by construction (only lucideName + name change).
  const onPickerAddDecoration = useCallback((d: Decoration) => {
    if (pickerMode.kind === 'swap-icon' && d.kind === 'icon') {
      dispatch({
        type: 'UPDATE_DECORATION',
        slideIndex: selectedIndex,
        id: pickerMode.targetId,
        // Clear any user-set `name` so the new lucideName becomes the visible
        // label. Color/position/strokeWidth on the existing decoration are
        // intentionally preserved.
        updates: { lucideName: d.lucideName, name: undefined } as Partial<Decoration>,
      })
      setPickerMode({ kind: 'add' })
      return
    }
    dispatch({ type: 'ADD_DECORATION', slideIndex: selectedIndex, decoration: d })
    selection.replaceWith([d.id])
  }, [dispatch, selectedIndex, selection, pickerMode])

  // quick-260514-drop-photo-treatment-white-cards: photo-treatment controls
  // were removed from the right rail. The reducer slot
  // (style_overrides.treatment_applied / .grain_intensity) and the server
  // action `updateSlideTreatment` are intentionally kept so legacy slides
  // still render their treated background without divergence — the UI is
  // simply no longer mounted. Remount PhotoTreatmentControls in
  // text-editor-panel.tsx and restore handleSlideTreatmentChange + isTreatmentPending
  // to bring the surface back.

  // quick-260502-er5: per-slide watermark override handling.
  // quick-260502-fai: also dispatch so the editor's React state reflects the
  // change immediately — the server action alone does not flow back into the
  // reducer, so without the dispatch the Switch + preview stay out of sync
  // until a hard refresh.
  // quick-260502-ik8: watermark is a project-wide setting — every slide gets
  // the same patch. Build the new slides[] client-side (mirroring
  // updateProjectWatermark's server-side merge) and dispatch SET_SLIDES so the
  // broadcast lands as ONE undo step. The server confirms via
  // updateProjectWatermark.
  const [isWatermarkPending, startWatermarkTransition] = useTransition()
  const handleSlideWatermarkChange = useCallback((spec: WatermarkSpec) => {
    const next = slides.map((s) => {
      const existing = s.style_overrides?.watermark ?? {}
      return {
        ...s,
        style_overrides: {
          ...(s.style_overrides ?? {}),
          watermark: { ...existing, ...spec },
        },
      }
    })
    dispatch({ type: 'SET_SLIDES', slides: next })
    startWatermarkTransition(async () => {
      const result = await updateProjectWatermark(projectId, spec)
      if (!result.success) {
        console.warn('[updateProjectWatermark] failed:', result.error)
      }
    })
  }, [projectId, slides, dispatch])

  // quick-260502-fai: dispatch after a successful PUT so the logo preview
  // thumbnail appears in WatermarkControls without a refresh. Sync runs
  // BEFORE the awaited server action so the UI flips immediately.
  // quick-260502-ik8: now a project-wide broadcast — set customLogoUrl on
  // every slide and persist via updateProjectWatermark.
  const handleWatermarkLogoUpload = useCallback((file: File) => {
    startWatermarkTransition(async () => {
      try {
        const uploadInfo = await createUploadUrl(projectId, file.name)
        const putRes = await fetch(uploadInfo.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!putRes.ok) {
          console.warn('[watermarkLogoUpload] PUT failed:', putRes.status)
          return
        }
        const next = slides.map((s) => {
          const existing = s.style_overrides?.watermark ?? {}
          return {
            ...s,
            style_overrides: {
              ...(s.style_overrides ?? {}),
              watermark: { ...existing, customLogoUrl: uploadInfo.publicUrl },
            },
          }
        })
        dispatch({ type: 'SET_SLIDES', slides: next })
        const result = await updateProjectWatermark(projectId, {
          customLogoUrl: uploadInfo.publicUrl,
        })
        if (!result.success) {
          console.warn('[watermarkLogoUpload] persist failed:', result.error)
        }
      } catch (e) {
        console.warn('[watermarkLogoUpload] error:', (e as Error).message)
      }
    })
  }, [projectId, slides, dispatch])

  // quick-260502-fai: dispatch clearing customLogoUrl so the upload button
  // reappears in WatermarkControls without a refresh.
  // quick-260502-ik8: now a project-wide broadcast — clear customLogoUrl on
  // every slide and persist via updateProjectWatermark.
  const handleWatermarkLogoRemove = useCallback(() => {
    const next = slides.map((s) => {
      const existing = s.style_overrides?.watermark ?? {}
      return {
        ...s,
        style_overrides: {
          ...(s.style_overrides ?? {}),
          watermark: { ...existing, customLogoUrl: undefined },
        },
      }
    })
    dispatch({ type: 'SET_SLIDES', slides: next })
    startWatermarkTransition(async () => {
      const result = await updateProjectWatermark(projectId, {
        customLogoUrl: undefined,
      })
      if (!result.success) {
        console.warn('[watermarkLogoRemove] failed:', result.error)
      }
    })
  }, [projectId, slides, dispatch])

  // Phase 50 (D-19): feature flag to route between the new selection-driven
  // TextEditorPanel and the preserved LegacyTextEditorPanel. Default is the
  // new rail; setting NEXT_PUBLIC_NEW_TEXT_RAIL=false rolls back without
  // a rebuild (Next inlines NEXT_PUBLIC_* at build, so a rebuild is still
  // needed for prod — but local dev picks it up on restart). Sunset target: v2.9.
  const useNewRail = process.env.NEXT_PUBLIC_NEW_TEXT_RAIL !== 'false'

  useEffect(() => {
    if (selectedIndex >= slides.length) {
      setSelectedIndex(Math.max(0, slides.length - 1))
    }
  }, [slides.length, selectedIndex])

  // Clear selections when switching slides
  // Phase 49 (MR-02): also clear selectedTextBoxId — without this, a stale text-box
  // ID survives the slide switch and either silently lapses on the new slide or
  // (post-MR-01) accidentally re-selects an unrelated box.
  // Phase 50 (T-04): seed selectedTextBoxId to the new slide's first text box
  // (typically the hook). The new right rail always has SOMETHING to show. If
  // text_boxes is empty (legacy untouched slide pre-eager-migration), drop to
  // null and ActiveTextBoxCard renders the empty state.
  useEffect(() => {
    setSelectedCustomTextId(null)
    setSelectedCustomImageId(null)
    const firstId = slides[selectedIndex]?.text_boxes?.[0]?.id ?? null
    setSelectedTextBoxId(firstId)
    // We intentionally depend on selectedIndex + the slides reference; pulling
    // text_boxes through a stable identity (slide id) would be cleaner, but
    // without slide ids we settle for selectedIndex (covers the "user moved
    // to a new slide" case) and let stale-text-box-id resolve to first-box
    // via ActiveTextBoxCard's resolver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex])

  const doSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      // Phase 49: Dual-write — when text_boxes is the canonical source, regenerate the legacy
      // hook_text/body_text/segments/custom_texts fields so older clients/exports/cron jobs keep
      // working. Sunset target: v2.9.
      //
      // Phase 50 (BL-01) note: the editor reducer now applies the same write-through on
      // every ADD_TEXT_BOX / UPDATE_TEXT_BOX / REMOVE_TEXT_BOX action, so `slides` already
      // has both shapes synced. This block is now belt-and-suspenders — kept for defense-
      // in-depth in case a future call site mutates text_boxes outside the reducer.
      const slidesForSave: Slide[] = slides.map((slide) => {
        if (!slide.text_boxes) return slide
        const slice = textBoxesToLegacy(slide.text_boxes)
        const out: Slide = {
          ...slide,
          hook_text: slice.hook_text,
          body_text: slice.body_text,
        }
        if (slice.hook_segments !== undefined) out.hook_segments = slice.hook_segments
        else delete out.hook_segments
        if (slice.body_segments !== undefined) out.body_segments = slice.body_segments
        else delete out.body_segments
        if (slice.custom_texts !== undefined) out.custom_texts = slice.custom_texts
        else delete out.custom_texts
        if (Object.keys(slice.style_overrides_patch).length > 0 || slide.style_overrides) {
          out.style_overrides = {
            ...(slide.style_overrides ?? {}),
            ...slice.style_overrides_patch,
          }
        }
        return out
      })
      await saveSlideData(projectId, slidesForSave)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [projectId, slides])

  useEffect(() => {
    if (!isDirty) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(doSave, 2000)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [isDirty, doSave])

  // Phase 60 (60-04, KBD-01..04, SEL-07, SEL-08): keyboard shortcuts on the editor.
  //   Cmd/Ctrl+1, +2, +3 → select Nth text box on current slide
  //   Cmd/Ctrl+D         → add a new custom text box and auto-select it
  //   Cmd/Ctrl+A         → select ALL elements on the current slide (SEL-07)
  //   Escape             → group-aware: first press exits group when
  //                        currentlyInsideGroup !== null (Phase 62 GROUP-08);
  //                        otherwise clears selection (Plan 60-04 SEL-08)
  //   Delete / Backspace → remove the selected CUSTOM text box (hook/body are
  //                        structural and silently ignored)
  //
  // Phase 62 (62-03, GROUP-02..05, GROUP-08, KBD-09):
  //   Cmd/Ctrl+G         → form a group from the current selection when N>=2
  //                        (silent no-op when N<=1; preventDefault always to
  //                        suppress Chrome Find Next per PITFALL-9.3)
  //   Cmd/Ctrl+Shift+G   → ungroup all selected elements that carry a groupId
  //                        (silent no-op when no grouped element is selected)
  //
  // The Escape handler reads selection.currentlyInsideGroup to branch first-
  // press exit vs clear. The selection model object identity is stable across
  // renders unless one of its dependent fields changes (currentlyInsideGroup
  // is in the useMemo deps post-Plan 62-01), so the existing `selection`
  // entry in the useEffect deps is sufficient — we don't add a separate
  // entry for currentlyInsideGroup.
  //
  // Migrated from a hand-rolled meta/ctrl-key switch to a declarative
  // `tinykeys(window, {...})` map. The `$mod` token cross-resolves to Meta on
  // macOS and Control on Windows/Linux — no more platform branching here.
  //
  // KBD-02 firewall: every binding's first line is `if (isEditingTarget(e.target)) return;`
  // so shortcuts never override text-input behavior. The guard is inlined per
  // binding (not factored into a helper) so it's grep-visible — Plan-Checker
  // verification command #5 asserts at least 6 isEditingTarget calls in this
  // file. KBD-03: e.preventDefault() is called AFTER the guard returns false,
  // never unconditionally.
  //
  // Listener is attached to `window` (NOT a child div, per RESEARCH §Pitfall 2)
  // and torn down via the unsubscribe() that tinykeys returns. No manual
  // removeEventListener.
  useEffect(() => {
    const textBoxes = currentSlide?.text_boxes ?? []

    const unsubscribe = tinykeys(window, {
      '$mod+1': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        const targetBox = textBoxes[0]
        if (!targetBox) return
        e.preventDefault()
        selection.replaceWith([targetBox.id])
        // Legacy single-id slot — kept in sync until Phase 66 cleanup.
        setSelectedTextBoxId(targetBox.id)
      },
      '$mod+2': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        const targetBox = textBoxes[1]
        if (!targetBox) return
        e.preventDefault()
        selection.replaceWith([targetBox.id])
        setSelectedTextBoxId(targetBox.id)
      },
      '$mod+3': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        const targetBox = textBoxes[2]
        if (!targetBox) return
        e.preventDefault()
        selection.replaceWith([targetBox.id])
        setSelectedTextBoxId(targetBox.id)
      },

      '$mod+d': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        // Pre-generate the id (same pattern as TextEditorPanel.onTextBoxAction
        // ADD_TEXT_BOX from Phase 50 MR-01) so we can immediately auto-select
        // the new custom box. Reducer reads `defaults.id` if present.
        const newId = crypto.randomUUID()
        // Phase 66 Plan 01 (DIFF-02): smart offset.
        //   - When lastMoveDeltaRef.current is non-null, use { x, y } as the
        //     duplicate offset (Figma "rapid grid via Cmd+D" pattern —
        //     RESEARCH FEATURES G41).
        //   - When null (no prior move this session), fall back to
        //     DEFAULT_DUPLICATE_OFFSET_* (~20 ref-px right + down — matches
        //     Figma's default duplicate offset).
        // Source position resolution (Plan 66-01 D-DIFF-02):
        //   - When selection.primary points to a custom-anchor TextBox →
        //     read its position.x / position.y as the source.
        //   - Otherwise (primary null OR primary is a structural-anchor
        //     TextBox like hook/body) → fall back to (0, 0). Stale primary
        //     ids resolve to undefined via .find() and route through this
        //     same fallback (T-66-01-06 mitigation).
        // Width inherits the primary's width when known (Figma duplicate-
        // preserves-shape model); falls back to defaultPositionForRole's
        // width literal (60%) since the reducer doesn't merge defaults when
        // an explicit position is passed.
        const offset = lastMoveDeltaRef.current ?? {
          x: DEFAULT_DUPLICATE_OFFSET_X_PCT,
          y: DEFAULT_DUPLICATE_OFFSET_Y_PCT,
        }
        const primaryId = selection.primary
        const primaryBox = primaryId
          ? (currentSlide?.text_boxes ?? []).find((tb) => tb.id === primaryId)
          : null
        const sourceIsCustom = primaryBox?.position.anchor === 'custom'
        const sourceX = sourceIsCustom ? (primaryBox?.position.x ?? 0) : 0
        const sourceY = sourceIsCustom ? (primaryBox?.position.y ?? 0) : 0
        const sourceWidth = sourceIsCustom ? primaryBox?.position.width : undefined
        dispatch({
          type: 'ADD_TEXT_BOX',
          slideIndex: selectedIndex,
          role: 'custom',
          defaults: {
            id: newId,
            position: {
              anchor: 'custom',
              x: sourceX + offset.x,
              y: sourceY + offset.y,
              width: sourceWidth ?? 60, // mirrors defaultPositionForRole('custom') width
            },
          },
        })
        selection.replaceWith([newId])
        setSelectedTextBoxId(newId)
      },

      // Phase 60 SEL-07: select all addressable elements on the active slide.
      '$mod+a': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (currentSlide) selection.selectAll(currentSlide)
      },

      // Phase 62 GROUP-02 / GROUP-04 / GROUP-05 / KBD-09: form a group from
      // the current selection. N<=1 is a silent no-op (no dispatch) — but we
      // still preventDefault to suppress Chrome Find Next (PITFALL-9.3).
      // groupId format = `g_${slideIndex}_${Date.now-base36}` per CONTEXT
      // D-01 (nanoid is NOT a dep). Selection.ids stays the same — the
      // elements just gain a groupId; the group ring (Plan 62-02) picks
      // up the new groupId on the next render via getGroupMembers reads.
      '$mod+g': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        // N<=1 → silent no-op (PITFALL-3.4) but still preventDefault so
        // Chrome's Find Next dialog doesn't pop up over our canvas.
        if (selection.ids.length < 2) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        const groupId = `g_${selectedIndex}_${Date.now().toString(36)}`
        dispatch({
          type: 'GROUP',
          slideIndex: selectedIndex,
          ids: selection.ids,
          groupId,
        })
      },

      // Phase 62 GROUP-03 / KBD-09: ungroup. Walks the current slide for
      // selected elements with a groupId, then dispatches UNGROUP with the
      // UNION of every member of every distinct groupId in the selection
      // (so partial-group selections still ungroup the whole group). When
      // no selected element carries a groupId, returns BEFORE preventDefault
      // — Cmd+Shift+G with nothing-to-ungroup is a true no-op (no Chrome
      // Find Previous suppression needed since our handler did not claim
      // the binding).
      '$mod+Shift+g': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        if (!currentSlide) return
        if (selection.ids.length === 0) return
        const allElements = [
          ...(currentSlide.text_boxes ?? []),
          ...(currentSlide.custom_images ?? []),
          ...(currentSlide.watermark ? [currentSlide.watermark] : []),
        ]
        const selectedSet = new Set(selection.ids)
        const groupIds = new Set<string>()
        for (const el of allElements) {
          if (selectedSet.has(el.id) && el.groupId) groupIds.add(el.groupId)
        }
        if (groupIds.size === 0) return // no-op (no preventDefault)
        const idsToUngroup: string[] = []
        for (const gid of groupIds) {
          idsToUngroup.push(...getGroupMembers(currentSlide, gid))
        }
        e.preventDefault()
        dispatch({
          type: 'UNGROUP',
          slideIndex: selectedIndex,
          ids: idsToUngroup,
        })
      },

      // Phase 64 Plan 01 (LOCK-03 / KBD-02 / KBD-03): toggle `locked` on every
      // selected element in a single dispatch. Toggle semantics (CONTEXT D-01
      // majority/all-locked): if EVERY selected element is currently locked,
      // unlock all; otherwise (any unlocked element), lock all. Matches
      // Figma's lock model. Cmd+Shift+L on Chrome is "Reopen Closed Tab" —
      // preventDefault keeps focus on the canvas (mirrors Cmd+G's PITFALL-9.3
      // suppression). KBD-02 firewall is INLINED so the grep count goes
      // 24 → 25 (Plan 64-03 will push to 29 with the 4 z-order bindings).
      '$mod+Shift+l': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (!currentSlide) return
        if (selection.ids.length === 0) return
        const idSet = new Set(selection.ids)
        const allElements = [
          ...(currentSlide.text_boxes ?? []),
          ...(currentSlide.custom_images ?? []),
          ...(currentSlide.watermark ? [currentSlide.watermark] : []),
        ]
        const selectedElements = allElements.filter((el) => idSet.has(el.id))
        if (selectedElements.length === 0) return // selection contains only stale ids
        const allLocked = selectedElements.every((el) => el.locked === true)
        const nextLocked = !allLocked
        dispatch({
          type: 'SET_LOCKED',
          slideIndex: selectedIndex,
          ids: selection.ids,
          locked: nextLocked,
        })
      },

      // Phase 62 GROUP-08: group-aware Escape. First press exits the group
      // if currentlyInsideGroup !== null (Plan 62-01 selection-model state).
      // Second press clears selection (Plan 60-04 SEL-08 behavior). Single
      // user gesture → single observable behavior. Mirrors Plan 62-02's
      // canvas-empty exitGroup-then-clear two-step semantics.
      'Escape': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.currentlyInsideGroup !== null) {
          selection.exitGroup()
          return
        }
        selection.clear()
        setSelectedTextBoxId(null)
      },

      'Delete': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        if (!selectedTextBoxId) return
        const targetBox = textBoxes.find((tb) => tb.id === selectedTextBoxId)
        if (!targetBox) return
        // quick-260515-ihk: deletion now works for any role (hook / body /
        // custom). applyDualWrite handles empty legacy hook_text / body_text
        // fields gracefully — the renderer treats missing role boxes as
        // "no text". Locked boxes are still skipped (reducer enforces the
        // lock too; we guard here to keep event handling consistent).
        if (targetBox.locked === true) return
        e.preventDefault()
        removeTextBox(selectedIndex, selectedTextBoxId)
      },
      'Backspace': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        if (!selectedTextBoxId) return
        const targetBox = textBoxes.find((tb) => tb.id === selectedTextBoxId)
        if (!targetBox) return
        if (targetBox.locked === true) return
        e.preventDefault()
        removeTextBox(selectedIndex, selectedTextBoxId)
      },

      // ────────────────────────────────────────────────────────────────────
      // Phase 63 Plan 02 (ALIGN-01, ALIGN-02, ALIGN-06): 6-axis align +
      // 2-axis distribute keyboard map. Every binding starts with the
      // KBD-02 isEditingTarget firewall (returns BEFORE preventDefault to
      // let browser defaults fire inside text inputs) and then unconditionally
      // preventDefaults — Alt-key combos and Cmd+Alt-key combos can have
      // browser-default behaviors:
      //   • Alt+A/H/D/W/V/S: some platforms consume Alt+letter as "menu
      //     mnemonic" — preventDefault keeps the canvas in focus.
      //   • Cmd+Alt+H is Chrome history.
      //   • Cmd+Alt+V is Chrome view-source.
      // The N=1→canvas vs N>=2→selection routing happens inside the closure
      // helpers — the toolbar UI hides at N<=1 (single-element canvas-align
      // is keyboard-only, matching Figma's power-user pattern). Distribute
      // binds N<3 → silent no-op (with preventDefault still called per
      // PITFALL-9.3 / Cmd+G pattern).
      //
      // KBD-02 firewall is INLINED at each binding (not just the closure
      // helper) so the `isEditingTarget(e.target)` call is grep-visible
      // per Plan 60-04 contract — the verification grep counts >= 19 sites
      // after this plan (was 11 after Plan 62-03; +8 sites from this plan).
      // ────────────────────────────────────────────────────────────────────
      'Alt+a': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        alignKeyHandler(e, 'left')
      },
      'Alt+h': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        alignKeyHandler(e, 'center-h')
      },
      'Alt+d': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        alignKeyHandler(e, 'right')
      },
      'Alt+w': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        alignKeyHandler(e, 'top')
      },
      'Alt+v': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        alignKeyHandler(e, 'center-v')
      },
      'Alt+s': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        alignKeyHandler(e, 'bottom')
      },
      '$mod+Alt+h': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        distributeKeyHandler(e, 'horizontal')
      },
      '$mod+Alt+v': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        distributeKeyHandler(e, 'vertical')
      },

      // ────────────────────────────────────────────────────────────────────
      // Phase 64 Plan 03 (ZORDER-01..07, KBD-02, KBD-03, KBD-09): 4 z-order
      // bindings. Each dispatches a single Z_ORDER action; the reducer routes
      // per-scope (text_boxes / custom_images) internally. Multi-selection
      // iterates +1/-1 individually with array-bound clamping (Figma model —
      // ZORDER-06).
      //
      // ZORDER-05: array splice exclusively; the pure transform's grep gate
      // forbids any reference to the CSS layering property. Cmd+] / Cmd+[
      // are browser tab-navigation on some Chrome configs — preventDefault
      // keeps focus on the canvas. The KBD-02 firewall is INLINED at each
      // binding so the grep count goes 25 → 29 (Plan 64-01 added +1; this
      // plan adds +4).
      //
      // op mapping:
      //   $mod+]      → 'forward'    (array splice +1; clamp at length)
      //   $mod+[      → 'backward'   (array splice -1; clamp at 0)
      //   $mod+Alt+]  → 'front'      (push to end of array)
      //   $mod+Alt+[  → 'back'       (unshift to index 0)
      // ────────────────────────────────────────────────────────────────────
      '$mod+]': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        dispatch({
          type: 'Z_ORDER',
          slideIndex: selectedIndex,
          ids: selection.ids,
          op: 'forward',
        })
      },
      '$mod+[': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        dispatch({
          type: 'Z_ORDER',
          slideIndex: selectedIndex,
          ids: selection.ids,
          op: 'backward',
        })
      },
      '$mod+Alt+]': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        dispatch({
          type: 'Z_ORDER',
          slideIndex: selectedIndex,
          ids: selection.ids,
          op: 'front',
        })
      },
      '$mod+Alt+[': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        dispatch({
          type: 'Z_ORDER',
          slideIndex: selectedIndex,
          ids: selection.ids,
          op: 'back',
        })
      },

      // ────────────────────────────────────────────────────────────────────
      // Phase 66 Plan 01 (KBD-05, KBD-06, KBD-09, PERF-01): arrow-nudge
      // bindings. Plain Arrow = ±1 ref-px; Shift+Arrow = ±10 ref-px (Figma
      // + Canva default — RESEARCH FEATURES F36/F37). Each binding:
      //   1. Inlined isEditingTarget firewall (PITFALL-9.2 — arrow keys typed
      //      inside text inputs MUST move the cursor, not nudge canvas
      //      elements). Returns BEFORE preventDefault so the browser's
      //      caret-movement default is preserved inside <input>/<textarea>/
      //      contentEditable.
      //   2. e.preventDefault() to suppress any browser-default scroll on
      //      bare Arrow keys when the canvas-root has focus (defensive —
      //      mirrors the unconditional preventDefault in every other binding
      //      in this file).
      //   3. dispatch BULK_TRANSLATE with the matching deltaX/deltaY in %.
      //      The BULK_TRANSLATE reducer (Plan 60-03) already silently skips
      //      locked elements + structural-anchor TextBoxes + watermark, so
      //      the arrow-nudge inherits those filtering contracts for free —
      //      no reducer change required.
      //   4. lastMoveDeltaRef.current = { x: deltaX, y: deltaY } so the next
      //      $mod+d (Cmd+D smart offset — DIFF-02) reuses the most recent
      //      move direction + magnitude.
      // Single pushHistory per nudge — BULK_TRANSLATE already provides this
      // (PERF-01 / KBD-09 carry-forward). The KBD-02 firewall is INLINED at
      // each binding (not factored into a helper) so the verification grep
      // count grows by exactly 8 inline call sites.
      // ────────────────────────────────────────────────────────────────────
      'ArrowUp': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        const deltaX = 0
        const deltaY = -NUDGE_Y_SMALL_PCT
        lastMoveDeltaRef.current = { x: deltaX, y: deltaY }
        dispatch({
          type: 'BULK_TRANSLATE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          deltaX,
          deltaY,
        })
      },
      'ArrowDown': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        const deltaX = 0
        const deltaY = +NUDGE_Y_SMALL_PCT
        lastMoveDeltaRef.current = { x: deltaX, y: deltaY }
        dispatch({
          type: 'BULK_TRANSLATE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          deltaX,
          deltaY,
        })
      },
      'ArrowLeft': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        const deltaX = -NUDGE_X_SMALL_PCT
        const deltaY = 0
        lastMoveDeltaRef.current = { x: deltaX, y: deltaY }
        dispatch({
          type: 'BULK_TRANSLATE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          deltaX,
          deltaY,
        })
      },
      'ArrowRight': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        const deltaX = +NUDGE_X_SMALL_PCT
        const deltaY = 0
        lastMoveDeltaRef.current = { x: deltaX, y: deltaY }
        dispatch({
          type: 'BULK_TRANSLATE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          deltaX,
          deltaY,
        })
      },
      'Shift+ArrowUp': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        const deltaX = 0
        const deltaY = -NUDGE_Y_LARGE_PCT
        lastMoveDeltaRef.current = { x: deltaX, y: deltaY }
        dispatch({
          type: 'BULK_TRANSLATE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          deltaX,
          deltaY,
        })
      },
      'Shift+ArrowDown': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        const deltaX = 0
        const deltaY = +NUDGE_Y_LARGE_PCT
        lastMoveDeltaRef.current = { x: deltaX, y: deltaY }
        dispatch({
          type: 'BULK_TRANSLATE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          deltaX,
          deltaY,
        })
      },
      'Shift+ArrowLeft': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        const deltaX = -NUDGE_X_LARGE_PCT
        const deltaY = 0
        lastMoveDeltaRef.current = { x: deltaX, y: deltaY }
        dispatch({
          type: 'BULK_TRANSLATE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          deltaX,
          deltaY,
        })
      },
      'Shift+ArrowRight': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        if (selection.ids.length === 0) return
        const deltaX = +NUDGE_X_LARGE_PCT
        const deltaY = 0
        lastMoveDeltaRef.current = { x: deltaX, y: deltaY }
        dispatch({
          type: 'BULK_TRANSLATE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          deltaX,
          deltaY,
        })
      },

      // ────────────────────────────────────────────────────────────────────
      // Phase 70 Plan 03 (KBD-10 / KBD-11 / PICKER-07): direct-insert + picker-
      // open shortcuts. Each binding inlines BOTH firewall short-circuits
      // (isEditingTarget BEFORE isPickerOpenRef BEFORE preventDefault) so
      // typing 'R' in a hook editor preserves native input AND re-pressing 'I'
      // while the picker is open is a silent no-op (state-machine invariant —
      // only one picker open at a time, no remount race).
      //
      // R/C/L call buildDefaultShapeDecoration (Plan 70-01) for byte-identical
      // defaults to the ShapePicker tile click; auto-select via
      // selection.replaceWith mirrors onPickerAddDecoration.
      //
      // I/S route through setOpenPicker which updates BOTH the React state
      // (drives JSX mount) and isPickerOpenRef (drives all tinykeys
      // short-circuits) in one synchronous call.
      //
      // Convention: bare lowercase letters per Canva/Figma — tinykeys
      // disambiguates by modifier set so this never collides with $mod+L
      // (lock toggle). KBD-02 firewall ordering: editing-target check first
      // (PITFALL-9.2 caret-preservation), then picker-open check, then
      // preventDefault, then dispatch. ────────────────────────────────────
      'r': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        const d = buildDefaultShapeDecoration('rect')
        dispatch({ type: 'ADD_DECORATION', slideIndex: selectedIndex, decoration: d })
        selection.replaceWith([d.id])
      },
      'c': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        const d = buildDefaultShapeDecoration('circle')
        dispatch({ type: 'ADD_DECORATION', slideIndex: selectedIndex, decoration: d })
        selection.replaceWith([d.id])
      },
      'l': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        const d = buildDefaultShapeDecoration('line')
        dispatch({ type: 'ADD_DECORATION', slideIndex: selectedIndex, decoration: d })
        selection.replaceWith([d.id])
      },
      'i': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        setOpenPicker('lucide')
      },
      's': (e) => {
        if (isEditingTarget(e.target) || isPickerOpenRef.current) return
        e.preventDefault()
        setOpenPicker('shape')
      },
    })

    // Phase 63 Plan 02 — closure helpers. Defined INSIDE the useEffect so
    // they capture the freshest selection / dispatch / selectedIndex on
    // every render where a binding fires. The ALIGN-08 single-pushHistory
    // contract is upheld by the reducer; here we just dispatch ONE action.
    // The isEditingTarget firewall is inlined at each binding ABOVE so the
    // guard is grep-visible per Plan 60-04 contract; these helpers only see
    // events that already passed the firewall.
    function alignKeyHandler(e: KeyboardEvent, axis: AlignAxis) {
      e.preventDefault() // KBD-03 — always preventDefault when not editing
      if (selection.ids.length === 0) return // no-op (no selection to align)
      // ALIGN-03: N=1 routes target='canvas' (1080×1920); N>=2 routes
      // target='selection' (union AABB). The pure align.ts module computes
      // patches; locked + watermark + structural-anchor are filtered there.
      const target: AlignTarget = selection.ids.length === 1 ? 'canvas' : 'selection'
      dispatch({
        type: 'ALIGN',
        slideIndex: selectedIndex,
        ids: selection.ids,
        axis,
        target,
      })
    }

    function distributeKeyHandler(e: KeyboardEvent, axis: DistributeAxis) {
      e.preventDefault() // KBD-03 — always preventDefault (Chrome history / view-source)
      if (selection.ids.length < 3) return // ALIGN-06 — silent no-op when N<3
      dispatch({
        type: 'DISTRIBUTE',
        slideIndex: selectedIndex,
        ids: selection.ids,
        axis,
      })
    }

    return () => unsubscribe()
  }, [
    currentSlide,
    selectedTextBoxId,
    selectedIndex,
    setSelectedTextBoxId,
    removeTextBox,
    dispatch,
    selection,
    // Phase 70 Plan 03 (KBD-11): setOpenPicker is a useCallback with empty
    // deps so its identity is stable; included explicitly for the lint rule.
    setOpenPicker,
  ])

  async function handleTemplateChange(newId: string) {
    setCurrentTemplateId(newId)
    await saveTemplateId(projectId, newId)
  }

  function handleUpdate(updates: Partial<Slide>) {
    dispatch({ type: 'UPDATE_SLIDE', index: selectedIndex, updates })
  }

  // Phase 63 Plan 02 (ALIGN-01..05, ALIGN-07): toolbar-action handler.
  // Wired to SlideCanvas.onAlign → SlidePreview.onAlign → FloatingAlignmentToolbar.
  // Mirrors alignKeyHandler / distributeKeyHandler from the tinykeys closure
  // so keyboard + mouse paths land the SAME ALIGN/DISTRIBUTE dispatch shape.
  // Uses useCallback so SlideCanvas's reference identity is stable across
  // renders that don't change selection.ids / selectedIndex / dispatch.
  const handleAlign = useCallback(
    (action: ToolbarAction) => {
      if (action.kind === 'align') {
        if (selection.ids.length === 0) return
        const target: AlignTarget =
          selection.ids.length === 1 ? 'canvas' : 'selection'
        dispatch({
          type: 'ALIGN',
          slideIndex: selectedIndex,
          ids: selection.ids,
          axis: action.axis,
          target,
        })
      } else {
        // distribute — ALIGN-06 N<3 gate. Toolbar disables the button at N<3,
        // but defense-in-depth: handler also no-ops here. Matches the
        // distributeKeyHandler closure above.
        if (selection.ids.length < 3) return
        dispatch({
          type: 'DISTRIBUTE',
          slideIndex: selectedIndex,
          ids: selection.ids,
          axis: action.axis,
        })
      }
    },
    [selection.ids, selectedIndex, dispatch],
  )

  function handlePositionChange(field: 'hook' | 'body', position: TextPosition) {
    if (!currentSlide) return
    const overrides = currentSlide.style_overrides ?? {}
    const key = field === 'hook' ? 'hook_position' : 'body_position'
    // Phase 49 (HR-02): keep text_boxes in sync so the dual-write on save doesn't
    // overwrite this position with the stale value derived from the matching TextBox.
    const updatedTextBoxes = currentSlide.text_boxes?.map((tb) => {
      if (tb.role !== field) return tb
      return {
        ...tb,
        position: {
          ...tb.position,
          anchor: 'custom' as const,
          x: position.x,
          y: position.y,
        },
      }
    })
    dispatch({
      type: 'UPDATE_SLIDE',
      index: selectedIndex,
      updates: {
        style_overrides: { ...overrides, [key]: position },
        ...(updatedTextBoxes ? { text_boxes: updatedTextBoxes } : {}),
      },
    })
  }

  function handleWidthChange(field: 'hook' | 'body', width: number) {
    if (!currentSlide) return
    const overrides = currentSlide.style_overrides ?? {}
    const key = field === 'hook' ? 'hook_width' : 'body_width'
    // Phase 49 (HR-02): keep text_boxes in sync — dual-write derives hook_width/body_width
    // from text_boxes[].position.width, so a write to legacy alone would be overwritten on save.
    const updatedTextBoxes = currentSlide.text_boxes?.map((tb) => {
      if (tb.role !== field) return tb
      return {
        ...tb,
        position: { ...tb.position, width },
      }
    })
    dispatch({
      type: 'UPDATE_SLIDE',
      index: selectedIndex,
      updates: {
        style_overrides: { ...overrides, [key]: width },
        ...(updatedTextBoxes ? { text_boxes: updatedTextBoxes } : {}),
      },
    })
  }

  // phase-59-02: size-change handler — extends handleWidthChange to also write
  // style_overrides.{hook,body}_font_size + text_boxes[i].font_size when the
  // onResizeStop branch detected a corner drag. When font_size is omitted (side
  // drag), behavior is identical to handleWidthChange. Routes through existing
  // override field at slide-preview.tsx:313 to preserve hook-fit precedence
  // (FONTSCALE-04). handleWidthChange is kept intact for back-compat — no
  // callers are migrated by this plan.
  function handleSizeChange(
    field: 'hook' | 'body',
    size: { width: number; font_size?: number },
  ) {
    if (!currentSlide) return
    const overrides = currentSlide.style_overrides ?? {}
    const widthKey = field === 'hook' ? 'hook_width' : 'body_width'
    const fontKey = field === 'hook' ? 'hook_font_size' : 'body_font_size'
    const updatedTextBoxes = currentSlide.text_boxes?.map((tb) => {
      if (tb.role !== field) return tb
      return {
        ...tb,
        position: { ...tb.position, width: size.width },
        ...(size.font_size !== undefined ? { font_size: size.font_size } : {}),
      }
    })
    dispatch({
      type: 'UPDATE_SLIDE',
      index: selectedIndex,
      updates: {
        style_overrides: {
          ...overrides,
          [widthKey]: size.width,
          ...(size.font_size !== undefined ? { [fontKey]: size.font_size } : {}),
        },
        ...(updatedTextBoxes ? { text_boxes: updatedTextBoxes } : {}),
      },
    })
  }

  // Custom text handlers
  function handleAddCustomText() {
    // Phase 49 (HR-03): dispatch the unified ADD_TEXT_BOX so the new box lands in
    // text_boxes (the canonical store at save time). The dual-write in doSave will
    // regenerate slide.custom_texts from text_boxes so legacy clients keep working.
    dispatch({ type: 'ADD_TEXT_BOX', slideIndex: selectedIndex, role: 'custom' })
  }

  function handleCustomTextPositionChange(id: string, position: TextPosition) {
    dispatch({
      type: 'UPDATE_CUSTOM_TEXT',
      slideIndex: selectedIndex,
      textId: id,
      updates: { x: position.x, y: position.y },
    })
  }

  function handleCustomTextWidthChange(id: string, width: number) {
    dispatch({
      type: 'UPDATE_CUSTOM_TEXT',
      slideIndex: selectedIndex,
      textId: id,
      updates: { width },
    })
  }

  // phase-59-02: custom-text size handler — dispatches UPDATE_TEXT_BOX (not the
  // legacy UPDATE_CUSTOM_TEXT) so applyDualWrite mirrors text_boxes → legacy
  // slide.custom_texts automatically (editor-reducer.ts:271-280). When font_size
  // is omitted (side drag), only position.width updates. handleCustomTextWidthChange
  // is kept intact for back-compat (CLEANUP-01 — deferred).
  function handleCustomTextSizeChange(
    id: string,
    size: { width: number; font_size?: number },
  ) {
    if (!currentSlide) return
    const tb = currentSlide.text_boxes?.find((b) => b.id === id)
    if (!tb) return
    dispatch({
      type: 'UPDATE_TEXT_BOX',
      slideIndex: selectedIndex,
      textBoxId: id,
      updates: {
        position: { ...tb.position, width: size.width },
        ...(size.font_size !== undefined ? { font_size: size.font_size } : {}),
      },
    })
  }

  function handleCustomTextUpdate(id: string, updates: Partial<CustomText>) {
    dispatch({
      type: 'UPDATE_CUSTOM_TEXT',
      slideIndex: selectedIndex,
      textId: id,
      updates,
    })
  }

  function handleRemoveCustomText(id: string) {
    dispatch({ type: 'REMOVE_CUSTOM_TEXT', slideIndex: selectedIndex, textId: id })
    setSelectedCustomTextId(null)
  }

  // Custom image handlers
  function handleAddCustomImage(url: string) {
    dispatch({ type: 'ADD_CUSTOM_IMAGE', slideIndex: selectedIndex, url })
  }

  // Elements panel — divider/line inserts. Same reducer action as photos but
  // with centered + narrow + short defaults so the rule lands as a typographic
  // separator under the headline, not as a half-canvas image.
  function handleInsertDivider(dataUri: string) {
    dispatch({
      type: 'ADD_CUSTOM_IMAGE',
      slideIndex: selectedIndex,
      url: dataUri,
      initial: { x: 25, y: 60, width: 50, height: 4, opacity: 100 },
    })
  }

  function handleCustomImagePositionChange(id: string, position: { x: number; y: number }) {
    dispatch({
      type: 'UPDATE_CUSTOM_IMAGE',
      slideIndex: selectedIndex,
      imageId: id,
      updates: { x: position.x, y: position.y },
    })
  }

  function handleCustomImageSizeChange(id: string, size: { width: number; height: number }) {
    dispatch({
      type: 'UPDATE_CUSTOM_IMAGE',
      slideIndex: selectedIndex,
      imageId: id,
      updates: { width: size.width, height: size.height },
    })
  }

  function handleRemoveCustomImage(id: string) {
    dispatch({ type: 'REMOVE_CUSTOM_IMAGE', slideIndex: selectedIndex, imageId: id })
    setSelectedCustomImageId(null)
  }

  async function handleRegenerateText() {
    if (!currentSlide) return
    try {
      const result = await regenerateSlideText(projectId, selectedIndex, topic, currentSlide)
      // Phase 49 (HR-01): also update the matching hook/body entries in text_boxes.
      // Without this, the next dual-write save derives hook_text/body_text from the
      // stale text_boxes and silently overwrites the just-regenerated text.
      const updatedTextBoxes = currentSlide.text_boxes?.map((tb) => {
        if (tb.role === 'hook') return { ...tb, text: result.hook_text }
        if (tb.role === 'body') return { ...tb, text: result.body_text }
        return tb
      })
      dispatch({
        type: 'UPDATE_SLIDE',
        index: selectedIndex,
        updates: {
          hook_text: result.hook_text,
          body_text: result.body_text,
          ...(updatedTextBoxes ? { text_boxes: updatedTextBoxes } : {}),
        },
      })
    } catch { /* silently handle */ }
  }

  async function handleRegenerateImage() {
    if (!currentSlide) return
    try {
      const result = await regenerateSlideImageQuery(topic, currentSlide)
      dispatch({
        type: 'UPDATE_SLIDE',
        index: selectedIndex,
        updates: {
          image_query: result.image_query,
          background_url: result.background_url,
          pexels_photo_id: result.pexels_photo_id,
        },
      })
    } catch { /* silently handle */ }
  }

  // Phase 65 Plan 01 (LAYERS-04): inline-rename callback wired to the
  // LEFT-rail layers panel. TextBox.role hook/body are structural —
  // their label is derived from the role + text content; renaming a
  // hook/body chip writes to the additive `name?: string` field
  // (Phase 65 Plan 01 schema-additive on TextBox + CustomImage).
  // Watermark renames are silently no-op'd (singleton; label derives
  // from customText). The dispatch shape matches the existing
  // UPDATE_TEXT_BOX / UPDATE_CUSTOM_IMAGE actions in editor-reducer.
  const handleLayerRename = useCallback(
    (elementId: string, newName: string) => {
      if (!currentSlide) return
      const tb = currentSlide.text_boxes?.find((b) => b.id === elementId)
      if (tb) {
        dispatch({
          type: 'UPDATE_TEXT_BOX',
          slideIndex: selectedIndex,
          textBoxId: elementId,
          updates: { name: newName },
        })
        return
      }
      const ci = currentSlide.custom_images?.find((c) => c.id === elementId)
      if (ci) {
        dispatch({
          type: 'UPDATE_CUSTOM_IMAGE',
          slideIndex: selectedIndex,
          imageId: elementId,
          updates: { name: newName },
        })
        return
      }
      // Watermark / unknown id → silent no-op
    },
    [currentSlide, selectedIndex, dispatch],
  )

  // Phase 65 Plan 02 (LAYERS-05/06/07): layers-panel toggle dispatchers.
  // Each handler is a thin wrapper around dispatch — toggle math (the
  // !current-bool) happens at the chip / group-row level (Plan 64-01 D-01
  // caller-toggle-math pattern). Single dispatch per click → single
  // pushHistory entry (KBD-09 / PERF-01 carry-forward; identical to the
  // existing Cmd+Shift+L / Cmd+] keyboard bindings).
  const handleLayerLockToggle = useCallback(
    (ids: string[], nextLocked: boolean) => {
      dispatch({ type: 'SET_LOCKED', slideIndex: selectedIndex, ids, locked: nextLocked })
    },
    [selectedIndex, dispatch],
  )

  const handleLayerVisibilityToggle = useCallback(
    (ids: string[], nextHidden: boolean) => {
      dispatch({ type: 'SET_HIDDEN', slideIndex: selectedIndex, ids, hidden: nextHidden })
    },
    [selectedIndex, dispatch],
  )

  const handleLayerReorder = useCallback(
    (elementId: string, op: 'forward' | 'backward') => {
      dispatch({ type: 'Z_ORDER', slideIndex: selectedIndex, ids: [elementId], op })
    },
    [selectedIndex, dispatch],
  )

  return (
    <div className="flex flex-col bg-[#fff8f7] h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)] overflow-hidden">
      {/* Three-panel layout -- no top toolbar */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[260px_1fr_340px] flex-1 min-h-0 overflow-hidden gap-0 lg:gap-3 px-0 lg:px-2 py-0 lg:py-2"
        data-testid="editor-grid"
      >
        {/* Left panel: Top actions row + slide thumbnails. quick-260514-presentation-header:
            the old "Presentation / N Slides" label was removed and the action bar
            (back, title, slide actions, help) moved from the bottom to here at the
            top — same two-row composition, same paddings, same icon-button styles. */}
        <aside className="bg-[#fff0f0] lg:rounded-xl flex flex-col overflow-hidden">
          {/* Top actions: back, title, slide actions, help (formerly at bottom) */}
          <div className="p-3 border-b border-[#dbc1bc]/20 space-y-3">
            {/* Back + Title */}
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-colors"
                title="Back to dashboard"
              >
                <Icon name="arrow_back" size="sm" />
              </Link>
              <span className="text-xs font-semibold text-[#3d0000] truncate flex-1">
                {title ?? 'Untitled'}
              </span>
              {saveStatus !== 'idle' && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#7d6161]">
                  {saveStatus === 'saving' ? '...' : 'Saved'}
                </span>
              )}
            </div>

            {/* Slide actions */}
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => {
                  dispatch({ type: 'ADD_SLIDE', index: selectedIndex + 1 })
                  setSelectedIndex(selectedIndex + 1)
                }}
                className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95"
                title="Add Slide"
              >
                <Icon name="add" size="sm" />
              </button>
              <button
                onClick={() => {
                  dispatch({ type: 'DUPLICATE_SLIDE', index: selectedIndex })
                  setSelectedIndex(selectedIndex + 1)
                }}
                className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95"
                title="Duplicate Slide"
              >
                <Icon name="content_copy" size="sm" />
              </button>
              <button
                onClick={() => dispatch({ type: 'REMOVE_SLIDE', index: selectedIndex })}
                disabled={slides.length <= 1}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95 disabled:opacity-30"
                title="Delete Slide"
              >
                <Icon name="delete" size="sm" />
              </button>
              <button
                onClick={handleAddCustomText}
                className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95"
                title="Add Text Box"
              >
                <Icon name="text_fields" size="sm" />
              </button>
            </div>
          </div>

          {/* quick-260519-scr: macOS overlay scrollbar floats over content
              rather than reserving layout space, so a symmetric p-4 puts the
              scrollbar on top of the slide thumbnails (visible bug on the
              right edge of the cards). Extra right padding gives the
              scrollbar a dedicated lane. */}
          <div className="pl-4 pr-5 py-4 flex flex-col gap-4 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <SlideList
              slides={slides}
              template={template}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              brandKit={brandKit}
              userTier={userTier ?? 'free'}
              topic={topic}
              onReorder={(from, to) => {
                dispatch({ type: 'REORDER_SLIDES', from, to })
                setSelectedIndex(to)
              }}
            />
            {currentSlide && (
              <LayersPanel
                slide={currentSlide}
                selection={selection}
                onRename={handleLayerRename}
                onLockToggle={handleLayerLockToggle}
                onVisibilityToggle={handleLayerVisibilityToggle}
                onReorder={handleLayerReorder}
              />
            )}
          </div>
        </aside>

        {/* Center: Canvas */}
        <SlideCanvas
          slides={slides}
          template={template}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          brandKit={brandKit}
          userTier={userTier ?? 'free'}
          topic={topic}
          onPositionChange={handlePositionChange}
          onWidthChange={handleWidthChange}
          // phase-59-02: corner-drag font-scale + side-drag width-only routes through
          // these callbacks (FONTSCALE-01..04). handleSizeChange writes style_overrides.
          // {hook,body}_font_size + text_boxes[i].font_size in one UPDATE_SLIDE dispatch.
          onSizeChange={handleSizeChange}
          onCustomTextPositionChange={handleCustomTextPositionChange}
          onCustomTextWidthChange={handleCustomTextWidthChange}
          onCustomTextSizeChange={handleCustomTextSizeChange}
          onCustomTextUpdate={handleCustomTextUpdate}
          onCustomTextSelect={setSelectedCustomTextId}
          onCustomTextRemove={handleRemoveCustomText}
          selectedCustomTextId={selectedCustomTextId}
          onCustomImagePositionChange={handleCustomImagePositionChange}
          onCustomImageSizeChange={handleCustomImageSizeChange}
          onCustomImageSelect={setSelectedCustomImageId}
          onCustomImageRemove={handleRemoveCustomImage}
          selectedCustomImageId={selectedCustomImageId}
          onTextBoxSelect={setSelectedTextBoxId}
          selectedTextBoxId={selectedTextBoxId}
          // quick-260514-l9z: in-place text edit on hook/body — double-click
          // a text box on the canvas, type, blur to commit. UPDATE_TEXT_BOX
          // with `segments: undefined` because word-index segments become
          // stale once the wording changes (same contract custom-text
          // editing uses; mirror line 181 of ActiveTextBoxCard input
          // commit path).
          onTextBoxTextEdit={(id, text) => {
            dispatch({
              type: 'UPDATE_TEXT_BOX',
              slideIndex: selectedIndex,
              textBoxId: id,
              updates: { text, segments: undefined },
            })
          }}
          selection={{ ids: selection.ids, primary: selection.primary }}
          onSelectionChange={selection.setSelection}
          // Phase 62 (GROUP-06, GROUP-07, GROUP-08, GROUP-10): group-state
          // wiring. selection.currentlyInsideGroup / enterGroup / exitGroup
          // were added by Plan 62-01 (useSelectionModel extension); SlideCanvas
          // forwards verbatim to SlidePreview's ring + click handlers.
          currentlyInsideGroup={selection.currentlyInsideGroup}
          onEnterGroup={selection.enterGroup}
          onExitGroup={selection.exitGroup}
          // Phase 62 (GROUP-09, KBD-09): group drag fan-out. The onDragStop
          // branch in slide-preview.tsx dispatches this when the drag matches
          // a single-group selection; we forward the payload to BULK_TRANSLATE
          // so the gesture lands as one history entry. Reducer skips locked +
          // watermark + structural-anchor (Plan 60-03 contract carry-forward).
          // Phase 66 Plan 01 (DIFF-02): also record the drag delta into
          // lastMoveDeltaRef so a subsequent Cmd+D reuses the direction +
          // magnitude (Figma smart-offset pattern — RESEARCH FEATURES G41).
          onGroupDrag={(payload) => {
            lastMoveDeltaRef.current = { x: payload.deltaX, y: payload.deltaY }
            dispatch({ type: 'BULK_TRANSLATE', ...payload })
          }}
          // Phase 66 Plan 02 (DIFF-01, KBD-09): Alt+drag duplicate fan-out.
          // The onDragStop branch in slide-preview.tsx dispatches this when
          // the drag-START state had `modifiers.get().alt === true`. Forward
          // the payload to DUPLICATE_ELEMENTS_AT so the gesture lands as a
          // single history entry. Reducer skips locked / structural-anchor /
          // watermark (Plan 66-02 contract — same skip-set as BULK_TRANSLATE).
          // Note (v2.11 simplification): we do NOT update the selection to
          // follow the duplicates here (the originals stay selected). v2.12+
          // can extend the reducer to return the new id list (requires the
          // useReducer pattern to fan an action result), or capture pre/post
          // dispatch slide diffs to derive new ids. Documented in SUMMARY
          // known stubs.
          onAltDuplicate={(payload) => {
            dispatch({ type: 'DUPLICATE_ELEMENTS_AT', ...payload })
          }}
          // Phase 63 Plan 02 (ALIGN-01..05, ALIGN-07): toolbar action callback.
          // SlideCanvas → SlidePreview → FloatingAlignmentToolbar. Click on
          // an align/distribute button calls handleAlign which resolves
          // N=1→canvas vs N>=2→selection target and dispatches ALIGN /
          // DISTRIBUTE. Same dispatch shape as the keyboard alignKeyHandler /
          // distributeKeyHandler closures above (single source of truth at
          // the reducer layer).
          onAlign={handleAlign}
          // quick-260514-kct: single-decoration drag commit. Multi-element
          // group drag goes through onGroupDrag (BULK_TRANSLATE) above —
          // reducer already handles decorations (Phase 68 Plan 02).
          onDecorationPositionChange={(id, position) => {
            const target = (currentSlide?.decorations ?? []).find(
              (d) => d.id === id,
            )
            if (!target) return
            dispatch({
              type: 'UPDATE_DECORATION',
              slideIndex: selectedIndex,
              id,
              updates: {
                position: { ...target.position, x: position.x, y: position.y },
              },
            })
          }}
          // quick-260515-k54: resize commit. Mirrors onDecorationPositionChange
          // — preserves x/y, writes new width/height. One UPDATE_DECORATION
          // dispatch per gesture (SlidePreview fires onResizeStop only).
          onDecorationSizeChange={(id, size) => {
            const target = (currentSlide?.decorations ?? []).find(
              (d) => d.id === id,
            )
            if (!target) return
            dispatch({
              type: 'UPDATE_DECORATION',
              slideIndex: selectedIndex,
              id,
              updates: {
                position: {
                  ...target.position,
                  width: size.width,
                  height: size.height,
                },
              },
            })
          }}
          // quick-260517-k2n: caption-card drag/resize commit. The caption-card
          // <Rnd> in slide-preview supplies a Partial<SlideStyleOverrides>
          // geometry patch; merge it onto the current slide and commit one
          // UPDATE_SLIDE (one undo entry per gesture — SlidePreview fires
          // onDragStop/onResizeStop once).
          onCaptionBarUpdate={(updates) => {
            handleUpdate({
              style_overrides: {
                ...(currentSlide?.style_overrides ?? {}),
                ...updates,
              },
            })
          }}
        />

        {/* Right panel: Editor controls. quick-260514-tan-rail-white-tiles:
            background is the tan page color so the rail blends with the
            canvas behind it; interior tiles + cards are white with brown
            borders (mirrors SlideSettings/Watermark/HookText style). */}
        <aside className="bg-[#fff8f7] lg:rounded-xl flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#dbc1bc]/10">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === 'text'
                  ? 'border-b-2 border-[#3d0000] text-[#3d0000]'
                  : 'text-[#7d6161] hover:bg-[#fff0f0]'
              }`}
            >
              Text
            </button>
            <button
              onClick={() => setActiveTab('elements')}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === 'elements'
                  ? 'border-b-2 border-[#3d0000] text-[#3d0000]'
                  : 'text-[#7d6161] hover:bg-[#fff0f0]'
              }`}
            >
              Elements
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === 'images'
                  ? 'border-b-2 border-[#3d0000] text-[#3d0000]'
                  : 'text-[#7d6161] hover:bg-[#fff0f0]'
              }`}
            >
              Images
            </button>
          </div>

          {/* Panel content + footer all scrollable together */}
          <div className="flex-1 overflow-auto">
            {/* quick-260515-epn: the right-rail panels (TextEditorPanel,
                LegacyTextEditorPanel, ElementsPanel) intentionally receive the
                PROJECT-level `template` — NOT the per-slide-override result.
                They use template.textColor / template.fontFamily / etc. as
                CONTROL DEFAULTS (color pickers, font selectors). Anchoring
                those defaults to the user-picked project template keeps
                toggling the per-slide override on/off REVERSIBLE from the
                control panel. The per-slide override drives only the visual
                CANVAS (slide-canvas.tsx) + THUMBNAILS (sortable-slide.tsx). */}
            {currentSlide && activeTab === 'text' && (
              useNewRail ? (
                <TextEditorPanel
                  slide={currentSlide}
                  template={template}
                  selectedTextBoxId={selectedTextBoxId}
                  onSelectTextBox={setSelectedTextBoxId}
                  onTextBoxAction={(action) => {
                    // Resolve slideIndex from current selection so the panel
                    // stays decoupled from selectedIndex (Phase 49 D-16: the
                    // reducer expects slideIndex on every text-box action).
                    if (action.type === 'ADD_TEXT_BOX') {
                      // Phase 50 (MR-01): pre-generate the id so we can
                      // auto-select the newly added box in the same render
                      // cycle. The reducer reads `defaults.id` if present and
                      // falls back to crypto.randomUUID() otherwise.
                      const newId = crypto.randomUUID()
                      dispatch({
                        type: 'ADD_TEXT_BOX',
                        slideIndex: selectedIndex,
                        role: action.role,
                        defaults: { id: newId },
                      })
                      setSelectedTextBoxId(newId)
                    } else if (action.type === 'UPDATE_TEXT_BOX') {
                      dispatch({
                        type: 'UPDATE_TEXT_BOX',
                        slideIndex: selectedIndex,
                        textBoxId: action.textBoxId,
                        updates: action.updates,
                      })
                    } else if (action.type === 'REMOVE_TEXT_BOX') {
                      // Phase 50 (HR-01): route through useSlideEditor helper so
                      // selectedTextBoxId is cleared if it matched the removed
                      // box. The helper dispatches REMOVE_TEXT_BOX internally.
                      removeTextBox(selectedIndex, action.textBoxId)
                    }
                  }}
                  onUpdate={handleUpdate}
                  selectedCustomTextId={selectedCustomTextId}
                  customTexts={currentSlide.custom_texts}
                  onCustomTextUpdate={handleCustomTextUpdate}
                  onCustomTextRemove={handleRemoveCustomText}
                  brandKit={brandKit}
                  selection={{
                    ids: selection.ids,
                    primary: selection.primary,
                  }}
                  onBulkDelete={(ids) => {
                    // Phase 60 (HIGH-1 review-fix): single dispatch per gesture
                    // so a 5-element bulk delete is one Cmd+Z, not five. The
                    // BULK_DELETE reducer mirrors the per-id loop's policy
                    // (skip hook/body, skip locked, never touch watermark) so
                    // user-visible behavior is unchanged — only history depth.
                    dispatch({
                      type: 'BULK_DELETE',
                      slideIndex: selectedIndex,
                      ids,
                    })
                    // Clear legacy single-id slots if they pointed at a deleted
                    // element (the per-id removeTextBox / handleRemoveCustomImage
                    // helpers used to do this internally; with one dispatch we
                    // mirror that cleanup here at the call site).
                    const idSet = new Set(ids)
                    if (selectedTextBoxId && idSet.has(selectedTextBoxId)) {
                      setSelectedTextBoxId(null)
                    }
                    if (selectedCustomTextId && idSet.has(selectedCustomTextId)) {
                      setSelectedCustomTextId(null)
                    }
                    if (selectedCustomImageId && idSet.has(selectedCustomImageId)) {
                      setSelectedCustomImageId(null)
                    }
                    // Clear the selection model so the ring and TYPE BAR
                    // collapse on the next render.
                    selection.clear()
                  }}
                  // quick-260514-jn5: decoration editing moved to the Elements
                  // tab (see ElementsPanel above). UPDATE_DECORATION /
                  // REMOVE_DECORATION dispatches now live on the ElementsPanel
                  // props — TextEditorPanel no longer carries that surface.
                />
              ) : (
                <LegacyTextEditorPanel
                  slide={currentSlide}
                  template={template}
                  onUpdate={handleUpdate}
                  selectedCustomTextId={selectedCustomTextId}
                  customTexts={currentSlide.custom_texts}
                  onCustomTextUpdate={handleCustomTextUpdate}
                  onCustomTextRemove={handleRemoveCustomText}
                  brandKit={brandKit}
                />
              )
            )}
            {currentSlide && activeTab === 'elements' && (
              <ElementsPanel
                slide={currentSlide}
                templateTextColor={template.textColor}
                onInsertDivider={handleInsertDivider}
                // quick-260514-jn5: decoration inspector + library mode.
                // When a decoration is selected on the canvas, ElementsPanel
                // renders DecorationCard (edit + delete). Otherwise it shows
                // the insert library: icons (LucidePicker), shapes (ShapePicker),
                // dividers (existing tiles).
                activeDecoration={activeDecoration}
                onDecorationUpdate={(updates) => {
                  if (!activeDecoration) return
                  dispatch({
                    type: 'UPDATE_DECORATION',
                    slideIndex: selectedIndex,
                    id: activeDecoration.id,
                    updates,
                  })
                }}
                onDecorationPreview={(updates) => {
                  if (!activeDecoration) return
                  // quick-260514-decoration-controls-polish: transient
                  // live-preview channel — reducer skips pushHistory when
                  // noHistory:true, so the gesture records exactly one undo
                  // entry on the committing dispatch above (KBD-09).
                  dispatch({
                    type: 'UPDATE_DECORATION',
                    slideIndex: selectedIndex,
                    id: activeDecoration.id,
                    updates,
                    noHistory: true,
                  })
                }}
                onDecorationRemove={() => {
                  if (!activeDecoration) return
                  dispatch({
                    type: 'REMOVE_DECORATION',
                    slideIndex: selectedIndex,
                    id: activeDecoration.id,
                  })
                  // Clear the selection ring so the editor doesn't keep
                  // chasing a stale id after the decoration is gone.
                  selection.clear()
                }}
                onOpenIconPicker={() => setOpenPicker('lucide')}
                onOpenShapePicker={() => setOpenPicker('shape')}
                onSwapIcon={() => {
                  if (!activeDecoration || activeDecoration.kind !== 'icon') return
                  setPickerMode({ kind: 'swap-icon', targetId: activeDecoration.id })
                  setOpenPicker('lucide')
                }}
                onBackToLibrary={() => selection.clear()}
                brandKit={brandKit}
                derivedPalette={currentSlide.style_overrides?.derived_palette}
                // quick-260514-move-slide-cards-to-elements: SlideSettings +
                // WatermarkControls moved from TextEditorPanel to here. They
                // mount inside ElementsPanel at the bottom in both selection
                // and library modes (slide-scoped controls, not selection-scoped).
                template={template}
                onSlideUpdate={handleUpdate}
                // quick-260515-k12: transient live-preview channel for the
                // Caption Bar card — caption-bar slider drags dispatch with
                // noHistory:true so the gesture records exactly one undo entry
                // on the committing handleUpdate dispatch (KBD-09).
                onSlidePreview={(updates) =>
                  dispatch({
                    type: 'UPDATE_SLIDE',
                    index: selectedIndex,
                    updates,
                    noHistory: true,
                  })
                }
                userTier={userTier}
                onSlideWatermarkChange={handleSlideWatermarkChange}
                onWatermarkLogoUpload={handleWatermarkLogoUpload}
                onWatermarkLogoRemove={handleWatermarkLogoRemove}
                isWatermarkPending={isWatermarkPending}
              />
            )}
            {currentSlide && activeTab === 'images' && (
              <ImagePickerPanel
                slide={currentSlide}
                slideIndex={selectedIndex}
                projectId={projectId}
                topic={topic}
                userTier={userTier ?? 'free'}
                onUpdate={handleUpdate}
                onRegenerateText={handleRegenerateText}
                onRegenerateImage={handleRegenerateImage}
                onAddCanvasImage={handleAddCustomImage}
              />
            )}

          </div>

          {/* quick-260519-pkt: pinned actions portlet. Lives OUTSIDE the
              overflow-auto scroll area so Undo/Redo + Public + Export stay
              parked at the bottom of the right rail regardless of how far
              the user has scrolled the panel content. The aside is
              `flex flex-col overflow-hidden`, so a non-flex-1 sibling after
              the scroll area naturally pins to the bottom.
              SAVE CHANGES button removed — autosave already fires 2s after
              the last edit via the isDirty debounce on doSave. */}
          <div className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-3 mx-4 mt-2 mb-4">
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95 disabled:opacity-30"
                title="Undo"
              >
                <Icon name="undo" size="sm" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95 disabled:opacity-30"
                title="Redo"
              >
                <Icon name="redo" size="sm" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <VisibilityDropdown
                projectId={projectId}
                title={title ?? 'Untitled Carousel'}
                isPublic={!!initialPublishedState}
                tags={initialPublishedState?.tags ?? []}
              />
              <button
                onClick={async () => {
                  setExporting(true)
                  try {
                    await downloadSlidesAsZip(projectId, slides.length, title ?? 'slides')
                  } catch { /* silently handle */ }
                  finally { setExporting(false) }
                }}
                disabled={exporting}
                className="flex-1 min-w-0 px-3 py-1.5 bg-[#3d0000] text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all text-xs disabled:opacity-50"
              >
                <Icon name="download" size="sm" />
                <span className="truncate">{exporting ? 'Exporting...' : 'Export'}</span>
              </button>
            </div>
            {(userTier ?? 'free') === 'free' && (
              <p className="text-[11px] text-[#7d6161] leading-snug">
                Slides include a ViralSlideMaker watermark.{' '}
                <Link
                  href="/settings/subscription"
                  className="font-semibold text-[#3d0000] hover:underline"
                >
                  Upgrade to remove
                </Link>
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Phase 70 Plan 03 (PICKER-01 + SHAPES-02): picker mounts. Outside the
          three-panel grid so the modal/popover float above the editor.
          LucidePickerDynamic uses next/dynamic (ssr:false) so the eager
          editor route chunk doesn't pull in the lucide-static corpus +
          tanstack-virtual + ufuzzy until the user opens the picker
          (DEPS-05). ShapePicker is small + eager (8 tiles, no heavy deps).
          Both call onPickerAddDecoration → ADD_DECORATION dispatch +
          selection.replaceWith — single pushHistory entry per insert
          (KBD-09 / Phase 68 reducer invariant).

          PCL11 chrome-leak invariant honored: picker DOM is OFF-canvas
          modal chrome — never enters the Satori path or the non-editable
          preview path (the slide-editor's own surface is editable=true). */}
      <LucidePickerDynamic
        open={openPicker === 'lucide'}
        onClose={() => {
          setOpenPicker(null)
          // Reset swap-icon mode so a subsequent picker open from the
          // library tile doesn't accidentally swap. The successful-pick
          // path resets too — this handles Escape / backdrop / X.
          setPickerMode({ kind: 'add' })
        }}
        onAddDecoration={onPickerAddDecoration}
      />
      <ShapePicker
        open={openPicker === 'shape'}
        onClose={() => setOpenPicker(null)}
        onAddDecoration={onPickerAddDecoration}
      />

    </div>
  )
}
