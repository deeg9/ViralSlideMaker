// Phase 50: extracted from text-editor-panel.tsx so all text-rail
// components reuse one palette. Tokens match the brand contract — no new
// colors. The render order is white → primary → muted → light pink so the
// 4-up swatch row reads light-to-dark with the brand primary in slot 2.
export const COLOR_SWATCHES = ['#ffffff', '#3d0000', '#7d6161', '#fadbdb'] as const

export type ColorSwatch = typeof COLOR_SWATCHES[number]
