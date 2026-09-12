# Minecraft Server Assistant (MSA)

A real Minecraft-server-focused AI assistant with manual subscription codes, Supabase storage, an admin panel, and a server-side Gemini integration.

## What is included

- React + TypeScript + Vite frontend
- Dark, responsive SaaS/gaming UI
- AI chat UI with Minecraft server context
- Supabase PostgreSQL schema
- One-time subscription-code activation
- Secure HttpOnly subscription session cookie
- Server-side subscription validation
- Supabase Edge Functions
- Gemini API integration (API key stays server-side)
- Admin sign-in through Supabase Auth
- Admin code generation/list/revoke
- Server Doctor / Plugin Finder / Config Generator / Rank Builder / Command Helper / Compatibility Checker / Server Builder / MOTD Generator UI entry points

## Important

No Discord bot and no automatic payment system are included. Payment is manual as designed.

### Only two things are intentionally not bundled

1. Your Supabase project credentials.
2. Your Gemini API key.

Those secrets cannot safely be pre-filled into a downloadable project.

## Setup

### 1. Create a Supabase project

Create a project at Supabase.

Run `supabase/migrations/001_initial.sql` in the Supabase SQL editor.

### 2. Create the admin user

In Supabase Authentication, create the email/password user you will use for the admin panel.

Then run:

```sql
insert into public.admin_users (user_id)
select id from auth.users
where email = 'YOUR_ADMIN_EMAIL';
```

Replace the email.

### 3. Configure frontend

Copy `.env.example` to `.env` and fill:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The browser key is intended to be public. Do NOT put a Supabase secret key here.

### 4. Configure Edge Function secrets

Set these secrets in Supabase Edge Functions:

```text
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
FRONTEND_ORIGIN=https://YOUR-FRONTEND-DOMAIN
```

Supabase automatically provides its own server-side project secrets to Edge Functions.

### 5. Deploy the functions

Use the Supabase CLI, or paste each function into the Supabase Dashboard Edge Function editor.

Functions:

- activate-subscription
- ai-chat
- admin-subscriptions

The included `supabase/config.toml` disables the platform JWT check because the project uses:
- a custom HttpOnly subscription session for customers
- Supabase Auth bearer tokens for the admin

The functions perform their own authorization checks.

### 6. Install and run the frontend

```bash
npm install
npm run dev
```

For production:

```bash
npm run build
```

The production files are in `dist/`.

## Subscription flow

1. You manually verify a customer's payment through Discord.
2. In `/admin`, create a code and choose its duration.
3. Give the code to the customer.
4. Customer opens `/activate`.
5. The code is activated once.
6. The Edge Function creates a secure HttpOnly session cookie.
7. AI requests validate the subscription server-side.
8. When the expiry date passes, the subscription becomes unavailable.

## Security notes

- Gemini API key is never sent to the browser.
- Supabase secret keys are never sent to the browser.
- Subscription status is not trusted from localStorage.
- The activation code is stored with a SHA-256 lookup hash as well as the display code needed by the admin UI.
- RLS is enabled on sensitive tables and browser policies are intentionally absent.
- Customer sessions use an HttpOnly + Secure cookie.
- Do not commit `.env` or function secret files.

## Current architecture

Browser
  -> Supabase Edge Function
      -> validates subscription session
      -> Gemini API

Admin browser
  -> Supabase Auth
  -> admin-subscriptions Edge Function
      -> verifies admin_users
      -> Postgres

Browser
  -> activate-subscription Edge Function
      -> validates one-time code
      -> creates subscription session
