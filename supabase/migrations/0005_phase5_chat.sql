-- ============================================================================
-- State of Dance — Internal Operating Dashboard
-- Migration 0005 · Phase 5 (Comms): in-app chat
-- ----------------------------------------------------------------------------
-- Depends on 0001 (profiles, helpers). Apply after 0004.
-- Chat lives in Postgres; only file attachments live elsewhere (a link).
-- ============================================================================

create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  channel        text not null default 'general',
  sender_id      uuid references public.profiles (id) on delete set null,
  body           text,
  attachment_url text,              -- link to a Drive/file; upload handled outside the DB
  created_at     timestamptz not null default now()
);
create index if not exists messages_channel_idx on public.messages (channel, created_at);

alter table public.messages enable row level security;
alter table public.messages force row level security;

-- Everyone on the team can read and post.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (true);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid());

-- Authors can delete their own message; the CEO can delete any (moderation).
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using (sender_id = auth.uid() or public.is_ceo());

-- ---- Realtime -----------------------------------------------------------
-- Push new messages to connected clients. Safe to run repeatedly.
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception
    when duplicate_object then null;  -- already added
    when undefined_object then null;  -- publication missing (older projects); ignore
  end;
end$$;
