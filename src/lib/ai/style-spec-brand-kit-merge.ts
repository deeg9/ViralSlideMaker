// Phase 77 Plan 01 (EMIT-07) + Phase 76 (PREVIEW-08):
// applyBrandKitRemix — pure helper that overrides StyleSpec palette colors
// + typography categories with brand-kit values when the user toggles
// brand-kit-remix on (Phase 76 state.useBrandKitRemix).
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
//   - Pure: same (spec, brandKit) → byte-identical JSON output across
//     N calls. No I/O, no Date.now, no random, no console.
//   - Immutable: never mutates either input.
//   - Per-field merge: brand-kit field overrides spec field when present
//     and non-null; spec value used otherwise. Brand kit's null fields
//     mean "no preference" — they NEVER zero out a spec value.
//   - null brandKit short-circuits to identity: applyBrandKitRemix(spec, null)
//     returns the spec REFERENTIALLY unchanged (Object.is === true). Allows
//     callers to skip work without an outer guard.
//   - Brand kit only overrides palette colors + font categories. layout,
//     imagery, decorations, rhythm, voice_note, schema_version are
//     preserved unchanged — they are not part of the brand-kit surface.
//   - palette.mode is structural (closed enum on StyleSpec), and the
//     v2.x BrandKit type has no mode field — spec.palette.mode always
//     wins. (The brand kit was modeled before StyleSpec existed; mode
//     is a v2.13 concept only.)
// =====================================================================
//
// Font category resolution: BrandKit ships font FAMILIES (heading_font_family,
// body_font_family); StyleSpec ships font CATEGORIES (4-category enum). We
// look up the family in FONT_CATALOG via getFontEntry and read the
// category. When the family is unknown to the catalog, we silently leave
// the spec's category in place (no synthetic category invented).

import type { StyleSpec } from '@/lib/types/style-spec'
import type { BrandKit } from '@/lib/types/brand-kit'
import { getFontEntry, type FontEntry } from '@/lib/fonts/font-catalog'

function categoryForFamily(family: string | null): FontEntry['category'] | undefined {
  if (!family) return undefined
  const entry = getFontEntry(family)
  return entry?.category
}

/**
 * Returns a NEW StyleSpec with brand-kit values per-field-merged over spec
 * values. When brandKit is null, returns the spec referentially unchanged.
 *
 * Pure. Immutable.
 *
 * @param spec     The (possibly aspect-filtered) StyleSpec.
 * @param brandKit The user's brand kit, or null when toggle is off.
 * @returns        A new StyleSpec when brandKit is non-null; the same spec
 *                 reference when brandKit is null.
 */
export function applyBrandKitRemix(
  spec: StyleSpec,
  brandKit: BrandKit | null,
): StyleSpec {
  if (brandKit === null) return spec

  // Palette merge — brand-kit color wins per-field when non-null.
  const mergedPalette = {
    ...spec.palette,
    ...(brandKit.primary_color ? { primary: brandKit.primary_color } : {}),
    ...(brandKit.secondary_color ? { secondary: brandKit.secondary_color } : {}),
    ...(brandKit.accent_color ? { accent: brandKit.accent_color } : {}),
  }

  // Typography merge — resolve brand kit family → category via catalog lookup.
  // Unknown families silently leave spec value in place (defense-in-depth;
  // mirrors v2.12 silent-drop pattern).
  const headingCategory = categoryForFamily(brandKit.heading_font_family)
  const bodyCategory = categoryForFamily(brandKit.body_font_family)
  const mergedTypography = {
    ...spec.typography,
    ...(headingCategory ? { hookFontCategory: headingCategory } : {}),
    ...(bodyCategory ? { bodyFontCategory: bodyCategory } : {}),
  }

  return {
    schema_version: spec.schema_version,
    palette: mergedPalette,
    typography: mergedTypography,
    layout: { ...spec.layout },
    imagery: { ...spec.imagery },
    decorations: {
      ...spec.decorations,
      preferredLucide: spec.decorations.preferredLucide
        ? [...spec.decorations.preferredLucide]
        : undefined,
      preferredShapes: spec.decorations.preferredShapes
        ? [...spec.decorations.preferredShapes]
        : undefined,
    },
    rhythm: { ...spec.rhythm },
    voice_note: spec.voice_note,
  }
}
