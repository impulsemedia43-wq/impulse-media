# Impulse Media

App da Impulse Media: clientes, postagens da semana, lembretes, agenda, finanças e notificações no celular.

- `site/`: o app (é isso que vai pro ar no Cloudflare Pages, sem build)
- `supabase/schema.sql`: tabelas do banco (rodar uma vez no SQL Editor)
- `supabase/functions/notify/index.ts`: função que manda os avisos (Edge Function chamada `notify`, com Verify JWT desligado)
- `supabase/cron.sql`: agenda a função a cada 5 minutos (rodar uma vez no SQL Editor)

As chaves das notificações são criadas sozinhas pela função na primeira vez. Não precisa configurar nenhum segredo.

Cloudflare Pages: Framework **None**, comando de build **vazio**, diretório de saída **site**.
