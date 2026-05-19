'use client'

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { Rnd } from 'react-rnd'
import type { Slide, TextPosition, CustomText, TextSegment, SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'
// Phase 63 Plan 04 (SNAP-02..06, SNAP-09, DIFF-03, PERF-03): snap-index +
// smart-guide overlay + equal-spacing == indicator. Replaces the legacy
// alignment-guides hook (file retained at src/hooks/use-alignment-guides.ts
// per CONTEXT D-09 — Phase 66 cleanup target).
import {
  buildSnapIndex,
  snapWithHysteresis,
  type SnapIndex,
  type HysteresisResult,
} from '@/lib/editor/transforms/snap-index'
import { detectEqualSpacing } from '@/lib/editor/transforms/equal-spacing'
import {
  SmartGuideOverlay,
  type SmartGuideOverlayHandle,
  type GuideLine,
} from '@/components/editor/smart-guide-overlay'
import { resolveSlideStyles, type ResolvedTextEffectStyles } from '@/lib/render/resolve-styles'
import { resolveWatermark } from '@/lib/render/resolve-watermark'
import { resolveForcedWatermark } from '@/lib/render/resolve-forced-watermark'
import { getHookFontSize, hasHookFit, clampManualHookSize, captionCardHeadlineBox } from '@/lib/render/hook-fit'
// Phase 69 Plan 02 (TPLREND-05): single source of truth for layer 5.5
// decoration → DOM markup. BOTH renderers (render-slide-satori.tsx + this
// React preview path) import renderDecoration from this exact module path.
import { renderDecoration } from '@/lib/render/decoration-renderer'
// Phase 72 Plan 02 (ROTATE-02): editable={true}-only rotation handle. Mounted
// downstream of the editable={false} early return (line ~964) so PCL11 chrome-
// gate / TPLREND-05 / PARITY-01 invariants hold. Never reaches Satori path
// (T-72-05 mitigation).
import { DecorationRotationHandle } from '@/components/slides/decoration-rotation-handle'
// Phase 60 (SEL-13, PARITY-01): union-AABB for the multi-select ring.
// Pure module — no React/DOM coupling. Editor-only chrome consumer; gated
// strictly to the editable={true} branch below.
import { computeSelectionBounds } from '@/lib/editor/transforms/selection-bounds'
// Phase 63 Plan 02 (ALIGN-07, PARITY-01): floating alignment toolbar. Editor-
// only chrome — mounted ONLY inside the editable={true} branch (downstream of
// the line-665 early return) so PARITY-01 / TPLREND-05 invariants hold.
import {
  FloatingAlignmentToolbar,
  type ToolbarAction,
} from '@/components/editor/floating-alignment-toolbar'
import type { AlignAxis, DistributeAxis } from '@/lib/editor/transforms/align'
// Phase 62 (GROUP-06, GROUP-09, GROUP-10): cross-type group membership read
// for the dashed group-bounding-ring + group-aware click handlers + group-
// drag detection. Pure module (no React/DOM); same TPLREND-05 structural
// gate as computeSelectionBounds.
import { getGroupMembers, shouldGroupDrag } from '@/lib/editor/transforms/group-membership'
import { decideAltDuplicate } from '@/components/slides/drag-stop-decider'
// Phase 61 Plan 02 (SEL-05, SEL-06, SEL-14): marquee selection state machine.
// Pure helpers from Plan 61-01 — rect canonicalization + Figma-intersect AABB
// + render-only overlay component. All editor-only chrome; structurally gated
// to the editable={true} branch (TPLREND-05 / PARITY-01).
import { normalizeRect } from '@/lib/editor/transforms/normalize-rect'
import { elementsInRect } from '@/lib/editor/transforms/element-rect-intersect'
import { applyAxisConstrain } from '@/lib/editor/transforms/axis-constrain'
import { MarqueeOverlay } from '@/components/editor/marquee-overlay'
import { useModifierState } from '@/lib/editor/use-modifier-state'
import type { Selection } from '@/lib/editor/use-selection-model'
// Phase 45 — shared resolver that guarantees the React preview renders overlay
// content + slot anchors + per-segment highlight pills with the SAME source as
// the Satori PNG export (TPLREND-05 parity contract). The 5-export surface is
// defined in src/lib/render/resolve-overlay.ts.
import {
  resolveOverlayContent,
  SLOT_GEOMETRY,
  renderSegments as renderSegmentsShared,
  renderTextBlock,
  renderTightHighlight,
  resolveCaptionBar,
  captionCardBackgroundStyle,
  resolveNewsHeadlineFit,
  renderGrain,
  renderVignette,
  renderDecorativeOverlay,
  augmentEditorialSerifPageCounterStyle,
  getNotesAppChicAccentColor,
  alignToJustifyContent,
  resolveHookTypography,
  type OverlayResolveCtx,
} from '@/lib/render/resolve-overlay'
import type { TemplateOverlay } from '@/lib/render/templates/index'

// Reference canvas dimensions (matches TikTok/Instagram 9:16)
const REF_WIDTH = 1080
const REF_HEIGHT = 1920

// GAP-F (82-10): the editable headline <Rnd>'s inner `hook-text-wrapper` div
// applies `padding: '4px 8px'`. The 8px horizontal padding each side narrows
// the headline's flex-wrap container relative to the read-only branch's plain
// `width: hookWidth%` div and the Satori export's `pxX(hookWidth)` box — same
// font + same words, a ~16px-narrower container flips a wrap point ("APPROVES
// MASSIVE" lands on one line in the thumbnail, two on the canvas). Widening the
// editable <Rnd> by 2× this value and offsetting its x by 1× this value makes
// the inner wrapper's content box exactly `hookWidthPx`, restoring 3-way
// (canvas / thumbnail / Satori) headline-wrap parity. The padding compensation
// is invisible to persisted hook_position/hook_width — see the commit-math
// corrections in the editable hook <Rnd> below.
const HOOK_WRAPPER_PAD_X = 8

// TikTok/Instagram safe zone defaults (percentage of canvas)
const SAFE_ZONE = {
  x: 11,
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
}

// News-carousel layouts — mirrors NEWS_LAYOUT in render-slide.ts / render-slide-satori.tsx
// 260503: cover.bodyY bumped 80 → 84 to give long-hook wraps a vertical safety
// margin before they could collide with the body zone.
const NEWS_LAYOUT = {
  cover: { imageTop: 0,  imageHeight: 55, hookY: 60, bodyY: 84 },
  body:  { imageTop: 50, imageHeight: 50, hookY: 8,  bodyY: 30 },
} as const

// Phase 45: delegated to shared `renderSegments` from resolve-overlay so the
// per-segment pill markup (mint-pill aesthetic from the Murphy reference) is
// byte-identical to the Satori PNG export.
//
// PARITY CONTRACT (TPLREND-05): the shared implementation explicitly does
// NOT set `box-decoration-break: clone` even though browsers support it.
// Satori does not, so the React preview must match Satori's line-boundary
// breaking — otherwise multi-line pills look different in preview vs export.
// Do NOT add box-decoration-break here. See `src/lib/render/resolve-overlay.ts`.
function renderSegments(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  return renderSegmentsShared(text, segments, baseColor, accentColor)
}

// Phase 45 — internal layer renderers shared by both branches of <SlidePreview>.
// Extracted per RESEARCH.md Pitfall 2 / Open Question 2 because the JSX must
// appear in BOTH the non-editable AND editable render branches; one definition
// here means the two branches cannot drift on layer order or testid hooks.

interface BackgroundLayersProps {
  template: SlideTemplate
  slide: Slide
  overlayOpacity: number
  overlayColor: string
}

function BackgroundLayers({
  template,
  slide,
  overlayOpacity,
  overlayColor,
}: BackgroundLayersProps) {
  // No useBgMode guard needed — caller already gates on useBgMode via ternary
  return (
    <>
      {slide.background_url && (
        <img
          data-testid="bg-bleed"
          src={slide.background_url}
          draggable={false}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
        />
      )}
      {/* Phase 55 (D-13, layer 1.5): grain/noise overlay — only when template opts in.
          Imported from @/lib/render/resolve-overlay (TPLREND-05 — same module as the
          Satori renderer at src/lib/render/render-slide-satori.tsx). */}
      {template.grainMode ? renderGrain(template.grainMode) : null}
      {/* Tint overlay — paints above the photo for tonal control of B&W treatments */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: overlayColor,
          opacity: overlayOpacity,
          zIndex: 1,
        }}
      />
      {/* Phase 55 (D-13, layer 2.5): radial vignette — only when template opts in.
          Imported from @/lib/render/resolve-overlay (TPLREND-05 — same module as the
          Satori renderer). Sits ABOVE tint, BELOW hook/body text + overlays. */}
      {template.vignette ? renderVignette(template.vignette.strength) : null}
    </>
  )
}

/**
 * quick-260517-k2n: the reworked caption card — an independent draggable/
 * resizable colored rectangle overlay rendered ABOVE the photo+tint (zIndex 2)
 * and BELOW the hook/body text (zIndex 10). It is NO LONGER backgroundMode-
 * gated (key_decision 2) — the card renders on ANY template iff
 * resolveCaptionBar(...).enabled is true, so this layer is mounted as a sibling
 * OUTSIDE the useBgMode ternary (the legacy non-bgMode branch had no
 * BackgroundLayers). With zero caption_bar_* overrides this resolves
 * enabled:false and renders nothing — byte-identical to pre-change (TPLREND-05).
 *
 * This is the NON-EDITABLE (plain div) form, shared by both branches' non-
 * interactive callers. The editable branch renders the card as an <Rnd>
 * instead (see the editable render path) and so passes `editable` to skip
 * this plain div.
 */
function CaptionCardLayer({
  template,
  slide,
  isNewsLayoutSlide,
}: {
  template: SlideTemplate
  slide: Slide
  // quick-260518-8o0: threaded from the parent (which owns the gate at
  // `template.backgroundMode == null && overrides.layout != null`) so an
  // unedited news slide resolves the seeded black caption card.
  isNewsLayoutSlide: boolean
}) {
  const cc = resolveCaptionBar(slide.style_overrides, template, isNewsLayoutSlide)
  if (!cc.enabled) return null
  return (
    <div
      data-testid="caption-card"
      style={{
        position: 'absolute',
        left: `${cc.x}%`,
        top: `${cc.y}%`,
        width: `${cc.width}%`,
        height: `${cc.heightPct}%`,
        // quick-260518-ch8: shared helper — solid color when blend off,
        // a position-aware linear-gradient when blend on (TPLREND-05 parity).
        ...captionCardBackgroundStyle({
          backgroundColor: cc.backgroundColor,
          blendPct: cc.blendPct,
          position: cc.position,
        }),
        zIndex: 2,
      }}
    />
  )
}

interface OverlayLayersProps {
  template: SlideTemplate
  ctx: OverlayResolveCtx
}

function OverlayLayers({ template, ctx }: OverlayLayersProps) {
  if (!template.overlays || template.overlays.length === 0) return null
  return (
    <>
      {template.overlays.map((overlay: TemplateOverlay, i: number) => {
        // quick-260514-kv9: page-counter overlay suppressed everywhere. The
        // user surfaced "Slide N / total" via the new above-canvas chip
        // (quick-260514-ku2), and the per-slide top-right counter is now
        // redundant. We short-circuit at the consumer rather than editing
        // each of the 7 template files so the change is reversible — and
        // mirrored at the Satori render path for TPLREND-05 parity.
        if (overlay.content.type === 'page-counter') return null
        // Phase 56 (TPL-04, D-14): decorative overlay branch. Renders SVG/PNG
        // asset via the shared renderDecorativeOverlay helper — both renderers
        // consume the same module (TPLREND-05 parity invariant).
        if (overlay.content.type === 'decorative') {
          const pos = { x: overlay.offset?.x ?? 0, y: overlay.offset?.y ?? 0 }
          // Phase 57 (D-15): notes-app-chic palette tint for sticky-note-accent
          const tintColor =
            overlay.content.asset === 'sticky-note-accent'
              ? getNotesAppChicAccentColor(ctx.slide, template)
              : undefined
          return (
            <React.Fragment key={`overlay-${i}-${overlay.position}-decorative`}>
              {renderDecorativeOverlay(overlay.content.asset, pos, {
                rotation: overlay.content.rotation,
                scale: overlay.content.scale,
                opacity: overlay.content.opacity,
                tintColor,
              })}
            </React.Fragment>
          )
        }
        const slot = SLOT_GEOMETRY[overlay.position]
        const offset = overlay.offset
        // Permissive index across the SLOT_GEOMETRY union (top-left has `left`,
        // top-right has `right`, etc.) — runtime guard on `typeof === 'number'`
        // narrows safely. Mirrors the Satori implementation in render-slide-satori.tsx.
        const slotAny = slot as Record<string, unknown> | null
        const slotStyle: React.CSSProperties =
          slot == null
            ? {
                position: 'absolute',
                left: offset?.x ?? 0,
                top: offset?.y ?? 0,
              }
            : {
                position: 'absolute',
                ...(slot as React.CSSProperties),
                ...(offset && slotAny && typeof slotAny.left === 'number' && offset.x
                  ? { left: (slotAny.left as number) + offset.x }
                  : {}),
                ...(offset && slotAny && typeof slotAny.top === 'number' && offset.y
                  ? { top: (slotAny.top as number) + offset.y }
                  : {}),
              }
        const text = resolveOverlayContent(overlay.content, ctx)
        // quick-260514-kv9: page-counter overlay short-circuited above, so the
        // editorial-serif palette-augmentation branch is unreachable. Kept the
        // helper import-clean for now; safe to fully drop if no other consumer
        // surfaces.
        const augmentedStyle = { ...(overlay.style ?? {}) }
        return (
          <div
            key={`overlay-${i}-${overlay.position}`}
            data-testid={`overlay-${overlay.position}`}
            style={{
              ...slotStyle,
              display: 'flex',
              alignItems: 'center',
              zIndex: 11,
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1,
              ...(augmentedStyle as React.CSSProperties),
            }}
          >
            {text}
          </div>
        )
      })}
    </>
  )
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

// phase-59-01: 24×24 hit zone (WCAG 2.5.8 AA) painting the central 12×12
// only. padding+backgroundClip:'content-box' keeps the outer 6px transparent
// but hit-testable (12 + 6 + 6 = 24 CSS-px). Cursor goes inline per-corner
// so it trumps the inner cursor:'grab' (UI-SPEC "Cursor Affordance Contract").
// Mirrors the custom-image precedent at slide-preview.tsx:1168 with size
// 8→12 and an outer hit-zone wrapper for touch a11y.
const cornerHandleHitStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  padding: 6,
  boxSizing: 'border-box',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backgroundClip: 'content-box',
  border: '1px solid rgba(0, 0, 0, 0.35)',
  borderRadius: 2,
  position: 'absolute',
}

// phase-59-02: corner-drag font-scale formula. Returns the new font_size clamped
// to role bounds. widthRatio = newWidthPx / oldWidthPx. Past-cap (FONTSCALE-02):
// box keeps growing freely (caller writes width unchanged), font caps at role_max.
// Bounds match the right-rail slider min/max at ActiveTextBoxCard.tsx:256-257.
export const ROLE_FONT_BOUNDS: Record<'hook' | 'body' | 'custom', { min: number; max: number }> = {
  hook:   { min: 16, max: 240 },
  body:   { min: 14, max: 120 },
  custom: { min: 14, max: 120 },
}

export function scaleFontSizeOnCorner(
  oldFontSize: number,
  oldWidthPx: number,
  newWidthPx: number,
  role: 'hook' | 'body' | 'custom',
): number {
  // Defensive: a zero/negative oldWidthPx would yield NaN/Infinity. Fall back
  // to the unchanged size so a corrupt snapshot can't crash the dispatch.
  if (!oldWidthPx || oldWidthPx <= 0) return oldFontSize
  const widthRatio = newWidthPx / oldWidthPx
  const scaled = Math.round(oldFontSize * widthRatio)
  const { min, max } = ROLE_FONT_BOUNDS[role]
  return Math.max(min, Math.min(max, scaled))
}

// phase-59-02: dir param classifier. Corner = any of 4 diagonal handles.
// Side ('left' | 'right') and top/bottom (disabled by enableResizing) all
// return false. Used in onResizeStop to gate the font_size dispatch.
type RndDir = 'top' | 'right' | 'bottom' | 'left' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
function isCornerDir(dir: RndDir): boolean {
  return dir === 'topLeft' || dir === 'topRight' || dir === 'bottomLeft' || dir === 'bottomRight'
}

