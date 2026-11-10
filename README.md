# SMARTY AI

A standalone multi-model AI workspace built with Next.js. This repository is independent of the previous NOVA AI project and uses its own provider credentials and deployment.

## Included in this first build
- Responsive dark interface with local chat history.
- Model selector populated from OpenRouter's available free models.
- Server-side OpenRouter chat endpoint.
- Optional Gemini 2.5 Flash image analysis endpoint.
- Markdown and code formatting.
- API keys stay server-side and are not exposed to the browser.

## Run locally
1. Install Node.js 20 or later.
2. Copy .env.example to .env.local.
3. Add OPENROUTER_API_KEY. Add GEMINI_API_KEY to enable image analysis.
4. Run npm install and npm run dev.
5. Open http://localhost:3000.

## Fresh provider accounts
- OpenRouter: https://openrouter.ai/keys
- Google AI Studio: https://aistudio.google.com/apikey

Use new accounts and new keys for this project. Do not paste API keys into source files or commit them to GitHub.

## Deploy to a new Vercel account
Import this repository into the new Vercel account. Add OPENROUTER_API_KEY and optionally GEMINI_API_KEY under Project Settings → Environment Variables. Set NEXT_PUBLIC_APP_URL to the deployed URL and redeploy.

Free model availability and provider quotas can change. Free models can be rate-limited or unavailable. This project does not promise unlimited free usage.

## Storage limitation in this version
Chat history is stored in browser local storage. It stays on that browser/device and does not sync between devices. Cloud accounts and synced history can be added as a separate phase.
