import { z } from 'zod'
import { supabase } from './supabase'
import { aiResultSchema } from './ai-schema'
export { aiResultSchema } from './ai-schema'
export type AIResult = z.infer<typeof aiResultSchema>
export type AIPurpose = 'interpret' | 'phases' | 'next_action' | 'stuck' | 'reflect'
export async function askAI(purpose: AIPurpose, text: string): Promise<AIResult> {
  if (!supabase)
    throw new Error(
      'AI needs a configured server and a signed-in account. You can organize this yourself below.',
    )
  const { data } = await supabase.auth.getSession()
  if (!data.session)
    throw new Error(
      'AI is available in a signed-in cloud workspace. Your local workspace remains fully usable.',
    )
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ purpose, text }),
    signal: AbortSignal.timeout(45000),
  })
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error(
      'The AI endpoint is unavailable in this preview. Use manual organization, or configure Cloudflare Pages Functions.',
    )
  const result = await response.json()
  if (!response.ok)
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : 'AI is unavailable. Your text is safe; continue manually.',
    )
  return aiResultSchema.parse(result)
}
