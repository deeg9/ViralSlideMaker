'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { useSlideEditor } from '@/lib/editor/use-slide-editor'
import { getTemplate } from '@/lib/render/templates/index'
import { synthesizeBrandKitTemplate, BRAND_KIT_TEMPLATE_ID } from '@/lib/brand-kit/get-effective-template'
import { SlideList } from '@/components/editor/slide-list'
import { SlideCanvas } from '@/components/editor/slide-canvas'
import { TextEditorPanel } from '@/components/editor/text-editor-panel'
import { LegacyTextEditorPanel } from '@/components/editor/text-editor-panel-legacy'
import { ImagePickerPanel } from '@/components/editor/image-picker-panel'
import { ElementsPanel } from '@/components/editor/elements-panel'
import { Icon } from '@/components/ui/icon'
import { downloadSlidesAsZip } from '@/lib/download/zip-slides'
import { VisibilityDropdown } from '@/components/editor/visibility-dropdown'
import {
  saveSlideData,
  saveTemplateId,
  regenerateSlideText,
  regenerateSlideImageQuery,
  updateSlideTreatment,
  updateProjectWatermark,
  createUploadUrl,
  type TreatmentSpec,
  type WatermarkSpec,
} from '@/app/(dashboard)/project/[id]/editor-actions'
import { textBoxesToLegacy } from '@/lib/editor/text-box-adapter'
import { useSelectionModel } from '@/lib/editor/use-selection-model'
import { isEditingTarget } from '@/lib/editor/keyboard-utils'
import { tinykeys } from 'tinykeys'
import type { Slide, TextPosition, CustomText } from '@/lib/types/slide'
import type { BrandKit } from '@/lib/types/brand-kit'

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
  // Brand-kit template synthesizes from the user's brand_kit row at render time.
  // Other template ids hit the static templates registry. Falls back to the first
  // registry entry when brand-kit is selected but the brand kit was deleted.
  const template =
    currentTemplateId === BRAND_KIT_TEMPLATE_ID && brandKit
      ? synthesizeBrandKitTemplate(brandKit)
      : getTemplate(currentTemplateId)
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

  // Phase 57 (D-08): photo-treatment override handling. useTransition keeps
  // the spinner state co-located with the editor; revalidatePath fires from
  // the server action so the slide list refreshes on Next's normal cycle.
  //
  // quick-260502-fv9: hybrid local-state sync — see handler below.
  const [isTreatmentPending, startTreatmentTransition] = useTransition()
  // quick-260502-fv9: hybrid local-state sync. Optimistically dispatch
  // treatment_applied + grain_intensity BEFORE the server call so the
  // active button flips instantly. After the server returns, merge the
  // server-computed fields (background_url, original_source_url,
  // derived_palette) so the preview swaps to the treated image without
  // a refresh.
  const handleSlideTreatmentChange = useCallback((spec: TreatmentSpec) => {
    if (currentSlide) {
      // Optimistic — flip the button + grain state immediately.
      // background_url is server-computed (treatPhoto + Storage upload),
      // so it stays untouched here and is merged from the response below.
      dispatch({
        type: 'UPDATE_SLIDE',
        index: selectedIndex,
        updates: {
          style_overrides: {
            ...(currentSlide.style_overrides ?? {}),
            treatment_applied: spec.kind === 'none' ? undefined : spec.kind,
            grain_intensity: spec.grain,
          },
        },
      })
    }
    startTreatmentTransition(async () => {
      const result = await updateSlideTreatment(projectId, selectedIndex, spec)
      if (!result.success) {
        console.warn('[updateSlideTreatment] failed:', result.error)
        return
      }
      // Server-computed fields: background_url (treated image URL),
      // original_source_url (back-filled if it was null pre-Phase 55),
      // and derived_palette (re-extracted from the treated image).
      const updated = result.slide
      dispatch({
        type: 'UPDATE_SLIDE',
        index: selectedIndex,
        updates: {
          background_url: updated.background_url,
          original_source_url: updated.original_source_url,
          style_overrides: {
            ...(currentSlide?.style_overrides ?? {}),
            treatment_applied: updated.style_overrides?.treatment_applied,
            grain_intensity: updated.style_overrides?.grain_intensity,
            derived_palette: updated.style_overrides?.derived_palette,
          },
        },
      })
    })
  }, [projectId, selectedIndex, currentSlide, dispatch])

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
  //   Escape             → clear selection (SEL-08; Phase 62 will add
  //                        group-aware double-press)
  //   Delete / Backspace → remove the selected CUSTOM text box (hook/body are
  //                        structural and silently ignored)
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
        if (isEditingTarget(e.target)) return
        const targetBox = textBoxes[0]
        if (!targetBox) return
        e.preventDefault()
        selection.replaceWith([targetBox.id])
        // Legacy single-id slot — kept in sync until Phase 66 cleanup.
        setSelectedTextBoxId(targetBox.id)
      },
      '$mod+2': (e) => {
        if (isEditingTarget(e.target)) return
        const targetBox = textBoxes[1]
        if (!targetBox) return
        e.preventDefault()
        selection.replaceWith([targetBox.id])
        setSelectedTextBoxId(targetBox.id)
      },
      '$mod+3': (e) => {
        if (isEditingTarget(e.target)) return
        const targetBox = textBoxes[2]
        if (!targetBox) return
        e.preventDefault()
        selection.replaceWith([targetBox.id])
        setSelectedTextBoxId(targetBox.id)
      },

      '$mod+d': (e) => {
        if (isEditingTarget(e.target)) return
        e.preventDefault()
        // Pre-generate the id (same pattern as TextEditorPanel.onTextBoxAction
        // ADD_TEXT_BOX from Phase 50 MR-01) so we can immediately auto-select
        // the new custom box. Reducer reads `defaults.id` if present.
        const newId = crypto.randomUUID()
        dispatch({
          type: 'ADD_TEXT_BOX',
          slideIndex: selectedIndex,
          role: 'custom',
          defaults: { id: newId },
        })
        selection.replaceWith([newId])
        setSelectedTextBoxId(newId)
      },

      // Phase 60 SEL-07: select all addressable elements on the active slide.
      '$mod+a': (e) => {
        if (isEditingTarget(e.target)) return
        e.preventDefault()
        if (currentSlide) selection.selectAll(currentSlide)
      },

      // Phase 60 SEL-08: single-press clear. Phase 62 will layer group-aware
      // double-press (first Esc = exit group; second Esc = clear).
      'Escape': (e) => {
        if (isEditingTarget(e.target)) return
        e.preventDefault()
        selection.clear()
        setSelectedTextBoxId(null)
      },

      'Delete': (e) => {
        if (isEditingTarget(e.target)) return
        if (!selectedTextBoxId) return
        const targetBox = textBoxes.find((tb) => tb.id === selectedTextBoxId)
        if (targetBox?.role !== 'custom') return
        e.preventDefault()
        // Route through removeTextBox so selectedTextBoxId is cleared if it
        // matched. Hook/body deletion is intentionally not supported — they
        // are structural to legacy compat (hook_text/body_text fields).
        // Phase 60 keeps single-select-delete UX; bulk-delete is Phase 64.
        removeTextBox(selectedIndex, selectedTextBoxId)
      },
      'Backspace': (e) => {
        if (isEditingTarget(e.target)) return
        if (!selectedTextBoxId) return
        const targetBox = textBoxes.find((tb) => tb.id === selectedTextBoxId)
        if (targetBox?.role !== 'custom') return
        e.preventDefault()
        removeTextBox(selectedIndex, selectedTextBoxId)
      },
    })

    return () => unsubscribe()
  }, [
    currentSlide,
    selectedTextBoxId,
    selectedIndex,
    setSelectedTextBoxId,
    removeTextBox,
    dispatch,
    selection,
  ])

  async function handleTemplateChange(newId: string) {
    setCurrentTemplateId(newId)
    await saveTemplateId(projectId, newId)
  }

  function handleUpdate(updates: Partial<Slide>) {
    dispatch({ type: 'UPDATE_SLIDE', index: selectedIndex, updates })
  }

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

  return (
    <div className="flex flex-col bg-[#fff8f7] h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)] overflow-hidden">
      {/* Three-panel layout -- no top toolbar */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[260px_1fr_340px] flex-1 min-h-0 overflow-hidden gap-0 lg:gap-3 px-0 lg:px-2 py-0 lg:py-2"
        data-testid="editor-grid"
      >
        {/* Left panel: Slide thumbnails + actions at bottom */}
        <aside className="bg-[#fff0f0] lg:rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#3d0000] mb-1">
                Presentation
              </span>
              <span className="text-[#795e5e] text-xs">{slides.length} Slides</span>
            </div>
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
          </div>

          {/* Bottom actions: back, title, slide actions, help */}
          <div className="p-3 border-t border-[#dbc1bc]/20 space-y-3">
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
            <div className="flex items-center gap-1">
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
              <button
                onClick={() => setActiveTab('images')}
                className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95"
                title="Add Image"
              >
                <Icon name="add_photo_alternate" size="sm" />
              </button>
              <div className="flex-1" />
              <button className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-colors" title="Help">
                <Icon name="help" size="sm" />
              </button>
            </div>
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
          selection={{ ids: selection.ids, primary: selection.primary }}
          onSelectionChange={selection.setSelection}
        />

        {/* Right panel: Editor controls */}
        <aside className="bg-white lg:rounded-xl flex flex-col overflow-hidden">
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
                  onSlideTreatmentChange={handleSlideTreatmentChange}
                  isTreatmentPending={isTreatmentPending}
                  userTier={userTier}
                  onSlideWatermarkChange={handleSlideWatermarkChange}
                  onWatermarkLogoUpload={handleWatermarkLogoUpload}
                  onWatermarkLogoRemove={handleWatermarkLogoRemove}
                  isWatermarkPending={isWatermarkPending}
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
                templateTextColor={template.textColor}
                onInsertDivider={handleInsertDivider}
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

            {/* Footer: undo/redo, export, save -- inside scroll area */}
            <div className="p-4 bg-[#fff0f0] border-t border-[#dbc1bc]/10 space-y-3 mt-4">
              <div className="flex items-center justify-between">
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
                    className="px-4 py-1.5 bg-[#3d0000] text-white rounded-xl font-medium flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all text-xs disabled:opacity-50"
                  >
                    <Icon name="download" size="sm" />
                    {exporting ? 'Exporting...' : 'Export'}
                  </button>
                </div>
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
              <button
                onClick={doSave}
                className="w-full py-3 bg-[#3d0000] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:opacity-90 active:scale-95 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </aside>
      </div>

    </div>
  )
}
