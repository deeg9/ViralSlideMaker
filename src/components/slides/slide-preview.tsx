'use client'

import { useRef, useCallback } from 'react'
import Draggable from 'react-draggable'
import type { DraggableData, DraggableEvent } from 'react-draggable'
import type { Slide, TextPosition } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

interface SlidePreviewProps {
  slide: Slide
  template: SlideTemplate
  index: number
  editable?: boolean
  onPositionChange?: (field: 'hook' | 'body', position: TextPosition) => void
}

export function SlidePreview({ slide, template, index, editable, onPositionChange }: SlidePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hookRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const overrides = slide.style_overrides ?? {}

  const textColor = overrides.text_color ?? template.textColor
  const textAlign = overrides.text_align ?? template.textAlign
  const hookFontSize = overrides.hook_font_size ?? undefined
  const bodyFontSize = overrides.body_font_size ?? undefined

  const hookPos = overrides.hook_position
  const bodyPos = overrides.body_position
  const hasFreePosition = !!(hookPos || bodyPos)

  // Convert percentage to pixels
  const toPixels = useCallback((pos: TextPosition | undefined, fallbackY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const { width, height } = containerRef.current.getBoundingClientRect()
    if (pos) {
      return { x: (pos.x / 100) * width, y: (pos.y / 100) * height }
    }
    return { x: (5 / 100) * width, y: (fallbackY / 100) * height }
  }, [])

  // Convert pixels to percentage on drag stop
  const handleStop = useCallback((field: 'hook' | 'body') => (_e: DraggableEvent, data: DraggableData) => {
    if (!containerRef.current || !onPositionChange) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const percentX = Math.max(0, Math.min(100, (data.x / width) * 100))
    const percentY = Math.max(0, Math.min(100, (data.y / height) * 100))
    onPositionChange(field, { x: percentX, y: percentY })
  }, [onPositionChange])

  // Old flex-based layout (backward compat for thumbnails without free position)
  if (!hasFreePosition && !editable) {
    const positionMap = { top: 'flex-start', center: 'center', bottom: 'flex-end' } as const
    const textPosition = overrides.text_position ?? template.textPosition
    return (
      <div
        ref={containerRef}
        data-testid="slide-preview"
        className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
        style={{
          fontFamily: template.fontFamily,
          color: textColor,
          backgroundColor: template.backgroundColor,
          backgroundImage: slide.background_url ? `url(${slide.background_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0" style={{ backgroundColor: template.overlayColor, opacity: template.overlayOpacity }} />
        <div className="relative z-10 flex flex-col h-full p-4 sm:p-6" style={{ justifyContent: positionMap[textPosition], textAlign }}>
          <div className="max-w-full">
            <p className="font-black leading-tight mb-2" style={{ fontSize: hookFontSize ? `${hookFontSize}px` : undefined, textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : undefined, fontStyle: template.hookStyle === 'italic' ? 'italic' : undefined }}>{slide.hook_text}</p>
            <p className="leading-relaxed opacity-90" style={{ fontSize: bodyFontSize ? `${bodyFontSize}px` : undefined }}>{slide.body_text}</p>
          </div>
        </div>
        <div className="absolute top-2 right-2 z-20 bg-black/60 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center">{index + 1}</div>
      </div>
    )
  }

  // Free-position layout (absolute positioned text boxes)
  const defaultHookY = overrides.text_position === 'top' ? 5 : overrides.text_position === 'center' ? 30 : 60
  const defaultBodyY = defaultHookY + 20

  const hookPixels = toPixels(hookPos, defaultHookY)
  const bodyPixels = toPixels(bodyPos, defaultBodyY)

  const textBoxStyle = (isHook: boolean): React.CSSProperties => ({
    position: 'absolute',
    maxWidth: '90%',
    cursor: editable ? 'grab' : 'default',
    padding: editable ? '4px 8px' : '2px 4px',
    borderRadius: editable ? '4px' : undefined,
    textAlign,
    zIndex: 10,
  })

  const hookElement = (
    <div
      ref={hookRef}
      style={textBoxStyle(true)}
      className={editable ? 'hover:outline hover:outline-2 hover:outline-white/50 active:cursor-grabbing' : ''}
    >
      <p
        className="font-black leading-tight"
        style={{
          fontSize: hookFontSize ? `${hookFontSize}px` : undefined,
          textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : undefined,
          fontStyle: template.hookStyle === 'italic' ? 'italic' : undefined,
        }}
      >
        {slide.hook_text}
      </p>
    </div>
  )

  const bodyElement = slide.body_text ? (
    <div
      ref={bodyRef}
      style={textBoxStyle(false)}
      className={editable ? 'hover:outline hover:outline-2 hover:outline-white/50 active:cursor-grabbing' : ''}
    >
      <p
        className="leading-relaxed opacity-90"
        style={{ fontSize: bodyFontSize ? `${bodyFontSize}px` : undefined }}
      >
        {slide.body_text}
      </p>
    </div>
  ) : null

  return (
    <div
      ref={containerRef}
      data-testid="slide-preview"
      className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
      style={{
        fontFamily: template.fontFamily,
        color: textColor,
        backgroundColor: template.backgroundColor,
        backgroundImage: slide.background_url ? `url(${slide.background_url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0" style={{ backgroundColor: template.overlayColor, opacity: template.overlayOpacity }} />

      {/* Draggable hook text */}
      {editable ? (
        <Draggable
          nodeRef={hookRef as React.RefObject<HTMLElement>}
          bounds="parent"
          position={hookPixels}
          onStop={handleStop('hook')}
        >
          {hookElement}
        </Draggable>
      ) : (
        <div style={{ position: 'absolute', left: `${hookPos?.x ?? 5}%`, top: `${hookPos?.y ?? defaultHookY}%`, maxWidth: '90%', zIndex: 10 }}>
          <p className="font-black leading-tight" style={{ fontSize: hookFontSize ? `${hookFontSize}px` : undefined, textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : undefined, fontStyle: template.hookStyle === 'italic' ? 'italic' : undefined }}>{slide.hook_text}</p>
        </div>
      )}

      {/* Draggable body text */}
      {bodyElement && editable ? (
        <Draggable
          nodeRef={bodyRef as React.RefObject<HTMLElement>}
          bounds="parent"
          position={bodyPixels}
          onStop={handleStop('body')}
        >
          {bodyElement}
        </Draggable>
      ) : bodyElement && (
        <div style={{ position: 'absolute', left: `${bodyPos?.x ?? 5}%`, top: `${bodyPos?.y ?? defaultBodyY}%`, maxWidth: '90%', zIndex: 10 }}>
          <p className="leading-relaxed opacity-90" style={{ fontSize: bodyFontSize ? `${bodyFontSize}px` : undefined }}>{slide.body_text}</p>
        </div>
      )}

      {/* Slide number badge */}
      <div className="absolute top-2 right-2 z-20 bg-black/60 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center">
        {index + 1}
      </div>
    </div>
  )
}
