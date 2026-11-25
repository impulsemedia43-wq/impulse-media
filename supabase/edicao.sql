-- =====================================================================
-- IMPULSE MEDIA — ativa o quadro de Edição (vídeos editados)
-- Rode uma vez: SQL Editor > New query > cole tudo > Run
-- =====================================================================
create table if not exists edits (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   bigint not null references clients(id) on delete cascade,
  week_start  date not null,
  created_at  timestamptz default now()
);
create index if not exists edits_week on edits(week_start);
alter table edits enable row level security;
drop policy if exists "dono" on edits;
create policy "dono" on edits for all using (owner = auth.uid()) with check (owner = auth.uid());
