# AI_CONTEXT.md — Splitwise MVP (Source of Truth)

> Last updated: 2026-05-28 (Round 3 complete)  
> Status: **Implementation in progress** (Day 1–2 complete locally; deploy + Supabase setup = Day 3)

---

## 1. Project overview

| Field | Value |
|-------|-------|
| Project name | split-wise |
| Assignment | Reverse-engineer Splitwise; scope realistic 3-day MVP; build deployed app |
| Team | Solo |
| Timeline | 3 days from email receipt |
| Effort | ~6–8 hours/day |
| Repo | Public GitHub required |
| AI workflow | Documented; this file + `BUILD_PLAN.md` must allow reproducibility |

### Success criteria (priority order)

1. Working public deployment
2. Product thinking / realistic scoping
3. Clean code structure (explainable architecture)
4. Documentation: `AI_CONTEXT.md`, `BUILD_PLAN.md`
5. Public GitHub repo
6. Basic testing (not extensive)

### Personal success

- Finish end-to-end MVP
- Deploy successfully
- Architecture clean enough to explain in review

---

## 2. Tech stack (decided)

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + TypeScript (strict) + Vite |
| Styling | Tailwind CSS — Splitwise-inspired green/teal |
| Routing | React Router |
| State | React Context (no heavy state libs) |
| Forms | Controlled inputs |
| API / DB | Supabase (Postgres) — direct client, no custom backend |
| Business logic | Client-side |
| Realtime | No |
| Deploy frontend | Vercel |
| Deploy DB | Supabase |
| Env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| CI | Manual deploy |
| Constraints | No paid services; React/TS preferred |

### Libraries to use

- Tailwind
- Supabase JS client
- React Router

### Libraries to avoid

- Heavy state management (Redux, Zustand, etc.)

---

## 3. Product scope

### Core promise (one sentence)

Users can create a group, add shared expenses, and instantly see who owes whom.

### User personas

- College trip with friends
- Roommates
- Group size: **2–8 members**
- Evaluators: seeded demo data + ability to create new groups

### Platform

- Responsive, **mobile-first**

### Splitwise alignment

**Used lightly. Important flows:**

- Create group
- Add expenses
- See balances
- Settle up

**Mimic:**

- Group-based expense sharing
- Balances summary
- Add expense flow

**Top 3 MVP screens:**

1. Group list
2. Group detail
3. Add expense modal/form

**Explicitly NOT building:**

- Multi-currency (per-group single currency only)
- Receipt scanning
- Payment integrations
- User registration/login
- Multiple split types (equal only)
- Notifications
- Profile/settings
- Friends list
- 1:1 expenses (outside groups)
- Categories/tags
- Attachments
- Recurring expenses

### Feature checklist

| Feature | MVP |
|---------|-----|
| User registration/login | OUT |
| Create group | IN |
| Add members to group | IN |
| Add expense | IN |
| Edit/delete expense | IN |
| Multiple split types | OUT (equal only) |
| Record settlement | IN |
| View who owes whom (simplified) | IN |
| Per-person balance in group | IN |
| Activity/history | IN |
| Notifications | OUT |
| Profile/settings | OUT |
| Friends list | OUT |
| 1:1 expenses | OUT |
| Categories | OUT |
| Attachments | OUT |
| Multi-currency | OUT |
| Recurring | OUT |

### If only 4 features ship

1. Create group
2. Add members
3. Add expense
4. Balances + settle up

### Cut if time runs short (first cut)

- **Edit/delete expense** (optional in acceptance checklist)
- History polish

### Must not cut

- Group creation
- Add expense
- Balances
- Deploy

### Risks

- Balance math correctness
- UI polish

---

## 4. Authentication & users

| Decision | Value |
|----------|-------|
| Auth | **None** — demo/local-style app |
| User profile | Name only |
| Same user in multiple groups | Yes (same `User` row can appear in multiple groups via `GroupMember`) |
| Guest / placeholder members | Yes — manual name entry |
| Who can create a group | Anyone (no auth gate) |

### “Current user” (no login)

- On **first visit**, prompt for name once.
- Store in **`localStorage`** (e.g. key `splitwise_current_user_name`).
- Used for UI attribution only; **no server-side permission checks** (trust-based demo).

### Creating / reusing members

| Rule | Behavior |
|------|----------|
| Add member by name | Look up member in **this group** with same name (**case-insensitive**); if found, reuse; else create `User` + `GroupMember` |
| Reuse scope | **Within same group only** |
| Duplicate names in one group | **Not allowed** — compare `lower(trim(name))`; enforce in UI + DB (§8) |
| Remove member | **IN** only if member has **no** transaction history (no expenses paid, no participant rows, no settlements from/to); otherwise **block** with error message |

