# Deployment guide

Stack: **Vercel** (app + cron) + **Supabase** (Postgres with pgvector). Total setup ≈ 30 minutes.

## 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (EU region for GDPR).
2. Copy both connection strings (Settings → Database):
   - Transaction pooler (port 6543) → `DATABASE_URL` (append `?pgbouncer=true`)
   - Session/direct (port 5432) → `DIRECT_URL`
3. Apply migrations from your machine:
   ```
   cd app
   npx prisma migrate deploy
   npm run db:seed   # optional demo data (MAMAJ Furniture)
   ```
   The `knowledge_embeddings` migration enables the `vector` extension automatically.
4. Enable daily backups (Settings → Database → Backups — on by default for paid plans).

## 2. App (Vercel)

1. Push the `app/` folder to a GitHub repo, import it in Vercel (framework: Next.js).
2. Set the environment variables — see [.env.example](.env.example). Minimum to go live:
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `GROQ_API_KEY`, `JOBS_SECRET`,
   `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`.
3. Deploy. `vercel.json` already schedules the automations cron
   (`GET /api/v1/jobs/run` every 15 min, authorized via `CRON_SECRET`).
4. Add your custom domain and set `NEXT_PUBLIC_APP_URL` to it, then redeploy.

## 3. Per-feature activation

| Feature | Needs | Where |
|---|---|---|
| Email (reminders, resets, quotes) | Verified domain at Resend | `RESEND_API_KEY`, `EMAIL_FROM` |
| Billing | Stripe account, products/prices, webhook → `/api/v1/billing/webhook` (events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) | `STRIPE_*` env vars |
| Semantic knowledge search | OpenAI key | `OPENAI_API_KEY` |
| Google Calendar | OAuth app, redirect URI `…/api/v1/integrations/google/callback` | `GOOGLE_CLIENT_ID/SECRET` |
| WhatsApp | Meta app per business | Dashboard → Integrations |
| Messenger / Instagram | Meta app + linked Page | Dashboard → Integrations |
| Phone / missed calls / SMS | Twilio number per business | Dashboard → Integrations |
| CMS product sync | — | Dashboard → Integrations → API keys |

Channel webhook URLs are shown on the Integrations page after connecting; they're
per-tenant (`/api/v1/channels/…/[integrationId]`) and signature-verified.

## 4. Post-deploy smoke test

1. Sign up → onboarding creates the org.
2. Add a product + a FAQ, open `/demo` (or the widget) and ask about both.
3. Book an appointment in chat → check Appointments + (if connected) Google Calendar.
4. Dashboard → Automation → **Run now** → confirm reminders/follow-ups fire.
5. `curl -H "Authorization: Bearer <api key>" $APP_URL/api/v1/products` → catalog JSON.

## Known operational limits

- **Rate limiting is in-memory** — fine on a single Vercel region; move to
  Upstash Redis before scaling out.
- **WhatsApp follow-ups outside the 24h window** need approved template
  messages; free-form sends are rejected by Meta.
- **Channel credentials are stored unencrypted** in Postgres — add
  application-level encryption (e.g. AES-GCM with a KMS key) before SOC2/enterprise sales.
- Webhook processing (LLM reply) runs inside the request — keep Vercel
  function `maxDuration` ≥ 30s for chat/webhook routes if replies get slow.
