'use client'

import { useState, useRef } from 'react'
import type { BrandKit } from '@/lib/types/brand-kit'
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

export function BrandKitForm({ brandKit }: { brandKit: BrandKit | null }) {
  const [name, setName] = useState(brandKit?.name ?? 'My Brand')
  const [primaryColor, setPrimaryColor] = useState(brandKit?.primary_color ?? '#000000')
  const [secondaryColor, setSecondaryColor] = useState(brandKit?.secondary_color ?? '#ffffff')
  const [textColor, setTextColor] = useState(brandKit?.text_color ?? '#ffffff')
  const [backgroundColor, setBackgroundColor] = useState(brandKit?.background_color ?? '#1a1a2e')
  const [fontFamily, setFontFamily] = useState(brandKit?.font_family ?? 'Inter')
  const [logoUrl, setLogoUrl] = useState(brandKit?.logo_url ?? '')
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

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium mb-1">Logo (optional)</label>
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Brand logo"
              className="h-12 w-12 object-contain rounded border"
            />
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
      </div>

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