---

## 5. Groups

| Field | Value |
|-------|-------|
| name | Required |
| description | Optional |
| currency | Single per group; **INR default** |
| Roles | Everyone equal |
| Add members | Manual name entry |
| Leave group | Not required |
| Delete group | Yes — **hard delete** with DB cascade (§8, §11) |
| Create group UX | **Modal on `/`** — requires **≥ 2 total members** to submit |
| Member limit | **Soft guideline** 2–8 (show hint only; do not hard-block) |
| Add members | **Create-group modal** and **group detail** page |
| Delete group | **Confirm dialog** on **group detail only** (not on list) |

### Group list card (`/`)

Each card shows:

- Group **name**
- **Member count**
- **Total group spend** (sum of expense amounts)
- **Last activity** (max `createdAt` across expenses and settlements in group)

Sort groups by last activity descending (recommended).

---

## 6. Expenses

### Add expense flow

1. Open group
2. Click “Add expense”
3. Enter description
4. Enter amount
5. Select payer (group member only)
6. Choose participants
7. Save

### Fields

| Field | Required |
|-------|----------|
| description | Yes |
| amount | Yes |
| payer | Yes (`paidByUserId`) |
| participants | Yes |
| created date | Auto **`now()`** on save — no date picker in UI |

### Rules

| Rule | Value |
|------|-------|
| Amount | Decimals allowed; **minimum ₹0.01** |
| Default split | Equal among **selected** participants |
| Default participants (add modal) | **All group members** pre-selected |
| Split types | Equal only |
| Partial participation | Yes — exclude members from expense |
| Edit/delete | Any group member; same modal as add |
| List sort | Newest first |

### Split calculation (equal)

- Divide `amount` equally among selected participants
- **2 decimal places**
- If uneven division: **last participant gets remainder**
- **“Last participant” order:** sort participants **alphabetically by display name** (ascending); last in that order receives the rounding remainder
- Store per-participant `shareAmount` on `ExpenseParticipant`

### Expense UI

| Item | Value |
|------|-------|
| Add expense | **Modal** on group detail page |
| Edit/delete expense | IN (any member); same modal/form as add |

---

## 7. Settlements & balances

| Decision | Value |
|----------|-------|
| Balance display | Net per user **and** simplified “A owes B ₹X” |
| Settlement | **Separate entity** (not an expense type) |
| Partial settlements | Yes |
| Simplify debts | Yes — **greedy** largest creditor / largest debtor |
| Rounding | 2 decimals |
| Unequal split remainder | Last participant (alphabetical by name) |
| Negative balances | Allowed |
| Leave group with balance | Out of scope |
| Edit/delete settlement | **OUT** for MVP |

### Net balance formula (confirmed)

For each user `U` in group `G`:

```
net(U) = Σ(expenses in G where paidBy = U).amount
       − Σ(expense participants in G where user = U).shareAmount
       + Σ(settlements in G where toUser = U).amount
       − Σ(settlements in G where fromUser = U).amount
```

- Positive net → user is owed money (creditor)
- Negative net → user owes money (debtor)

### Debt simplification (greedy)

**Input:** map of `userId → net`. Treat **|net| < ₹0.01 as zero** (exclude from simplify / display as settled).

**Algorithm:**

1. Build lists of creditors (net > 0) and debtors (net < 0), sorted by **absolute net descending**.
2. While debtors and creditors remain:
   - Take **largest debtor** (most negative) and **largest creditor** (most positive).
   - Transfer `min(|debtor.net|, creditor.net)` from debtor → creditor as one simplified debt edge.
   - Update both nets; remove anyone whose net rounds to ~0.
3. Output list of `{ fromUserId, toUserId, amount }` for UI.

**Seed reference** (Weekend Trip, after settlement): D→A ₹4,400; B→A ₹2,800; C→A ₹1,200 (see §12).

### Settle-up UI flow

1. User on **group detail** clicks **“Settle up”**.
2. **Modal** opens showing **simplified debts** list.
3. User **selects a debt row** (debtor → creditor).
4. **Amount pre-filled** with that row’s amount (user may adjust for partial settlement).
5. User confirms → insert `Settlement` row → **close modal**.
6. **Balances + feed refresh immediately** (client recalculates; refetch from Supabase).

| Manual settlement (not on simplified list) | **OUT** — must pick a suggested debt row |
| All settled empty state | **“All settled up! 🎉”** |
| Partial settlement amount | User may lower pre-filled amount; validate **> 0** and **≤ selected debt amount** |

