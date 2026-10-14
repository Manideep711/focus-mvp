# Focus

A calm personal attention and execution system. Capture what is on your mind, choose a few commitments, work on one action, and adapt your plan to what actually happened.

Built with React, TypeScript, Vite, Tailwind CSS, Supabase, and Cloudflare Pages Functions. AI is optional and never changes workspace data by itself.

## Run locally

Use Node 22.12+ (Node 24 is recommended).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No external credentials are needed for a **local workspace**. It is real persistent browser storage, clearly labeled in the UI; it is not simulated cloud persistence. It does not sync across devices. Export from Settings before clearing browser data.

New workspaces start empty. Settings has an explicit **Try a clearly labeled example** action, available only in an empty local workspace. It adds editable sample goals, a resource, and commitments, with no fabricated session history. Undo or reset it from Settings.

Capture with **N** outside an input or dialog. **Ctrl/Cmd + Enter** saves a capture. Unsubmitted capture drafts and open timers are retained on this device, scoped to the local workspace or signed-in account.

## What is implemented

- Quiet Today by default: one chosen action and its next step. **See my day** reveals the complete plan; the view choice lasts for the browser session.
- A finite **Today / Later** card deck with touch/mouse swipes, keyboard-accessible buttons, targeted undo, optional smaller portions, and an early stopping option. Later leaves an action unchosen; it does not reschedule it.
- Optional five-minute starts, an editable first-step cue, long context behind disclosure, and a calm resting state after completed work. See [attention design and evidence](docs/ATTENTION-DESIGN.md) for research sources and limitations; Focus is not a clinical treatment.
- Four responsive destinations: Today, Goals, Inbox, Progress. Focus is entered from an action.
- Multiline capture, local draft recovery, manual organization into notes, ideas, goals, projects, resources, and actions; archive, restore, and confirmed deletion.
- Optional voice-to-text in quick capture and Clear my head, using browser SpeechRecognition where available. Microphone access begins only after a click. Stop to edit and explicitly save; audio is not stored by Focus. Browser providers may process audio online. Permission/network errors preserve the draft; unsupported browsers offer typing and device dictation. Requires HTTPS or localhost, browser support, and a working microphone; language availability depends on the speech provider. No additional API key is needed. See [browser speech API details](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
- Goals with lifecycle, reasons, dates, pause reminders, notes, linked projects/resources, manual/editable/reorderable phases, and next actions.
- Resource progress and optional totals, units, targets, links, and notes. Completing a resource does not complete a goal.
- Tasks independent of daily commitments, estimates for a day's portion, scheduled clock times, optional daily priority, time and energy settings, reordering, completion, and undo.
- Deterministic suggestions with explanations. Paused/later goals and blocked work are excluded. Explicit emergency capture shows capacity impact and moves only selected commitments.
- Focus durations, custom duration, timestamp-based pause/resume, refresh recovery, notes, actual duration, and explicit outcomes. Expired timers pause at their target; they never complete tasks automatically.
- Partial progress without a timer, a resume note, optional resource progress when recording work, stuck help, and a one-action overwhelmed flow.
- Daily review, explicit replanning with reasons, smaller next steps, historical plan changes, weekly attention reset, and progress history without scores or streaks.
- Supabase email-link auth, optional Google OAuth, session persistence, sign-out, relational persistence, RLS, atomic saves, and conflict detection.
- Optional structured AI interpretation, phases, next-action/stuck assistance, and reflection. Users review the exact text to send and edit or reject suggestions. Core functionality remains usable without AI.
- Data export, confirmed local reset, and a server-side account deletion endpoint.

## Supabase setup

1. Create a Supabase project. From its API settings, copy the **project URL** and **publishable key**. Never place a secret or service-role key in a `VITE_*` variable.
2. Apply `supabase/migrations/20261014120826_focus_workspace.sql` to your new project. You can run that file in the dashboard SQL Editor, or use the Supabase CLI migration workflow after linking your project. Back up an existing database before applying migrations.
3. Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_GOOGLE_AUTH_ENABLED=false
```

4. In **Authentication → URL Configuration**, set the production Site URL and allow the local development URL (`http://127.0.0.1:5173`) and your production origin as redirect URLs.
5. Enable email sign-in. Email links need functioning email delivery; configure your project's SMTP provider for production usage. The UI reports delivery errors and shows a sent-link confirmation, not a fabricated signed-in user.
6. For Google, enable the provider, configure its client ID/secret and authorized Supabase callback URL, then set `VITE_GOOGLE_AUTH_ENABLED=true`. Email sign-in and local development work without Google.

Data API grants and RLS policies are both included in the migration. Every owned row has an authenticated owner policy. Composite foreign keys prevent linking to another account's task, goal, project, resource, inbox item, or plan—even if its UUID is known. The functions that load and save data run as the caller with RLS intact.

The quota helper is deliberately privileged, kept in the unexposed `private` schema, accepts no owner argument, requires `auth.uid()`, and changes only that caller's quota. Clients have no mutation permissions on quota rows.

See the official [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

## AI and account deletion: server configuration

The frontend calls same-origin `/api/ai`; the server validates a Supabase access token against Auth, reserves an atomic per-user allowance (20 requests per hour), calls Groq Chat Completions with a strict JSON schema, and validates the result again. It sends only the text the user reviewed. Provider output never performs mutations. A dev-only Vite middleware serves this endpoint locally; Cloudflare Pages Functions serves it in production.

Set these **server runtime bindings/secrets** in Cloudflare (or `.dev.vars` for local Pages development):

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
GROQ_API_KEY=YOUR_PRIVATE_GROQ_KEY
AI_MODEL=openai/gpt-oss-20b
# Only required for account deletion, never used for routine workspace saves or AI:
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
```

The default is `openai/gpt-oss-20b`, hosted on Groq and supported for strict structured outputs. You can override `AI_MODEL` with another Groq model that supports strict JSON schemas. No OpenAI API key, Next.js registry block, or SSR cookie library is needed for this Vite SPA. Groq's Chat Completions API does not support the `store` parameter, so Focus does not send it or make storage guarantees based on that flag. Consult [Groq's data policies](https://console.groq.com/docs/your-data) before sending sensitive content; local work and drafts remain on the device until explicitly shared or synced.

Unconfigured AI returns an explicit unavailable response and offers manual organization. Copy `.dev.vars.example` to `.dev.vars` and set your server credentials, then restart `npm run dev` to use the local API bridge. `.dev.vars` is ignored by Git and is read only by server code. AI requires a signed-in cloud account; local workspace mode remains usable without AI. The account endpoint verifies the requester, revokes global sessions, then deletes only that verified Auth account; owned database rows cascade from `auth.users`.

See [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [Groq API reference](https://console.groq.com/docs/api-reference), and [Pages Functions](https://developers.cloudflare.com/pages/functions/).

## Vercel deployment

Import the GitHub repository and select the Vite preset, `npm run build`, and output directory `dist`. `api/ai.ts` and `api/account.ts` use Vercel's Node.js Web Request handlers and delegate to the same validated server implementation. `vercel.json` supplies security headers, permits same-origin microphone access, and allows 60 seconds for API calls. Navigation uses hash routes, so no catch-all rewrite should hide the API routes.

Import `.env.vercel.local` into the project's environment variables if you generated it locally. That file contains private credentials and is ignored by Git. The required names are `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_GOOGLE_AUTH_ENABLED`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GROQ_API_KEY`, and `AI_MODEL`. `SUPABASE_SERVICE_ROLE_KEY` is optional for account deletion only. Set Production and, if needed, Preview scopes, then redeploy. Never prefix server secrets with `VITE_`.

In Supabase Authentication URL Configuration, set the production Site URL to your deployed origin and add that origin to Redirect URLs. Google stays disabled until its OAuth credentials are configured. Live email delivery and microphone recognition still require browser verification on the deployed site.

## Cloudflare Pages deployment (alternative)

1. Connect this repository to a Pages project.
2. Use `npm run build` as the build command and `dist` as the output directory.
3. Add the three public `VITE_*` variables to the build environment. Add the server-only variables above to Functions runtime settings, keeping the Groq and service-role keys as secrets. Configure preview and production environments separately. Local `.dev.vars` files are not deployed as production secrets.
4. Deploy. Pages discovers the root `functions/` directory. `public/_routes.json` limits Functions execution to `/api/*`; navigation uses hash routes.
5. Add the deployed origin to Supabase redirect URLs, verify email and Google sign-in, then test cloud saving with two accounts before public launch.

The supplied Content Security Policy allows the standard `*.supabase.co` endpoints. Add your exact host to `connect-src` if you use a custom Supabase domain.

For local Functions testing after a frontend build:

```sh
npm run build
npx wrangler pages dev dist
```

Use the local origin printed by Wrangler in your Supabase redirect allowlist. Do not commit `.dev.vars`.

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover planning, time accounting, goal eligibility, local dates, and timer behavior. Database tests execute the real migration in embedded PostgreSQL (PGlite), with a minimal Auth schema/roles for exercising RLS, cross-owner foreign keys, transaction rollback, revision conflicts, and quotas. Browser tests run the local user journeys on desktop and mobile Chromium. These tests do not verify an external Supabase deployment, real email delivery, Google OAuth, or live provider responses.

The browser test runner handles OneDrive reparse-point files by materializing test specifications into an ignored staging directory when needed. Original test files are preserved. See [UI sources and adaptations](docs/UI-SOURCES.md) for the shared shadcn controls and restrained Magic UI/Aceternity effects.

For an explicit live smoke test using a synthetic thought only, run `node scripts/check-integrations.mjs`. This contacts your configured Supabase Auth endpoint and Groq provider, may consume a small provider allowance, and prints statuses without credentials. It does not create users, send email, or change workspace data.

## Architecture and boundaries

`src/domain/` holds entity types, validation, deterministic planning rules, dates, and optional sample data. `src/services/` holds persistence and AI boundaries. `src/state/` owns workspace changes and the local timer. `src/components/` contains reusable dialogs and controls; `src/pages/` contains the four destinations and the execution screen. `functions/api/` contains server-only API handlers.

Tasks describe work. Daily plans and commitments describe a user's decisions on particular local dates. Focus sessions describe actual work, including partial progress. Reviews and plan events retain context. Completing a task today does not rewrite an earlier day's commitment as completed.

Cloud v1 uses a normalized relational database and an atomic workspace snapshot RPC. A profile revision lock prevents concurrent devices from silently overwriting each other's work; stale saves ask the user to reload. Failed saves leave the previous state intact. This favors a simple, consistent personal workspace over a complex synchronization layer. It is bounded at 8 MB and 20,000 rows per collection; large histories should move to paginated entity queries and mutation RPCs before approaching that limit. It does not implement automatic merge or full offline cloud editing.

The current session timer is device-local until the outcome is saved; recorded sessions are persisted in the workspace. Work time is attributed to the session's start date in the configured timezone. Clock estimates are suggestions, and unestimated tasks remain explicitly unestimated. Goal resume dates prompt reconsideration without automatic activation. Unfinished commitments do not roll forward silently.

## Before public launch

Configure and verify your Supabase project, email/OAuth providers, production runtime secrets, and production origins. Exercise two real accounts to confirm ownership isolation. Verify account deletion with a disposable account. Set provider spend limits, configure monitoring for Functions failures, and review your privacy policy for the actual services you use. Local `.env.local` and `.dev.vars` are ignored by Git and blocked from Vite file serving. Successful live API smoke tests are separate from verifying a full signed-in user journey. Public hosting still requires deployment.
