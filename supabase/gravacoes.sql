-- =====================================================================
-- IMPULSE MEDIA — ativa Gravação, Edição, estoque de vídeos e Relatórios
-- Rode uma vez: SQL Editor > New query > cole tudo > Run
-- (pode rodar mesmo se já tiver rodado o edicao.sql)
-- =====================================================================
create table if not exists edits (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   bigint not null references clients(id) on delete cascade,
  week_start  date not null,
  created_at  timestamptz default now()
);
create table if not exists visits (               -- gravações feitas em cada visita
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   bigint not null references clients(id) on delete cascade,
  dia         date not null default current_date,
  qtd         int  not null default 1 check (qtd > 0),
  obs         text default '',
  created_at  timestamptz default now()
);
create index if not exists edits_week on edits(week_start);
create index if not exists visits_dia on visits(dia);
do $$
declare t text;
begin
  foreach t in array array['edits','visits'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "dono" on %I', t);
    execute format('create policy "dono" on %I for all using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;
