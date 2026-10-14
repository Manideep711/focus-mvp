import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function navigate(page: Page, name: string) {
  const navigation = page
    .getByRole('navigation', { name: /Main navigation|Mobile navigation/ })
    .filter({ visible: true })
  await navigation.getByRole('button', { name, exact: true }).click()
}
async function createAction(page: Page, title: string, estimate = '30') {
  await page.getByRole('button', { name: 'Add an action', exact: true }).click()
  await page.getByLabel('What will you do?').fill(title)
  await page.getByLabel('Estimate · optional').fill(estimate)
  await page.getByRole('button', { name: 'Add to Today', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('focus.workspace.mode', 'local')
    sessionStorage.setItem('focus.today.view', 'full')
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Make room for what matters.' })).toBeVisible()
})

test('now suggestions explain fit and let users explore without changing the plan', async ({
  page,
}, testInfo) => {
  await createAction(page, 'Read a small section', '15')
  await createAction(page, 'Draft a longer section', '45')
  await page.getByRole('button', { name: 'What should I do now?' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Time right now').selectOption('15')
  await dialog.getByLabel('Energy right now').selectOption('low')
  await expect(dialog.getByText(/Fits your time right now/)).toBeVisible()
  await expect(dialog.getByText(/More than the 15 min available right now/)).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: `artifacts/now-${testInfo.project.name}.png` })
  await dialog.getByRole('button', { name: 'Surprise me', exact: true }).click()
  await expect(dialog.locator('.suggestion-card')).toHaveCount(1)
  const first = await dialog.locator('.suggestion-card h3').textContent()
  await dialog.getByRole('button', { name: 'Show another possibility' }).click()
  await expect(dialog.locator('.suggestion-card h3')).not.toHaveText(first!)
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  expect(state.commitments).toHaveLength(2)
  expect(state.plans[0].energy).toBe('steady')
  await dialog.getByRole('button', { name: 'Choose and focus' }).click()
  await expect(page.getByRole('button', { name: 'Begin this session' })).toBeVisible()
})
test('an unreadable local workspace is preserved until explicitly reset', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('focus.workspace.v1', '{unreadable'))
  await page.reload()
  await expect(page.getByText(/Your stored data has been preserved/)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('focus.workspace.v1'))).toBe('{unreadable')
  await page.getByRole('button', { name: 'Reset unreadable local workspace' }).click()
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.getByRole('heading', { name: 'Make room for what matters.' })).toBeVisible()
})

