interface Environment {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
export async function onRequest({ request, env }: { request: Request; env: Environment }) {
  if (request.method !== 'DELETE') return json({ error: 'Use DELETE for account deletion.' }, 405)
  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: 'Cross-origin requests are not allowed.' }, 403)
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json(
      {
        error:
          'Account deletion needs the server-only SUPABASE_SERVICE_ROLE_KEY and Supabase configuration. Your account and data are still intact.',
      },
      503,
    )
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer '))
    return json({ error: 'Sign in before deleting your account.' }, 401)
  try {
    const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization }
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok)
      return json({ error: 'Your sign-in expired. Sign in again to delete the account.' }, 401)
    const user = (await response.json()) as { id: string }
    if (!/^[\da-f-]{36}$/i.test(user.id))
      return json({ error: 'Could not verify account identity.' }, 401)
    const logout = await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=global`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (!logout.ok)
      return json(
        { error: 'Could not revoke account sessions. Nothing was deleted; please retry.' },
        502,
      )
    const removal = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!removal.ok)
      return json(
        {
          error:
            'Sessions were revoked, but account deletion did not complete. Sign in again and retry or contact your project administrator.',
        },
        502,
      )
    return json({ deleted: true })
  } catch {
    return json(
      {
        error:
          'Account deletion could not be confirmed. Reload and check your sign-in before retrying.',
      },
      502,
    )
  }
}