interface SlidePreviewProps {
  slide: Slide
  template: SlideTemplate
  index: number
  // Phase 45 — render context for overlays (page-counter, slide-field topic)
  // and per-segment highlight pills. All optional so legacy callsites keep
  // working unchanged. Defaults: slideIndex falls back to `index`, totalSlides
  // falls back to 1, topic falls back to undefined → resolveOverlayContent
  // returns '1/1' and '' respectively (CONTEXT.md Area 4).
  slideIndex?: number
  totalSlides?: number
  topic?: string
  editable?: boolean
  brandKit?: BrandKit | null
  userTier?: 'free' | 'plus' | 'pro'
  onPositionChange?: (field: 'hook' | 'body', position: TextPosition) => void
  onWidthChange?: (field: 'hook' | 'body', width: number) => void
  // phase-59-02: size-change callbacks (width + optional font_size). Corner drags
  // dispatch both; side drags dispatch width only (font_size omitted). Routes
  // through slide-editor's handleSizeChange / handleCustomTextSizeChange. When
  // the new prop is undefined (legacy callers — tests, storybook), the handler
  // falls back to onWidthChange / onCustomTextWidthChange so existing wiring
  // keeps working unchanged (FONTSCALE-01..04).
  onSizeChange?: (field: 'hook' | 'body', size: { width: number; font_size?: number }) => void
  onCustomTextPositionChange?: (id: string, position: TextPosition) => void
  onCustomTextWidthChange?: (id: string, width: number) => void
  onCustomTextSizeChange?: (id: string, size: { width: number; font_size?: number }) => void
  onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void
  onCustomTextSelect?: (id: string | null) => void
  onCustomTextRemove?: (id: string) => void
  selectedCustomTextId?: string | null
  onCustomImagePositionChange?: (id: string, position: { x: number; y: number }) => void
  onCustomImageSizeChange?: (id: string, size: { width: number; height: number }) => void
  onCustomImageSelect?: (id: string | null) => void
  onCustomImageRemove?: (id: string) => void
  selectedCustomImageId?: string | null
  // Phase 52 (T-01/T-02): canvas → right-rail selection wiring. Click on a text-box
  // wrapper in editable mode resolves the matching TextBox by role/id and calls
  // onTextBoxSelect. selectedTextBoxId drives the dashed selection ring (T-02).
  // Both gated to editable={true} — Satori export path (editable=false) is unchanged.
  onTextBoxSelect?: (id: string | null) => void
  selectedTextBoxId?: string | null
  /**
   * quick-260514-l9z: in-place text edit commit. Fired ONCE on blur (or
   * Esc) after the user double-clicks a hook/body text box and types. The
   * editor dispatches UPDATE_TEXT_BOX with `{ text, segments: undefined }`
   * — segments are word-index references into the old text and become stale
   * the moment the user changes the wording. When omitted, in-place edit
   * silently no-ops (legacy non-editor callers stay untouched).
   */
  onTextBoxTextEdit?: (id: string, text: string) => void
  // Phase 60 (SEL-01..04, SEL-09, SEL-13): multi-select state. Both props are
  // editor-only — used by per-element click handlers (Shift-click toggle),
  // canvas-empty-area onClick (clears), and the union-AABB ring (N>=2).
  // Threaded from useSelectionModel at slide-editor.tsx via SlideCanvas.
  selection?: Selection
  onSelectionChange?: (next: Selection | ((prev: Selection) => Selection)) => void
  // Phase 62 (GROUP-06, GROUP-07, GROUP-08, GROUP-10): group state hooks.
  //   - currentlyInsideGroup: groupId the user has "entered" via double-click,
  //     or null. While set, single-click on a group member targets the LEAF
  //     (not the whole group); the group ring switches to a solid (entered)
  //     visual style.
  //   - onEnterGroup: invoked from per-element onDoubleClick when target has
  //     a groupId. Caller (slide-editor) routes to selection.enterGroup.
  //   - onExitGroup: invoked from canvas-empty no-drag pointerup branch when
  //     currentlyInsideGroup !== null. Caller routes to selection.exitGroup.
  // All three are editor-only — read ONLY inside the editable={true} branch
  // (downstream of the line-728 early return). PARITY-01 / TPLREND-05 carry-
  // forward: the data-testid="group-bounding-ring" is structurally gated.
  currentlyInsideGroup?: string | null
  onEnterGroup?: (elementId: string, slide: Slide) => void
  onExitGroup?: () => void
  // Phase 62 (GROUP-09, KBD-09): group drag fan-out. When the active drag
  // gesture started on an element whose groupId matches the current
  // selection's full member set AND currentlyInsideGroup === null, the
  // onDragStop branch dispatches a single BULK_TRANSLATE-equivalent
  // payload via this callback INSTEAD of the per-element position-change
  // callback. Single user gesture → one history entry (KBD-09 / PERF-01
  // carry-forward from Plan 60-03). The slide-editor wiring routes this
  // into dispatch({ type: 'BULK_TRANSLATE', ... }).
  onGroupDrag?: (payload: {
    slideIndex: number
    ids: string[]
    deltaX: number
    deltaY: number
  }) => void
  // Phase 66 Plan 02 (DIFF-01, KBD-09 / PERF-01): Alt+drag duplicate fan-out.
  // When the active drag gesture's drag-START state had
  // `modifiers.get().alt === true`, the onDragStop branch dispatches a single
  // DUPLICATE_ELEMENTS_AT-equivalent payload via this callback INSTEAD of the
  // per-element position-change callback OR the onGroupDrag fan-out. Single
  // user gesture → one history entry (KBD-09 / PERF-01 carry-forward).
  // The slide-editor wiring routes this into
  // dispatch({ type: 'DUPLICATE_ELEMENTS_AT', ... }).
  // The deltaX/deltaY units match BULK_TRANSLATE / DUPLICATE_ELEMENTS_AT:
  // % of canvas (REF_WIDTH=1080 / REF_HEIGHT=1920).
  // newGroupId: when the original selection shared a single groupId, the
  // wrapper here generates a fresh `g_${slideIndex}_${Date.now-base36}` so
  // the copies form a NEW group (Figma model — RESEARCH F39). When the
  // originals were ungrouped or spanned groups, undefined.
  onAltDuplicate?: (payload: {
    slideIndex: number
    ids: string[]
    deltaX: number
    deltaY: number
    newGroupId?: string
  }) => void
  // Phase 63 Plan 02 (ALIGN-01..05, ALIGN-07): floating alignment toolbar
  // action callback. Invoked when the user clicks an align/distribute button
  // in the toolbar that this component mounts inside the editable={true}
  // branch. The parent (slide-editor.tsx via slide-canvas.tsx) is responsible
  // for resolving N=1→canvas vs N>=2→selection target and dispatching the
  // matching ALIGN/DISTRIBUTE reducer action.
  // Editor-only — read ONLY downstream of the editable={true} early return
  // (TPLREND-05 / PARITY-01). When omitted, the toolbar does not render
  // (keeps the testid out of legacy callers / Storybook stories that haven't
  // wired the new prop).
  onAlign?: (
    action:
      | { kind: 'align'; axis: AlignAxis }
      | { kind: 'distribute'; axis: DistributeAxis },
  ) => void
  // Phase 72 Plan 02 (ROTATE-02, ROTATE-03, KBD-09 / PERF-01): rotation handle
  // commit fan-out. Invoked ONCE per drag gesture (onPointerUp) with the
  // final rotation in [-180, 180]. slide-editor.tsx wires this into
  // dispatch({ type: 'BULK_ROTATE', ... }) so the gesture lands as one
  // history entry. Editor-only — read ONLY downstream of the editable={true}
  // branch (TPLREND-05 / PARITY-01 carry-forward). When omitted, the handle
  // does not render (keeps the testid out of legacy callers).
  onDecorationRotate?: (payload: {
    slideIndex: number
    ids: string[]
    rotation: number
  }) => void
  /**
   * quick-260514-kct: decoration drag commit. Invoked ONCE per drag gesture
   * (onDragStop) with the new {x, y} in % of canvas (REF_WIDTH=1080 /
   * REF_HEIGHT=1920). slide-editor.tsx wires this into dispatch({ type:
   * 'UPDATE_DECORATION', ... }) so the gesture lands as one history entry.
   * Single-element commit only — multi-element group drag still flows
   * through the existing `onGroupDrag` callback (BULK_TRANSLATE reducer
   * already handles decorations as of Phase 68 Plan 02).
   * Editor-only — read ONLY downstream of the editable={true} branch
   * (TPLREND-05 / PARITY-01 carry-forward). When omitted, decorations
   * fall back to the legacy click-only-no-drag behavior.
   */
  onDecorationPositionChange?: (
    id: string,
    position: { x: number; y: number },
  ) => void
  /**
   * Size-commit callback for an editable decoration (quick-260515-k54).
   * Optional — legacy callers / Storybook stories that omit it keep the
   * resize-disabled behavior. Mirrors `onCustomImageSizeChange`.
   */
  onDecorationSizeChange?: (
    id: string,
    size: { width: number; height: number },
  ) => void
  /**
   * quick-260517-k2n: slide-level caption-card geometry commit. Editor-only —
   * the editable branch's caption-card <Rnd> calls this from onDragStop /
   * onResizeStop. Carries a Partial<SlideStyleOverrides> patch (the caller
   * merges it into slide.style_overrides and dispatches UPDATE_SLIDE). When
   * omitted (non-editor / Satori callers), the caption-card <Rnd> renders but
   * its drag/resize no-ops — acceptable, those callers are not interactive.
   */
  onCaptionBarUpdate?: (updates: Partial<SlideStyleOverrides>) => void
}

