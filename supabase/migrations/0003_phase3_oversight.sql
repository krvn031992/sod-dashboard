-- ============================================================================
-- State of Dance — Internal Operating Dashboard
-- Migration 0003 · Phase 3 (Oversight): ledger + audit, approvals, announcements
-- ----------------------------------------------------------------------------
-- Depends on 0001 (profiles, helpers). Apply after 0002.
-- ============================================================================

-- ---- Ledger -------------------------------------------------------------
create table if not exists public.ledger (
  id          uuid primary key default gen_random_uuid(),
  entry_date  date not null default ((now() at time zone 'Asia/Manila')::date),
  type        text not null check (type in ('income', 'expense')),
  category    text,
  amount      numeric(12, 2) not null check (amount >= 0),
  branch      text,
  note        text,
  entered_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ledger_date_idx on public.ledger (entry_date desc);

drop trigger if exists trg_ledger_touch on public.ledger;
create trigger trg_ledger_touch
  before update on public.ledger
  for each row execute function public.touch_updated_at();

-- ---- Ledger audit (immutable) -------------------------------------------
-- Written only by the trigger below; no user can insert/edit/delete here.
create table if not exists public.ledger_audit (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid,                       -- not an FK: survives row deletion
  action      text not null,              -- insert | update | delete
  old_value   jsonb,
  new_value   jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index if not exists ledger_audit_ledger_idx on public.ledger_audit (ledger_id, changed_at desc);

create or replace function public.ledger_write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.ledger_audit (ledger_id, action, old_value, new_value, changed_by)
    values (new.id, 'insert', null, to_jsonb(new), auth.uid());
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.ledger_audit (ledger_id, action, old_value, new_value, changed_by)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.ledger_audit (ledger_id, action, old_value, new_value, changed_by)
    values (old.id, 'delete', to_jsonb(old), null, auth.uid());
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ledger_audit on public.ledger;
create trigger trg_ledger_audit
  after insert or update or delete on public.ledger
  for each row execute function public.ledger_write_audit();

-- ---- Announcements ------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references public.profiles (id) on delete set null,
  title      text not null,
  body       text,
  urgent     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists announcements_created_idx on public.announcements (created_at desc);

-- ---- Approvals ----------------------------------------------------------
create table if not exists public.approvals (
  id           uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles (id) on delete set null,
  item_type    text,                      -- e.g. 'marketing_post', 'expense'
  title        text not null,
  detail       text,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists approvals_status_idx on public.approvals (status, created_at desc);

-- A decision is permanent: lock the row once it leaves 'pending', and stamp
-- who/when on the server side.
create or replace function public.approvals_decide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'pending' then
    raise exception 'This approval has already been decided and cannot be changed.';
  end if;
  if new.status <> 'pending' then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_approvals_decide on public.approvals;
create trigger trg_approvals_decide
  before update on public.approvals
  for each row execute function public.approvals_decide();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.ledger        enable row level security; alter table public.ledger        force row level security;
alter table public.ledger_audit  enable row level security; alter table public.ledger_audit  force row level security;
alter table public.announcements enable row level security; alter table public.announcements force row level security;
alter table public.approvals     enable row level security; alter table public.approvals     force row level security;

-- ---- Ledger ----  view: managers+; input: ceo/admin_mgr; edit/delete: ceo
drop policy if exists ledger_select on public.ledger;
create policy ledger_select on public.ledger for select to authenticated
  using (public.is_manager_plus());

drop policy if exists ledger_insert on public.ledger;
create policy ledger_insert on public.ledger for insert to authenticated
  with check ((public.my_role() in ('ceo', 'admin_manager')) and entered_by = auth.uid());

drop policy if exists ledger_update on public.ledger;
create policy ledger_update on public.ledger for update to authenticated
  using (public.is_ceo()) with check (public.is_ceo());

drop policy if exists ledger_delete on public.ledger;
create policy ledger_delete on public.ledger for delete to authenticated
  using (public.is_ceo());

-- ---- Ledger audit ----  read: managers+; no writes from clients
drop policy if exists ledger_audit_select on public.ledger_audit;
create policy ledger_audit_select on public.ledger_audit for select to authenticated
  using (public.is_manager_plus());

-- ---- Announcements ----  read: everyone; post/edit/delete: ceo/coo
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated
  using (true);

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements for insert to authenticated
  with check ((public.my_role() in ('ceo', 'coo')) and author_id = auth.uid());

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update to authenticated
  using (public.my_role() in ('ceo', 'coo')) with check (public.my_role() in ('ceo', 'coo'));

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.my_role() in ('ceo', 'coo'));

-- ---- Approvals ----  submit: all; view: own + managers; decide: ceo
drop policy if exists approvals_select on public.approvals;
create policy approvals_select on public.approvals for select to authenticated
  using (submitted_by = auth.uid() or public.is_manager_plus());

drop policy if exists approvals_insert on public.approvals;
create policy approvals_insert on public.approvals for insert to authenticated
  with check (submitted_by = auth.uid());

drop policy if exists approvals_update on public.approvals;
create policy approvals_update on public.approvals for update to authenticated
  using (public.is_ceo()) with check (public.is_ceo());
