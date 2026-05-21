/**
 * Template Picker preview smoke — Phase 90 (PREVIEW-05)
 *
 * Verifies the post-Plan-90-03 single-branch <img> picker contract:
 *   1. Every visible template tile renders an <img> with a non-empty `src`.
 *   2. Zero `[data-testid="slide-preview"]` nodes remain — the <SlidePreview>
 *      live-render fallback branch was deleted in Plan 90-03.
 *   3. No broken images — every tile <img> reports `naturalWidth > 0`.
 *
 * The picker is rendered inside <GenerationForm> on the auth-gated
 * /project/[id] route. This spec navigates to E2E_PROJECT_URL (a seeded
 * project owned by the E2E test account) and, if it is redirected to /login
 * (no auth state configured in the environment), skips with a clear message
 * rather than failing — so the spec is non-flaky in an unauthenticated CI
 * environment while still being a real smoke when an auth state is supplied.
 *
 * Picker tiles carry no wrapper testid — <TemplateTilePreview> emits a single
 * <img alt="Preview of {name}">, so tiles are located by that alt-text pattern.
 *
 * Note (project memory `feedback_playwright_react_clicks`): any React
 * interaction MUST use the Playwright runner's `locator.click()` here (a
 * `.spec.ts` file runs under the Playwright test runner, where `locator.click()`
 * IS the correct API). The `mcp__playwright__browser_click` guidance applies
 * only to an MCP-driven interactive smoke, not to this spec-file runner.
 *
 * Prerequisite to run locally:
 *   1. The Next dev server reachable at http://localhost:3000 (pnpm dev).
 *   2. Playwright browsers installed once: npx playwright install chromium
 *   3. For the full (non-skipped) assertion, set E2E_PROJECT_URL to a seeded
 *      project URL and supply an authenticated storage state.
 *
 * Run command:
 *   npx playwright test tests/e2e/template-picker-previews.spec.ts --reporter=line
 */
import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

// The picker lives inside <GenerationForm> on /project/[id]. Supply a seeded
// project URL to exercise the real picker; defaults to a placeholder path that
// will redirect to /login when no auth state is configured (→ test skips).
const PICKER_ROUTE =
  process.env.E2E_PROJECT_URL ?? `${BASE_URL}/project/e2e-seed`

// <TemplateTilePreview> renders <img alt="Preview of {name}"> — locate the
// picker tile images by that alt-text contract.
const tileImgSelector = 'img[alt^="Preview of "]'

/** Navigate to the picker route; skip the test if auth gates it to /login. */
async function gotoPicker(page: import('@playwright/test').Page) {
  await page.goto(PICKER_ROUTE, { waitUntil: 'networkidle' })
  if (/\/login(\?|$)/.test(page.url())) {
    test.skip(
      true,
      'Picker route is auth-gated — set E2E_PROJECT_URL + an authenticated ' +
        'storage state to run this smoke against the real picker.',
    )
  }
}

test('every template tile renders an <img> with a valid src', async ({
  page,
}) => {
  await gotoPicker(page)

  const tiles = page.locator(tileImgSelector)
  await expect(tiles.first()).toBeVisible()
  const count = await tiles.count()
  expect(count, 'the picker must render at least one tile').toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    const src = await tiles.nth(i).getAttribute('src')
    expect(src, `tile ${i} must have a non-empty src`).toBeTruthy()
    expect((src ?? '').length).toBeGreaterThan(0)
  }
})

test('no <SlidePreview> live-render nodes remain in the picker', async ({
  page,
}) => {
  await gotoPicker(page)

  // After Plan 90-03 the <SlidePreview> fallback branch is deleted — there
  // must be zero slide-preview testid nodes anywhere in the picker.
  const slidePreviews = page.locator('[data-testid="slide-preview"]')
  await expect(slidePreviews).toHaveCount(0)
})

test('no broken preview images in the picker', async ({ page }) => {
  await gotoPicker(page)

  const tiles = page.locator(tileImgSelector)
  await expect(tiles.first()).toBeVisible()
  const count = await tiles.count()
  expect(count, 'the picker must render at least one tile').toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    // A broken image reports naturalWidth === 0 once load settles.
    await expect
      .poll(
        () =>
          tiles
            .nth(i)
            .evaluate((el) => (el as HTMLImageElement).naturalWidth),
        { message: `tile ${i} image must not be broken (naturalWidth > 0)` },
      )
      .toBeGreaterThan(0)
  }
})
