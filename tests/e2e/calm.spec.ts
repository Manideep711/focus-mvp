import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { emptyWorkspace, newTask } from '../../src/domain/workspace'

test.beforeEach(async ({ page }) => {
  const state = emptyWorkspace()
  state.tasks.push(
    newTask('Open the draft', { estimate_minutes: 15, resume_note: 'Write one opening sentence.' }),
    newTask('Read a section', { status: 'later', estimate_minutes: 20 }),
  )
  await page.addInitScript((workspace) => {
    sessionStorage.setItem('focus.workspace.mode', 'local')
    if (!localStorage.getItem('focus.workspace.v1'))
      localStorage.setItem('focus.workspace.v1', JSON.stringify(workspace))
  }, state)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
})

test('a quiet first visit reveals a plan only when requested', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'A little space to begin.' })).toBeVisible()
  await expect(page.getByText('Room in your day')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Open the draft' })).toHaveCount(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'See my day' }).click()
  await expect(page.getByText('Room in your day')).toBeVisible()
  await page.getByRole('button', { name: 'One thing at a time', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'A little space to begin.' })).toBeVisible()
})

test('Today, Later, and targeted Undo preserve user intent', async ({ page }) => {
  await page.getByRole('button', { name: 'Choose my day' }).click()
  const dialog = page.getByRole('dialog')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await dialog.getByRole('button', { name: 'Later', exact: true }).click()
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  expect(before.commitments).toHaveLength(0)
  expect(before.tasks[0].status).toBe('active')
  await dialog.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(dialog.getByText('That can be enough.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Undo last choice' }).click()
  await expect(dialog.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  const undone = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  expect(undone.commitments.filter((c: { status: string }) => c.status === 'planned')).toHaveLength(
    0,
  )
  expect(undone.tasks[1].status).toBe('later')
  await dialog.getByRole('button', { name: 'Today', exact: true }).click()
  await dialog.getByRole('button', { name: 'Ready to start' }).click()
  await expect(page.getByRole('heading', { name: 'Read a section' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Open the draft' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Read a section' })).toBeVisible()
})

test('a user can stop after one choice and save a concrete first step', async ({ page }) => {
  await page.getByRole('button', { name: 'Choose my day' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Choose a smaller portion · optional').click()
  await dialog.getByLabel('Minutes to give this today').fill('5')
  await dialog.getByRole('button', { name: 'Today', exact: true }).click()
  await dialog.getByRole('button', { name: 'Enough for now' }).click()
  await dialog.getByRole('button', { name: 'Ready to start' }).click()
  await expect(page.getByText('Write one opening sentence.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start here' }).click()
  await expect(page.getByRole('timer')).toHaveText('05:00')
  await page.getByRole('button', { name: 'Make the first step smaller' }).click()
  await page.getByLabel('When I begin, I will…').fill('Open the document and write a title.')
  await page.getByRole('button', { name: 'Save first step' }).click()
  await expect(
    page.getByText('Open the document and write a title.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Begin this session' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  expect(saved.tasks[0].status).toBe('active')
  expect(saved.tasks[0].resume_note).toBe('Open the document and write a title.')
  expect(saved.tasks[0].estimate_minutes).toBe(15)
  expect(saved.commitments[0].planned_minutes).toBe(5)
  await page.getByRole('button', { name: 'Finish session' }).click()
  await page.getByLabel('Outcome').selectOption('completed')
  await page.getByRole('button', { name: 'Save what happened' }).click()
  await expect(page.getByRole('heading', { name: 'A little room to breathe.' })).toBeVisible()
  await expect(
    page.getByText('You can stop here, or make room for another small action.'),
  ).toBeVisible()
})

test('swiping is optional and right swipe chooses an action', async ({ page }) => {
  await page.getByRole('button', { name: 'Choose my day' }).click()
  const card = page.locator('.day-deck-card')
  const box = (await card.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Read a section' }),
  ).toBeVisible()
  const second = (await card.boundingBox())!
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2)
  await page.mouse.down()
  await page.mouse.move(second.x + second.width / 2 - 110, second.y + second.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Ready to start' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Open the draft' })).toBeVisible()
})
