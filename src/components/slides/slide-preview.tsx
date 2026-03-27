'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import Draggable from 'react-draggable'
import type { DraggableData, DraggableEvent } from 'react-draggable'
import type { Slide, TextPosition } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { resolveSlideStyles } from '@/lib/render/resolve-styles'

// Reference canvas dimensions (matches TikTok/Instagram 9:16)
const REF_WIDTH = 1080
const REF_HEIGHT = 1920

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

  const styles = resolveSlideStyles(slide, template)

  const overlayOpacity = styles.overlayOpacity

  // Track container width to compute scale factor
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const observer = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect
      if (width > 0) setContainerWidth(width)
    })
    observer.observe(el)
    const rect = el.getBoundingClientRect()
    if (rect.width > 0) setContainerWidth(rect.width)
    return () => observer.disconnect()
  }, [])

  const scale = containerWidth > 0 ? containerWidth / REF_WIDTH : 0

  // Convert percentage to pixels in reference coordinate space
  const toRefPixels = useCallback((pctX: number, pctY: number) => {
    return {
      x: (pctX / 100) * REF_WIDTH,
      y: (pctY / 100) * REF_HEIGHT,
    }
  }, [])

  // Convert reference pixels to percentage on drag stop
  const handleStop = useCallback((field: 'hook' | 'body') => (_e: DraggableEvent, data: DraggableData) => {
    if (!onPositionChange) return
    const percentX = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
    const percentY = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
    onPositionChange(field, { x: percentX, y: percentY })
  }, [onPositionChange])

  // Background style (shared)
  const innerStyle: React.CSSProperties = {
    width: REF_WIDTH,
    height: REF_HEIGHT,
    fontFamily: template.fontFamily,
    color: styles.textColor,
    backgroundColor: template.backgroundColor,
    backgroundImage: slide.background_url ? `url(${slide.background_url})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }

  // Text width: symmetric margin
  const textWidth = styles.hookWidth

  const hookTextStyle: React.CSSProperties = {
    fontSize: `${styles.hookFontSize}px`,
    fontFamily: styles.hookFontFamily,
    fontWeight: styles.hookFontWeight,
    textTransform: styles.hookTextTransform === 'uppercase' ? 'uppercase' : undefined,
    fontStyle: styles.hookFontStyle,
  }
  const bodyTextStyle: React.CSSProperties = {
    fontSize: `${styles.bodyFontSize}px`,
    fontFamily: styles.bodyFontFamily,
    fontWeight: styles.bodyFontWeight,
    fontStyle: styles.bodyFontStyle,
  }

  // Don't render content until we have a valid scale
  if (scale === 0) {
    return (
      <div
        ref={containerRef}
        data-testid="slide-preview"
        className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
        style={{ backgroundColor: template.backgroundColor }}
      />
    )
  }

  // Non-editable mode (thumbnails, etc.)
  if (!editable) {
    return (
      <div
        ref={containerRef}
        data-testid="slide-preview"
        className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
      >
        <div style={innerStyle}>
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: template.overlayColor,
            opacity: overlayOpacity,
          }} />

          {/* Hook text */}
          <div style={{
            position: 'absolute',
            left: `${styles.hookX}%`,
            top: `${styles.hookY}%`,
            width: `${textWidth}%`,
            zIndex: 10,
            textAlign: styles.textAlign,
          }}>
            <p style={{ ...hookTextStyle, lineHeight: 1.1 }}>{slide.hook_text}</p>
          </div>

          {/* Body text */}
          {slide.body_text && (
            <div style={{
              position: 'absolute',
              left: `${styles.bodyX}%`,
              top: `${styles.bodyY}%`,
              width: `${styles.bodyWidth}%`,
              zIndex: 10,
              textAlign: styles.textAlign,
            }}>
              <p className="opacity-90" style={{ ...bodyTextStyle, lineHeight: 1.5 }}>{slide.body_text}</p>
            </div>
          )}

          {/* Slide number badge */}
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 20,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 28,
            fontWeight: 700,
            borderRadius: '50%',
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}>{index + 1}</div>
        </div>
      </div>
    )
  }

  // Editable mode with draggable text boxes
  const hookPixels = toRefPixels(styles.hookX, styles.hookY)
  const bodyPixels = toRefPixels(styles.bodyX, styles.bodyY)

  const textBoxStyle: React.CSSProperties = {
    position: 'absolute',
    width: `${textWidth}%`,
    cursor: 'grab',
    padding: '4px 8px',
    borderRadius: '4px',
    textAlign: styles.textAlign,
    zIndex: 10,
  }

  return (
    <div
      ref={containerRef}
      data-testid="slide-preview"
      className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
    >
      <div style={innerStyle}>
        {/* Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: template.overlayColor,
          opacity: overlayOpacity,
        }} />

        {/* Draggable hook text */}
        <Draggable
          nodeRef={hookRef as React.RefObject<HTMLElement>}
          bounds="parent"
          position={hookPixels}
          onStop={handleStop('hook')}
          scale={scale}
        >
          <div
            ref={hookRef}
            style={textBoxStyle}
            className="hover:outline hover:outline-2 hover:outline-white/50 active:cursor-grabbing"
          >
            <p style={{ ...hookTextStyle, lineHeight: 1.1 }}>
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
            scale={scale}
          >
            <div
              ref={bodyRef}
              style={textBoxStyle}
              className="hover:outline hover:outline-2 hover:outline-white/50 active:cursor-grabbing"
            >
              <p className="opacity-90" style={{ ...bodyTextStyle, lineHeight: 1.5 }}>
                {slide.body_text}
              </p>
            </div>
          </Draggable>
        )}

        {/* Slide number badge */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 20,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: 28,
          fontWeight: 700,
          borderRadius: '50%',
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>{index + 1}</div>
      </div>
    </div>
  )
}
