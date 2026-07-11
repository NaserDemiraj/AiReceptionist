# AI Receptionist

A multi-tenant SaaS platform that gives small businesses a **24/7 AI employee**: it answers
customers on their website, recommends products from a live catalog, captures leads, books
appointments, answers policy questions from a knowledge base, follows up automatically, and
hands off to humans when needed. Businesses also get a generated public website with the
assistant built in.

First flagship tenant: **MAMAJ Furniture** (demo data included). Languages: English,
Albanian, German (auto-detected per message).

## Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript + Tailwind v4 |
| Database | PostgreSQL (Supabase) + Prisma ORM |
| Auth | Auth.js v5 (credentials, JWT, org-scoped sessions) |
| AI | Groq (`llama-3.3-70b`) behind a provider-agnostic adapter (OpenAI-compatible; Anthropic/Google addable) |
| PDF | pdf-lib (quote generation) |
| Tests | Vitest |

## Getting started

```bash
npm install
cp .env.example .env      # fill in the values below
npx prisma migrate dev    # creates all tables
npm run db:seed           # loads the MAMAJ Furniture demo tenant
npm run dev               # http://localhost:3000
```

### Required environment variables (see `.env.example`)

- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres (transaction + session pooler)
- `AUTH_SECRET` — any long random string (`npx auth secret`)
- `GROQ_API_KEY` — free at console.groq.com
- `JOBS_SECRET` — protects the cron endpoint `POST /api/v1/jobs/run`

### Demo logins (after seeding)

| Role | Email | Password |
|---|---|---|
| Owner (MAMAJ) | `demo@mamaj.com` | `mamaj1234` |
| Agent (MAMAJ) | `ardit@mamaj.com` | `mamaj1234` |
| Second tenant | `demo@dentacare.com` | `mamaj1234` |

### Things to try

- `/demo` — a fake storefront with the embeddable chat widget; talk to the AI
- `/site/mamaj-furniture` — the generated public website (Website Builder output)
- Dashboard → Conversations — take over a chat from the AI as a human agent
- Dashboard → Knowledge Base — add an FAQ, then ask the widget about it

## Architecture map

```
src/
  app/
    (auth)/          login, signup, invite/[token]
    (dashboard)/     all admin screens (org-scoped via requireOrg())
    (legal)/         privacy, terms
    site/[slug]/     generated public websites (+ /products)
    widget/chat/     chat UI loaded inside the widget iframe
    api/v1/          public surface: chat, chat/rate, widget/config, jobs/run, ai/ping
  features/          feature modules: actions (server actions) + components + queries
  lib/
    ai/              provider abstraction, engine (tool-use loop), tools, language
    prisma.ts        singleton client
    org.ts           requireOrg() — the tenancy guard every query goes through
    jobs.ts          automations: appointment reminders + lead follow-ups
    rate-limit.ts    in-memory sliding window (swap for Redis when scaling out)
  components/        shared UI primitives + layout (sidebar, topbar)
public/widget.js     embeddable loader: <script src=".../widget.js" data-key="...">
```

**Multi-tenancy rule:** every business row carries `organizationId`; every dashboard query
goes through `requireOrg()`; the public chat API authenticates by per-org `widgetKey`.

**AI flow:** customer message → language detect → system prompt built from org profile +
AiConfig → Groq tool-use loop (`searchProducts`, `searchKnowledge`, `captureLead`,
`bookAppointment`, `requestHuman`) → reply persisted with metadata → notifications fired.

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm test           # vitest suite
npm run lint
npm run db:migrate # prisma migrate dev
npm run db:seed    # reseed demo data (wipes existing!)
npm run db:studio  # browse the database
```

In production, schedule `POST /api/v1/jobs/run` (Bearer `JOBS_SECRET`) every ~15 min for
reminders and follow-ups (e.g. Vercel Cron).

## Roadmap (needs external accounts)

Stripe billing · transactional email (Resend) — quote sending, password reset ·
WhatsApp/Instagram via Meta Business · missed-call recovery via Twilio ·
Google Calendar sync · product image uploads (Supabase Storage).
