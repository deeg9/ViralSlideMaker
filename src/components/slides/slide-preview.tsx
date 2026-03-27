'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Rnd } from 'react-rnd'
import type { Slide, TextPosition, CustomText } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { useAlignmentGuides, type TextBox } from '@/hooks/use-alignment-guides'

// Reference canvas dimensions (matches TikTok/Instagram 9:16)
const REF_WIDTH = 1080
const REF_HEIGHT = 1920

// TikTok/Instagram safe zone defaults (percentage of canvas)
const SAFE_ZONE = {
  x: 11,
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
}

// Resize handle visual affordance
const resizeHandleStyle: React.CSSProperties = {
  width: 4,
  height: 40,
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  borderRadius: 2,
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
}

interface SlidePreviewProps {
  slide: Slide
  template: SlideTemplate
  index: number
  editable?: boolean
  onPositionChange?: (field: 'hook' | 'body', position: TextPosition) => void
  onWidthChange?: (field: 'hook' | 'body', width: number) => void
  onCustomTextPositionChange?: (id: string, position: TextPosition) => void
  onCustomTextWidthChange?: (id: string, width: number) => void
  onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void
  onCustomTextSelect?: (id: string | null) => void
  onCustomTextRemove?: (id: string) => void
  selectedCustomTextId?: string | null
}

