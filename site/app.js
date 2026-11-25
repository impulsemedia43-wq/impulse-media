// =====================================================================
// IMPULSE MEDIA — app
// =====================================================================
const CFG = window.IMPULSE_CONFIG || {};
const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
let sb = null, USER = null;

/* ---------------- datas ---------------- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
const addMonths = (mk, n) => { const d = parse(mk); d.setMonth(d.getMonth() + n); return monthKey(d); };
const hm = (t) => (t || '').slice(0, 5);
function T() { const d = new Date(); return { d, iso: iso(d), day: d.getDate(), wd: d.getDay(), ws: iso(mondayOf(d)), mes: monthKey(d) }; }
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES3 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WD3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WD1 = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function dayLabel(s) { const t = T(), d = parse(s); if (s === t.iso) return 'Hoje'; if (s === iso(addDays(t.d, 1))) return 'Amanhã'; if (s === iso(addDays(t.d, -1))) return 'Ontem'; return `${WD3[d.getDay()]}, ${d.getDate()}/${pad(d.getMonth() + 1)}`; }
function longDate(d) { return `${cap(WD[d.getDay()])}${d.getDay() > 0 && d.getDay() < 6 ? '-feira' : ''}, ${d.getDate()} de ${MESES[d.getMonth()]}`; }

/* ---------------- utilidades ---------------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let HIDE = false; try { HIDE = localStorage.getItem('im_hide') === '1'; } catch (e) { }
const MASK = 'R$ •••';
function fmt(v) { if (HIDE) return MASK; v = Number(v) || 0; const r = Math.round(v * 100) / 100, d = r % 1 ? 2 : 0; return 'R$ ' + r.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtReal(v) { const h = HIDE; HIDE = false; const r = fmt(v); HIDE = h; return r; }
const fmt2 = (v) => HIDE ? MASK : 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = (l) => l.reduce((s, x) => s + Number(x.valor || 0), 0);
const $ = (id) => document.getElementById(id);
const val = (id) => ($(id) ? $(id).value.trim() : '');
function ini(n) { const w = String(n).split(' ').filter((x) => x.length > 2); return (w.length > 1 ? w[0][0] + w[1][0] : String(n).slice(0, 2)).toUpperCase(); }
function money(s) { s = String(s || '').replace(/[^\d,.]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return Math.round((parseFloat(s) || 0) * 100) / 100; }

/* ---------------- banco de dados ---------------- */
let DEMO_STORE = null, DEMO_SEQ = 1000;
const db = {
  async list(t, f) {
    if (DEMO) { let l = DEMO_STORE[t] || []; if (f) l = l.filter((r) => f[1] === 'eq' ? r[f[0]] === f[2] : r[f[0]] >= f[2]); return l.map((r) => ({ ...r })); }
    let q = sb.from(t).select('*'); if (f) q = q[f[1]](f[0], f[2]);
    const { data, error } = await q.order('id'); if (error) throw error; return data;
  },
  async insert(t, row) {
    if (DEMO) { const r = { id: DEMO_SEQ++, ...row }; DEMO_STORE[t].push(r); return { ...r }; }
    const { data, error } = await sb.from(t).insert(row).select().single(); if (error) throw error; return data;
  },
  async update(t, id, patch) {
    if (DEMO) { const r = DEMO_STORE[t].find((x) => x.id === id); Object.assign(r, patch); return { ...r }; }
    const { data, error } = await sb.from(t).update(patch).eq('id', id).select().single(); if (error) throw error; return data;
  },
  async remove(t, id) {
    if (DEMO) { DEMO_STORE[t] = DEMO_STORE[t].filter((x) => x.id !== id); return; }
    const { error } = await sb.from(t).delete().eq('id', id); if (error) throw error;
  },
  async getSettings() {
    if (DEMO) return DEMO_STORE.settings;
    const { data } = await sb.from('settings').select('toggles').maybeSingle(); return data ? data.toggles : null;
  },
  async saveSettings(toggles) {
    if (DEMO) { DEMO_STORE.settings = toggles; return; }
    const { error } = await sb.from('settings').upsert({ owner: USER.id, toggles }); if (error) throw error;
  },
  async saveSub(s) {
    if (DEMO) return;
    const { error } = await sb.from('push_subscriptions').upsert(s, { onConflict: 'endpoint' }); if (error) throw error;
  }
};

/* ---------------- estado ---------------- */
const S = { clients: [], schedule: [], posts: [], edits: [], visits: [], events: [], reminders: [], bills: [], tx: [], toggles: { daily: true, rem: true, late: true, bills: true, agenda: true, week: true } };
async function loadAll() {
  const t = T();
  const [clients, schedule, posts, events, reminders, bills, tx, tg] = await Promise.all([
    db.list('clients'), db.list('client_schedule'), db.list('posts', ['week_start', 'gte', iso(addDays(t.d, -200))]),
    db.list('events', ['dia', 'gte', iso(addDays(t.d, -30))]), db.list('reminders'), db.list('bills'), db.list('transactions'), db.getSettings()
  ]);
  let edits = [], visits = [];
  try { edits = await db.list('edits', ['week_start', 'gte', iso(addDays(t.d, -200))]); } catch (e) { console.warn('tabela edits ainda não existe'); }
  try { visits = await db.list('visits', ['dia', 'gte', iso(addDays(t.d, -200))]); } catch (e) { console.warn('tabela visits ainda não existe'); }
  Object.assign(S, { clients, schedule, posts, edits, visits, events, reminders, bills, tx });
  S.clients.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (tg) S.toggles = { ...S.toggles, ...tg };
}
async function act(fn, okMsg) {
  try { await fn(); render(); if (okMsg) banner(okMsg[0], okMsg[1] || ''); return true; }
  catch (e) { console.error(e); banner('Não deu pra salvar', 'Confira a internet e tente de novo.'); return false; }
}

/* ---------------- regras ---------------- */
const client = (id) => S.clients.find((c) => c.id === id);
const FLOW_START = '2026-11-23'; // começo do controle de gravação/estoque
const sumQ = (l) => l.reduce((s, x) => s + (Number(x.qtd) || 0), 0);
function flow(c, upto) { // números acumulados desde FLOW_START até a semana "upto" (inclusive)
  upto = upto || T().ws;
  const g = sumQ(S.visits.filter((x) => x.client_id === c.id && x.dia >= FLOW_START && iso(mondayOf(parse(x.dia))) <= upto));
  const e = S.edits.filter((x) => x.client_id === c.id && x.week_start >= FLOW_START && x.week_start <= upto).length;
  const p = S.posts.filter((x) => x.client_id === c.id && x.week_start >= FLOW_START && x.week_start <= upto).length;
  return { g, e, p, praEditar: Math.max(0, g - e), prontos: Math.max(0, e - p) };
}
function weekVisits(c) { const ws = T().ws; return S.visits.filter((x) => x.client_id === c.id && iso(mondayOf(parse(x.dia))) === ws).sort((a, b) => (a.dia < b.dia ? -1 : 1)); }
function adiantado(c) { return Math.max(0, flow(c).prontos - pend(c)); }
function weekEdits(c) { const ws = T().ws; return S.edits.filter((x) => x.client_id === c.id && x.week_start === ws); }
function weekPosts(c) { const ws = T().ws; const l = S.posts.filter((p) => p.client_id === c.id && p.week_start === ws); return { done: l.filter((p) => p.status === 'postado').length, sched: l.filter((p) => p.status === 'agendado').length, list: l }; }
const pend = (c) => { const w = weekPosts(c); return Math.max(0, c.meta - w.done - w.sched); };
const ok = (c) => pend(c) === 0;
const sing = (c) => c.tipo.replace(/s$/, '');
function paidTx(c, mk) { mk = mk || T().mes; return S.tx.find((x) => x.tipo === 'entrada' && x.client_id === c.id && x.ref_mes === mk); }
function pay(c) {
  const t = T(), p = paidTx(c);
  if (p) return { k: 'green', txt: 'Pago', long: 'Pago dia ' + parse(p.data).getDate() };
  if (t.day > c.venc) { const d = t.day - c.venc; return { k: 'red', txt: d + (d > 1 ? ' dias' : ' dia') + ' atrasado', long: `Venceu dia ${c.venc}, ${d} ${d > 1 ? 'dias' : 'dia'} atrasado` }; }
  if (t.day === c.venc) return { k: 'orange', txt: 'Vence hoje', long: 'Vence hoje' };
  return { k: '', txt: 'Dia ' + c.venc, long: 'Vence dia ' + c.venc };
}
const isLate = (c) => pay(c).k === 'red';
function remOn(r, s) { const wd = parse(s).getDay(); return r.repetir === 'dia' || (r.repetir === 'semana' && r.weekday === wd) || (r.repetir === 'nunca' && r.dia === s); }
function remDone(r) { return r.repetir === 'nunca' ? r.feito : r.feito_em === T().iso; }
const byHora = (a, b) => (hm(a.hora) < hm(b.hora) ? -1 : 1);
function remsOn(s) { return S.reminders.filter((r) => remOn(r, s)).sort(byHora); }
function remWhen(r) { if (r.repetir === 'dia') return 'Todo dia'; if (r.repetir === 'semana') return 'Toda ' + WD[r.weekday]; return dayLabel(r.dia); }
function eventsOn(s) {
  const wd = parse(s).getDay(), out = [];
  S.schedule.filter((x) => x.weekday === wd).forEach((x) => out.push({ kind: 'sch', id: x.id, hora: x.hora, titulo: x.titulo, c: client(x.client_id) }));
  S.events.filter((x) => x.dia === s).forEach((x) => out.push({ kind: 'ev', id: x.id, hora: x.hora, titulo: x.titulo, c: client(x.client_id) }));
  return out.filter((e) => e.c).sort(byHora);
}
const txOf = (mk) => S.tx.filter((x) => x.data.slice(0, 7) === mk.slice(0, 7));
const billPaid = (b, mk) => S.tx.find((x) => x.tipo === 'saida' && x.bill_id === b.id && x.ref_mes === (mk || T().mes));
function notifs() {
  const t = T(), l = [];
  if (!HIDE) S.clients.filter(isLate).forEach((c) => l.push({ t: c.name + ' não pagou', s: 'Venceu dia ' + c.venc + ', ' + fmt(c.valor), on: `openClient(${c.id})` }));
  remsOn(t.iso).filter((r) => !remDone(r)).forEach((r) => l.push({ t: r.titulo, s: 'Lembrete, hoje às ' + hm(r.hora), on: `openRem(${r.id})` }));
  S.bills.filter((b) => !billPaid(b) && b.dia >= t.day && b.dia - t.day <= 2).forEach((b) => l.push({ t: b.titulo + (b.dia === t.day ? ' vence hoje' : ' vence dia ' + b.dia), s: 'Conta fixa, ' + fmt2(b.valor), on: `openBill(${b.id})` }));
  eventsOn(t.iso).forEach((e) => l.push({ t: hm(e.hora) + ' · ' + e.c.name, s: e.titulo, on: `openClient(${e.c.id})` }));
  S.clients.filter((c) => !ok(c)).forEach((c) => { const p = pend(c); l.push({ t: `${c.name}: falta ${p} ${p > 1 ? c.tipo : sing(c)}`, s: `Meta de ${c.meta} por semana`, on: `openClient(${c.id})` }); });
  return l;
}

