import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import ai from '../api/ai'
import account from '../api/account'

afterEach(() => vi.unstubAllEnvs())
it('passes runtime bindings into the existing authenticated AI endpoint', async () => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example')
  vi.stubEnv('GROQ_API_KEY', 'synthetic-test-only')
  const result = await ai.fetch(new Request('https://focus.example/api/ai', { method: 'POST' }))
  expect(result.status).toBe(401)
  expect(await result.json()).toEqual({ error: 'Sign in to use AI assistance.' })
})
it('keeps deletion explicitly unavailable without its server-only key', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
  expect(
    (await account.fetch(new Request('https://focus.example/api/account', { method: 'DELETE' })))
      .status,
  ).toBe(503)
})
it('keeps Vercel and Pages security policies consistent, including microphone access', () => {
  const pages = readFileSync('public/_headers', 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s+\S+:/.test(line))
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
  for (const line of pages) {
    const separator = line.indexOf(':')
    expect(vercel.headers[0].headers).toContainEqual({
      key: line.slice(0, separator).trim(),
      value: line.slice(separator + 1).trim(),
    })
  }
  expect(vercel.headers[0].headers).toContainEqual({
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=()',
  })
})
