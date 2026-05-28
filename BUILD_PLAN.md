# BUILD_PLAN.md — Splitwise MVP

> **Source of truth for requirements:** [`AI_CONTEXT.md`](./AI_CONTEXT.md)  
> **Status:** Approved. Day 1–2 implemented locally. Remaining: Supabase project + Vercel deploy (Day 3).

---

## 1. Goal

Ship a **publicly deployed**, mobile-first Splitwise-inspired app where users create groups, add shared expenses (equal split only), see balances + simplified debts, record settlements, and view activity — backed by **Supabase** and hosted on **Vercel**.

---

## 2. Out of scope (do not build)

Auth, multi-currency, unequal split types, settlement edit/delete, manual off-list settlements, notifications, profiles, friends, categories, attachments, recurring expenses, RLS, realtime, pagination, member leave flow, payment integrations.

---

## 3. Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│  Vercel (React 19 + Vite + Tailwind + React Router)     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ AppContext  │  │ GroupsContext│  │ GroupDetailCtx  │ │
│  └─────────────┘  └──────────────┘  └─────────────────┘ │
│         │                  │                  │         │
│         └──────────────────┴──────────────────┘         │
│                            │                            │
│                   lib/balances.ts (pure)                │
│                   lib/format.ts                         │
│                            │                            │
│                   Supabase JS client (anon)             │
└────────────────────────────┼────────────────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │ Supabase Postgres            │
              │ RLS: OFF                     │
              │ migrations/ + seed.sql       │
              └──────────────────────────────┘
