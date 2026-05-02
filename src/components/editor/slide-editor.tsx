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
import { CaptionPanel } from '@/components/captions/caption-panel'
import { Icon } from '@/components/ui/icon'
import { downloadSlidesAsZip } from '@/lib/download/zip-slides'
import { VisibilityDropdown } from '@/components/editor/visibility-dropdown'
import {
  saveSlideData,
  saveTemplateId,
  regenerateSlideText,
  regenerateSlideImageQuery,
  updateSlideTreatment,
  type TreatmentSpec,
} from '@/app/(dashboard)/project/[id]/editor-actions'
import { textBoxesToLegacy } from '@/lib/editor/text-box-adapter'
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
  const [activeTab, setActiveTab] = useState<'text' | 'images'>('text')
  const [showCaptions, setShowCaptions] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [exporting, setExporting] = useState(false)
  const [selectedCustomTextId, setSelectedCustomTextId] = useState<string | null>(null)
  const [selectedCustomImageId, setSelectedCustomImageId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Phase 57 (D-08): photo-treatment override handling. useTransition keeps
  // the spinner state co-located with the editor; revalidatePath fires from
  // the server action so the slide list refreshes on Next's normal cycle.
  const [isTreatmentPending, startTreatmentTransition] = useTransition()
  const handleSlideTreatmentChange = useCallback((spec: TreatmentSpec) => {
    startTreatmentTransition(async () => {
      const result = await updateSlideTreatment(projectId, selectedIndex, spec)
      if (!result.success) {
        console.warn('[updateSlideTreatment] failed:', result.error)
      }
    })
  }, [projectId, selectedIndex])

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

  const currentSlide = slides[selectedIndex]

  // Phase 52 (T-03): keyboard shortcuts on the editor.
  //   Cmd/Ctrl+1, +2, +3 → select Nth text box on current slide
  //   Cmd/Ctrl+D         → add a new custom text box and auto-select it
  //   Delete / Backspace → remove the selected CUSTOM text box (hook/body are
  //                        structural and silently ignored)
  //
  // Skip-when-typing: ignored when an input/textarea/contentEditable element
  // has focus, so users editing text never trigger an accidental shortcut.
  // Listener is attached to `window` and torn down on unmount/dep change to
  // prevent double-fire in dev (StrictMode remounts).
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = document.activeElement as HTMLElement | null
      const tag = (target?.tagName ?? '').toLowerCase()
      const isEditing =
        tag === 'input' ||
        tag === 'textarea' ||
        target?.isContentEditable === true
      if (isEditing) return

      const cmd = e.metaKey || e.ctrlKey
      const textBoxes = currentSlide?.text_boxes ?? []

      if (cmd && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const idx = parseInt(e.key, 10) - 1
        const targetBox = textBoxes[idx]
        if (targetBox) {
          e.preventDefault()
          setSelectedTextBoxId(targetBox.id)
        }
      } else if (cmd && (e.key === 'd' || e.key === 'D')) {
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
        setSelectedTextBoxId(newId)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTextBoxId) {
        const targetBox = textBoxes.find((tb) => tb.id === selectedTextBoxId)
        if (targetBox?.role === 'custom') {
          e.preventDefault()
          // Route through removeTextBox so selectedTextBoxId is cleared if it
          // matched. Hook/body deletion is intentionally not supported — they
          // are structural to legacy compat (hook_text/body_text fields).
          removeTextBox(selectedIndex, selectedTextBoxId)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    currentSlide,
    selectedTextBoxId,
    selectedIndex,
    setSelectedTextBoxId,
    removeTextBox,
    dispatch,
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
          onCustomTextPositionChange={handleCustomTextPositionChange}
          onCustomTextWidthChange={handleCustomTextWidthChange}
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
                onClick={() => setShowCaptions(!showCaptions)}
                className="w-full flex items-center justify-center gap-2 bg-[#fff0f0] text-[#3d0000] border border-[#dbc1bc]/30 rounded-xl px-4 py-2.5 text-xs font-bold hover:bg-[#fadbdb] transition-colors"
              >
                <Icon name="auto_awesome" size="sm" />
                Generate Captions
              </button>
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

      {/* Caption panel below editor */}
      {showCaptions && (
        <CaptionPanel
          projectId={projectId}
          visible={showCaptions}
          onClose={() => setShowCaptions(false)}
        />
      )}
    </div>
  )
}
