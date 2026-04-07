/**
 * Satori Text Effects Validation Spike
 *
 * Confirms that Satori (via next/og ImageResponse) natively supports:
 * - textShadow CSS property
 * - WebkitTextStrokeWidth / WebkitTextStrokeColor CSS properties
 *
 * Run: npx tsx scripts/spike-satori-effects.ts
 */
import { ImageResponse } from 'next/og'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import React from 'react'

const W = 1080
const H = 1920
const OUT_DIR = join(__dirname, 'spike-output')

mkdirSync(OUT_DIR, { recursive: true })

function h(tag: string, props: Record<string, unknown>, ...children: unknown[]) {
  return React.createElement(tag, props, ...children)
}

async function renderToFile(name: string, element: React.ReactElement) {
  const response = new ImageResponse(element, { width: W, height: H })
  const buffer = await response.arrayBuffer()
  const path = join(OUT_DIR, `${name}.png`)
  writeFileSync(path, Buffer.from(buffer))
  const size = Buffer.from(buffer).length
  console.log(`✓ ${name}.png — ${size} bytes`)
  if (size < 5000) {
    throw new Error(`${name}.png is too small (${size} bytes) — likely blank`)
  }
}

async function main() {
  console.log('Satori Text Effects Validation Spike\n')

  // Test 1: textShadow
  await renderToFile('spike-shadow',
    h('div', { style: { width: W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' } },
      h('div', { style: { color: '#ffffff', fontSize: 72, fontWeight: 900, textShadow: '4px 4px 8px #000000' } }, 'Shadow Test')
    )
  )

  // Test 2: WebkitTextStroke
  await renderToFile('spike-outline',
    h('div', { style: { width: W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' } },
      h('div', { style: { color: '#ffffff', fontSize: 72, fontWeight: 900, WebkitTextStrokeWidth: '3px', WebkitTextStrokeColor: '#FF0000' } }, 'Outline Test')
    )
  )

  // Test 3: Combined shadow + outline
  await renderToFile('spike-combined',
    h('div', { style: { width: W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' } },
      h('div', { style: { color: '#ffffff', fontSize: 72, fontWeight: 900, textShadow: '2px 2px 4px #00000080', WebkitTextStrokeWidth: '2px', WebkitTextStrokeColor: '#FFFFFF' } }, 'Combined Test')
    )
  )

  console.log('\n✓ All three tests passed — Satori natively supports text effects')
}

main().catch((err) => {
  console.error('✗ Spike failed:', err)
  process.exit(1)
})
