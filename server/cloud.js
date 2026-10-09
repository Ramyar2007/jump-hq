// Jump HQ Cloud: the hosted version. One public address, many customers.
// Each customer signs up, picks a plan and gets their own private Jump HQ (own data, own team),
// started on demand behind this gateway. The agents run on the platform's Anthropic API key,
// so customers need no Claude account; the plan decides how much work their team may do per day.
//
//   PORT, ANTHROPIC_API_KEY, GITHUB_TOKEN (demo publishing), CLOUD_ADMIN_KEY, CLOUD_DATA
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Config } from './config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const DATA = path.resolve(process.env.CLOUD_DATA || path.join(ROOT, 'cloud-data'));
const ADMIN_KEY = process.env.CLOUD_ADMIN_KEY || '';
const IDLE_MS = 30 * 60e3;
const BASE_PORT = 6100;

// What each plan may do. jobs = agent jobs per day (one search of 10 shops with 2 demos is about 5 jobs).
export const PLANS = {
  trial: { name: 'Free trial', price: 0, jobs: 6, days: 7 },
  starter: { name: 'Starter', price: 15, jobs: 20 },
  pro: { name: 'Pro', price: 40, jobs: 60 },
};

fs.mkdirSync(path.join(DATA, 'tenants'), { recursive: true });
const ACC_FILE = path.join(DATA, 'accounts.json');
const db = fs.existsSync(ACC_FILE) ? JSON.parse(fs.readFileSync(ACC_FILE, 'utf8')) : { accounts: [], sessions: {} };
const save = () => fs.writeFileSync(ACC_FILE, JSON.stringify(db, null, 2));

const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(String(pw), salt, 64).toString('hex') });
const pwOk = (a, pw) => {
  const got = crypto.scryptSync(String(pw), a.salt, 64);
  const want = Buffer.from(a.hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
};
const tenantDir = (a) => path.join(DATA, 'tenants', a.id);
const planOf = (a) => PLANS[a.plan] || PLANS.trial;
const trialOver = (a) => a.plan === 'trial' && Date.now() > new Date(a.created).getTime() + PLANS.trial.days * 864e5;

// ---- customer Jump HQs -----------------------------------------------------
const procs = new Map(); // account id -> { child, port, ready, last }

function startTenant(a) {
  const cur = procs.get(a.id);
  if (cur) { cur.last = Date.now(); return cur.ready; }
  const used = new Set([...procs.values()].map((p) => p.port));
  let port = BASE_PORT;
  while (used.has(port)) port += 1;
  const dir = tenantDir(a);
  const env = {
    ...process.env,
    HQ_DATA: dir, HQ_SITES: path.join(dir, 'sites'), HQ_PORT: String(port), HQ_HOST: '127.0.0.1', HQ_NO_TUNNEL: '1',
    HQ_LOCK_LIMITS: '1', HQ_MAX_DAILY_RUNS: String(planOf(a).jobs), HQ_CLOUD: '1',
  };
  delete env.PORT; delete env.CLOUD_ADMIN_KEY;
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const log = fs.createWriteStream(path.join(dir, 'server.log'), { flags: 'a' });
  child.stdout.pipe(log); child.stderr.pipe(log);
  const entry = { child, port, last: Date.now() };
  entry.ready = new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = () => {
      const r = http.get({ host: '127.0.0.1', port, path: '/api/ping', timeout: 1500 }, (res) => { res.resume(); resolve(port); });
      r.on('error', () => (Date.now() - t0 > 20000 ? reject(new Error('Your Jump HQ did not start. Try again in a minute.')) : setTimeout(poll, 300)));
      r.on('timeout', () => r.destroy());
    };
    poll();
  });
  child.on('exit', () => procs.delete(a.id));
  procs.set(a.id, entry);
  return entry.ready;
}

// Sleep customers nobody is using (their agents finish first).
setInterval(() => {
  for (const [id, p] of procs) {
    if (Date.now() - p.last < IDLE_MS) continue;
    const runs = readDb(db.accounts.find((a) => a.id === id))?.runs || [];
    if (runs.some((r) => ['queued', 'running'].includes(r.status))) continue;
    p.child.kill();
    procs.delete(id);
  }
}, 60e3).unref();

function readDb(a) {
  try { return JSON.parse(fs.readFileSync(path.join(tenantDir(a), 'db.json'), 'utf8')); } catch { return null; }
}

function createTenant(a, pw, company) {
  const dir = tenantDir(a);
  fs.mkdirSync(dir, { recursive: true });
  const cfg = new Config(path.join(dir, 'config.json'));
  cfg.update({
    company: { name: company || a.name, sender_name: a.name, website: '' },
    limits: { daily_runs: planOf(a).jobs },
    connections: { phone: { public_link: false } },
  });
  cfg.setPassword(pw);
}

