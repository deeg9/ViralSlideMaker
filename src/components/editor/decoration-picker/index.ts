/**
 * Phase 70 (decoration picker barrel).
 *
 * Plan 70-01: ShapePicker (this plan) + buildDefaultShapeDecoration factory.
 * Plan 70-02: LucidePicker — added when that plan ships (next/dynamic mount;
 *             keeps lucide-static + 1,703-icon corpus OUT of the editor route
 *             eager chunk per DEPS-05 ceiling).
 */
export { ShapePicker } from './shape-picker'
export type { ShapePickerProps } from './shape-picker'
export {
  buildDefaultShapeDecoration,
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_SIZE_PCT,
  DEFAULT_LINE_SIZE_PCT,
} from './shape-defaults'
