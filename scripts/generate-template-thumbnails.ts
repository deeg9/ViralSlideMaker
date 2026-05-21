/**
 * Phase 48 — Template thumbnail generator.
 *
 * Renders each registered template's `sample` data through the production
 * Satori → resvg pipeline (via next/og::ImageResponse) and writes a 1080×1920
 * PNG to public/templates/<id>.png.
 *
 * Why next/og: the production /api/render route uses ImageResponse to wrap
 * Satori + resvg-wasm — those bundles ship inside next/og. By reusing
 * ImageResponse here we get byte-identical pixels to /api/render without
 * adding satori or @resvg/resvg-wasm as new top-level deps.
 *
 * Phase 56 (TPL-08): templates may declare grainMode / decorative overlays
 * that resolve to relative paths like /textures/grain-medium.png. In the
 * production renderer those resolve via Next.js's static asset handler;
 * in this script there's no HTTP server. We pre-walk the JSX tree and
 * replace such relative paths with `data:` URIs read from disk so Satori's
 * "absolute URL only" requirement is satisfied.
 *
 * Run: `npm run thumbs` (idempotent — overwrites existing PNGs).
 */
import { ImageResponse } from 'next/og'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as React from 'react'
import { templates } from '../src/lib/render/templates/index'
import { buildSlideElement } from '../src/lib/render/render-slide-satori'
import { loadFontBuffersForSlide } from '../src/lib/render/load-font'
import { makeSampleSlide } from '../src/lib/render/sample-slide'

const OUT_DIR = join(process.cwd(), 'public', 'templates')
const PUBLIC_DIR = join(process.cwd(), 'public')

// Phase 56 (TPL-08): resolve relative /textures/* and /overlays/* paths to
// `data:` URIs by reading the file from disk and base64-encoding it. Cached
// per src so repeated references in a single render share one buffer.
const dataUrlCache = new Map<string, string>()
function resolveLocalAssetToDataUri(src: string): string {
  if (!src.startsWith('/textures/') && !src.startsWith('/overlays/')) return src
  const cached = dataUrlCache.get(src)
  if (cached) return cached
  const filePath = join(PUBLIC_DIR, src.startsWith('/') ? src.slice(1) : src)
  const buf = readFileSync(filePath)
  const ext = src.toLowerCase().split('.').pop() ?? ''
  const mime =
    ext === 'png' ? 'image/png' :
    ext === 'svg' ? 'image/svg+xml' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    'application/octet-stream'
  const dataUri = `data:${mime};base64,${buf.toString('base64')}`
  dataUrlCache.set(src, dataUri)
  return dataUri
}

// Recursively rewrite the React element tree, replacing any <img src="/.../"> whose
// src starts with /textures/ or /overlays/ with the corresponding data: URI.
function rewriteAssetSrcs(node: React.ReactNode): React.ReactNode {
  if (node == null || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return node
  if (Array.isArray(node)) return node.map(rewriteAssetSrcs)
  if (!React.isValidElement(node)) return node
  const props = node.props as Record<string, unknown>
  const src = typeof props.src === 'string' ? props.src : undefined
  const newSrc = src ? resolveLocalAssetToDataUri(src) : src
  const children = props.children as React.ReactNode
  const rewrittenChildren = children !== undefined ? rewriteAssetSrcs(children) : undefined
  // Only build a new element if something actually changed.
  if (newSrc === src && rewrittenChildren === children) return node
  const newProps: Record<string, unknown> = { ...props }
  if (newSrc !== src) newProps.src = newSrc
  if (rewrittenChildren !== children) newProps.children = rewrittenChildren
  return React.cloneElement(node, newProps)
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const template of templates) {
    if (!/^[a-z0-9-]+$/.test(template.id)) {
      throw new Error(`[thumbs] Unsafe template id '${template.id}' — must match [a-z0-9-]+`)
    }
    const slide = makeSampleSlide(template)
    const ctx = { slideIndex: 0, totalSlides: 1, topic: undefined as string | undefined }
    const rawElement = buildSlideElement(slide, template, null, undefined, ctx)
    const element = rewriteAssetSrcs(rawElement) as React.ReactElement
    const fonts = await loadFontBuffersForSlide(slide, template)
    const imageResponse = new ImageResponse(element, {
      width: 1080,
      height: 1920,
      fonts,
    })
    const buffer = Buffer.from(await imageResponse.arrayBuffer())
    const outPath = join(OUT_DIR, `${template.id}.png`)
    writeFileSync(outPath, buffer)
    console.log(`[thumbs] Generated public/templates/${template.id}.png`)
  }

  console.log(`[thumbs] Wrote ${templates.length} PNGs to public/templates/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
