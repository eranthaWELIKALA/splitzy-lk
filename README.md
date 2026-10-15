# Splitzy

Split expenses with friends and groups — a Splitwise-style app built with React, TypeScript and
Supabase, hosted on GitHub Pages.

## Setup

### 1. Supabase

Splitzy keeps all of its tables in a `splitzy` schema, so it can share a Supabase project with other
apps. Logins are shared across the project: anyone with an account in the project can open Splitzy,
and their Splitzy profile is created on first visit.

1. **SQL Editor** → paste and run `supabase/migrations/20261014000000_init.sql`.
2. **Project Settings → Data API → Exposed schemas** → add `splitzy` and save.
3. **Authentication → URL Configuration → Redirect URLs** → add `http://localhost:5173/` and
   `https://<your-user>.github.io/<repo>/`. Leave the **Site URL** as it is — other apps rely on it.
4. **Emails.** Email confirmation and the email sender are project-wide, so don't turn them off just
   for Splitzy. Supabase's built-in sender is heavily rate-limited; for friends to sign up reliably,
   set up custom SMTP (e.g. a free Resend or Brevo account) under **Authentication → Emails → SMTP**.
   For local testing, create users under **Authentication → Users → Add user** with
   **Auto Confirm User** ticked.
5. **Project Settings → API Keys**: copy the project URL and the publishable (or anon) key.

### 2. Run locally

```bash
cp .env.example .env.local   # then fill in the two values
npm install
npm run dev
```

### 3. Deploy to GitHub Pages

1. Push this project to a GitHub repository (branch `main`).
2. **Settings → Secrets and variables → Actions** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. **Settings → Pages** → Source: **GitHub Actions**.
4. Push to `main` (or run the workflow manually). It lints, tests, builds and deploys.

The app uses hash URLs (`/#/groups/…`) because GitHub Pages can't route deep links to `index.html`.

### Installing the app

Splitzy is a progressive web app. Once deployed (or via `npm run build && npm run preview`), it can
be installed from **Settings → Appearance → Install app**, the browser's install icon, or on iPhone
via **Share → Add to Home Screen**. The app shell is cached for offline start; data always comes from
Supabase. After a deploy, open apps show a "new version available" prompt.

Icons are generated from `public/icon.svg` with `npm run generate-pwa-assets`.

## Scripts

| Command         | What it does                                         |
| --------------- | ---------------------------------------------------- |
| `npm run dev`   | Start the dev server                                 |
| `npm test`      | Unit tests, UI tests, and database tests (in PGlite) |
| `npm run lint`  | ESLint                                               |
| `npm run build` | Type-check and build to `dist/`                      |

## How it works

- `src/domain/` — pure split, balance and debt-simplification logic (amounts in integer cents).
- `src/lib/api.ts` — all Supabase reads and writes, mapping rows to domain types.
- `src/stores/` — Zustand stores for auth, data (refreshed after writes and via Realtime), theme and UI.
- `supabase/migrations/` — schema, row level security, validation and notification triggers.
  `supabase/schema.test.ts` runs the migration in PGlite and checks the policies as different users.

Friends you add by email are linked to their account when they sign up with that address, and they
see the expenses you've already shared. Notifications are written by database triggers and pushed
live with Supabase Realtime.