```

**Business logic:** client-only (`balances.ts`). DB stores facts; UI derives nets and simplified debts.

---

## 4. Database schema

### Migration: `supabase/migrations/001_initial.sql`

Tables (all `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`):

| Table | Key columns | Notes |
|-------|-------------|-------|
| `users` | `name`, `created_at` | Global person record |
| `groups` | `name`, `description`, `currency DEFAULT 'INR'`, `created_at` | |
| `group_members` | `group_id`, `user_id`, `display_name`, `created_at` | `UNIQUE (group_id, lower(display_name))`; FK cascade on `group_id` |
| `expenses` | `group_id`, `description`, `amount NUMERIC(12,2)`, `paid_by_user_id`, `created_at` | cascade on `group_id` |
| `expense_participants` | `expense_id`, `user_id`, `share_amount` | cascade on `expense_id` |
| `settlements` | `group_id`, `from_user_id`, `to_user_id`, `amount`, `created_at` | cascade on `group_id` |

- Disable RLS on all tables (or enable with permissive policies — prefer **ALTER TABLE … DISABLE ROW LEVEL SECURITY**).
- Indexes: `group_members(group_id)`, `expenses(group_id)`, `expense_participants(expense_id)`, `settlements(group_id)`.

### Seed: `supabase/seed.sql`

- Idempotent: delete by fixed seed marker UUIDs or `WHERE id IN (...)` then insert.
- **Weekend Trip** group with Members A–D, 3 expenses, 1 settlement (see `AI_CONTEXT.md` §12).
- Fixed UUIDs documented in file comments.

---

## 5. Core libraries

### `src/lib/balances.ts`

| Function | Purpose |
|----------|---------|
| `calculateEqualShares(amount, participantIds, nameByUserId)` | Equal split; remainder to last **alphabetical** name |
| `calculateNetBalances(expenses, participants, settlements, memberIds)` | Per-user net; apply ₹0.01 zero threshold |
| `simplifyDebts(nets)` | Greedy largest creditor/debtor |
| `roundMoney(n)` | 2 decimal places |

### `src/lib/format.ts`

| Function | Purpose |
|----------|---------|
| `formatINR(n)` | `Intl.NumberFormat('en-IN', …)` |
| `normalizeName(s)` | `trim().toLowerCase()` for comparisons |

### Tests: `src/lib/balances.test.ts`

Do **not** assert exact seed totals (e.g. A +8400) — those can drift with rounding/seed changes.

Instead test:

1. **Equal split** — shares match expected per-participant amounts (including remainder on last alphabetical name)
2. **Settlement updates balances** — recording a settlement changes nets in the expected direction
3. **Simplified debts invariant** — sum of simplified debt amounts equals total amount owed by debtors (within ₹0.01)

---

## 6. UI specification

### Global

- **TopNav:** app title (link `/`), “Home”, current user name
- **First visit:** modal — enter name → `localStorage` key `splitwise_current_user_name`
- **Theme:** Tailwind, teal/green accents, mobile-first

### `/` — Group list

- Fetch all groups with aggregates:
  - member count
  - total spend = `SUM(expenses.amount)`
  - last activity = `MAX(expenses.created_at, settlements.created_at)`
- Sort by last activity desc
- **GroupCard:** name, member count, total spend (INR), relative last activity
- **“New group”** → **CreateGroupModal**
  - fields: name, optional description
  - add members (names, chips) — **at least 2 total members** required to create a group
  - soft hint: “Best for 2–8 people”
  - on save: create group + members + navigate to `/groups/:id`
- Empty state: “Create your first group”

### `/groups/:id` — Group detail

**Header:** group name, description, delete (confirm) → cascade delete → redirect `/`

**Summary cards:**

1. Total group spend  
2. Your balance (match `localStorage` name to `display_name`, case-insensitive)  
3. Number of expenses  

**Members section**

- List chips with `display_name`
- Add member input (detail page)
- Remove button: only if no transaction history; else toast/error

**Balances section**

- Per-member net list (hide |net| < 0.01)
- Simplified debts list
- If no debts: **“All settled up! 🎉”**

**Activity feed** (newest first)

- Union of expenses + settlements
- Row templates:
  - Expense: “{payer} paid {amount} for {description}”
  - Settlement: “{from} paid {to} {amount}”
- Edit/delete expense from row (opens modal)
- Hard delete removes row

**Actions:** “Add expense”, “Settle up”

### Modals

| Modal | Key behavior |
|-------|----------------|
| **ExpenseModal** | description, amount (min 0.01), payer select, participant checkboxes (default all), save → compute shares → insert expense + participants; `created_at` = now |
| **SettleUpModal** | list simplified debts; select row → amount pre-filled (editable down for partial); confirm → insert settlement |

---

## 7. Supabase access patterns

| Action | Tables |
|--------|--------|
| List groups | `groups` + subqueries/parallel fetch for aggregates |
| Group detail | `groups`, `group_members` + `users`, `expenses`, `expense_participants`, `settlements` |
| Create group | insert `groups`, for each name insert `users` + `group_members` (check dup case-insensitive) |
| Add member | lookup/create user, insert `group_members` |
| Remove member | delete `group_members` if no related rows |
| Add expense | insert `expenses` + bulk `expense_participants` |
| Edit expense | update expense; delete old participants; insert new |
| Delete expense | delete expense (cascade participants) |
| Settle | insert `settlements` |

Errors surfaced as `{ message: string }` toast or inline alert.

---

## 8. File checklist (implementation)

```
supabase/migrations/001_initial.sql
supabase/seed.sql
src/lib/supabase.ts
src/lib/balances.ts
src/lib/balances.test.ts
src/lib/format.ts
src/types/database.ts
src/contexts/AppContext.tsx
src/contexts/GroupsContext.tsx
src/contexts/GroupDetailContext.tsx
src/components/TopNav.tsx
src/components/Modal.tsx
src/components/SummaryCard.tsx
src/features/groups/GroupListPage.tsx
src/features/groups/GroupCard.tsx
src/features/groups/CreateGroupModal.tsx
src/features/group-detail/GroupDetailPage.tsx
src/features/group-detail/MembersSection.tsx
src/features/group-detail/BalancesSection.tsx
src/features/group-detail/ActivityFeed.tsx
src/features/expenses/ExpenseModal.tsx
src/features/settlements/SettleUpModal.tsx
src/App.tsx
src/main.tsx
README.md
.env.example
```

---

## 9. Three-day schedule

### Day 1 — Foundation (6–8h)

| Block | Tasks |
|-------|--------|
| Setup | Tailwind, React Router, Supabase client, env example |
| DB | Write migration + apply to Supabase; verify cascade |
| Lib | `balances.ts` + `format.ts` + Vitest tests (green) |
| Seed | `seed.sql` + run; verify data in dashboard |
| Shell | TopNav, AppContext name modal, routing skeleton |

**Exit:** tests pass; seed group visible in DB; app boots with routes.

### Day 2 — Core features (6–8h)

| Block | Tasks |
|-------|--------|
| Groups | List page + cards + aggregates; CreateGroupModal |
| Detail | GroupDetailPage layout + fetch; Members add/remove |
| Expenses | ExpenseModal add; activity feed; balances section |
| Polish | formatINR everywhere; empty states |

**Exit:** full flow create group → add expense → see balances (no settle yet).

### Day 3 — Settle, deploy, docs (6–8h)

| Block | Tasks |
|-------|--------|
| Settlements | SettleUpModal + refresh; partial amounts |
| Edit/delete | Expense edit/delete (cut if behind) |
| Delete group | Confirm on detail |
| Deploy | Vercel + env vars; smoke test production |
| Docs | README (setup, migrate, seed, deploy); sync `AI_CONTEXT.md` if drift |
| QA | Walk seed scenario manually; fix balance bugs |

**Exit:** public URL; README complete; GitHub pushed.

---

## 10. README outline

1. Project description + live demo link  
2. Screenshots (optional)  
3. Local setup: `npm i`, `.env`, `supabase db push` / run migration, seed  
4. `npm run dev` / `npm test` / `npm run build`  
5. Deploy steps (Vercel + Supabase)  
6. AI workflow note: built from `AI_CONTEXT.md`  

---

## 11. Environment variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## 12. Acceptance checklist

- [ ] Public Vercel URL loads
- [ ] First-visit name saved to localStorage
- [ ] Group list shows name, member count, total spend, last activity
- [ ] Create group with members (modal)
- [ ] Add expense: equal split, partial participants, min ₹0.01
- [ ] Balances + greedy simplified debts match seed expectations
- [ ] Settle up from suggested list only; balances refresh
- [ ] Activity feed shows expenses + settlements
- [ ] _(Optional / cut if behind)_ Expense edit/delete from activity feed
- [ ] Delete group with confirm (detail only)
- [ ] Seed “Weekend Trip” present after `seed.sql`
- [ ] `npm test` passes balance tests
- [ ] `AI_CONTEXT.md` reflects shipped behavior

---

## 13. Known risks & mitigations

| Risk | Mitigation |
|------|------------|
| Balance bugs | Unit tests first; manual seed checklist |
| Open Supabase anon | Accept for demo; document in README |
| “Your balance” no match | Show “Not in this group” |
| Time overrun | Drop expense edit/delete first (per `AI_CONTEXT.md`) |

---

## 14. Approval

**Approved** with edits: flexible balance tests; min 2 members on create; expense edit/delete optional in acceptance.

Implementation order: **Day 1 → Day 2 → Day 3**, updating `AI_CONTEXT.md` when behavior changes.