test('capture preserves a draft and a note stays a note', async ({ page }) => {
  await page.getByRole('button', { name: /Something on your mind/ }).click()
  await page
    .getByLabel('Your thought, idea, or brain dump')
    .fill('Maybe I want to learn pottery. No decision yet.')
  await page.getByRole('button', { name: 'Keep draft and close' }).click()
  await page.reload()
  await page.getByRole('button', { name: /Something on your mind/ }).click()
  await expect(page.getByLabel('Your thought, idea, or brain dump')).toHaveValue(
    'Maybe I want to learn pottery. No decision yet.',
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Capture', exact: true }).click()
  await navigate(page, 'Inbox')
  await expect(
    page.getByText('Maybe I want to learn pottery. No decision yet.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Consider this thought/ }).click()
  await page.getByRole('button', { name: 'Confirm my choice' }).click()
  await page.getByRole('button', { name: 'Organized', exact: true }).click()
  await expect(
    page.getByText('Maybe I want to learn pottery. No decision yet.', { exact: true }),
  ).toBeVisible()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  expect(state.tasks).toHaveLength(0)
  expect(state.inbox[0].kind).toBe('note')
})
test('commitments persist, prioritize, reorder, and offer undo', async ({ page }) => {
  await createAction(page, 'Draft the opening paragraph')
  await createAction(page, 'Read one chapter', '20')
  await page.getByRole('button', { name: 'Prioritize Draft the opening paragraph' }).click()
  await expect(page.getByText('One thing', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Move Read one chapter up' }).click()
  await expect(page.locator('.task-title').first()).toHaveText('Read one chapter')
  await page.reload()
  await expect(page.locator('.task-title').first()).toHaveText('Read one chapter')
  await page.getByRole('button', { name: 'Complete Read one chapter' }).click()
  await expect(page.getByRole('heading', { name: /Moved forward/ })).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Moved forward/ })).toHaveCount(0)
})
test('an interruption moves only the commitments explicitly selected', async ({ page }) => {
  await createAction(page, 'Study the next lesson', '60')
  await createAction(page, 'Go for a walk', '20')
  await page.getByRole('button', { name: 'Capture an interruption' }).click()
  await page.getByLabel('What will you do?').fill('Submit the urgent document')
  await page.getByLabel('Estimate · optional').fill('90')
  await page.getByLabel('Study the next lesson', { exact: true }).check()
  await page.getByRole('button', { name: 'Make room', exact: true }).click()
  await expect(page.locator('.task-title')).toHaveText([
    'Go for a walk',
    'Submit the urgent document',
  ])
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  const study = state.tasks.find((t: { title: string }) => t.title === 'Study the next lesson')
  expect(
    state.commitments
      .filter((c: { task_id: string; status: string }) => c.task_id === study.id)
      .map((c: { status: string }) => c.status),
  ).toEqual(['moved', 'planned'])
})
test('focus records partial progress, restores a paused timer, and saves a resume note', async ({
  page,
}) => {
  await createAction(page, 'Work on the first section')
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  await page.getByRole('button', { name: 'Begin this session' }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Return to session' }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Finish session' }).click()
  await page.getByLabel('Where will you pick this up?').fill('Continue with the second example.')
  await page.getByRole('button', { name: 'Save what happened' }).click()
  await expect(page.getByText('Pick up here: Continue with the second example.')).toBeVisible()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  expect(state.tasks[0].status).toBe('active')
  expect(state.sessions).toHaveLength(1)
  expect(state.sessions[0].outcome).toBe('progress')
  await navigate(page, 'Progress')
  await expect(page.getByText(/Made progress · .*Focus session/)).toBeVisible()
})
test('goals, resources, manual stages, and paused attention work together', async ({ page }) => {
  await navigate(page, 'Goals')
  await page.getByRole('button', { name: 'New goal', exact: true }).click()
  await page.getByLabel('What do you want to achieve?').fill('Understand my backend')
  await page.getByLabel('Attention right now').selectOption('active')
  await page.getByRole('button', { name: 'Save goal' }).click()
  await page.getByRole('button', { name: 'Open goal' }).click()
  await page.getByRole('button', { name: 'Add resource', exact: true }).click()
  await page.getByLabel('Resource title').fill('My chosen course')
  await page.getByLabel('Total units · optional').fill('40')
  await page.getByLabel('Completed units').fill('14')
  await page.getByLabel('Units called').fill('videos')
  await page.getByRole('button', { name: 'Save resource' }).click()
  await expect(page.getByText('14 of 40 videos', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add a stage' }).click()
  await page.getByLabel('Stage name').fill('Build a small example')
  await page.getByRole('button', { name: 'Save stage' }).click()
  await expect(page.getByText('Build a small example', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit goal', exact: true }).click()
  await page.getByLabel('Attention right now').selectOption('paused')
  await page.getByRole('button', { name: 'Save goal' }).click()
  await expect(page.getByText(/This goal is taking a little space/)).toBeVisible()
})
test('AI fallback is truthful, destructive actions require confirmation, and layout fits', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Something on your mind/ }).click()
  await page.getByLabel('Your thought, idea, or brain dump').fill('Learn something new')
  await page.getByRole('dialog').getByRole('button', { name: 'Capture', exact: true }).click()
  await navigate(page, 'Inbox')
  await page.getByRole('button', { name: /Consider this thought/ }).click()
  await page.getByRole('button', { name: 'Review what will be shared' }).click()
  await page.getByRole('button', { name: 'Send and get suggestions' }).click()
  await expect(page.getByRole('alert')).toContainText(
    /AI needs a configured server|AI is available in a signed-in cloud workspace/,
  )
  await page.getByRole('button', { name: 'Decide later' }).click()
  await page.getByRole('button', { name: 'Delete thought', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('permanently deletes')
  await page.getByRole('button', { name: 'Keep it', exact: true }).click()
  await expect(page.getByText('Learn something new', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
test('daily replanning keeps reasons and reflections without silently rolling work over', async ({
  page,
}) => {
  await createAction(page, 'A task I need to reconsider')
  await page.getByRole('button', { name: 'Review your day' }).click()
  await page.getByRole('button', { name: /Decide what’s next/ }).click()
  await page.getByLabel('What changed?').selectOption('An emergency interrupted me')
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click()
  // The parent reflection dialog is inert until the asynchronous replan has saved and closed.
  await expect(page.getByRole('dialog', { name: 'Plans can change' })).toHaveCount(0)
  await page
    .getByLabel('What would you like tomorrow to know?')
    .fill('Leave more room for interruptions.')
  await page.getByRole('button', { name: 'Save reflection' }).click()
  await expect(page.getByRole('heading', { name: 'A task I need to reconsider' })).toHaveCount(0)
  await navigate(page, 'Progress')
  await page.getByRole('button', { name: 'Reflections', exact: true }).click()
  await expect(page.getByText('Leave more room for interruptions.', { exact: true })).toBeVisible()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  expect(state.commitments[0].reason).toBe('An emergency interrupted me')
  expect(state.reviews).toHaveLength(1)
})
