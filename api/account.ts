import { onRequest } from '../functions/api/account.ts'

export default {
  fetch(request: Request) {
    return onRequest({
      request,
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    })
  },
}
