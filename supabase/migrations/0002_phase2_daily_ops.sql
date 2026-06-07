-- ============================================================================
-- State of Dance — Internal Operating Dashboard
-- Migration 0002 · Phase 2 (Daily ops): tasks, endorsements, attendance
-- ----------------------------------------------------------------------------
-- Depends on 0001 (profiles, roles, helper functions: is_manager_plus, etc.).
-- Apply in the Supabase SQL editor after 0001.
-- ============================================================================

-- ---- Tasks --------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  assigned_to  uuid references public.profiles (id) on delete set null,
  assigned_by  uuid references public.profiles (id) on delete set null,
  due_date     date,
  status       text not null default 'open'
               check (status in ('open', 'in_progress', 'done', 'blocked')),
  created_at   timestamptz not null default now()
);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);

-- ---- Endorsements (daily) -----------------------------------------------
-- completed / blocked / next + two role-tied numbers (labels chosen in the UI).
create table if not exists public.endorsements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  work_date       date not null default ((now() at time zone 'Asia/Manila')::date),
  completed       text,
  blocked         text,
  next            text,
  metric_one      integer,
  metric_two      integer,
  synced_to_sheet boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, work_date)
);
create index if not exists endorsements_user_date_idx
  on public.endorsements (user_id, work_date desc);

-- ---- Attendance ---------------------------------------------------------
-- Server timestamps are the payroll record; the selfie only proves presence.
create table if not exists public.attendance (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  work_date            date not null,
  check_in_ts          timestamptz,
  check_out_ts         timestamptz,
  check_in_photo_url   text,    -- storage path in the private 'attendance' bucket
  check_out_photo_url  text,
  unique (user_id, work_date)
);
create index if not exists attendance_user_date_idx
  on public.attendance (user_id, work_date desc);

-- Force server-side timestamps + work_date; never trust client clocks.
create or replace function public.attendance_server_ts()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    new.work_date    := (now() at time zone 'Asia/Manila')::date;
    new.check_in_ts  := now();
    new.check_out_ts := null;
  elsif (tg_op = 'UPDATE') then
    new.work_date   := old.work_date;
    new.check_in_ts := old.check_in_ts;           -- immutable once set
    if new.check_out_photo_url is not null and old.check_out_ts is null then
      new.check_out_ts := now();                  -- stamp checkout on the server
    else
      new.check_out_ts := old.check_out_ts;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attendance_ts on public.attendance;
create trigger trg_attendance_ts
  before insert or update on public.attendance
  for each row execute function public.attendance_server_ts();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.tasks        enable row level security;
alter table public.tasks        force  row level security;
alter table public.endorsements enable row level security;
alter table public.endorsements force  row level security;
alter table public.attendance   enable row level security;
alter table public.attendance   force  row level security;

-- ---- Tasks ----
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (assigned_to = auth.uid() or assigned_by = auth.uid() or public.is_manager_plus());

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_manager_plus() and assigned_by = auth.uid());

-- Assignee may update (e.g. status); managers may update any.
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (assigned_to = auth.uid() or public.is_manager_plus())
  with check (assigned_to = auth.uid() or public.is_manager_plus());

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_manager_plus());

-- ---- Endorsements ----
drop policy if exists endorsements_select on public.endorsements;
create policy endorsements_select on public.endorsements for select to authenticated
  using (user_id = auth.uid() or public.is_manager_plus());

drop policy if exists endorsements_insert on public.endorsements;
create policy endorsements_insert on public.endorsements for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists endorsements_update on public.endorsements;
create policy endorsements_update on public.endorsements for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- Attendance ----
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.is_manager_plus());

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- Private storage bucket for attendance selfies (signed-URL access only)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('attendance', 'attendance', false)
on conflict (id) do nothing;

-- Each user uploads into a folder named by their own uid:  <uid>/<file>.jpg
drop policy if exists attendance_upload on storage.objects;
create policy attendance_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attendance'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read own selfies; managers+ can read all (for verification).
drop policy if exists attendance_read on storage.objects;
create policy attendance_read on storage.objects for select to authenticated
  using (
    bucket_id = 'attendance'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager_plus())
  );

-- No update/delete policies: attendance photos are immutable evidence.
