/**
 * Forgot Password / Reset Password — smoke spec
 *
 * Coverage:
 *   1. The "Forgot password?" link is visible on /login and points at /forgot-password.
 *   2. Submitting the /forgot-password form lands on /forgot-password?sent=1 and shows
 *      the generic success copy (no email-existence enumeration leak).
 *
 * What this spec does NOT cover (intentional — see PLAN §Task 3):
 *   - The real-inbox email click → /auth/callback → /reset-password → /dashboard path.
 *     That requires a configured Supabase project + a real mailbox; documented as a
 *     manual smoke step in the task's SUMMARY.md.
 *
 * Prerequisite to run locally:
 *   1. The Next dev server must be reachable at http://localhost:3000 (pnpm dev).
 *   2. Playwright browsers installed once: npx playwright install chromium
 *
 * Run command:
 *   npx playwright test tests/e2e/forgot-password.spec.ts --reporter=line
 */
import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

test('Forgot password link is visible on /login', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)

  const link = page.getByRole('link', { name: /forgot password\?/i })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', '/forgot-password')
})

test('Submitting forgot-password form shows generic success', async ({ page }) => {
  await page.goto(`${BASE_URL}/forgot-password`)

  await page.getByLabel('Email').fill('does-not-exist+smoke@example.com')
  await page.getByRole('button', { name: /send reset link/i }).click()

  await page.waitForURL('**/forgot-password?sent=1')
  await expect(
    page.getByText(/if an account exists for that email, we just sent a reset link/i),
  ).toBeVisible()
})
