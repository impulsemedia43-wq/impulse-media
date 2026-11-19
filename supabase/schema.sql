-- =====================================================================
-- IMPULSE MEDIA — banco de dados
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run
-- =====================================================================

-- ---------- CLIENTES ----------
create table if not exists clients (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  ig          text default '',
  phone       text default '',
  meta        int  not null default 2,          -- posts por semana
  tipo        text not null default 'vídeos',   -- vídeos / posts / stories
  valor       numeric(10,2) not null default 0, -- mensalidade
  venc        int  not null default 10 check (venc between 1 and 31),
  created_at  timestamptz default now()
);

-- horários fixos de cada cliente (ex: toda quarta 09:00)
create table if not exists client_schedule (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   bigint not null references clients(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6), -- 0 = domingo
  hora        time not null,
  titulo      text not null default 'Compromisso'
);

-- postagens marcadas na semana
create table if not exists posts (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   bigint not null references clients(id) on delete cascade,
  week_start  date not null,                     -- segunda-feira da semana
  status      text not null check (status in ('postado','agendado')),
  created_at  timestamptz default now()
);
create index if not exists posts_week on posts(week_start);

-- compromissos de um dia só
create table if not exists events (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   bigint references clients(id) on delete cascade,
  dia         date not null,
  hora        time not null,
  titulo      text not null default 'Compromisso'
);

-- ---------- LEMBRETES ----------
create table if not exists reminders (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo      text not null,
  client_id   bigint references clients(id) on delete set null,
  repetir     text not null default 'nunca' check (repetir in ('nunca','semana','dia')),
  dia         date,          -- usado quando repetir = nunca
  weekday     int,           -- usado quando repetir = semana
  hora        time not null default '09:00',
  feito       boolean not null default false, -- lembrete único concluído
  feito_em    date,                           -- lembrete repetido concluído neste dia
  created_at  timestamptz default now()
);

-- ---------- FINANÇAS ----------
create table if not exists bills (            -- contas fixas mensais
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo      text not null,
  cat         text not null default 'Outros',
  valor       numeric(10,2) not null default 0,
  dia         int not null default 10 check (dia between 1 and 31)
);

create table if not exists transactions (     -- toda entrada e saída de dinheiro
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('entrada','saida')),
  titulo      text not null,
  cat         text not null default 'Outros',
  valor       numeric(10,2) not null,
  data        date not null default current_date,
  client_id   bigint references clients(id) on delete set null, -- mensalidade
  bill_id     bigint references bills(id) on delete set null,   -- conta fixa paga
  ref_mes     date,                                             -- mês de referência (dia 1)
  created_at  timestamptz default now()
);
create index if not exists tx_data on transactions(data);

-- ---------- NOTIFICAÇÕES ----------
create table if not exists push_subscriptions (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);

create table if not exists settings (
  owner       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  toggles     jsonb not null default '{"daily":true,"rem":true,"late":true,"bills":true,"agenda":true,"week":true}'
);

create table if not exists app_keys (            -- chaves das notificações (geradas sozinhas pela função)
  id          int primary key default 1,
  public_key  text not null,
  private_key text not null
);

create table if not exists notifications_sent (  -- evita mandar o mesmo aviso 2 vezes
  key         text primary key,
  sent_at     timestamptz default now()
);

-- ---------- SEGURANÇA (cada usuário só vê os próprios dados) ----------
do $$
declare t text;
begin
  foreach t in array array['clients','client_schedule','posts','events','reminders','bills','transactions','push_subscriptions','settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "dono" on %I', t);
    execute format('create policy "dono" on %I for all using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;
alter table notifications_sent enable row level security; -- só a função de avisos (service role) acessa
alter table app_keys enable row level security;           -- idem
