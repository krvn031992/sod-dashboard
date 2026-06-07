-- ============================================================================
-- State of Dance — Internal Operating Dashboard
-- Migration 0006 · Editable class offerings
-- ----------------------------------------------------------------------------
-- Depends on 0001 (profiles, helpers). The studio's class list, editable in-app
-- and used to populate the class-format dropdowns (e.g. retention).
-- ============================================================================

create table if not exists public.class_offerings (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name)
);

alter table public.class_offerings enable row level security;
alter table public.class_offerings force row level security;

-- Everyone can read the class list (dropdowns); leadership manages it.
drop policy if exists class_offerings_select on public.class_offerings;
create policy class_offerings_select on public.class_offerings for select to authenticated
  using (true);

drop policy if exists class_offerings_write on public.class_offerings;
create policy class_offerings_write on public.class_offerings for all to authenticated
  using (public.my_role() in ('ceo', 'coo', 'admin_manager'))
  with check (public.my_role() in ('ceo', 'coo', 'admin_manager'));

-- Seed with the studio's current formats (safe to run repeatedly).
insert into public.class_offerings (name) values
  ('Ballet'), ('Hip-hop'), ('Jazz'), ('Contemporary'), ('Adult')
on conflict (name) do nothing;
