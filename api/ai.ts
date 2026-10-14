import { onRequest } from '../functions/api/ai.ts'

export default {
  fetch(request: Request) {
    return onRequest({
      request,
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        AI_MODEL: process.env.AI_MODEL,
      },
    })
  },
}
