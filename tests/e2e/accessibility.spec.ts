import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('focus.workspace.mode', 'local')
    sessionStorage.setItem('focus.today.view', 'full')
  })
})
test('dialogs trap keyboard focus and return it to the opener', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const opener = page.getByRole('button', { name: /Something on your mind/ })
  await opener.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Your thought, idea, or brain dump')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  expect(
    await page.getByRole('dialog').evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})
test('Today and capture dialog meet automated accessibility checks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Make room for what matters.' })).toBeVisible()
  const today = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(today.violations).toEqual([])
  await page.getByRole('button', { name: /Something on your mind/ }).click()
  const capture = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(capture.violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('populated commitments, goal details, and the execution screen remain readable', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Try a clearly labeled example' }).click()
  await page.getByRole('button', { name: 'Complete Take a walk without my phone' }).click()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([])
  const nav = page
    .getByRole('navigation', { name: /Main navigation|Mobile navigation/ })
    .filter({ visible: true })
  await nav.getByRole('button', { name: 'Goals', exact: true }).click()
  await page.getByRole('button', { name: 'Open goal' }).first().click()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([])
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([])
})
