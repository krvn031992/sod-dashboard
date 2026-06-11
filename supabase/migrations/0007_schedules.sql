-- ============================================================================
-- State of Dance — Internal Operating Dashboard
-- Migration 0007 · Employee schedule
-- ----------------------------------------------------------------------------
-- Depends on 0001 (profiles, helpers). CEO/COO set who is on duty; everyone can
-- view the monthly schedule and their own shifts.
-- ============================================================================

create table if not exists public.schedules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  work_date  date not null,
  shift      text,            -- e.g. "9:00 AM – 6:00 PM" or "Morning"
  branch     text,
  note       text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists schedules_date_idx on public.schedules (work_date);
create index if not exists schedules_user_idx on public.schedules (user_id, work_date);

alter table public.schedules enable row level security;
alter table public.schedules force row level security;

-- Everyone can see the schedule (their own + who is on duty each day).
drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules for select to authenticated
  using (true);

-- Only CEO / COO manage it.
drop policy if exists schedules_write on public.schedules;
create policy schedules_write on public.schedules for all to authenticated
  using (public.my_role() in ('ceo', 'coo'))
  with check (public.my_role() in ('ceo', 'coo'));
