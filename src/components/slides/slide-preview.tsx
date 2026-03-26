'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import Draggable from 'react-draggable'
import type { DraggableData, DraggableEvent } from 'react-draggable'
import type { Slide, TextPosition } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

// TikTok/Instagram safe zone defaults (percentage of canvas)
// Safe area: x 11-89%, y 10-75% (avoids username, captions, buttons)
const SAFE_ZONE = {
  x: 11,        // left margin to avoid side UI
  top: {         // "top" preset: text near top of safe area
    hookY: 12,
    bodyY: 30,
  },
  center: {      // "center" preset: text in center of safe area
    hookY: 30,
    bodyY: 48,
  },
  bottom: {      // "bottom" preset: text in lower-center (still above caption zone)
    hookY: 48,
    bodyY: 62,
  },
}

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
  const hookFontSize = overrides.hook_font_size ?? parseInt(template.hookFontSize)
  const bodyFontSize = overrides.body_font_size ?? parseInt(template.bodyFontSize)

  const hookPos = overrides.hook_position
  const bodyPos = overrides.body_position

  // Determine safe-zone defaults based on text position
  const positionPreset = overrides.text_position ?? template.textPosition
  const defaults = SAFE_ZONE[positionPreset] ?? SAFE_ZONE.center
  const defaultX = SAFE_ZONE.x

  // Resolve actual positions (explicit overrides or safe-zone defaults)
  const resolvedHookX = hookPos?.x ?? defaultX
  const resolvedHookY = hookPos?.y ?? defaults.hookY
  const resolvedBodyX = bodyPos?.x ?? defaultX
  const resolvedBodyY = bodyPos?.y ?? defaults.bodyY

  // Track container dimensions for pixel conversion (editable mode only)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (!editable || !containerRef.current) return
    const el = containerRef.current
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        setContainerSize({ width, height })
      }
    })
    observer.observe(el)
    // Initial measurement
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setContainerSize({ width: rect.width, height: rect.height })
    }
    return () => observer.disconnect()
  }, [editable])

  // Convert percentage to pixels
  const toPixels = useCallback((pctX: number, pctY: number) => {
    if (!containerSize) return { x: 0, y: 0 }
    return {
      x: (pctX / 100) * containerSize.width,
      y: (pctY / 100) * containerSize.height,
    }
  }, [containerSize])

  // Convert pixels to percentage on drag stop
  const handleStop = useCallback((field: 'hook' | 'body') => (_e: DraggableEvent, data: DraggableData) => {
    if (!containerSize || !onPositionChange) return
    const percentX = Math.max(0, Math.min(100, (data.x / containerSize.width) * 100))
    const percentY = Math.max(0, Math.min(100, (data.y / containerSize.height) * 100))
    onPositionChange(field, { x: percentX, y: percentY })
  }, [containerSize, onPositionChange])

  // Shared container styles
  const containerStyle: React.CSSProperties = {
    fontFamily: template.fontFamily,
    color: textColor,
    backgroundColor: template.backgroundColor,
    backgroundImage: slide.background_url ? `url(${slide.background_url})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }

  // Shared text styles
  const hookTextStyle: React.CSSProperties = {
    fontSize: hookFontSize ? `${hookFontSize}px` : undefined,
    textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : undefined,
    fontStyle: template.hookStyle === 'italic' ? 'italic' : undefined,
  }
  const bodyTextStyle: React.CSSProperties = {
    fontSize: bodyFontSize ? `${bodyFontSize}px` : undefined,
  }

  // Non-editable OR editable before container measured: use CSS percentages
  if (!editable || !containerSize) {
    return (
      <div
        ref={containerRef}
        data-testid="slide-preview"
        className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
        style={containerStyle}
      >
        <div className="absolute inset-0" style={{ backgroundColor: template.overlayColor, opacity: template.overlayOpacity }} />

        {/* Hook text */}
        <div style={{
          position: 'absolute',
          left: `${resolvedHookX}%`,
          top: `${resolvedHookY}%`,
          width: `${100 - resolvedHookX * 2}%`,
          zIndex: 10,
          textAlign,
        }}>
          <p className="font-black leading-tight" style={hookTextStyle}>{slide.hook_text}</p>
        </div>

        {/* Body text */}
        {slide.body_text && (
          <div style={{
            position: 'absolute',
            left: `${resolvedBodyX}%`,
            top: `${resolvedBodyY}%`,
            width: `${100 - resolvedBodyX * 2}%`,
            zIndex: 10,
            textAlign,
          }}>
            <p className="leading-relaxed opacity-90" style={bodyTextStyle}>{slide.body_text}</p>
          </div>
        )}

        {/* Slide number badge */}
        <div className="absolute top-2 right-2 z-20 bg-black/60 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center">{index + 1}</div>
      </div>
    )
  }

  // Editable with valid container dimensions: draggable text boxes
  const hookPixels = toPixels(resolvedHookX, resolvedHookY)
  const bodyPixels = toPixels(resolvedBodyX, resolvedBodyY)

  const textBoxStyle: React.CSSProperties = {
    position: 'absolute',
    width: `${100 - defaultX * 2}%`,
    cursor: 'grab',
    padding: '4px 8px',
    borderRadius: '4px',
    textAlign,
    zIndex: 10,
  }

  return (
    <div
      ref={containerRef}
      data-testid="slide-preview"
      className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
      style={containerStyle}
    >
      {/* Overlay */}
      <div className="absolute inset-0" style={{ backgroundColor: template.overlayColor, opacity: template.overlayOpacity }} />

      {/* Draggable hook text */}
      <Draggable
        nodeRef={hookRef as React.RefObject<HTMLElement>}
        bounds="parent"
        position={hookPixels}
        onStop={handleStop('hook')}
      >
        <div
          ref={hookRef}
          style={textBoxStyle}
          className="hover:outline hover:outline-2 hover:outline-white/50 active:cursor-grabbing"
        >
          <p className="font-black leading-tight" style={hookTextStyle}>
            {slide.hook_text}
          </p>
        </div>
      </Draggable>

      {/* Draggable body text */}
      {slide.body_text && (
        <Draggable
          nodeRef={bodyRef as React.RefObject<HTMLElement>}
          bounds="parent"
          position={bodyPixels}
          onStop={handleStop('body')}
        >
          <div
            ref={bodyRef}
            style={textBoxStyle}
            className="hover:outline hover:outline-2 hover:outline-white/50 active:cursor-grabbing"
          >
            <p className="leading-relaxed opacity-90" style={bodyTextStyle}>
              {slide.body_text}
            </p>
          </div>
        </Draggable>
      )}

      {/* Slide number badge */}
      <div className="absolute top-2 right-2 z-20 bg-black/60 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center">
        {index + 1}
      </div>
    </div>
  )
}
