-- =====================================================================
-- IMPULSE MEDIA — agendador dos avisos
-- Pronto pra rodar: SQL Editor > New query > cole tudo > Run
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('impulse-avisos') where exists (select 1 from cron.job where jobname = 'impulse-avisos');

select cron.schedule(
  'impulse-avisos',
  '*/5 * * * *',   -- a cada 5 minutos
  $$
  select net.http_post(
    url     := 'https://cngohlvlopnzndwjchjl.supabase.co/functions/v1/notify',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- limpeza: apaga o histórico de avisos com mais de 60 dias, todo dia às 4h
select cron.unschedule('impulse-limpeza') where exists (select 1 from cron.job where jobname = 'impulse-limpeza');
select cron.schedule('impulse-limpeza', '0 7 * * *', $$ delete from notifications_sent where sent_at < now() - interval '60 days' $$);
