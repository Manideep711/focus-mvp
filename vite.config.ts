import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { isPublicSupabaseKey } from './src/domain/config.ts'
import { focusApiPlugin } from './scripts/vite-api.ts'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (env.VITE_SUPABASE_PUBLISHABLE_KEY && !isPublicSupabaseKey(env.VITE_SUPABASE_PUBLISHABLE_KEY))
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anon key. Secret/service-role keys must never be bundled into the browser.',
    )
  if (env.VITE_SUPABASE_URL) {
    const url = new URL(env.VITE_SUPABASE_URL)
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('Use an HTTP or HTTPS Supabase project URL.')
  }
  if (!!env.VITE_SUPABASE_URL !== !!env.VITE_SUPABASE_PUBLISHABLE_KEY)
    throw new Error(
      'Set both Supabase public variables, or leave both empty for local development.',
    )
  return {
    resolve: { alias: { '@': resolve(process.cwd(), 'src') } },
    plugins: [react(), tailwindcss(), focusApiPlugin()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'react-runtime', test: /node_modules[\\/]react(?:-dom)?[\\/]/, priority: 30 },
              {
                name: 'motion',
                test: /node_modules[\\/](?:motion|framer-motion|motion-dom|motion-utils)[\\/]/,
                priority: 20,
              },
              { name: 'ui-primitives', test: /node_modules[\\/]@radix-ui[\\/]/, priority: 20 },
              { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
            ],
          },
        },
      },
    },
    server: {
      fs: {
        // Preserve Vite's sensitive-file defaults and also protect Cloudflare local secrets.
        deny: [
          '**/.env',
          '**/.env.*',
          '**/.dev.vars',
          '**/.dev.vars.*',
          '**/*.{crt,pem}',
          '**/.git/**',
        ],
      },
    },
    test: { include: ['tests/**/*.test.ts'] },
  }
})
