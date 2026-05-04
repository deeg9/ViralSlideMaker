/**
 * Phase 70 (decoration picker barrel).
 *
 * Plan 70-01: ShapePicker + buildDefaultShapeDecoration factory.
 * Plan 70-02: LucidePickerDynamic (next/dynamic wrapper) +
 *             buildDefaultIconDecoration factory + LucidePickerProps type.
 *
 * IMPORTANT: This barrel intentionally does NOT export the eager `LucidePicker`
 * component. Importing it directly would break the PICKER-08 + DEPS-05 lazy-
 * load contract — the lucide-static corpus (1,703 SVG strings) +
 * @tanstack/react-virtual + @leeoniya/ufuzzy would land in the editor route
 * eager chunk, blowing past the bundle gate ceiling. Consumers MUST import
 * `LucidePickerDynamic` (next/dynamic, ssr:false, loading:()=>null) instead.
 *
 * Only the props type `LucidePickerProps` is re-exported as a TYPE — type-only
 * imports erase at compile time and don't pull in the eager module.
 */
export { ShapePicker } from './shape-picker'
export type { ShapePickerProps } from './shape-picker'
export {
  buildDefaultShapeDecoration,
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_SIZE_PCT,
  DEFAULT_LINE_SIZE_PCT,
} from './shape-defaults'

// Plan 70-02 — LucidePicker family
export { LucidePickerDynamic } from './lucide-picker.dynamic'
export {
  buildDefaultIconDecoration,
  DEFAULT_ICON_COLOR,
  DEFAULT_ICON_SIZE_PCT,
  DEFAULT_ICON_STROKE_WIDTH,
} from './icon-defaults'
export type { LucidePickerProps } from './lucide-picker'
// NOTE: `LucidePicker` (eager) intentionally NOT exported. See file header.
