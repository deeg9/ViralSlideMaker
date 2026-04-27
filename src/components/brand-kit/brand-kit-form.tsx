'use client'

import { useState, useRef } from 'react'
import type { BrandKit, LogoPosition } from '@/lib/types/brand-kit'
import { saveBrandKit, uploadLogo } from '@/app/(dashboard)/settings/brand-kit/actions'

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
  const [fontFamily, setFontFamily] = useState(brandKit?.font_family ?? 'Inter')
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
    formData.set('font_family', fontFamily)
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
        </div>
      </fieldset>

      {/* Preview swatch */}
      <div>
        <p className="text-sm font-medium mb-2">Preview</p>
        <div
          className="rounded-lg p-6 border"
          style={{ backgroundColor, color: textColor }}
        >
          <div className="flex gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full border"
              style={{ backgroundColor: primaryColor }}
              title="Primary"
            />
            <div
              className="w-8 h-8 rounded-full border"
              style={{ backgroundColor: secondaryColor }}
              title="Secondary"
            />
          </div>
          <p style={{ fontFamily: `'${fontFamily}', sans-serif` }} className="text-lg font-bold">
            {name || 'Brand Name'}
          </p>
          <p style={{ fontFamily: `'${fontFamily}', sans-serif` }} className="text-sm opacity-80">
            Sample body text with your brand settings.
          </p>
        </div>
      </div>

      {/* Font */}
      <div>
        <label htmlFor="font" className="block text-sm font-medium mb-1">
          Font Family
        </label>
        <select
          id="font"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
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
