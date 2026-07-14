import { expect, test } from '@playwright/test'
import axe from 'axe-core'

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