export function SlidePreview({
  slide, template, index, slideIndex, totalSlides, topic, editable, brandKit, userTier,
  onPositionChange, onWidthChange, onSizeChange,
  onCustomTextPositionChange, onCustomTextWidthChange, onCustomTextSizeChange,
  onCustomTextUpdate, onCustomTextSelect, onCustomTextRemove,
  selectedCustomTextId,
  onCustomImagePositionChange, onCustomImageSizeChange,
  onCustomImageSelect, onCustomImageRemove,
  selectedCustomImageId,
  onTextBoxSelect,
  selectedTextBoxId,
  onTextBoxTextEdit,
  selection,
  onSelectionChange,
  currentlyInsideGroup,
  onEnterGroup,
  onExitGroup,
  onGroupDrag,
  onAltDuplicate,
  onAlign,
  onDecorationRotate,
  onDecorationPositionChange,
  onDecorationSizeChange,
  onCaptionBarUpdate,
}: SlidePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hookRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // quick-260519-hym: measured top-edge (% of frame) that vertically centers
  // the editable caption-card headline <Rnd> on the card centre. The export
  // renderers use translateY(-50%); the editor's <Rnd> is top-anchored, so it
  // measures the rendered headline height and positions the box at
  // centre − height/2. `null` until the first layout-effect measure pass.
  const [hookCenteredTopPct, setHookCenteredTopPct] = useState<number | null>(null)
  const customTextRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // phase-59-01: capture pre-drag width+fontSize on resize start so 59-02 can
  // compute widthRatio = newWidthPx / oldWidthPx in onResizeStop. Per-role
  // refs prevent cross-talk when multiple boxes coexist on a slide.
  const hookResizeStartRef = useRef<{ widthPx: number; fontSize: number } | null>(null)
  const bodyResizeStartRef = useRef<{ widthPx: number; fontSize: number } | null>(null)
  const customTextResizeStartRefs = useRef<Record<string, { widthPx: number; fontSize: number } | null>>({})
  // Phase 61 Plan 02 (KBD-07): per-element drag-start refs. Populated in
  // onDragStart, read in onDrag (axis-constrain), cleared in onDragStop.
  // Mirrors the existing resize-ref pattern above for the same correctness
  // properties: per-element scope (no cross-talk), gesture-bounded lifetime.
  const hookDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const bodyDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const customTextDragStartRefs = useRef<Record<string, { x: number; y: number } | null>>({})
  const customImageDragStartRefs = useRef<Record<string, { x: number; y: number } | null>>({})
  // quick-260514-kct: per-decoration drag-start refs for the group-drag delta
  // math (mirrors customImageDragStartRefs pattern).
  const decorationDragStartRefs = useRef<Record<string, { x: number; y: number } | null>>({})
  // Phase 66 Plan 02 (DIFF-01): per-element alt-state-at-drag-start.
  // Captured in onDragStart from `modifiers.get().alt`. Read in onDragStop
  // to branch onAltDuplicate vs onGroupDrag/onPositionChange. Cleared (set
  // back to false) in onDragStop. Mid-drag Alt-release does NOT cancel the
  // duplicate — v2.11 simplification (RESEARCH F39 / 66-CONTEXT.md).
  const hookAltStartRef = useRef<boolean>(false)
  const bodyAltStartRef = useRef<boolean>(false)
  const customTextAltStartRefs = useRef<Record<string, boolean>>({})
  const customImageAltStartRefs = useRef<Record<string, boolean>>({})
  // Phase 63 Plan 04 (SNAP-02..06, PERF-03): smart-guide snap state.
  //   - snapIndexRef: built ONCE on onDragStart from buildSnapIndex(slide,
  //     excludeIds), reused across every onDrag tick, cleared on onDragStop.
  //   - wasSnappedX/Y: per-axis hysteresis scalars (Plan 63-03 contract).
  //   - guideOverlayRef: imperative handle into <SmartGuideOverlay>; updates
  //     are direct-DOM via translate3d (NO React state per pointer-move).
  const snapIndexRef = useRef<SnapIndex | null>(null)
  const wasSnappedXRef = useRef<number | null>(null)
  const wasSnappedYRef = useRef<number | null>(null)
  const guideOverlayRef = useRef<SmartGuideOverlayHandle | null>(null)
  const overrides = slide.style_overrides ?? {}

  const [editingCustomTextId, setEditingCustomTextId] = useState<string | null>(null)
  // quick-260514-l9z: in-place edit for hook/body text boxes. Mirrors the
  // existing `editingCustomTextId` pattern (saved id, blur commits, drag
  // disabled). Stored separately so the legacy custom-text edit path isn't
  // perturbed — both states can co-exist but only one should ever be set at
  // a time in practice (entering edit on one box blurs the other).
  const [editingHookBodyId, setEditingHookBodyId] = useState<string | null>(null)
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null)
  // quick-260514-ksh: drop-to-delete trash zone removed per user request.
  // `draggingElementId` is still used by the smart-guide overlay to know
  // which element to exclude from snap targets.

  // quick-260517-k2n: caption-card canvas-selection state. Local state ONLY —
  // the caption card is NOT an addressable Selection-model element (it has no
  // id; key_decision 3). `true` => the card shows 8 resize handles + a
  // selection outline. Set true by clicking the card's body; cleared by a
  // single capture-phase pointer-down on the editable canvas container (which
  // runs before any child stopPropagation, catching clicks on every other
  // element type + empty canvas).
  const [captionCardSelected, setCaptionCardSelected] = useState(false)

  // Phase 72 Plan 02 (ROTATE-02, PERF-01): per-decoration local rotation preview.
  // Updated per-tick during a rotation-handle drag — the rendered transform
  // reads from this map (falling back to d.rotation) so the decoration appears
  // to rotate in real time WITHOUT dispatching to the reducer. Cleared on
  // pointerup once the BULK_ROTATE dispatch has landed (single pushHistory
  // per gesture). Editor-only state — never enters reducer history.
  const [localRotationPreviews, setLocalRotationPreviews] = useState<Record<string, number>>({})

  // Phase 61 Plan 02 (SEL-05/SEL-06/SEL-14): marquee selection state. Local
  // state ONLY — never enters reducer history (CONTEXT.md domain.decisions).
  // marqueeStart records canvas-local pixel coords at pointerdown; marqueeEnd
  // updates on pointermove. Both null = no active marquee (IDLE). The
  // marqueeStartRef avoids stale closures inside event handlers.
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => { marqueeStartRef.current = marqueeStart }, [marqueeStart])
  const modifiers = useModifierState()

  // quick-260518-htt checkpoint-feedback fix: UNIFIED CANVAS DESELECT.
  //
  // BUG: a click-off (empty canvas, the photo background, or anywhere OUTSIDE
  // the slide card) could never reach a zero-chrome state — the marquee
  // onPointerDown early-returns on `e.target !== e.currentTarget`, so a
  // pointer-down on the absolutely-positioned photo/tint layer (a CHILD of the
  // canvas-root) or on the `slide-canvas` padding region around the card never
  // ran any deselect. At least one element stayed selected forever.
  //
  // FIX: a single capture-phase `pointerdown` listener. It attaches to the
  // nearest `[data-testid="slide-canvas"]` ancestor (the editor canvas region,
  // which spans the card AND its padding — so "off the page" is covered),
  // falling back to the SlidePreview root for standalone renders (tests /
  // storybook). On every pointer-down it checks whether the target sits inside
  // a `[data-selectable-element]` (the marker now carried by all 6 editable
  // <Rnd> wrappers — hook, body, custom-text, custom-image, decoration,
  // caption card). If NOT, it clears EVERYTHING: the multi-select `selection`,
  // the legacy `selectedTextBoxId`, the custom-text/image single-selects, the
  // caption-card chrome, and exits any active group. A click ON an element is
  // ignored here — that element's own onMouseDown selects it (those handlers
  // still win; this listener never competes with them).
  const deselectRefs = useRef({
    onSelectionChange,
    onTextBoxSelect,
    onCustomTextSelect,
    onCustomImageSelect,
    onExitGroup,
    currentlyInsideGroup,
  })
  deselectRefs.current = {
    onSelectionChange,
    onTextBoxSelect,
    onCustomTextSelect,
    onCustomImageSelect,
    onExitGroup,
    currentlyInsideGroup,
  }
  useEffect(() => {
    if (!editable) return
    const root = containerRef.current
    if (!root) return
    // Prefer the editor canvas region so off-the-card padding clicks deselect
    // too; fall back to the SlidePreview root when rendered standalone.
    const surface =
      (root.closest('[data-testid="slide-canvas"]') as HTMLElement | null) ??
      root
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      // Click landed on (or inside) a selectable element → that element's own
      // handler owns the selection; do nothing.
      if (target && target.closest('[data-selectable-element]')) return
      // SEL-06 PITFALL-2.5 / CONTEXT D-04: a shift-held click is a NO-OP —
      // it must preserve the existing selection (it is the additive-select
      // modifier, not a deselect). Mirror the marquee handler's shift read.
      if (e.shiftKey) return
      const r = deselectRefs.current
      if (r.currentlyInsideGroup != null) r.onExitGroup?.()
      r.onCustomTextSelect?.(null)
      r.onCustomImageSelect?.(null)
      r.onSelectionChange?.({ ids: [], primary: null })
      r.onTextBoxSelect?.(null)
      // The caption card's resize chrome is gated on this LOCAL state — clear
      // it here so the unified deselect also covers it (its own
      // onPointerDownCapture only fires for in-card pointer-downs).
      setCaptionCardSelected(false)
    }
    surface.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      surface.removeEventListener('pointerdown', handlePointerDown, true)
    }
    // `containerRef.current` is stable post-mount; callbacks are read through
    // `deselectRefs` so the listener is attached exactly once.
  }, [editable])

  // Live marquee rect for the overlay — memoized so identical start/end pairs
  // don't allocate per render. Coords are SCALED-CANVAS PIXELS (matches the
  // overlay's parent: the inner scaled wrapper), not %. Plan 61-02 converts
  // px → % at pointer-up before calling elementsInRect.
  const marqueeRect = useMemo(() => {
    if (!marqueeStart || !marqueeEnd) return null
    return normalizeRect(marqueeStart.x, marqueeStart.y, marqueeEnd.x, marqueeEnd.y)
  }, [marqueeStart, marqueeEnd])

  // Phase 64 Plan 01 (LOCK-06): "marquee active" signal — derived from the
  // existing marqueeStart state. While truthy, locked-element wrappers apply
  // pointer-events:none so marquee events drill through stacked locked
  // overlays (Figma + Canva model). Default state (marquee inactive) leaves
  // pointer-events at auto so click-to-select still works on locked elements.
  const marqueeActive = marqueeStart !== null

  // ESC-cancel during active marquee. Listener is mounted ONLY while DRAGGING
  // (marqueeStart non-null) so it doesn't compete with text-input ESC handlers
  // when no marquee is active. Bypasses isEditingTarget intentionally — ESC
  // must always cancel a mid-drag gesture (cross_phase_constraints).
  useEffect(() => {
    if (!marqueeStart) return
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMarqueeStart(null)
        setMarqueeEnd(null)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [marqueeStart])

  // Color-only templates ignore per-slide color overrides so stale values
  // from a prior template (e.g. hook_text_color: '#FFFFFF' baked in by
  // bold-minimal for photo legibility) don't leak through and break the
  // template's typographic contract. Same kill-switch as resolve-styles.ts.
  const isColorOnlyTpl = template.backgroundMode === 'color'
  const textColor = isColorOnlyTpl
    ? template.textColor
    : overrides.text_color ?? template.textColor
  const hookTextColor = isColorOnlyTpl
    ? template.textColor
    : overrides.hook_text_color ?? textColor
  const bodyTextColor = isColorOnlyTpl
    ? template.textColor
    : overrides.body_text_color ?? textColor
  // Per-text-box alignment (modern path). Each text_boxes entry can carry
  // its own text_align — hook reads from the hook box, body reads from the
  // body box. Falls back to slide-level overrides.text_align (legacy path),
  // then template.textAlign. Fixes the bug where pressing Center on the
  // hook forced body to also center, and where body alignment buttons were
  // silently overridden by hook's value via the dual-write adapter.
  const hookTextBox = (slide.text_boxes ?? []).find((tb) => tb.role === 'hook')
  const bodyTextBox = (slide.text_boxes ?? []).find((tb) => tb.role === 'body')
  const hookBoxAlign = hookTextBox?.text_align
  const bodyBoxAlign = bodyTextBox?.text_align
  const slideAlign = overrides.text_align ?? template.textAlign
  const hookTextAlign = hookBoxAlign ?? slideAlign
  const bodyTextAlign = bodyBoxAlign ?? slideAlign
  // quick-260502-pw8: per-text-box list_type / list_indent reads. Mirrors
  // text_align lookup. Legacy slides without text_boxes leave both undefined,
  // which routes renderTextBlock through its byte-identical fast path.
  const hookListType = hookTextBox?.list_type
  const hookListIndent = hookTextBox?.list_indent
  const bodyListType = bodyTextBox?.list_type
  const bodyListIndent = bodyTextBox?.list_indent
  // Kept for callers that haven't been split yet (custom-text fallback below).
  const textAlign = slideAlign
  // Templates with a hook-fit registry entry auto-shrink the hook size for long
  // headlines so multi-line hooks don't overflow the reserved hook zone.
  // Templates not in the registry keep their declared hookFontSize unchanged.
  // quick-260510-export-overlap: in news layouts (where bodyY is fixed by
  // NEWS_LAYOUT preset), manual `hook_font_size` is also clamped to 1.6× the
  // auto-fit value — without this cap, a too-big manual size wraps the hook
  // into more lines than the (bodyY - hookY) zone can hold and produces
  // exports where hook + body overlap. Identical clamp also applied in
  // render-slide-satori.tsx (TPLREND-05 parity contract).
  // Mirrors the newsZone gate computed below (line ~684 — template.backgroundMode
  // gates news layout: legacy templates leave it undefined, premium templates
  // set 'image-bleed'|'image-with-bottom-card'|'color'). When set,
  // `overrides.layout` selects NEWS_LAYOUT.cover|body whose bodyY is fixed.
  const isNewsLayoutSlide =
    template.backgroundMode == null && overrides.layout != null
  const baseHookSize = parseInt(template.hookFontSize)
  const autoFitHookSize =
    overrides.hook_font_size == null && hasHookFit(template.id)
      ? getHookFontSize(template.id, slide.hook_text, baseHookSize)
      : null
  // Phase 82 Gap A: the manual-hook cap is body-aware — headline-only news
  // slides (no body box) are no longer capped, so the headline can dominate.
  const hasBody = typeof slide.body_text === 'string' && slide.body_text.length > 0
  const hookFontSize = overrides.hook_font_size != null
    ? (isNewsLayoutSlide
        ? clampManualHookSize(overrides.hook_font_size, template.id, slide.hook_text, baseHookSize, hasBody)
        : overrides.hook_font_size)
    : (autoFitHookSize ?? baseHookSize)
  // Phase 82 Gap D (render-wiring): re-fit the news headline to a quick-260517-k2n
  // caption card when one is enabled, so the canvas preview matches the Satori +
  // HTML exports. `resolveNewsHeadlineFit` is a no-op (returns hookFontSize) for
  // every non-news slide and every slide without an enabled caption card.
  // quick-260518-8o0: pass `isNewsLayoutSlide` so an unedited news slide
  // resolves enabled:true with seeded bottom-region black geometry.
  const captionBarForFit = resolveCaptionBar(slide.style_overrides, template, isNewsLayoutSlide)
  const newsHeadlineFontSize = resolveNewsHeadlineFit(
    captionBarForFit, slide.hook_text, hookFontSize, isNewsLayoutSlide,
  )
  // quick-260519-hym: when an enabled caption card backs a news-layout slide,
  // the headline text box is OWNED by the card geometry — inset to the card's
  // fit-box width and vertically centered in the card. Derived (not read from
  // persisted hook_position) so it stays correct if the card is resized and so
  // older slides re-center on load. `null` for every non-caption-card slide.
  // Same gate + helper as render-slide-satori.tsx / render-slide.ts (TPLREND-05).
  const captionCardHeadline =
    captionBarForFit.enabled && isNewsLayoutSlide
      ? captionCardHeadlineBox(captionBarForFit)
      : null
  const bodyFontSize = overrides.body_font_size ?? parseInt(template.bodyFontSize)

  // Font family overrides (Phase 12)
  // quick-260515-nhf: hook casing/font/style now resolved via the shared
  // resolveHookTypography helper so editor + Satori + HTML agree (TPLREND-05)
  // and user TextBox overrides win over the template's hookStyle. The helper
  // owns casing + family + italic-from-template only — hook font SIZE keeps
  // its existing `overrides.hook_font_size` resolution (hook-fit interaction).
  const hookTypography = resolveHookTypography(overrides, hookTextBox, template)
  const hookFontFamily = hookTypography.fontFamily
  const bodyFontFamily = overrides.body_font_family ?? template.fontFamily

  // Bold/italic overrides (Phase 11)
  // 260503-0f2: respect template-level hookFontWeight default (set to 400 on
  // Anton-using templates so browser falls back consistently with Satori).
  const hookFontWeight = overrides.hook_font_weight ?? template.hookFontWeight ?? 900
  const bodyFontWeight = overrides.body_font_weight ?? 400
  const hookFontStyle = overrides.hook_font_style ?? 'normal'
  const bodyFontStyle = overrides.body_font_style ?? 'normal'

  // Color-only templates (paper-essay, brutalist-grid) suppress the slide-wide
  // darkening overlay regardless of any persisted style_overrides — same kill-
  // switch logic as resolve-styles.ts and the Satori renderer.
  const overlayOpacity = template.backgroundMode === 'color'
    ? 0
    : overrides.overlay_opacity != null
      ? overrides.overlay_opacity / 100
      : template.overlayOpacity
  // quick-260515-overlay-color-picker: user-controlled overlay tint color.
  // Falls back to template default. Mirrored in render-slide-satori.tsx +
  // render-slide.ts so the editor preview, Satori snapshot, and HTML render
  // path all agree (TPLREND-05 invariant).
  const overlayColor = overrides.overlay_color ?? template.overlayColor

  const hookPos = overrides.hook_position
  const bodyPos = overrides.body_position

  const accentColor = template.accentColor ?? template.textColor
  // quick-260514-laa: per-text-box accent-color override. Each block reads
  // its box's `accent_color` and falls back to the template default. Threads
  // into renderTextBlock so the right-rail "Highlight color" picker actually
  // recolors the rendered highlighted words.
  const hookAccentColor = hookTextBox?.accent_color ?? accentColor
  const bodyAccentColor = bodyTextBox?.accent_color ?? accentColor

  // Phase 45 — graceful-fallback render context for the shared overlay resolver.
  // slideIndex defaults to `index` (the array position prop already in scope);
  // totalSlides defaults to 1 so the page-counter prints '1/1' in single-tile
  // contexts (template-picker, brand-kit-form). Mirrors render-slide-satori's
  // resolveCtx — same source of truth, same TPLREND-05 parity contract.
  const resolveCtx: OverlayResolveCtx = {
    slideIndex: slideIndex ?? index ?? 0,
    totalSlides: totalSlides ?? 1,
    topic,
    slide,
  }
  // Phase 45 — mutual-exclusion gate: when a template declares an explicit
  // `backgroundMode` (premium tier), the template's choice supersedes any
  // slide-level `style_overrides.layout` (legacy news field). Legacy 5
  // templates leave backgroundMode undefined → newsZone path runs unchanged.
  const isTemplateBgMode =
    template.backgroundMode != null && template.backgroundMode !== 'color'
  // backgroundMode: 'color' is a hard kill-switch — the template promises a
  // pure-typography canvas, so any persisted `slide.background_url` must be
  // ignored in this live preview just as it is in the Satori/HTML renderers.
  const isColorOnlyTemplate = template.backgroundMode === 'color'
  const newsZone =
    !isTemplateBgMode && !isColorOnlyTemplate && overrides.layout
      ? NEWS_LAYOUT[overrides.layout]
      : null
  // quick-260518-8o0: `newsImageHeight` retired. The news photo is now a
  // full-bleed background (it goes through the same `innerStyle.backgroundImage`
  // path as non-news photos — see `innerStyle` below), so it no longer has a
  // movable photo/caption boundary; `news_image_height` is dead resolver wiring
  // and is removed from all 3 render paths.
  const useBgMode = isTemplateBgMode
  // quick-260517-k2n: `useBottomCard` removed — the caption card is no longer
  // backgroundMode-gated. It now renders on any template via CaptionCardLayer /
  // the editable <Rnd>, gated solely on resolveCaptionBar(...).enabled.

  const positionPreset = overrides.text_position ?? template.textPosition
  const defaults = newsZone ?? SAFE_ZONE[positionPreset] ?? SAFE_ZONE.center
  const defaultX = SAFE_ZONE.x

  // quick-260519-hym: a caption-card headline's x/y are derived from the card,
  // overriding any persisted hook_position (the card owns the geometry).
  const resolvedHookX = captionCardHeadline?.xPct ?? hookPos?.x ?? defaultX
  const resolvedHookY = captionCardHeadline?.yCenterPct ?? hookPos?.y ?? defaults.hookY
  const resolvedBodyX = bodyPos?.x ?? defaultX
  const resolvedBodyY = bodyPos?.y ?? defaults.bodyY

  // Width: caption-card headline uses the card's fit-box width; otherwise
  // override or symmetric calc, min 20%.
  const hookWidth = captionCardHeadline?.widthPct
    ?? Math.max(20, overrides.hook_width ?? (100 - resolvedHookX * 2))
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
    // quick-260514-l9z: in-place edit on hook/body must NOT trigger the
    // delete-selected-element shortcut while the user is typing.
    if (editingHookBodyId) return
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
  }, [editable, selectedCustomTextId, selectedCustomImageId, editingCustomTextId, editingHookBodyId, onCustomTextRemove, onCustomImageRemove])

  // quick-260514-l9z: focus the contentEditable surface + place caret at the
  // end when in-place edit starts. Without this, the user has to click into
  // the box a second time to begin typing — defeats the "double-click to
  // edit" UX. Works for hook and body (they share editingHookBodyId state).
  useEffect(() => {
    if (!editingHookBodyId) return
    const hookBox = slide.text_boxes?.find((tb) => tb.role === 'hook')
    const bodyBox = slide.text_boxes?.find((tb) => tb.role === 'body')
    let host: HTMLDivElement | null = null
    if (hookBox && hookBox.id === editingHookBodyId) host = hookRef.current
    else if (bodyBox && bodyBox.id === editingHookBodyId) host = bodyRef.current
    // Wrapper refs point at the padding div; the contentEditable surface is
    // its first child div (rich text container). Local name `editableEl` to
    // avoid shadowing the `editable` prop.
    const editableEl = host?.querySelector('[contenteditable="true"]') as
      | HTMLDivElement
      | null
    if (!editableEl) return
    editableEl.focus()
    // Place caret at end of existing text.
    const range = document.createRange()
    range.selectNodeContents(editableEl)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editingHookBodyId, slide.text_boxes])

  // quick-260519-hym: vertically center the editable caption-card headline
  // <Rnd> on the card centre. The export renderers use translateY(-50%); the
  // editor's <Rnd> is top-anchored, so it measures the rendered headline's
  // height and parks the box top at centre − height/2. Runs after every render
  // (caption headline only); the functional-setState guard makes it converge
  // in ~1 extra render and never loop.
  useLayoutEffect(() => {
    if (!editable || !captionCardHeadline) {
      setHookCenteredTopPct((prev) => (prev === null ? prev : null))
      return
    }
    const el = hookRef.current
    if (!el || !scale) return
    const heightPct =
      (el.getBoundingClientRect().height / scale / REF_HEIGHT) * 100
    const top = captionCardHeadline.yCenterPct - heightPct / 2
    setHookCenteredTopPct((prev) =>
      prev !== null && Math.abs(prev - top) < 0.05 ? prev : top,
    )
  })

  const hookTextStyle: React.CSSProperties = {
    // Phase 82 Gap D: caption-card-aware re-fit (= hookFontSize when no card).
    fontSize: `${newsHeadlineFontSize}px`,
    fontFamily: hookFontFamily,
    fontWeight: hookFontWeight,
    // quick-260515-nhf: italic still honors the per-override hook_font_style
    // toggle first; the template-driven italic fallback now comes from the
    // shared helper. textTransform comes from the helper too — emit
    // 'uppercase' or undefined (NOT 'none') so a no-override slide stays
    // byte-identical to today's output (TPLREND-05).
    fontStyle: hookFontStyle === 'italic' ? 'italic' : (hookTypography.fontStyle === 'italic' ? 'italic' : undefined),
    textTransform: hookTypography.textTransform === 'uppercase' ? 'uppercase' : undefined,
    color: hookTextColor,
    // 260503: flex-wrap mirrors render-slide-satori.tsx hookStyle (TPLREND-05
    // parity contract — slide-preview.tsx:97-101). Satori only breaks between
    // flex items (segment spans); the previous browser-only `whiteSpace:normal
    // + overflowWrap:break-word` produced denser word/char-level breaks in the
    // editor that did not match the exported PNG, hiding hook overflow bugs.
    display: 'flex',
    flexWrap: 'wrap',
    width: '100%',
    // quick-260514-l9q: `text-align` on a `display: flex` element does NOT
    // align flex items in the browser — `justify-content` does. Without this
    // mapping, picking "Center" / "Right" on a hook text box renders left-
    // aligned in the editor (Satori's CSS subset coincidentally interprets
    // text-align correctly so the bug was browser-only). User workaround was
    // bumping list-indent to 1 to dodge the fast-path renderer.
    justifyContent: alignToJustifyContent(hookTextAlign),
  }
  const bodyTextStyle: React.CSSProperties = {
    fontSize: `${bodyFontSize}px`,
    fontFamily: bodyFontFamily,
    fontWeight: bodyFontWeight,
    fontStyle: bodyFontStyle === 'italic' ? 'italic' : undefined,
    color: bodyTextColor,
  }

  // Background style (shared).
  // quick-260518-8o0: news-layout slides now render the photo full-bleed via
  // this same CSS `backgroundImage` — the constrained `newsBgImageNode` <img>
  // is retired. The caption card owns the headline backdrop; the photo is a
  // permanent full-bleed background, identical to the non-news path.
  const innerStyle: React.CSSProperties = {
    width: REF_WIDTH,
    height: REF_HEIGHT,
    fontFamily: template.fontFamily,
    color: textColor,
    // quick-260517-h8z: user-controlled slide background color. Falls back to
    // template default. TPLREND-05 mirror of render-slide-satori.tsx +
    // render-slide.ts via `overrides.background_color ?? template.backgroundColor`.
    backgroundColor: overrides.background_color ?? template.backgroundColor,
    // Phase 45: When useBgMode is active, BackgroundLayers renders the photo as
    // an absolutely-positioned <img> — suppress the CSS backgroundImage to avoid
    // a redundant second fetch and match Satori which never sets backgroundImage
    // on the root element (Satori uses only the <img> tag, no CSS background).
    // quick-260518-8o0: `!newsZone` removed from the gate so news-layout slides
    // also render the photo full-bleed through this CSS background-image.
    backgroundImage: !useBgMode && !isColorOnlyTemplate && slide.background_url
      ? `url(${slide.background_url})`
      : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }

  // Phase 63 Plan 04 (SNAP-02..06, SNAP-09, DIFF-03, PERF-03):
  // Single helper closure consumed by all 4 onDrag sites (hook, body,
  // custom_text, custom_image). Reads snapIndexRef (built on onDragStart),
  // queries snapWithHysteresis per axis using wasSnappedX/YRef state, runs
  // detectEqualSpacing for the "==" indicator, and pushes the result into
  // <SmartGuideOverlay> via guideOverlayRef. Returns the snapped (x, y) for
  // the caller to write back into react-rnd's data object.
  //
  // Hold-Cmd disable (SNAP-05): if modifiers.get().cmd is true, skip ALL
  // snap math and clear the overlay. Plan 60-04 useModifierState handles
  // the blur-reset contract (PITFALL-5.5) — this plan just consumes.
  //
  // Multi-element drag (SNAP-09): callers pass the union AABB query rect
  // when selection.ids.length >= 2 — see each onDrag site below for the
  // bounds → REF px conversion.
  //
  // PERF-03: this helper allocates 1 result object + a few small arrays per
  // tick; no setState, no DOM reads (other than the overlay update which is
  // direct ref.style mutation). The pure module's binary-search keeps
  // per-tick work O(log N) per axis (Plan 63-03 verified bench).
  //
  // useCallback isn't strictly necessary (the function is read once per
  // render and stored on the closure of each onDrag), but keeping it stable
  // avoids subtle re-renders if a future consumer captures it via memo.
  const runSnapForDrag = useCallback(
    (x: number, y: number, width: number, height: number): { x: number; y: number } => {
      // SNAP-05: Hold Cmd → skip snap math entirely; clear the overlay.
      if (modifiers.get().cmd) {
        guideOverlayRef.current?.clear()
        return { x, y }
      }
      const idx = snapIndexRef.current
      if (!idx) return { x, y }

      // Scale-aware thresholds: target ~8 screen-px magnetism (Canva/Figma feel)
      // converted to REF px via the current canvas scale. Floors at the legacy
      // 5/7 REF-px so the screen-space feel never gets tighter than the
      // original at huge scales. When scale is unknown (test/SSR), fall back to
      // the defaults baked into snapWithHysteresis.
      const snapThresholds = scale > 0
        ? { enter: Math.max(5, 8 / scale), exit: Math.max(7, 12 / scale) }
        : undefined

      // X-axis: pick the dragging-entity x-edge with the smallest snap delta.
      const dCenterX = x + width / 2
      const dRight = x + width
      const xCandidates = [x, dCenterX, dRight]
      let bestX: HysteresisResult = { snapped: false, snappedTo: null, delta: 0, nextWasSnapped: null }
      let bestXAbs = Infinity
      for (const cand of xCandidates) {
        const r = snapWithHysteresis(cand, idx.xEdges, wasSnappedXRef.current, snapThresholds)
        if (r.snapped) {
          const ad = Math.abs(r.delta)
          if (ad < bestXAbs) {
            bestXAbs = ad
            bestX = r
          }
        }
      }
      wasSnappedXRef.current = bestX.nextWasSnapped
      const snappedX = bestX.snapped ? x + bestX.delta : x

      // Y-axis: same shape.
      const dCenterY = y + height / 2
      const dBottom = y + height
      const yCandidates = [y, dCenterY, dBottom]
      let bestY: HysteresisResult = { snapped: false, snappedTo: null, delta: 0, nextWasSnapped: null }
      let bestYAbs = Infinity
      for (const cand of yCandidates) {
        const r = snapWithHysteresis(cand, idx.yEdges, wasSnappedYRef.current, snapThresholds)
        if (r.snapped) {
          const ad = Math.abs(r.delta)
          if (ad < bestYAbs) {
            bestYAbs = ad
            bestY = r
          }
        }
      }
      wasSnappedYRef.current = bestY.nextWasSnapped
      const snappedY = bestY.snapped ? y + bestY.delta : y

      // Build guide-line lists for the overlay.
      const xLines: GuideLine[] = bestX.snapped && bestX.snappedTo !== null
        ? [{ pos: bestX.snappedTo }]
        : []
      const yLines: GuideLine[] = bestY.snapped && bestY.snappedTo !== null
        ? [{ pos: bestY.snappedTo }]
        : []

      // SNAP-04 / DIFF-03: equal-spacing == indicator. Detection runs
      // against ALL elements on the slide (we want the indicator to show
      // the canvas's equal-gap state regardless of who's dragging — the
      // dragging element STILL contributes to the visible state). Walks
      // text_boxes (custom-anchor only — Phase 60 height gap) ∪
      // custom_images. Watermark is excluded from this gap detection
      // because its size is a placeholder (Phase 64 will fix).
      const xElements: Array<{ id: string; pos: number; size: number }> = []
      const yElements: Array<{ id: string; pos: number; size: number }> = []
      for (const tb of slide.text_boxes ?? []) {
        if (tb.position.anchor !== 'custom') continue
        const xPx = ((tb.position.x ?? 0) / 100) * REF_WIDTH
        const yPx = ((tb.position.y ?? 0) / 100) * REF_HEIGHT
        const wPx = ((tb.position.width ?? 60) / 100) * REF_WIDTH
        xElements.push({ id: tb.id, pos: xPx, size: wPx })
        yElements.push({ id: tb.id, pos: yPx, size: 0 }) // Phase 60 height gap
      }
      for (const ci of slide.custom_images ?? []) {
        const xPx = (ci.x / 100) * REF_WIDTH
        const yPx = (ci.y / 100) * REF_HEIGHT
        const wPx = (ci.width / 100) * REF_WIDTH
        const hPx = (ci.height / 100) * REF_HEIGHT
        xElements.push({ id: ci.id, pos: xPx, size: wPx })
        yElements.push({ id: ci.id, pos: yPx, size: hPx })
      }
      const xMatch = detectEqualSpacing(xElements)
      const yMatch = detectEqualSpacing(yElements)
      // Prefer X axis when both match (matches Figma observation; arbitrary
      // but stable).
      const equalSpacing = xMatch ?? yMatch
      const equalSpacingAxis: 'horizontal' | 'vertical' | undefined =
        xMatch ? 'horizontal' : yMatch ? 'vertical' : undefined

      guideOverlayRef.current?.updateGuides({
        xLines,
        yLines,
        equalSpacing,
        equalSpacingAxis,
      })
      return { x: snappedX, y: snappedY }
    },
    [modifiers, slide.text_boxes, slide.custom_images, scale],
  )

  // Phase 63 Plan 04 (SNAP-09): assemble excludeIds for the snap index based
  // on the active drag's group/multi-select state. When the drag is part of
  // a multi-select or group drag, ALL co-moving ids are excluded so the
  // dragging entity's edges aren't snapped to itself.
  const buildExcludeIds = useCallback(
    (draggedId: string): Set<string> => {
      const exclude = new Set<string>([draggedId])
      // Group-drag: shouldGroupDrag returns the full member set when this
      // drag is a group drag (selection equals the group's member set AND
      // currentlyInsideGroup === null).
      const groupMembers = selection
        ? shouldGroupDrag(slide, selection, currentlyInsideGroup ?? null, draggedId)
        : null
      if (groupMembers) {
        for (const m of groupMembers) exclude.add(m)
        return exclude
      }
      // Plain multi-select: when selection.ids.length >= 2 AND the dragged
      // element is in the selection, BULK_TRANSLATE-style flow moves all
      // selected ids together (Phase 60). Exclude all selected so they
      // don't snap to each other.
      if (selection && selection.ids.length >= 2 && selection.ids.includes(draggedId)) {
        for (const id of selection.ids) exclude.add(id)
      }
      return exclude
    },
    [slide, selection, currentlyInsideGroup],
  )

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
          {/* Phase 45 layers 1-3: backgroundMode photo + tint + optional bottom-card.
              quick-260518-8o0: the legacy news <img> (newsBgImageNode) is retired —
              the news photo is full-bleed via innerStyle.backgroundImage, so the
              non-bgMode branch only paints the tint div. */}
          {useBgMode ? (
            <BackgroundLayers
              template={template}
              slide={slide}
              overlayOpacity={overlayOpacity}
              overlayColor={overlayColor}
            />
          ) : (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: overlayColor,
              opacity: overlayOpacity,
            }} />
          )}

          {/* quick-260517-k2n: caption card — sibling layer outside the
              useBgMode ternary so it renders on EVERY template (key_decision 2).
              Non-editable branch => plain div. */}
          <CaptionCardLayer template={template} slide={slide} isNewsLayoutSlide={isNewsLayoutSlide} />

          {/* Phase 45 layer 4: overlay zones (chip, counter, mid pill).
              Above tint+card per CONTEXT.md Area 1; below hook so headline
              pills stay top-most. */}
          <OverlayLayers template={template} ctx={resolveCtx} />

          {/* Hook text — Phase 64 LOCK-07: skip when hook text_box hidden=true */}
          {!hookTextBox?.hidden && (
          <div style={{
            position: 'absolute',
            left: `${resolvedHookX}%`,
            top: `${resolvedHookY}%`,
            width: `${hookWidth}%`,
            zIndex: 10,
            textAlign: hookTextAlign,
            // quick-260519-hym: a caption-card headline's `top` is the card
            // CENTER — translateY(-50%) centers the (variable-height) block
            // vertically in the card with no line-count estimate.
            ...(captionCardHeadline ? { transform: 'translateY(-50%)' } : {}),
            ...(resolved.hookEffects.highlight?.enabled && resolved.hookEffects.highlight.style === 'full'
              ? { backgroundColor: resolved.hookEffects.highlight.color, padding: `${resolved.hookEffects.highlight.padding}px` }
              : {}),
          }}>
            <div style={{ ...hookTextStyle, lineHeight: 1.1, ...hookEffectCSS }}>
              {resolved.hookEffects.highlight?.enabled && resolved.hookEffects.highlight.style === 'tight'
                ? renderTightHighlight(slide.hook_text, slide.hook_segments, hookListType, hookListIndent, hookTextColor, hookAccentColor, resolved.hookEffects.highlight, hookTextAlign)
                : renderTextBlock(slide.hook_text, slide.hook_segments, hookListType, hookListIndent, hookTextColor, hookAccentColor)}
            </div>
          </div>
          )}

          {/* Body text — Phase 64 LOCK-07: skip when body text_box hidden=true */}
          {slide.body_text && !bodyTextBox?.hidden && (
            <div style={{
              position: 'absolute',
              left: `${resolvedBodyX}%`,
              top: `${resolvedBodyY}%`,
              width: `${bodyWidth}%`,
              zIndex: 10,
              textAlign: bodyTextAlign,
              ...(resolved.bodyEffects.highlight?.enabled && resolved.bodyEffects.highlight.style === 'full'
                ? { backgroundColor: resolved.bodyEffects.highlight.color, padding: `${resolved.bodyEffects.highlight.padding}px` }
                : {}),
            }}>
              <p className="opacity-90" style={{ ...bodyTextStyle, lineHeight: 1.5, ...bodyEffectCSS }}>
                {resolved.bodyEffects.highlight?.enabled && resolved.bodyEffects.highlight.style === 'tight'
                  ? renderTightHighlight(slide.body_text, slide.body_segments, bodyListType, bodyListIndent, bodyTextColor, bodyAccentColor, resolved.bodyEffects.highlight, bodyTextAlign)
                  : renderTextBlock(slide.body_text, slide.body_segments, bodyListType, bodyListIndent, bodyTextColor, bodyAccentColor)}
              </p>
            </div>
          )}

          {/* Custom images (non-editable) — Phase 64 LOCK-07: filter ci.hidden === true */}
          {(slide.custom_images ?? []).filter((ci) => ci.hidden !== true).map((ci) => (
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

          {/* Phase 67 (DECOR-01) layer 5.5: decoration iteration site (non-editable).
              See render-slide-satori.tsx for the full contract; both renderers
              are kept in lockstep at this layer (TPLREND-05).
              Phase 69 Plan 02: renderer body now invokes renderDecoration; layer 5.5
              placement preserved (between custom_images at 5.0 and watermark at 6.0). */}
          {(slide.decorations ?? [])
            .filter((d) => d.hidden !== true)
            .map((d) => {
              const node = renderDecoration(d, {
                slideIndex: resolveCtx.slideIndex,
                totalSlides: resolveCtx.totalSlides,
                target: 'browser',
              })
              return node ? React.cloneElement(node as React.ReactElement, { key: d.id }) : null
            })}

          {/* Brand watermark (non-editable) — coords resolved at REF canvas size; CSS scale handles container size */}
          {/* Phase 60 (WMARK-04): the lazy initializer in use-slide-editor.ts mirrors
              slide.watermark ↔ slide.style_overrides.watermark via watermark-adapter.ts.
              resolveWatermark reads from the legacy slot — the mirror keeps both in sync,
              so byte-identical output is preserved across the schema lift. Replacing
              resolveWatermark wholesale belongs to a later phase; Phase 60 only adds the
              unified element while preserving the resolver contract (RESEARCH Q1 + Q10).
              Phase 64 LOCK-07: gate render on slide.watermark.hidden so a hidden
              watermark suppresses both the unified-slot AND legacy resolver paths. */}
          {(() => {
            if (slide.watermark?.hidden === true) return null
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
            const fw = resolveForcedWatermark(userTier, { width: REF_WIDTH, height: REF_HEIGHT }, slide)
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

          {/* Custom texts (non-editable) — Phase 64 LOCK-07: hidden flag lives
              on the text_boxes mirror (Phase 49 dual-write contract). Skip when
              the matching text_box has hidden === true. */}
          {(slide.custom_texts ?? []).filter((ct) => {
            const ctBox = (slide.text_boxes ?? []).find((tb) => tb.id === ct.id)
            return ctBox?.hidden !== true
          }).map((ct) => {
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
                  ? renderTightHighlight(ct.text, ct.segments, ct.list_type, ct.list_indent, ctBaseColor, accentColor, ctHighlight, ct.text_align)
                  : renderTextBlock(ct.text, ct.segments, ct.list_type, ct.list_indent, ctBaseColor, accentColor)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Editable mode with react-rnd drag+resize text boxes

  // Phase 52 (T-02): resolve hook/body TextBox.id once for the dashed selection
  // ring. Custom boxes match selectedTextBoxId directly via ct.id below. The ring
  // is intentionally `outline` (not `border`) because outline doesn't affect
  // layout AND Satori ignores the property — but we ALSO gate every use site to
  // editable={true} (the entire editable branch), so even if a future Satori
  // upgrade started honoring outline, the export path still wouldn't see it.
  const hookBoxId = slide.text_boxes?.find((tb) => tb.role === 'hook')?.id ?? null
  const bodyBoxId = slide.text_boxes?.find((tb) => tb.role === 'body')?.id ?? null
  const selectionRingClass = 'outline outline-2 outline-dashed outline-[#3d0000] outline-offset-2 rounded-sm'
  const hookSelected = !!selectedTextBoxId && hookBoxId === selectedTextBoxId
  const bodySelected = !!selectedTextBoxId && bodyBoxId === selectedTextBoxId

  // quick-260519-hym: a caption-card headline's <Rnd> top edge is the measured
  // centred top (centre − height/2). Until the first measure pass it falls back
  // to the card centre; the layout effect corrects it within one frame.
  const editableHookYPct =
    captionCardHeadline && hookCenteredTopPct != null
      ? hookCenteredTopPct
      : resolvedHookY
  const hookPixels = {
    x: (resolvedHookX / 100) * REF_WIDTH,
    y: (editableHookYPct / 100) * REF_HEIGHT,
  }
  const bodyPixels = {
    x: (resolvedBodyX / 100) * REF_WIDTH,
    y: (resolvedBodyY / 100) * REF_HEIGHT,
  }

  const hookWidthPx = (hookWidth / 100) * REF_WIDTH
  const bodyWidthPx = (bodyWidth / 100) * REF_WIDTH

  // GAP-F (82-10): padded geometry for the editable headline <Rnd>. The <Rnd>
  // box is widened by 2*HOOK_WRAPPER_PAD_X so the inner `hook-text-wrapper`'s
  // content box (after its `4px 8px` padding) is exactly `hookWidthPx` — the
  // same flex-wrap container width the read-only branch and the Satori export
  // use. The box's x is shifted left by HOOK_WRAPPER_PAD_X so the *text* still
  // starts at the same canvas x as the read-only branch (box grows symmetrically
  // around the text). `hookWidthPx` itself stays the canonical UNPADDED text
  // width — snap/bounds math keeps reading it. All drag/resize commit math
  // below converts the padded frame back so persisted hook_position/hook_width
  // are byte-identical to a pre-GAP-F drag.
  const hookRndWidthPx = hookWidthPx + 2 * HOOK_WRAPPER_PAD_X
  const hookRndPixels = { x: hookPixels.x - HOOK_WRAPPER_PAD_X, y: hookPixels.y }

  // phase-59-01: corners on, top/bottom off (auto-fit text design — RESIZE-01/02/03 per CONTEXT.md).
  const enableResizing = {
    left: true,
    right: true,
    top: false,
    bottom: false,
    topLeft: true,
    topRight: true,
    bottomLeft: true,
    bottomRight: true,
  }

  // phase-59-01: side handles preserve existing 4×40 vertical-bar visual; 4 corner
  // handles add 12×12 white-fill / dark-border square inside a 24×24 hit zone
  // (WCAG 2.5.8 AA), with diagonal resize cursors set inline so they win over
  // the inner content's cursor:'grab' (UI-SPEC "Cursor Affordance Contract").
  // Wrapper offset top/left: -12 centers the 24×24 hit zone on the corner.
  const resizeHandleStyles = {
    left: { ...resizeHandleStyle, left: -2 },
    right: { ...resizeHandleStyle, right: -2 },
    topLeft: {
      ...cornerHandleHitStyle,
      top: -12,
      left: -12,
      cursor: 'nwse-resize',
    },
    topRight: {
      ...cornerHandleHitStyle,
      top: -12,
      right: -12,
      cursor: 'nesw-resize',
    },
    bottomLeft: {
      ...cornerHandleHitStyle,
      bottom: -12,
      left: -12,
      cursor: 'nesw-resize',
    },
    bottomRight: {
      ...cornerHandleHitStyle,
      bottom: -12,
      right: -12,
      cursor: 'nwse-resize',
    },
  }

  return (
    <div
      ref={containerRef}
      data-testid="slide-preview"
      className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
    >
      <div
        style={innerStyle}
        // Phase 61 Plan 02 (SEL-05/SEL-06/SEL-14): canvas-root pointer-event
        // state machine. Replaces Plan 60-05's onClick at this seam (PITFALL-2.4
        // touch-parity carry-forward — pointerdown unifies mouse+touch). The
        // "click-empty-canvas-clears" semantic from Plan 60-05 is preserved as
        // the no-drag branch in onPointerUp (rect.w<=2 && rect.h<=2).
        //
        // PITFALL-2.1: e.target===e.currentTarget gate — pointerdown on a child
        // element does NOT start a marquee (children have their own onMouseDown
        // at the per-element Rnd that stopPropagation already; the target check
        // is the strong gate for pointer events).
        //
        // FALLBACK PATH (CONTEXT.md decisions, locked): we own the hit-testing
        // via elementsInRect + manual px→% conversion using the existing `scale`
        // factor. selecto package is installed (Plan 61-01) but we don't wire
        // its hit-tester — avoids the Day-1 setScale debugging surface entirely.
        onPointerDownCapture={(e) => {
          // quick-260517-k2n: any pointer-down that is NOT on the caption card
          // deselects it. Capture phase runs BEFORE child stopPropagation, so
          // this catches clicks on hook/body/custom-text/custom-image/
          // decoration AND empty canvas in one place. The caption-card <Rnd>
          // sets the selection back to true in its own (bubble-phase)
          // onMouseDown, which fires AFTER this — so clicking the card nets
          // out selected.
          void e
          if (captionCardSelected) setCaptionCardSelected(false)
        }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return
          const rect = e.currentTarget.getBoundingClientRect()
          // Convert client coords → canvas-local pixel coords. The CSS scale
          // wrapper is at the slide-preview container level; this inner div
          // shares the same coord space as the unscaled REF canvas via the
          // existing `scale` factor used by <Rnd> below.
          const x = (e.clientX - rect.left) / scale
          const y = (e.clientY - rect.top) / scale
          setMarqueeStart({ x, y })
          setMarqueeEnd({ x, y })
          // Pointer capture so subsequent move/up events fire on this element
          // even if the pointer leaves canvas bounds. setPointerCapture can
          // throw on detached elements / lacking pointerId, hence try/catch.
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
        }}
        onPointerMove={(e) => {
          if (!marqueeStartRef.current) return
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left) / scale
          const y = (e.clientY - rect.top) / scale
          setMarqueeEnd({ x, y })
        }}
        onPointerUp={(e) => {
          const start = marqueeStartRef.current
          if (!start) return
          const rectEl = e.currentTarget.getBoundingClientRect()
          const endX = (e.clientX - rectEl.left) / scale
          const endY = (e.clientY - rectEl.top) / scale
          const pixRect = normalizeRect(start.x, start.y, endX, endY)
          // Read shift from useModifierState ref (Plan 60-04) AND the event
          // itself — the ref needs a prior keydown to populate; the event
          // shiftKey is the authoritative read on this gesture. Either truthy
          // means shift-additive.
          const shiftHeld =
            modifiers.get().shift || (e as unknown as { shiftKey?: boolean }).shiftKey === true

          // No-drag branch: a click without a drag. The DESELECT for this
          // gesture is now owned by the unified canvas-deselect listener
          // (the capture-phase `pointerdown` handler installed in the
          // useEffect above — quick-260518-htt feedback-fix). It fires on
          // pointer-DOWN, covers the photo background + off-the-card region
          // that this onPointerUp branch never could, and clears `selection`
          // + `selectedTextBoxId` + custom selects + caption card + group in
          // one place. Doing it here too would double-fire onExitGroup /
          // onSelectionChange, so this branch now only resets the marquee
          // state. SEL-06 PITFALL-2.5 (shift+click = no-op) is preserved by
          // the listener's own shift guard. 2px threshold catches jitter.
          if (pixRect.w <= 2 && pixRect.h <= 2) {
            setMarqueeStart(null)
            setMarqueeEnd(null)
            return
          }

          // Drag branch: convert pixel rect to % canvas coords for
          // elementsInRect (Plan 61-01 contract: rect coords are % of
          // REF_WIDTH/REF_HEIGHT, matching CustomImage / TextBox.position).
          const pctRect = {
            x: (pixRect.x / REF_WIDTH) * 100,
            y: (pixRect.y / REF_HEIGHT) * 100,
            w: (pixRect.w / REF_WIDTH) * 100,
            h: (pixRect.h / REF_HEIGHT) * 100,
          }
          const ids = elementsInRect(slide, pctRect)

          if (shiftHeld) {
            // SEL-06 additive: union with existing. Empty marquee + shift =
            // no-op (preserves existing) per CONTEXT.md decisions.
            if (ids.length > 0) {
              onSelectionChange?.((prev: Selection) => ({
                ids: [...prev.ids, ...ids.filter((id) => !prev.ids.includes(id))],
                primary: ids[ids.length - 1],
              }))
            }
          } else {
            // SEL-05 default: replace with intersected ids (Figma default).
            // Empty marquee here also clears existing — matches Figma + spec.
            onSelectionChange?.({
              ids,
              primary: ids.length > 0 ? ids[ids.length - 1] : null,
            })
          }

          setMarqueeStart(null)
          setMarqueeEnd(null)
        }}
      >
        {/* Phase 45 layers 1-3: backgroundMode photo + tint + optional bottom-card.
            Editable branch mirror of the non-editable branch — both must emit the
            same layers per RESEARCH.md Pitfall 2 (TPLREND-05 parity contract). */}
        {useBgMode ? (
          <BackgroundLayers
            template={template}
            slide={slide}
            overlayOpacity={overlayOpacity}
            overlayColor={overlayColor}
          />
        ) : (
          /* quick-260518-8o0: legacy news <img> retired — news photo is
             full-bleed via innerStyle.backgroundImage; only the tint remains. */
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: overlayColor,
            opacity: overlayOpacity,
          }} />
        )}

        {/* quick-260517-k2n: caption card (editable branch) — rendered as an
            <Rnd> so the user drags/resizes it directly on the canvas. Sibling
            outside the useBgMode ternary => appears on every template
            (key_decision 2). The card stays VISUALLY at zIndex 2 (below text);
            only its selection chrome (resize handles) floats above via the
            handle zIndex. Drag/resize commits go through onCaptionBarUpdate
            (Task 3a) — ONE UPDATE_SLIDE per gesture => one undo entry (KBD-09). */}
        {(() => {
          // quick-260518-8o0: `isNewsLayoutSlide` passed so an unedited news
          // slide shows the seeded black caption card on the editable canvas.
          const cc = resolveCaptionBar(slide.style_overrides, template, isNewsLayoutSlide)
          if (!cc.enabled) return null
          const ccXpx = (cc.x / 100) * REF_WIDTH
          const ccYpx = (cc.y / 100) * REF_HEIGHT
          const ccWpx = (cc.width / 100) * REF_WIDTH
          const ccHpx = (cc.heightPct / 100) * REF_HEIGHT
          // Selection chrome — 8 white square handles, mirroring the decoration
          // resize chrome. zIndex 51 keeps the handles grabbable ABOVE the text
          // (text is at zIndex 10) even though the card body sits at zIndex 2.
          const ccHandleStyle: React.CSSProperties = {
            width: 8,
            height: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(0, 0, 0, 0.3)',
            borderRadius: 1,
            position: 'absolute',
            zIndex: 51,
          }
          return (
            <Rnd
              data-testid="caption-card"
              // quick-260518-htt feedback-fix: unified-deselect marker — a
              // click ON the card must NOT deselect (its own onMouseDown
              // selects it); the card already clears `captionCardSelected`
              // for non-card clicks via its onPointerDownCapture.
              data-selectable-element="true"
              position={{ x: ccXpx, y: ccYpx }}
              size={{ width: ccWpx, height: ccHpx }}
              scale={scale}
              bounds="parent"
              enableResizing={
                captionCardSelected
                  ? {
                      top: true,
                      bottom: true,
                      left: true,
                      right: true,
                      topLeft: true,
                      topRight: true,
                      bottomLeft: true,
                      bottomRight: true,
                    }
                  : false
              }
              resizeHandleStyles={{
                topLeft: { ...ccHandleStyle, top: -4, left: -4 },
                topRight: { ...ccHandleStyle, top: -4, right: -4 },
                bottomLeft: { ...ccHandleStyle, bottom: -4, left: -4 },
                bottomRight: { ...ccHandleStyle, bottom: -4, right: -4 },
                top: { ...ccHandleStyle, top: -4, left: '50%', transform: 'translateX(-50%)' },
                bottom: { ...ccHandleStyle, bottom: -4, left: '50%', transform: 'translateX(-50%)' },
                left: { ...ccHandleStyle, left: -4, top: '50%', transform: 'translateY(-50%)' },
                right: { ...ccHandleStyle, right: -4, top: '50%', transform: 'translateY(-50%)' },
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                setCaptionCardSelected(true)
              }}
              onDragStop={(_e, data) => {
                const x = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
                const y = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
                onCaptionBarUpdate?.({ caption_bar_x: x, caption_bar_y: y })
              }}
              onResizeStop={(_e, _dir, ref, _delta, position) => {
                const w = Math.max(
                  5,
                  Math.min(100, (parseInt(ref.style.width) / REF_WIDTH) * 100),
                )
                const h = Math.max(
                  10,
                  Math.min(90, (parseInt(ref.style.height) / REF_HEIGHT) * 100),
                )
                const x = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
                const y = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
                onCaptionBarUpdate?.({
                  caption_bar_width: w,
                  caption_bar_height_pct: h,
                  caption_bar_x: x,
                  caption_bar_y: y,
                })
              }}
              style={{ zIndex: 2, cursor: 'grab' }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  // quick-260518-ch8: shared helper — keeps the editable card's
                  // blend gradient identical to the non-editable layer + exports.
                  ...captionCardBackgroundStyle({
                    backgroundColor: cc.backgroundColor,
                    blendPct: cc.blendPct,
                    position: cc.position,
                  }),
                  outline: captionCardSelected ? '2px solid #3d0000' : undefined,
                  outlineOffset: 2,
                }}
              />
            </Rnd>
          )
        })()}

        {/* Phase 45 layer 4: overlay zones — same DOM order as non-editable branch. */}
        <OverlayLayers template={template} ctx={resolveCtx} />

        {/* Resizable + Draggable hook text — Phase 64 LOCK-07: skip when hook hidden */}
        {hookTextBox?.hidden !== true && (() => {
          // Phase 64 Plan 01 (LOCK-04, LOCK-06): resolve hook locked flag
          // from the canonical text_boxes mirror. disableDragging blocks
          // both mouse and touch handlers (react-rnd contract); enableResizing
          // is forced to false when locked. Both overrides are inert when
          // hookLocked is false so non-locked behavior is byte-identical to
          // pre-Plan-64. Lock-icon overlay + marquee-gated pointer-events
          // gate also live here; structurally inside editable={true} branch
          // so PARITY-01 / TPLREND-05 invariants hold (no chrome leaks to
          // Satori PNG export).
          const hookLockedBox = slide.text_boxes?.find((tb) => tb.role === 'hook')
          const hookLocked = hookLockedBox?.locked === true
          // quick-260514-l9z: in-place edit gate for hook. Mirrors the
          // editingCustomTextId pattern at the custom-text site.
          const hookEditing = !!hookLockedBox && editingHookBodyId === hookLockedBox.id
          // quick-260518-htt (HTT-01): per-element selection gate for resize
          // chrome. Handles render ONLY when this element is selected — when
          // `selection` is passed (the real editor always passes it) the
          // authoritative source is `selection.ids`; for legacy callers that
          // omit `selection` (older tests / Storybook) fall back to the
          // hook's existing single-id slot.
          const hookRndSelected = selection
            ? !!hookLockedBox && selection.ids.includes(hookLockedBox.id)
            : (hookSelected || hookEditing)
          return (
        <Rnd
          // GAP-F (82-10): the <Rnd> renders at the PADDED geometry so the
          // inner hook-text-wrapper's content box equals hookWidthPx (the
          // canonical text width shared with the read-only branch + Satori).
          position={hookRndPixels}
          size={{ width: hookRndWidthPx, height: 'auto' as unknown as number }}
          scale={scale}
          bounds="parent"
          // quick-260518-htt (HTT-01): chrome shows only when selected.
          // quick-260519-hym: a caption-card headline is card-managed (auto
          // centered + auto-fit) — not independently draggable/resizable. The
          // user moves/resizes the CARD; the headline follows.
          enableResizing={hookLocked || hookEditing || !hookRndSelected || !!captionCardHeadline ? false : enableResizing}
          disableDragging={hookLocked || hookEditing || !!captionCardHeadline}
          resizeHandleStyles={resizeHandleStyles}
          onDragStart={(_e, data) => {
            // Phase 61 Plan 02 (KBD-07): snapshot drag-start position for
            // axis-constrain. Cleared in onDragStop.
            hookDragStartRef.current = { x: data.x, y: data.y }
            // Phase 66 Plan 02 (DIFF-01): snapshot alt-state at gesture-start.
            // Reads from `modifiers.get().alt` (Plan 60-04 KBD-04 single source
            // of truth). The drag-stop branch reads this ref to decide
            // alt-duplicate vs group-drag vs per-element fan-out.
            hookAltStartRef.current = modifiers.get().alt
            // Phase 63 Plan 04 (SNAP-02..06, SNAP-09): build the snap index
            // ONCE for the gesture, excluding the dragging entity (and any
            // co-moving group/multi-select members). Reused across every
            // onDrag tick. Cleared in onDragStop.
            const hookBox = slide.text_boxes?.find((tb) => tb.role === 'hook')
            const draggedId = hookBox?.id ?? 'hook'
            snapIndexRef.current = buildSnapIndex(slide, buildExcludeIds(draggedId))
            wasSnappedXRef.current = null
            wasSnappedYRef.current = null
          }}
          onDrag={(_e, data) => {
            // Phase 61 Plan 02 (KBD-07): if Shift held, lock to dominant axis
            // BEFORE snap. Snap then refines on the FREE axis. TouchEvent has
            // no shiftKey — safe falsy fall-through (KBD-07 graceful no-op on
            // touch, mirrors Plan 59 corner-resize Shift escape pattern).
            if (hookDragStartRef.current) {
              const constrained = applyAxisConstrain(
                { x: data.x, y: data.y },
                hookDragStartRef.current,
                (_e as MouseEvent).shiftKey === true,
              )
              data.x = constrained.x
              data.y = constrained.y
            }
            // Phase 63 Plan 04 (SNAP-02..06, PERF-03): query snap-with-
            // hysteresis + update overlay in one helper. Multi-element drag
            // (SNAP-09): when the hook is part of a multi-select, query the
            // union AABB so the dragging "entity" edges include all moving
            // siblings. The query rect is the hook's box for single-element;
            // for multi-element we offset the union AABB by the drag delta.
            const hookHeight = hookRef.current?.getBoundingClientRect().height
              ? hookRef.current.getBoundingClientRect().height / scale
              : 200
            // GAP-F (82-10): `data.x` is the PADDED <Rnd> left edge (8px left of
            // the text). The snap rect must represent the headline's *text* box
            // — its width is hookWidthPx (unpadded) and its left edge is
            // data.x + HOOK_WRAPPER_PAD_X. Snapping in the text frame keeps the
            // guides aligned to the visible headline edges.
            let queryX = data.x + HOOK_WRAPPER_PAD_X
            let queryY = data.y
            let queryW = hookWidthPx
            let queryH = hookHeight
            const hookBoxForBounds = slide.text_boxes?.find((tb) => tb.role === 'hook')
            if (
              hookBoxForBounds &&
              selection &&
              selection.ids.length >= 2 &&
              selection.ids.includes(hookBoxForBounds.id)
            ) {
              const bounds = computeSelectionBounds(slide, selection.ids)
              const startRef = hookDragStartRef.current
              if (bounds && startRef) {
                const dx = data.x - startRef.x
                const dy = data.y - startRef.y
                queryX = (bounds.x / 100) * REF_WIDTH + dx
                queryY = (bounds.y / 100) * REF_HEIGHT + dy
                queryW = (bounds.width / 100) * REF_WIDTH
                queryH = (bounds.height / 100) * REF_HEIGHT
              }
            }
            const result = runSnapForDrag(queryX, queryY, queryW, queryH)
            // Translate the snap result back to this element's coords. The
            // delta from the queried union AABB to this element's coords is
            // invariant across the snap operation.
            data.x = result.x + (data.x - queryX)
            data.y = result.y + (data.y - queryY)
          }}
          onDragStop={(_e, data) => {
            // Final snap pass: react-draggable doesn't honor data.x/y mutation
            // from the onDrag callback in controlled mode (its newState is
            // built from the cursor BEFORE the callback runs), so the live
            // visual never snapped — only the guide line did. Re-running snap
            // here with the current snap index lets the COMMITTED position
            // land exactly on the snap target when the user releases within
            // the hold zone, giving the Canva/Figma "release-to-snap" feel.
            // Runs BEFORE we tear down snapIndexRef below.
            const hookHeightForStop = hookRef.current?.getBoundingClientRect().height
              ? hookRef.current.getBoundingClientRect().height / scale
              : 200
            // GAP-F (82-10): snap in the headline's TEXT frame (data.x is the
            // padded <Rnd> left edge — shift right by HOOK_WRAPPER_PAD_X to get
            // the text edge), then shift the snapped result back to the padded
            // frame so the subsequent percentX conversion stays consistent.
            const stopSnap = runSnapForDrag(data.x + HOOK_WRAPPER_PAD_X, data.y, hookWidthPx, hookHeightForStop)
            data.x = stopSnap.x - HOOK_WRAPPER_PAD_X
            data.y = stopSnap.y
            // Phase 63 Plan 04: clear snap index, overlay, and per-axis
            // hysteresis state at gesture end.
            snapIndexRef.current = null
            wasSnappedXRef.current = null
            wasSnappedYRef.current = null
            guideOverlayRef.current?.clear()
            // Phase 61 Plan 02 (KBD-07): clear drag-start ref on gesture end.
            const startRef = hookDragStartRef.current
            hookDragStartRef.current = null
            // Phase 66 Plan 02 (DIFF-01): consume alt-start snapshot.
            const altAtStart = hookAltStartRef.current
            hookAltStartRef.current = false
            const hookBox = slide.text_boxes?.find((tb) => tb.role === 'hook')
            // Phase 66 Plan 02 (DIFF-01): Alt+drag duplicate branch — runs
            // BEFORE the existing group-drag fan-out. When alt was held at
            // drag-START, dispatch onAltDuplicate with the current selection
            // (or just this element's id if single-select) and the gesture's
            // delta in % of canvas. Originals stay in place (we DO NOT call
            // onPositionChange / onGroupDrag in this branch).
            if (altAtStart && onAltDuplicate && hookBox) {
              const decision = decideAltDuplicate(
                true,
                hookBox.id,
                slide,
                selection,
                index,
              )
              if (decision.kind === 'alt-duplicate') {
                const deltaX = startRef
                  ? ((data.x - startRef.x) / REF_WIDTH) * 100
                  : 0
                const deltaY = startRef
                  ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                  : 0
                onAltDuplicate({
                  slideIndex: index,
                  ids: decision.ids,
                  deltaX,
                  deltaY,
                  newGroupId: decision.newGroupId,
                })
                return
              }
            }
            // Phase 62 (GROUP-09 / KBD-09): if this drag started a group drag,
            // dispatch BULK_TRANSLATE in ONE call via onGroupDrag. The hook's
            // groupId is on the canonical text_boxes mirror; resolve via id.
            if (hookBox && onGroupDrag && selection) {
              const groupIds = shouldGroupDrag(
                slide,
                selection,
                currentlyInsideGroup ?? null,
                hookBox.id,
              )
              if (groupIds) {
                const deltaX = startRef
                  ? ((data.x - startRef.x) / REF_WIDTH) * 100
                  : 0
                const deltaY = startRef
                  ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                  : 0
                onGroupDrag({ slideIndex: index, ids: groupIds, deltaX, deltaY })
                return
              }
            }
            if (!onPositionChange) return
            // GAP-F (82-10): data.x is the PADDED <Rnd> left edge — add back
            // HOOK_WRAPPER_PAD_X so the persisted hook_position.x is the text's
            // canvas x, byte-identical to a pre-GAP-F drag and to what the
            // read-only branch + Satori consume.
            const percentX = Math.max(0, Math.min(100, ((data.x + HOOK_WRAPPER_PAD_X) / REF_WIDTH) * 100))
            const percentY = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
            onPositionChange('hook', { x: percentX, y: percentY })
          }}
          onResizeStart={() => {
            // phase-59-01: snapshot pre-drag values for 59-02 widthRatio math.
            hookResizeStartRef.current = {
              widthPx: hookWidthPx,
              fontSize: hookFontSize,
            }
          }}
          onResizeStop={(e, dir, ref, _delta, position) => {
            // phase-59-02: branch on dir. Corner = scale font + width; side = width
            // only. Width clamp [20%,100%] is independent of the font clamp so the
            // box keeps growing past the font cap (FONTSCALE-02 forgiving past-cap).
            // phase-59-04 (RESIZE-04): Shift+corner = width-only escape. When Shift
            // is held during a corner gesture, skip the font_size dispatch and
            // behave like a side handle (matches Figma/Canva muscle memory).
            // TouchEvent has no shiftKey so this is no-op on touch.
            // GAP-F (82-10): ref.style.width is the PADDED <Rnd> box width.
            // Subtract 2*HOOK_WRAPPER_PAD_X to recover the headline's text
            // width — the canonical value that maps to persisted hook_width and
            // that scaleFontSizeOnCorner ratios against the unpadded
            // onResizeStart snapshot (hookResizeStartRef.widthPx = hookWidthPx).
            const newWidthPx = parseInt(ref.style.width) - 2 * HOOK_WRAPPER_PAD_X
            const newWidthPct = Math.max(20, Math.min(100, (newWidthPx / REF_WIDTH) * 100))
            const isCorner = isCornerDir(dir as RndDir)
            let newFontSize: number | undefined = undefined
            if (isCorner && !(e as MouseEvent).shiftKey && hookResizeStartRef.current) {
              newFontSize = scaleFontSizeOnCorner(
                hookResizeStartRef.current.fontSize,
                hookResizeStartRef.current.widthPx,
                newWidthPx,
                'hook',
              )
            }
            if (onSizeChange) {
              onSizeChange('hook', {
                width: Math.round(newWidthPct),
                ...(newFontSize !== undefined ? { font_size: newFontSize } : {}),
              })
            } else {
              // Backcompat: callers that haven't wired onSizeChange (tests, storybook).
              onWidthChange?.('hook', Math.round(newWidthPct))
            }
            if (onPositionChange) {
              // GAP-F (82-10): position.x is the PADDED <Rnd> left edge — add
              // back HOOK_WRAPPER_PAD_X so persisted hook_position.x is the
              // text's canvas x (consistent with onDragStop).
              const percentX = Math.max(0, Math.min(100, ((position.x + HOOK_WRAPPER_PAD_X) / REF_WIDTH) * 100))
              const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
              onPositionChange('hook', { x: percentX, y: percentY })
            }
            // Clear gesture snapshot — UNDO-01: ref consumed exactly once per gesture.
            hookResizeStartRef.current = null
          }}
          onMouseDown={(e) => {
            // Phase 52 (T-01): click on hook wrapper → resolve hook TextBox.id and
            // promote it as the active selection. stopPropagation() prevents the
            // canvas-background onClick from immediately clearing the selection.
            // Phase 60 (SEL-01/02/03/04): branch on e.shiftKey for additive
            // toggle vs replace. Cmd+click is a no-op in Phase 60 — the modifier
            // read is wired but deep-select-through-groups lands in Phase 62.
            e.stopPropagation()
            const hookBox = slide.text_boxes?.find((tb) => tb.role === 'hook')
            if (!hookBox) return
            if (e.shiftKey && onSelectionChange) {
              // SEL-02 / SEL-03: toggle membership without changing single-select handlers.
              // Phase 60 (MED-2 review-fix): also sync the legacy `selectedTextBoxId`
              // slot to the post-toggle primary so when N transitions 2→1 the right
              // rail's ActiveTextBoxCard renders the actually-selected element (not
              // the stale single-id slot). Compute-then-dispatch pattern mirrors
              // useSelectionModel.setSelection — avoids side-effects inside the
              // functional updater.
              onSelectionChange((s: Selection) => {
                const next: Selection = s.ids.includes(hookBox.id)
                  ? {
                      ids: s.ids.filter((x) => x !== hookBox.id),
                      primary: s.primary === hookBox.id ? null : s.primary,
                    }
                  : { ids: [...s.ids, hookBox.id], primary: hookBox.id }
                onTextBoxSelect?.(next.primary ?? next.ids[0] ?? null)
                return next
              })
              return
            }
            // Phase 62 (GROUP-10, Figma model): when the hook carries a groupId
            // AND the user is NOT inside that same group, single-click selects
            // ALL group members. When inside the group (currentlyInsideGroup
            // === hookBox.groupId), fall through to SEL-01 leaf-select so the
            // right rail shows leaf properties. The branch sits AFTER the
            // Shift-click toggle so Test C5 ordering invariant holds.
            if (
              hookBox.groupId &&
              currentlyInsideGroup !== hookBox.groupId &&
              onSelectionChange
            ) {
              const memberIds = getGroupMembers(slide, hookBox.groupId)
              if (memberIds.length >= 2) {
                onSelectionChange({ ids: memberIds, primary: hookBox.id })
                // Group selection is multi-element — clear the legacy single-id
                // slots so the right rail doesn't render stale single-element UI.
                onTextBoxSelect?.(null)
                onCustomTextSelect?.(null)
                onCustomImageSelect?.(null)
                return
              }
              // memberIds.length === 1 (orphan groupId) — fall through to SEL-01.
            }
            // SEL-01: single-click replaces (existing v2.8 behavior preserved).
            onCustomTextSelect?.(null)
            onCustomImageSelect?.(null)
            if (onTextBoxSelect) onTextBoxSelect(hookBox.id)
            onSelectionChange?.({ ids: [hookBox.id], primary: hookBox.id })
          }}
          onDoubleClick={(e: React.MouseEvent) => {
            // Phase 62 (GROUP-07) + quick-260514-l9z: double-click does ONE of
            //   A) enter the group (when hook is inside a group AND the user
            //      hasn't entered it yet) — preserves Phase 62 behavior.
            //   B) enter in-place edit mode for the hook text — Figma/Canva
            //      pattern; user types directly on the canvas instead of
            //      retyping in the right-rail panel.
            // Both pre-conditions are mutually exclusive in practice (a
            // single-member group is treated as no group). If the group-enter
            // branch fires it returns early; otherwise we fall through to
            // edit mode.
            e.stopPropagation()
            const hookBox = slide.text_boxes?.find((tb) => tb.role === 'hook')
            if (!hookBox) return
            if (hookBox.groupId && currentlyInsideGroup !== hookBox.groupId) {
              onEnterGroup?.(hookBox.id, slide)
              return
            }
            if (hookLocked) return
            if (!onTextBoxTextEdit) return
            setEditingHookBodyId(hookBox.id)
          }}
          style={{
            zIndex: 10,
            ...(hookLocked && marqueeActive ? { pointerEvents: 'none' as const } : null),
          }}
          {...(hookLocked ? { 'data-locked': 'true' as const } : {})}
          // quick-260518-htt feedback-fix: every selectable <Rnd> carries
          // this marker so the unified canvas deselect can distinguish a
          // click ON an element from a click-off (see the canvas-root
          // onPointerDownCapture below).
          data-selectable-element="true"
          // quick-260518-htt feedback-fix: the dashed selection RING is now
          // gated on the SAME `hookRndSelected` signal the resize handles
          // use (was `hookSelected`, keyed on the legacy selectedTextBoxId).
          // This keeps the ring + handles from desyncing on a click-off.
          className={`hover:outline hover:outline-2 hover:outline-white/50 ${hookRndSelected ? selectionRingClass : ''}`}
        >
          <div
            ref={hookRef}
            data-testid="hook-text-wrapper"
            style={{
              width: '100%',
              cursor: hookEditing ? 'text' : 'grab',
              padding: '4px 8px',
              borderRadius: '4px',
              textAlign: hookTextAlign,
              ...(resolved.hookEffects.highlight?.enabled && resolved.hookEffects.highlight.style === 'full'
                ? { backgroundColor: resolved.hookEffects.highlight.color, padding: `${resolved.hookEffects.highlight.padding}px` }
                : {}),
            }}
          >
            {hookLocked && (
              <div
                data-testid="lock-icon"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 12,
                  height: 12,
                  opacity: 0.6,
                  pointerEvents: 'none',
                  fontSize: 10,
                  lineHeight: 1,
                }}
                aria-hidden="true"
              >🔒</div>
            )}
            {/* quick-260514-l9z: in-place edit. When hookEditing, the inner
                div becomes a plain-text contentEditable surface; commit on
                blur via onTextBoxTextEdit. Esc also blurs (handled below).
                When NOT editing, render the rich text block (segments,
                highlight wrapper, list markers) verbatim. */}
            <div
              style={{
                ...hookTextStyle,
                lineHeight: 1.1,
                ...hookEffectCSS,
                outline: 'none',
              }}
              contentEditable={hookEditing}
              suppressContentEditableWarning={true}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (!hookEditing) return
                if (e.key === 'Escape') {
                  ;(e.currentTarget as HTMLDivElement).blur()
                }
              }}
              onBlur={(e) => {
                if (!hookEditing) return
                const newText = (e.currentTarget as HTMLDivElement).innerText
                const hookBox = slide.text_boxes?.find((tb) => tb.role === 'hook')
                if (hookBox && newText !== slide.hook_text) {
                  onTextBoxTextEdit?.(hookBox.id, newText)
                }
                setEditingHookBodyId(null)
              }}
            >
              {hookEditing
                ? slide.hook_text
                : resolved.hookEffects.highlight?.enabled && resolved.hookEffects.highlight.style === 'tight'
                  ? renderTightHighlight(slide.hook_text, slide.hook_segments, hookListType, hookListIndent, hookTextColor, hookAccentColor, resolved.hookEffects.highlight, hookTextAlign)
                  : renderTextBlock(slide.hook_text, slide.hook_segments, hookListType, hookListIndent, hookTextColor, hookAccentColor)}
            </div>
          </div>
        </Rnd>
          )
        })()}

        {/* Resizable + Draggable body text — Phase 64 LOCK-07: skip when body hidden */}
        {slide.body_text && bodyTextBox?.hidden !== true && (() => {
          // Phase 64 Plan 01 (LOCK-04, LOCK-06): same shape as hook above —
          // resolve body locked flag and gate disableDragging + enableResizing
          // + marquee-active pointer-events override + lock-icon overlay.
          const bodyLockedBox = slide.text_boxes?.find((tb) => tb.role === 'body')
          const bodyLocked = bodyLockedBox?.locked === true
          // quick-260514-l9z: in-place edit gate for body.
          const bodyEditing = !!bodyLockedBox && editingHookBodyId === bodyLockedBox.id
          // quick-260518-htt (HTT-01): per-element selection gate for resize
          // chrome — same shape as the hook site above. `selection.ids` is
          // authoritative; legacy callers fall back to the body's single-id slot.
          const bodyRndSelected = selection
            ? !!bodyLockedBox && selection.ids.includes(bodyLockedBox.id)
            : (bodySelected || bodyEditing)
          return (
          <Rnd
            position={bodyPixels}
            size={{ width: bodyWidthPx, height: 'auto' as unknown as number }}
            scale={scale}
            bounds="parent"
            // quick-260518-htt (HTT-01): chrome shows only when selected.
            enableResizing={bodyLocked || bodyEditing || !bodyRndSelected ? false : enableResizing}
            disableDragging={bodyLocked || bodyEditing}
            resizeHandleStyles={resizeHandleStyles}
            onDragStart={(_e, data) => {
              // Phase 61 Plan 02 (KBD-07): snapshot drag-start for axis-constrain.
              bodyDragStartRef.current = { x: data.x, y: data.y }
              // Phase 66 Plan 02 (DIFF-01): snapshot alt-state at gesture-start.
              bodyAltStartRef.current = modifiers.get().alt
              // Phase 63 Plan 04: build snap index for the gesture.
              const bb = slide.text_boxes?.find((tb) => tb.role === 'body')
              const draggedId = bb?.id ?? 'body'
              snapIndexRef.current = buildSnapIndex(slide, buildExcludeIds(draggedId))
              wasSnappedXRef.current = null
              wasSnappedYRef.current = null
            }}
            onDrag={(_e, data) => {
              // Phase 61 Plan 02 (KBD-07): Shift-locked axis BEFORE snap.
              if (bodyDragStartRef.current) {
                const constrained = applyAxisConstrain(
                  { x: data.x, y: data.y },
                  bodyDragStartRef.current,
                  (_e as MouseEvent).shiftKey === true,
                )
                data.x = constrained.x
                data.y = constrained.y
              }
              // Phase 63 Plan 04 — multi-element-aware snap query.
              const bodyHeight = bodyRef.current?.getBoundingClientRect().height
                ? bodyRef.current.getBoundingClientRect().height / scale
                : 200
              let queryX = data.x
              let queryY = data.y
              let queryW = bodyWidthPx
              let queryH = bodyHeight
              const bbForBounds = slide.text_boxes?.find((tb) => tb.role === 'body')
              if (
                bbForBounds &&
                selection &&
                selection.ids.length >= 2 &&
                selection.ids.includes(bbForBounds.id)
              ) {
                const bounds = computeSelectionBounds(slide, selection.ids)
                const startRef = bodyDragStartRef.current
                if (bounds && startRef) {
                  const dx = data.x - startRef.x
                  const dy = data.y - startRef.y
                  queryX = (bounds.x / 100) * REF_WIDTH + dx
                  queryY = (bounds.y / 100) * REF_HEIGHT + dy
                  queryW = (bounds.width / 100) * REF_WIDTH
                  queryH = (bounds.height / 100) * REF_HEIGHT
                }
              }
              const result = runSnapForDrag(queryX, queryY, queryW, queryH)
              data.x = result.x + (data.x - queryX)
              data.y = result.y + (data.y - queryY)
            }}
            onDragStop={(_e, data) => {
              // Final snap pass — see hook onDragStop for rationale.
              const bodyHeightForStop = bodyRef.current?.getBoundingClientRect().height
                ? bodyRef.current.getBoundingClientRect().height / scale
                : 200
              const stopSnap = runSnapForDrag(data.x, data.y, bodyWidthPx, bodyHeightForStop)
              data.x = stopSnap.x
              data.y = stopSnap.y
              // Phase 63 Plan 04: clear snap state.
              snapIndexRef.current = null
              wasSnappedXRef.current = null
              wasSnappedYRef.current = null
              guideOverlayRef.current?.clear()
              // Phase 61 Plan 02 (KBD-07): clear drag-start ref.
              const startRef = bodyDragStartRef.current
              bodyDragStartRef.current = null
              // Phase 66 Plan 02 (DIFF-01): consume alt-start snapshot.
              const altAtStart = bodyAltStartRef.current
              bodyAltStartRef.current = false
              const bodyBox = slide.text_boxes?.find((tb) => tb.role === 'body')
              // Phase 66 Plan 02 (DIFF-01): Alt+drag duplicate branch — runs
              // BEFORE the existing group-drag fan-out.
              if (altAtStart && onAltDuplicate && bodyBox) {
                const decision = decideAltDuplicate(
                  true,
                  bodyBox.id,
                  slide,
                  selection,
                  index,
                )
                if (decision.kind === 'alt-duplicate') {
                  const deltaX = startRef
                    ? ((data.x - startRef.x) / REF_WIDTH) * 100
                    : 0
                  const deltaY = startRef
                    ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                    : 0
                  onAltDuplicate({
                    slideIndex: index,
                    ids: decision.ids,
                    deltaX,
                    deltaY,
                    newGroupId: decision.newGroupId,
                  })
                  return
                }
              }
              // Phase 62 (GROUP-09 / KBD-09): group drag fan-out branch.
              if (bodyBox && onGroupDrag && selection) {
                const groupIds = shouldGroupDrag(
                  slide,
                  selection,
                  currentlyInsideGroup ?? null,
                  bodyBox.id,
                )
                if (groupIds) {
                  const deltaX = startRef
                    ? ((data.x - startRef.x) / REF_WIDTH) * 100
                    : 0
                  const deltaY = startRef
                    ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                    : 0
                  onGroupDrag({ slideIndex: index, ids: groupIds, deltaX, deltaY })
                  return
                }
              }
              if (!onPositionChange) return
              const percentX = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
              const percentY = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
              onPositionChange('body', { x: percentX, y: percentY })
            }}
            onResizeStart={() => {
              // phase-59-01: snapshot pre-drag values for 59-02 widthRatio math.
              bodyResizeStartRef.current = {
                widthPx: bodyWidthPx,
                fontSize: bodyFontSize,
              }
            }}
            onResizeStop={(e, dir, ref, _delta, position) => {
              // phase-59-02: branch on dir. Corner = scale font + width; side = width only.
              // phase-59-04 (RESIZE-04): Shift+corner = width-only escape (see hook handler above).
              const newWidthPx = parseInt(ref.style.width)
              const newWidthPct = Math.max(20, Math.min(100, (newWidthPx / REF_WIDTH) * 100))
              const isCorner = isCornerDir(dir as RndDir)
              let newFontSize: number | undefined = undefined
              if (isCorner && !(e as MouseEvent).shiftKey && bodyResizeStartRef.current) {
                newFontSize = scaleFontSizeOnCorner(
                  bodyResizeStartRef.current.fontSize,
                  bodyResizeStartRef.current.widthPx,
                  newWidthPx,
                  'body',
                )
              }
              if (onSizeChange) {
                onSizeChange('body', {
                  width: Math.round(newWidthPct),
                  ...(newFontSize !== undefined ? { font_size: newFontSize } : {}),
                })
              } else {
                onWidthChange?.('body', Math.round(newWidthPct))
              }
              if (onPositionChange) {
                const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
                const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
                onPositionChange('body', { x: percentX, y: percentY })
              }
              bodyResizeStartRef.current = null
            }}
            onMouseDown={(e) => {
              // Phase 52 (T-01): click on body wrapper → resolve body TextBox.id.
              // Same pattern as hook above.
              // Phase 60 (SEL-01/02/03): Shift-click toggles; plain click replaces.
              e.stopPropagation()
              const bodyBox = slide.text_boxes?.find((tb) => tb.role === 'body')
              if (!bodyBox) return
              if (e.shiftKey && onSelectionChange) {
                // Phase 60 (MED-2 review-fix): keep legacy single-id slot in sync
                // (see hook handler comment above for full rationale).
                onSelectionChange((s: Selection) => {
                  const next: Selection = s.ids.includes(bodyBox.id)
                    ? {
                        ids: s.ids.filter((x) => x !== bodyBox.id),
                        primary: s.primary === bodyBox.id ? null : s.primary,
                      }
                    : { ids: [...s.ids, bodyBox.id], primary: bodyBox.id }
                  onTextBoxSelect?.(next.primary ?? next.ids[0] ?? null)
                  return next
                })
                return
              }
              // Phase 62 (GROUP-10): group-aware select-all-members branch.
              // See hook handler above for the full rationale; pattern is
              // identical at all 4 wrapper sites.
              if (
                bodyBox.groupId &&
                currentlyInsideGroup !== bodyBox.groupId &&
                onSelectionChange
              ) {
                const memberIds = getGroupMembers(slide, bodyBox.groupId)
                if (memberIds.length >= 2) {
                  onSelectionChange({ ids: memberIds, primary: bodyBox.id })
                  onTextBoxSelect?.(null)
                  onCustomTextSelect?.(null)
                  onCustomImageSelect?.(null)
                  return
                }
              }
              onCustomTextSelect?.(null)
              onCustomImageSelect?.(null)
              if (onTextBoxSelect) onTextBoxSelect(bodyBox.id)
              onSelectionChange?.({ ids: [bodyBox.id], primary: bodyBox.id })
            }}
            onDoubleClick={(e: React.MouseEvent) => {
              // Phase 62 (GROUP-07) + quick-260514-l9z: enter group OR enter
              // in-place edit. Same branch logic as hook above.
              e.stopPropagation()
              const bodyBox = slide.text_boxes?.find((tb) => tb.role === 'body')
              if (!bodyBox) return
              if (bodyBox.groupId && currentlyInsideGroup !== bodyBox.groupId) {
                onEnterGroup?.(bodyBox.id, slide)
                return
              }
              if (bodyLocked) return
              if (!onTextBoxTextEdit) return
              setEditingHookBodyId(bodyBox.id)
            }}
            style={{
              zIndex: 10,
              ...(bodyLocked && marqueeActive ? { pointerEvents: 'none' as const } : null),
            }}
            {...(bodyLocked ? { 'data-locked': 'true' as const } : {})}
            // quick-260518-htt feedback-fix: unified-deselect marker.
            data-selectable-element="true"
            // quick-260518-htt feedback-fix: ring gated on bodyRndSelected
            // (the selection.ids-derived signal) so ring + handles agree.
            className={`hover:outline hover:outline-2 hover:outline-white/50 ${bodyRndSelected ? selectionRingClass : ''}`}
          >
            <div
              ref={bodyRef}
              data-testid="body-text-wrapper"
              style={{
                width: '100%',
                cursor: bodyEditing ? 'text' : 'grab',
                padding: '4px 8px',
                borderRadius: '4px',
                textAlign: bodyTextAlign,
                ...(resolved.bodyEffects.highlight?.enabled && resolved.bodyEffects.highlight.style === 'full'
                  ? { backgroundColor: resolved.bodyEffects.highlight.color, padding: `${resolved.bodyEffects.highlight.padding}px` }
                  : {}),
              }}
            >
              {bodyLocked && (
                <div
                  data-testid="lock-icon"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 12,
                    height: 12,
                    opacity: 0.6,
                    pointerEvents: 'none',
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >🔒</div>
              )}
              {/* quick-260514-l9z: in-place edit. <p> swapped to <div> so a
                  contentEditable host doesn't trigger React's hydration
                  warning about block-level descendants inside <p>. Visual
                  styles preserved. */}
              <div
                className="opacity-90"
                style={{ ...bodyTextStyle, lineHeight: 1.5, ...bodyEffectCSS, outline: 'none' }}
                contentEditable={bodyEditing}
                suppressContentEditableWarning={true}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (!bodyEditing) return
                  if (e.key === 'Escape') {
                    ;(e.currentTarget as HTMLDivElement).blur()
                  }
                }}
                onBlur={(e) => {
                  if (!bodyEditing) return
                  const newText = (e.currentTarget as HTMLDivElement).innerText
                  const bodyBox = slide.text_boxes?.find((tb) => tb.role === 'body')
                  if (bodyBox && newText !== slide.body_text) {
                    onTextBoxTextEdit?.(bodyBox.id, newText)
                  }
                  setEditingHookBodyId(null)
                }}
              >
                {bodyEditing
                  ? slide.body_text
                  : resolved.bodyEffects.highlight?.enabled && resolved.bodyEffects.highlight.style === 'tight'
                    ? renderTightHighlight(slide.body_text, slide.body_segments, bodyListType, bodyListIndent, bodyTextColor, bodyAccentColor, resolved.bodyEffects.highlight, bodyTextAlign)
                    : renderTextBlock(slide.body_text, slide.body_segments, bodyListType, bodyListIndent, bodyTextColor, bodyAccentColor)}
              </div>
            </div>
          </Rnd>
          )
        })()}

        {/* Custom text boxes — Phase 64 LOCK-07: filter when matching
            text_box mirror has hidden === true (custom_text id == text_box id
            per Phase 49 dual-write contract). */}
        {(slide.custom_texts ?? []).filter((ct) => {
          const ctBox = (slide.text_boxes ?? []).find((tb) => tb.id === ct.id)
          return ctBox?.hidden !== true
        }).map((ct) => {
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
          // Phase 64 Plan 01 (LOCK-04, LOCK-06): resolve custom-text locked
          // flag from the canonical text_boxes mirror (custom-text id ==
          // text_box id by Phase 49 adapter contract). disableDragging
          // composes with the existing isEditing override (locked OR editing
          // both block drag). enableResizing is forced to false when locked.
          const ctLockedBox = slide.text_boxes?.find((tb) => tb.id === ct.id)
          const ctLocked = ctLockedBox?.locked === true
          // quick-260518-htt (HTT-01): per-element selection gate for resize
          // chrome. `selection.ids` is authoritative; legacy callers fall back
          // to the custom-text single-id slot (selectedCustomTextId / the
          // pre-existing `isSelected` const above).
          const ctRndSelected = selection
            ? selection.ids.includes(ct.id)
            : (selectedCustomTextId === ct.id || isSelected)

          return (
            <Rnd
              key={ct.id}
              position={ctPixels}
              size={{ width: ctWidthPx, height: 'auto' as unknown as number }}
              scale={scale}
              bounds="parent"
              // quick-260518-htt (HTT-01): chrome shows only when selected.
              enableResizing={ctLocked || !ctRndSelected ? false : enableResizing}
              resizeHandleStyles={resizeHandleStyles}
              disableDragging={isEditing || ctLocked}
              onDragStart={(_e, data) => {
                setDraggingElementId(ct.id)
                // Phase 61 Plan 02 (KBD-07): snapshot drag-start for axis-constrain.
                customTextDragStartRefs.current[ct.id] = { x: data.x, y: data.y }
                // Phase 66 Plan 02 (DIFF-01): snapshot alt-state per element id.
                customTextAltStartRefs.current[ct.id] = modifiers.get().alt
                // Phase 63 Plan 04: build snap index for the gesture.
                snapIndexRef.current = buildSnapIndex(slide, buildExcludeIds(ct.id))
                wasSnappedXRef.current = null
                wasSnappedYRef.current = null
              }}
              onDrag={(_e, data) => {
                // Phase 61 Plan 02 (KBD-07): Shift-locked axis BEFORE snap.
                const dragStart = customTextDragStartRefs.current[ct.id]
                if (dragStart) {
                  const constrained = applyAxisConstrain(
                    { x: data.x, y: data.y },
                    dragStart,
                    (_e as MouseEvent).shiftKey === true,
                  )
                  data.x = constrained.x
                  data.y = constrained.y
                }
                // Phase 63 Plan 04 — multi-element-aware snap query.
                const ctHeight = customTextRefs.current[ct.id]?.getBoundingClientRect().height
                  ? customTextRefs.current[ct.id]!.getBoundingClientRect().height / scale
                  : 100
                let queryX = data.x
                let queryY = data.y
                let queryW = ctWidthPx
                let queryH = ctHeight
                if (
                  selection &&
                  selection.ids.length >= 2 &&
                  selection.ids.includes(ct.id)
                ) {
                  const bounds = computeSelectionBounds(slide, selection.ids)
                  if (bounds && dragStart) {
                    const dx = data.x - dragStart.x
                    const dy = data.y - dragStart.y
                    queryX = (bounds.x / 100) * REF_WIDTH + dx
                    queryY = (bounds.y / 100) * REF_HEIGHT + dy
                    queryW = (bounds.width / 100) * REF_WIDTH
                    queryH = (bounds.height / 100) * REF_HEIGHT
                  }
                }
                const result = runSnapForDrag(queryX, queryY, queryW, queryH)
                data.x = result.x + (data.x - queryX)
                data.y = result.y + (data.y - queryY)
              }}
              onDragStop={(_e, data) => {
                // Final snap pass — see hook onDragStop for rationale.
                const ctHeightForStop = customTextRefs.current[ct.id]?.getBoundingClientRect().height
                  ? customTextRefs.current[ct.id]!.getBoundingClientRect().height / scale
                  : 100
                const stopSnap = runSnapForDrag(data.x, data.y, ctWidthPx, ctHeightForStop)
                data.x = stopSnap.x
                data.y = stopSnap.y
                // Phase 63 Plan 04: clear snap state.
                snapIndexRef.current = null
                wasSnappedXRef.current = null
                wasSnappedYRef.current = null
                guideOverlayRef.current?.clear()
                setDraggingElementId(null)
                // Phase 61 Plan 02 (KBD-07): clear drag-start ref entry.
                const startRef = customTextDragStartRefs.current[ct.id]
                delete customTextDragStartRefs.current[ct.id]
                // Phase 66 Plan 02 (DIFF-01): consume alt-start snapshot.
                const altAtStart = customTextAltStartRefs.current[ct.id] === true
                delete customTextAltStartRefs.current[ct.id]
                // quick-260514-ksh: drop-to-delete trash zone removed; deletion
                // now happens exclusively via the LayersPanel / DecorationCard
                // delete buttons + keyboard shortcuts.
                // Phase 66 Plan 02 (DIFF-01): Alt+drag duplicate branch — runs
                // BEFORE the existing group-drag fan-out.
                if (altAtStart && onAltDuplicate) {
                  const decision = decideAltDuplicate(
                    true,
                    ct.id,
                    slide,
                    selection,
                    index,
                  )
                  if (decision.kind === 'alt-duplicate') {
                    const deltaX = startRef
                      ? ((data.x - startRef.x) / REF_WIDTH) * 100
                      : 0
                    const deltaY = startRef
                      ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                      : 0
                    onAltDuplicate({
                      slideIndex: index,
                      ids: decision.ids,
                      deltaX,
                      deltaY,
                      newGroupId: decision.newGroupId,
                    })
                    return
                  }
                }
                // Phase 62 (GROUP-09 / KBD-09): group drag fan-out branch.
                if (onGroupDrag && selection) {
                  const groupIds = shouldGroupDrag(
                    slide,
                    selection,
                    currentlyInsideGroup ?? null,
                    ct.id,
                  )
                  if (groupIds) {
                    const deltaX = startRef
                      ? ((data.x - startRef.x) / REF_WIDTH) * 100
                      : 0
                    const deltaY = startRef
                      ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                      : 0
                    onGroupDrag({ slideIndex: index, ids: groupIds, deltaX, deltaY })
                    return
                  }
                }
                const percentX = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
                const percentY = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
                onCustomTextPositionChange?.(ct.id, { x: percentX, y: percentY })
              }}
              onResizeStart={() => {
                // phase-59-01: snapshot pre-drag values per custom-text id for 59-02.
                // ct.font_size has the default 48 fallback used at the inner div style.
                customTextResizeStartRefs.current[ct.id] = {
                  widthPx: ctWidthPx,
                  fontSize: ct.font_size ?? 48,
                }
              }}
              onResizeStop={(e, dir, ref, _delta, position) => {
                // phase-59-02: branch on dir. Corner = scale font + width; side = width only.
                // Custom-text path goes through onCustomTextSizeChange so the dispatch
                // routes through UPDATE_TEXT_BOX (applyDualWrite mirrors text_boxes
                // back to legacy slide.custom_texts in the same reducer step).
                // phase-59-04 (RESIZE-04): Shift+corner = width-only escape (see hook handler above).
                const newWidthPx = parseInt(ref.style.width)
                const newWidthPct = Math.max(20, Math.min(100, (newWidthPx / REF_WIDTH) * 100))
                const isCorner = isCornerDir(dir as RndDir)
                const startSnap = customTextResizeStartRefs.current[ct.id]
                let newFontSize: number | undefined = undefined
                if (isCorner && !(e as MouseEvent).shiftKey && startSnap) {
                  newFontSize = scaleFontSizeOnCorner(
                    startSnap.fontSize,
                    startSnap.widthPx,
                    newWidthPx,
                    'custom',
                  )
                }
                if (onCustomTextSizeChange) {
                  onCustomTextSizeChange(ct.id, {
                    width: Math.round(newWidthPct),
                    ...(newFontSize !== undefined ? { font_size: newFontSize } : {}),
                  })
                } else {
                  // Backcompat for legacy callers that haven't wired the new prop.
                  onCustomTextWidthChange?.(ct.id, Math.round(newWidthPct))
                }
                const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
                const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
                onCustomTextPositionChange?.(ct.id, { x: percentX, y: percentY })
                delete customTextResizeStartRefs.current[ct.id]
              }}
              onMouseDown={(e) => {
                // Phase 52 (T-01): also dispatch unified TextBox selection so
                // the right-rail mirrors. Custom-text TextBox.id == CustomText.id
                // by Phase 49 adapter contract (text-box-adapter.ts customTextToBox).
                // Phase 60 (SEL-01/02/03): Shift-click toggles; plain click replaces.
                e.stopPropagation()
                if (e.shiftKey && onSelectionChange) {
                  // Phase 60 (MED-2 review-fix): sync the legacy `selectedTextBoxId`
                  // slot (which drives the unified ActiveTextBoxCard in the right
                  // rail) so when N transitions 2→1 the rail renders the actually-
                  // selected element, not whichever id was clicked first. We do
                  // NOT touch `selectedCustomTextId` here — the post-toggle primary
                  // may be a hook/body/image id, and that slot is custom-text-only.
                  onSelectionChange((s: Selection) => {
                    const next: Selection = s.ids.includes(ct.id)
                      ? {
                          ids: s.ids.filter((x) => x !== ct.id),
                          primary: s.primary === ct.id ? null : s.primary,
                        }
                      : { ids: [...s.ids, ct.id], primary: ct.id }
                    onTextBoxSelect?.(next.primary ?? next.ids[0] ?? null)
                    return next
                  })
                  return
                }
                // Phase 62 (GROUP-10): group-aware select-all-members branch.
                // Custom-text groupId lives on the text_boxes mirror (Phase 49
                // adapter); legacy slide.custom_texts also carries it but the
                // text_boxes entry is the canonical source of truth post-Plan
                // 60-01. Look up via slide.text_boxes to match getGroupMembers'
                // walk order.
                const ctBox = slide.text_boxes?.find((tb) => tb.id === ct.id)
                if (
                  ctBox?.groupId &&
                  currentlyInsideGroup !== ctBox.groupId &&
                  onSelectionChange
                ) {
                  const memberIds = getGroupMembers(slide, ctBox.groupId)
                  if (memberIds.length >= 2) {
                    onSelectionChange({ ids: memberIds, primary: ct.id })
                    onTextBoxSelect?.(null)
                    onCustomTextSelect?.(null)
                    onCustomImageSelect?.(null)
                    return
                  }
                }
                onCustomTextSelect?.(ct.id)
                onCustomImageSelect?.(null)
                onTextBoxSelect?.(ct.id)
                onSelectionChange?.({ ids: [ct.id], primary: ct.id })
              }}
              onDoubleClick={(e: React.MouseEvent) => {
                // Phase 62 (GROUP-07): double-click on a grouped custom_text enters the group.
                // Note: ct may also enter editing mode on double-click via
                // separate UI; the group-enter handler is non-blocking.
                e.stopPropagation()
                const ctBox = slide.text_boxes?.find((tb) => tb.id === ct.id)
                if (ctBox?.groupId) {
                  onEnterGroup?.(ct.id, slide)
                }
              }}
              style={{
                zIndex: 15,
                ...(ctLocked && marqueeActive ? { pointerEvents: 'none' as const } : null),
              }}
              {...(ctLocked ? { 'data-locked': 'true' as const } : {})}
              // quick-260518-htt feedback-fix: unified-deselect marker.
              data-selectable-element="true"
              className={`hover:outline hover:outline-2 hover:outline-white/50 ${
                // quick-260518-htt feedback-fix: the dashed selection ring is
                // now gated on `ctRndSelected` (the selection.ids-derived
                // signal the resize handles already use) instead of the
                // legacy `selectedTextBoxId === ct.id` — so a click-off that
                // clears selection.ids also drops the ring. The legacy blue
                // ring (isSelected via selectedCustomTextId) is preserved as
                // the no-`selection` fallback for tests/storybook.
                ctRndSelected
                  ? selectionRingClass
                  : isSelected
                    ? 'outline outline-2 outline-blue-400'
                    : ''
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
                {ctLocked && (
                  <div
                    data-testid="lock-icon"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 12,
                      height: 12,
                      opacity: 0.6,
                      pointerEvents: 'none',
                      fontSize: 10,
                      lineHeight: 1,
                    }}
                    aria-hidden="true"
                  >🔒</div>
                )}
                {isEditing ? ct.text : (
                  ctHighlight?.enabled && ctHighlight.style === 'tight'
                    ? renderTightHighlight(ct.text, ct.segments, ct.list_type, ct.list_indent, ctBaseColor, accentColor, ctHighlight, ct.text_align)
                    : renderTextBlock(ct.text, ct.segments, ct.list_type, ct.list_indent, ctBaseColor, accentColor)
                )}
              </div>
            </Rnd>
          )
        })}

        {/* Custom image boxes — Phase 64 LOCK-07: filter ci.hidden === true */}
        {(slide.custom_images ?? []).filter((ci) => ci.hidden !== true).map((ci) => {
          const ciPixels = {
            x: (ci.x / 100) * REF_WIDTH,
            y: (ci.y / 100) * REF_HEIGHT,
          }
          const ciWidthPx = (ci.width / 100) * REF_WIDTH
          const ciHeightPx = (ci.height / 100) * REF_HEIGHT
          const isImageSelected = selectedCustomImageId === ci.id
          // Phase 64 Plan 01 (LOCK-04, LOCK-06): same shape as the 3 text Rnd
          // sites — disableDragging blocks both mouse + touch (react-rnd
          // contract; verified in Plan 61-01 selecto integration), and
          // enableResizing is forced to false when locked. Lock-icon overlay
          // + marquee-active pointer-events override are sibling concerns
          // gated behind `editable={true}` (this whole subtree returns early
          // for editable=false at line 916).
          const ciLocked = ci.locked === true
          // quick-260518-htt (HTT-01): per-element selection gate for resize
          // chrome. `selection.ids` is authoritative; legacy callers fall back
          // to the custom-image single-id slot (`isImageSelected` above).
          const ciRndSelected = selection
            ? selection.ids.includes(ci.id)
            : isImageSelected

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
              disableDragging={ciLocked}
              // quick-260518-htt (HTT-01): chrome shows only when selected.
              enableResizing={ciLocked || !ciRndSelected ? false : {
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
              onDragStart={(_e, data) => {
                setDraggingElementId(ci.id)
                // Phase 61 Plan 02 (KBD-07): snapshot drag-start for axis-constrain.
                customImageDragStartRefs.current[ci.id] = { x: data.x, y: data.y }
                // Phase 66 Plan 02 (DIFF-01): snapshot alt-state per element id.
                customImageAltStartRefs.current[ci.id] = modifiers.get().alt
                // Phase 63 Plan 04: build snap index for the gesture.
                snapIndexRef.current = buildSnapIndex(slide, buildExcludeIds(ci.id))
                wasSnappedXRef.current = null
                wasSnappedYRef.current = null
              }}
              onDrag={(_e, data) => {
                // Phase 61 Plan 02 (KBD-07): Shift-locked axis BEFORE snap.
                const dragStart = customImageDragStartRefs.current[ci.id]
                if (dragStart) {
                  const constrained = applyAxisConstrain(
                    { x: data.x, y: data.y },
                    dragStart,
                    (_e as MouseEvent).shiftKey === true,
                  )
                  data.x = constrained.x
                  data.y = constrained.y
                }
                // Phase 63 Plan 04 — multi-element-aware snap query.
                let queryX = data.x
                let queryY = data.y
                let queryW = ciWidthPx
                let queryH = ciHeightPx
                if (
                  selection &&
                  selection.ids.length >= 2 &&
                  selection.ids.includes(ci.id)
                ) {
                  const bounds = computeSelectionBounds(slide, selection.ids)
                  if (bounds && dragStart) {
                    const dx = data.x - dragStart.x
                    const dy = data.y - dragStart.y
                    queryX = (bounds.x / 100) * REF_WIDTH + dx
                    queryY = (bounds.y / 100) * REF_HEIGHT + dy
                    queryW = (bounds.width / 100) * REF_WIDTH
                    queryH = (bounds.height / 100) * REF_HEIGHT
                  }
                }
                const result = runSnapForDrag(queryX, queryY, queryW, queryH)
                data.x = result.x + (data.x - queryX)
                data.y = result.y + (data.y - queryY)
              }}
              onDragStop={(_e, data) => {
                // Final snap pass — see hook onDragStop for rationale.
                const stopSnap = runSnapForDrag(data.x, data.y, ciWidthPx, ciHeightPx)
                data.x = stopSnap.x
                data.y = stopSnap.y
                // Phase 63 Plan 04: clear snap state.
                snapIndexRef.current = null
                wasSnappedXRef.current = null
                wasSnappedYRef.current = null
                guideOverlayRef.current?.clear()
                setDraggingElementId(null)
                // Phase 61 Plan 02 (KBD-07): clear drag-start ref entry.
                const startRef = customImageDragStartRefs.current[ci.id]
                delete customImageDragStartRefs.current[ci.id]
                // Phase 66 Plan 02 (DIFF-01): consume alt-start snapshot.
                const altAtStart = customImageAltStartRefs.current[ci.id] === true
                delete customImageAltStartRefs.current[ci.id]
                // quick-260514-ksh: drop-to-delete trash zone removed; deletion
                // now happens via the LayersPanel / image-action buttons +
                // keyboard shortcuts.
                // Phase 66 Plan 02 (DIFF-01): Alt+drag duplicate branch — runs
                // BEFORE the existing group-drag fan-out.
                if (altAtStart && onAltDuplicate) {
                  const decision = decideAltDuplicate(
                    true,
                    ci.id,
                    slide,
                    selection,
                    index,
                  )
                  if (decision.kind === 'alt-duplicate') {
                    const deltaX = startRef
                      ? ((data.x - startRef.x) / REF_WIDTH) * 100
                      : 0
                    const deltaY = startRef
                      ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                      : 0
                    onAltDuplicate({
                      slideIndex: index,
                      ids: decision.ids,
                      deltaX,
                      deltaY,
                      newGroupId: decision.newGroupId,
                    })
                    return
                  }
                }
                // Phase 62 (GROUP-09 / KBD-09): group drag fan-out branch.
                if (onGroupDrag && selection) {
                  const groupIds = shouldGroupDrag(
                    slide,
                    selection,
                    currentlyInsideGroup ?? null,
                    ci.id,
                  )
                  if (groupIds) {
                    const deltaX = startRef
                      ? ((data.x - startRef.x) / REF_WIDTH) * 100
                      : 0
                    const deltaY = startRef
                      ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                      : 0
                    onGroupDrag({ slideIndex: index, ids: groupIds, deltaX, deltaY })
                    return
                  }
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
                // Phase 60 (SEL-01/02/03): Shift-click toggles; plain click replaces.
                e.stopPropagation()
                if (e.shiftKey && onSelectionChange) {
                  // Phase 60 (MED-2 review-fix): keep legacy `selectedTextBoxId`
                  // in sync so the right rail's ActiveTextBoxCard tracks correctly
                  // on N=2→1 transitions. We do NOT touch `selectedCustomImageId`
                  // because the post-toggle primary may not be a custom-image id.
                  onSelectionChange((s: Selection) => {
                    const next: Selection = s.ids.includes(ci.id)
                      ? {
                          ids: s.ids.filter((x) => x !== ci.id),
                          primary: s.primary === ci.id ? null : s.primary,
                        }
                      : { ids: [...s.ids, ci.id], primary: ci.id }
                    onTextBoxSelect?.(next.primary ?? next.ids[0] ?? null)
                    return next
                  })
                  return
                }
                // Phase 62 (GROUP-10): group-aware select-all-members branch.
                if (
                  ci.groupId &&
                  currentlyInsideGroup !== ci.groupId &&
                  onSelectionChange
                ) {
                  const memberIds = getGroupMembers(slide, ci.groupId)
                  if (memberIds.length >= 2) {
                    onSelectionChange({ ids: memberIds, primary: ci.id })
                    onTextBoxSelect?.(null)
                    onCustomTextSelect?.(null)
                    onCustomImageSelect?.(null)
                    return
                  }
                }
                onCustomImageSelect?.(ci.id)
                onCustomTextSelect?.(null)
                onSelectionChange?.({ ids: [ci.id], primary: ci.id })
              }}
              onDoubleClick={(e: React.MouseEvent) => {
                // Phase 62 (GROUP-07): double-click on a grouped custom_image enters the group.
                e.stopPropagation()
                if (ci.groupId) {
                  onEnterGroup?.(ci.id, slide)
                }
              }}
              style={{
                zIndex: 12,
                ...(ciLocked && marqueeActive ? { pointerEvents: 'none' as const } : null),
              }}
              {...(ciLocked ? { 'data-locked': 'true' as const } : {})}
              // quick-260518-htt feedback-fix: unified-deselect marker.
              data-selectable-element="true"
              className={`hover:outline hover:outline-2 hover:outline-white/50 ${
                isImageSelected ? 'outline outline-2 outline-blue-400' : ''
              }`}
            >
              {ciLocked && (
                <div
                  data-testid="lock-icon"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 12,
                    height: 12,
                    opacity: 0.6,
                    pointerEvents: 'none',
                    fontSize: 10,
                    lineHeight: 1,
                    zIndex: 1,
                  }}
                  aria-hidden="true"
                >🔒</div>
              )}
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

        {/* Phase 67 (DECOR-01) layer 5.5: decoration iteration site (editable view).
            Symmetric with the non-editable path + render-slide-satori. The
            editable rendering of decorations (selection chrome, Rnd wrapper,
            handles) is owned by Phase 70+; Phase 69 Plan 02 wires the renderer
            body identically across both render paths.
            Phase 69 Plan 02: renderer body now invokes renderDecoration; layer 5.5
            placement preserved (between custom_images at 5.0 and watermark at 6.0).
            Phase 70 Plan 04 (EDITOR-14): emit a click-target overlay per
            non-hidden decoration. Clicking the overlay dispatches
            selection.replaceWith([d.id]) (or addToSelection on Shift-click).
            The overlay sits at the SAME position as the rendered decoration
            and inherits the same rotation transform so hit-testing matches
            the visual. PCL11 invariant: this overlay only enters the
            editable={true} branch — Satori path + non-editable preview path
            are NEVER touched. */}
        {(slide.decorations ?? [])
          .filter((d) => d.hidden !== true)
          .map((d) => {
            const node = renderDecoration(d, {
              slideIndex: resolveCtx.slideIndex,
              totalSlides: resolveCtx.totalSlides,
              target: 'browser',
            })
            // Phase 72 Plan 02 (ROTATE-02): per-tick local preview during
            // rotation-handle drag overrides the committed rotation. After
            // pointerup the dispatch lands and the reducer-driven re-render
            // clears the preview entry — visual remains continuous.
            const previewRotation = localRotationPreviews[d.id]
            const effectiveRotation =
              typeof previewRotation === 'number' ? previewRotation : d.rotation
            const rotated =
              typeof effectiveRotation === 'number' && effectiveRotation !== 0
                ? { transform: `rotate(${effectiveRotation}deg)` }
                : null
            // Phase 72 Plan 02 (ROTATE-02): rotation handle is editable={true}-
            // gated chrome (TPLREND-05 / PARITY-01 carry-forward — never reaches
            // Satori PNG export or non-editable preview). Render only when:
            //   - this decoration is the selection.primary
            //   - !d.locked  (LOCK-04 carry-forward)
            //   - !d.hidden  (LOCK-07 carry-forward; hidden filter above already
            //                 excludes; included here for contract clarity)
            //   - onDecorationRotate prop is wired (keeps testid out of legacy
            //     callers / Storybook stories that haven't wired the new prop)
            const showRotationHandle =
              !!onDecorationRotate &&
              !!selection &&
              selection.primary === d.id &&
              d.locked !== true &&
              d.hidden !== true
            // quick-260514-kct: % → px for the Rnd wrapper (REF_WIDTH × REF_HEIGHT
            // reference frame; Rnd scales the gesture via `scale={scale}`).
            const dxPx = (d.position.x / 100) * REF_WIDTH
            const dyPx = (d.position.y / 100) * REF_HEIGHT
            const dwPx = (d.position.width / 100) * REF_WIDTH
            const dhPx = (d.position.height / 100) * REF_HEIGHT
            // quick-260515-k54: 8-handle resize chrome. Identical to the
            // custom-image `imageResizeHandleStyle`. Editable-only chrome —
            // never reaches Satori / non-editable render paths (TPLREND-05).
            const decorationResizeHandleStyle: React.CSSProperties = {
              width: 8,
              height: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(0, 0, 0, 0.3)',
              borderRadius: 1,
              position: 'absolute',
            }
            // quick-260518-htt (HTT-01): per-element selection gate for resize
            // chrome. Decorations have no legacy single-id slot, so the
            // no-`selection` legacy path simply resolves false (acceptable —
            // the real editor always passes `selection`).
            const dRndSelected = selection
              ? selection.ids.includes(d.id)
              : false
            return (
              <React.Fragment key={d.id}>
                <Rnd
                  key={`${d.id}-rnd`}
                  data-testid={`decoration-click-target-${d.id}`}
                  // quick-260518-htt feedback-fix: unified-deselect marker.
                  data-selectable-element="true"
                  position={{ x: dxPx, y: dyPx }}
                  size={{ width: dwPx, height: dhPx }}
                  scale={scale}
                  bounds="parent"
                  disableDragging={d.locked === true}
                  // quick-260515-k54: icons aspect-lock (a stretched icon
                  // looks broken); shapes resize free (a rect/line legitimately
                  // stretches). Locked decoration UX decision — NOT Shift-gated.
                  lockAspectRatio={d.kind === 'icon'}
                  // quick-260515-k54: 8-handle resize for non-locked
                  // decorations; locked decorations keep no handles (LOCK-04).
                  // quick-260518-htt (HTT-01): chrome shows only when selected.
                  enableResizing={d.locked === true || !dRndSelected ? false : {
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
                    topLeft: { ...decorationResizeHandleStyle, top: -4, left: -4 },
                    topRight: { ...decorationResizeHandleStyle, top: -4, right: -4 },
                    bottomLeft: { ...decorationResizeHandleStyle, bottom: -4, left: -4 },
                    bottomRight: { ...decorationResizeHandleStyle, bottom: -4, right: -4 },
                    top: { ...decorationResizeHandleStyle, top: -4, left: '50%', transform: 'translateX(-50%)' },
                    bottom: { ...decorationResizeHandleStyle, bottom: -4, left: '50%', transform: 'translateX(-50%)' },
                    left: { ...decorationResizeHandleStyle, left: -4, top: '50%', transform: 'translateY(-50%)' },
                    right: { ...decorationResizeHandleStyle, right: -4, top: '50%', transform: 'translateY(-50%)' },
                  }}
                  onDragStart={(_e, data) => {
                    setDraggingElementId(d.id)
                    decorationDragStartRefs.current[d.id] = { x: data.x, y: data.y }
                    // quick-260515-k54: build the snap index for this gesture
                    // (mirrors the custom-image onDragStart).
                    snapIndexRef.current = buildSnapIndex(slide, buildExcludeIds(d.id))
                    wasSnappedXRef.current = null
                    wasSnappedYRef.current = null
                  }}
                  onDrag={(_e, data) => {
                    // quick-260515-k54: Shift-locked axis BEFORE snap (mirrors
                    // the custom-image onDrag). decorationDragStartRefs is the
                    // drag-start snapshot — reuse it for axis-constrain.
                    const dragStart = decorationDragStartRefs.current[d.id]
                    if (dragStart) {
                      const constrained = applyAxisConstrain(
                        { x: data.x, y: data.y },
                        dragStart,
                        (_e as MouseEvent).shiftKey === true,
                      )
                      data.x = constrained.x
                      data.y = constrained.y
                    }
                    // Multi-element-aware snap query (mirrors custom-image).
                    let queryX = data.x
                    let queryY = data.y
                    let queryW = dwPx
                    let queryH = dhPx
                    if (
                      selection &&
                      selection.ids.length >= 2 &&
                      selection.ids.includes(d.id)
                    ) {
                      const bounds = computeSelectionBounds(slide, selection.ids)
                      if (bounds && dragStart) {
                        const dx = data.x - dragStart.x
                        const dy = data.y - dragStart.y
                        queryX = (bounds.x / 100) * REF_WIDTH + dx
                        queryY = (bounds.y / 100) * REF_HEIGHT + dy
                        queryW = (bounds.width / 100) * REF_WIDTH
                        queryH = (bounds.height / 100) * REF_HEIGHT
                      }
                    }
                    const result = runSnapForDrag(queryX, queryY, queryW, queryH)
                    data.x = result.x + (data.x - queryX)
                    data.y = result.y + (data.y - queryY)
                  }}
                  onDragStop={(_e, data) => {
                    setDraggingElementId(null)
                    // quick-260515-k54: final snap pass before the commit.
                    const stopSnap = runSnapForDrag(data.x, data.y, dwPx, dhPx)
                    data.x = stopSnap.x
                    data.y = stopSnap.y
                    // quick-260515-k54: clear snap state + guide overlay.
                    snapIndexRef.current = null
                    wasSnappedXRef.current = null
                    wasSnappedYRef.current = null
                    guideOverlayRef.current?.clear()
                    const startRef = decorationDragStartRefs.current[d.id]
                    delete decorationDragStartRefs.current[d.id]
                    // Group drag fan-out — BULK_TRANSLATE handles decorations
                    // since Phase 68 Plan 02. Mirrors custom-image branch at
                    // ~line 2560.
                    if (onGroupDrag && selection) {
                      const groupIds = shouldGroupDrag(
                        slide,
                        selection,
                        currentlyInsideGroup ?? null,
                        d.id,
                      )
                      if (groupIds) {
                        const deltaX = startRef
                          ? ((data.x - startRef.x) / REF_WIDTH) * 100
                          : 0
                        const deltaY = startRef
                          ? ((data.y - startRef.y) / REF_HEIGHT) * 100
                          : 0
                        onGroupDrag({
                          slideIndex: index,
                          ids: groupIds,
                          deltaX,
                          deltaY,
                        })
                        return
                      }
                    }
                    // Single-element commit via UPDATE_DECORATION.
                    const x = Math.max(0, Math.min(100, (data.x / REF_WIDTH) * 100))
                    const y = Math.max(0, Math.min(100, (data.y / REF_HEIGHT) * 100))
                    onDecorationPositionChange?.(d.id, { x, y })
                  }}
                  onResizeStop={(_e, _dir, ref, _delta, position) => {
                    // quick-260515-k54: commit new size + position ONCE per
                    // gesture (no per-tick onResize — one undo step, PERF-01).
                    // Mirrors the custom-image onResizeStop.
                    const newWidthPct = Math.max(5, Math.min(100, (parseInt(ref.style.width) / REF_WIDTH) * 100))
                    const newHeightPct = Math.max(5, Math.min(100, (parseInt(ref.style.height) / REF_HEIGHT) * 100))
                    onDecorationSizeChange?.(d.id, { width: Math.round(newWidthPct), height: Math.round(newHeightPct) })
                    const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
                    const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
                    onDecorationPositionChange?.(d.id, { x: percentX, y: percentY })
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    if (e.shiftKey && onSelectionChange) {
                      onSelectionChange((prev: Selection) => {
                        if (prev.ids.includes(d.id)) {
                          return { ids: prev.ids, primary: d.id }
                        }
                        return { ids: [...prev.ids, d.id], primary: d.id }
                      })
                      return
                    }
                    onSelectionChange?.({ ids: [d.id], primary: d.id })
                  }}
                  style={{
                    zIndex: 13,
                    cursor: d.locked === true ? 'default' : 'grab',
                  }}
                >
                  {/* Inner rotation wrapper. Rnd's outer style is reserved for
                      react-draggable's `transform: translate(x,y)` positioning —
                      applying `transform: rotate(...)` there would clobber it.
                      Rotation goes on this inner wrapper instead. The cloned
                      decoration also carries its own baked-in rotation (from the
                      renderer's style), so the inner wrapper's transform wins
                      via spread order — letting the per-tick rotation preview
                      take precedence over the committed value. */}
                  <div
                    data-testid={`decoration-visual-wrap-${d.id}`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      ...(rotated ?? {}),
                    }}
                  >
                    {(() => {
                      if (!React.isValidElement(node)) return null
                      const el = node as React.ReactElement<{ style?: React.CSSProperties }>
                      return React.cloneElement(el, {
                        key: `${d.id}-render`,
                        style: {
                          ...(el.props.style ?? {}),
                          left: 0,
                          top: 0,
                          width: '100%',
                          height: '100%',
                          pointerEvents: 'none',
                        },
                      })
                    })()}
                  </div>
                </Rnd>
                {showRotationHandle && (
                  <DecorationRotationHandle
                    key={`${d.id}-rotate`}
                    decorationBounds={d.position}
                    containerRef={containerRef}
                    currentRotation={
                      typeof d.rotation === 'number' ? d.rotation : 0
                    }
                    visible={true}
                    offsetPx={20}
                    onPreview={(rotation) => {
                      setLocalRotationPreviews((prev) => ({
                        ...prev,
                        [d.id]: rotation,
                      }))
                    }}
                    onCommit={(rotation) => {
                      onDecorationRotate?.({
                        slideIndex: resolveCtx.slideIndex,
                        ids: [d.id],
                        rotation,
                      })
                      setLocalRotationPreviews((prev) => {
                        if (!(d.id in prev)) return prev
                        const next = { ...prev }
                        delete next[d.id]
                        return next
                      })
                    }}
                  />
                )}
              </React.Fragment>
            )
          })}

        {/* Brand watermark (editable view) — non-interactive, sits above custom images.
            Phase 64 LOCK-07: gate render on slide.watermark.hidden so a hidden
            watermark suppresses the legacy resolver path identically to the
            non-editable branch + render-slide-satori. */}
        {(() => {
          if (slide.watermark?.hidden === true) return null
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
          const fw = resolveForcedWatermark(userTier, { width: REF_WIDTH, height: REF_HEIGHT }, slide)
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

        {/* quick-260514-ksh: drag-to-delete trash zone removed per user
            request. Deletion routes via LayersPanel + DecorationCard delete
            buttons + keyboard shortcuts (Backspace / Cmd-Delete). */}

        {/* Phase 63 Plan 04 (SNAP-02..06, SNAP-09, DIFF-03, PERF-03):
            smart-guide overlay. Persistent pool of guide-line + equal-
            spacing-segment <div>s; positions update via direct ref.style
            mutation (translate3d) — NO React state per pointer-move
            (PERF-03). Coords are REF px and live INSIDE the scaled canvas
            wrapper so they align at every zoom level (SNAP-06 + PITFALL-5.3).

            STRICTLY editable-only — sits downstream of the line-790
            editable={false} early return; PARITY-01 + slide-preview-smart-
            guides.test.tsx SP7/SP10 pin the structural gate.

            Replaces the legacy {activeGuides.map(...)} JSX from the
            alignment-guides hook (Phase 63 D-09 retains the file for Phase
            66 cleanup; the import is gone — see Plan 63-04 SUMMARY). */}
        <SmartGuideOverlay ref={guideOverlayRef} />

        {/* Phase 60 (SEL-13, PARITY-01): union-AABB multi-select ring.
            STRICTLY editable-only — this block lives inside the editable={true}
            render path (the entire editable branch starts ~line 880 and the
            non-editable branch returned early at line 651). The PARITY-01 test
            in src/lib/render/__tests__/parity.test.tsx asserts the testid is
            absent from the editable={false} render tree.
            pointer-events:none ensures clicks pass through to the elements.
            Phase 63 Plan 02 (ALIGN-07): the FloatingAlignmentToolbar below
            consumes the SAME computeSelectionBounds output — both walk the
            slide once via the pure helper. Reusing the AABB across the two
            chrome surfaces keeps a single source of truth and avoids drift
            (per Phase 63 D-04 — bounds reused across the ring + toolbar). */}
        {selection && selection.ids.length >= 2 && (() => {
          const aabb = computeSelectionBounds(slide, selection.ids)
          if (!aabb) return null
          return (
            <>
              <div
                data-testid="multi-selection-ring"
                style={{
                  position: 'absolute',
                  left: `${aabb.x}%`,
                  top: `${aabb.y}%`,
                  width: `${aabb.width}%`,
                  height: `${aabb.height}%`,
                  outline: '2px dashed #3d0000',
                  outlineOffset: 4,
                  pointerEvents: 'none',
                  zIndex: 50,
                }}
              />
              {/* Phase 63 Plan 02 (ALIGN-07): floating alignment toolbar.
                  Mounted as a sibling of the multi-selection-ring above so
                  both consume the same AABB. The toolbar manages its own
                  render gate (selectionCount < 2 → null) but we additionally
                  guard on `onAlign` here so the testid stays out of legacy
                  callers (e.g. tests / stories that haven't wired onAlign).
                  TPLREND-05 / PARITY-01: structurally inside the editable=
                  true branch — line-665 early return for editable=false
                  guarantees this JSX is unreachable from the Satori path. */}
              {onAlign && (
                <FloatingAlignmentToolbar
                  selectionCount={selection.ids.length}
                  bounds={aabb}
                  onAction={onAlign as (a: ToolbarAction) => void}
                  canvasWidthPct={100}
                  canvasHeightPct={100}
                />
              )}
            </>
          )
        })()}

        {/* Phase 62 (GROUP-06): dashed/dotted group bounding-box ring.
            STRICTLY editable-only — sibling of the multi-selection-ring above,
            structurally gated by the line-728 early non-editable return so the
            data-testid="group-bounding-ring" is unreachable from the Satori
            export branch (TPLREND-05 / PARITY-01 carry-forward).
            Renders when ANY selected element has a groupId AND that group has
            >=2 members. PLAN locked-decision: ring shows on partial-selection
            of a group (single-member-of-group highlights the whole AABB) so
            the user gets immediate "you have hit a grouped element" feedback
            even before Plan 62-03's Cmd+G dispatcher expands selection.
            Visual distinction:
              - currentlyInsideGroup === group.id → solid border (entered)
              - otherwise                          → dotted border (not entered)
            outlineOffset 6 (vs the 4 used by multi-selection-ring) and zIndex 51
            (vs 50) mean a group ring nests cleanly outside any concurrent
            multi-selection-ring without z-fighting.
            pointer-events: none lets the ring sit above element wrappers
            without swallowing their onMouseDown / Rnd drag handles. */}
        {(() => {
          if (!selection || selection.ids.length === 0) return null
          // Find the FIRST selected element with a groupId — that's the group
          // we're visualizing. Multi-group multi-select edge case: the schema
          // is flat and we render ONE ring; the first matching groupId wins.
          // Phase 65 (layers panel) may revisit if users routinely combine 2+
          // groups in a single multi-selection.
          const allElements: Array<{ id: string; groupId?: string }> = [
            ...(slide.text_boxes ?? []),
            ...(slide.custom_images ?? []),
            ...(slide.watermark ? [slide.watermark] : []),
          ]
          const firstSelected = allElements.find(
            (el) => selection.ids.includes(el.id) && el.groupId,
          )
          if (!firstSelected || !firstSelected.groupId) return null
          const memberIds = getGroupMembers(slide, firstSelected.groupId)
          if (memberIds.length < 2) return null // orphan groupId — not really a group
          const aabb = computeSelectionBounds(slide, memberIds)
          if (!aabb) return null
          const entered = currentlyInsideGroup === firstSelected.groupId
          return (
            <div
              data-testid="group-bounding-ring"
              data-group-id={firstSelected.groupId}
              data-entered={entered ? 'true' : 'false'}
              style={{
                position: 'absolute',
                left: `${aabb.x}%`,
                top: `${aabb.y}%`,
                width: `${aabb.width}%`,
                height: `${aabb.height}%`,
                outline: entered ? '2px solid #3d0000' : '2px dotted #3d0000',
                outlineOffset: 6,
                pointerEvents: 'none',
                zIndex: 51,
              }}
            />
          )
        })()}

        {/* Phase 61 Plan 02 (SEL-05, PARITY-01): marquee overlay — render-only,
            structurally gated by the editable={true} branch via the line-665
            early return upstream. Coords are scaled-canvas pixels; the overlay
            sits inside the same scaled wrapper as elements (PITFALL-5.3).
            MarqueeOverlay returns null when rect is null (IDLE state). The
            parity test (PARITY-01 marquee gate) asserts the testid is absent
            in editable={false} render trees. */}
        <MarqueeOverlay rect={marqueeRect} />
      </div>
    </div>
  )
}
