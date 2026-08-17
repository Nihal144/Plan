# The Plan

A task planner with Google sign-in and profile pairing. Next.js 16 (App Router) +
Supabase (Postgres, Auth, RLS).

Phase 1 scope: sign in, get a rotating 4-digit invite code, pair with one other
profile. **Paired profiles share no data yet** — that boundary is enforced by RLS,
so phase 2 is a policy change rather than a security retrofit.

## Setup

Nothing works until steps 1–4 are done; the app needs real Supabase credentials.

### 1. Create the Supabase project

Create a project at [supabase.com](https://supabase.com), then go to
**Project Settings → API Keys** and stay on the **"Publishable and secret API keys"**
tab. Copy the **Project URL** and the **publishable key** (`sb_publishable_…`) into
`.env.local`:

```bash
cp .env.local.example .env.local
```

Use the publishable key, not a legacy `anon` JWT — the legacy tab is the older
scheme and is being phased out. Never put the `sb_secret_…` key in this file:
nothing here needs it, and the `NEXT_PUBLIC_` prefix would ship it to the browser.

### 2. Run the migrations

Every file in `supabase/migrations/`, in numeric order — not just `0001`. Paste each
into the Supabase **SQL Editor**, or use the CLI:

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

**Already have a project part-way through?** Pasting migrations by hand leaves no
migration history, so `supabase db push` would try to replay `0001` and fail. Run
`0005_done_flag.sql` instead — it is idempotent and lands the current schema from any
earlier point (`0002`, `0003`, a half-applied `0004`, or a complete one).

Note that `0004` is superseded: it moved completion into a `task_completions` table,
and `0005` folds it back into a `done` boolean on the task. On a fresh project you can
run `0001` → `0002` → `0005` and skip `0003`/`0004` entirely.

A missing column is quiet rather than loud — it surfaces as a "Nothing scheduled" day
plus a `[dal:…]` line in the server log, not as an error page.

### 3. Create the Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
**Create credentials → OAuth client ID → Web application**, add this authorised
redirect URI (from Supabase → Authentication → Providers → Google):

```
https://YOUR-PROJECT.supabase.co/auth/v1/callback
```

### 4. Enable Google in Supabase

**Authentication → Providers → Google**: paste the client ID and secret from step 3.
Then under **Authentication → URL Configuration**, add to Redirect URLs:

```
http://localhost:3000/auth/callback
```

### 5. Run it

```bash
npm install
npm run dev
```

## How pairing works

A 4-digit code is only 10,000 values — enumerable in seconds. Four controls make it
safe, and each one is load-bearing:

| Control | Why it's there |
|---|---|
| Codes expire in 15 min and are single-use | Uniqueness is only needed among *live* codes, so there's no 10,000-user cap, and the brute-force window is minutes rather than forever |
| No `SELECT` policy on `invite_codes` | Otherwise the REST API would hand out every active code. Lookup happens only inside `redeem_invite_code()` |
| Redeeming creates a *request*, not a pair | The owner must accept, so a guessed code yields a spam inbox rather than a silent stranger pairing |
| 5 redemption attempts per 15 min | Without it, an attacker can still spray requests at all 10,000 codes |

`pair_members.user_id` is `UNIQUE`, which is what enforces "one partner at a time."
A `pairs(user_a, user_b)` table can't express that with plain unique indexes — a
user could sit in `user_a` of one row and `user_b` of another.

## Architecture notes

- **`src/proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention. Published
  Supabase SSR guides are still written against `middleware.ts`.
- Proxy does **optimistic** checks only — it verifies the JWT locally via
  `getClaims()` and never touches the database. Real authorisation lives in
  `src/lib/dal.ts` and in RLS.
- No auth checks in layouts: they don't re-render on navigation and don't stop
  sibling segments from rendering. Every page calls `requireUser()` itself.
- Server Actions are treated as public endpoints and re-verify the session.
- `public/planner.html` is the phase-0 standalone prototype, kept for reference.
  It still works over `file://` and shares no code with the app.

## Phase 2

Sharing tasks across a pair, groups larger than two, notifications, realtime sync,
and migrating any leftover `planner.html` localStorage data.