/* ---------------- ícones ---------------- */
const SV = {
  chev: '<svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5l5 5-5 5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;margin-right:7px"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  penB: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  playS: '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" style="vertical-align:-4px;margin-right:7px"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  playO: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="display:block;margin:0 auto 2px"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;margin-right:7px"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3"/></svg>',
  docW: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3"/></svg><span>Gerar PDF e enviar</span>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};
const TABI = {
  hoje: '<svg viewBox="0 0 28 28" fill="currentColor"><path d="M4 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zm2 4v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V11zm4 3h3v3h-3z"/></svg>',
  clientes: '<svg viewBox="0 0 28 28" fill="currentColor"><circle cx="11" cy="9" r="4.5"/><path d="M2.5 22c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7v1h-17zM19.5 5a4 4 0 0 1 0 8 6 6 0 0 0 0-8zM21 15.3c3 .7 5 2.8 5 6.2v1.5h-4.5v-1c0-2.8-.6-5-.5-6.7z"/></svg>',
  lembretes: '<svg viewBox="0 0 28 28" fill="currentColor"><circle cx="6" cy="7.5" r="2.2"/><circle cx="6" cy="14" r="2.2"/><circle cx="6" cy="20.5" r="2.2"/><rect x="10.5" y="6.3" width="14" height="2.4" rx="1.2"/><rect x="10.5" y="12.8" width="14" height="2.4" rx="1.2"/><rect x="10.5" y="19.3" width="14" height="2.4" rx="1.2"/></svg>',
  agenda: '<svg viewBox="0 0 28 28" fill="currentColor"><path d="M8 3h2v2h8V3h2v2h1a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h1zm-2 8v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V11z"/><rect x="8" y="13.5" width="3" height="3" rx=".6"/><rect x="12.5" y="13.5" width="3" height="3" rx=".6"/><rect x="17" y="13.5" width="3" height="3" rx=".6"/></svg>',
  financas: '<svg viewBox="0 0 28 28" fill="currentColor"><path d="M5 6h18a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zm9 4.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM6 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm16 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>'
};
const CATS = {
  'Ferramentas': { c: '#5856D6', i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>' },
  'Anúncios': { c: '#FF9500', i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4h4l6 4V6L7 10zM17 9a4 4 0 0 1 0 6"/></svg>' },
  'Equipamento': { c: '#8E8E93', i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>' },
  'Transporte': { c: '#34C759', i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V11l2-5h10l2 5v5zM5 16v3M19 16v3M5 11h14"/></svg>' },
  'Impostos': { c: '#FF3B30', i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3"/></svg>' },
  'Contas': { c: '#007AFF', i: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L5 13.5h6L10 22l9-12h-6.2z"/></svg>' },
  'Alimentação': { c: '#FF2D55', i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 3v4M17 3c-2 0-3 2.5-3 6s1 4 3 4v8"/></svg>' },
  'Outros': { c: '#A2845E', i: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>' },
  'Mensalidade': { c: '#2F5FE0', i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5M17 8v6M14 11h6"/></svg>' },
  'Job avulso': { c: '#30B0C7', i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>' }
};
const SPENDCATS = ['Ferramentas', 'Anúncios', 'Equipamento', 'Transporte', 'Alimentação', 'Impostos', 'Contas', 'Outros'];
const INCATS = ['Job avulso', 'Outros'];
const ico = (cat) => { const k = CATS[cat] || CATS['Outros']; return `<span class="ico" style="background:${k.c}">${k.i}</span>`; };

/* ---------------- navegação ---------------- */
let tab = 'hoje', cFilter = 'todos', cQuery = '', aDay = T().iso, finSeg = 'resumo', fMonth = T().mes, fromBoard = false;
let theme = 'auto'; try { theme = localStorage.getItem('im_theme') || 'auto'; } catch (e) { }
const TABS = [['hoje', 'Hoje'], ['clientes', 'Clientes'], ['lembretes', 'Lembretes'], ['agenda', 'Agenda'], ['financas', 'Finanças']];
function drawTabs() { $('tabbar').style.display = ''; $('tabs').innerHTML = TABS.map((t) => `<button class="${tab === t[0] ? 'on' : ''}" onclick="go('${t[0]}')">${TABI[t[0]]}${t[1]}</button>`).join(''); }
function go(t) { tab = t; drawTabs(); render(); window.scrollTo(0, 0); }
let notifSeen = '';
function navrow(plusFn, label) {
  const l = notifs(), key = l.map((x) => x.t).join('|'), n = key === notifSeen ? 0 : l.length;
  return `<div class="navrow"><button class="av" onclick="openSettings()" aria-label="Ajustes"><img src="icons/logo-96.jpg" alt=""></button><span class="sp"></span><button class="nb" onclick="toggleHide()" aria-label="${HIDE ? 'Mostrar valores' : 'Esconder valores'}">${HIDE ? SV.eyeOff : SV.eye}</button><button class="nb" onclick="openNotifs()" aria-label="Avisos">${SV.bell}${n ? `<span class="bd">${n}</span>` : ''}</button>${plusFn ? `<button class="nb" onclick="${plusFn}" aria-label="${label}">${SV.plus}</button>` : ''}</div>`;
}
function cell(o) {
  const tag = o.on ? 'button' : 'div';
  return `<${tag} class="c" ${o.on ? `onclick="${o.on}"` : ''}>${o.left || ''}<span class="bd2"><span class="tx"><span class="t" style="display:block">${o.t}</span>${o.s ? `<span class="s" style="display:block">${o.s}</span>` : ''}</span>${o.r !== undefined ? `<span class="r ${o.rc || ''}">${o.r}</span>` : ''}${o.on && o.chev !== false ? SV.chev : ''}</span></${tag}>`;
}
function cRow(c, money) {
  const p = pay(c), w = weekPosts(c), pd = pend(c);
  if (money) return cell({ on: `openClient(${c.id})`, left: `<span class="ini">${esc(ini(c.name))}</span>`, t: esc(c.name), s: `${fmt(c.valor)}, todo dia ${c.venc}`, r: HIDE ? '•••' : p.txt, rc: HIDE ? '' : p.k });
  return cell({ on: `openClient(${c.id})`, left: `<span class="ini">${esc(ini(c.name))}</span>`, t: esc(c.name), s: `${w.done + w.sched} de ${c.meta} ${esc(c.tipo)} na semana`, r: pd ? 'Falta ' + pd : 'OK', rc: pd ? 'orange' : 'green' });
}
function remRow(r) {
  const c = r.client_id ? client(r.client_id) : null, d = remDone(r);
  return `<div class="c${d ? ' done' : ''}" style="cursor:default"><button class="ck${d ? ' on' : ''}" onclick="toggleRem(${r.id})" aria-label="Concluir">${d ? SV.check : ''}</button><span class="bd2" onclick="openRem(${r.id})" style="cursor:pointer"><span class="tx"><span class="t" style="display:block">${esc(r.titulo)}</span><span class="s" style="display:block">${remWhen(r)}, ${hm(r.hora)}${c ? ' · ' + esc(c.name) : ''}</span></span></span></div>`;
}
function evRow(e) { return `<button class="c" onclick="openEvent('${e.kind}',${e.id})"><span class="time num">${hm(e.hora)}</span><span class="bd2"><span class="tx"><span class="t" style="display:block">${esc(e.c.name)}</span><span class="s" style="display:block">${esc(e.titulo)}${e.kind === 'sch' ? ', toda ' + WD[parse(aDayOr(e)).getDay()] : ''}</span></span>${SV.chev}</span></button>`; }
function aDayOr(e) { return e._day || aDay; }
function txRow(x) {
  const pos = x.tipo === 'entrada';
  return cell({ on: `openTx(${x.id})`, left: ico(x.cat), t: esc(x.titulo), s: `${esc(x.cat)}, ${dayLabel(x.data)}`, r: (pos ? '+ ' : '− ') + fmt2(x.valor), rc: pos ? 'green' : '' });
}

/* ---------------- telas ---------------- */
function render() {
  if (!$('tabs').innerHTML) return;
  const v = $('view'), t = T(); let h = '';
  if (tab === 'hoje') {
    const okN = S.clients.filter(ok).length, late = S.clients.filter(isLate), rs = remsOn(t.iso), ev = eventsOn(t.iso).map((e) => ({ ...e, _day: t.iso }));
    const overdue = S.reminders.filter((r) => r.repetir === 'nunca' && !r.feito && r.dia < t.iso);
    const mtx = txOf(t.mes), inc = sum(mtx.filter((x) => x.tipo === 'entrada')), out = sum(mtx.filter((x) => x.tipo === 'saida'));
    h = navrow('newReminder()', 'Novo lembrete') + `<h1 class="lt">Hoje</h1><p class="ls">${longDate(t.d)}</p>`;
    if (!S.clients.length) h += `<div class="gh"><h3>Comece por aqui</h3></div><div class="grp">${cell({ on: 'newClient()', t: 'Cadastrar o primeiro cliente', s: 'Meta de posts, mensalidade e vencimento' })}</div>`;
    else h += `<div class="gh"><h3>Semana</h3></div><div class="grp"><button class="sum" onclick="openBoard()"><span style="flex:1"><span class="big num">${okN} <span>de ${S.clients.length} clientes em dia</span></span><span class="pbar"><i style="width:${okN / S.clients.length * 100}%;background:var(--green)"></i></span><span class="s" style="display:block;font-size:14px;color:var(--sec);margin-top:6px">${S.clients.length - okN ? (S.clients.length - okN) + ' ainda com post faltando' : 'Todo mundo em dia'}</span></span>${SV.chev}</button></div>`;
    if (late.length && !HIDE) h += `<div class="gh"><h3>Não pagaram</h3><button onclick="finSeg='receber';go('financas')">Finanças</button></div><div class="grp">${late.map((c) => cRow(c, true)).join('')}</div>`;
    h += `<div class="gh"><h3>Lembretes</h3><button onclick="go('lembretes')">Ver todos</button></div><div class="grp">${overdue.map(remRow).join('')}${rs.map(remRow).join('') || (overdue.length ? '' : '<div class="empty">Nada pra hoje.</div>')}</div>`;
    h += `<div class="gh"><h3>Agenda</h3><button onclick="aDay=T().iso;go('agenda')">Semana</button></div><div class="grp">${ev.map(evRow).join('') || '<div class="empty">Nada marcado.</div>'}</div>`;
    if (!HIDE) h += `<div class="gh"><h3>Caixa de ${MESES[t.d.getMonth()]}</h3></div><div class="grp">${cell({ on: "finSeg='resumo';fMonth=T().mes;go('financas')", t: 'Sobrou até agora', s: `Entrou ${fmt(inc)}, saiu ${fmt(out)}`, r: fmt(inc - out), rc: inc - out >= 0 ? 'green' : 'red' })}</div>`;
  }
  if (tab === 'clientes') {
    h = navrow('newClient()', 'Novo cliente') + `<h1 class="lt">Clientes</h1><label class="search">${SV.search}<input placeholder="Buscar" value="${esc(cQuery)}" oninput="cQuery=this.value;drawCList()"></label>` +
      `<div class="segc">${[['todos', 'Todos'], ['pend', 'Falta post']].concat(HIDE ? [] : [['late', 'Não pagou']]).map((s) => `<button class="${cFilter === s[0] ? 'on' : ''}" onclick="cFilter='${s[0]}';render()">${s[1]} (${S.clients.filter(FILT[s[0]]).length})</button>`).join('')}</div>` +
      `<div style="height:14px"></div><div class="grp" id="clist"></div>`;
  }
  if (tab === 'lembretes') {
    const td = remsOn(t.iso), overdue = S.reminders.filter((r) => r.repetir === 'nunca' && !r.feito && r.dia < t.iso).sort((a, b) => (a.dia < b.dia ? -1 : 1));
    const nx = S.reminders.filter((r) => r.repetir === 'nunca' && r.dia > t.iso).sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : byHora(a, b)));
    const rc = S.reminders.filter((r) => r.repetir !== 'nunca').sort(byHora);
    h = navrow('newReminder()', 'Novo lembrete') + '<h1 class="lt">Lembretes</h1>';
    if (overdue.length) h += `<div class="gh"><h3 style="color:var(--red)">Atrasados</h3></div><div class="grp">${overdue.map(remRow).join('')}</div>`;
    h += `<div class="gh"><h3>Hoje <small>${td.filter((r) => !remDone(r)).length}</small></h3></div><div class="grp">${td.map(remRow).join('')}<label class="addrow"><span class="plus"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><input id="qa" placeholder="Novo lembrete" enterkeyhint="next" onkeydown="if(event.key==='Enter'&&this.value.trim())newReminder(this.value)"></label></div>` +
      '<p class="cap">Escreva e toque em Enter pra escolher o dia e a hora do aviso.</p>' +
      `<div class="gh"><h3>Próximos dias</h3></div><div class="grp">${nx.map(remRow).join('') || '<div class="empty">Nada agendado.</div>'}</div>` +
      `<div class="gh"><h3>Repetem</h3></div><div class="grp">${rc.map(remRow).join('') || '<div class="empty">Nenhum.</div>'}</div>`;
  }
  if (tab === 'agenda') {
    const sel = parse(aDay), mon = mondayOf(sel), days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(mon, i)), ev = eventsOn(aDay);
    h = navrow('newEvent()', 'Novo compromisso') + `<div class="week-nav"><h1 class="lt">${cap(MESES[sel.getMonth()])}</h1><span><button onclick="aDay=iso(addDays(parse(aDay),-7));render()" aria-label="Semana anterior">‹</button><button onclick="aDay=iso(addDays(parse(aDay),7));render()" aria-label="Próxima semana">›</button></span></div>` +
      `<div class="wk">${days.map((d) => { const s = iso(d); return `<button class="${s === aDay ? 'on ' : ''}${s === t.iso ? 'today' : ''}" onclick="aDay='${s}';render()"><span class="w">${WD1[d.getDay()]}</span><span class="d num">${d.getDate()}</span><span class="dt" style="visibility:${eventsOn(s).length ? 'visible' : 'hidden'}"></span></button>`; }).join('')}</div>` +
      `<div class="gh"><h3>${aDay === t.iso ? 'Hoje' : cap(WD[sel.getDay()])}, ${sel.getDate()} de ${MESES[sel.getMonth()]}</h3></div><div class="grp">${ev.map(evRow).join('') || '<div class="empty">Dia livre.</div>'}</div>` +
      (aDay !== t.iso ? `<button class="btn gray" onclick="aDay=T().iso;render()">Voltar pra hoje</button>` : '');
  }
  if (tab === 'financas') {
    h = navrow(finSeg === 'entradas' ? 'newTx(\'entrada\')' : 'newTx(\'saida\')', finSeg === 'entradas' ? 'Nova entrada' : 'Novo gasto') + '<h1 class="lt">Finanças</h1>' +
      `<div class="segc">${[['resumo', 'Resumo'], ['receber', 'A receber'], ['entradas', 'Entradas'], ['saidas', 'Saídas']].map((s) => `<button class="${finSeg === s[0] ? 'on' : ''}" onclick="finSeg='${s[0]}';render()">${s[1]}</button>`).join('')}</div>` + finView();
  }
  v.innerHTML = h;
  if (tab === 'clientes') drawCList();
}
const FILT = { todos: () => true, pend: (c) => !ok(c), late: isLate };
function drawCList() {
  const l = S.clients.filter(FILT[cFilter]).filter((c) => c.name.toLowerCase().includes(cQuery.toLowerCase()));
  $('clist').innerHTML = l.map((c) => cRow(c)).join('') || `<div class="empty">${S.clients.length ? 'Nenhum cliente nesse filtro.' : 'Nenhum cliente ainda. Toque no + pra cadastrar.'}</div>`;
}
function monthNav() {
  const d = parse(fMonth), cur = fMonth === T().mes;
  return `<div class="mon"><button onclick="fMonth=addMonths(fMonth,-1);render()" aria-label="Mês anterior">‹</button><span>${cap(MESES[d.getMonth()])} ${d.getFullYear()}</span><button onclick="fMonth=addMonths(fMonth,1);render()" ${cur ? 'disabled' : ''} aria-label="Próximo mês">›</button></div>`;
}
function finView() {
  const t = T(), cur = fMonth === t.mes, mt = txOf(fMonth), inc = mt.filter((x) => x.tipo === 'entrada'), out = mt.filter((x) => x.tipo === 'saida');
  const ti = sum(inc), to = sum(out), mname = MESES[parse(fMonth).getMonth()];
  const late = S.clients.filter(isLate), open = S.clients.filter((c) => !paidTx(c) && !isLate(c));
  const lv = sum(late), ov = sum(open), bOpen = S.bills.filter((b) => !billPaid(b)), bv = sum(bOpen);
  const byDate = (a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id);
  if (finSeg === 'resumo') {
    const cats = {}; out.forEach((x) => { cats[x.cat] = (cats[x.cat] || 0) + Number(x.valor); });
    const ck = Object.keys(cats).sort((a, b) => cats[b] - cats[a]);
    let h = monthNav() + `<div class="kpis"><div class="kpi wide"><div class="l">Sobrou em ${mname}</div><div class="v num" style="color:var(--${ti - to >= 0 ? 'green' : 'red'})">${fmt2(ti - to)}</div>${cur ? `<div class="n">Se todo mundo pagar e as contas fixas saírem: ${fmt(ti + lv + ov - to - bv)}</div>` : ''}</div>` +
      `<div class="kpi"><div class="l">Entrou</div><div class="v num">${fmt(ti)}</div><div class="n">${inc.length} recebimento${inc.length !== 1 ? 's' : ''}</div></div>` +
      `<div class="kpi"><div class="l">Saiu</div><div class="v num">${fmt(to)}</div><div class="n">${out.length} gasto${out.length !== 1 ? 's' : ''}</div></div>` +
      (cur ? `<div class="kpi"><div class="l">A receber</div><div class="v num" style="color:var(--orange)">${fmt(lv + ov)}</div><div class="n">${fmt(lv)} atrasado</div></div><div class="kpi"><div class="l">Contas a pagar</div><div class="v num">${fmt2(bv)}</div><div class="n">${bOpen.length} conta${bOpen.length !== 1 ? 's' : ''} fixa${bOpen.length !== 1 ? 's' : ''}</div></div>` : '') + '</div>' +
      `<div class="gh"><h3>Últimos 6 meses</h3></div>${chart()}`;
    if (ck.length) h += `<div class="gh"><h3>Pra onde foi o dinheiro</h3></div><div class="grp">${ck.map((k) => `<button class="c" onclick="finSeg='saidas';render()">${ico(k)}<span class="bd2"><span class="tx"><span style="display:flex;justify-content:space-between;gap:8px"><span class="t">${esc(k)}</span><span class="r num" style="color:var(--label)">${fmt2(cats[k])}</span></span><span class="catbar"><i style="width:${cats[k] / to * 100}%;background:${(CATS[k] || CATS.Outros).c}"></i></span></span></span></button>`).join('')}</div>`;
    if (cur) h += `<div class="gh"><h3>Contas fixas</h3><button onclick="newBill()">Adicionar</button></div><div class="grp">${S.bills.slice().sort((a, b) => a.dia - b.dia).map((b) => { const p = billPaid(b); return cell({ on: `openBill(${b.id})`, left: ico(b.cat), t: esc(b.titulo), s: `${fmt2(b.valor)}, todo dia ${b.dia}`, r: p ? 'Pago' : (b.dia < t.day ? 'Atrasada' : 'Dia ' + b.dia), rc: p ? 'green' : (b.dia < t.day ? 'red' : b.dia - t.day <= 2 ? 'orange' : '') }); }).join('') || '<div class="empty">Nenhuma conta fixa. Ex: Canva, internet, DAS.</div>'}</div><p class="cap">O app avisa no celular 2 dias antes de cada conta vencer.</p>`;
    return h;
  }
  if (finSeg === 'receber') {
    return (late.length ? `<div class="gh"><h3>Atrasados <small>${fmt(lv)}</small></h3></div><div class="grp">${late.sort((a, b) => a.venc - b.venc).map((c) => cRow(c, true)).join('')}</div>` : '') +
      `<div class="gh"><h3>A vencer <small>${fmt(ov)}</small></h3></div><div class="grp">${open.sort((a, b) => a.venc - b.venc).map((c) => cRow(c, true)).join('') || '<div class="empty">Ninguém pra receber este mês.</div>'}</div>` +
      '<p class="cap">Toque no cliente pra marcar como recebido ou mandar a cobrança no WhatsApp.</p>';
  }
  if (finSeg === 'entradas') {
    const mens = sum(inc.filter((x) => x.cat === 'Mensalidade'));
    return monthNav() + `<div class="kpis"><div class="kpi wide"><div class="l">Entrou em ${mname}</div><div class="v num">${fmt2(ti)}</div><div class="n">Mensalidades ${fmt(mens)}, outros ${fmt(ti - mens)}</div></div></div>` +
      `<div class="gh"><h3>Recebimentos</h3><button onclick="newTx('entrada')">Nova entrada</button></div><div class="grp">${inc.sort(byDate).map(txRow).join('') || '<div class="empty">Nada recebido ainda.</div>'}</div>` +
      '<p class="cap">Mensalidades entram aqui sozinhas quando você toca em Recebi no cliente.</p>';
  }
  if (finSeg === 'saidas') {
    const fix = sum(out.filter((x) => x.bill_id));
    return monthNav() + `<div class="kpis"><div class="kpi wide"><div class="l">Saiu em ${mname}</div><div class="v num">${fmt2(to)}</div><div class="n">Contas fixas ${fmt2(fix)}, dia a dia ${fmt2(to - fix)}</div></div></div>` +
      `<div class="gh"><h3>Gastos</h3><button onclick="newTx('saida')">Novo gasto</button></div><div class="grp">${out.sort(byDate).map(txRow).join('') || '<div class="empty">Nenhum gasto lançado.</div>'}</div>`;
  }
  return '';
}
function chart() {
  const data = []; for (let i = 5; i >= 0; i--) { const mk = addMonths(fMonth, -i), l = txOf(mk); data.push([MES3[parse(mk).getMonth()], sum(l.filter((x) => x.tipo === 'entrada')), sum(l.filter((x) => x.tipo === 'saida'))]); }
  let max = 0; data.forEach((d) => { max = Math.max(max, d[1], d[2]); }); max = Math.max(1000, Math.ceil(max / 1000) * 1000);
  const W = 340, H = 150, bw = 16, gap = W / data.length; let s = `<svg viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="Entradas e saídas dos últimos 6 meses">`;
  [0, .5, 1].forEach((g) => { const y = H - g * H; s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--fill)" stroke-width="1"/>`; });
  data.forEach((d, i) => {
    const x = i * gap + gap / 2, h1 = d[1] / max * H, h2 = d[2] / max * H, last = i === data.length - 1;
    s += `<rect x="${x - bw - 1}" y="${H - h1}" width="${bw}" height="${h1}" rx="3" fill="var(--tint)" opacity="${last ? 1 : .55}"><title>Entrou ${fmt(d[1])}</title></rect>`;
    s += `<rect x="${x + 1}" y="${H - h2}" width="${bw}" height="${h2}" rx="3" fill="var(--ter)" opacity="${last ? 1 : .7}"><title>Saiu ${fmt(d[2])}</title></rect>`;
    s += `<text x="${x}" y="${H + 16}" text-anchor="middle" font-size="12" fill="var(--sec)" font-weight="${last ? 700 : 400}">${d[0]}</text>`;
  });
  return `<div class="chart">${s}</svg><div class="leg"><span style="--c:var(--tint)">Entrou</span><span style="--c:var(--ter)">Saiu</span></div></div>`;
}

/* ---------------- folhas (telas por cima) ---------------- */
function openSheet(h) { const s = $('sheet'); s.innerHTML = h; s.scrollTop = 0; s.classList.add('on'); $('ov').classList.add('on'); document.body.style.overflow = 'hidden'; }
function closeSheet() { $('sheet').classList.remove('on'); $('ov').classList.remove('on'); document.body.style.overflow = ''; }
function sbar(l, m, r) { return `<div class="sbar"><button class="l" onclick="${l[1] || 'closeSheet()'}">${l[0]}</button><span class="m">${m}</span>${r ? `<button class="rr" id="sv" onclick="${r[1]}">${r[0]}</button>` : '<span></span>'}</div>`; }
async function saving(fn) { const b = $('sv'); if (b) { if (b.disabled) return; b.disabled = true; } const ok2 = await fn(); if (!ok2 && b) b.disabled = false; }
function confirmSheet(title, text, yesLabel, yesFn, backFn) {
  openSheet(sbar(['Voltar', backFn || 'closeSheet()'], '') + `<div class="hero" style="padding-top:20px"><h2>${title}</h2><p>${text}</p></div><button class="btn" style="background:var(--red)" onclick="${yesFn}">${yesLabel}</button><button class="btn gray" onclick="${backFn || 'closeSheet()'}">Cancelar</button>`);
}

/* quadro da semana */
function openBoard() {
  fromBoard = true; const okN = S.clients.filter(ok).length, m = parse(T().ws), e = addDays(m, 6);
  openSheet(sbar(['Fechar'], `Semana de ${m.getDate()} a ${e.getDate()}`) + `<p class="cap" style="padding:0 16px 12px;text-align:center">${okN} em dia, ${S.clients.length - okN} com post faltando</p><div class="board">${S.clients.map((c) => {
    const w = weekPosts(c); let b = ''; for (let i = 0; i < w.done; i++) b += '<i class="d"></i>'; for (let i = 0; i < w.sched; i++) b += '<i class="s"></i>'; for (let i = 0; i < pend(c); i++) b += '<i></i>';
    return `<button class="tile" onclick="openClient(${c.id},1)"><span class="tn">${esc(c.name)}</span><span class="ring">${b}</span><span class="st" style="color:var(--${ok(c) ? 'green' : 'orange'})">${ok(c) ? 'Em dia' : 'Falta ' + pend(c)}</span>${adiantado(c) ? `<span class="st" style="color:var(--green);margin-top:1px">+${adiantado(c)} adiantado${adiantado(c) > 1 ? 's' : ''}</span>` : (!ok(c) && !flow(c).prontos ? '<span class="st" style="color:var(--sec);margin-top:1px">sem estoque</span>' : '')}${isLate(c) && !HIDE ? '<span class="st" style="color:var(--red);margin-top:1px">Não pagou</span>' : ''}</button>`;
  }).join('')}</div><p class="cap" style="text-align:center">Barra cheia: postado. Clara: agendado. Cinza: falta.</p>`);
}

/* cliente */
function openClient(id, fb) {
  if (fb !== undefined) fromBoard = !!fb; else fromBoard = false;
  const c = client(id); if (!c) { closeSheet(); return; }
  const t = T(), p = pay(c), w = weekPosts(c), pd = pend(c), F = flow(c), Fp = flow(c, iso(addDays(parse(t.ws), -7)));
  const wv = weekVisits(c), wg = sumQ(wv), we = weekEdits(c), old = Math.min(F.prontos, Fp.prontos);
  const big = (svg) => svg.replace('<svg', '<svg width="22" height="22" style="display:block;margin:0 auto 2px"');
  let se = '', sl = '';
  we.forEach(() => { se += `<button class="slot ed" onclick="undoEdit(${id})">${SV.penB}Editado</button>`; });
  for (let i = 0; i < F.praEditar; i++) se += '<span class="slot e">Editar</span>';
  for (let i = 0; i < w.done; i++) sl += `<button class="slot d" onclick="undoPost(${id},'postado')">${SV.play}Postado</button>`;
  for (let i = 0; i < w.sched; i++) sl += `<button class="slot s" onclick="undoPost(${id},'agendado')">${SV.clock}Programado</button>`;
  for (let i = 0; i < pd; i++) sl += i < F.prontos ? `<span class="slot pr">${SV.playO}Pronto</span>` : '<span class="slot e">Falta</span>';
  const stock = F.prontos
    ? `<b>${F.prontos} vídeo${F.prontos > 1 ? 's' : ''} pronto${F.prontos > 1 ? 's' : ''} pra postar</b><span>${old ? old + ' da semana passada · ' : ''}${F.prontos > pd ? '+' + (F.prontos - pd) + ' adiantado' + (F.prontos - pd > 1 ? 's' : '') + ' pra próxima semana' : 'usa nesta semana'}</span>`
    : `<b>Nenhum vídeo pronto</b><span>${F.praEditar ? F.praEditar + ' gravado' + (F.praEditar > 1 ? 's' : '') + ' esperando edição' : 'Grave e edite pra encher o estoque'}</span>`;
  const sch = S.schedule.filter((x) => x.client_id === id).sort((a, b) => a.weekday - b.weekday || byHora(a, b));
  const m = parse(t.ws), e = addDays(m, 6);
  openSheet(sbar([fromBoard ? '‹ Semana' : 'Fechar', fromBoard ? 'openBoard()' : 'closeSheet()'], '', ['Editar', `editClient(${id})`]) +
    `<div class="hero"><div class="ini">${esc(ini(c.name))}</div><h2>${esc(c.name)}</h2><p>${c.ig ? '@' + esc(c.ig) + ' · ' : ''}meta ${c.meta} por semana</p></div>` +
    `<p class="cap" style="text-align:center;padding-top:10px">Semana de ${m.getDate()}/${pad(m.getMonth() + 1)} a ${e.getDate()}/${pad(e.getMonth() + 1)}</p>` +
    `<div class="funnel"><div><b>${wg}</b><span>gravados</span></div><i>›</i><div><b>${we.length}</b><span>editados</span></div><i>›</i><div><b>${w.done + w.sched}</b><span>postados</span></div></div>` +
    `<div class="stock${F.prontos ? '' : ' zero'}"><div class="bx">${F.prontos}</div><div>${stock}</div></div>` +
    `<div class="step"><h3><em style="background:#30B0C7">1</em>Gravação</h3><small>${wg} vídeo${wg !== 1 ? 's' : ''}</small></div><div class="grp">${wv.map((x) => { const d = parse(x.dia); return `<button class="vis" onclick="openVisit(${x.id})"><div class="dt"><b>${d.getDate()}</b><span>${WD3[d.getDay()].toLowerCase()}</span></div><div class="tx"><b>${esc(x.obs || 'Gravação')}</b><p>${d.getDate()} de ${MESES[d.getMonth()]}</p></div><span class="n">${x.qtd} vídeo${x.qtd > 1 ? 's' : ''}</span></button>`; }).join('') || '<div class="empty">Nenhuma gravação nesta semana.</div>'}<div style="padding:10px 16px 16px"><button class="btn teal" style="margin:0;width:100%" onclick="newVisit(${id})">${SV.cam}Registrar gravação</button></div></div>` +
    `<div class="step"><h3><em style="background:var(--orange)">2</em>Edição</h3><small>${F.praEditar ? F.praEditar + ' pra editar' : 'tudo editado'}</small></div><div class="grp"><div class="slots">${se || '<span class="cap" style="padding:0">Nada gravado pra editar.</span>'}</div><div style="padding:10px 16px 16px"><button class="btn orange" style="margin:0;width:100%" onclick="markEdit(${id})">${SV.pen}Vídeo editado</button></div></div>` +
    `<div class="step"><h3><em style="background:var(--tint)">3</em>Postagem</h3><small>${w.done + w.sched} de ${c.meta}</small></div><div class="grp"><div class="slots">${sl}</div><p class="cap" style="padding:2px 16px 4px">${pd ? `Falta ${pd} pra fechar a semana.${F.prontos ? ' ' + Math.min(F.prontos, pd) + ' já pronto' + (Math.min(F.prontos, pd) > 1 ? 's' : '') + '.' : ''}` : 'Semana fechada!'}</p><div style="padding:6px 16px 4px"><button class="btn" style="margin:0;width:100%" onclick="markPost(${id},'postado')">${SV.playS}Postar</button></div><button class="small-link" onclick="markPost(${id},'agendado')">Marcar como programado</button></div>` +
    '<p class="cap">Marcou errado? Toque no quadrado pra desfazer.</p>' +
    `<div class="gh"><h3>Pagamento de ${MESES[t.d.getMonth()]}</h3></div><div class="grp">${cell({ t: 'Mensalidade', r: fmt(c.valor) })}${cell({ t: 'Vencimento', r: 'Todo dia ' + c.venc })}${cell({ t: 'Situação', r: HIDE ? '•••' : p.long, rc: HIDE ? '' : p.k })}</div>` +
    (paidTx(c) ? `<button class="btn gray" onclick="unpay(${id})">Desfazer pagamento</button>` : `<div class="row2"><button class="btn gray" onclick="cobrar(${id})">${c.phone ? 'Cobrar no WhatsApp' : 'Copiar cobrança'}</button><button class="btn green" onclick="receive(${id})">Recebi</button></div>`) +
    `<div class="gh"><h3>Horários fixos</h3><button onclick="newEvent(${id})">Adicionar</button></div><div class="grp">${sch.map((x) => cell({ on: `openEvent('sch',${x.id})`, t: esc(x.titulo), s: `Toda ${WD[x.weekday]}, ${hm(x.hora)}` })).join('') || '<div class="empty">Nenhum horário fixo.</div>'}</div>` +
    `<button class="btn gray" onclick="newReminder('',${id})">Criar lembrete pra esse cliente</button>` +
    `<div class="gh"><h3>Relatórios</h3></div><div class="grp">${cell({ on: `openReport(${id})`, left: `<span class="ico" style="background:#0E1A3D">${SV.doc}</span>`, t: 'Relatório do mês', s: 'Gravados, editados, postados e estoque' })}</div><div style="height:10px"></div>`);
}
async function markPost(id, status) {
  const c = client(id); if (!pend(c)) { banner('Semana já fechada', c.name + ' já bateu a meta.'); return; }
  const ok2 = await act(async () => { S.posts.push(await db.insert('posts', { client_id: id, week_start: T().ws, status })); });
  if (ok2) { openClient(id, fromBoard); banner(ok(c) ? c.name + ' fechou a semana' : (status === 'postado' ? 'Post marcado' : 'Agendado marcado'), ok(c) ? 'Meta completa.' : 'Falta ' + pend(c) + ' pra fechar.'); }
}
async function markEdit(id) {
  const c = client(id);
  if (!flow(c).praEditar) { banner('Nada pra editar', 'Registre a gravação primeiro.'); return; }
  try { S.edits.push(await db.insert('edits', { client_id: id, week_start: T().ws })); }
  catch (e) { console.error(e); banner('Falta ativar no banco', 'Rode o arquivo supabase/gravacoes.sql no Supabase.'); return; }
  render(); openClient(id, fromBoard); const f = flow(c).praEditar;
  banner('Vídeo editado', f ? `Falta editar ${f}.` : 'Tudo editado. Pronto pra postar.');
}
async function undoEdit(id) {
  const l = weekEdits(client(id)); if (!l.length) return; const last = l[l.length - 1];
  if (await act(async () => { await db.remove('edits', last.id); S.edits = S.edits.filter((x) => x.id !== last.id); })) openClient(id, fromBoard);
}
function newVisit(cid) {
  openSheet(sbar(['Cancelar', `openClient(${cid},fromBoardFlag())`], 'Registrar gravação', ['Salvar', `saveVisit(${cid})`]) +
    `<div class="grp" style="margin-top:6px"><div class="f"><label for="vd">Dia</label><input id="vd" type="date" value="${T().iso}" max="${T().iso}"></div><div class="f"><label for="vn">Vídeos gravados</label><input id="vn" type="number" inputmode="numeric" min="1" value="3"></div><div class="f"><input class="full" id="vo" placeholder="Observação (opcional)"></div></div>` +
    '<p class="cap">Grave quantos quiser: o que passar da meta vira material adiantado pras próximas semanas.</p>');
}
const fromBoardFlag = () => (fromBoard ? 1 : 0);
function saveVisit(cid) {
  const qtd = Math.max(1, parseInt(val('vn')) || 0), dia = val('vd') || T().iso;
  saving(async () => {
    let ok2 = true;
    try { S.visits.push(await db.insert('visits', { client_id: cid, dia, qtd, obs: val('vo') })); }
    catch (e) { console.error(e); ok2 = false; banner('Falta ativar no banco', 'Rode o arquivo supabase/gravacoes.sql no Supabase.'); }
    if (ok2) { render(); openClient(cid, fromBoard); banner('Gravação registrada', `${qtd} vídeo${qtd > 1 ? 's' : ''} gravado${qtd > 1 ? 's' : ''}.`); }
    return ok2;
  });
}
function openVisit(vid) {
  const x = S.visits.find((v) => v.id === vid); if (!x) return; const d = parse(x.dia);
  openSheet(sbar(['‹ Voltar', `openClient(${x.client_id},fromBoardFlag())`], 'Gravação') + `<div class="grp" style="margin-top:6px">${cell({ t: esc(x.obs || 'Gravação'), s: `${d.getDate()} de ${MESES[d.getMonth()]}`, r: x.qtd + ' vídeo' + (x.qtd > 1 ? 's' : '') })}</div><button class="btn gray danger" onclick="delVisit(${vid})">Apagar gravação</button>`);
}
async function delVisit(vid) {
  const x = S.visits.find((v) => v.id === vid);
  if (await act(async () => { await db.remove('visits', vid); S.visits = S.visits.filter((v) => v.id !== vid); }, ['Gravação apagada', ''])) openClient(x.client_id, fromBoard);
}
/* relatório mensal */
let rMonth = T().mes;
function monthData(c, mk) {
  const inM = (d) => d && d.slice(0, 7) === mk.slice(0, 7);
  const vis = S.visits.filter((x) => x.client_id === c.id && inM(x.dia)).sort((a, b) => (a.dia < b.dia ? -1 : 1));
  const ed = S.edits.filter((x) => x.client_id === c.id && inM((x.created_at || x.week_start)));
  const ps = S.posts.filter((x) => x.client_id === c.id && inM((x.created_at || x.week_start)));
  const weeks = {}; ps.forEach((x) => { weeks[x.week_start] = (weeks[x.week_start] || 0) + 1; });
  return { vis, g: sumQ(vis), e: ed.length, p: ps.length, weeks: Object.keys(weeks).sort().map((k) => [k, weeks[k]]), stock: mk === T().mes ? flow(c).prontos : 0 };
}
function wkLabel(ws) { const m = parse(ws), e = addDays(m, 6); return `Semana de ${m.getDate()}/${pad(m.getMonth() + 1)} a ${e.getDate()}/${pad(e.getMonth() + 1)}`; }
function openReport(cid, mk) {
  if (mk) rMonth = mk; const c = client(cid), d = monthData(c, rMonth), M = parse(rMonth), cur = rMonth === T().mes;
  openSheet(sbar(['‹ ' + esc(c.name), `openClient(${cid},fromBoardFlag())`], 'Relatório') +
    `<div class="rhero"><div class="top"><img src="icons/logo-96.jpg" alt=""><div><b>${esc(c.name)}</b><span>Relatório de conteúdo</span></div></div>` +
    `<div class="rnums"><div><b>${d.vis.length}</b><span>visitas</span></div><div><b>${d.g}</b><span>gravados</span></div><div><b>${d.e}</b><span>editados</span></div><div><b>${d.p}</b><span>postados</span></div></div>` +
    `<div class="mo"><button onclick="openReport(${cid},addMonths(rMonthGet(),-1))" aria-label="Mês anterior">‹</button><span>${cap(MESES[M.getMonth()])} ${M.getFullYear()}</span><button onclick="openReport(${cid},addMonths(rMonthGet(),1))" ${cur ? 'disabled' : ''} aria-label="Próximo mês">›</button></div></div>` +
    (d.stock ? `<div class="stock"><div class="bx">${d.stock}</div><div><b>Material adiantado</b><span>${d.stock} vídeo${d.stock > 1 ? 's' : ''} pronto${d.stock > 1 ? 's' : ''} pra próxima semana</span></div></div>` : '') +
    `<div class="gh"><h3>Gravações</h3></div><div class="grp">${d.vis.map((x) => { const dd = parse(x.dia); return `<div class="vis"><div class="dt"><b>${dd.getDate()}</b><span>${WD3[dd.getDay()].toLowerCase()}</span></div><div class="tx"><b>${esc(x.obs || 'Gravação')}</b><p>${dd.getDate()} de ${MESES[dd.getMonth()]}</p></div><span class="n">${x.qtd} vídeo${x.qtd > 1 ? 's' : ''}</span></div>`; }).join('') || '<div class="empty">Nenhuma gravação neste mês.</div>'}</div>` +
    `<div class="gh"><h3>Postados por semana</h3></div><div class="grp">${d.weeks.map(([ws, n]) => { let b = ''; for (let i = 0; i < Math.max(c.meta, n); i++) b += `<i class="${i < n ? 'on' : ''}"></i>`; return `<div class="wk2"><div class="l">${wkLabel(ws)}<span>${n} de ${c.meta}</span></div><div class="bar">${b}</div></div>`; }).join('') || '<div class="empty">Nenhum vídeo postado neste mês.</div>'}</div>` +
    `<button class="btn" style="display:flex;align-items:center;justify-content:center;gap:8px" onclick="makePDF(${cid})" id="pdfb">${SV.docW}</button><div style="height:24px"></div>`);
}
const rMonthGet = () => rMonth;
function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function imgData(url) { const b = await (await fetch(url)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); }
async function makePDF(cid) {
  const btn = $('pdfb'); if (btn) { btn.disabled = true; btn.lastChild.textContent = 'Gerando…'; }
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const { jsPDF } = window.jspdf, c = client(cid), d = monthData(c, rMonth), M = parse(rMonth), per = `${cap(MESES[M.getMonth()])} ${M.getFullYear()}`;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, NAVY = [14, 26, 61], BLUE = [47, 95, 224], GRAY = [122, 130, 153];
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 38, 'F');
    try { doc.addImage(await imgData('icons/logo-96.jpg'), 'JPEG', 15, 9, 20, 20); } catch (e) { }
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('IMPULSE MEDIA', 40, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(159, 176, 214); doc.text('Relatório mensal de conteúdo', 40, 24);
    doc.text('Período', W - 15, 16, { align: 'right' }); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(per, W - 15, 23, { align: 'right' });
    let y = 54; doc.setTextColor(...NAVY); doc.setFontSize(22); doc.text(c.name, 15, y);
    if (c.ig) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRAY); doc.text('@' + c.ig, 15, y + 6); }
    y += 14; doc.setDrawColor(227, 231, 239); doc.line(15, y, W - 15, y); doc.line(15, y + 26, W - 15, y + 26);
    const nums = [[d.vis.length, 'VISITAS'], [d.g, 'GRAVADOS'], [d.e, 'EDITADOS'], [d.p, 'POSTADOS']], cw = (W - 30) / 4;
    nums.forEach(([n, l], i) => { const x = 15 + cw * i + cw / 2; if (i) doc.line(15 + cw * i, y, 15 + cw * i, y + 26); doc.setTextColor(...BLUE); doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.text(String(n), x, y + 14, { align: 'center' }); doc.setTextColor(...GRAY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(l, x, y + 21, { align: 'center' }); });
    y += 36; doc.setTextColor(40, 40, 40); doc.setFontSize(11);
    const frase = `Neste mês gravamos ${d.g} vídeo${d.g !== 1 ? 's' : ''} em ${d.vis.length} visita${d.vis.length !== 1 ? 's' : ''} e publicamos ${d.p}.` + (d.stock ? ` ${d.stock} já ${d.stock > 1 ? 'estão prontos' : 'está pronto'} para a próxima semana.` : '');
    doc.text(doc.splitTextToSize(frase, W - 30), 15, y); y += 14;
    const sec = (t) => { if (y > 265) { doc.addPage(); y = 20; } doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(t, 15, y); y += 7; };
    sec('Visitas e gravações');
    if (!d.vis.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRAY); doc.text('Nenhuma gravação neste mês.', 15, y); y += 8; }
    d.vis.forEach((x) => { if (y > 275) { doc.addPage(); y = 20; } const dd = parse(x.dia); doc.setFillColor(238, 242, 251); doc.roundedRect(15, y - 5, 13, 10, 2, 2, 'F'); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(String(dd.getDate()), 21.5, y + 0.5, { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAY); doc.text(WD3[dd.getDay()].toLowerCase(), 21.5, y + 3.8, { align: 'center' }); doc.setFontSize(10.5); doc.setTextColor(50, 50, 50); doc.text(x.obs || 'Gravação', 32, y + 1); doc.setTextColor(...BLUE); doc.setFont('helvetica', 'bold'); doc.text(`${x.qtd} vídeo${x.qtd > 1 ? 's' : ''}`, W - 15, y + 1, { align: 'right' }); doc.setDrawColor(240, 242, 246); doc.line(15, y + 7, W - 15, y + 7); y += 13; });
    y += 4; sec('Vídeos postados por semana');
    if (!d.weeks.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRAY); doc.text('Nenhum vídeo postado neste mês.', 15, y); y += 8; }
    d.weeks.forEach(([ws, n]) => { if (y > 275) { doc.addPage(); y = 20; } doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(50, 50, 50); doc.text(wkLabel(ws), 15, y + 1); const tot = Math.max(c.meta, n), bw = 50 / tot; for (let i = 0; i < tot; i++) { doc.setFillColor(...(i < n ? BLUE : [227, 231, 239])); doc.roundedRect(W - 15 - 70 + i * bw, y - 1.5, bw - 1.2, 3, 1.5, 1.5, 'F'); } doc.setTextColor(...BLUE); doc.setFont('helvetica', 'bold'); doc.text(`${n} de ${c.meta}`, W - 15, y + 1, { align: 'right' }); doc.setDrawColor(240, 242, 246); doc.line(15, y + 6, W - 15, y + 6); y += 12; });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(154, 161, 179); doc.text('Impulse Media', 15, 287); const t = T().d; doc.text(`Gerado em ${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()}`, W - 15, 287, { align: 'right' });
    const name = `Relatorio ${c.name} ${per}.pdf`.replace(/[\\/:*?"<>|]/g, '');
    const blob = doc.output('blob'), file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); } catch (e) { } }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); banner('PDF gerado', 'Salvo nos downloads.'); }
  } catch (e) { console.error(e); banner('Não deu pra gerar o PDF', 'Confira a internet e tente de novo.'); }
  if (btn) { btn.disabled = false; btn.lastChild.textContent = 'Gerar PDF e enviar'; }
}
async function undoPost(id, status) {
  const l = weekPosts(client(id)).list.filter((p) => p.status === status); if (!l.length) return;
  const last = l[l.length - 1];
  if (await act(async () => { await db.remove('posts', last.id); S.posts = S.posts.filter((p) => p.id !== last.id); })) openClient(id, fromBoard);
}
async function receive(id) {
  const c = client(id), t = T();
  const ok2 = await act(async () => { S.tx.push(await db.insert('transactions', { tipo: 'entrada', titulo: c.name, cat: 'Mensalidade', valor: c.valor, data: t.iso, client_id: id, ref_mes: t.mes })); });
  if (ok2) { openClient(id, fromBoard); banner('Pagamento recebido', `${c.name}, ${fmt(c.valor)}. Já entrou nas Finanças.`); }
}
async function unpay(id) {
  const p = paidTx(client(id)); if (!p) return;
  if (await act(async () => { await db.remove('transactions', p.id); S.tx = S.tx.filter((x) => x.id !== p.id); })) openClient(id, fromBoard);
}
function cobrar(id) {
  const c = client(id), msg = `Oi! Passando pra lembrar da mensalidade da Impulse Media (${fmtReal(c.valor)}), com vencimento no dia ${c.venc}. Qualquer coisa me chama!`;
  const digits = String(c.phone || '').replace(/\D/g, '');
  if (digits) { const n = digits.length <= 11 ? '55' + digits : digits; window.location.href = `https://wa.me/${n}?text=${encodeURIComponent(msg)}`; return; }
  try { navigator.clipboard.writeText(msg).then(() => banner('Cobrança copiada', 'Cole no WhatsApp do cliente.'), () => banner('Não deu pra copiar', 'Cadastre o WhatsApp do cliente em Editar.')); } catch (e) { banner('Não deu pra copiar', 'Cadastre o WhatsApp do cliente em Editar.'); }
}
function clientForm(c) {
  c = c || { name: '', ig: '', phone: '', meta: 2, tipo: 'vídeos', valor: '', venc: 10 };
  const tipos = ['vídeos', 'posts', 'stories', 'artes'];
  return `<div class="grp" style="margin-top:6px"><div class="f"><input class="full" id="nc_n" placeholder="Nome do cliente" value="${esc(c.name)}"></div><div class="f"><input class="full" id="nc_i" placeholder="@instagram" autocapitalize="off" value="${c.ig ? '@' + esc(c.ig) : ''}"></div><div class="f"><input class="full" id="nc_p" type="tel" inputmode="tel" placeholder="WhatsApp com DDD (pra cobrança)" value="${esc(c.phone)}"></div></div>` +
    `<div class="gh" style="padding-top:20px"><h3 style="font-size:17px">Postagens</h3></div><div class="grp"><div class="f"><label for="nc_m">Meta por semana</label><input id="nc_m" type="number" inputmode="numeric" min="1" value="${c.meta}"></div><div class="f"><label for="nc_t">Tipo</label><select id="nc_t">${tipos.concat(tipos.includes(c.tipo) ? [] : [c.tipo]).map((x) => `<option${x === c.tipo ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div></div>` +
    `<div class="gh" style="padding-top:20px"><h3 style="font-size:17px">Pagamento</h3></div><div class="grp"><div class="f"><label for="nc_v">Mensalidade</label><input id="nc_v" inputmode="decimal" placeholder="R$ 0" value="${c.valor === '' ? '' : String(c.valor).replace('.', ',')}"></div><div class="f"><label for="nc_d">Vence todo dia</label><input id="nc_d" type="number" inputmode="numeric" min="1" max="31" value="${c.venc}"></div></div>`;
}
function readClient() {
  const name = val('nc_n'); if (!name) { $('nc_n').focus(); return null; }
  return { name, ig: val('nc_i').replace(/^@/, ''), phone: val('nc_p'), meta: Math.max(1, parseInt(val('nc_m')) || 1), tipo: val('nc_t'), valor: money(val('nc_v')), venc: Math.min(31, Math.max(1, parseInt(val('nc_d')) || 10)) };
}
function newClient() { openSheet(sbar(['Cancelar'], 'Novo cliente', ['Adicionar', 'saveClient()']) + clientForm()); setTimeout(() => $('nc_n') && $('nc_n').focus(), 350); }
function saveClient(id) {
  const r = readClient(); if (!r) return;
  saving(async () => {
    const ok2 = await act(async () => {
      if (id) Object.assign(client(id), await db.update('clients', id, r));
      else S.clients.push(await db.insert('clients', r));
      S.clients.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [id ? 'Cliente atualizado' : 'Cliente adicionado', `${r.name}, ${r.meta} ${r.tipo} por semana.`]);
    if (ok2) { if (id) openClient(id); else closeSheet(); }
    return ok2;
  });
}
function editClient(id) { openSheet(sbar(['Cancelar', `openClient(${id})`], 'Editar cliente', ['Salvar', `saveClient(${id})`]) + clientForm(client(id)) + `<button class="btn gray danger" style="margin-top:28px" onclick="askDelClient(${id})">Apagar cliente</button>`); }
function askDelClient(id) { confirmSheet('Apagar ' + esc(client(id).name) + '?', 'Some também os posts e horários dele. Os pagamentos já recebidos continuam nas Finanças.', 'Apagar cliente', `delClient(${id})`, `editClient(${id})`); }
async function delClient(id) {
  const n = client(id).name;
  if (await act(async () => { await db.remove('clients', id); S.clients = S.clients.filter((c) => c.id !== id); S.schedule = S.schedule.filter((x) => x.client_id !== id); S.posts = S.posts.filter((x) => x.client_id !== id); S.edits = S.edits.filter((x) => x.client_id !== id); S.visits = S.visits.filter((x) => x.client_id !== id); S.events = S.events.filter((x) => x.client_id !== id); S.tx.forEach((x) => { if (x.client_id === id) x.client_id = null; }); }, ['Cliente apagado', n])) closeSheet();
}

/* lembretes */
function rem(id) { return S.reminders.find((r) => r.id === id); }
async function toggleRem(id) {
  const r = rem(id), t = T(), patch = r.repetir === 'nunca' ? { feito: !r.feito } : { feito_em: r.feito_em === t.iso ? null : t.iso };
  await act(async () => { Object.assign(r, await db.update('reminders', id, patch)); });
}
function openRem(id) {
  const r = rem(id), c = r.client_id ? client(r.client_id) : null;
  openSheet(sbar(['Fechar'], 'Lembrete', ['Editar', `newReminder('',null,${id})`]) + `<div class="grp" style="margin-top:6px">${cell({ t: esc(r.titulo), s: `${remWhen(r)}, ${hm(r.hora)}${c ? ' · ' + esc(c.name) : ''}` })}</div>` +
    `<button class="btn" onclick="toggleRem(${id}).then(closeSheet)">${remDone(r) ? 'Marcar como não feito' : 'Marcar como feito'}</button>` +
    (c ? `<button class="btn gray" onclick="openClient(${c.id})">Ver ${esc(c.name)}</button>` : '') +
    `<button class="btn gray danger" onclick="delRem(${id})">Apagar lembrete</button>`);
}
async function delRem(id) { if (await act(async () => { await db.remove('reminders', id); S.reminders = S.reminders.filter((r) => r.id !== id); }, ['Lembrete apagado', ''])) closeSheet(); }
function newReminder(text, cid, editId) {
  const r = editId ? rem(editId) : null, t = T();
  if (!r && cid && !text) text = client(cid).name + ': ';
  const d0 = r ? (r.dia || t.iso) : t.iso, rep = r ? r.repetir : 'nunca', hr = r ? hm(r.hora) : '09:00', wd = r && r.weekday != null ? r.weekday : t.wd;
  openSheet(sbar(['Cancelar'], editId ? 'Editar lembrete' : 'Novo lembrete', [editId ? 'Salvar' : 'Adicionar', `saveRem(${editId || 0})`]) +
    `<div class="grp" style="margin-top:6px"><div class="f"><input class="full" id="nr_t" value="${esc(r ? r.titulo : text || '')}" placeholder="O que lembrar"></div></div>` +
    '<div class="gh" style="padding-top:20px"><h3 style="font-size:17px">Quando avisar</h3></div><div class="grp">' +
    `<div class="f"><label for="nr_r">Repetir</label><select id="nr_r" onchange="remRepChange()"><option value="nunca"${rep === 'nunca' ? ' selected' : ''}>Nunca</option><option value="semana"${rep === 'semana' ? ' selected' : ''}>Toda semana</option><option value="dia"${rep === 'dia' ? ' selected' : ''}>Todo dia</option></select></div>` +
    `<div class="f" id="row_d"><label for="nr_d">Dia</label><input id="nr_d" type="date" value="${d0}" min="${t.iso}"></div>` +
    `<div class="f" id="row_w"><label for="nr_w">Dia da semana</label><select id="nr_w">${[1, 2, 3, 4, 5, 6, 0].map((i) => `<option value="${i}"${i === wd ? ' selected' : ''}>${cap(WD[i])}</option>`).join('')}</select></div>` +
    `<div class="f"><label for="nr_h">Hora</label><input id="nr_h" type="time" value="${hr}"></div></div>` +
    `<div class="grp" style="margin-top:20px"><div class="f"><label for="nr_c">Cliente</label><select id="nr_c"><option value="">Nenhum</option>${S.clients.map((c) => `<option value="${c.id}"${c.id === (r ? r.client_id : cid) ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>` +
    '<p class="cap">Na hora marcada chega uma notificação no celular, mesmo com o app fechado.</p>');
  remRepChange();
  if (!editId && !text) setTimeout(() => $('nr_t') && $('nr_t').focus(), 350);
}
function remRepChange() { const v = $('nr_r').value; $('row_d').style.display = v === 'nunca' ? '' : 'none'; $('row_w').style.display = v === 'semana' ? '' : 'none'; }
function saveRem(editId) {
  const titulo = val('nr_t'); if (!titulo) { $('nr_t').focus(); return; }
  const repetir = val('nr_r'), cv = val('nr_c');
  const row = { titulo, repetir, hora: val('nr_h') || '09:00', client_id: cv ? Number(cv) : null, dia: repetir === 'nunca' ? (val('nr_d') || T().iso) : null, weekday: repetir === 'semana' ? Number(val('nr_w')) : null };
  if (!editId) { row.feito = false; } else if (repetir === 'nunca') row.feito = false;
  saving(async () => {
    const ok2 = await act(async () => { if (editId) Object.assign(rem(editId), await db.update('reminders', editId, row)); else S.reminders.push(await db.insert('reminders', row)); },
      [editId ? 'Lembrete atualizado' : 'Lembrete criado', `${remWhen(row)} às ${row.hora} o celular avisa.`]);
    if (ok2) { closeSheet(); if (tab !== 'hoje') go('lembretes'); }
    return ok2;
  });
}

/* agenda */
function openEvent(kind, id) {
  const x = kind === 'sch' ? S.schedule.find((e) => e.id === id) : S.events.find((e) => e.id === id); if (!x) return;
  const c = client(x.client_id);
  openSheet(sbar(['Fechar'], kind === 'sch' ? 'Horário fixo' : 'Compromisso') + `<div class="grp" style="margin-top:6px">${cell({ t: esc(x.titulo), s: (kind === 'sch' ? 'Toda ' + WD[x.weekday] : dayLabel(x.dia)) + ', ' + hm(x.hora) + (c ? ' · ' + esc(c.name) : '') })}</div>` +
    (c ? `<button class="btn gray" onclick="openClient(${c.id})">Ver ${esc(c.name)}</button>` : '') + `<button class="btn gray danger" onclick="delEvent('${kind}',${id})">Apagar</button><p class="cap">O celular avisa 30 minutos antes.</p>`);
}
async function delEvent(kind, id) {
  const t = kind === 'sch' ? 'client_schedule' : 'events';
  if (await act(async () => { await db.remove(t, id); if (kind === 'sch') S.schedule = S.schedule.filter((x) => x.id !== id); else S.events = S.events.filter((x) => x.id !== id); }, ['Apagado', ''])) closeSheet();
}
function newEvent(cid) {
  if (!S.clients.length) { banner('Cadastre um cliente antes', 'Os compromissos ficam ligados a um cliente.'); return; }
  openSheet(sbar(['Cancelar'], 'Novo compromisso', ['Adicionar', 'saveEv()']) +
    '<div class="grp" style="margin-top:6px"><div class="f"><input class="full" id="ne_t" placeholder="Ex: gravação dos vídeos"></div></div>' +
    `<div class="grp" style="margin-top:20px"><div class="f"><label for="ne_c">Cliente</label><select id="ne_c">${S.clients.map((c) => `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>` +
    `<div class="f"><label for="ne_d">Dia</label><input id="ne_d" type="date" value="${aDay < T().iso ? T().iso : aDay}"></div>` +
    '<div class="f"><label for="ne_h">Hora</label><input id="ne_h" type="time" value="09:00"></div>' +
    '<div class="f"><label for="ne_r">Repetir</label><select id="ne_r"><option value="1">Toda semana</option><option value="0">Só uma vez</option></select></div></div>' +
    '<p class="cap">Avisa no celular 30 minutos antes. Repetindo toda semana, vira um horário fixo do cliente.</p>');
}
function saveEv() {
  const cid = Number(val('ne_c')), dia = val('ne_d') || T().iso, hora = val('ne_h') || '09:00', titulo = val('ne_t') || 'Compromisso', rec = val('ne_r') === '1', wd = parse(dia).getDay();
  saving(async () => {
    const ok2 = await act(async () => {
      if (rec) S.schedule.push(await db.insert('client_schedule', { client_id: cid, weekday: wd, hora, titulo }));
      else S.events.push(await db.insert('events', { client_id: cid, dia, hora, titulo }));
    }, ['Compromisso criado', `${client(cid).name}, ${rec ? 'toda ' + WD[wd] : dayLabel(dia).toLowerCase()} às ${hora}.`]);
    if (ok2) { aDay = dia; closeSheet(); go('agenda'); }
    return ok2;
  });
}

/* finanças */
function catChips(sel, list) { return `<div class="chips" id="cats">${list.map((k) => `<button class="chip${k === sel ? ' on' : ''}" data-k="${esc(k)}" onclick="pickCat(this)">${ico(k)}${esc(k)}</button>`).join('')}</div>`; }
function pickCat(b) { document.querySelectorAll('#cats .chip').forEach((x) => x.classList.toggle('on', x === b)); }
function curCat() { const o = document.querySelector('#cats .chip.on'); return o ? o.getAttribute('data-k') : 'Outros'; }
function moneyForm(title, save, v, t, cats, cat, extra, back) {
  openSheet(sbar(['Cancelar', back], title, ['Salvar', save]) +
    `<input class="money-in num" id="m_v" inputmode="decimal" placeholder="R$ 0,00" value="${v ? String(v).replace('.', ',') : ''}"><p class="money-cap">Valor</p>` +
    `<div class="grp" style="margin-top:16px"><div class="f"><input class="full" id="m_t" placeholder="Descrição" value="${esc(t || '')}"></div>${extra || ''}</div>` +
    '<div class="gh" style="padding-top:20px"><h3 style="font-size:17px">Categoria</h3></div>' + catChips(cat, cats));
  if (!v) setTimeout(() => $('m_v') && $('m_v').focus(), 350);
}
function newTx(tipo) { moneyForm(tipo === 'entrada' ? 'Nova entrada' : 'Novo gasto', `saveTx('${tipo}',0)`, 0, '', tipo === 'entrada' ? INCATS : SPENDCATS, tipo === 'entrada' ? 'Job avulso' : 'Ferramentas', `<div class="f"><label for="m_d">Data</label><input id="m_d" type="date" value="${T().iso}" max="${T().iso}"></div>`); }
function openTx(id) {
  const x = S.tx.find((y) => y.id === id); if (!x) return;
  if (x.client_id && client(x.client_id)) { openClient(x.client_id); return; }
  if (x.bill_id && S.bills.find((b) => b.id === x.bill_id)) { openBill(x.bill_id); return; }
  const list = x.tipo === 'entrada' ? INCATS.concat(INCATS.includes(x.cat) ? [] : [x.cat]) : SPENDCATS.concat(SPENDCATS.includes(x.cat) ? [] : [x.cat]);
  moneyForm(x.tipo === 'entrada' ? 'Entrada' : 'Gasto', `saveTx('${x.tipo}',${id})`, x.valor, x.titulo, list, x.cat, `<div class="f"><label for="m_d">Data</label><input id="m_d" type="date" value="${x.data}"></div>`);
  $('sheet').insertAdjacentHTML('beforeend', `<button class="btn gray danger" onclick="delTx(${id})">Apagar</button>`);
}
function saveTx(tipo, id) {
  const valor = money(val('m_v')); if (!valor) { $('m_v').focus(); return; }
  const row = { tipo, valor, titulo: val('m_t') || curCat(), cat: curCat(), data: val('m_d') || T().iso };
  saving(async () => {
    const ok2 = await act(async () => { if (id) Object.assign(S.tx.find((x) => x.id === id), await db.update('transactions', id, row)); else S.tx.push(await db.insert('transactions', row)); },
      [id ? 'Atualizado' : (tipo === 'entrada' ? 'Entrada salva' : 'Gasto salvo'), `${row.titulo}, ${fmt2(valor)}`]);
    if (ok2) { closeSheet(); finSeg = tipo === 'entrada' ? 'entradas' : 'saidas'; fMonth = monthKey(parse(row.data)); go('financas'); }
    return ok2;
  });
}
async function delTx(id) { if (await act(async () => { await db.remove('transactions', id); S.tx = S.tx.filter((x) => x.id !== id); }, ['Apagado', ''])) closeSheet(); }
const billDay = (d) => `<div class="f"><label for="m_d">Vence todo dia</label><input id="m_d" type="number" inputmode="numeric" min="1" max="31" value="${d || 10}"></div>`;
function newBill() { moneyForm('Nova conta fixa', 'saveBill(0)', 0, '', SPENDCATS, 'Ferramentas', billDay()); }
function openBill(id) {
  const b = S.bills.find((x) => x.id === id), p = billPaid(b);
  moneyForm('Conta fixa', `saveBill(${id})`, b.valor, b.titulo, SPENDCATS, b.cat, billDay(b.dia));
  $('sheet').insertAdjacentHTML('beforeend', `<button class="btn ${p ? 'gray' : 'green'}" onclick="toggleBill(${id})">${p ? 'Desfazer pagamento deste mês' : 'Paguei este mês'}</button><button class="btn gray danger" onclick="delBill(${id})">Apagar conta</button>`);
}
function saveBill(id) {
  const valor = money(val('m_v')); if (!valor) { $('m_v').focus(); return; }
  const row = { valor, titulo: val('m_t') || curCat(), cat: curCat(), dia: Math.min(31, Math.max(1, parseInt(val('m_d')) || 10)) };
  saving(async () => {
    const ok2 = await act(async () => { if (id) Object.assign(S.bills.find((x) => x.id === id), await db.update('bills', id, row)); else S.bills.push(await db.insert('bills', row)); },
      [id ? 'Conta atualizada' : 'Conta fixa salva', `${row.titulo}, todo dia ${row.dia}. O celular avisa 2 dias antes.`]);
    if (ok2) { closeSheet(); finSeg = 'resumo'; fMonth = T().mes; go('financas'); }
    return ok2;
  });
}
async function toggleBill(id) {
  const b = S.bills.find((x) => x.id === id), p = billPaid(b), t = T();
  const ok2 = await act(async () => {
    if (p) { await db.remove('transactions', p.id); S.tx = S.tx.filter((x) => x.id !== p.id); }
    else S.tx.push(await db.insert('transactions', { tipo: 'saida', titulo: b.titulo, cat: b.cat, valor: b.valor, data: t.iso, bill_id: id, ref_mes: t.mes }));
  }, p ? null : ['Conta paga', `${b.titulo}, ${fmt2(b.valor)}. Já entrou nas saídas.`]);
  if (ok2) closeSheet();
}
async function delBill(id) { if (await act(async () => { await db.remove('bills', id); S.bills = S.bills.filter((x) => x.id !== id); }, ['Conta apagada', ''])) closeSheet(); }

/* avisos */
function openNotifs() {
  const l = notifs(); notifSeen = l.map((x) => x.t).join('|');
  openSheet(sbar(['Fechar'], 'Avisos de hoje') + `<div class="grp" style="margin-top:6px">${l.map((n) => cell({ on: n.on, t: esc(n.t), s: esc(n.s) })).join('') || '<div class="empty">Nenhum aviso. Tudo em dia!</div>'}</div>`);
  render();
}
let bt;
function banner(t, s) { $('bnT').textContent = t; $('bnS').textContent = s || ''; const b = $('banner'); b.classList.add('on'); clearTimeout(bt); bt = setTimeout(() => b.classList.remove('on'), 3400); }

/* ---------------- notificações push ---------------- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function b64ToU8(b) { const p = '='.repeat((4 - b.length % 4) % 4), s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...s].map((c) => c.charCodeAt(0))); }
async function pushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS && !standalone ? 'instalar' : 'sem-suporte';
  if (Notification.permission === 'denied') return 'negado';
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); return sub && Notification.permission === 'granted' ? 'ativo' : 'inativo'; } catch (e) { return 'inativo'; }
}
async function fn(body, auth) {
  const h = { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY };
  if (auth) { const { data } = await sb.auth.getSession(); if (data.session) h.Authorization = 'Bearer ' + data.session.access_token; }
  const r = await fetch(CFG.SUPABASE_URL + '/functions/v1/notify', { method: 'POST', headers: h, body: JSON.stringify(body) });
  return r.json();
}
async function enablePush() {
  if (DEMO) { banner('Modo demonstração', 'Conecte o Supabase pra ativar os avisos de verdade.'); return; }
  try {
    const perm = await Notification.requestPermission(); if (perm !== 'granted') { banner('Notificações bloqueadas', 'Libere nos Ajustes do celular.'); openSettings(); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) { const { publicKey } = await fn({ acao: 'chave' }); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) }); }
    const j = sub.toJSON(); await db.saveSub({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    banner('Notificações ativadas', 'Os avisos vão chegar neste celular.'); openSettings();
  } catch (e) { console.error(e); banner('Não deu pra ativar', String(e.message || e)); }
}
async function testPush() {
  if (DEMO) { banner('Teste da Impulse', 'Os avisos vão chegar assim.'); return; }
  try { const r = await fn({ teste: true }, true); banner(r.enviados ? 'Teste enviado' : 'Não chegou', r.enviados ? 'Deve aparecer em alguns segundos.' : 'Desative e ative as notificações de novo.'); }
  catch (e) { banner('Não deu pra testar', 'Confira a internet.'); }
}

function toggleHide() {
  HIDE = !HIDE; if (HIDE && cFilter === 'late') cFilter = 'todos'; try { localStorage.setItem('im_hide', HIDE ? '1' : '0'); } catch (e) { }
  render(); banner(HIDE ? 'Valores escondidos' : 'Valores visíveis', HIDE ? 'Dinheiro e pagamentos escondidos.' : '');
}
/* ---------------- ajustes ---------------- */
function setTheme(t) { theme = t; document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('im_theme', t); } catch (e) { } }
async function setToggle(k, el) { S.toggles[k] = !S.toggles[k]; el.classList.toggle('on', S.toggles[k]); try { await db.saveSettings(S.toggles); } catch (e) { banner('Não deu pra salvar', 'Confira a internet.'); } }
async function openSettings() {
  const st = await pushState();
  const tg = (k, t) => `<div class="f"><label style="flex:1">${t}</label><button class="sw${S.toggles[k] ? ' on' : ''}" role="switch" aria-label="${t}" onclick="setToggle('${k}',this)"></button></div>`;
  const pushBox = {
    ativo: `<div class="grp">${cell({ t: 'Ativadas neste celular', r: 'Ligado', rc: 'green' })}</div><button class="btn gray" onclick="testPush()">Mandar notificação de teste</button>`,
    inativo: '<button class="btn" onclick="enablePush()">Ativar notificações neste celular</button>',
    negado: '<p class="cap" style="padding-top:0">As notificações foram bloqueadas. No iPhone: Ajustes > Notificações > Impulse > Permitir.</p>',
    instalar: `<div class="grp">${cell({ t: '1. Toque em Compartilhar no Safari' })}${cell({ t: '2. Adicionar à Tela de Início' })}${cell({ t: '3. Abra pelo ícone e volte aqui' })}</div><p class="cap">No iPhone, as notificações só funcionam com o app instalado na tela de início.</p>`,
    'sem-suporte': '<p class="cap" style="padding-top:0">Este navegador não recebe notificações. No iPhone, use o Safari e instale na tela de início.</p>'
  }[st];
  openSheet(sbar(['Fechar'], 'Ajustes') +
    `<div class="hero" style="padding-top:6px"><div class="ini" style="overflow:hidden;padding:0"><img src="icons/logo-96.jpg" style="width:100%;height:100%;object-fit:cover" alt=""></div><h2>Impulse Media</h2><p>${DEMO ? 'Modo demonstração' : esc(USER ? USER.email : '')}</p></div>` +
    `<div class="gh"><h3 style="font-size:17px">Notificações neste celular</h3></div>${pushBox}` +
    `<div class="gh"><h3 style="font-size:17px">O que avisar</h3></div><div class="grp">${tg('daily', 'Resumo do dia às 8h')}${tg('rem', 'Meus lembretes')}${tg('late', 'Cliente atrasou o pagamento')}${tg('bills', 'Conta fixa vencendo')}${tg('agenda', 'Compromissos (30 min antes)')}${tg('week', 'Quinta 18h: quem falta postar')}</div>` +
    `<div class="gh"><h3 style="font-size:17px">Aparência</h3></div><div class="segc" style="margin-top:0">${[['light', 'Claro'], ['dark', 'Escuro'], ['auto', 'Automático']].map((x) => `<button class="${theme === x[0] ? 'on' : ''}" onclick="setTheme('${x[0]}');openSettings()">${x[1]}</button>`).join('')}</div><p class="cap">No automático, segue o modo claro ou escuro do celular.</p>` +
    (DEMO ? '' : '<button class="btn gray danger" style="margin-top:26px" onclick="logout()">Sair da conta</button>'));
}

/* ---------------- login ---------------- */
function showLogin(msg) {
  $('tabbar').style.display = 'none'; $('tabs').innerHTML = '';
  $('view').innerHTML = `<div class="login"><div class="logo"><img src="icons/icon-192.png" alt=""></div><h1>Impulse Media</h1><p>Entre pra ver seus clientes</p>
  <form onsubmit="event.preventDefault();doLogin()"><div class="grp"><div class="f"><input class="full" id="lg_e" type="email" autocomplete="username" placeholder="E-mail" autocapitalize="off"></div><div class="f"><input class="full" id="lg_p" type="password" autocomplete="current-password" placeholder="Senha"></div></div>
  <div class="err" id="lg_err">${msg || ''}</div><button class="btn" id="lg_b" type="submit">Entrar</button></form>
  <button class="btn gray" onclick="forgot()">Esqueci a senha</button></div>`;
}
async function doLogin() {
  const b = $('lg_b'); b.disabled = true; $('lg_err').textContent = '';
  const { data, error } = await sb.auth.signInWithPassword({ email: val('lg_e'), password: $('lg_p').value });
  if (error) { b.disabled = false; $('lg_err').textContent = /invalid/i.test(error.message) ? 'E-mail ou senha errados.' : 'Não deu pra entrar. Confira a internet.'; return; }
  USER = data.user; await start();
}
async function forgot() {
  const e = val('lg_e'); if (!e) { $('lg_err').textContent = 'Digite seu e-mail acima e toque de novo.'; $('lg_e').focus(); return; }
  const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname });
  $('lg_err').textContent = error ? 'Não deu pra enviar. Tente de novo.' : 'Enviamos um link pro seu e-mail.';
}
function newPasswordSheet(first) {
  openSheet(sbar(['Depois'], first ? 'Crie sua senha' : 'Nova senha', ['Salvar', 'savePassword()']) + `<div class="grp" style="margin-top:6px"><div class="f"><input class="full" id="np" type="password" autocomplete="new-password" placeholder="Senha (mínimo 6)"></div></div><p class="cap">${first ? 'É com ela que você vai entrar no app daqui pra frente.' : ''}</p>`);
}
async function savePassword() { const p = $('np').value; if (p.length < 6) { banner('Senha curta', 'Use pelo menos 6 caracteres.'); return; } const { error } = await sb.auth.updateUser({ password: p }); if (error) banner('Não deu pra salvar', error.message); else { closeSheet(); banner('Senha alterada', ''); } }
async function logout() { closeSheet(); await sb.auth.signOut(); USER = null; showLogin(); }

/* ---------------- início ---------------- */
async function start() {
  $('view').innerHTML = '<div class="loading">Carregando…</div>';
  try { await loadAll(); } catch (e) { console.error(e); $('view').innerHTML = `<div class="loading" style="padding:0 30px;text-align:center">Não deu pra carregar os dados. Confira a internet e abra de novo.<br><br><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`; return; }
  drawTabs(); render();
}
let lastDay = T().iso;
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !$('tabs').innerHTML) return;
  if (T().iso !== lastDay) { lastDay = T().iso; aDay = lastDay; fMonth = T().mes; }
  try { await loadAll(); render(); } catch (e) { }
});

async function boot() {
  setTheme(theme);
  setTimeout(() => window.__splashDone && window.__splashDone(), 0);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (DEMO) {
    $('demo').innerHTML = '<div class="demo-bar">Modo demonstração: dados de exemplo, nada é salvo</div>';
    DEMO_STORE = demoData(); await start(); return;
  }
  if (!window.supabase || !window.supabase.createClient) { $('view').innerHTML = '<div class="loading" style="padding:0 30px;text-align:center">Não deu pra carregar. Confira a internet e abra de novo.<br><br><button class="btn" onclick="location.reload()">Tentar de novo</button></div>'; return; }
  const { createClient } = window.supabase;
  sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const hash = location.hash, invite = /type=(invite|signup)/.test(hash), recovery = /type=recovery/.test(hash);
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') setTimeout(() => newPasswordSheet(false), 800); });
  const { data } = await sb.auth.getSession();
  if (data.session) { USER = data.session.user; await start(); if (invite) setTimeout(() => newPasswordSheet(true), 800); else if (recovery) setTimeout(() => newPasswordSheet(false), 800); if (invite || recovery) history.replaceState(null, '', location.pathname); }
  else showLogin();
}

/* ---------------- dados de exemplo (modo demonstração) ---------------- */
function demoData() {
  const t = T(), ws = t.ws, mes = t.mes, prevMes = addMonths(mes, -1);
  const C = [['Rede Pop', 'redepop', 2, 'vídeos', 900, 5, '64999990001'], ['Bella Estética', 'bellaestetica', 3, 'posts', 700, 10, ''], ['Auto Peças Goiás', 'autopecasgoias', 2, 'vídeos', 800, 15, ''], ['Pizzaria Forno a Lenha', 'fornoalenha', 4, 'posts', 650, 20, ''], ['Clínica Sorriso', 'clinicasorriso', 2, 'posts', 1200, 5, ''], ['Academia Força Total', 'forcatotal', 3, 'vídeos', 750, 10, ''], ['Ótica Visão', 'oticavisao', 2, 'posts', 600, 25, ''], ['Doce Mel Confeitaria', 'docemel', 3, 'posts', 550, 1, '']];
  const clients = C.map((c, i) => ({ id: i + 1, name: c[0], ig: c[1], meta: c[2], tipo: c[3], valor: c[4], venc: c[5], phone: c[6] }));
  const posts = []; let pid = 1; [[1, 1, 0], [2, 3, 0], [3, 0, 1], [4, 2, 2], [5, 2, 0], [6, 1, 1], [7, 2, 0], [8, 1, 0]].forEach(([cid, d, s]) => { for (let i = 0; i < d; i++) posts.push({ id: pid++, client_id: cid, week_start: ws, status: 'postado' }); for (let i = 0; i < s; i++) posts.push({ id: pid++, client_id: cid, week_start: ws, status: 'agendado' }); });
  const tx = []; let tid = 1; const dd = (n) => iso(new Date(t.d.getFullYear(), t.d.getMonth(), Math.min(n, t.day)));
  [2, 5, 8].forEach((cid) => { const c = clients[cid - 1]; tx.push({ id: tid++, tipo: 'entrada', titulo: c.name, cat: 'Mensalidade', valor: c.valor, data: dd(c.venc), client_id: cid, ref_mes: mes }); });
  tx.push({ id: tid++, tipo: 'entrada', titulo: 'Vídeo de inauguração', cat: 'Job avulso', valor: 350, data: dd(3) });
  [['Gasolina das gravações', 'Transporte', 180, 2], ['Ring light', 'Equipamento', 249, 4], ['Impulsionamento', 'Anúncios', 150, 6]].forEach((x) => tx.push({ id: tid++, tipo: 'saida', titulo: x[0], cat: x[1], valor: x[2], data: dd(x[3]) }));
  tx.push({ id: tid++, tipo: 'saida', titulo: 'Canva Pro', cat: 'Ferramentas', valor: 34.9, data: dd(1), bill_id: 1, ref_mes: mes });
  for (let m = 1; m <= 5; m++) { const mk = addMonths(mes, -m), d = mk.slice(0, 8) + '10'; tx.push({ id: tid++, tipo: 'entrada', titulo: 'Mensalidades', cat: 'Mensalidade', valor: 5200 - m * 300, data: d }); tx.push({ id: tid++, tipo: 'saida', titulo: 'Gastos do mês', cat: 'Outros', valor: 900 + (m % 3) * 250, data: d }); }
  return {
    clients, posts, edits: [{ id: 1, client_id: 1, week_start: ws }, { id: 2, client_id: 3, week_start: ws }, { id: 3, client_id: 3, week_start: ws }, { id: 4, client_id: 2, week_start: ws }, { id: 5, client_id: 2, week_start: ws }, { id: 6, client_id: 2, week_start: ws }, { id: 7, client_id: 2, week_start: ws }],
    visits: [{ id: 1, client_id: 1, dia: t.iso, qtd: 2, obs: 'Gravação na loja' }, { id: 2, client_id: 2, dia: ws, qtd: 5, obs: 'Fotos e vídeos' }, { id: 3, client_id: 3, dia: ws, qtd: 3, obs: '' }],
    client_schedule: [{ id: 1, client_id: 1, weekday: 3, hora: '09:00', titulo: 'Gravação dos vídeos' }, { id: 2, client_id: 2, weekday: 1, hora: '14:00', titulo: 'Fotos da semana' }, { id: 3, client_id: 6, weekday: t.wd, hora: '17:00', titulo: 'Gravação de treino' }],
    events: [],
    reminders: [{ id: 1, titulo: 'Postar vídeo da Rede Pop', client_id: 1, repetir: 'nunca', dia: iso(addDays(t.d, 1)), hora: '09:00', feito: false }, { id: 2, titulo: 'Mandar roteiro pra Clínica Sorriso', client_id: 5, repetir: 'nunca', dia: t.iso, hora: '14:00', feito: false }, { id: 3, titulo: 'Stories da Bella Estética', client_id: 2, repetir: 'dia', hora: '10:00', feito: false }, { id: 4, titulo: 'Planejar conteúdo da semana', client_id: null, repetir: 'semana', weekday: 1, hora: '08:00', feito: false }],
    bills: [{ id: 1, titulo: 'Canva Pro', cat: 'Ferramentas', valor: 34.9, dia: 12 }, { id: 2, titulo: 'Internet', cat: 'Contas', valor: 99.9, dia: 10 }, { id: 3, titulo: 'DAS do MEI', cat: 'Impostos', valor: 76.6, dia: 20 }],
    transactions: tx, settings: null
  };
}

/* expõe as funções usadas nos botões */
Object.assign(window, { toggleHide, newPasswordSheet, markEdit, undoEdit, newVisit, saveVisit, openVisit, delVisit, openReport, rMonthGet, makePDF, fromBoardFlag, go, render, drawCList, openBoard, openClient, markPost, undoPost, receive, unpay, cobrar, newClient, saveClient, editClient, askDelClient, delClient, toggleRem, openRem, delRem, newReminder, remRepChange, saveRem, openEvent, delEvent, newEvent, saveEv, pickCat, newTx, openTx, saveTx, delTx, newBill, openBill, saveBill, toggleBill, delBill, openNotifs, openSettings, setTheme, setToggle, enablePush, testPush, closeSheet, doLogin, forgot, savePassword, logout, T, iso, parse, addDays, addMonths, monthKey });
Object.defineProperty(window, 'cFilter', { get: () => cFilter, set: (v) => { cFilter = v; } });
Object.defineProperty(window, 'cQuery', { get: () => cQuery, set: (v) => { cQuery = v; } });
Object.defineProperty(window, 'aDay', { get: () => aDay, set: (v) => { aDay = v; } });
Object.defineProperty(window, 'finSeg', { get: () => finSeg, set: (v) => { finSeg = v; } });
Object.defineProperty(window, 'fMonth', { get: () => fMonth, set: (v) => { fMonth = v; } });

boot();