---

## 8. Data model

All IDs: **UUID**. Deletes: **hard delete**. Audit: **`createdAt` only** (no `updatedAt` / `createdBy`).

### User

```
id: uuid (PK)
name: string
createdAt: timestamp
```

### Group

```
id: uuid (PK)
name: string
description: string | null
currency: string (default 'INR')
createdAt: timestamp
```

### GroupMember

```
id: uuid (PK)
groupId: uuid (FK → Group, ON DELETE CASCADE)
userId: uuid (FK → User)
displayName: text NOT NULL   -- name shown in this group
createdAt: timestamp
UNIQUE (group_id, lower(display_name))  -- case-insensitive uniqueness per group
```

### Expense

```
id: uuid (PK)
groupId: uuid (FK → Group)
description: string
amount: decimal(12,2)
paidByUserId: uuid (FK → User)
createdAt: timestamp
```

### ExpenseParticipant

```
id: uuid (PK)
expenseId: uuid (FK → Expense)
userId: uuid (FK → User)
shareAmount: decimal(12,2)
```

### Settlement

```
id: uuid (PK)
groupId: uuid (FK → Group)
fromUserId: uuid (FK → User)
toUserId: uuid (FK → User)
amount: decimal(12,2)
createdAt: timestamp
```

### Database rules

| Rule | Implementation |
|------|----------------|
| RLS | **Disabled** (demo only — anon key has open access) |
| Migrations | **SQL files in repo** under `supabase/migrations/` |
| Delete group | `ON DELETE CASCADE` to `group_members`, `expenses`, `expense_participants`, `settlements` |
| Duplicate member name | `group_members.display_name` + unique index on `(group_id, lower(display_name))` |
| `users.name` | Set to `display_name` on create; may differ across groups for different `User` rows |

---

## 9. UI & routing

### Routes

| Path | Screen |
|------|--------|
| `/` | Group list (landing) + **create group modal** |
| `/groups/:id` | Group detail |

### Modals (no extra routes)

| Modal | Trigger |
|-------|---------|
| Create group | `/` — “New group” (or similar) |
| Add / edit expense | Group detail — “Add expense” / edit on row |
| Settle up | Group detail — “Settle up” |
| First-visit name | App shell — if no `localStorage` name |

### Navigation (top nav)

- **App title** (links home `/`)
- **Home** link
- **Current user name** (from `localStorage`)

### Group detail layout

**Summary cards (3):**

1. **Total group spend** — sum of expense amounts
2. **Your balance** — net for member whose `display_name` matches current user (**case-insensitive**); if no match, show **“Not in this group”**
3. **Number of expenses** — count of expense rows
- Members section
- **Activity feed** — single chronological list (newest first):
  - expense created events
  - settlement events
  - **hard delete** removes item from feed entirely
- Balances section (per-person net + simplified debts)
- “Add expense” button
- “Settle up” button

### Style

- Splitwise-inspired green/teal + Tailwind
- Empty states: yes

### Accessibility / i18n

- Basic accessibility only
- i18n: out of scope
- Currency: **`formatINR(amount)`** → Indian grouping, e.g. `₹1,23,456.78` via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`

---

## 10. Frontend architecture

```
src/
  features/     # feature-based folders
  ...
```

| Concern | Choice |
|---------|--------|
| State | React Context |
| Routing | React Router |
| Forms | Controlled inputs |
| API | Supabase client |
| TypeScript | strict |

### Context & folders

| Context | Responsibility |
|---------|----------------|
| `AppContext` | `currentUserName` (localStorage), first-visit modal |
| `GroupsContext` | group list CRUD, aggregates for cards |
| `GroupDetailContext` | single group: members, expenses, settlements, balances |

```
src/
  components/       # shared UI (Modal, Button, TopNav, SummaryCard, …)
  contexts/
  features/
    groups/         # GroupList, CreateGroupModal, GroupCard
    group-detail/   # GroupDetailPage, Members, ActivityFeed, Balances
    expenses/       # ExpenseModal, expense helpers
    settlements/    # SettleUpModal
  lib/
    balances.ts     # net, split, simplifyDebts
    format.ts       # formatINR, normalizeName
    supabase.ts     # client
  types/
