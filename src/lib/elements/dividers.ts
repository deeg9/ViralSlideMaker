/**
 * Editorial divider library — 10 hand-authored SVG patterns that the user can
 * drop onto any slide from the Elements sidebar tab.
 *
 * Each divider is a pure function `build(color: string) => dataUri`. Color is
 * baked from the active template's `textColor` at insert time so on Paper
 * Essay the rule is warm-dark `#1F1F1F`, on Editorial Serif it's cream
 * `#F5EFE6`. Once placed the divider is a `slide.custom_images` entry — the
 * existing `<Rnd>` flow handles drag/resize/delete for free.
 *
 * Canvas is 600×40 (wide-ish) so the rule reads well at any output scale.
 * Strokes are sized in viewBox units; the renderer scales the SVG to whatever
 * `width`/`height` the user resizes the box to.
 */

export type DividerId =
  | 'rule-thin'
  | 'rule-hairline'
  | 'rule-double'
  | 'rule-dashed'
  | 'rule-dotted'
  | 'asterism'
  | 'three-dots'
  | 'diamond'
  | 'em-dash'
  | 'flourish'

export interface Divider {
  id: DividerId
  label: string
  build: (color: string) => string
}

const W = 600
const H = 40
const MID = H / 2
const PAD = 50

function toDataUri(svg: string): string {
  // Browser path uses btoa; Node (vitest) uses Buffer.
  const base64 =
    typeof btoa === 'function'
      ? btoa(svg)
      : Buffer.from(svg, 'utf8').toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

function wrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${inner}</svg>`
}

function ruleThin(color: string): string {
  return toDataUri(
    wrap(
      `<line x1="${PAD}" y1="${MID}" x2="${W - PAD}" y2="${MID}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`,
    ),
  )
}

function ruleHairline(color: string): string {
  return toDataUri(
    wrap(
      `<line x1="${PAD}" y1="${MID}" x2="${W - PAD}" y2="${MID}" stroke="${color}" stroke-width="1" stroke-linecap="round"/>`,
    ),
  )
}

function ruleDouble(color: string): string {
  return toDataUri(
    wrap(
      `<line x1="${PAD}" y1="${MID - 4}" x2="${W - PAD}" y2="${MID - 4}" stroke="${color}" stroke-width="1.5"/>` +
        `<line x1="${PAD}" y1="${MID + 4}" x2="${W - PAD}" y2="${MID + 4}" stroke="${color}" stroke-width="1.5"/>`,
    ),
  )
}

function ruleDashed(color: string): string {
  return toDataUri(
    wrap(
      `<line x1="${PAD}" y1="${MID}" x2="${W - PAD}" y2="${MID}" stroke="${color}" stroke-width="2" stroke-dasharray="10 8" stroke-linecap="round"/>`,
    ),
  )
}

function ruleDotted(color: string): string {
  return toDataUri(
    wrap(
      `<line x1="${PAD}" y1="${MID}" x2="${W - PAD}" y2="${MID}" stroke="${color}" stroke-width="3" stroke-dasharray="0 12" stroke-linecap="round"/>`,
    ),
  )
}

function asterism(color: string): string {
  // Three asterisks: * * *  — using SVG <text> so font scaling is uniform.
  return toDataUri(
    wrap(
      `<text x="${W / 2}" y="${MID + 8}" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="${color}" letter-spacing="14">* * *</text>`,
    ),
  )
}

function threeDots(color: string): string {
  // Three filled circles, evenly spaced.
  const cy = MID
  return toDataUri(
    wrap(
      `<circle cx="${W / 2 - 24}" cy="${cy}" r="3" fill="${color}"/>` +
        `<circle cx="${W / 2}" cy="${cy}" r="3" fill="${color}"/>` +
        `<circle cx="${W / 2 + 24}" cy="${cy}" r="3" fill="${color}"/>`,
    ),
  )
}

function diamond(color: string): string {
  // Two short rules flanking a small filled diamond at center.
  const cx = W / 2
  const ruleEnd = cx - 30
  const ruleStart = W - ruleEnd
  return toDataUri(
    wrap(
      `<line x1="${PAD + 80}" y1="${MID}" x2="${ruleEnd}" y2="${MID}" stroke="${color}" stroke-width="1.5"/>` +
        `<polygon points="${cx - 6},${MID} ${cx},${MID - 6} ${cx + 6},${MID} ${cx},${MID + 6}" fill="${color}"/>` +
        `<line x1="${ruleStart}" y1="${MID}" x2="${W - PAD - 80}" y2="${MID}" stroke="${color}" stroke-width="1.5"/>`,
    ),
  )
}

function emDash(color: string): string {
  // Single em-dash centered, ~80px wide. Heavier stroke than rule-thin.
  const cx = W / 2
  return toDataUri(
    wrap(
      `<line x1="${cx - 50}" y1="${MID}" x2="${cx + 50}" y2="${MID}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`,
    ),
  )
}

function flourish(color: string): string {
  // Two short rules flanking a small ornamental swirl. The swirl is two mirrored
  // quadratic curves — restrained, editorial, not Victorian.
  const cx = W / 2
  const ruleEnd = cx - 26
  const ruleStart = W - ruleEnd
  const swirl =
    `<path d="M ${cx - 18} ${MID} q 6 -6 12 0 q 6 6 12 0" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>`
  return toDataUri(
    wrap(
      `<line x1="${PAD + 80}" y1="${MID}" x2="${ruleEnd}" y2="${MID}" stroke="${color}" stroke-width="1.25"/>` +
        swirl +
        `<line x1="${ruleStart}" y1="${MID}" x2="${W - PAD - 80}" y2="${MID}" stroke="${color}" stroke-width="1.25"/>`,
    ),
  )
}

export const DIVIDERS: ReadonlyArray<Divider> = [
  { id: 'rule-thin', label: 'Thin Rule', build: ruleThin },
  { id: 'rule-hairline', label: 'Hairline', build: ruleHairline },
  { id: 'rule-double', label: 'Double Rule', build: ruleDouble },
  { id: 'rule-dashed', label: 'Dashed', build: ruleDashed },
  { id: 'rule-dotted', label: 'Dotted', build: ruleDotted },
  { id: 'asterism', label: 'Asterism', build: asterism },
  { id: 'three-dots', label: 'Three Dots', build: threeDots },
  { id: 'diamond', label: 'Diamond', build: diamond },
  { id: 'em-dash', label: 'Em Dash', build: emDash },
  { id: 'flourish', label: 'Flourish', build: flourish },
]
