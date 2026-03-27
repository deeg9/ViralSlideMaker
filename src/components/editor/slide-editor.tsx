'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSlideEditor } from '@/lib/editor/use-slide-editor'
import { getTemplate } from '@/lib/render/templates/index'
import { SlideList } from '@/components/editor/slide-list'
import { SlideCanvas } from '@/components/editor/slide-canvas'
import { TextEditorPanel } from '@/components/editor/text-editor-panel'
import { ImagePickerPanel } from '@/components/editor/image-picker-panel'
import { CaptionPanel } from '@/components/captions/caption-panel'
import { Icon } from '@/components/ui/icon'
import { downloadSlidesAsZip } from '@/lib/download/zip-slides'
import {
  saveSlideData,
  saveTemplateId,
  regenerateSlideText,
  regenerateSlideImageQuery,
} from '@/app/(dashboard)/project/[id]/editor-actions'
import type { Slide, TextPosition } from '@/lib/types/slide'

interface SlideEditorProps {
  initialSlides: Slide[]
  projectId: string
  templateId: string
  topic: string
  title?: string
  userTier?: 'free' | 'pro' | 'plus'
}

export function SlideEditor({
  initialSlides,
  projectId,
  templateId,
  topic,
  title,
  userTier,
}: SlideEditorProps) {
  const { slides, dispatch, canUndo, canRedo, undo, redo, isDirty } =
    useSlideEditor(initialSlides)
  const [currentTemplateId, setCurrentTemplateId] = useState(templateId)
  const template = getTemplate(currentTemplateId)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'text' | 'images'>('text')
  const [showCaptions, setShowCaptions] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [exporting, setExporting] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (selectedIndex >= slides.length) {
      setSelectedIndex(Math.max(0, slides.length - 1))
    }
  }, [slides.length, selectedIndex])

  const doSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      await saveSlideData(projectId, slides)
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
    dispatch({
      type: 'UPDATE_SLIDE',
      index: selectedIndex,
      updates: { style_overrides: { ...overrides, [key]: position } },
    })
  }

  function handleWidthChange(field: 'hook' | 'body', width: number) {
    if (!currentSlide) return
    const overrides = currentSlide.style_overrides ?? {}
    const key = field === 'hook' ? 'hook_width' : 'body_width'
    dispatch({
      type: 'UPDATE_SLIDE',
      index: selectedIndex,
      updates: { style_overrides: { ...overrides, [key]: width } },
    })
  }

  async function handleRegenerateText() {
    if (!currentSlide) return
    try {
      const result = await regenerateSlideText(projectId, selectedIndex, topic, currentSlide)
      dispatch({
        type: 'UPDATE_SLIDE',
        index: selectedIndex,
        updates: { hook_text: result.hook_text, body_text: result.body_text },
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
    <div className="flex flex-col bg-[#fff8f7] h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)]">
      {/* Three-panel layout — no top toolbar */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] flex-1 overflow-hidden gap-0 lg:gap-3 px-0 lg:px-2 py-0 lg:py-2"
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
          onPositionChange={handlePositionChange}
          onWidthChange={handleWidthChange}
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
              <TextEditorPanel
                slide={currentSlide}
                template={template}
                onUpdate={handleUpdate}
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
              />
            )}

            {/* Footer: undo/redo, export, save — inside scroll area */}
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