```

---

## 11. Backend / Supabase

| Decision | Value |
|----------|-------|
| Backend | Supabase only (no custom API server) |
| DB | Supabase Postgres |
| Access | Direct client from browser |
| Pagination | No |
| Errors | Simple `{ message }` shape in app layer |
| Realtime | No |

| RLS | **Disabled** on all tables |
| Migrations | In repo; apply via Supabase CLI or dashboard |
| Cascades | Group delete cascades all child rows |

---

## 12. Deployment & seed data

| Item | Value |
|------|-------|
| Frontend host | Vercel |
| DB host | Supabase |
| Seed demo data | Yes |
| Seed delivery | **Idempotent SQL script** in repo (`supabase/seed.sql` or similar) |
| CI | Manual |

### Demo group: “Weekend Trip”

| Field | Value |
|-------|-------|
| Group name | Weekend Trip |
| Currency | INR (default) |
| Description | Optional — not specified; use `null` or short demo blurb |

#### Members (4)

| Display name | Role in seed |
|--------------|--------------|
| Member A | Hotel payer |
| Member B | Taxi payer; receives settlement |
| Member C | Dinner payer |
| Member D | Pays settlement to B |

Each member is a `User` row + `GroupMember` row (see §4 — reuse by name within group only).

#### Expenses (3)

| # | Description | Amount (INR) | Paid by | Participants | Equal split shares |
|---|-------------|--------------|---------|--------------|-------------------|
| 1 | Hotel | 12,000 | Member A | A, B, C, D (all) | ₹3,000 each |
| 2 | Dinner | 2,400 | Member C | A, B, C, D (all) | ₹600 each |
| 3 | Taxi | 800 | Member B | Member B, Member D only | ₹400 each |

**Notes for seed script:**

- Expenses 1–2 divide evenly (no remainder).
- Expense 3: two participants → ₹400.00 each.
- Store `ExpenseParticipant.shareAmount` explicitly (do not rely on runtime-only splits in seed).
- Use stable `createdAt` ordering if tests depend on “newest first” (e.g. Hotel oldest, Taxi newest).

#### Settlement (1)

| From | To | Amount (INR) |
|------|-----|--------------|
| Member D | Member B | 400 |

Recorded as a `Settlement` row (`fromUserId` = D, `toUserId` = B).

### Expected balances (for tests & evaluator sanity)

**Formula (per user U in group):**

```
net(U) = Σ(expenses where U paid).amount
       − Σ(expense participants where user = U).shareAmount
       + Σ(settlements where toUser = U).amount
       − Σ(settlements where fromUser = U).amount
```

**After all expenses + settlement (seed data):**

| Member | Paid | Owed (shares) | Settlement Δ | **Net** |
|--------|------|---------------|----------------|---------|
| Member A | ₹12,000 | ₹3,600 | — | **+₹8,400** (owed money) |
| Member B | ₹800 | ₹4,000 | +₹400 received | **−₹2,800** (owes) |
| Member C | ₹2,400 | ₹3,600 | — | **−₹1,200** (owes) |
| Member D | ₹0 | ₹4,000 | −₹400 paid | **−₹4,400** (owes) |

Sum of nets = **₹0** (balanced).

**Expected simplified debts** (greedy algorithm, §7):

| Debtor | Creditor | Amount |
|--------|----------|--------|
| Member D | Member A | ₹4,400 |
| Member B | Member A | ₹2,800 |
| Member C | Member A | ₹1,200 |

Reference for manual QA. Unit tests use **invariants** (equal split shares, settlement direction, simplified debts sum = total owed) — not fixed net totals.

### Idempotent seed requirements

- Script safe to re-run (e.g. `INSERT ... ON CONFLICT`, or delete demo rows by fixed slug/seed key before insert).
- Prefer **fixed UUIDs** for demo entities so frontend/tests can reference them (document UUIDs in script comments).
- Document in README: run migrations → run seed → open app.

---

## 13. Testing

| Item | Value |
|------|-------|
| Runner | **Vitest** |
| Balance tests | `src/lib/balances.test.ts` — equal split shares; settlement updates nets; simplified debts sum invariant (no fixed seed totals) |
| Lint | ESLint default |
| Scope | Minimal; no e2e required for MVP |

---

## 14. Open questions

**None** — discovery complete (Rounds 1–3).

---

## 15. Changelog

| Date | Change |
|------|--------|
| 2026-05-28 | Initial context from Round 1 interview answers |
| 2026-05-28 | Seed data: Weekend Trip demo group, expected balances, idempotent SQL |
| 2026-05-28 | Round 2: identity, balance math, settle-up, Supabase, modals, activity feed |
| 2026-05-28 | Round 3: UI polish, validation, testing; discovery complete |
| 2026-05-28 | Approved BUILD_PLAN edits; Day 1–2 implemented (balances, UI, APIs) |
