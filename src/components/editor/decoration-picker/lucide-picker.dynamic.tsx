'use client'

/**
 * PICKER-08 (Phase 70 Plan 02 Task 3): lazy-loaded LucidePicker wrapper.
 *
 * Why this exists:
 *   The eager `lucide-picker.tsx` imports `decoration-renderer.tsx`, which
 *   resolves through `decorations/registry.ts` → `lucide-static` (1,703 SVG
 *   strings keyed by PascalCase name). It also bundles `@tanstack/react-virtual`
 *   and `@leeoniya/ufuzzy`. If the editor route eagerly imports the picker,
 *   that entire payload lands in the editor route page chunk on first load —
 *   even when no user has ever opened the picker. The DEPS-05 bundle gate
 *   (Plan 70-01) blocks any commit that pushes the editor chunk past the
 *   v2.11 baseline + 200 KB ceiling; the lazy-load contract (this wrapper)
 *   keeps the picker chunk in a separate split.
 *
 * Contract enforced by tests + the index.ts barrel:
 *   - Consumers MUST import { LucidePickerDynamic } from
 *     '@/components/editor/decoration-picker' — never the eager LucidePicker
 *     directly. The barrel does NOT export the eager component.
 *   - The dynamic() call uses `loading: () => null` (CONTEXT D-LAZY — no
 *     skeleton; the picker mount is brief) and `ssr: false` (the editor is
 *     client-only; no SSR cost).
 *   - The dynamic import path is a relative `./lucide-picker` so Next.js's
 *     bundler emits a separate chunk for the picker code.
 */

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import type { LucidePickerProps } from './lucide-picker'

export const LucidePickerDynamic: ComponentType<LucidePickerProps> = dynamic(
  () => import('./lucide-picker').then((mod) => mod.LucidePicker),
  {
    loading: () => null,
    ssr: false,
  },
)
