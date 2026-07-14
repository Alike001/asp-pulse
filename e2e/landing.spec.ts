import { expect, test } from '@playwright/test'
import axe from 'axe-core'
import type { StoredScan } from '../apps/web/lib/types'

declare global {
  interface Window {
    axe: typeof axe
  }
}

test('landing presents a usable, accessible real scanner', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Know before you pay.' })).toBeVisible()
  const endpoint = page.getByLabel('x402 service endpoint').first()
  const submit = page.getByRole('button', { name: 'Check service' }).first()
  await expect(submit).toBeDisabled()

  await endpoint.fill('127.0.0.1')
  await expect(submit).toBeEnabled()
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/v1/scans') && response.request().method() === 'POST',
    ),
    submit.click(),
  ])
  await expect(page.locator('.scan-error')).toContainText(
    'Private, local, and reserved network targets are not allowed.',
  )

  await page.addScriptTag({ content: axe.source })
  const violations = await page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    })
    return results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((node) => node.target),
    }))
  })
  expect(violations).toEqual([])
})

test('a successful browser scan opens a report and recomputes its stored receipt', async ({
  page,
}) => {
  await page.route('**/v1/scans', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({ status: 201, contentType: 'application/json', json: scan })
  })
  await page.route('**/v1/scans/scan-e2e', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', json: scan }),
  )
  await page.route('**/v1/scans/scan-e2e/verify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: { id: scan.id, valid: true, report: scan.report },
    }),
  )

  await page.goto('/')
  const endpoint = page.getByLabel('x402 service endpoint').first()
  await endpoint.fill('provider.example/service')
  await page.getByRole('button', { name: 'Check service' }).first().click()
  await page.getByRole('link', { name: 'Open full evidence report →' }).click()

  await expect(page.getByRole('heading', { name: 'Preflight verified' })).toBeVisible()
  await page.getByRole('button', { name: 'Recheck receipt' }).click()
  await expect(page.getByText('Receipt matches recomputed evidence.')).toBeVisible()
})

test('scanner remains keyboard reachable and usable on a phone viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const endpoint = page.getByLabel('x402 service endpoint').first()
  await endpoint.fill('provider.example/service')
  await endpoint.focus()
  await endpoint.press('Tab')
  await expect(page.getByRole('button', { name: 'Check service' }).first()).toBeFocused()
  expect(
    await page.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true)
})

const scan: StoredScan = {
  id: 'scan-e2e',
  report: {
    ruleSetVersion: 'PULSE-RULESET/1.0.0',
    target: 'https://provider.example/service',
    checkedAt: '2026-07-14T12:00:00.000Z',
    latencyMs: 84,
    verdict: 'preflight_verified',
    verdictLabel: 'Preflight verified',
    evidenceHash: 'a'.repeat(64),
    checks: [
      {
        id: 'discovery',
        label: 'Discovery metadata',
        status: 'not_tested',
        summary: 'Direct endpoint scan; registry metadata was not supplied.',
      },
      {
        id: 'reachability',
        label: 'Endpoint reachability',
        status: 'pass',
        summary: 'Endpoint returned the expected payment challenge.',
      },
      {
        id: 'challenge',
        label: 'x402 challenge',
        status: 'pass',
        summary: 'Challenge is valid x402 v2 and bound to this endpoint.',
      },
      {
        id: 'payment_terms',
        label: 'X Layer payment terms',
        status: 'pass',
        summary: 'Supported X Layer payment terms found.',
      },
      {
        id: 'price',
        label: 'Advertised price',
        status: 'not_tested',
        summary: 'An atomic advertised amount and asset are required for comparison.',
      },
      {
        id: 'response_contract',
        label: 'Protected response',
        status: 'not_tested',
        summary: 'No successful paid canary evidence is attached.',
      },
    ],
  },
}
