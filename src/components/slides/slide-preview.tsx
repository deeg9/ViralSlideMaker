'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Rnd } from 'react-rnd'
import type { Slide, TextPosition, CustomText, TextSegment } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'
import { useAlignmentGuides, type TextBox } from '@/hooks/use-alignment-guides'
import { resolveSlideStyles, buildHighlightWrapperStyle, type ResolvedTextEffectStyles } from '@/lib/render/resolve-styles'
import { resolveWatermark } from '@/lib/render/resolve-watermark'
import { resolveForcedWatermark } from '@/lib/render/resolve-forced-watermark'

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

// News-carousel layouts — mirrors NEWS_LAYOUT in render-slide.ts / render-slide-satori.tsx
const NEWS_LAYOUT = {
  cover: { imageTop: 0,  imageHeight: 55, hookY: 60, bodyY: 80 },
  body:  { imageTop: 50, imageHeight: 50, hookY: 8,  bodyY: 30 },
} as const

// Render text-or-segments. When segments present, each run is wrapped in a span with its own color.
function renderSegments(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  if (!segments || segments.length === 0) return text
  return segments.map((seg, i) => {
    const color = seg.accent ? accentColor : baseColor
    const sep = i < segments.length - 1 ? ' ' : ''
    return (
      <span key={i} style={{ color }}>
        {seg.text}
        {sep}
      </span>
    )
  })
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
  brandKit?: BrandKit | null
  userTier?: 'free' | 'plus' | 'pro'
  onPositionChange?: (field: 'hook' | 'body', position: TextPosition) => void
  onWidthChange?: (field: 'hook' | 'body', width: number) => void
  onCustomTextPositionChange?: (id: string, position: TextPosition) => void
  onCustomTextWidthChange?: (id: string, width: number) => void
  onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void
  onCustomTextSelect?: (id: string | null) => void
  onCustomTextRemove?: (id: string) => void
  selectedCustomTextId?: string | null
  onCustomImagePositionChange?: (id: string, position: { x: number; y: number }) => void
  onCustomImageSizeChange?: (id: string, size: { width: number; height: number }) => void
  onCustomImageSelect?: (id: string | null) => void
  onCustomImageRemove?: (id: string) => void
  selectedCustomImageId?: string | null
}

