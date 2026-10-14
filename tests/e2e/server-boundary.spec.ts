import { test, expect } from '@playwright/test'

test('local server protects secret files and requires authentication for AI', async ({
  request,
}) => {
  // Check statuses only; never include credentials or secret file bodies in test output.
  for (const path of [
    '/.dev.vars',
    '/.env.local',
    `/@fs/${process.cwd().replaceAll('\\', '/')}/.dev.vars`,
  ]) {
    const response = await request.get(path)
    expect([403, 404]).toContain(response.status())
  }
  const response = await request.post('/api/ai', {
    data: { purpose: 'interpret', text: 'Synthetic test' },
  })
  expect([401, 503]).toContain(response.status())
  expect(response.headers()['content-type']).toContain('application/json')
})
