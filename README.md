# Split-wise

Splitwise-inspired expense sharing MVP — groups, equal splits, balances, and settle-up. Built with React, TypeScript, Tailwind, and Supabase.

## Live demo

_Add your Vercel URL after deploy_

## Features

- Create groups with 2+ members
- Add shared expenses (equal split, partial participation)
- View per-person balances and simplified debts
- Record settlements from suggested debts
- Activity feed (expenses + settlements)
- Demo seed: **Weekend Trip** group

## Local setup

```bash
npm install
cp .env.example .env
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### Database

1. Create a [Supabase](https://supabase.com) project (free tier).
2. Run migration: paste `supabase/migrations/001_initial.sql` in SQL Editor, or use Supabase CLI.
3. Run seed: paste `supabase/seed.sql` in SQL Editor.

### Run app

```bash
npm run dev
npm test        # balance unit tests
npm run build
```

## Deploy

- **Frontend:** Vercel — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Database:** Supabase (same project as local).

## AI workflow

Requirements and decisions live in [`AI_CONTEXT.md`](./AI_CONTEXT.md). Implementation plan: [`BUILD_PLAN.md`](./BUILD_PLAN.md).

## Tech stack

- React 19 + Vite + TypeScript
- Tailwind CSS
- React Router
- Supabase (Postgres, RLS disabled for demo)
- Vitest
# spree-tail-tester