export function SlidePreview({
  slide, template, index, editable, brandKit, userTier,
  onPositionChange, onWidthChange,
  onCustomTextPositionChange, onCustomTextWidthChange,
  onCustomTextUpdate, onCustomTextSelect, onCustomTextRemove,
  selectedCustomTextId,
  onCustomImagePositionChange, onCustomImageSizeChange,
  onCustomImageSelect, onCustomImageRemove,
  selectedCustomImageId,
}: SlidePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hookRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const customTextRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { calculateSnap, activeGuides, clearGuides } = useAlignmentGuides()
  const overrides = slide.style_overrides ?? {}

  const [editingCustomTextId, setEditingCustomTextId] = useState<string | null>(null)
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null)
  const [overTrash, setOverTrash] = useState(false)

  const textColor = overrides.text_color ?? template.textColor
  const hookTextColor = overrides.hook_text_color ?? textColor
  const bodyTextColor = overrides.body_text_color ?? textColor
  const textAlign = overrides.text_align ?? template.textAlign
  const hookFontSize = overrides.hook_font_size ?? parseInt(template.hookFontSize)
  const bodyFontSize = overrides.body_font_size ?? parseInt(template.bodyFontSize)

  // Font family overrides (Phase 12)
  const hookFontFamily = overrides.hook_font_family ?? template.headingFontFamily ?? template.fontFamily
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

  const accentColor = template.accentColor ?? template.textColor

  // News-carousel layouts override Y defaults; user-set positions still win.
  const newsZone = overrides.layout ? NEWS_LAYOUT[overrides.layout] : null

  const positionPreset = overrides.text_position ?? template.textPosition
  const defaults = newsZone ?? SAFE_ZONE[positionPreset] ?? SAFE_ZONE.center
  const defaultX = SAFE_ZONE.x

  const resolvedHookX = hookPos?.x ?? defaultX
  const resolvedHookY = hookPos?.y ?? defaults.hookY
  const resolvedBodyX = bodyPos?.x ?? defaultX
  const resolvedBodyY = bodyPos?.y ?? defaults.bodyY

  // Width: use override or symmetric calc, min 20%
  const hookWidth = Math.max(20, overrides.hook_width ?? (100 - resolvedHookX * 2))
  const bodyWidth = Math.max(20, overrides.body_width ?? (100 - resolvedBodyX * 2))

  // Phase 20: Resolve text effects via resolveSlideStyles
  const resolved = resolveSlideStyles(slide, template)

  // Helper: extract CSS properties from resolved effects (excluding highlight which is handled via wrappers)
  function effectToCSS(effects: ResolvedTextEffectStyles): React.CSSProperties {
    return {
      ...(effects.textShadow && { textShadow: effects.textShadow }),
      ...(effects.WebkitTextStrokeWidth && {
        WebkitTextStrokeWidth: effects.WebkitTextStrokeWidth,
        WebkitTextStrokeColor: effects.WebkitTextStrokeColor,
        paintOrder: effects.paintOrder,
      }),
    }
  }

  const hookEffectCSS = effectToCSS(resolved.hookEffects)
  const bodyEffectCSS = effectToCSS(resolved.bodyEffects)

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

  // Delete key handler for selected custom text or custom image
  useEffect(() => {
    if (!editable) return
    if (!selectedCustomTextId && !selectedCustomImageId) return
    if (editingCustomTextId) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (selectedCustomImageId) {
          onCustomImageRemove?.(selectedCustomImageId)
        } else if (selectedCustomTextId) {
          onCustomTextRemove?.(selectedCustomTextId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editable, selectedCustomTextId, selectedCustomImageId, editingCustomTextId, onCustomTextRemove, onCustomImageRemove])

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

  // Background style (shared). News layouts skip the full-bleed bg image and render
  // it as a constrained <img> below — see newsBgImageNode.
  const innerStyle: React.CSSProperties = {
    width: REF_WIDTH,
    height: REF_HEIGHT,
    fontFamily: template.fontFamily,
    color: textColor,
    backgroundColor: template.backgroundColor,
    backgroundImage: !newsZone && slide.background_url ? `url(${slide.background_url})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }

  const newsBgImageNode = newsZone && slide.background_url ? (
    <img
      src={slide.background_url}
      draggable={false}
      style={{
        position: 'absolute',
        left: 0,
        top: `${newsZone.imageTop}%`,
        width: '100%',
        height: `${newsZone.imageHeight}%`,
        objectFit: 'cover',
        zIndex: 0,
      }}
    />
  ) : null

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
    for (const ci of slide.custom_images ?? []) {
      if (ci.id === excludeId) continue
      others.push({
        id: ci.id,
        x: (ci.x / 100) * REF_WIDTH,
        y: (ci.y / 100) * REF_HEIGHT,
        width: (ci.width / 100) * REF_WIDTH,
        height: (ci.height / 100) * REF_HEIGHT,
      })
    }
    return others
  }, [resolvedHookX, resolvedHookY, hookWidth, resolvedBodyX, resolvedBodyY, bodyWidth, slide.body_text, slide.custom_texts, slide.custom_images, scale])

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
          {newsBgImageNode}
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
            ...(resolved.hookEffects.highlight?.enabled && resolved.hookEffects.highlight.style === 'full'
              ? { backgroundColor: resolved.hookEffects.highlight.color, padding: `${resolved.hookEffects.highlight.padding}px` }
              : {}),
          }}>
            <p className="" style={{ ...hookTextStyle, lineHeight: 1.1, ...hookEffectCSS }}>
              {resolved.hookEffects.highlight?.enabled && resolved.hookEffects.highlight.style === 'tight'
                ? <span style={buildHighlightWrapperStyle(resolved.hookEffects.highlight, 'tight') ?? undefined}>{renderSegments(slide.hook_text, slide.hook_segments, hookTextColor, accentColor)}</span>
                : renderSegments(slide.hook_text, slide.hook_segments, hookTextColor, accentColor)}
            </p>
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
              ...(resolved.bodyEffects.highlight?.enabled && resolved.bodyEffects.highlight.style === 'full'
                ? { backgroundColor: resolved.bodyEffects.highlight.color, padding: `${resolved.bodyEffects.highlight.padding}px` }
                : {}),
            }}>
              <p className="opacity-90" style={{ ...bodyTextStyle, lineHeight: 1.5, ...bodyEffectCSS }}>
                {resolved.bodyEffects.highlight?.enabled && resolved.bodyEffects.highlight.style === 'tight'
                  ? <span style={buildHighlightWrapperStyle(resolved.bodyEffects.highlight, 'tight') ?? undefined}>{renderSegments(slide.body_text, slide.body_segments, bodyTextColor, accentColor)}</span>
                  : renderSegments(slide.body_text, slide.body_segments, bodyTextColor, accentColor)}
              </p>
            </div>
          )}

          {/* Custom images (non-editable) */}
          {(slide.custom_images ?? []).map((ci) => (
            <img
              key={ci.id}
              src={ci.url}
              draggable={false}
              style={{
                position: 'absolute',
                left: `${ci.x}%`,
                top: `${ci.y}%`,
                width: `${ci.width}%`,
                height: `${ci.height}%`,
                objectFit: 'cover',
                opacity: (ci.opacity ?? 100) / 100,
                borderRadius: ci.border_radius ?? 0,
                zIndex: 12,
              }}
            />
          ))}

          {/* Brand watermark (non-editable) — coords resolved at REF canvas size; CSS scale handles container size */}
          {(() => {
            const wm = resolveWatermark(brandKit ?? null, slide, { width: REF_WIDTH, height: REF_HEIGHT })
            if (!wm) return null
            return (
              <img
                src={wm.url}
                draggable={false}
                alt=""
                style={{
                  position: 'absolute',
                  left: wm.x,
                  top: wm.y,
                  width: wm.width,
                  height: 'auto',
                  opacity: wm.opacity,
                  zIndex: 18,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            )
          })()}

          {/* Forced free-tier watermark (260427-wmk) — non-editable preview */}
          {(() => {
            const fw = resolveForcedWatermark(userTier, { width: REF_WIDTH, height: REF_HEIGHT })
            if (!fw) return null
            return (
              <div
                style={{
                  position: 'absolute',
                  left: fw.x,
                  top: fw.y,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: fw.opacity,
                  zIndex: 19,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                <img
                  src={fw.logoUrl}
                  draggable={false}
                  alt=""
                  style={{
                    width: fw.logoSize,
                    height: fw.logoSize,
                    objectFit: 'contain',
                    marginRight: fw.gap,
                  }}
                />
                <span
                  style={{
                    fontSize: fw.fontSize,
                    fontWeight: 700,
                    color: fw.textColor,
                    textShadow: fw.textShadow,
                    letterSpacing: -0.2,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fw.text}
                </span>
              </div>
            )
          })()}

          {/* Custom texts (non-editable) */}
          {(slide.custom_texts ?? []).map((ct) => {
            const resolvedCt = resolved.customTexts.find(rc => rc.id === ct.id)
            const ctEffectCSS = resolvedCt ? effectToCSS(resolvedCt.resolvedEffects) : {}
            const ctHighlight = resolvedCt?.resolvedEffects.highlight
            const ctBaseColor = ct.color ?? textColor
            return (
              <div
                key={ct.id}
                style={{
                  position: 'absolute',
                  left: `${ct.x}%`,
                  top: `${ct.y}%`,
                  width: `${ct.width}%`,
                  zIndex: 15,
                  textAlign: ct.text_align ?? 'left',
                  fontSize: `${ct.font_size ?? 48}px`,
                  fontFamily: ct.font_family ?? template.fontFamily,
                  fontWeight: ct.font_weight ?? 400,
                  fontStyle: ct.font_style ?? 'normal',
                  color: ctBaseColor,
                  lineHeight: 1.3,
                  ...ctEffectCSS,
                  ...(ctHighlight?.enabled && ctHighlight.style === 'full'
                    ? { backgroundColor: ctHighlight.color, padding: `${ctHighlight.padding}px` }
                    : {}),
                }}
              >
                {ctHighlight?.enabled && ctHighlight.style === 'tight'
                  ? <span style={buildHighlightWrapperStyle(ctHighlight, 'tight') ?? undefined}>{renderSegments(ct.text, ct.segments, ctBaseColor, accentColor)}</span>
                  : renderSegments(ct.text, ct.segments, ctBaseColor, accentColor)}
              </div>
            )
          })}

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
          // Click on canvas background clears selections
          if (e.target === e.currentTarget) {
            onCustomTextSelect?.(null)
            onCustomImageSelect?.(null)
          }
        }}
      >
        {newsBgImageNode}
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
          onMouseDown={() => { onCustomTextSelect?.(null); onCustomImageSelect?.(null) }}
          style={{ zIndex: 10 }}
          className="hover:outline hover:outline-2 hover:outline-white/50"
        >
          <div ref={hookRef} style={{
            width: '100%',
            cursor: 'grab',
            padding: '4px 8px',
            borderRadius: '4px',
            textAlign,
            ...(resolved.hookEffects.highlight?.enabled && resolved.hookEffects.highlight.style === 'full'
              ? { backgroundColor: resolved.hookEffects.highlight.color, padding: `${resolved.hookEffects.highlight.padding}px` }
              : {}),
          }}>
            <p className="" style={{ ...hookTextStyle, lineHeight: 1.1, ...hookEffectCSS }}>
              {resolved.hookEffects.highlight?.enabled && resolved.hookEffects.highlight.style === 'tight'
                ? <span style={buildHighlightWrapperStyle(resolved.hookEffects.highlight, 'tight') ?? undefined}>{renderSegments(slide.hook_text, slide.hook_segments, hookTextColor, accentColor)}</span>
                : renderSegments(slide.hook_text, slide.hook_segments, hookTextColor, accentColor)}
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
            onMouseDown={() => { onCustomTextSelect?.(null); onCustomImageSelect?.(null) }}
            style={{ zIndex: 10 }}
            className="hover:outline hover:outline-2 hover:outline-white/50"
          >
            <div ref={bodyRef} style={{
              width: '100%',
              cursor: 'grab',
              padding: '4px 8px',
              borderRadius: '4px',
              textAlign,
              ...(resolved.bodyEffects.highlight?.enabled && resolved.bodyEffects.highlight.style === 'full'
                ? { backgroundColor: resolved.bodyEffects.highlight.color, padding: `${resolved.bodyEffects.highlight.padding}px` }
                : {}),
            }}>
              <p className="opacity-90" style={{ ...bodyTextStyle, lineHeight: 1.5, ...bodyEffectCSS }}>
                {resolved.bodyEffects.highlight?.enabled && resolved.bodyEffects.highlight.style === 'tight'
                  ? <span style={buildHighlightWrapperStyle(resolved.bodyEffects.highlight, 'tight') ?? undefined}>{renderSegments(slide.body_text, slide.body_segments, bodyTextColor, accentColor)}</span>
                  : renderSegments(slide.body_text, slide.body_segments, bodyTextColor, accentColor)}
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
          const resolvedCt = resolved.customTexts.find(rc => rc.id === ct.id)
          const ctEffectCSS = resolvedCt ? effectToCSS(resolvedCt.resolvedEffects) : {}
          const ctHighlight = resolvedCt?.resolvedEffects.highlight
          const ctBaseColor = ct.color ?? textColor

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
              onDragStart={() => setDraggingElementId(ct.id)}
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
                setOverTrash((data.y / REF_HEIGHT) * 100 > 85)
              }}
              onDragStop={(_e, data) => {
                clearGuides()
                const yPercent = (data.y / REF_HEIGHT) * 100
                setDraggingElementId(null)
                setOverTrash(false)
                if (yPercent > 85) {
                  onCustomTextRemove?.(ct.id)
                  return
                }
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
                onCustomImageSelect?.(null)
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
                  color: ctBaseColor,
                  lineHeight: 1.3,
                  outline: 'none',
                  ...ctEffectCSS,
                  ...(ctHighlight?.enabled && ctHighlight.style === 'full'
                    ? { backgroundColor: ctHighlight.color, padding: `${ctHighlight.padding}px` }
                    : {}),
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
                {isEditing ? ct.text : (
                  ctHighlight?.enabled && ctHighlight.style === 'tight'
                    ? <span style={buildHighlightWrapperStyle(ctHighlight, 'tight') ?? undefined}>{renderSegments(ct.text, ct.segments, ctBaseColor, accentColor)}</span>
                    : renderSegments(ct.text, ct.segments, ctBaseColor, accentColor)
                )}
              </div>
            </Rnd>
          )
        })}

        {/* Custom image boxes */}
        {(slide.custom_images ?? []).map((ci) => {
          const ciPixels = {
            x: (ci.x / 100) * REF_WIDTH,
            y: (ci.y / 100) * REF_HEIGHT,
          }
          const ciWidthPx = (ci.width / 100) * REF_WIDTH
          const ciHeightPx = (ci.height / 100) * REF_HEIGHT
          const isImageSelected = selectedCustomImageId === ci.id

          const imageResizeHandleStyle: React.CSSProperties = {
            width: 8,
            height: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(0, 0, 0, 0.3)',
            borderRadius: 1,
            position: 'absolute',
          }

          return (
            <Rnd
              key={ci.id}
              position={ciPixels}
              size={{ width: ciWidthPx, height: ciHeightPx }}
              scale={scale}
              bounds="parent"
              lockAspectRatio={true}
              enableResizing={{
                top: true,
                bottom: true,
                left: true,
                right: true,
                topLeft: true,
                topRight: true,
                bottomLeft: true,
                bottomRight: true,
              }}
              resizeHandleStyles={{
                topLeft: { ...imageResizeHandleStyle, top: -4, left: -4 },
                topRight: { ...imageResizeHandleStyle, top: -4, right: -4 },
                bottomLeft: { ...imageResizeHandleStyle, bottom: -4, left: -4 },
                bottomRight: { ...imageResizeHandleStyle, bottom: -4, right: -4 },
                top: { ...imageResizeHandleStyle, top: -4, left: '50%', transform: 'translateX(-50%)' },
                bottom: { ...imageResizeHandleStyle, bottom: -4, left: '50%', transform: 'translateX(-50%)' },
                left: { ...imageResizeHandleStyle, left: -4, top: '50%', transform: 'translateY(-50%)' },
                right: { ...imageResizeHandleStyle, right: -4, top: '50%', transform: 'translateY(-50%)' },
              }}
              onDragStart={() => setDraggingElementId(ci.id)}
              onDrag={(_e, data) => {
                const dragging: TextBox = {
                  id: ci.id,
                  x: data.x,
                  y: data.y,
                  width: ciWidthPx,
                  height: ciHeightPx,
                }
                const others = buildOthersForSnap(ci.id)
                const result = calculateSnap(dragging, others)
                data.x = result.snappedX
                data.y = result.snappedY
                // Check if over trash zone (bottom 12% of canvas)
                const yPercent = (data.y / REF_HEIGHT) * 100
                setOverTrash(yPercent > 85)
              }}
              onDragStop={(_e, data) => {
                clearGuides()
                const yPercent = (data.y / REF_HEIGHT) * 100
                setDraggingElementId(null)
                setOverTrash(false)
                if (yPercent > 85) {
                  // Dropped on trash zone — delete
                  onCustomImageRemove?.(ci.id)
                  return
                }
                const percentX = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
                const percentY = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
                onCustomImagePositionChange?.(ci.id, { x: percentX, y: percentY })
              }}
              onResizeStop={(_e, _dir, ref, _delta, position) => {
                const newWidthPct = Math.max(5, Math.min(100, (parseInt(ref.style.width) / REF_WIDTH) * 100))
                const newHeightPct = Math.max(5, Math.min(100, (parseInt(ref.style.height) / REF_HEIGHT) * 100))
                onCustomImageSizeChange?.(ci.id, { width: Math.round(newWidthPct), height: Math.round(newHeightPct) })
                const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
                const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
                onCustomImagePositionChange?.(ci.id, { x: percentX, y: percentY })
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                onCustomImageSelect?.(ci.id)
                onCustomTextSelect?.(null)
              }}
              style={{ zIndex: 12 }}
              className={`hover:outline hover:outline-2 hover:outline-white/50 ${
                isImageSelected ? 'outline outline-2 outline-blue-400' : ''
              }`}
            >
              <img
                src={ci.url}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: (ci.opacity ?? 100) / 100,
                  borderRadius: ci.border_radius ?? 0,
                  cursor: 'grab',
                }}
              />
            </Rnd>
          )
        })}

        {/* Brand watermark (editable view) — non-interactive, sits above custom images */}
        {(() => {
          const wm = resolveWatermark(brandKit ?? null, slide, { width: REF_WIDTH, height: REF_HEIGHT })
          if (!wm) return null
          return (
            <img
              src={wm.url}
              draggable={false}
              alt=""
              style={{
                position: 'absolute',
                left: wm.x,
                top: wm.y,
                width: wm.width,
                height: 'auto',
                opacity: wm.opacity,
                zIndex: 18,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          )
        })()}

        {/* Forced free-tier watermark (260427-wmk) — editable view */}
        {(() => {
          const fw = resolveForcedWatermark(userTier, { width: REF_WIDTH, height: REF_HEIGHT })
          if (!fw) return null
          return (
            <div
              style={{
                position: 'absolute',
                left: fw.x,
                top: fw.y,
                display: 'flex',
                alignItems: 'center',
                opacity: fw.opacity,
                zIndex: 19,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              <img
                src={fw.logoUrl}
                draggable={false}
                alt=""
                style={{
                  width: fw.logoSize,
                  height: fw.logoSize,
                  objectFit: 'contain',
                  marginRight: fw.gap,
                }}
              />
              <span
                style={{
                  fontSize: fw.fontSize,
                  fontWeight: 700,
                  color: fw.textColor,
                  textShadow: fw.textShadow,
                  letterSpacing: -0.2,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {fw.text}
              </span>
            </div>
          )
        })()}

        {/* Trash zone — appears when dragging custom elements */}
        {draggingElementId && (
          <div
            data-testid="trash-zone"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '15%',
              background: overTrash
                ? 'linear-gradient(to top, rgba(220, 38, 38, 0.5), rgba(220, 38, 38, 0.1))'
                : 'linear-gradient(to top, rgba(220, 38, 38, 0.2), transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 40,
              pointerEvents: 'none',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              opacity: overTrash ? 1 : 0.6,
              transform: overTrash ? 'scale(1.15)' : 'scale(1)',
              transition: 'all 0.15s ease',
            }}>
              <span style={{
                fontSize: overTrash ? 48 : 36,
                transition: 'font-size 0.15s ease',
              }}>
                🗑️
              </span>
              <span style={{
                fontSize: 20,
                fontWeight: 700,
                color: overTrash ? 'rgba(220, 38, 38, 0.9)' : 'rgba(220, 38, 38, 0.5)',
                fontFamily: 'system-ui, sans-serif',
                transition: 'color 0.15s ease',
              }}>
                {overTrash ? 'Release to delete' : 'Drag here to delete'}
              </span>
            </div>
          </div>
        )}

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