// Sign the browser into the customer's own Jump HQ with the same password.
async function tenantLogin(a, pw) {
  const port = await startTenant(a);
  const res = await fetch(`http://127.0.0.1:${port}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) });
  if (!res.ok) throw new Error('Could not open your Jump HQ.');
  const m = /hq=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return m ? m[1] : '';
}

// ---- http helpers ----------------------------------------------------------
const cookiesOf = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x.length === 2));
const secure = (req) => (req.headers['x-forwarded-proto'] || '').includes('https');
const cookie = (req, name, val, days) => `${name}=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.round(days * 86400)}${secure(req) ? '; Secure' : ''}`;
const json = (res, code, body, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve) => { let s = ''; req.on('data', (d) => { s += d; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } }); });
const accountOf = (req) => {
  const s = db.sessions[cookiesOf(req).gw];
  if (!s || s.exp < Date.now()) return null;
  return db.accounts.find((a) => a.id === s.account) || null;
};
const attempts = new Map();
const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
function slowDown(req) {
  const k = ipOf(req), a = attempts.get(k) || { n: 0, until: 0 };
  if (a.until > Date.now()) return true;
  a.n += 1; if (a.n > 8) { a.until = Date.now() + 60e3; a.n = 0; }
  attempts.set(k, a);
  return false;
}

function usage(a) {
  const d = readDb(a);
  const runs = d?.runs || [];
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const m = runs.filter((r) => (r.created || '').startsWith(month));
  return {
    jobs_today: runs.filter((r) => (r.created || '').startsWith(today)).length,
    jobs_month: m.length,
    cost_month_usd: +m.reduce((s, r) => s + (r.cost_usd || 0), 0).toFixed(2),
    demos: (d?.sites || []).length,
    leads: (d?.leads || []).length,
  };
}

// ---- cloud API ---------------------------------------------------------------
async function cloudApi(req, res, url) {
  const route = url.pathname.replace(/^\/cloud\/?/, '');
  if (route === 'plans') return json(res, 200, PLANS);

  if (req.method === 'POST' && route === 'signup') {
    if (slowDown(req)) return json(res, 429, { error: 'Too many tries. Wait a minute.' });
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Enter a real email address.' });
    if (String(b.password || '').length < 8) return json(res, 400, { error: 'Use at least 8 characters for the password.' });
    if (db.accounts.some((a) => a.email === email)) return json(res, 400, { error: 'This email already has an account. Sign in instead.' });
    const plan = PLANS[b.plan] ? b.plan : 'trial';
    const a = { id: crypto.randomBytes(6).toString('hex'), email, name: String(b.name || '').slice(0, 80) || email.split('@')[0], plan, paid: plan === 'trial', created: new Date().toISOString(), ...hashPw(b.password) };
    db.accounts.push(a); save();
    createTenant(a, b.password, String(b.company || '').slice(0, 80));
    return signIn(req, res, a, b.password);
  }
  if (req.method === 'POST' && route === 'login') {
    if (slowDown(req)) return json(res, 429, { error: 'Too many tries. Wait a minute.' });
    const b = await readBody(req);
    const a = db.accounts.find((x) => x.email === String(b.email || '').trim().toLowerCase());
    if (!a || !pwOk(a, b.password)) return json(res, 401, { error: 'Wrong email or password.' });
    return signIn(req, res, a, b.password);
  }
  if (req.method === 'POST' && route === 'logout') {
    delete db.sessions[cookiesOf(req).gw]; save();
    return json(res, 200, { ok: true }, { 'set-cookie': [cookie(req, 'gw', '', 0), cookie(req, 'hq', '', 0)] });
  }
  if (route === 'me') {
    const a = accountOf(req);
    if (!a) return json(res, 401, { error: 'Not signed in' });
    return json(res, 200, { email: a.email, name: a.name, plan: a.plan, plan_info: planOf(a), paid: a.paid, trial_over: trialOver(a), usage: usage(a) });
  }
  if (req.method === 'POST' && route === 'plan') {
    const a = accountOf(req);
    if (!a) return json(res, 401, { error: 'Not signed in' });
    const b = await readBody(req);
    if (!PLANS[b.plan] || b.plan === 'trial') return json(res, 400, { error: 'Pick Starter or Pro.' });
    a.plan = b.plan; a.paid = false; a.plan_requested = new Date().toISOString(); save();
    const p = procs.get(a.id); if (p) { p.child.kill(); procs.delete(a.id); }
    return json(res, 200, { ok: true, message: `You are on ${PLANS[b.plan].name}. We will send the payment details (FIB, card or bank) to ${a.email}.` });
  }
  // The owner's view: every customer, their plan, what their team did and what it cost.
  if (route === 'admin') {
    if (!ADMIN_KEY || url.searchParams.get('key') !== ADMIN_KEY) return json(res, 404, { error: 'Not found' });
    const rows = db.accounts.map((a) => ({ email: a.email, name: a.name, plan: a.plan, paid: a.paid, created: a.created.slice(0, 10), running: procs.has(a.id), ...usage(a), price_usd: planOf(a).price }));
    const mrr = rows.filter((r) => r.paid && r.price_usd).reduce((s, r) => s + r.price_usd, 0);
    const cost = +rows.reduce((s, r) => s + r.cost_month_usd, 0).toFixed(2);
    return json(res, 200, { customers: rows.length, paying: rows.filter((r) => r.paid && r.price_usd).length, mrr_usd: mrr, ai_cost_month_usd: cost, profit_month_usd: +(mrr - cost).toFixed(2), accounts: rows });
  }
  if (req.method === 'POST' && route === 'admin/paid') {
    if (!ADMIN_KEY || url.searchParams.get('key') !== ADMIN_KEY) return json(res, 404, { error: 'Not found' });
    const b = await readBody(req);
    const a = db.accounts.find((x) => x.email === String(b.email || '').toLowerCase());
    if (!a) return json(res, 404, { error: 'No such account' });
    a.paid = b.paid !== false; save();
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Not found' });
}

async function signIn(req, res, a, pw) {
  try {
    const hq = await tenantLogin(a, pw);
    const t = crypto.randomBytes(32).toString('hex');
    db.sessions[t] = { account: a.id, exp: Date.now() + 30 * 864e5 };
    for (const [k, v] of Object.entries(db.sessions)) if (v.exp < Date.now()) delete db.sessions[k];
    save();
    json(res, 200, { ok: true }, { 'set-cookie': [cookie(req, 'gw', t, 30), cookie(req, 'hq', hq, 14)] });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

// ---- proxy to the customer's own Jump HQ -------------------------------------
const HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'cf-ray', 'cf-connecting-ip', 'cf-ipcountry', 'cf-visitor'];
function cleanHeaders(h, port) {
  const out = { ...h, host: `127.0.0.1:${port}` };
  for (const k of HOP) delete out[k];
  return out;
}

async function proxy(req, res, a) {
  let port;
  try { port = await startTenant(a); } catch (e) { res.writeHead(503, { 'content-type': 'text/plain' }); return res.end(e.message); }
  const up = http.request({ host: '127.0.0.1', port, method: req.method, path: req.url, headers: cleanHeaders(req.headers, port) }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Your Jump HQ is restarting. Refresh in a few seconds.'); });
  req.pipe(up);
}

const PUBLIC = path.join(ROOT, 'public');
const LANDING = path.join(PUBLIC, 'cloud.html');
const STATIC = { '/cloud.css': 'text/css', '/cloud.js': 'text/javascript', '/promo.mp4': 'video/mp4', '/promo.jpg': 'image/jpeg' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('x-content-type-options', 'nosniff');
  if (url.pathname === '/healthz') return json(res, 200, { ok: true });
  if (url.pathname.startsWith('/cloud/')) return cloudApi(req, res, url).catch((e) => json(res, 500, { error: e.message }));
  if (STATIC[url.pathname]) { res.writeHead(200, { 'content-type': STATIC[url.pathname] }); return fs.createReadStream(path.join(PUBLIC, url.pathname)).pipe(res); }
  const a = accountOf(req);
  // trial finished and no plan yet: only the account page (pick a plan) is open
  if (a && trialOver(a)) {
    if (url.pathname.startsWith('/api/')) return json(res, 402, { error: 'Your free week is over. Pick a plan to keep your team working.' });
    if (url.pathname !== '/') { res.writeHead(302, { location: '/' }); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return fs.createReadStream(LANDING).pipe(res);
  }
  if (a) {
    if (url.pathname === '/welcome') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return fs.createReadStream(LANDING).pipe(res); }
    return proxy(req, res, a);
  }
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/welcome') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return fs.createReadStream(LANDING).pipe(res);
  }
  if (url.pathname.startsWith('/api/')) return json(res, 401, { error: 'Not signed in' });
  res.writeHead(302, { location: '/' }); res.end();
});

// live updates (WebSocket) go straight through to the customer's Jump HQ
server.on('upgrade', async (req, socket, head) => {
  const a = accountOf(req);
  if (!a) return socket.destroy();
  let port;
  try { port = await startTenant(a); } catch { return socket.destroy(); }
  const up = net.connect(port, '127.0.0.1', () => {
    const h = { ...req.headers, host: `127.0.0.1:${port}` };
    for (const k of ['cf-ray', 'cf-connecting-ip', 'cf-ipcountry', 'cf-visitor']) delete h[k];
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket); socket.pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(PORT, '0.0.0.0', () => console.log(`Jump HQ Cloud on :${PORT} (${db.accounts.length} customers)${process.env.ANTHROPIC_API_KEY ? '' : ' WARNING: no ANTHROPIC_API_KEY set'}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { for (const p of procs.values()) p.child.kill(); process.exit(0); });
