import { expect, it } from 'vitest'
import { isPublicSupabaseKey } from '../src/domain/config'
it('allows only browser-safe Supabase keys', () => {
  expect(isPublicSupabaseKey('sb_publishable_example')).toBe(true)
  expect(isPublicSupabaseKey('sb_secret_example')).toBe(false)
  const token = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`
  expect(isPublicSupabaseKey(token('anon'))).toBe(true)
  expect(isPublicSupabaseKey(token('service_role'))).toBe(false)
  expect(isPublicSupabaseKey('not-a-key')).toBe(false)
})
