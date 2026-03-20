'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSlideEditor } from '@/lib/editor/use-slide-editor'
import { getTemplate } from '@/lib/render/templates/index'
import { TemplatePicker } from '@/components/slides/template-picker'
import { EditorToolbar } from '@/components/editor/editor-toolbar'
import { SlideList } from '@/components/editor/slide-list'
import { SlideCanvas } from '@/components/editor/slide-canvas'
import { TextEditorPanel } from '@/components/editor/text-editor-panel'
import { ImagePickerPanel } from '@/components/editor/image-picker-panel'
import {
  saveSlideData,
  saveTemplateId,
  regenerateSlideText,
  regenerateSlideImageQuery,
} from '@/app/(dashboard)/project/[id]/editor-actions'
import type { Slide } from '@/lib/types/slide'

interface SlideEditorProps {
  initialSlides: Slide[]
  projectId: string
  templateId: string
  topic: string
}

export function SlideEditor({
  initialSlides,
  projectId,
  templateId,
  topic,
}: SlideEditorProps) {
  const { slides, dispatch, canUndo, canRedo, undo, redo, isDirty } =
    useSlideEditor(initialSlides)
  const [currentTemplateId, setCurrentTemplateId] = useState(templateId)
  const template = getTemplate(currentTemplateId)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clamp selectedIndex when slides are removed
  useEffect(() => {
    if (selectedIndex >= slides.length) {
      setSelectedIndex(Math.max(0, slides.length - 1))
    }
  }, [slides.length, selectedIndex])

  // Auto-save with 2-second debounce
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

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(doSave, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
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

  async function handleRegenerateText() {
    if (!currentSlide) return
    try {
      const result = await regenerateSlideText(projectId, selectedIndex, topic, currentSlide)
      dispatch({
        type: 'UPDATE_SLIDE',
        index: selectedIndex,
        updates: { hook_text: result.hook_text, body_text: result.body_text },
      })
    } catch {
      // Silently handle regen errors
    }
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
    } catch {
      // Silently handle regen errors
    }
  }

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-background">
      {/* Toolbar */}
      <EditorToolbar
        onAdd={() => {
          dispatch({ type: 'ADD_SLIDE', index: selectedIndex + 1 })
          setSelectedIndex(selectedIndex + 1)
        }}
        onDuplicate={() => {
          dispatch({ type: 'DUPLICATE_SLIDE', index: selectedIndex })
          setSelectedIndex(selectedIndex + 1)
        }}
        onDelete={() => {
          dispatch({ type: 'REMOVE_SLIDE', index: selectedIndex })
        }}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        slideCount={slides.length}
      />

      {/* Save status */}
      {saveStatus !== 'idle' && (
        <div className="px-4 py-1 text-xs text-muted-foreground border-b border-border">
          {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
        </div>
      )}

      {/* Template picker */}
      <details className="border-b border-border">
        <summary className="px-4 py-2 text-sm font-medium cursor-pointer hover:bg-muted/50 select-none">
          Change Template
        </summary>
        <div className="px-4 pb-3">
          <TemplatePicker
            selectedId={currentTemplateId}
            onSelect={handleTemplateChange}
          />
        </div>
      </details>

      {/* Main editor grid */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] min-h-[600px]"
        data-testid="editor-grid"
      >
        {/* Left sidebar: slide thumbnails */}
        <div className="border-b lg:border-b-0 lg:border-r border-border overflow-auto max-h-[200px] lg:max-h-none">
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

        {/* Center: canvas */}
        <div className="overflow-auto">
          <SlideCanvas
            slides={slides}
            template={template}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
          />
        </div>

        {/* Right sidebar: editing panel */}
        <div className="border-t lg:border-t-0 lg:border-l border-border overflow-auto max-h-[400px] lg:max-h-none">
          {currentSlide && (
            <>
              <TextEditorPanel
                slide={currentSlide}
                template={template}
                onUpdate={handleUpdate}
              />
              <div className="border-t border-border" />
              <ImagePickerPanel
                slide={currentSlide}
                slideIndex={selectedIndex}
                projectId={projectId}
                topic={topic}
                onUpdate={handleUpdate}
                onRegenerateText={handleRegenerateText}
                onRegenerateImage={handleRegenerateImage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
