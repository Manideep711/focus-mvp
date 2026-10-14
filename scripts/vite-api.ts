import type { Plugin } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { Readable } from 'node:stream'
import { onRequest as ai } from '../functions/api/ai.ts'
import { onRequest as account } from '../functions/api/account.ts'

/** Dev-only middleware. Runtime secrets are never returned in Vite's client configuration. */
export function focusApiPlugin(): Plugin {
  return {
    name: 'focus-server-api',
    apply: 'serve',
    configureServer(server) {
      const secretPath = resolve(server.config.root, '.dev.vars')
      const fromFile = existsSync(secretPath) ? parseEnv(readFileSync(secretPath, 'utf8')) : {}
      const keys = [
        'SUPABASE_URL',
        'SUPABASE_PUBLISHABLE_KEY',
        'GROQ_API_KEY',
        'AI_MODEL',
        'SUPABASE_SERVICE_ROLE_KEY',
      ] as const
      const env = Object.fromEntries(keys.map((key) => [key, process.env[key] || fromFile[key]]))
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
        const handler =
          url.pathname === '/api/ai' ? ai : url.pathname === '/api/account' ? account : null
        if (!handler) {
          next()
          return
        }
        try {
          const headers = new Headers()
          for (const [name, value] of Object.entries(req.headers)) {
            if (value !== undefined)
              headers.set(name, Array.isArray(value) ? value.join(', ') : value)
          }
          const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers }
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>
            init.duplex = 'half'
          }
          const response = await handler({ request: new Request(url, init), env })
          res.statusCode = response.status
          response.headers.forEach((value, name) => res.setHeader(name, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error:
                'The local API could not respond. Restart the dev server and continue manually if needed.',
            }),
          )
        }
      })
    },
  }
}
