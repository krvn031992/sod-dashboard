-- ============================================================================
-- State of Dance — Internal Operating Dashboard
-- Migration 0004 · Phase 4 (Strategy): customers, benchmarks, goals, calendar
-- ----------------------------------------------------------------------------
-- Depends on 0001 (profiles, helpers). Apply after 0003.
-- ============================================================================

-- ---- Customers (powers the retention view) ------------------------------
-- One row per enrollment instance. master_customer_id groups the same person
-- across years so re-enrollment can be measured year over year.
create table if not exists public.customers (
  id                 uuid primary key default gen_random_uuid(),
  master_customer_id text not null,
  name               text,
  branch             text,
  class_format       text,
  enrolled_year      integer not null,
  recital_year       integer,
  status             text default 'active',
  created_at         timestamptz not null default now()
);
create index if not exists customers_master_idx on public.customers (master_customer_id);
create index if not exists customers_year_idx on public.customers (enrolled_year);

-- ---- Weekly benchmarking scoreboard -------------------------------------
-- Long format: one row per metric per week (self-benchmarking).
create table if not exists public.benchmark_metrics (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null,
  metric_name text not null,
  our_value   numeric,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (week_start, metric_name)
);
create index if not exists benchmark_week_idx on public.benchmark_metrics (week_start desc);

-- ---- Goal board ---------------------------------------------------------
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  target     numeric,
  current    numeric default 0,
  owner      uuid references public.profiles (id) on delete set null,
  due_date   date,
  status     text not null default 'active'
             check (status in ('active', 'done', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_goals_touch on public.goals;
create trigger trg_goals_touch
  before update on public.goals
  for each row execute function public.touch_updated_at();

-- ---- Yearly calendar ----------------------------------------------------
-- Stored in Postgres for consistency; a Sheet mirror can be added later.
create table if not exists public.calendar_events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  category   text,                 -- recital | enrollment | photoshoot | term | deadline | other
  event_date date not null,
  end_date   date,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists calendar_date_idx on public.calendar_events (event_date);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.customers         enable row level security; alter table public.customers         force row level security;
alter table public.benchmark_metrics enable row level security; alter table public.benchmark_metrics force row level security;
alter table public.goals             enable row level security; alter table public.goals             force row level security;
alter table public.calendar_events   enable row level security; alter table public.calendar_events   force row level security;

-- ---- Customers ----  view: managers+; input: ceo/admin_mgr; delete: ceo
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated
  using (public.is_manager_plus());

drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers for insert to authenticated
  with check (public.my_role() in ('ceo', 'admin_manager'));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
  using (public.my_role() in ('ceo', 'admin_manager'))
  with check (public.my_role() in ('ceo', 'admin_manager'));

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete to authenticated
  using (public.is_ceo());

-- ---- Benchmarks / Goals / Calendar ----  view: everyone; edit: ceo/coo
-- (helper applied to all three)
drop policy if exists benchmarks_select on public.benchmark_metrics;
create policy benchmarks_select on public.benchmark_metrics for select to authenticated using (true);
drop policy if exists benchmarks_write on public.benchmark_metrics;
create policy benchmarks_write on public.benchmark_metrics for all to authenticated
  using (public.my_role() in ('ceo', 'coo')) with check (public.my_role() in ('ceo', 'coo'));

drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals for select to authenticated using (true);
drop policy if exists goals_write on public.goals;
create policy goals_write on public.goals for all to authenticated
  using (public.my_role() in ('ceo', 'coo')) with check (public.my_role() in ('ceo', 'coo'));

drop policy if exists calendar_select on public.calendar_events;
create policy calendar_select on public.calendar_events for select to authenticated using (true);
drop policy if exists calendar_write on public.calendar_events;
create policy calendar_write on public.calendar_events for all to authenticated
  using (public.my_role() in ('ceo', 'coo')) with check (public.my_role() in ('ceo', 'coo'));
