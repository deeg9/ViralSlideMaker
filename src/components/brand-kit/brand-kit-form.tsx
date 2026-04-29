'use client'

import { useState, useRef } from 'react'
import type { BrandKit, LogoPosition, BrandKitTextAlign, BrandKitTextPosition, BrandKitHookStyle } from '@/lib/types/brand-kit'
import { saveBrandKit, uploadLogo, extractStyleFromImage } from '@/app/(dashboard)/settings/brand-kit/actions'
import { SlidePreview } from '@/components/slides/slide-preview'
import { synthesizeBrandKitTemplate } from '@/lib/brand-kit/get-effective-template'
import type { Slide } from '@/lib/types/slide'

const FONT_OPTIONS = [
  'Inter',
  'Playfair Display',
  'Montserrat',
  'Roboto',
  'Lato',
  'Open Sans',
  'Poppins',
  'Raleway',
  'Oswald',
  'Merriweather',
  'Nunito',
  'Source Sans Pro',
  'PT Sans',
  'Ubuntu',
  'Bebas Neue',
]

const TEXT_ALIGN_OPTIONS: BrandKitTextAlign[] = ['left', 'center', 'right']
const TEXT_POSITION_OPTIONS: BrandKitTextPosition[] = ['top', 'center', 'bottom']
const HOOK_STYLE_OPTIONS: BrandKitHookStyle[] = ['uppercase', 'normal', 'italic']

