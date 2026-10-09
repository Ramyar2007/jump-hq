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

// ---- sessions -------------------------------------------------------------
const SESS_FILE = path.join(DATA, 'sessions.json');
const sessions = new Map(fs.existsSync(SESS_FILE) ? Object.entries(JSON.parse(fs.readFileSync(SESS_FILE, 'utf8'))) : []);
const saveSessions = () => fs.writeFileSync(SESS_FILE, JSON.stringify(Object.fromEntries(sessions)));
const SESSION_DAYS = 14;
function newSession(res) {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + SESSION_DAYS * 864e5);
  saveSessions();
  res.cookie('hq', t, { httpOnly: true, sameSite: 'strict', maxAge: SESSION_DAYS * 864e5 });
}
function authed(req) {
  const t = req.cookies?.hq;
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); saveSessions(); return false; }
  return true;
}
const loginAttempts = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => { res.set({ 'x-frame-options': 'SAMEORIGIN', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' }); next(); });

// ---- auth -----------------------------------------------------------------
app.get('/api/session', (req, res) => res.json({ authed: authed(req), needsSetup: !config.data.auth.hash }));
app.post('/api/setup', (req, res) => {
  if (config.data.auth.hash) return res.status(400).json({ error: 'Already set up' });
  const pw = String(req.body.password || '');
  if (pw.length < 8) return res.status(400).json({ error: 'Use at least 8 characters.' });
  config.setPassword(pw);
  newSession(res);
  res.json({ ok: true });
});
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const a = loginAttempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return res.status(429).json({ error: 'Too many attempts. Wait a minute.' });
  if (!config.checkPassword(req.body.password)) {
    a.n += 1; if (a.n >= 5) { a.until = Date.now() + 60e3; a.n = 0; }
    loginAttempts.set(ip, a);
    return res.status(401).json({ error: 'Wrong password.' });
  }
  loginAttempts.delete(ip);
  newSession(res);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { sessions.delete(req.cookies?.hq); saveSessions(); res.clearCookie('hq'); res.json({ ok: true }); });

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

api.get('/bootstrap', (req, res) => {
  res.json({
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
  const site = lead && siteOf(lead);
  if (!site) return res.status(404).json({ error: 'This business has no demo yet.' });
  try {
    if (!site.public_url) {
      store.log(`Putting ${lead.business}'s demo online…`, { kind: 'queue' });
      const url = await publisher.publish(site.slug);
      store.upsertSite({ slug: site.slug, public_url: url, published_at: new Date().toISOString() });
      store.log(`${lead.business}'s demo is online: ${url}`, { kind: 'done' });
    }
    const hasDraft = store.data.approvals.some((a) => a.lead_id === lead.id && ['email', 'whatsapp'].includes(a.type) && ['pending', 'approved'].includes(a.status));
    const writing = store.data.runs.some((r) => r.lead_id === lead.id && r.agent === 'writer' && ['queued', 'running'].includes(r.status));
    if (!hasDraft && !writing && !['sent', 'replied', 'won'].includes(lead.stage)) runner.enqueue('writer', { lead_id: lead.id });
    res.json({ ok: true, site: siteOf(lead) });
  } catch (e) {
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
  const out = config.update(patch);
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
});
agent.post('/approvals', (req, res) => {
  const a = store.addApproval({ ...req.body, run_id: req.runId });
  if (['email', 'whatsapp'].includes(a.type) && a.lead_id) {
    const l = store.getLead(a.lead_id);
    if (l && ['new', 'qualified', 'approved', 'demo_built'].includes(l.stage)) store.updateLead(l.id, { stage: 'email_drafted' }, 'Message written, waiting for you');
  }
  store.log(`Needs your approval: ${a.title}`, { run_id: req.runId, kind: 'approval' });
  res.json({ ok: true, id: a.id, message: 'Queued for the owner. Do not try to send it yourself.' });
});
agent.get('/settings', (req, res) => { const run = req.runId && store.getRun(req.runId); const v = config.view(run && runner.marketOf(run)); res.json({ company: v.company, market: v.market, offer: v.offer }); });
app.use('/agent-api', agent);

// ---- static app -------------------------------------------------------------
app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html', maxAge: 0 }));
app.get(/^\/(?!api|agent-api|d\/).*/, (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

server.on('upgrade', (req, socket, head) => {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x.length === 2));
  if (req.url !== '/ws' || !authed({ cookies })) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'runner', state: runner.state() }));
    ws.on('close', () => clients.delete(ws));
  });
});

setInterval(() => broadcast({ type: 'stats', stats: stats() }), 15000);
process.on('SIGINT', () => { store.flush(); process.exit(0); });

server.listen(PORT, HOST, () => {
  console.log(`Agency HQ running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (!config.data.auth.hash) console.log('First visit: you will be asked to create a password.');
});
