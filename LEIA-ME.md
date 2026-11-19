# Impulse Media: como colocar no ar

São 7 passos, e você faz uma vez só. Leva uns 40 minutos.
Tudo o que é pra **colar no terminal** é no terminal do VS Code (PowerShell).

---

## 1. Extrair o projeto

Com o `impulse-media.zip` na pasta Downloads, cole no terminal:

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\Projetos" | Out-Null
Expand-Archive -Path "$HOME\Downloads\impulse-media.zip" -DestinationPath "$HOME\Projetos" -Force
cd "$HOME\Projetos\impulse-media"
code .
```

O VS Code abre com a pasta do projeto.

---

## 2. Criar o banco (Supabase)

1. Entre em https://supabase.com/dashboard e clique em **New project**
   - Nome: `impulse-media`
   - Região: **South America (São Paulo)**
   - Crie uma senha do banco e guarde
2. Quando terminar de criar, abra **SQL Editor** > **New query**
3. No VS Code, abra `supabase/schema.sql`, copie tudo, cole no Supabase e clique em **Run**
   - Tem que aparecer "Success. No rows returned"
4. Crie o login dela: **Authentication** > **Users** > **Add user** > **Create new user**
   - E-mail e senha dela
   - Marque **Auto Confirm User**
5. Bloqueie cadastro de estranhos: **Authentication** > **Sign In / Providers** > desligue **Allow new users to sign up** > Save
6. Pegue as chaves: **Project Settings** > **API Keys** (ou **Data API**)
   - Copie a **Project URL** (ex: `https://abcdefgh.supabase.co`)
   - Copie a chave **anon public**

---

## 3. Gerar as chaves das notificações

Cole no terminal:

```powershell
npx web-push generate-vapid-keys
```

Ele mostra uma **Public Key** e uma **Private Key**. Deixe as duas abertas pra usar nos próximos passos.

Agora gere uma senha pro agendador. Cole no terminal e guarde o resultado:

```powershell
-join ((48..57)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Esse é o seu **CRON_SECRET**.

---

## 4. Preencher o config.js

No VS Code, abra `site/config.js` e preencha os 3 campos:

```js
SUPABASE_URL: 'https://abcdefgh.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...',
VAPID_PUBLIC_KEY: 'BAbc123...'      // a Public Key do passo 3
```

Salve (Ctrl+S).

---

## 5. Criar a função dos avisos

1. No Supabase: **Edge Functions** > **Deploy a new function** > **Via Editor**
2. Nome da função: `notify` (exatamente assim)
3. Apague o código de exemplo, cole tudo de `supabase/functions/notify/index.ts` e clique em **Deploy**
4. Dentro da função `notify` > **Details** (ou Settings): desligue **Enforce JWT Verification** (Verify JWT) e salve
5. **Edge Functions** > **Secrets** > adicione os 4:

| Nome | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | Public Key do passo 3 |
| `VAPID_PRIVATE_KEY` | Private Key do passo 3 |
| `VAPID_SUBJECT` | `mailto:` + e-mail dela (ex: `mailto:contato@impulsemedia.com`) |
| `CRON_SECRET` | o código gerado no passo 3 |

---

## 6. Ligar o agendador (avisos a cada 5 minutos)

1. No VS Code, abra `supabase/cron.sql`
2. Troque `SEU-PROJETO` pelo código do projeto (a parte antes de `.supabase.co` na Project URL)
3. Troque `SEU-SEGREDO` pelo CRON_SECRET
4. No Supabase: **SQL Editor** > **New query** > cole > **Run**

---

## 7. Publicar o site (Cloudflare Pages)

Cole no terminal (dentro da pasta do projeto):

```powershell
npx wrangler pages deploy site --project-name impulse-media --branch main
```

- Na primeira vez ele abre o navegador pra você entrar na Cloudflare: autorize
- Se perguntar se quer criar o projeto, responda **Yes** e escolha a branch `main`
- No final aparece o link: **https://impulse-media.pages.dev**

---

## No iPhone dela

1. Abra **https://impulse-media.pages.dev** no **Safari**
2. Toque em **Compartilhar** > **Adicionar à Tela de Início** > Adicionar
3. Abra pelo ícone novo da Impulse e entre com o e-mail e a senha dela
4. Toque na logo (canto de cima) > **Ativar notificações neste celular** > **Permitir**

Pra testar na hora, cole no terminal (troque as 2 partes):

```powershell
Invoke-RestMethod -Method Post -Uri "https://SEU-PROJETO.supabase.co/functions/v1/notify" -Headers @{"x-cron-secret"="SEU-SEGREDO"} -ContentType "application/json" -Body '{"teste":true}'
```

Tem que chegar "Teste da Impulse" no iPhone dela, e o terminal mostra `enviados: 1`.

---

## O que avisa e quando

| Aviso | Quando |
|---|---|
| Resumo do dia | Todo dia às 8h |
| Lembretes | Na hora marcada |
| Compromissos e horários fixos | 30 minutos antes |
| Cliente não pagou | 9h do dia seguinte ao vencimento |
| Conta fixa | 9h, 2 dias antes de vencer |
| Quem falta postar | Quinta às 18h |

Ela liga e desliga cada um em Ajustes (toque na logo).

---

## Atualizações futuras

Quando eu mandar um zip com alterações, cole no terminal:

```powershell
cd "$HOME\Projetos"
Expand-Archive -Path "$HOME\Downloads\impulse-media.zip" -DestinationPath "$HOME\Projetos" -Force
cd "$HOME\Projetos\impulse-media"
npx wrangler pages deploy site --project-name impulse-media --branch main
```

**Atenção:** o `config.js` dos zips de atualização vem vazio, então não substitua o seu. Se ele for substituído sem querer, preencha de novo (passo 4).

---

## Se algo não funcionar

- **Tela de login não aparece, só "Modo demonstração":** o `config.js` está vazio. Refaça o passo 4 e publique de novo (passo 7).
- **"E-mail ou senha errados":** confira se marcou Auto Confirm User no passo 2.
- **Notificação não chega:** o app tem que estar instalado na tela de início (iPhone com iOS 16.4 ou mais novo). Rode o comando de teste acima. Se der `enviados: 0`, confira os Secrets do passo 5.
- **Plano grátis do Supabase:** o projeto pausa se ficar 7 dias sem ninguém abrir o app. Como ela usa todo dia, não deve acontecer. Se pausar, é só entrar no painel e clicar em Restore.
