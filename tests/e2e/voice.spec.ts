import { test, expect } from '@playwright/test'
import type { Recognition } from '../../src/services/speech'

// Deterministic API simulation; no real microphone or speech-provider traffic.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('focus.workspace.mode', 'local')
    class MockRecognition {
      lang = ''
      continuous = false
      interimResults = false
      onstart: Recognition['onstart'] = null
      onend: Recognition['onend'] = null
      onerror: Recognition['onerror'] = null
      onresult: Recognition['onresult'] = null
      start() {
        state.active = this
        state.starts++
        this.onstart?.()
      }
      stop() {
        this.onend?.()
      }
      abort() {
        state.aborts++
        this.onend?.()
      }
    }
    const state = { active: null as MockRecognition | null, starts: 0, aborts: 0 }
    const browser = window as unknown as {
      SpeechRecognition: typeof MockRecognition
      voiceTest: typeof state
    }
    browser.SpeechRecognition = MockRecognition
    browser.voiceTest = state
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Something on your mind?', exact: true }).click()
})

test('dictation is opt-in, preserves typed text, and saves only reviewed final words', async ({
  page,
}) => {
  const text = page.getByLabel('Your thought, idea, or brain dump')
  expect(
    await page.evaluate(
      () => (window as unknown as { voiceTest: { starts: number } }).voiceTest.starts,
    ),
  ).toBe(0)
  await text.fill('Remember the book.')
  await page.getByRole('button', { name: 'Speak your thoughts' }).click()
  await expect(text).toHaveAttribute('readonly', '')
  await page.evaluate(() =>
    (window as unknown as { voiceTest: { active: Recognition } }).voiceTest.active.onresult?.({
      results: { length: 1, 0: { isFinal: false, 0: { transcript: 'Maybe learn' } } },
    }),
  )
  await expect(page.getByText('Maybe learn', { exact: true })).toBeVisible()
  await expect(text).toHaveValue('Remember the book.')
  await page.evaluate(() => {
    const active = (window as unknown as { voiceTest: { active: Recognition } }).voiceTest.active
    const result = {
      results: { length: 1, 0: { isFinal: true, 0: { transcript: 'Maybe learn pottery.' } } },
    }
    active.onresult?.(result)
    active.onresult?.(result)
  })
  await expect(text).toHaveValue('Remember the book.\nMaybe learn pottery.')
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Capture', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Stop listening' }).click()
  await text.fill('Remember the book.\nTry one pottery class.')
  await page.getByRole('dialog').getByRole('button', { name: 'Capture', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.workspace.v1')!))
  expect(saved.inbox[0].text).toBe('Remember the book.\nTry one pottery class.')
  expect(saved.tasks).toHaveLength(0)
})

test('permission denial preserves the draft and closing releases recognition', async ({ page }) => {
  const text = page.getByLabel('Your thought, idea, or brain dump')
  await text.fill('Keep this thought.')
  await page.getByRole('button', { name: 'Speak your thoughts' }).click()
  await page.evaluate(() =>
    (window as unknown as { voiceTest: { active: Recognition } }).voiceTest.active.onerror?.({
      error: 'not-allowed',
    }),
  )
  await expect(page.getByRole('alert')).toContainText('denied')
  await expect(text).toHaveValue('Keep this thought.')
  await expect(text).not.toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: 'Speak your thoughts' }).click()
  await page.getByRole('button', { name: 'Keep draft and close' }).click()
  expect(
    await page.evaluate(
      () => (window as unknown as { voiceTest: { aborts: number } }).voiceTest.aborts,
    ),
  ).toBe(2)
  expect(await page.evaluate(() => localStorage.getItem('focus.draft.local'))).toBe(
    'Keep this thought.',
  )
})

test('unsupported browsers keep a functional text capture', async ({ page }) => {
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const browser = window as unknown as {
      SpeechRecognition?: unknown
      webkitSpeechRecognition?: unknown
    }
    browser.SpeechRecognition = undefined
    browser.webkitSpeechRecognition = undefined
  })
  await page.getByRole('button', { name: 'Something on your mind?', exact: true }).click()
  await expect(page.getByText(/Voice capture isn’t available/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Speak your thoughts' })).toHaveCount(0)
  await page.getByLabel('Your thought, idea, or brain dump').fill('Typed instead.')
  await page.getByRole('dialog').getByRole('button', { name: 'Capture', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
