# SMARTY AI

A standalone multi-model AI workspace built with Next.js. This repository is independent of the previous NOVA AI project and uses its own provider credentials and deployment.

## Current features
- Responsive dark interface.
- OpenRouter free-model selector and single-model chat.
- **Opt-in model comparison:** OFF by default; when enabled, exactly two selected models are queried in parallel.
- **Opt-in web search:** OFF by default; uses OpenRouter's web search server tool when enabled.
- Gemini Flash-Lite image analysis.
- Supabase email/password accounts.
- Cloud-synced chat history with per-user Row Level Security.
- Markdown, code formatting, and image uploads.
- API keys remain server-side.

## Required services and environment variables

Create a new Supabase project and add these variables in Vercel → Project → Settings → Environment Variables:

- `OPENROUTER_API_KEY` — from https://openrouter.ai/keys
- `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable/anon key
- `NEXT_PUBLIC_APP_URL` — deployed SMARTY AI URL

Use only the Supabase publishable/anon key in the browser. Never put a Supabase service-role key in a `NEXT_PUBLIC_*` variable or in client code.

## Supabase database setup

1. Open the Supabase project → SQL Editor.
2. Open `supabase/schema.sql` from this repository.
3. Run the full SQL script. It creates the chats table and enables Row Level Security so each account can only read/write its own conversations.
4. In Supabase → Authentication → URL Configuration, add the Vercel production URL to the allowed redirect/site URLs.
5. In Authentication → Providers, ensure Email is enabled. Configure email confirmation as desired.

## Deploy / update

Vercel should automatically deploy each commit to `main`. After adding or changing environment variables, redeploy the latest deployment. Install dependencies with `npm install`; run locally with `npm run dev`.

For local development, copy `.env.example` to `.env.local` and fill in the values. Do not commit `.env.local` or real keys.

## Usage and cost controls

- Comparison is disabled by default. Turning it ON sends at most two model requests for a prompt; turning it OFF sends only one.
- Web search is disabled by default. OpenRouter web search may incur separate search-provider charges in addition to model usage. It is mutually exclusive with comparison in the current UI to avoid doubling search calls.
- Free model availability, rate limits, and provider quotas can change. Free models are not unlimited.
- Cloud chat history is account-specific. Row Level Security is enabled in the supplied SQL schema.
