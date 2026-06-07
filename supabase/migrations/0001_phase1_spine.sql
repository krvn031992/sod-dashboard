-- ============================================================================
-- State of Dance — Internal Operating Dashboard
-- Migration 0001 · Phase 1 (Spine): roles, profiles, RLS
-- ----------------------------------------------------------------------------
-- Apply in the Supabase SQL editor (or `supabase db push`).
-- This migration establishes the authentication spine and the permission
-- tiers from §4 of the build spec. Later phases add the remaining tables.
-- ============================================================================

-- ---- Roles --------------------------------------------------------------
-- Five roles across three tiers:
--   tier 1: ceo            (full control)
--   tier 2: coo            (near-full visibility, no user/permission control)
--   tier 3: admin_manager, admin_staff, marketing (scoped)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'ceo', 'coo', 'admin_manager', 'admin_staff', 'marketing'
    );
  end if;
end$$;

-- ---- Profiles -----------------------------------------------------------
-- One row per auth user. The id mirrors auth.users.id.
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '',
  role              public.app_role not null default 'admin_staff',
  email             text,
  branch            text,                          -- BGC | Manila | Quezon City
  profile_photo_url text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is
  'User directory + role assignment. Role drives all RLS across the app.';

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---- New-user provisioning ----------------------------------------------
-- When Supabase Auth creates a user, mirror it into profiles.
-- full_name / role / branch can be passed via auth metadata at invite time;
-- role defaults to the least-privileged tier.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, branch)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'admin_staff'),
    new.raw_user_meta_data ->> 'branch'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- RLS helper functions ------------------------------------------------
-- SECURITY DEFINER so they read profiles without re-triggering RLS
-- (prevents infinite policy recursion).
create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() = 'ceo';
$$;

-- ceo + coo + admin_manager: the "view all / manage" tier for most features
create or replace function public.is_manager_plus()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() in ('ceo', 'coo', 'admin_manager');
$$;

-- ---- Guard privileged columns -------------------------------------------
-- Only the CEO may change a profile's role, active flag, or email.
-- Everyone else editing their own profile is limited to name/branch/photo.
create or replace function public.guard_profile_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ceo() then
    if new.role     is distinct from old.role     then new.role     := old.role;     end if;
    if new.active   is distinct from old.active   then new.active   := old.active;   end if;
    if new.email    is distinct from old.email    then new.email    := old.email;    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_cols();

-- ---- Row-Level Security --------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Read: any authenticated team member can see the directory
-- (names/roles/photos power task assignment, chat, scoreboard).
-- Logged-out requests get nothing.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles for select
  to authenticated
  using (true);

-- Update own profile (privileged columns are pinned by the guard trigger).
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- CEO may update anyone.
drop policy if exists profiles_update_ceo on public.profiles;
create policy profiles_update_ceo
  on public.profiles for update
  to authenticated
  using (public.is_ceo())
  with check (public.is_ceo());

-- CEO may insert/deactivate directly if needed (normal path is the auth trigger).
drop policy if exists profiles_insert_ceo on public.profiles;
create policy profiles_insert_ceo
  on public.profiles for insert
  to authenticated
  with check (public.is_ceo());

-- No DELETE policy: profiles are deactivated (active = false), never removed.

-- ============================================================================
-- BOOTSTRAP THE FIRST CEO
-- ----------------------------------------------------------------------------
-- 1. Create your account through the app's login screen (or Supabase Auth).
-- 2. Find your user id in Authentication → Users, then run (service role):
--
--      update public.profiles
--      set role = 'ceo', full_name = 'Your Name'
--      where email = 'you@stateofdance.example';
--
-- From then on the CEO can promote everyone else from the Users screen.
-- ============================================================================
