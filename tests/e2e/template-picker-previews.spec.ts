/**
 * Template Picker preview smoke — SKELETON (Phase 90, PREVIEW-05)
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ THIS IS A SKELETON. Plan 90-03 finalizes it.                             │
 * │                                                                          │
 * │ Plan 90-01 ships this spec as Wave-0 scaffolding — the picker tile is     │
 * │ STILL the two-branch <SlidePreview>-fallback component until Plan 90-03   │
 * │ collapses it to a single-branch <img>. The assertions below are therefore │
 * │ wrapped in `test.fixme(...)`: they encode the POST-Plan-03 contract       │
 * │ (every tile is an <img> with a valid src, zero slide-preview nodes, no    │
 * │ broken images) but are not expected to pass yet. Plan 90-03 removes the   │
 * │ `.fixme` marker, points the navigation at the real authenticated picker  │
 * │ route, and wires up auth/project fixtures.                               │
 * │                                                                          │
 * │ The picker is rendered inside <GenerationForm> on the auth-gated          │
 * │ /project/[id] route — Plan 90-03 supplies the auth + seeded-project       │
 * │ fixture needed to reach it. Per project memory                           │
 * │ `feedback_playwright_react_clicks`, any React interaction the finalized   │
 * │ spec adds must use mcp__playwright__browser_click, NOT an eval-side       │
 * │ .click() (React 18 batches commits).                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Coverage (once finalized in Plan 90-03):
 *   1. Every template tile renders an <img> with a non-empty `src`.
 *   2. Zero `[data-testid="slide-preview"]` nodes remain (the <SlidePreview>
 *      live-render fallback is deleted in Plan 90-03).
 *   3. No broken images — every tile <img> reports naturalWidth > 0.
 *
 * Prerequisite to run locally (Plan 90-03):
 *   1. The Next dev server reachable at http://localhost:3000.
 *   2. Playwright browsers installed once: npx playwright install chromium
 *
 * Run command:
 *   npx playwright test tests/e2e/template-picker-previews.spec.ts --reporter=line
 */
import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

// PLACEHOLDER route — Plan 90-03 replaces this with the authenticated
// /project/<seeded-id> route that renders <GenerationForm> + the picker.
const PICKER_ROUTE = '/dashboard'

test.fixme(
  'every template tile renders an <img> with a valid src',
  async ({ page }) => {
    await page.goto(`${BASE_URL}${PICKER_ROUTE}`)

    const tiles = page.locator('[data-testid="template-tile"] img')
    const count = await tiles.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const src = await tiles.nth(i).getAttribute('src')
      expect(src, `tile ${i} must have a non-empty src`).toBeTruthy()
      expect((src ?? '').length).toBeGreaterThan(0)
    }
  },
)

test.fixme(
  'no <SlidePreview> live-render nodes remain in the picker',
  async ({ page }) => {
    await page.goto(`${BASE_URL}${PICKER_ROUTE}`)

    // After Plan 90-03 the <SlidePreview> fallback branch is deleted — there
    // must be zero slide-preview testid nodes anywhere in the picker.
    const slidePreviews = page.locator('[data-testid="slide-preview"]')
    await expect(slidePreviews).toHaveCount(0)
  },
)

test.fixme('no broken preview images in the picker', async ({ page }) => {
  await page.goto(`${BASE_URL}${PICKER_ROUTE}`)

  const tiles = page.locator('[data-testid="template-tile"] img')
  const count = await tiles.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    // A broken image reports naturalWidth === 0 once load settles.
    const naturalWidth = await tiles
      .nth(i)
      .evaluate((el) => (el as HTMLImageElement).naturalWidth)
    expect(naturalWidth, `tile ${i} image must not be broken`).toBeGreaterThan(0)
  }
})
