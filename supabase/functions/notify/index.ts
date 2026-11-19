// =====================================================================
// IMPULSE MEDIA — função "notify"
// Roda a cada 5 minutos (pelo cron.sql) e manda as notificações no celular.
// Não precisa configurar nada: as chaves das notificações são criadas sozinhas
// na primeira vez e ficam guardadas na tabela app_keys.
//   POST {}                -> confere e manda os avisos do horário (usado pelo agendador)
//   POST {"acao":"chave"}  -> devolve a chave pública (o app usa pra ativar as notificações)
//   POST {"teste":true}    -> manda um aviso de teste pra quem está logado
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WINDOW_MIN = 15; // manda se o horário passou há menos de 15 min

// Horário de Brasília (UTC-3, sem horário de verão desde 2019)
function brNow() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return {
    iso: d.toISOString().slice(0, 10),
    day: d.getUTCDate(),
    wd: d.getUTCDay(),
    min: d.getUTCHours() * 60 + d.getUTCMinutes(),
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
  };
}
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const isoAdd = (iso: string, days: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}-01`;
const weekStart = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); const w = d.getUTCDay(); d.setUTCDate(d.getUTCDate() - ((w + 6) % 7)); return d.toISOString().slice(0, 10); };
const due = (now: number, at: number) => now >= at && now - at < WINDOW_MIN;
const brl = (v: number) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // chaves das notificações: cria na primeira vez
  let { data: k } = await sb.from("app_keys").select("*").eq("id", 1).maybeSingle();
  if (!k) {
    const v = webpush.generateVAPIDKeys();
    await sb.from("app_keys").insert({ id: 1, public_key: v.publicKey, private_key: v.privateKey });
    ({ data: k } = await sb.from("app_keys").select("*").eq("id", 1).maybeSingle());
  }
  webpush.setVapidDetails("mailto:avisos@impulsemedia.app", k!.public_key, k!.private_key);

  let corpo: { acao?: string; teste?: boolean } = {};
  try { corpo = await req.json(); } catch (_) { /* sem corpo */ }
  if (corpo.acao === "chave") return json({ publicKey: k!.public_key });

  if (corpo.teste) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ erro: "faça login" }, 401);
    const { data: meus } = await sb.from("push_subscriptions").select("*").eq("owner", u.user.id);
    let ok = 0;
    for (const s of meus || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: "Teste da Impulse", body: "Os avisos estão funcionando!", tag: "teste" }));
        ok++;
      } catch (e) { console.error(e); }
    }
    return json({ teste: true, celulares: (meus || []).length, enviados: ok });
  }

  const now = brNow();
  const mes = monthKey(now.y, now.m);
  const ws = weekStart(now.iso);

  const { data: subs } = await sb.from("push_subscriptions").select("*");
  if (!subs?.length) return json({ ok: true, enviados: 0, obs: "nenhum celular cadastrado" });

  const owners = [...new Set(subs.map((s) => s.owner))];
  let enviados = 0;

  for (const owner of owners) {
    const q = (t: string) => sb.from(t).select("*").eq("owner", owner);
    const [cl, sc, ev, rm, bl, tx, ps, st] = await Promise.all([
      q("clients"), q("client_schedule"), q("events").eq("dia", now.iso), q("reminders"),
      q("bills"), q("transactions").eq("ref_mes", mes), q("posts").eq("week_start", ws), q("settings"),
    ]);
    const clients = cl.data || [], tg = st.data?.[0]?.toggles || {};
    const on = (k: string) => tg[k] !== false;
    const cname = (id: number) => clients.find((c) => c.id === id)?.name || "";
    const paid = (cid: number) => (tx.data || []).some((t) => t.tipo === "entrada" && t.client_id === cid);
    const billPaid = (bid: number) => (tx.data || []).some((t) => t.tipo === "saida" && t.bill_id === bid);
    const msgs: { key: string; title: string; body: string }[] = [];

    // 1. Lembretes
    if (on("rem")) for (const r of rm.data || []) {
      const hoje = r.repetir === "dia" || (r.repetir === "semana" && r.weekday === now.wd) || (r.repetir === "nunca" && r.dia === now.iso);
      const feito = r.repetir === "nunca" ? r.feito : r.feito_em === now.iso;
      if (hoje && !feito && due(now.min, toMin(r.hora)))
        msgs.push({ key: `rem:${r.id}:${now.iso}`, title: r.titulo, body: r.client_id ? cname(r.client_id) : "Lembrete" });
    }
    // 2. Compromissos (30 min antes)
    if (on("agenda")) {
      for (const s of (sc.data || []).filter((s) => s.weekday === now.wd))
        if (due(now.min, toMin(s.hora) - 30))
          msgs.push({ key: `sch:${s.id}:${now.iso}`, title: `Às ${s.hora.slice(0, 5)}: ${cname(s.client_id)}`, body: s.titulo });
      for (const e of ev.data || [])
        if (due(now.min, toMin(e.hora) - 30))
          msgs.push({ key: `ev:${e.id}`, title: `Às ${e.hora.slice(0, 5)}: ${cname(e.client_id) || "Compromisso"}`, body: e.titulo });
    }
    // 3. Resumo do dia às 8h
    if (on("daily") && due(now.min, 8 * 60)) {
      const pend = clients.filter((c) => (ps.data || []).filter((p) => p.client_id === c.id).length < c.meta).length;
      const late = clients.filter((c) => now.day > c.venc && !paid(c.id)).length;
      const lemb = (rm.data || []).filter((r) => (r.repetir === "dia" || (r.repetir === "semana" && r.weekday === now.wd) || (r.repetir === "nunca" && r.dia === now.iso && !r.feito))).length;
      const partes = [`${pend} cliente${pend !== 1 ? "s" : ""} com post faltando`, `${lemb} lembrete${lemb !== 1 ? "s" : ""} hoje`];
      if (late) partes.push(`${late} pagamento${late !== 1 ? "s" : ""} atrasado${late !== 1 ? "s" : ""}`);
      msgs.push({ key: `daily:${now.iso}`, title: "Bom dia! Seu resumo de hoje", body: partes.join(", ") + "." });
    }
    // 4. Cliente não pagou (dia seguinte ao vencimento, 9h)
    if (on("late") && due(now.min, 9 * 60))
      for (const c of clients.filter((c) => c.venc === now.day - 1 && !paid(c.id)))
        msgs.push({ key: `late:${c.id}:${mes}`, title: `${c.name} não pagou`, body: `Venceu ontem, ${brl(c.valor)}.` });
    // 5. Conta fixa vence em 2 dias (9h)
    if (on("bills") && due(now.min, 9 * 60)) {
      const em2 = new Date(isoAdd(now.iso, 2) + "T12:00:00Z").getUTCDate();
      for (const b of (bl.data || []).filter((b) => b.dia === em2 && !billPaid(b.id)))
        msgs.push({ key: `bill:${b.id}:${mes}`, title: `${b.titulo} vence em 2 dias`, body: `Dia ${b.dia}, ${brl(b.valor)}.` });
    }
    // 6. Quinta 18h: quem ainda falta postar
    if (on("week") && now.wd === 4 && due(now.min, 18 * 60)) {
      const falta = clients.filter((c) => (ps.data || []).filter((p) => p.client_id === c.id).length < c.meta);
      if (falta.length)
        msgs.push({ key: `week:${ws}`, title: `${falta.length} cliente${falta.length !== 1 ? "s" : ""} com post faltando`, body: falta.slice(0, 4).map((c) => c.name).join(", ") + (falta.length > 4 ? "…" : "") });
    }

    // envia (sem repetir o que já foi)
    const meus = subs.filter((s) => s.owner === owner);
    for (const m of msgs) {
      const { error } = await sb.from("notifications_sent").insert({ key: `${owner}:${m.key}` });
      if (error) continue; // já enviado antes
      for (const s of meus) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: m.title, body: m.body, tag: m.key }),
          );
          enviados++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", s.id); // celular saiu
        }
      }
    }
  }
  return json({ ok: true, enviados, hora: now.iso + " " + Math.floor(now.min / 60) + ":" + String(now.min % 60).padStart(2, "0"), dia: WD[now.wd] });
});
