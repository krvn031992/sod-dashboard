# State of Dance — Internal Operating Dashboard

A mobile-first internal operating dashboard for State of Dance (SOD). It speeds up
the decisions that move retention and revenue and gives the CEO one place to see the
state of the business. Built per `SOD_CEO_Dashboard_BuildPrompt.md`.

> This app is **separate** from the public ticketing site at the repo root. It lives
> entirely in `dashboard/`.

- **Front end:** React + Vite + Tailwind v4 (mobile-first, deployable to GitHub Pages)
- **Backend:** Supabase (Postgres + Auth + Storage + Row-Level Security)
- **Routing:** HashRouter (static-host friendly)

---

## Build phases

The app is built in phases (see the spec, §8).

**Phase 1 — Spine (complete):**
- Email/password auth via Supabase
- `profiles` table with five roles across three tiers, enforced by RLS
- Profile view/edit (role/email/active locked to the CEO)
- CEO dashboard home (overview shell) + role-aware navigation
- Team & permissions screen (CEO assigns roles, branches, active status)
- Full SOD brand styling — plum / gold / cream, Space Grotesk + Open Sans, no glow

**Phase 2 — Daily ops (complete):**
- **Attendance** — selfie check-in/out; the **server** sets the timestamp (the
  payroll record), the photo only proves presence. Photos in a private Storage
  bucket (signed-URL access). Managers see today's roster.
- **Daily endorsement** — completed / blocked / next + two role-tied numbers
  (Admin Mgr: enrollments + re-enrollments; Marketing: content + leads; Admin
  Staff: inquiries + follow-ups). One per day, editable; last-7-days history.
- **Tasks** — managers assign with due date + status; everyone works their own
  queue; managers see all queues.

**Phase 3 — Oversight (complete):**
- **Ledger** — combined income/expense across branches with running totals; input
  by CEO + Admin Manager, edit/delete by CEO. Every create/edit/delete writes an
  **immutable row to `ledger_audit`** via a DB trigger — history can't be altered.
- **Approvals** — anyone submits items for sign-off; CEO approves/rejects with a
  note. Decisions are **permanent** (a DB trigger locks a row once decided and
  stamps who/when).
- **Announcements** — CEO/COO post (with an urgent flag that surfaces on every
  dashboard); everyone reads.

**Staff administration (in-app):** the CEO/COO add logins, and the CEO resets
passwords and removes members, via the `manage-staff` Edge Function (service-role
key stays server-side). Everyone can change their own password on Profile.

**Phase 4 — Strategy (complete):**
- **Retention** — re-enrollment rate year-over-year, by branch and by class format,
  computed from `customers` (master_customer_id groups a person across years).
- **Weekly scoreboard** — the five self-benchmarking metrics, entered per week by
  CEO/COO; competitor names are manual context only.
- **Goal board** — company goals with owner, target, current, and progress.
- **Yearly calendar** — recitals, enrollment windows, terms, deadlines, by month.

Scoreboard, goals and calendar are readable by everyone and editable by CEO/COO;
retention is manager-only with data entry by CEO/Admin Manager.

**Phase 5 — Comms (complete):**
- **Team chat** — a live team channel in Postgres (`messages`) with Supabase
  Realtime; everyone reads and posts; attachments are links (Drive upload handled
  outside the DB). Authors delete their own; CEO can moderate.

All five phases are built. Apply migrations in order: `0001` → `0002` → `0003` →
`0004` → `0005`. Deploy the Edge Function in `supabase/functions/manage-staff/`
(Supabase dashboard → Edge Functions).

Remaining to go fully live for the team: publish to GitHub Pages (the attendance
camera needs https off localhost).

---

## Running locally

```bash
cd dashboard
npm install
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
npm run preview    # serve the production build
```

### Demo mode (no backend)

With no Supabase credentials present, the app runs in **demo mode**: an in-memory
backend powers the UI so the team can preview every screen and role. The login screen
shows one button per role. Nothing persists — it resets on reload.

---

## Connecting Supabase (going live)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
   The anon key is safe in the client — **RLS** is what enforces access. Never put the
   service-role key here.
3. Open the Supabase SQL editor and run the migration:
   `supabase/migrations/0001_phase1_spine.sql`
   This creates the roles, the `profiles` table, the new-user trigger, RLS helper
   functions, and all policies.
4. Restart `npm run dev`. The login screen now does real email/password auth and the
   demo buttons disappear.

### Bootstrap the first CEO

New accounts default to the least-privileged role. After you create your own account
(through the login screen or Supabase Auth), promote it once via the SQL editor:

```sql
update public.profiles
set role = 'ceo', full_name = 'Your Name'
where email = 'you@stateofdance.com';
```

From then on the CEO promotes everyone else from the **Team** screen.

---

## Permissions (Phase 1)

Enforced server-side by RLS — the UI only hides what a role can't do.

| | CEO | COO | Admin Mgr | Admin Staff | Marketing |
|---|---|---|---|---|---|
| Manage users & roles | ✅ | — | — | — | — |
| Edit anyone's profile | ✅ | — | — | — | — |
| Edit own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Full CEO overview home | ✅ | ✅ | ✅ | — | — |

The complete capability matrix (ledger, approvals, attendance, etc.) is encoded in
`src/lib/roles.js` and will be wired to features in later phases.

---

## Live site

**https://krvn031992.github.io/sod-dashboard/** — published from the `gh-pages`
branch of the `krvn031992/sod-dashboard` repo (separate from the ticketing site).

### Redeploying after changes

The repo's token lacks `workflow` scope, so there's no CI — deploys are a local
build pushed to `gh-pages`. From `dashboard/`:

```bash
bash deploy.sh
```

That builds with the keys in `.env.local` (anon key only — public-safe) and force-
pushes the result to `gh-pages`; it's live again in ~1 minute. The build uses a
relative `base` + HashRouter so it works under the `/sod-dashboard/` sub-path.

---

## Project layout

```
dashboard/
├── index.html
├── .env.example                # copy to .env.local
├── supabase/migrations/        # SQL: schema + RLS
└── src/
    ├── lib/        supabase client, roles/capabilities, demo data
    ├── context/    AuthContext (live + demo modes)
    ├── components/ AppShell, Logo, icons, UI primitives
    └── pages/      Login, Dashboard, Profile, Team
```

## Security notes (per spec §7)

- RLS is enabled and **forced** on `profiles`; logged-out requests read nothing.
- Privileged columns (role, email, active) are pinned by a DB trigger so only the CEO
  can change them — not just hidden in the UI.
- Profiles are deactivated (`active = false`), never deleted, to preserve history.
- The service-role key never ships to the client.
