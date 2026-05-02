// Phase 58 (PARITY-03): manual / opt-in visual audit aid.
//
// Logs each template × 3 sample slides to stdout in a side-by-side
// summary suitable for visual inspection during a v3.0+ design review.
// NOT in CI — visual sanity check only.
//
// Run: npm run parity-grid
//
// v2.9 deliverable: the Satori half is exercised through buildSlideElement
// (the source of truth used by /api/render/route.ts). The React preview
// half (jsdom + html-to-image) is deferred to v3.0+ — see TODO below.
//
// Pattern mirrors scripts/generate-template-thumbnails.ts and
// scripts/build-textures.ts. No new npm dependencies (orchestrator
// constraint).

import { templates } from '../src/lib/render/templates'
import { makeSampleSlide } from '../src/lib/render/sample-slide'
import { buildSlideElement } from '../src/lib/render/render-slide-satori'

interface ParityCell {
  templateId: string
  slideIndex: number
  satoriElementType: string
  hasGrain: boolean
  hasVignette: boolean
}

async function main() {
  const total = templates.length * 3
  console.log(
    `[parity-grid] auditing ${templates.length} templates × 3 sample slides = ${total} cells`,
  )

  const cells: ParityCell[] = []
  for (const tpl of templates) {
    for (let i = 0; i < 3; i++) {
      const slide = makeSampleSlide(tpl)
      const element = buildSlideElement(
        slide,
        tpl,
        null,
        null,
        undefined,
        { slideIndex: i, totalSlides: 3, topic: 'preview' },
      )
      cells.push({
        templateId: tpl.id,
        slideIndex: i,
        satoriElementType:
          (element as { type?: string }).type ?? 'unknown',
        hasGrain: Boolean(tpl.grainMode),
        hasVignette: Boolean(tpl.vignette),
      })
    }
  }

  // Print a summary table — easy to eyeball in a terminal.
  console.log('\nParity audit summary:')
  console.log(
    'template'.padEnd(20),
    'slide'.padEnd(6),
    'element'.padEnd(10),
    'grain'.padEnd(7),
    'vignette',
  )
  console.log('-'.repeat(60))
  for (const c of cells) {
    console.log(
      c.templateId.padEnd(20),
      String(c.slideIndex).padEnd(6),
      c.satoriElementType.padEnd(10),
      String(c.hasGrain).padEnd(7),
      String(c.hasVignette),
    )
  }

  console.log('\n[parity-grid] complete.')
  console.log(
    '[parity-grid] TODO v3.0+: render React preview half via jsdom + ' +
      'html-to-image and write parity-grid.png. Satori half exercised above ' +
      'is the substantive v2.9 deliverable.',
  )
}

main().catch((err) => {
  console.error('[parity-grid] error:', err)
  process.exit(1)
})
