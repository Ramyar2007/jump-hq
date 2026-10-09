// Agency HQ server: dashboard + API + live WebSocket + agent API for the hq MCP server.
import express from 'express';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { Store, STAGES } from './db.js';
import { Config } from './config.js';
import { Runner } from './runner.js';
import { Publisher } from './publish.js';
import { listAgents, AGENTS } from './agents.js';
import { Judge } from './judge.js';
import { Telegram, Tunnel, lanUrl, claudeStatus, githubStatus } from './connect.js';
import QRCode from 'qrcode';
const AGENT_FROM = Object.fromEntries(Object.entries(AGENTS).map(([k, a]) => [k, a.from]));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.HQ_PORT || 4777);
const HOST = process.env.HQ_HOST || '127.0.0.1';
const DATA = process.env.HQ_DATA ? path.resolve(process.env.HQ_DATA) : path.join(ROOT, 'data');

const config = new Config(path.join(DATA, 'config.json'));
const store = new Store(path.join(DATA, 'db.json'));

// CLI: node server/index.js --set-password <pw>
const pwFlag = process.argv.indexOf('--set-password');
if (pwFlag > 0) {
  const pw = process.argv[pwFlag + 1];
  if (!pw || pw.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }
  config.setPassword(pw);
  console.log('Password set.');
  process.exit(0);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();
const broadcast = (msg) => { const s = JSON.stringify(msg); for (const c of clients) if (c.readyState === 1) c.send(s); };

const runner = new Runner({ store, config, root: ROOT, dataDir: DATA, port: PORT, broadcast });
const publisher = new Publisher({ sitesDir: runner.sitesDir, config });
store.onChange((kind, payload) => broadcast({ type: 'change', kind, payload }));
const judge = new Judge({ store, config, root: ROOT, sitesDir: runner.sitesDir });
const telegram = new Telegram(config);
const tunnel = new Tunnel({ port: PORT, onUrl: (u) => { broadcast({ type: 'link', url: u }); if (u) store.log(`Phone link is live: ${u}`, { kind: 'note' }); } });

// ---- sessions -------------------------------------------------------------
// A session is a browser cookie or a paired phone. Phones send "Authorization: Bearer <token>".
const SESS_FILE = path.join(DATA, 'sessions.json');
const sessions = new Map(fs.existsSync(SESS_FILE) ? Object.entries(JSON.parse(fs.readFileSync(SESS_FILE, 'utf8'))) : []);
const saveSessions = () => fs.writeFileSync(SESS_FILE, JSON.stringify(Object.fromEntries(sessions)));
const SESSION_DAYS = 14;
const DEVICE_DAYS = 180;
const expOf = (v) => (typeof v === 'number' ? v : v?.exp || 0);
function newSession(res) {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + SESSION_DAYS * 864e5);
  saveSessions();
  res.cookie('hq', t, { httpOnly: true, sameSite: 'strict', maxAge: SESSION_DAYS * 864e5 });
}
const tokenOf = (req) => {
  const h = req.get?.('authorization') || req.headers?.authorization || '';
  if (/^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, '').trim();
  return req.cookies?.hq || req.query?.k || '';
};
function authed(req) {
  const t = tokenOf(req);
  const v = t && sessions.get(t);
  if (!v) return false;
  if (expOf(v) < Date.now()) { sessions.delete(t); saveSessions(); return false; }
  if (typeof v === 'object' && Date.now() - (v.seen || 0) > 60e3) { v.seen = Date.now(); saveSessions(); }
  return true;
}
const loginAttempts = new Map();
// Requests that came in over the public link (Cloudflare adds these headers).
const viaTunnel = (req) => Boolean(req.get('cf-connecting-ip') || req.get('cf-ray'));
const clientIp = (req) => req.get('cf-connecting-ip') || req.ip;
function limited(req, res, key) {
  const k = `${key}:${clientIp(req)}`;
  const a = loginAttempts.get(k) || { n: 0, until: 0 };
  if (a.until > Date.now()) { res.status(429).json({ error: 'Too many attempts. Wait a minute.' }); return null; }
  return { fail() { a.n += 1; if (a.n >= 5) { a.until = Date.now() + 60e3; a.n = 0; } loginAttempts.set(k, a); }, ok() { loginAttempts.delete(k); } };
}

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => { res.set({ 'x-frame-options': 'SAMEORIGIN', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' }); next(); });
// The agents' private API is never reachable from the internet, only from this computer.
app.use('/agent-api', (req, res, next) => (viaTunnel(req) ? res.status(404).end() : next()));
app.get('/api/ping', (req, res) => res.json({ ok: true, app: 'jump-hq' }));

// ---- auth -----------------------------------------------------------------
app.get('/api/session', (req, res) => res.json({ authed: authed(req), needsSetup: !config.data.auth.hash, lang: config.data.ui_language }));
app.post('/api/setup', (req, res) => {
  if (viaTunnel(req)) return res.status(403).json({ error: 'Set up the password on the computer first.' });
  if (config.data.auth.hash) return res.status(400).json({ error: 'Already set up' });
  const pw = String(req.body.password || '');
  if (pw.length < 8) return res.status(400).json({ error: 'Use at least 8 characters.' });
  config.setPassword(pw);
  newSession(res);
  res.json({ ok: true });
});
app.post('/api/login', (req, res) => {
  const lim = limited(req, res, 'login'); if (!lim) return;
  if (!config.checkPassword(req.body.password)) { lim.fail(); return res.status(401).json({ error: 'Wrong password.' }); }
  lim.ok();
  newSession(res);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { sessions.delete(tokenOf(req)); saveSessions(); res.clearCookie('hq'); res.json({ ok: true }); });

// ---- phone pairing: the dashboard shows a QR, the app scans it and gets its own key -------
const pairCodes = new Map(); // code -> expiry
function issueDevice(name) {
  const t = crypto.randomBytes(32).toString('hex');
  const dev = { kind: 'device', id: crypto.randomBytes(5).toString('hex'), name: String(name || 'Phone').slice(0, 60), created: Date.now(), seen: Date.now(), exp: Date.now() + DEVICE_DAYS * 864e5 };
  sessions.set(t, dev);
  saveSessions();
  store.log(`Phone paired: ${dev.name}`, { kind: 'done' });
  return { token: t, company: config.data.company.name, lang: config.data.ui_language };
}
app.post('/api/pair/claim', (req, res) => {
  const lim = limited(req, res, 'pair'); if (!lim) return;
  const code = String(req.body.code || '').trim().toUpperCase();
  const exp = pairCodes.get(code);
  if (!exp || exp < Date.now()) { lim.fail(); return res.status(401).json({ error: 'This pairing code is wrong or expired. Make a new one on the computer.' }); }
  pairCodes.delete(code);
  lim.ok();
  res.json(issueDevice(req.body.device));
});
app.post('/api/pair/password', (req, res) => {
  // pairing with the dashboard password, for when the QR can't be scanned
  const lim = limited(req, res, 'login'); if (!lim) return;
  if (!config.checkPassword(req.body.password)) { lim.fail(); return res.status(401).json({ error: 'Wrong password.' }); }
  lim.ok();
  res.json(issueDevice(req.body.device));
});

const guard = (req, res, next) => (authed(req) ? next() : res.status(401).json({ error: 'Not signed in' }));
const api = express.Router();
api.use(guard);

// ---- dashboard API ----------------------------------------------------------
const siteOf = (l) => store.data.sites.find((x) => x.lead_id === l.id || (l.demo?.slug && x.slug === l.demo.slug));
const sentStage = (l) => ['sent', 'replied', 'won'].includes(l.stage) || (l.stage === 'lost' && l.history?.some((h) => /sent/i.test(h.text)));

// How far every business in a set got: the live funnel.
function funnel(leads) {
  const q = config.data.qualify;
  const score = (l) => l.opportunity?.score ?? -1;
  return {
    found: leads.length,
    verified: leads.filter((l) => l.profile?.verdict === 'pass').length,
    scored: leads.filter((l) => l.opportunity).length,
    worth: leads.filter((l) => score(l) >= q.hold).length,
    high: leads.filter((l) => score(l) >= q.threshold).length,
    planned: leads.filter((l) => l.plan).length,
    approved: leads.filter((l) => l.review?.verdict === 'approve').length,
    demos: leads.filter((l) => siteOf(l)).length,
    live: leads.filter((l) => siteOf(l)?.public_url).length,
    sent: leads.filter(sentStage).length,
    replied: leads.filter((l) => ['replied', 'won'].includes(l.stage)).length,
    won: leads.filter((l) => l.stage === 'won').length,
  };
}

function huntView(h) {
  const leads = store.data.leads.filter((l) => l.hunt_id === h.id);
  const runs = store.data.runs.filter((r) => r.hunt_id === h.id);
  const now = runs.find((r) => r.status === 'running');
  return { ...h, funnel: funnel(leads), working: now ? { agent: now.agent, title: now.title, started: now.started } : null, queued: runs.filter((r) => r.status === 'queued').length };
}

function stats() {
  const by = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const l of store.data.leads) by[l.stage] = (by[l.stage] || 0) + 1;
  const day = new Date().toISOString().slice(0, 10);
  const sentToday = store.data.approvals.filter((a) => ['email', 'whatsapp'].includes(a.type) && a.status === 'sent' && (a.sent_at || '').slice(0, 10) === day).length;
  const won = store.data.leads.filter((l) => l.stage === 'won');
  const money = (k) => won.reduce((t, l) => t + (config.market(l.market_id)?.[k] || 0), 0);
  return {
    stages: by,
    leads: store.data.leads.length,
    demos: store.data.sites.length,
    published: store.data.sites.filter((s) => s.public_url).length,
    pending: store.data.approvals.filter((a) => a.status === 'pending').length,
    sentToday,
    sentTotal: store.data.approvals.filter((a) => ['email', 'whatsapp'].includes(a.type) && a.status === 'sent').length,
    won: won.length,
    revenue: money('build_price'),
    mrr: money('monthly_price'),
    funnel: funnel(store.data.leads),
  };
}

// ---- Sleep mode: the team works alone, the Judge approves, risky things wait for the owner ----
const hhmm = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
function scheduledSleep() {
  const sl = config.data.sleep;
  if (!sl.schedule) return false;
  const d = new Date(); const now = d.getHours() * 60 + d.getMinutes();
  const a = hhmm(sl.from), b = hhmm(sl.to);
  return a <= b ? now >= a && now < b : now >= a || now < b;
}
const asleep = () => config.data.mode === 'sleep' || scheduledSleep();
const meta = () => store.data.meta;

function night() {
  const n = meta().night;
  if (!n) return null;
  const inN = (iso) => iso && iso >= n.start && (!n.end || iso <= n.end);
  const autoSent = store.data.approvals.filter((a) => a.auto && inN(a.sent_at || a.decided));
  return {
    ...n,
    active: !n.end,
    found: store.data.leads.filter((l) => inN(l.created)).length,
    checked: store.data.leads.filter((l) => l.opportunity && inN(l.opportunity.at)).length,
    demos: store.data.sites.filter((s) => inN(s.created)).length,
    published: store.data.sites.filter((s) => s.auto && inN(s.published_at)).length,
    sent: autoSent.filter((a) => a.status === 'sent').length,
    ready: autoSent.filter((a) => a.status === 'approved').length,
    held: store.data.approvals.filter((a) => a.status === 'pending' && a.judge && !a.judge.passes && inN(a.judge.at)).length
      + store.data.sites.filter((s) => s.judge && !s.judge.passes && !s.public_url && inN(s.judge.at)).length,
    searches: store.data.hunts.filter((h) => inN(h.created)).length,
  };
}
function nightLine(r) {
  const t = { en: [`While you slept: ${r.searches} searches, ${r.found} businesses found, ${r.demos} demos built, ${r.published} put online, ${r.sent} messages sent, ${r.ready} ready for you to send, ${r.held} held by the Judge for you.`], ckb: [`کاتێک خەوتبوویت: ${r.searches} گەڕان، ${r.found} بزنس دۆزرایەوە، ${r.demos} دیمۆ دروستکرا، ${r.published} بڵاوکرایەوە، ${r.sent} نامە نێردرا، ${r.ready} ئامادەیە بۆ ناردن، ${r.held} دادوەر ڕایگرتووە بۆ تۆ.`], ar: [`أثناء نومك: ${r.searches} عمليات بحث، ${r.found} نشاطاً تجارياً، ${r.demos} مواقع تجريبية، ${r.published} نُشرت، ${r.sent} رسائل أُرسلت، ${r.ready} جاهزة للإرسال، ${r.held} أوقفها الحَكَم لك.`] };
  return (t[config.data.ui_language] || t.en)[0];
}

let wasAsleep = asleep();
function syncMode() {
  const now = asleep();
  if (now === wasAsleep) return;
  wasAsleep = now;
  if (now) {
    meta().night = { start: new Date().toISOString(), end: null, next_search: 0 };
    store.log('Sleep mode on: the team works alone and the Judge approves. Anything risky waits for you.', { kind: 'start' });
    telegram.notify('😴 Jump HQ is in Sleep mode. The team keeps working; the Judge approves safe work and holds anything risky for you.');
    catchUp();
  } else {
    if (meta().night && !meta().night.end) meta().night.end = new Date().toISOString();
    const r = night();
    store.log(r ? nightLine(r) : 'Awake mode: you approve everything again.', { kind: 'done' });
    if (r) telegram.notify(`☀️ ${nightLine(r)}`);
  }
  store.save();
  broadcast({ type: 'mode', mode: now ? 'sleep' : 'awake' });
  runner.tick();
}

// When the owner goes to sleep, the Judge also works through what was already waiting.
function catchUp() {
  for (const a of store.data.approvals.filter((x) => x.status === 'pending' && ['email', 'whatsapp'].includes(x.type) && !x.judge)) reviewMessage(a.id);
  for (const s of store.data.sites.filter((x) => !x.public_url && !x.judge)) {
    const l = store.data.leads.find((x) => x.id === s.lead_id || x.demo?.slug === s.slug);
    if (l?.stage === 'demo_built') reviewDemo(l.id);
  }
}

async function publishDemo(lead, { auto = false } = {}) {
  const site = siteOf(lead);
  if (!site) throw new Error('This business has no demo yet.');
  if (!site.public_url) {
    store.log(`Putting ${lead.business}'s demo online…`, { kind: 'queue' });
    const url = await publisher.publish(site.slug);
    store.upsertSite({ slug: site.slug, public_url: url, published_at: new Date().toISOString(), auto });
    store.log(`${lead.business}'s demo is online${auto ? ' (approved by the Judge)' : ''}: ${url}`, { kind: 'done' });
  }
  const hasDraft = store.data.approvals.some((a) => a.lead_id === lead.id && ['email', 'whatsapp'].includes(a.type) && ['pending', 'approved'].includes(a.status));
  const writing = store.data.runs.some((r) => r.lead_id === lead.id && r.agent === 'writer' && ['queued', 'running'].includes(r.status));
  if (!hasDraft && !writing && !['sent', 'replied', 'won'].includes(lead.stage)) runner.enqueue('writer', { lead_id: lead.id });
  return siteOf(lead);
}

async function reviewDemo(leadId) {
  const lead = store.getLead(leadId);
  const site = lead && siteOf(lead);
  if (!site || site.public_url) return;
  const sleeping = asleep();
  if (!sleeping && !config.data.sleep.second_opinion) return;
  store.upsertSite({ slug: site.slug, judging: true });
  const v = await judge.judge('demo', site, { lead });
  store.upsertSite({ slug: site.slug, judge: v, judging: false });
  store.log(`Judge on ${lead.business}'s demo: ${v.score}/100, ${v.passes ? 'safe to put online' : 'held for you'}${v.summary ? `. ${v.summary}` : ''}`, { kind: v.passes ? 'done' : 'approval' });
  if (asleep() && v.passes && config.data.sleep.auto_publish) {
    try { await publishDemo(lead, { auto: true }); } catch (e) { store.log(`Could not put ${lead.business}'s demo online: ${e.message}`, { kind: 'error' }); }
  } else if (asleep() && !v.passes) telegram.notify(`⏸ The Judge held ${lead.business}'s demo for you: ${v.summary}`);
}

const sentTonight = () => { const n = meta().night; return n ? store.data.approvals.filter((a) => a.auto && a.status === 'sent' && a.sent_at >= n.start).length : 0; };
async function reviewMessage(aid) {
  let a = store.getApproval(aid);
  if (!a || a.status !== 'pending') return;
  if (!asleep() && !config.data.sleep.second_opinion) return;
  const lead = a.lead_id && store.getLead(a.lead_id);
  const site = lead && siteOf(lead);
  a.judging = true; store.save(); store.emit('approval', a);
  const v = await judge.judge('message', a, { lead, demoUrl: site?.public_url || '' });
  a = store.getApproval(aid);
  a.judging = false; a.judge = v; store.save(); store.emit('approval', a);
  store.log(`Judge on the message to ${lead?.business || a.to}: ${v.score}/100, ${v.passes ? (v.revised ? 'safe after small fixes' : 'safe to send') : 'held for you'}${v.summary ? `. ${v.summary}` : ''}`, { kind: v.passes ? 'done' : 'approval' });
  if (!asleep() || a.status !== 'pending') return;
  if (!v.passes) return telegram.notify(`⏸ The Judge held a message to ${lead?.business || a.to}: ${v.summary}`);
  if (v.revised) { a.original = { subject: a.subject, body: a.body }; a.subject = v.revised.subject || a.subject; a.body = v.revised.body; }
  a.auto = true;
  const st = stats();
  const cap = Math.min(config.data.outreach.daily_send_cap - st.sentToday, config.data.sleep.max_sends - sentTonight());
  const canMail = a.type === 'email' && config.data.sleep.auto_send && config.data.outreach.sender === 'smtp' && config.data.smtp.user && config.data.smtp.pass;
  if (canMail && cap > 0) {
    try { await sendEmail(a); markSent(a); store.log(`Sent by itself to ${a.to} after the Judge approved it.`, { kind: 'done' }); return; }
    catch (e) { store.log(`Automatic sending failed (${e.message}); the message is ready for you to send.`, { kind: 'error' }); }
  }
  store.decide(a.id, 'approved', { decision_note: 'Approved by the Judge', wa_link: a.type === 'whatsapp' ? waLink(a) : undefined, auto: true });
  store.log(`${a.type === 'whatsapp' ? 'WhatsApp message' : 'Email'} to ${lead?.business || a.to} approved by the Judge: one tap to send it in the morning.`, { kind: 'done' });
}

// Night plan: when the team is idle in Sleep mode, start the next planned search.
setInterval(() => {
  syncMode();
  if (!asleep() || runner.paused) return;
  const n = meta().night; const plan = config.data.sleep.searches || [];
  if (!n || n.next_search >= plan.length) return;
  if (store.data.runs.some((r) => ['queued', 'running'].includes(r.status))) return;
  const s = plan[n.next_search++];
  store.save();
  try { startHunt({ ...s, market_id: s.market_id || config.data.market_id }); } catch (e) { store.log(`Night plan: ${e.message}`, { kind: 'error' }); }
}, 30e3);
setInterval(() => tunnel.check(), 5 * 60e3);

api.post('/mode', (req, res) => {
  const mode = req.body.mode === 'sleep' ? 'sleep' : 'awake';
  config.update({ mode, ...(mode === 'awake' && scheduledSleep() ? { sleep: { schedule: false } } : {}) });
  syncMode();
  res.json({ mode: asleep() ? 'sleep' : 'awake', night: night() });
});
api.get('/night', (req, res) => res.json(night()));
api.post('/judge/:kind/:id', async (req, res) => {
  // ask the Judge again (e.g. after the owner edited the message)
  if (req.params.kind === 'message') { const a = store.getApproval(req.params.id); if (!a) return res.status(404).json({ error: 'No such message' }); a.judge = null; reviewMessage(a.id); }
  else reviewDemo(req.params.id);
  res.json({ ok: true });
});

// ---- connections ----------------------------------------------------------------------
async function connections() {
  const c = config.data;
  const [claude, github] = await Promise.all([claudeStatus(), githubStatus()]);
  return {
    brain: { ok: claude.ok, detail: claude.detail, model: c.limits.model },
    email: { ok: Boolean(c.outreach.sender === 'smtp' && c.smtp.user && c.smtp.pass), manual: c.outreach.sender !== 'smtp', host: c.smtp.host, user: c.smtp.user },
    whatsapp: { ok: true, prefix: config.market('krd')?.phone_prefix },
    telegram: { ok: telegram.on, enabled: c.connections.telegram.enabled, chat_id: c.connections.telegram.chat_id },
    publish: { ok: github.ok, detail: github.detail, repo: c.publish.repo },
    phone: { ok: Boolean(tunnel.url), status: tunnel.status, url: tunnel.url, lan: HOST === '0.0.0.0' ? lanUrl(PORT) : '', devices: devices().length },
  };
}
function devices() { return [...sessions.entries()].filter(([, v]) => v?.kind === 'device' && expOf(v) > Date.now()).map(([, v]) => ({ id: v.id, name: v.name, created: v.created, seen: v.seen })); }
api.get('/connections', async (req, res) => res.json(await connections()));
api.post('/connections/test', async (req, res) => {
  const which = req.body.which;
  try {
    if (which === 'email') {
      const s = config.data.smtp;
      await nodemailer.createTransport({ host: s.host, port: Number(s.port), secure: Boolean(s.secure), auth: { user: s.user, pass: s.pass } }).verify();
      return res.json({ ok: true, message: 'The mail server accepted your login.' });
    }
    if (which === 'telegram') {
      const t = config.data.connections.telegram;
      if (!t.token) throw new Error('Add your bot token first.');
      if (!t.chat_id) { config.update({ connections: { telegram: { chat_id: await telegram.findChat(t.token) } } }); }
      await telegram.send('✅ Jump HQ is connected. You will get alerts here.');
      config.update({ connections: { telegram: { enabled: true } } });
      return res.json({ ok: true, message: 'Sent a test message to your Telegram.' });
    }
    if (which === 'brain') { const s = await claudeStatus(); if (!s.ok) throw new Error(s.detail); return res.json({ ok: true, message: s.detail }); }
    if (which === 'publish') { const s = await githubStatus(); if (!s.ok) throw new Error(s.detail); return res.json({ ok: true, message: s.detail }); }
    if (which === 'phone') { config.update({ connections: { phone: { public_link: true } } }); await tunnel.start(); return res.json({ ok: true, message: tunnel.url ? `Live at ${tunnel.url}` : 'Starting the public link…' }); }
    throw new Error('Unknown connection');
  } catch (e) { res.status(400).json({ error: e.message }); }
});
api.post('/pair', async (req, res) => {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  pairCodes.set(code, Date.now() + 10 * 60e3);
  if (!tunnel.url && config.data.connections.phone.public_link) await tunnel.start();
  for (let i = 0; i < 40 && !tunnel.url; i++) await new Promise((r) => setTimeout(r, 250));
  const url = tunnel.url || (HOST === '0.0.0.0' ? lanUrl(PORT) : '');
  const payload = `jumphq://pair?u=${encodeURIComponent(url)}&c=${code}`;
  const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, color: { dark: '#0f1b33', light: '#ffffff' } });
  res.json({ code, url, payload, svg, expires: Date.now() + 10 * 60e3 });
});
api.get('/devices', (req, res) => res.json(devices()));
api.delete('/devices/:id', (req, res) => {
  for (const [t, v] of sessions) if (v?.kind === 'device' && v.id === req.params.id) sessions.delete(t);
  saveSessions();
  res.json({ ok: true });
});

api.get('/bootstrap', (req, res) => {
  res.json({
    mode: asleep() ? 'sleep' : 'awake',
    night: night(),
    link: tunnel.url,
    config: config.public(),
    agents: listAgents(),
    stages: STAGES,
    leads: store.data.leads,
    approvals: store.data.approvals,
    runs: store.data.runs.slice(0, 100),
    hunts: store.data.hunts.slice(0, 30).map(huntView),
    sites: store.data.sites,
    activity: store.data.activity.slice(0, 120),
    runner: runner.state(),
    stats: stats(),
  });
});
api.get('/stats', (req, res) => res.json(stats()));

api.post('/runs', (req, res) => {
  try { res.json(runner.enqueue(req.body.agent, req.body.input || {}, { autopilot: Boolean(req.body.autopilot) })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
// A search: "find <how many> <kind of business> in <city>", then the whole team works through them.
function startHunt(body) {
  const market = config.market(body.market_id);
  const city = String(body.city || '').trim(), niche = String(body.niche || '').trim();
  if (!city || !niche) throw new Error('Pick a city and a kind of business.');
  const target = Math.max(1, Math.min(30, Number(body.count) || 10));
  const build = Math.max(0, Math.min(target, Number(body.build ?? 3)));
  const h = store.addHunt({ market_id: market.id, city, niche, target, build_max: build });
  runner.enqueue('scout', { niche, city, count: target, build, hunt_id: h.id, market_id: market.id }, { autopilot: true });
  store.log(`New search: ${target} ${niche} in ${city}`, { kind: 'start' });
  return huntView(store.getHunt(h.id));
}
api.post('/hunts', (req, res) => { try { res.json(startHunt(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); } });
api.post('/autopilot', (req, res) => { try { res.json(startHunt(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); } });
api.get('/hunts', (req, res) => res.json(store.data.hunts.map(huntView)));
api.post('/hunts/:id/stop', (req, res) => { runner.stopHunt(req.params.id); res.json(huntView(store.getHunt(req.params.id))); });
api.post('/hunts/:id/continue', (req, res) => {
  // pick up anything in this search that stopped half-way (e.g. after a restart)
  const h = store.getHunt(req.params.id);
  if (!h) return res.status(404).json({ error: 'No such search' });
  store.updateHunt(h.id, { status: 'running', ended: null });
  let n = 0;
  for (const key of ['investigator', 'opportunity', 'strategist', 'reviewer']) {
    const ids = store.data.leads.filter((l) => l.hunt_id === h.id && l.stage === AGENT_FROM[key]).map((l) => l.id);
    for (let k = 0; k < ids.length; k += 6) { try { runner.enqueue(key, { lead_ids: ids.slice(k, k + 6), hunt_id: h.id }, { autopilot: true }); n++; } catch {} }
  }
  if (!n) runner.checkHunt(h.id);
  res.json({ ...huntView(store.getHunt(h.id)), started: n });
});

api.get('/runs/:id/events', (req, res) => res.json(runner.events(req.params.id)));
api.post('/runs/:id/stop', (req, res) => res.json({ ok: runner.stop(req.params.id) }));
api.post('/runner/stop-all', (req, res) => { runner.stopAll(); res.json({ ok: true }); });
api.post('/runner/resume', (req, res) => { runner.setPaused(false); res.json(runner.state()); });
api.post('/runner/pause', (req, res) => { runner.setPaused(true, 'Paused by you.'); res.json(runner.state()); });

api.patch('/leads/:id', (req, res) => {
  const { note, ...patch } = req.body;
  const lead = store.updateLead(req.params.id, patch, note || (patch.stage ? `Moved to ${patch.stage}` : 'Edited'));
  lead ? res.json(lead) : res.status(404).json({ error: 'No such lead' });
});
api.delete('/leads/:id', (req, res) => { store.deleteLead(req.params.id); res.json({ ok: true }); });

// Approvals: approve (and send if SMTP is configured), reject, edit, mark sent manually.
async function sendEmail(a) {
  const s = config.data.smtp;
  const t = nodemailer.createTransport({ host: s.host, port: Number(s.port), secure: Boolean(s.secure), auth: { user: s.user, pass: s.pass } });
  const c = config.data.company;
  await t.sendMail({ from: `"${c.sender_name}" <${c.sender_email}>`, to: a.to, subject: a.subject, text: a.body });
}
function markSent(a) {
  store.decide(a.id, 'sent', { sent_at: new Date().toISOString() });
  const what = a.type === 'whatsapp' ? 'WhatsApp message' : 'Email';
  if (a.lead_id) { const l = store.getLead(a.lead_id); if (l && !['replied', 'won'].includes(l.stage)) store.updateLead(a.lead_id, { stage: 'sent' }, `${what} sent`); }
  store.log(`${what} sent to ${a.to}`, { kind: 'done' });
}
// The main message only: the English copy under it is for the owner to read.
const mainText = (body) => String(body || '').split(/\n\s*-{3,}\s*\n|\n\s*\(?English( version| translation)?\)?\s*:?\s*\n/i)[0].trim();
// wa.me link with the message ready to send from the owner's own WhatsApp.
function waLink(a) {
  const lead = a.lead_id && store.getLead(a.lead_id);
  const prefix = config.market(lead?.market_id)?.phone_prefix || '';
  let d = String(a.to || lead?.whatsapp || lead?.phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0') && prefix) d = prefix + d.slice(1);
  else if (prefix && d.length <= 10) d = prefix + d;
  return d.length >= 8 ? `https://wa.me/${d}?text=${encodeURIComponent(mainText(a.body))}` : '';
}
api.post('/approvals/:id/decide', async (req, res) => {
  const a = store.getApproval(req.params.id);
  if (!a) return res.status(404).json({ error: 'No such approval' });
  const { decision, subject, body, to, note } = req.body;
  if (subject !== undefined) a.subject = subject;
  if (body !== undefined) a.body = body;
  if (to !== undefined) a.to = to;
  if (decision === 'reject') {
    store.decide(a.id, 'rejected', { decision_note: note || '' });
    store.log(`Rejected: ${a.title}`, { kind: 'error' });
    return res.json(store.getApproval(a.id));
  }
  if (decision !== 'approve') { store.save(); return res.json(a); }
  if (a.type === 'whatsapp') {
    const st = stats();
    if (st.sentToday >= config.data.outreach.daily_send_cap) return res.status(400).json({ error: `Daily limit (${config.data.outreach.daily_send_cap}) reached. Send more tomorrow or raise it in Settings.` });
    store.decide(a.id, 'approved', { decision_note: note || '', wa_link: waLink(a) });
    store.log(`Approved: ${a.title}`, { kind: 'done' });
    return res.json(store.getApproval(a.id));
  }
  if (a.type === 'email') {
    const st = stats();
    if (st.sentToday >= config.data.outreach.daily_send_cap) return res.status(400).json({ error: `Daily send cap (${config.data.outreach.daily_send_cap}) reached, to protect your domain. Send more tomorrow or raise it in Settings.` });
    if (config.data.outreach.sender === 'smtp' && config.data.smtp.user && config.data.smtp.pass) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.to)) return res.status(400).json({ error: 'The "to" field is not an email address. Fix it or send manually.' });
      try { await sendEmail(a); markSent(a); return res.json(store.getApproval(a.id)); }
      catch (e) { return res.status(500).json({ error: `Sending failed: ${e.message}` }); }
    }
    store.decide(a.id, 'approved', { decision_note: note || '' });
    store.log(`Approved: ${a.title} (send it from your mailbox, then mark as sent)`, { kind: 'done' });
    return res.json(store.getApproval(a.id));
  }
  store.decide(a.id, 'approved', { decision_note: note || '' });
  res.json(store.getApproval(a.id));
});
api.post('/approvals/:id/sent', (req, res) => {
  const a = store.getApproval(req.params.id);
  if (!a) return res.status(404).json({ error: 'No such approval' });
  markSent(a);
  res.json(store.getApproval(a.id));
});

api.post('/sites/:slug/publish', async (req, res) => {
  const site = store.data.sites.find((s) => s.slug === req.params.slug);
  if (!site) return res.status(404).json({ error: 'No such demo' });
  try {
    store.log(`Publishing ${site.business}…`, { kind: 'queue' });
    const url = await publisher.publish(site.slug);
    const s = store.upsertSite({ slug: site.slug, public_url: url, published_at: new Date().toISOString() });
    store.log(`Published ${site.business}: ${url} (GitHub Pages can take a minute to go live)`, { kind: 'done' });
    res.json(s);
  } catch (e) {
    store.log(`Publish failed for ${site.business}: ${e.message}`, { kind: 'error' });
    res.status(500).json({ error: e.message });
  }
});

// One click for the owner: the demo is good, so put it online and let the Writer draft the first message.
api.post('/leads/:id/approve-demo', async (req, res) => {
  const lead = store.getLead(req.params.id);
  if (!lead || !siteOf(lead)) return res.status(404).json({ error: 'This business has no demo yet.' });
  try { res.json({ ok: true, site: await publishDemo(lead) }); }
  catch (e) {
    store.log(`Could not put the demo online: ${e.message}`, { kind: 'error' });
    res.status(500).json({ error: e.message });
  }
});
api.post('/leads/:id/build', (req, res) => {
  try { res.json(runner.enqueue('builder', { lead_id: req.params.id })); } catch (e) { res.status(400).json({ error: e.message }); }
});

api.get('/settings', (req, res) => res.json(config.public()));
api.put('/settings', (req, res) => {
  const patch = req.body || {};
  if (patch.smtp && patch.smtp.pass === '••••••••') delete patch.smtp.pass;
  if (patch.connections?.telegram?.token === '••••••••') delete patch.connections.telegram.token;
  const out = config.update(patch);
  syncMode();
  if (config.data.connections.phone.public_link) tunnel.start(); else tunnel.stop();
  runner.pushState();
  runner.tick();
  res.json(out);
});
api.post('/password', (req, res) => {
  if (!config.checkPassword(req.body.current)) return res.status(400).json({ error: 'Current password is wrong.' });
  if (String(req.body.next || '').length < 8) return res.status(400).json({ error: 'Use at least 8 characters.' });
  config.setPassword(req.body.next);
  res.json({ ok: true });
});
app.use('/api', api);

// Owner-only demo previews.
app.use('/d', (req, res, next) => (authed(req) ? next() : res.status(401).send('Sign in to Agency HQ to preview demos.')), express.static(runner.sitesDir, { extensions: ['html'] }));

// ---- agent API (hq MCP server -> here) --------------------------------------
const agent = express.Router();
agent.use((req, res, next) => {
  const t = req.get('x-hq-token') || '';
  const want = config.data.mcp_token;
  if (t.length !== want.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(want))) return res.status(401).json({ error: 'bad token' });
  req.runId = req.get('x-hq-run') || null;
  next();
});
agent.post('/note', (req, res) => {
  const run = req.runId && store.getRun(req.runId);
  store.log(`${run ? run.title.split(' · ')[0] : 'Agent'}: ${String(req.body.text || '').slice(0, 300)}`, { run_id: req.runId, kind: 'note' });
  res.json({ ok: true });
});
agent.get('/leads', (req, res) => {
  const list = store.data.leads.filter((l) => !req.query.stage || l.stage === req.query.stage);
  res.json(list.map((l) => ({ id: l.id, business: l.business, city: l.city, niche: l.niche, website: l.website, stage: l.stage, score: l.score })));
});
agent.get('/leads/:id', (req, res) => { const l = store.getLead(req.params.id); l ? res.json(l) : res.status(404).json({ error: 'No such lead' }); });
agent.post('/leads', (req, res) => {
  const b = req.body || {};
  if (!b.business) return res.status(400).json({ error: 'business is required' });
  if (!b.website && !b.phone && !b.whatsapp && !b.email && !b.maps_url && !Object.values(b.socials || {}).some(Boolean)) return res.status(400).json({ error: 'Add at least one public way to find or reach the business (website, social page, map listing, phone, WhatsApp or email).' });
  const run = req.runId && store.getRun(req.runId);
  const hunt = store.getHunt(b.hunt_id || run?.hunt_id);
  const { lead, duplicate } = store.addLead({ ...b, hunt_id: hunt?.id || null, market_id: hunt?.market_id || config.data.market_id });
  if (!duplicate) { lead.found_by_run = req.runId; store.save(); store.log(`Found ${lead.business}${lead.area ? `, ${lead.area}` : ''} (${lead.city})`, { run_id: req.runId, kind: 'lead' }); }
  res.json({ id: lead.id, duplicate, message: duplicate ? 'Already in the pipeline, skipped.' : 'Added.' });
});
agent.patch('/leads/:id', (req, res) => {
  const { note, ...patch } = req.body;
  const l = store.updateLead(req.params.id, patch, note || 'Updated by agent');
  l ? res.json({ ok: true, stage: l.stage }) : res.status(404).json({ error: 'No such lead' });
});
const leadOr404 = (req, res) => { const l = store.getLead(req.params.id); if (!l) res.status(404).json({ error: 'No such lead' }); return l; };
agent.post('/leads/:id/profile', (req, res) => {
  const l = leadOr404(req, res); if (!l) return;
  const p = { ...req.body, at: new Date().toISOString() };
  const patch = { profile: p };
  if (p.contact?.phone && !l.phone) patch.phone = p.contact.phone;
  if (p.contact?.whatsapp) patch.whatsapp = p.contact.whatsapp;
  if (p.contact?.email && !l.email) patch.email = p.contact.email;
  if (p.decision_maker) patch.owner_name = p.decision_maker;
  if (l.stage === 'new') patch.stage = p.verdict === 'pass' ? 'profiled' : 'skipped';
  if (p.verdict === 'fail') patch.reason = (p.red_flags || []).join('; ') || 'Could not confirm it is real, active and reachable';
  store.updateLead(l.id, patch, p.verdict === 'pass' ? `Profile done${p.rating ? ` (${p.rating}${p.review_count ? ` from ${p.review_count} reviews` : ''})` : ''}` : `Not verified: ${patch.reason}`);
  store.log(`${l.business}: ${p.verdict === 'pass' ? 'profile ready' : 'could not be verified, skipped'}`, { run_id: req.runId, kind: p.verdict === 'pass' ? 'done' : 'error' });
  res.json({ ok: true });
});
agent.post('/leads/:id/opportunity', (req, res) => {
  const l = leadOr404(req, res); if (!l) return;
  const q = config.data.qualify;
  const o = { ...req.body, score: Math.round(Number(req.body.score) || 0), at: new Date().toISOString() };
  // the thresholds decide, not the model's mood
  o.decision = o.score >= q.threshold ? 'build' : o.score >= q.hold ? 'hold' : 'skip';
  const stage = { build: 'qualified', hold: 'hold', skip: 'skipped' }[o.decision];
  store.updateLead(l.id, { opportunity: o, stage: ['new', 'profiled', 'hold', 'qualified'].includes(l.stage) ? stage : l.stage, ...(o.decision === 'skip' ? { reason: `Score ${o.score}/100: not worth a demo` } : {}) }, `Opportunity ${o.score}/100 (${o.decision})`);
  store.log(`${l.business}: ${o.score}/100, ${{ build: 'worth building', hold: 'kept for later', skip: 'skipped' }[o.decision]}`, { run_id: req.runId, kind: o.decision === 'build' ? 'lead' : 'note' });
  res.json({ ok: true, decision: o.decision });
});
agent.post('/leads/:id/plan', (req, res) => {
  const l = leadOr404(req, res); if (!l) return;
  store.updateLead(l.id, { plan: { ...req.body, at: new Date().toISOString() }, ...(l.stage === 'qualified' ? { stage: 'planned' } : {}) }, `Plan: ${req.body.product}`);
  store.log(`${l.business}: plan ready (${req.body.product})`, { run_id: req.runId, kind: 'done' });
  res.json({ ok: true });
});
agent.post('/leads/:id/review', (req, res) => {
  const l = leadOr404(req, res); if (!l) return;
  const r = { ...req.body, at: new Date().toISOString() };
  const stage = { approve: 'approved', hold: 'hold', reject: 'skipped' }[r.verdict];
  store.updateLead(l.id, { review: r, stage: ['planned', 'qualified'].includes(l.stage) ? stage : l.stage, ...(r.verdict === 'reject' ? { reason: r.summary } : {}) }, `Reviewer: ${r.verdict}`);
  store.log(`${l.business}: ${{ approve: 'approved for a demo', hold: 'on hold', reject: 'rejected by the Reviewer' }[r.verdict]}`, { run_id: req.runId, kind: r.verdict === 'approve' ? 'done' : 'note' });
  res.json({ ok: true });
});
agent.post('/sites', (req, res) => {
  const lead = store.getLead(req.body.lead_id);
  if (!lead) return res.status(404).json({ error: 'No such lead' });
  const { slug, dir } = runner.siteFor(lead);
  if (!fs.existsSync(path.join(dir, 'index.html'))) return res.status(400).json({ error: `No index.html found in ${dir}. Write the site first.` });
  const site = store.upsertSite({ slug, lead_id: lead.id, business: lead.business, city: lead.city, summary: String(req.body.summary || ''), local_url: `/d/${slug}/` });
  store.updateLead(lead.id, { stage: ['sent', 'replied', 'won', 'email_drafted'].includes(lead.stage) ? lead.stage : 'demo_built', demo: { slug } }, 'Demo built');
  store.log(`Demo ready: ${lead.business}`, { run_id: req.runId, kind: 'done' });
  res.json({ ok: true, slug, preview: site.local_url, note: 'The owner will review and publish it.' });
  setTimeout(() => reviewDemo(lead.id).catch(() => {}), 1000);
});
agent.post('/approvals', (req, res) => {
  const a = store.addApproval({ ...req.body, run_id: req.runId });
  if (['email', 'whatsapp'].includes(a.type) && a.lead_id) {
    const l = store.getLead(a.lead_id);
    if (l && ['new', 'qualified', 'approved', 'demo_built'].includes(l.stage)) store.updateLead(l.id, { stage: 'email_drafted' }, 'Message written, waiting for you');
  }
  store.log(`Needs your approval: ${a.title}`, { run_id: req.runId, kind: 'approval' });
  res.json({ ok: true, id: a.id, message: 'Queued for the owner. Do not try to send it yourself.' });
  if (['email', 'whatsapp'].includes(a.type)) { if (!asleep()) telegram.notify(`✉️ A message to ${store.getLead(a.lead_id)?.business || a.to} is waiting for your approval.`); setTimeout(() => reviewMessage(a.id).catch(() => {}), 500); }
});
agent.get('/settings', (req, res) => { const run = req.runId && store.getRun(req.runId); const v = config.view(run && runner.marketOf(run)); res.json({ company: v.company, market: v.market, offer: v.offer }); });
app.use('/agent-api', agent);

// ---- static app -------------------------------------------------------------
app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html', maxAge: 0 }));
app.get(/^\/(?!api|agent-api|d\/).*/, (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

server.on('upgrade', (req, socket, head) => {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x.length === 2));
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/ws' || !authed({ cookies, headers: req.headers, query: { k: u.searchParams.get('t') || '' } })) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'runner', state: runner.state() }));
    ws.on('close', () => clients.delete(ws));
  });
});

setInterval(() => broadcast({ type: 'stats', stats: stats() }), 15000);
process.on('SIGINT', () => { store.flush(); process.exit(0); });

if (asleep() && (!meta().night || meta().night.end)) { meta().night = { start: new Date().toISOString(), end: null, next_search: 0 }; store.save(); }
if (config.data.connections.phone.public_link && !process.env.HQ_NO_TUNNEL) tunnel.start();
process.on('exit', () => tunnel.stop());

server.listen(PORT, HOST, () => {
  console.log(`Agency HQ running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (!config.data.auth.hash) console.log('First visit: you will be asked to create a password.');
});
