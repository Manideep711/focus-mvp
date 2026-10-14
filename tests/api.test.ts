import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest as ai } from '../functions/api/ai'
import { onRequest as account } from '../functions/api/account'
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  GROQ_API_KEY: 'server-secret',
  AI_MODEL: 'configured-model',
}
const request = (body = { purpose: 'interpret', text: 'Learn a new skill' }, headers = {}) =>
  new Request('https://focus.example/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token', ...headers },
    body: JSON.stringify(body),
  })
afterEach(() => vi.unstubAllGlobals())
describe('server AI boundary', () => {
  it('rejects invalid Groq credentials without exposing the key or provider body', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"id":"user"}'))
      .mockResolvedValueOnce(new Response('true'))
      .mockResolvedValueOnce(new Response('private provider error', { status: 401 }))
    vi.stubGlobal('fetch', fetch)
    const result = await ai({ request: request(), env })
    const body = await result.json()
    expect(result.status).toBe(502)
    expect(body.error).toContain('Replace GROQ_API_KEY')
    expect(JSON.stringify(body)).not.toContain('server-secret')
    expect(JSON.stringify(body)).not.toContain('private provider error')
  })
  it('rejects truncated Groq output and uses the supported default model', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"id":"user"}'))
      .mockResolvedValueOnce(new Response('true'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'length', message: { content: '{"summary":"partial"}' } }],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const result = await ai({ request: request(), env: { ...env, AI_MODEL: undefined } })
    expect(result.status).toBe(502)
    expect(JSON.parse(fetch.mock.calls[2][1].body).model).toBe('openai/gpt-oss-20b')
  })
  it('returns a truthful unconfigured fallback without a provider call', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await ai({ request: request(), env: {} })).status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects cross-origin and invalid requests before contacting services', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(
      (await ai({ request: request(undefined, { Origin: 'https://other.example' }), env })).status,
    ).toBe(403)
    expect((await ai({ request: request({ purpose: 'interpret', text: '' }), env })).status).toBe(
      400,
    )
    expect(fetch).not.toHaveBeenCalled()
  })
  it('checks authentication and quota before sharing text with a provider', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetch)
    expect((await ai({ request: request(), env })).status).toBe(401)
    expect(fetch).toHaveBeenCalledTimes(1)
    fetch
      .mockReset()
      .mockResolvedValueOnce(new Response('{"id":"user"}'))
      .mockResolvedValueOnce(new Response('false'))
    expect((await ai({ request: request(), env })).status).toBe(429)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('validates provider output and never performs a workspace mutation', async () => {
    const response = {
      summary: 'An intention to learn.',
      clarifying_question: 'What would you like to learn?',
      suggestions: [],
    }
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"id":"user"}'))
      .mockResolvedValueOnce(new Response('true'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(response) } }],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const result = await ai({ request: request(), env })
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual(response)
    const providerBody = JSON.parse(fetch.mock.calls[2][1].body)
    expect(fetch.mock.calls[2][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer server-secret')
    expect(providerBody.messages[1].content).toBe('Learn a new skill')
    expect(providerBody.response_format.json_schema.strict).toBe(true)
    expect(providerBody.max_completion_tokens).toBe(2000)
    expect(providerBody).not.toHaveProperty('store')
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls.map((call) => call[0])).not.toContain(
      expect.stringContaining('save_workspace'),
    )
  })
  it('rejects malformed model output without claiming success', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"id":"user"}'))
      .mockResolvedValueOnce(new Response('true'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { finish_reason: 'stop', message: { content: '{"tasks":"silently created"}' } },
            ],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    expect((await ai({ request: request(), env })).status).toBe(502)
  })
})
describe('account deletion boundary', () => {
  it('requires server configuration and never accepts a client-supplied owner', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(
      (
        await account({
          request: new Request('https://focus.example/api/account', { method: 'DELETE' }),
          env: {},
        })
      ).status,
    ).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('revokes sessions before deleting only the verified account', async () => {
    const owner = '00000000-0000-4000-8000-000000000001'
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: owner })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    const response = await account({
      request: new Request('https://focus.example/api/account', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      }),
      env: { ...env, SUPABASE_SERVICE_ROLE_KEY: 'server-only' },
    })
    expect(response.status).toBe(200)
    expect(fetch.mock.calls[1][0]).toContain('/logout?scope=global')
    expect(fetch.mock.calls[2][0]).toBe(`${env.SUPABASE_URL}/auth/v1/admin/users/${owner}`)
  })
})
