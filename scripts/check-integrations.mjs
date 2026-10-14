import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { z } from 'zod'
import { aiResultSchema } from '../src/services/ai-schema.ts'

// Explicit opt-in live smoke test. Uses only a synthetic example and never prints secrets.
const env = { ...parseEnv(readFileSync('.dev.vars', 'utf8')), ...process.env }
const settings = await fetch(`${env.SUPABASE_URL}/auth/v1/settings`, {
  headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
  signal: AbortSignal.timeout(10000),
})
let settingsSummary = {}
if (settings.ok) {
  const result = await settings.json()
  settingsSummary = { email: result.external?.email, google: result.external?.google }
}
console.log(
  JSON.stringify({ service: 'Supabase Auth', status: settings.status, ...settingsSummary }),
)
const schema = z.toJSONSchema(aiResultSchema)
delete schema.$schema
const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: env.AI_MODEL || 'openai/gpt-oss-20b',
    max_completion_tokens: 2000,
    messages: [
      {
        role: 'system',
        content:
          'Interpret this synthetic Focus capture. Return a concise summary, no clarifying question, and one editable task suggestion. Do not claim to change data.',
      },
      { role: 'user', content: 'Read one chapter of my book tomorrow.' },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'focus_suggestions', strict: true, schema },
    },
  }),
  signal: AbortSignal.timeout(30000),
})
let output = {
  service: 'Groq',
  status: response.status,
  model: env.AI_MODEL || 'openai/gpt-oss-20b',
}
if (response.ok) {
  const reply = await response.json()
  const choice = reply.choices?.[0]
  const parsed = aiResultSchema.safeParse(JSON.parse(choice?.message?.content || '{}'))
  output = {
    ...output,
    schema_valid: parsed.success,
    finish_reason: choice?.finish_reason,
    suggestion_count: parsed.success ? parsed.data.suggestions.length : 0,
  }
} else {
  // Do not echo provider errors: they can contain sensitive values or request content.
  output = {
    ...output,
    result:
      response.status === 401
        ? 'Invalid or revoked API key'
        : response.status === 429
          ? 'Provider rate limit'
          : 'Provider rejected the request',
  }
}
console.log(JSON.stringify(output))
if (!settings.ok || !response.ok || output.schema_valid !== true) process.exitCode = 1