const POSITION_GRID: LogoPosition[][] = [
  ['top-left', 'top-center', 'top-right'],
  ['middle-left', 'middle-center', 'middle-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
]

// Mirrors the renderer math in resolve-watermark.ts so the preview matches reality.
function computePreviewBox(
  pos: LogoPosition,
  sizePct: number,
  canvasW: number,
  canvasH: number
): { left: number; top: number; width: number; height: number } {
  const margin = canvasW * 0.04
  const width = canvasW * (sizePct / 100)
  const height = width // square approximation for placement bounds
  const [vBand, hBand] = pos.split('-') as [
    'top' | 'middle' | 'bottom',
    'left' | 'center' | 'right',
  ]
  const left =
    hBand === 'left' ? margin : hBand === 'center' ? (canvasW - width) / 2 : canvasW - margin - width
  const top =
    vBand === 'top' ? margin : vBand === 'middle' ? (canvasH - height) / 2 : canvasH - margin - height
  return { left, top, width, height }
}

export function BrandKitForm({ brandKit }: { brandKit: BrandKit | null }) {
  const [name, setName] = useState(brandKit?.name ?? 'My Brand')
  const [primaryColor, setPrimaryColor] = useState(brandKit?.primary_color ?? '#000000')
  const [secondaryColor, setSecondaryColor] = useState(brandKit?.secondary_color ?? '#ffffff')
  const [textColor, setTextColor] = useState(brandKit?.text_color ?? '#ffffff')
  const [backgroundColor, setBackgroundColor] = useState(brandKit?.background_color ?? '#1a1a2e')
  const [accentColor, setAccentColor] = useState(brandKit?.accent_color ?? '#ff3b30')
  const [fontFamily, setFontFamily] = useState(brandKit?.font_family ?? 'Inter')
  const [headingFontFamily, setHeadingFontFamily] = useState(
    brandKit?.heading_font_family ?? brandKit?.font_family ?? 'Inter',
  )
  const [bodyFontFamily, setBodyFontFamily] = useState(
    brandKit?.body_font_family ?? brandKit?.font_family ?? 'Inter',
  )
  const [textAlign, setTextAlign] = useState<BrandKitTextAlign>(brandKit?.text_align ?? 'center')
  const [textPosition, setTextPosition] = useState<BrandKitTextPosition>(brandKit?.text_position ?? 'center')
  const [hookStyle, setHookStyle] = useState<BrandKitHookStyle>(brandKit?.hook_style ?? 'uppercase')
  const [overlayOpacityPct, setOverlayOpacityPct] = useState<number>(brandKit?.overlay_opacity_pct ?? 0)
  const [logoUrl, setLogoUrl] = useState(brandKit?.logo_url ?? '')
  // Watermark state — null position means "no watermark on any slide".
  const [logoPosition, setLogoPosition] = useState<LogoPosition | null>(brandKit?.logo_position ?? null)
  const [logoSizePct, setLogoSizePct] = useState<number>(brandKit?.logo_size_pct ?? 10)
  const [logoOpacityPct, setLogoOpacityPct] = useState<number>(brandKit?.logo_opacity_pct ?? 60)
  const [hideWatermarkAll, setHideWatermarkAll] = useState<boolean>(brandKit?.logo_position == null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Style-extraction state (260428-sty)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractConfidence, setExtractConfidence] = useState<{
    fonts: number
    colors: number
    layout: number
  } | null>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMessage('')

    const formData = new FormData()
    formData.set('name', name)
    formData.set('primary_color', primaryColor)
    formData.set('secondary_color', secondaryColor)
    formData.set('text_color', textColor)
    formData.set('background_color', backgroundColor)
    formData.set('accent_color', accentColor)
    formData.set('font_family', bodyFontFamily) // legacy field — keep in sync with body
    formData.set('heading_font_family', headingFontFamily)
    formData.set('body_font_family', bodyFontFamily)
    formData.set('text_align', textAlign)
    formData.set('text_position', textPosition)
    formData.set('hook_style', hookStyle)
    formData.set('overlay_opacity_pct', String(overlayOpacityPct))
    formData.set('logo_url', logoUrl)
    // Watermark — when "hide on all" is checked OR no logo, persist null position.
    const effectivePosition = hideWatermarkAll || !logoUrl ? '' : (logoPosition ?? '')
    formData.set('logo_position', effectivePosition)
    formData.set('logo_size_pct', String(logoSizePct))
    formData.set('logo_opacity_pct', String(logoOpacityPct))

    const result = await saveBrandKit(formData)
    if (result.success) {
      setStatus('success')
      setTimeout(() => setStatus('idle'), 2000)
    } else {
      setStatus('error')
      setErrorMessage(result.error)
    }
  }

  async function handleReferenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setExtracting(true)
    setExtractError(null)
    setExtractConfidence(null)

    try {
      const formData = new FormData()
      formData.set('file', file)
      const result = await extractStyleFromImage(formData)
      if (!result.success) {
        setExtractError(result.error)
        return
      }
      const s = result.style
      setPrimaryColor(s.primary_color)
      setSecondaryColor(s.secondary_color)
      setAccentColor(s.accent_color)
      setBackgroundColor(s.background_color)
      setTextColor(s.text_color)
      setHeadingFontFamily(s.heading_font_family)
      setBodyFontFamily(s.body_font_family)
      setFontFamily(s.body_font_family)
      setTextAlign(s.text_align)
      setTextPosition(s.text_position)
      setHookStyle(s.hook_style)
      setOverlayOpacityPct(s.overlay_opacity_pct)
      setExtractConfidence(s.confidence)
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.set('file', file)

    const result = await uploadLogo(formData)
    if ('publicUrl' in result) {
      setLogoUrl(result.publicUrl)
    } else {
      setErrorMessage(result.error)
    }
    setUploading(false)
  }

  // Visual preview position: when nothing is selected yet but a logo exists,
  // pre-select bottom-right visually for guidance (do NOT persist until user clicks).
  const visualPosition: LogoPosition = logoPosition ?? 'bottom-right'
  const previewW = 90
  const previewH = 160
  const previewBox = computePreviewBox(visualPosition, logoSizePct, previewW, previewH)

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {/* Generate from Reference (260428-sty) */}
      <fieldset className="space-y-3 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40 p-5">
        <legend className="text-sm font-semibold px-2 text-blue-900">
          Generate from Reference
        </legend>
        <p className="text-xs text-gray-600 leading-relaxed">
          Upload a screenshot of a carousel you like and we&apos;ll auto-fill the fields below to
          match the style.{' '}
          <span className="text-gray-500">
            We match the style, not the exact font. Review before saving.
          </span>
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleReferenceUpload}
            disabled={extracting}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => referenceInputRef.current?.click()}
            disabled={extracting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {extracting ? 'Analyzing reference… ~3s' : 'Upload reference screenshot'}
          </button>
          {extractConfidence && !extracting && (
            <span className="text-xs text-green-700">
              Style applied. Review &amp; click Save Brand Kit to commit.
            </span>
          )}
        </div>
        {extractConfidence && (
          <div className="flex flex-wrap gap-2 pt-1">
            <ConfidenceBadge label="Colors" value={extractConfidence.colors} />
            <ConfidenceBadge label="Fonts" value={extractConfidence.fonts} />
            <ConfidenceBadge label="Layout" value={extractConfidence.layout} />
          </div>
        )}
        {extractError && (
          <p className="text-xs text-red-600">{extractError}</p>
        )}
      </fieldset>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Brand Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="My Brand"
        />
      </div>

      {/* Colors */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Colors</legend>
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Primary" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Secondary" value={secondaryColor} onChange={setSecondaryColor} />
          <ColorField label="Text" value={textColor} onChange={setTextColor} />
          <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} />
          <ColorField label="Accent" value={accentColor} onChange={setAccentColor} />
        </div>
      </fieldset>

      {/* Typography */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Typography</legend>
        <div className="grid grid-cols-2 gap-4">
          <FontField
            label="Heading Font"
            id="heading-font"
            value={headingFontFamily}
            onChange={(v) => {
              setHeadingFontFamily(v)
              setFontFamily(v)
            }}
          />
          <FontField
            label="Body Font"
            id="body-font"
            value={bodyFontFamily}
            onChange={setBodyFontFamily}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Hook Style</label>
          <div className="flex gap-2">
            {HOOK_STYLE_OPTIONS.map((opt) => {
              const selected = hookStyle === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setHookStyle(opt)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold capitalize transition-all ${
                    selected
                      ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 hover:border-gray-500 text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      </fieldset>

      {/* Layout */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Layout</legend>
        <div>
          <label className="block text-sm font-medium mb-2">Text Align</label>
          <div className="flex gap-2">
            {TEXT_ALIGN_OPTIONS.map((opt) => {
              const selected = textAlign === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTextAlign(opt)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold capitalize transition-all ${
                    selected
                      ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 hover:border-gray-500 text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Text Position</label>
          <div className="flex gap-2">
            {TEXT_POSITION_OPTIONS.map((opt) => {
              const selected = textPosition === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTextPosition(opt)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold capitalize transition-all ${
                    selected
                      ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 hover:border-gray-500 text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label htmlFor="overlay_opacity" className="text-xs font-medium text-gray-600">
              Overlay Opacity: {overlayOpacityPct}%
            </label>
            <span className="text-[10px] text-gray-500">
              Dark/light overlay over background images
            </span>
          </div>
          <input
            id="overlay_opacity"
            type="range"
            min={0}
            max={100}
            step={5}
            value={overlayOpacityPct}
            onChange={(e) => setOverlayOpacityPct(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </fieldset>

      {/* Live preview — real SlidePreview tile rendered with synthesized brand-kit template */}
      <div>
        <p className="text-sm font-medium mb-2">Preview</p>
        <p className="text-xs text-gray-500 mb-3">
          This is exactly how slides look when you pick &quot;Your Brand Kit&quot; as the visual style.
        </p>
        <div className="w-48 aspect-[9/16] rounded-xl overflow-hidden border-2 border-gray-200">
          {(() => {
            const liveBrandKit: BrandKit = {
              id: brandKit?.id ?? 'preview',
              user_id: brandKit?.user_id ?? '',
              name,
              primary_color: primaryColor,
              secondary_color: secondaryColor,
              text_color: textColor,
              background_color: backgroundColor,
              accent_color: accentColor,
              font_family: bodyFontFamily,
              heading_font_family: headingFontFamily,
              body_font_family: bodyFontFamily,
              text_align: textAlign,
              text_position: textPosition,
              hook_style: hookStyle,
              overlay_opacity_pct: overlayOpacityPct,
              logo_url: logoUrl || null,
              logo_position: logoPosition,
              logo_size_pct: logoSizePct,
              logo_opacity_pct: logoOpacityPct,
              created_at: brandKit?.created_at ?? '',
              updated_at: brandKit?.updated_at ?? '',
            }
            const liveTemplate = synthesizeBrandKitTemplate(liveBrandKit)
            const sampleSlide: Slide = {
              hook_text: name || 'Your Brand',
              body_text: 'Your story, your voice, your style.',
              image_query: '',
              is_cta: false,
              background_url: null,
              pexels_photo_id: null,
            }
            return (
              <SlidePreview
                slide={sampleSlide}
                template={liveTemplate}
                index={0}
                slideIndex={0}
                totalSlides={1}
                editable={false}
                brandKit={liveBrandKit}
              />
            )
          })()}
        </div>
      </div>

      {/* Logo & Watermark */}
      <fieldset className="space-y-5 rounded-lg border p-5">
        <legend className="text-sm font-semibold px-2">Logo & Watermark</legend>

        {/* Upload row */}
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Brand logo"
              className="h-12 w-12 object-contain rounded border bg-white"
            />
          ) : (
            <div className="h-12 w-12 rounded border bg-gray-50 flex items-center justify-center text-[10px] text-gray-400">
              No logo
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="text-sm"
          />
          {uploading && <span className="text-sm text-gray-500">Uploading...</span>}
        </div>

        {/* 9-grid position picker + live preview tile */}
        <div className="grid grid-cols-[auto_1fr] gap-6 items-start">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">Position</label>
            <div className="grid grid-cols-3 gap-1.5 w-[120px]">
              {POSITION_GRID.flat().map((pos) => {
                const selected = logoPosition === pos && !hideWatermarkAll
                return (
                  <button
                    key={pos}
                    type="button"
                    aria-label={pos}
                    aria-pressed={selected}
                    disabled={!logoUrl}
                    onClick={() => {
                      setLogoPosition(pos)
                      setHideWatermarkAll(false)
                    }}
                    className={`h-9 w-9 rounded border transition-all flex items-center justify-center ${
                      selected
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
                        : 'bg-white border-gray-300 hover:border-gray-500'
                    } ${!logoUrl ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`block h-2 w-2 rounded-sm ${
                        selected ? 'bg-blue-500' : 'bg-gray-400'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
            <label className="flex items-center gap-2 mt-3 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={hideWatermarkAll}
                onChange={(e) => {
                  setHideWatermarkAll(e.target.checked)
                  if (e.target.checked) setLogoPosition(null)
                }}
              />
              Hide watermark on all slides
            </label>
          </div>

          {/* Live preview tile */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">Preview</label>
            <div
              className="relative rounded border overflow-hidden"
              style={{
                width: previewW,
                height: previewH,
                background:
                  'linear-gradient(135deg, #e5e7eb 25%, #f3f4f6 25%, #f3f4f6 50%, #e5e7eb 50%, #e5e7eb 75%, #f3f4f6 75%)',
                backgroundSize: '12px 12px',
              }}
            >
              {logoUrl && !hideWatermarkAll ? (
                <img
                  src={logoUrl}
                  alt=""
                  style={{
                    position: 'absolute',
                    left: previewBox.left,
                    top: previewBox.top,
                    width: previewBox.width,
                    height: 'auto',
                    opacity: logoOpacityPct / 100,
                    pointerEvents: 'none',
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[8px] text-gray-500 text-center px-1">
                  {logoUrl ? 'Watermark hidden' : 'Upload a logo to preview'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Size slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label htmlFor="logo_size" className="text-xs font-medium text-gray-600">
              Size: {logoSizePct}% of width
            </label>
          </div>
          <input
            id="logo_size"
            type="range"
            min={4}
            max={20}
            step={1}
            value={logoSizePct}
            onChange={(e) => setLogoSizePct(Number(e.target.value))}
            disabled={!logoUrl || hideWatermarkAll}
            className="w-full"
          />
        </div>

        {/* Opacity slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label htmlFor="logo_opacity" className="text-xs font-medium text-gray-600">
              Opacity: {logoOpacityPct}%
            </label>
          </div>
          <input
            id="logo_opacity"
            type="range"
            min={10}
            max={100}
            step={5}
            value={logoOpacityPct}
            onChange={(e) => setLogoOpacityPct(Number(e.target.value))}
            disabled={!logoUrl || hideWatermarkAll}
            className="w-full"
          />
        </div>
      </fieldset>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving...' : 'Save Brand Kit'}
        </button>
        {status === 'success' && (
          <span className="text-sm text-green-600">Saved successfully!</span>
        )}
        {status === 'error' && (
          <span className="text-sm text-red-600">{errorMessage}</span>
        )}
      </div>
    </form>
  )
}

function FontField({
  label,
  id,
  value,
  onChange,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{ fontFamily: `'${value}', sans-serif` }}
      >
        {FONT_OPTIONS.map((font) => (
          <option key={font} value={font} style={{ fontFamily: `'${font}', sans-serif` }}>
            {font}
          </option>
        ))}
      </select>
    </div>
  )
}

function ConfidenceBadge({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const tier = value >= 0.75 ? 'high' : value >= 0.5 ? 'med' : 'low'
  const palette =
    tier === 'high'
      ? 'bg-green-100 text-green-800 border-green-300'
      : tier === 'med'
        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
        : 'bg-red-100 text-red-800 border-red-300'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${palette}`}
      title={`${label} confidence: ${pct}%`}
    >
      {label} {pct}%
    </span>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-10 cursor-pointer rounded border-0 p-0"
      />
      <div className="flex-1">
        <label className="block text-xs text-gray-500">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border px-2 py-1 text-xs font-mono"
          placeholder="#000000"
        />
      </div>
    </div>
  )
}