export function SlidePreview({
  slide, template, index, editable,
  onPositionChange, onWidthChange,
  onCustomTextPositionChange, onCustomTextWidthChange,
  onCustomTextUpdate, onCustomTextSelect, onCustomTextRemove,
  selectedCustomTextId,
}: SlidePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hookRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const customTextRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { calculateSnap, activeGuides, clearGuides } = useAlignmentGuides()
  const overrides = slide.style_overrides ?? {}

  const [editingCustomTextId, setEditingCustomTextId] = useState<string | null>(null)

  const textColor = overrides.text_color ?? template.textColor
  const hookTextColor = overrides.hook_text_color ?? textColor
  const bodyTextColor = overrides.body_text_color ?? textColor
  const textAlign = overrides.text_align ?? template.textAlign
  const hookFontSize = overrides.hook_font_size ?? parseInt(template.hookFontSize)
  const bodyFontSize = overrides.body_font_size ?? parseInt(template.bodyFontSize)

  // Font family overrides (Phase 12)
  const hookFontFamily = overrides.hook_font_family ?? template.fontFamily
  const bodyFontFamily = overrides.body_font_family ?? template.fontFamily

  // Bold/italic overrides (Phase 11)
  const hookFontWeight = overrides.hook_font_weight ?? 900
  const bodyFontWeight = overrides.body_font_weight ?? 400
  const hookFontStyle = overrides.hook_font_style ?? 'normal'
  const bodyFontStyle = overrides.body_font_style ?? 'normal'

  const overlayOpacity = overrides.overlay_opacity != null
    ? overrides.overlay_opacity / 100
    : template.overlayOpacity

  const hookPos = overrides.hook_position
  const bodyPos = overrides.body_position

  const positionPreset = overrides.text_position ?? template.textPosition
  const defaults = SAFE_ZONE[positionPreset] ?? SAFE_ZONE.center
  const defaultX = SAFE_ZONE.x

  const resolvedHookX = hookPos?.x ?? defaultX
  const resolvedHookY = hookPos?.y ?? defaults.hookY
  const resolvedBodyX = bodyPos?.x ?? defaultX
  const resolvedBodyY = bodyPos?.y ?? defaults.bodyY

  // Width: use override or symmetric calc, min 20%
  const hookWidth = Math.max(20, overrides.hook_width ?? (100 - resolvedHookX * 2))
  const bodyWidth = Math.max(20, overrides.body_width ?? (100 - resolvedBodyX * 2))

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

  // Delete key handler for selected custom text
  useEffect(() => {
    if (!editable || !selectedCustomTextId || editingCustomTextId) return
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCustomTextId) {
        e.preventDefault()
        onCustomTextRemove?.(selectedCustomTextId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editable, selectedCustomTextId, editingCustomTextId, onCustomTextRemove])

  const hookTextStyle: React.CSSProperties = {
    fontSize: `${hookFontSize}px`,
    fontFamily: hookFontFamily,
    fontWeight: hookFontWeight,
    fontStyle: hookFontStyle === 'italic' ? 'italic' : (template.hookStyle === 'italic' ? 'italic' : undefined),
    textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : undefined,
    color: hookTextColor,
  }
  const bodyTextStyle: React.CSSProperties = {
    fontSize: `${bodyFontSize}px`,
    fontFamily: bodyFontFamily,
    fontWeight: bodyFontWeight,
    fontStyle: bodyFontStyle === 'italic' ? 'italic' : undefined,
    color: bodyTextColor,
  }

  // Background style (shared)
  const innerStyle: React.CSSProperties = {
    width: REF_WIDTH,
    height: REF_HEIGHT,
    fontFamily: template.fontFamily,
    color: textColor,
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

  // Helper: build "others" array for snap calculations including custom texts
  const buildOthersForSnap = useCallback((excludeId: string): TextBox[] => {
    const others: TextBox[] = []
    if (excludeId !== 'hook') {
      others.push({
        id: 'hook',
        x: (resolvedHookX / 100) * REF_WIDTH,
        y: (resolvedHookY / 100) * REF_HEIGHT,
        width: (hookWidth / 100) * REF_WIDTH,
        height: hookRef.current?.getBoundingClientRect().height
          ? hookRef.current.getBoundingClientRect().height / scale
          : 200,
      })
    }
    if (excludeId !== 'body' && slide.body_text) {
      others.push({
        id: 'body',
        x: (resolvedBodyX / 100) * REF_WIDTH,
        y: (resolvedBodyY / 100) * REF_HEIGHT,
        width: (bodyWidth / 100) * REF_WIDTH,
        height: bodyRef.current?.getBoundingClientRect().height
          ? bodyRef.current.getBoundingClientRect().height / scale
          : 200,
      })
    }
    for (const ct of slide.custom_texts ?? []) {
      if (ct.id === excludeId) continue
      const ref = customTextRefs.current[ct.id]
      others.push({
        id: ct.id,
        x: (ct.x / 100) * REF_WIDTH,
        y: (ct.y / 100) * REF_HEIGHT,
        width: (ct.width / 100) * REF_WIDTH,
        height: ref?.getBoundingClientRect().height
          ? ref.getBoundingClientRect().height / scale
          : 100,
      })
    }
    return others
  }, [resolvedHookX, resolvedHookY, hookWidth, resolvedBodyX, resolvedBodyY, bodyWidth, slide.body_text, slide.custom_texts, scale])

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
            left: `${resolvedHookX}%`,
            top: `${resolvedHookY}%`,
            width: `${hookWidth}%`,
            zIndex: 10,
            textAlign,
          }}>
            <p className="" style={{ ...hookTextStyle, lineHeight: 1.1 }}>{slide.hook_text}</p>
          </div>

          {/* Body text */}
          {slide.body_text && (
            <div style={{
              position: 'absolute',
              left: `${resolvedBodyX}%`,
              top: `${resolvedBodyY}%`,
              width: `${bodyWidth}%`,
              zIndex: 10,
              textAlign,
            }}>
              <p className="opacity-90" style={{ ...bodyTextStyle, lineHeight: 1.5 }}>{slide.body_text}</p>
            </div>
          )}

          {/* Custom texts (non-editable) */}
          {(slide.custom_texts ?? []).map((ct) => (
            <div
              key={ct.id}
              style={{
                position: 'absolute',
                left: `${ct.x}%`,
                top: `${ct.y}%`,
                width: `${ct.width}%`,
                zIndex: 10,
                textAlign: ct.text_align ?? 'left',
                fontSize: `${ct.font_size ?? 48}px`,
                fontFamily: ct.font_family ?? template.fontFamily,
                fontWeight: ct.font_weight ?? 400,
                fontStyle: ct.font_style ?? 'normal',
                color: ct.color ?? textColor,
                lineHeight: 1.3,
              }}
            >
              {ct.text}
            </div>
          ))}

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

  // Editable mode with react-rnd drag+resize text boxes
  const hookPixels = {
    x: (resolvedHookX / 100) * REF_WIDTH,
    y: (resolvedHookY / 100) * REF_HEIGHT,
  }
  const bodyPixels = {
    x: (resolvedBodyX / 100) * REF_WIDTH,
    y: (resolvedBodyY / 100) * REF_HEIGHT,
  }

  const hookWidthPx = (hookWidth / 100) * REF_WIDTH
  const bodyWidthPx = (bodyWidth / 100) * REF_WIDTH

  const enableResizing = {
    left: true,
    right: true,
    top: false,
    bottom: false,
    topLeft: false,
    topRight: false,
    bottomLeft: false,
    bottomRight: false,
  }

  const resizeHandleStyles = {
    left: { ...resizeHandleStyle, left: -2 },
    right: { ...resizeHandleStyle, right: -2 },
  }

  return (
    <div
      ref={containerRef}
      data-testid="slide-preview"
      className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
    >
      <div
        style={innerStyle}
        onClick={(e) => {
          // Click on canvas background clears custom text selection
          if (e.target === e.currentTarget) {
            onCustomTextSelect?.(null)
          }
        }}
      >
        {/* Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: template.overlayColor,
          opacity: overlayOpacity,
        }} />

        {/* Resizable + Draggable hook text */}
        <Rnd
          position={hookPixels}
          size={{ width: hookWidthPx, height: 'auto' as unknown as number }}
          scale={scale}
          bounds="parent"
          enableResizing={enableResizing}
          resizeHandleStyles={resizeHandleStyles}
          onDrag={(_e, data) => {
            const dragging: TextBox = {
              id: 'hook',
              x: data.x,
              y: data.y,
              width: hookWidthPx,
              height: hookRef.current?.getBoundingClientRect().height
                ? hookRef.current.getBoundingClientRect().height / scale
                : 200,
            }
            const others = buildOthersForSnap('hook')
            const result = calculateSnap(dragging, others)
            data.x = result.snappedX
            data.y = result.snappedY
          }}
          onDragStop={(_e, data) => {
            clearGuides()
            if (!onPositionChange) return
            const percentX = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
            const percentY = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
            onPositionChange('hook', { x: percentX, y: percentY })
          }}
          onResizeStop={(_e, _dir, ref, _delta, position) => {
            const newWidthPct = Math.max(20, Math.min(100, (parseInt(ref.style.width) / REF_WIDTH) * 100))
            onWidthChange?.('hook', Math.round(newWidthPct))
            if (onPositionChange) {
              const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
              const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
              onPositionChange('hook', { x: percentX, y: percentY })
            }
          }}
          onMouseDown={() => onCustomTextSelect?.(null)}
          style={{ zIndex: 10 }}
          className="hover:outline hover:outline-2 hover:outline-white/50"
        >
          <div ref={hookRef} style={{
            width: '100%',
            cursor: 'grab',
            padding: '4px 8px',
            borderRadius: '4px',
            textAlign,
          }}>
            <p className="" style={{ ...hookTextStyle, lineHeight: 1.1 }}>
              {slide.hook_text}
            </p>
          </div>
        </Rnd>

        {/* Resizable + Draggable body text */}
        {slide.body_text && (
          <Rnd
            position={bodyPixels}
            size={{ width: bodyWidthPx, height: 'auto' as unknown as number }}
            scale={scale}
            bounds="parent"
            enableResizing={enableResizing}
            resizeHandleStyles={resizeHandleStyles}
            onDrag={(_e, data) => {
              const dragging: TextBox = {
                id: 'body',
                x: data.x,
                y: data.y,
                width: bodyWidthPx,
                height: bodyRef.current?.getBoundingClientRect().height
                  ? bodyRef.current.getBoundingClientRect().height / scale
                  : 200,
              }
              const others = buildOthersForSnap('body')
              const result = calculateSnap(dragging, others)
              data.x = result.snappedX
              data.y = result.snappedY
            }}
            onDragStop={(_e, data) => {
              clearGuides()
              if (!onPositionChange) return
              const percentX = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
              const percentY = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
              onPositionChange('body', { x: percentX, y: percentY })
            }}
            onResizeStop={(_e, _dir, ref, _delta, position) => {
              const newWidthPct = Math.max(20, Math.min(100, (parseInt(ref.style.width) / REF_WIDTH) * 100))
              onWidthChange?.('body', Math.round(newWidthPct))
              if (onPositionChange) {
                const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
                const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
                onPositionChange('body', { x: percentX, y: percentY })
              }
            }}
            onMouseDown={() => onCustomTextSelect?.(null)}
            style={{ zIndex: 10 }}
            className="hover:outline hover:outline-2 hover:outline-white/50"
          >
            <div ref={bodyRef} style={{
              width: '100%',
              cursor: 'grab',
              padding: '4px 8px',
              borderRadius: '4px',
              textAlign,
            }}>
              <p className="opacity-90" style={{ ...bodyTextStyle, lineHeight: 1.5 }}>
                {slide.body_text}
              </p>
            </div>
          </Rnd>
        )}

        {/* Custom text boxes */}
        {(slide.custom_texts ?? []).map((ct) => {
          const ctPixels = {
            x: (ct.x / 100) * REF_WIDTH,
            y: (ct.y / 100) * REF_HEIGHT,
          }
          const ctWidthPx = (ct.width / 100) * REF_WIDTH
          const isSelected = selectedCustomTextId === ct.id
          const isEditing = editingCustomTextId === ct.id

          return (
            <Rnd
              key={ct.id}
              position={ctPixels}
              size={{ width: ctWidthPx, height: 'auto' as unknown as number }}
              scale={scale}
              bounds="parent"
              enableResizing={enableResizing}
              resizeHandleStyles={resizeHandleStyles}
              disableDragging={isEditing}
              onDrag={(_e, data) => {
                const dragging: TextBox = {
                  id: ct.id,
                  x: data.x,
                  y: data.y,
                  width: ctWidthPx,
                  height: customTextRefs.current[ct.id]?.getBoundingClientRect().height
                    ? customTextRefs.current[ct.id]!.getBoundingClientRect().height / scale
                    : 100,
                }
                const others = buildOthersForSnap(ct.id)
                const result = calculateSnap(dragging, others)
                data.x = result.snappedX
                data.y = result.snappedY
              }}
              onDragStop={(_e, data) => {
                clearGuides()
                const percentX = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
                const percentY = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
                onCustomTextPositionChange?.(ct.id, { x: percentX, y: percentY })
              }}
              onResizeStop={(_e, _dir, ref, _delta, position) => {
                const newWidthPct = Math.max(20, Math.min(100, (parseInt(ref.style.width) / REF_WIDTH) * 100))
                onCustomTextWidthChange?.(ct.id, Math.round(newWidthPct))
                const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
                const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
                onCustomTextPositionChange?.(ct.id, { x: percentX, y: percentY })
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                onCustomTextSelect?.(ct.id)
              }}
              style={{ zIndex: 15 }}
              className={`hover:outline hover:outline-2 hover:outline-white/50 ${
                isSelected ? 'outline outline-2 outline-blue-400' : ''
              }`}
            >
              <div
                ref={(el) => {
                  customTextRefs.current[ct.id] = el
                  // Auto-focus when entering edit mode
                  if (isEditing && el) {
                    requestAnimationFrame(() => el.focus())
                  }
                }}
                style={{
                  width: '100%',
                  cursor: isEditing ? 'text' : 'grab',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  textAlign: ct.text_align ?? 'left',
                  fontSize: `${ct.font_size ?? 48}px`,
                  fontFamily: ct.font_family ?? template.fontFamily,
                  fontWeight: ct.font_weight ?? 400,
                  fontStyle: ct.font_style ?? 'normal',
                  color: ct.color ?? textColor,
                  lineHeight: 1.3,
                  outline: 'none',
                }}
                onDoubleClick={() => setEditingCustomTextId(ct.id)}
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                onBlur={(e) => {
                  const newText = (e.currentTarget as HTMLDivElement).innerText
                  onCustomTextUpdate?.(ct.id, { text: newText })
                  setEditingCustomTextId(null)
                }}
              >
                {ct.text}
              </div>
            </Rnd>
          )
        })}

        {/* Alignment guide overlays */}
        {activeGuides.map((guide, i) => (
          <div
            key={i}
            data-testid="alignment-guide"
            style={{
              position: 'absolute',
              [guide.orientation === 'vertical' ? 'left' : 'top']: guide.position,
              [guide.orientation === 'vertical' ? 'top' : 'left']: 0,
              [guide.orientation === 'vertical' ? 'width' : 'height']: 0,
              [guide.orientation === 'vertical' ? 'height' : 'width']: guide.orientation === 'vertical' ? REF_HEIGHT : REF_WIDTH,
              borderLeft: guide.orientation === 'vertical' ? '2px dashed rgba(255, 100, 100, 0.8)' : 'none',
              borderTop: guide.orientation === 'horizontal' ? '2px dashed rgba(255, 100, 100, 0.8)' : 'none',
              zIndex: 50,
              pointerEvents: 'none' as const,
            }}
          />
        ))}

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
