// Jump HQ: find local businesses that need a website, prove it with a free demo, win them as clients.
// No framework: one state object, hash routes, re-render on change. Live updates over a WebSocket.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = document.getElementById('root');
import { t, setLang, LANGS } from './i18n.js';

const S = { mode: 'awake', night: null, link: '', conns: null, setTab: 'general', config: null, agents: [], leads: [], approvals: [], runs: [], sites: [], activity: [], hunts: [], runner: null, stats: null, events: {}, lead: null, msgTab: 'pending', filter: 'all', q: '', market: null, ws: null };

/* ------------------------------------------------------------------ icons */
const IC = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  build: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  reply: '<path d="m9 17-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-1.8-5.6-4.5-6.6"/>',
  team: '<circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="6" r="2"/><circle cx="19.5" cy="6" r="2"/><circle cx="4.5" cy="18" r="2"/><circle cx="19.5" cy="18" r="2"/><path d="M6.3 7l3.2 3M17.7 7l-3.2 3M6.3 17l3.2-3M17.7 17l-3.2-3"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const ic = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;

/* --------------------------------------------------------------- helpers */
async function req(method, url, body) {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !/\/api\/(login|setup)/.test(url)) { boot(); throw new Error('Please sign in again.'); }
  if (!r.ok) throw new Error(data.error || `Something went wrong (${r.status})`);
  return data;
}
function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 7000 : 3500);
}
async function act(btn, fn, done, after) {
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = t('Working…'); }
  try { const r = await fn(); if (done) toast(done); await refresh(); after?.(r); return r; }
  catch (e) { toast(e.message, 'err'); }
  finally { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = label; } }
}
const ago = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 50) return t('just now');
  if (s < 3600) return `${Math.round(s / 60)} ${t('min ago')}`;
  if (s < 86400) return `${Math.round(s / 3600)} ${t('h ago')}`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
};
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u || ''; } };
const market = (id) => S.config?.markets?.[id] || S.config?.markets?.[S.config?.market_id] || {};
const money = (n, mid) => { const m = market(mid); const v = Number(n || 0).toLocaleString('en-US'); return m.currency === 'GBP' ? `£${v}` : m.currency === 'USD' ? `$${v}` : `${v} ${m.currency || ''}`; };
const isRtl = (s) => /[؀-ۿ]/.test(s || '') && ((s || '').match(/[؀-ۿ]/g) || []).length > ((s || '').match(/[A-Za-z]/g) || []).length;
const siteOf = (l) => S.sites.find((x) => x.lead_id === l.id || (l.demo?.slug && x.slug === l.demo.slug));
const AGENT_VERB = { scout: 'is searching for businesses', investigator: 'is checking businesses and building profiles', opportunity: 'is deciding which ones are worth it', strategist: 'is planning what each business needs', reviewer: 'is double-checking before we build', builder: 'is building a demo website', writer: 'is writing the first message', closer: 'is answering a reply' };
const agentName = (k) => S.agents.find((a) => a.key === k)?.name || k;
const workingOn = (l) => S.runs.find((r) => ['running', 'queued'].includes(r.status) && (r.lead_id === l.id || (r.input?.lead_ids || []).includes(l.id)));

// Plain-language status + the next thing to do, for one business.
function statusOf(l) {
  const w = workingOn(l);
  if (w) return { text: w.status === 'running' ? `${agentName(w.agent)} ${t('working…')}` : `${t('Waiting for')} ${agentName(w.agent)}`, tone: 'info' };
  const site = siteOf(l);
  return ({
    new: { text: t('Found'), tone: '' },
    profiled: { text: t('Checked'), tone: '' },
    qualified: { text: t('Worth building'), tone: 'accent' },
    planned: { text: t('Plan ready'), tone: 'accent' },
    approved: { text: t('Ready to build'), tone: 'accent' },
    hold: { text: t('On hold'), tone: 'warn' },
    skipped: { text: t('Not a fit'), tone: '' },
    demo_built: { text: site?.public_url ? t('Demo online') : t('Demo ready for you'), tone: 'good' },
    email_drafted: { text: t('Message waiting for you'), tone: 'good' },
    sent: { text: t('Contacted'), tone: 'info' },
    replied: { text: t('Talking'), tone: 'info' },
    won: { text: t('Client'), tone: 'good' },
    lost: { text: t('Said no'), tone: 'bad' },
  })[l.stage] || { text: l.stage, tone: '' };
}
function nextStep(l) {
  if (workingOn(l)) return null;
  const site = siteOf(l);
  if (l.stage === 'demo_built' && site && !site.public_url) return { label: t('Review demo'), icon: 'eye', run: () => openPreview(site, l) };
  if (['approved', 'hold'].includes(l.stage) && !site) return { label: t('Build demo'), icon: 'build', run: (b) => act(b, () => req('POST', `/api/leads/${l.id}/build`), `Building a demo for ${l.business}.`) };
  if (l.stage === 'email_drafted') return { label: t('Open message'), icon: 'msg', run: () => { S.msgTab = 'pending'; go('messages'); } };
  if (l.stage === 'sent') return { label: t('They replied'), icon: 'reply', run: () => openReply(l) };
  return null;
}
const AV = ['#e4572e', '#2a9d8f', '#1d4ed8', '#0f8a5f', '#c2410c', '#0e7490', '#b45309', '#334155', '#be123c', '#4d7c0f'];
const avatar = (l) => { const n = l.business || '?'; let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `<span class="av" style="background:${AV[h % AV.length]}">${esc(n.replace(/^(the|al|el)\s+/i, '').trim()[0]?.toUpperCase() || '?')}</span>`; };
const ring = (l) => {
  const o = l.opportunity;
  if (!o) return `<span class="ring none" title="${t('Not scored yet')}"><b>–</b></span>`;
  const q = S.config.qualify;
  return `<span class="ring ${o.score >= q.threshold ? '' : o.score >= q.hold ? 'hold' : 'skip'}" style="--p:${o.score}" title="Opportunity score ${o.score}/100"><b>${o.score}</b></span>`;
};
const scoreBadge = (l) => {
  const o = l.opportunity;
  if (!o) return '<span class="muted small">—</span>';
  const q = S.config.qualify;
  const tone = o.score >= q.threshold ? 'good' : o.score >= q.hold ? 'warn' : '';
  return `<span class="badge ${tone}"><span class="score">${o.score}<small>/100</small></span></span>`;
};

/* -------------------------------------------------------------- boot/auth */
async function boot() {
  const s = await fetch('/api/session').then((r) => r.json()).catch(() => ({}));
  setLang(s.lang || 'en');
  if (!s.authed) return renderAuth(s.needsSetup);
  await refresh(true);
  connect();
  addEventListener('hashchange', render);
  render();
}

function renderAuth(setup) {
  root.innerHTML = `<div class="auth"><div class="auth-side"><div class="logo"><i>J</i>Jump</div>
      <div><h2>${t('Find local businesses that need a website, and win them as clients.')}</h2><p>${t('An AI team searches, checks and scores businesses, builds free demo websites for the best ones, and writes the first message. You approve everything.')}</p></div><span class="small" style="color:#8394b5">${t('jumpagency.org')}</span></div>
    <div class="auth-main"><div class="card"><h1>${setup ? 'Welcome' : 'Welcome back'}</h1>
      <p>${setup ? 'Create a password to protect your workspace.' : 'Sign in to your workspace.'}</p>
      <form id="authf"><label class="field"><span>${t('Password')}</span><input type="password" id="pw" autocomplete="${setup ? 'new-password' : 'current-password'}" required minlength="${setup ? 8 : 1}"></label>
        <button class="btn primary lg">${setup ? 'Create password' : 'Sign in'}</button></form></div></div></div>`;
  $('#pw').focus();
  $('#authf').onsubmit = async (e) => {
    e.preventDefault();
    try { await req('POST', setup ? '/api/setup' : '/api/login', { password: $('#pw').value }); boot(); } catch (x) { toast(x.message, 'err'); }
  };
}

let refreshing = null;
async function refresh(first) {
  if (refreshing) return refreshing;
  refreshing = req('GET', '/api/bootstrap').then((d) => {
    if (d.config.ui_language !== S.lang) { S.lang = d.config.ui_language; setLang(S.lang); S.lastHtml = null; if ($('#app')) root.innerHTML = ''; }
    Object.assign(S, { mode: d.mode, night: d.night, link: d.link, config: d.config, agents: d.agents, leads: d.leads, approvals: d.approvals, runs: d.runs, sites: d.sites, activity: d.activity, hunts: d.hunts || [], runner: d.runner, stats: d.stats });
    S.market ||= d.config.market_id;
    if (!first) render(true);
  }).finally(() => { refreshing = null; });
  return refreshing;
}
let later = null;
const soon = () => { clearTimeout(later); later = setTimeout(refresh, 500); };

function connect() {
  if (S.ws && S.ws.readyState <= 1) return;
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  S.ws = ws;
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.type === 'runner') { S.runner = msg.state; renderTop(); }
    else if (msg.type === 'mode') { S.mode = msg.mode; soon(); }
    else if (msg.type === 'link') { S.link = msg.url; }
    else if (msg.type === 'stats') { S.stats = msg.stats; }
    else if (msg.type === 'run_event') { (S.events[msg.run_id] ||= []).push(msg.event); liveEvent(msg.run_id, msg.event); if (route() === 'tasks') { clearTimeout(S.rrT); S.rrT = setTimeout(() => render(true), 400); } }
    else if (msg.type === 'change') { if (msg.kind === 'activity') { S.activity.unshift(msg.payload); liveActivity(msg.payload); } soon(); }
  };
  ws.onclose = () => setTimeout(connect, 2500);
}

/* ------------------------------------------------------------------ shell */
const VIEWS = [['home', 'Home', 'home'], ['tasks', 'Tasks', 'spark'], ['prospects', 'Businesses', 'users'], ['demos', 'Demos', 'monitor'], ['messages', 'Messages', 'msg'], ['team', 'AI team', 'team'], ['map', 'Live map', 'map'], ['settings', 'Settings', 'gear']];
const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/')[0];
const go = (v) => { location.hash = `#/${v}`; };

function render(fromRefresh) {
  if (!S.config) return;
  if (!$('#app')) {
    root.innerHTML = `<div class="shell"><aside class="side"><a class="logo" href="#/home"><i>J</i>Jump <small>HQ</small></a><nav id="nav" style="display:contents"></nav><div class="grow"></div><div class="side-status" id="status"></div></aside><div><main id="app" class="page"></main></div></div>`;
  }
  renderTop();
  // don't throw away what the owner is typing
  const focus = document.activeElement;
  if (fromRefresh && focus && /INPUT|TEXTAREA|SELECT/.test(focus.tagName) && (focus.closest('#app') || focus.closest('.drawer'))) { S.pending = true; return; }
  S.pending = false;
  const v = route();
  document.body.classList.toggle('on-map', v === 'map');
  const fn = { map: viewMap, tasks: viewTasks, home: viewHome, prospects: viewProspects, demos: viewDemos, messages: viewMessages, team: viewTeam, settings: viewSettings }[v] || viewHome;
  const html = fn();
  if (html !== S.lastHtml || v !== S.lastView) { $('#app').innerHTML = html; S.lastHtml = html; S.lastView = v; wire[v]?.(); }
  if (S.lead) renderDrawer();
}
document.addEventListener('focusout', () => setTimeout(() => { if (S.pending && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) render(); }, 50));

function renderTop() {
  if (!$('#nav')) return;
  const msgs = S.approvals.filter((a) => a.status === 'pending' || (a.status === 'approved' && ['email', 'whatsapp'].includes(a.type))).length;
  const demos = S.leads.filter((l) => l.stage === 'demo_built' && siteOf(l) && !siteOf(l).public_url).length;
  const counts = { messages: msgs, demos };
  $('#nav').innerHTML = VIEWS.map(([k, n, i]) => `<a href="#/${k}" class="navl ${route() === k ? 'on' : ''}">${ic(i)}${t(n)}${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('');
  const r = S.runner || {};
  const run = S.runs.find((x) => x.status === 'running');
  const sleep = S.mode === 'sleep';
  $('#status').innerHTML = `<div class="mode-switch ${sleep ? 'sleep' : ''}"><button data-mode="awake" class="${sleep ? '' : 'on'}">${ic('sun')}${t('Awake')}</button><button data-mode="sleep" class="${sleep ? 'on' : ''}">${ic('moon')}${t('Sleep')}</button></div>
    <div class="why">${sleep ? t('The team works alone. The Judge approves safe work; anything risky waits for you.') : t('You approve everything before it goes out.')}</div>`
    + (r.paused
      ? `<div class="line"><span class="dot warn"></span>${t('Team paused')}</div><div class="why">${esc(r.pauseReason || '')}</div><button class="btn primary sm" id="resume">${ic('play')}${t('Resume')}</button>`
      : run ? `<div class="line"><span class="dot busy"></span>${esc(agentName(run.agent))} ${t('is working')}</div><div class="why">${esc(run.title.split(' · ').slice(1).join(' · '))}</div>`
        : `<div class="line"><span class="dot on"></span>${t('Team ready')}</div><div class="why">${S.runner?.today ?? 0} ${t('jobs today')}</div>`);
  $('#resume')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', '/api/runner/resume'), t('The team is back at work.')));
  $$('[data-mode]', $('#status')).forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  document.body.classList.toggle('sleeping', sleep);
}
async function setMode(mode) {
  if (mode === S.mode) return;
  if (mode === 'sleep' && !confirm(t('Go to Sleep mode? The team keeps working and the Judge approves safe demos and messages for you. Anything risky waits for the morning.'))) return;
  try { const r = await req('POST', '/api/mode', { mode }); S.mode = r.mode; S.night = r.night; toast(mode === 'sleep' ? t('Good night. The team is on it.') : t('Good morning. You approve everything again.')); await refresh(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------------------------- HOME */
function needsYou() {
  const items = [];
  for (const l of S.leads) {
    const site = siteOf(l);
    if (l.stage === 'demo_built' && site && !site.public_url && !workingOn(l)) items.push({ icon: 'eye', title: `${t('Look at the demo for')} ${l.business}`, sub: `${l.opportunity ? `${l.opportunity.score}/100 · ` : ''}${t('approve it and the first message gets written')}`, btn: t('Review'), run: () => openPreview(site, l) });
  }
  for (const a of S.approvals.filter((x) => x.status === 'pending')) items.push({ icon: a.judge && !a.judge.passes ? 'scale' : 'msg', title: a.title, sub: a.judge && !a.judge.passes ? `${t('Held by the Judge')}: ${a.judge.summary}` : `${a.type === 'whatsapp' ? 'WhatsApp' : a.type === 'email' ? t('Email') : t('Request')} · ${t('written')} ${ago(a.created)}`, btn: t('Read & approve'), run: () => { S.msgTab = 'pending'; go('messages'); } });
  for (const a of S.approvals.filter((x) => x.status === 'approved' && ['email', 'whatsapp'].includes(x.type))) items.push({ icon: 'send', title: `${t('Send the message to')} ${S.leads.find((l) => l.id === a.lead_id)?.business || a.to}`, sub: t('approved, not sent yet'), btn: t('Send'), run: () => { S.msgTab = 'ready'; go('messages'); } });
  for (const h of S.hunts.filter((x) => x.status === 'running' && !x.working && !x.queued)) items.push({ icon: 'play', title: `${t('Finish the search for')} ${h.niche}, ${h.city}`, sub: t('it stopped half-way'), btn: t('Continue'), run: (b) => act(b, () => req('POST', `/api/hunts/${h.id}/continue`), t('Search continued.')) });
  if (S.runner?.paused) items.unshift({ icon: 'pause', title: t('The team is paused'), sub: S.runner.pauseReason || '', btn: t('Resume'), run: (b) => act(b, () => req('POST', '/api/runner/resume'), t('Resumed.')) });
  return items;
}

function viewHome() {
  const m = market(S.market);
  const hunt = S.hunts[0];
  const st = S.stats || {};
  const todo = needsYou();
  const hr = new Date().getHours();
  return `
  <div class="page-head"><div><h1>${t(hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening')}${S.config.company.sender_name ? `, ${esc(S.config.company.sender_name)}` : ''}</h1>
    <p>${todo.length ? `${todo.length} ${t('things need you. Everything else is handled.')}` : t('You are all caught up.')}</p></div></div>

  <div class="grid" style="gap:16px">
    ${startCard()}
    ${nightCard()}
    <section class="card askcard"><div class="card-h"><h2>${t('Ask your team')}</h2><a class="small" href="#/tasks">${t('Tasks and schedules')} →</a></div><div class="card-b">${composer('askHome', true)}</div></section>
    <section class="card finder">
      <h2>${t('Find new clients')}</h2>
      <p>${t('Choose what to look for. The team finds the businesses, checks them, and builds free demo websites for the best ones.')}</p>
      <div class="picks">
        <label class="pickbox"><small>${t('How many')}</small><select id="hCount">${[5, 10, 20, 30].map((n) => `<option ${n === 10 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="pickbox wide"><small>${t('Kind of business')}</small><select id="hNiche">${(m.niches || []).map((n) => `<option>${esc(n[0].toUpperCase() + n.slice(1))}</option>`).join('')}</select></label>
        <label class="pickbox"><small>${t('City')}</small><select id="hCity">${(m.cities || []).map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        <button class="btn primary lg" id="hGo">${ic('search')}${t('Start search')}</button>
      </div>
      <div class="finder-foot">
        <label>${t('Build demos for the best')} <select id="hBuild">${[1, 3, 5, 10].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>${t('Market')} <select id="hMarket">${Object.values(S.config.markets).map((x) => `<option value="${x.id}" ${x.id === S.market ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
        <button class="btn sm outline" id="hAdd">+ ${t('Add a business you know')}</button>
        <span>${t('Messages go by')} ${m.channel === 'whatsapp' ? 'WhatsApp' : t('Email')} · ${esc(m.language)} · ${t('only after you approve.')}</span>
      </div>
    </section>

    ${hunt ? huntCard(hunt) : ''}

    <div class="grid cols-2">
      <section class="card"><div class="card-h"><h2>${t('Needs you')}</h2><span class="sub">${todo.length ? `${todo.length} ${t('to do')}` : ''}</span></div>
        <div style="padding:8px 0 6px">${todo.length ? todo.map((it, i) => `<div class="todo"><span class="ico ${i === 0 ? 'hot' : ''}">${ic(it.icon)}</span><div class="t"><b>${esc(it.title)}</b><span>${esc(it.sub)}</span></div><button class="btn sm ${i === 0 ? 'dark' : ''}" data-todo="${i}">${it.btn}</button></div>`).join('') : `<div class="empty"><b>${t('Nothing waiting')}</b>${t('New demos and messages will show up here.')}</div>`}</div></section>
      <section class="card"><div class="card-h"><h2>${t('What the team did')}</h2><a class="small" href="#/team">${t('See all')}</a></div>
        <div class="feed" id="homeFeed" style="max-height:330px;margin-top:8px">${S.activity.slice(0, 9).map(feedRow).join('') || `<div class="empty">${t('Nothing yet. Start a search above.')}</div>`}</div></section>
    </div>

    <div class="kpis">
      ${kpi('Businesses checked', st.leads ?? 0)}${kpi('Demos built', st.demos ?? 0)}${kpi('Messages sent', st.sentTotal ?? 0)}${kpi('Clients', st.won ?? 0)}${kpi('Monthly income', st.mrr ? money(st.mrr) : '0')}
    </div>
  </div>`;
}
function nightCard() {
  const n = S.night;
  if (S.mode === 'sleep') {
    return `<section class="card night on"><div class="night-ic">${ic('moon')}</div><div class="grow"><h2>${t('Sleep mode is on')}</h2><p>${t('The team works alone. The Judge checks every demo and message before it goes out.')}${n ? ` ${t('Since')} ${clock(n.start)}.` : ''}</p>
      ${n ? `<div class="night-n">${[['searches', 'Searches'], ['found', 'Businesses found'], ['demos', 'Demos built'], ['published', 'Put online'], ['sent', 'Messages sent'], ['held', 'Held for you']].map(([k, l]) => `<div><b>${n[k] ?? 0}</b><span>${t(l)}</span></div>`).join('')}</div>` : ''}</div>
      <button class="btn" data-wake>${ic('sun')}${t('Wake up')}</button></section>`;
  }
  if (!n || !n.end || Date.now() - new Date(n.end) > 20 * 3600e3 || localStorage.getItem('hq_seen_night') === n.start) return '';
  return `<section class="card night"><div class="night-ic sun">${ic('sun')}</div><div class="grow"><h2>${t('While you slept')}</h2><p>${clock(n.start)} – ${clock(n.end)}</p>
    <div class="night-n">${[['searches', 'Searches'], ['found', 'Businesses found'], ['demos', 'Demos built'], ['published', 'Put online'], ['sent', 'Messages sent'], ['ready', 'Ready to send'], ['held', 'Held for you']].map(([k, l]) => `<div><b>${n[k] ?? 0}</b><span>${t(l)}</span></div>`).join('')}</div></div>
    <button class="btn ghost sm" data-seen>${t('Got it')}</button></section>`;
}
const kpi = (k, v) => `<div class="card kpi"><div class="v">${v}</div><div class="k">${t(k)}</div></div>`;

function huntCard(h) {
  const f = h.funnel;
  const steps = [['found', 'Found'], ['verified', 'Verified'], ['worth', 'Worth considering'], ['high', 'High value'], ['approved', 'Approved to build'], ['demos', 'Demos built']];
  const max = Math.max(1, f.found);
  const w = h.working;
  const now = h.status === 'running'
    ? (w ? `<span class="dot busy"></span><span class="grow">${agentName(w.agent)} ${t('is working')}${h.queued ? ` · ${h.queued} ${t('more steps lined up')}` : ''}</span><button class="btn sm ghost" id="hStop">${t('Stop')}</button>` : `<span class="dot warn"></span><span class="grow">${t('Waiting to continue')}</span>`)
    : `<span class="dot ${h.status === 'done' ? 'on' : ''}"></span><span class="grow">${h.status === 'done' ? `${t('Finished')} ${ago(h.ended)}` : t('Stopped')}. ${f.demos ? `${f.demos} ${t('demos ready for you.')}` : ''}</span>${f.found ? `<a class="btn sm dark" href="#/prospects">${t('See the businesses')}</a>` : ''}`;
  return `<section class="card"><div class="card-h"><h2>${h.status === 'running' ? t('Searching') : t('Last search')}: ${esc(h.niche)}, ${esc(h.city)}</h2>${h.status === 'running' ? `<span class="live">${t('● live')}</span>` : `<span class="sub">${ago(h.created)} · looked for ${h.target}</span>`}</div>
    <div class="card-b"><div class="funnel">${steps.map(([k, t], i) => `<div class="fstep ${i === steps.length - 1 && f[k] ? 'hot' : ''}"><div class="n">${f[k] ?? 0}</div><div class="l">${t}</div><div class="bar" style="width:${Math.round(((f[k] ?? 0) / max) * 100)}%"></div></div>`).join('')}</div>
    <div class="now ${h.status === 'running' && w ? '' : 'idle'}">${now}</div></div></section>`;
}

const wire = {};
wire.home = () => {
  const todo = needsYou();
  wireComposer($('#app'));
  $('[data-hidestart]')?.addEventListener('click', () => { try { localStorage.setItem('hq_start_hidden', '1'); } catch { /* private window */ } S.lastHtml = null; render(); });
  $$('[data-step]').forEach((b) => (b.onclick = () => startSteps()[+b.dataset.step][2]()));
  $('[data-wake]')?.addEventListener('click', () => setMode('awake'));
  $('[data-seen]')?.addEventListener('click', () => { try { localStorage.setItem('hq_seen_night', S.night.start); } catch {} S.lastHtml = null; render(); });
  $$('[data-todo]').forEach((b) => (b.onclick = () => todo[+b.dataset.todo].run(b)));
  $('#hMarket').onchange = (e) => { S.market = e.target.value; render(); };
  $('#hAdd').onclick = () => openAddBusiness();
  $('#hGo').onclick = (e) => act(e.currentTarget, () => req('POST', '/api/hunts', { market_id: S.market, city: $('#hCity').value, niche: $('#hNiche').value, count: +$('#hCount').value, build: +$('#hBuild').value }), t('Search started. You can close this page, the team keeps working.'));
  $('#hStop')?.addEventListener('click', (e) => { if (confirm(t('Stop this search? Work already done is kept.'))) act(e.currentTarget, () => req('POST', `/api/hunts/${S.hunts[0].id}/stop`), t('Search stopped.')); });
};

/* -------------------------------------------------------------- PROSPECTS */
const FILTERS = [
  ['all', t('All'), () => true],
  ['worth', t('Worth building'), (l) => ['qualified', 'planned', 'approved'].includes(l.stage)],
  ['you', t('Waiting for you'), (l) => ['demo_built', 'email_drafted'].includes(l.stage)],
  ['contacted', t('Contacted'), (l) => ['sent', 'replied'].includes(l.stage)],
  ['clients', t('Clients'), (l) => l.stage === 'won'],
  ['hold', t('On hold'), (l) => l.stage === 'hold'],
  ['skipped', t('Not a fit'), (l) => ['skipped', 'lost'].includes(l.stage)],
];
function viewProspects() {
  const f = FILTERS.find((x) => x[0] === S.filter) || FILTERS[0];
  const q = S.q.toLowerCase();
  const list = S.leads.filter(f[2]).filter((l) => !q || `${l.business} ${l.business_local} ${l.city} ${l.area} ${l.niche}`.toLowerCase().includes(q))
    .sort((a, b) => (b.opportunity?.score ?? -1) - (a.opportunity?.score ?? -1) || b.updated.localeCompare(a.updated));
  return `<div class="page-head"><div><h1>${t('Businesses')}</h1><p>${t('Everyone the team found, best first. Click a business to see the full profile and why.')}</p></div></div>
  <div class="toolbar"><div class="seg">${FILTERS.map(([k, t, fn]) => `<button data-f="${k}" class="${S.filter === k ? 'on' : ''}">${t}<em>${S.leads.filter(fn).length}</em></button>`).join('')}</div>
    <input id="q" placeholder="${t('Search by name or area')}" value="${esc(S.q)}"></div>
  <div class="card">${list.length ? `<div class="blist">${list.map((l) => {
    const st = statusOf(l);
    const nx = nextStep(l);
    const why = l.opportunity?.summary || l.reason || (l.issues || []).join(' · ') || l.notes || '';
    return `<div class="brow" data-lead="${l.id}">${avatar(l)}<div class="t"><b>${esc(l.business)}${l.business_local ? ` <span class="rtl" style="display:inline;font-weight:600;color:var(--muted)">${esc(l.business_local)}</span>` : ''}</b><span>${esc([l.niche, [l.area, l.city].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}${why ? ` · ${esc(why)}` : ''}</span></div>
      <div class="s">${ring(l)}<span class="badge ${st.tone}">${esc(st.text)}</span></div>
      <div class="a">${nx ? `<button class="btn sm ${nx.label === t('Review demo') ? 'primary' : 'outline'}" data-next="${l.id}">${ic(nx.icon)}${nx.label}</button>` : ''}</div></div>`;
  }).join('')}</div>` : `<div class="empty"><b>${S.leads.length ? 'Nothing here' : 'No businesses yet'}</b>${S.leads.length ? 'Try another filter.' : 'Start a search on the Home page.'}</div>`}</div>`;
}
wire.prospects = () => {
  $$('[data-f]').forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; render(); }));
  const q = $('#q');
  q.oninput = () => { S.q = q.value; clearTimeout(q.t); q.t = setTimeout(() => { render(); const n = $('#q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $$('.brow[data-lead]').forEach((tr) => (tr.onclick = (e) => { if (e.target.closest('button')) return; openLead(tr.dataset.lead); }));
  $$('[data-next]').forEach((b) => (b.onclick = () => nextStep(S.leads.find((l) => l.id === b.dataset.next))?.run(b)));
};

/* ------------------------------------------------------- PROSPECT DRAWER */
function openLead(id) { S.lead = id; renderDrawer(); }
function closeLead() { S.lead = null; $('.drawer')?.remove(); $('.scrim')?.remove(); }
function renderDrawer() {
  const l = S.leads.find((x) => x.id === S.lead);
  if (!l) return closeLead();
  const focus = document.activeElement;
  if (focus && focus.closest?.('.drawer') && /INPUT|TEXTAREA/.test(focus.tagName)) return;
  if (!$('.scrim')) { const s = document.createElement('div'); s.className = 'scrim'; s.onclick = closeLead; document.body.appendChild(s); }
  let d = $('.drawer');
  if (!d) { d = document.createElement('aside'); d.className = 'drawer'; document.body.appendChild(d); }
  const o = l.opportunity, p = l.profile, plan = l.plan, rv = l.review, site = siteOf(l), st = statusOf(l), nx = nextStep(l);
  const sig = JSON.stringify([l.updated, site?.updated, site?.public_url, st.text]);
  if (d.dataset.sig === sig && d.dataset.id === l.id) return;
  const keep = d.dataset.id === l.id ? $('.drawer-b', d)?.scrollTop || 0 : 0;
  d.dataset.sig = sig; d.dataset.id = l.id;
  const link = (href, text) => (href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>` : '');
  const q = S.config.qualify;
  const cls = o ? (o.score >= q.threshold ? '' : o.score >= q.hold ? 'hold' : 'skip') : '';
  const label = o ? (o.score >= q.threshold ? 'High priority: build a demo' : o.score >= q.hold ? 'Keep for later' : 'Not worth it right now') : '';
  d.innerHTML = `
  <div class="drawer-h">${avatar(l)}<div>
    <h2>${esc(l.business)} ${l.business_local ? `<span class="rtl" style="font-size:16px;color:var(--muted);font-weight:600">${esc(l.business_local)}</span>` : ''}</h2>
    <div class="loc">${esc([l.niche, [l.area, l.city].filter(Boolean).join(', ')].filter(Boolean).join(' · '))} <span class="badge ${st.tone}">${esc(st.text)}</span></div>
    <div class="links">${link(l.website, hostOf(l.website))}${link(l.socials?.instagram, 'Instagram')}${link(l.socials?.facebook, 'Facebook')}${link(l.socials?.tiktok, 'TikTok')}${link(l.maps_url, 'Map')}${l.phone ? `<span>${esc(l.phone)}</span>` : ''}${l.whatsapp && l.whatsapp !== l.phone ? `<span>WhatsApp ${esc(l.whatsapp)}</span>` : ''}${l.email ? `<span>${esc(l.email)}</span>` : ''}</div></div><button class="x" title="${t('Close')}">×</button>
  </div>
  <div class="drawer-b">
    ${o ? `<section class="card card-b sec"><h3>${t('Recommendation')}</h3><div class="reco"><div class="big-score ${cls}" style="--p:${o.score}"><div><b>${o.score}</b><span>${t('of 100')}</span></div></div>
      <div><h4>${label}</h4><div class="meta-row">${o.confidence != null ? `<span class="badge">Confidence ${o.confidence}%</span>` : ''}${rv ? `<span class="badge ${rv.verdict === 'approve' ? 'good' : rv.verdict === 'hold' ? 'warn' : 'bad'}">Reviewer: ${{ approve: 'approved', hold: 'on hold', reject: 'rejected' }[rv.verdict]}</span>` : ''}</div>
      ${o.summary ? `<p>${esc(o.summary)}</p>` : ''}</div></div>
      ${o.reasons?.length ? `<h3 style="margin-top:16px">${t('Why')}</h3><ul class="clean">${o.reasons.map((r) => `<li><span class="ok-ic">${ic('check')}</span><div>${esc(r.point || r)}${r.evidence ? `<span class="ev">${esc(r.evidence)}</span>` : ''}</div></li>`).join('')}</ul>` : ''}
      ${o.risks?.length ? `<h3 style="margin-top:14px">${t('Risks')}</h3><ul class="clean">${o.risks.map((r) => `<li><span style="color:var(--warn)">${ic('alert')}</span><div>${esc(r)}</div></li>`).join('')}</ul>` : ''}
    </section>` : ''}

    ${plan ? `<section class="card card-b sec"><h3>${t('What we\'ll build')}</h3><h4 style="font-size:16px">${esc(plan.product)}</h4><p class="muted" style="margin:4px 0 12px">${esc(plan.why)}</p>
      <dl class="kv"><dt>${t('Main button')}</dt><dd>${esc(plan.primary_action)}</dd><dt>${t('Languages')}</dt><dd>${esc((plan.languages || []).join(' + '))}</dd><dt>${t('Look and feel')}</dt><dd>${esc(plan.style)}</dd></dl>
      <div class="chips" style="margin-top:12px">${(plan.must_have || []).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div></section>` : ''}

    ${site ? `<section class="card sec" style="overflow:hidden"><div class="demo"><div class="shot" data-preview>${site ? `<iframe loading="lazy" scrolling="no" src="${esc(site.local_url)}" tabindex="-1"></iframe>` : ''}</div><div class="info"><h3>${t('Demo website')}</h3><p>${esc(site.summary || '')}</p>
      <div class="row-actions"><button class="btn sm" data-preview>${ic('eye')}Preview</button>${site.public_url ? `<a class="btn sm" href="${esc(site.public_url)}" target="_blank" rel="noopener">${ic('ext')}Live link</a>` : ''}</div></div></div></section>` : ''}

    ${p ? `<section class="card card-b sec"><h3>${t('Public profile')}</h3>
      <dl class="kv">${p.rating ? `<dt>${t('Rating')}</dt><dd>${esc(p.rating)}${p.review_count ? ` from ${esc(p.review_count)} reviews` : ''}${p.rating_source ? ` (${esc(p.rating_source)})` : ''}</dd>` : ''}${p.followers ? `<dt>${t('Followers')}</dt><dd>${esc(p.followers)}</dd>` : ''}
      <dt>${t('Website today')}</dt><dd>${esc({ none: 'None', social_only: 'Only social media pages', weak: 'Weak / outdated', ok: 'OK', good: 'Good' }[p.website_status] || '—')}</dd>${p.hours ? `<dt>${t('Hours')}</dt><dd>${esc(p.hours)}</dd>` : ''}${p.address ? `<dt>${t('Address')}</dt><dd>${esc(p.address)}</dd>` : ''}${p.decision_maker ? `<dt>${t('Owner / manager')}</dt><dd>${esc(p.decision_maker)}</dd>` : ''}</dl>
      ${p.missing?.length ? `<h3 style="margin-top:14px">${t('Missing today')}</h3><div class="chips">${p.missing.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
      ${p.cares_about?.length ? `<h3 style="margin-top:14px">${t('What they care about')}</h3><div class="chips">${p.cares_about.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
      ${p.facts?.length ? `<h3 style="margin-top:14px">${t('Facts')} <span style="text-transform:none;letter-spacing:0;font-weight:500">${t('· ✓ verified, ○ assumed')}</span></h3><ul class="clean facts">${p.facts.map((f) => `<li><span class="${f.verified ? 'ok-ic' : 'as-ic'}">${ic(f.verified ? 'check' : 'circle')}</span><div>${esc(f.text)}${f.source ? `<span class="ev">${esc(f.source)}</span>` : ''}</div></li>`).join('')}</ul>` : ''}
      ${p.red_flags?.length ? `<h3 style="margin-top:14px">${t('Red flags')}</h3><ul class="clean">${p.red_flags.map((r) => `<li><span class="no-ic">${ic('x')}</span><div>${esc(r)}</div></li>`).join('')}</ul>` : ''}
    </section>` : `<section class="card card-b"><p class="muted" style="margin:0">${t('The profile appears here once the Investigator has checked this business.')}</p></section>`}

    ${rv?.checks?.length ? `<section class="card card-b sec"><h3>${t('Reviewer\'s checks')}</h3><p style="margin:0 0 10px">${esc(rv.summary)}</p><ul class="clean">${rv.checks.map((c) => `<li><span class="${c.ok ? 'ok-ic' : 'no-ic'}">${ic(c.ok ? 'check' : 'x')}</span><div>${esc(c.check)}${c.note ? `<span class="ev">${esc(c.note)}</span>` : ''}</div></li>`).join('')}</ul></section>` : ''}

    ${l.reason && ['skipped', 'hold', 'lost'].includes(l.stage) ? `<section class="card card-b"><h3 class="sec" style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px">${t('Why it stopped')}</h3>${esc(l.reason)}</section>` : ''}

    <section class="card card-b sec"><h3>${t('History')}</h3><div class="timeline">${(l.history || []).slice().reverse().map((h) => `<div><time>${ago(h.at)}</time><span>${esc(h.text)}</span></div>`).join('')}</div></section>
  </div>
  <div class="drawer-f">${nx ? `<button class="btn primary" id="dNext">${ic(nx.icon)}${nx.label}</button>` : ''}
    ${!site && !workingOn(l) && ['qualified', 'planned', 'skipped', 'profiled'].includes(l.stage) ? `<button class="btn outline" id="dBuild">${t('Build a demo anyway')}</button>` : ''}
    ${['sent', 'replied'].includes(l.stage) ? `<button class="btn dark" id="dWon">${t('Mark as client')}</button>` : ''}
    <span class="grow"></span>${!['skipped', 'lost', 'won'].includes(l.stage) ? `<button class="btn ghost" id="dSkip">${t('Not a fit')}</button>` : ''}</div>`;
  $('.drawer-b', d).scrollTop = keep;
  $('.x', d).onclick = closeLead;
  $$('[data-preview]', d).forEach((b) => (b.onclick = () => openPreview(site, l)));
  $('#dNext')?.addEventListener('click', (e) => nx.run(e.currentTarget));
  $('#dBuild')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/leads/${l.id}/build`), `Building a demo for ${l.business}.`));
  $('#dWon')?.addEventListener('click', (e) => act(e.currentTarget, () => req('PATCH', `/api/leads/${l.id}`, { stage: 'won', note: 'Became a client' }), t('Congratulations, a new client.')));
  $('#dSkip')?.addEventListener('click', (e) => act(e.currentTarget, () => req('PATCH', `/api/leads/${l.id}`, { stage: 'skipped', note: 'Marked as not a fit by you' }), t('Moved to "Not a fit".')));
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('.preview')) $('.preview').remove(); else if (S.lead) closeLead(); } });

/* ---------------------------------------------------------------- PREVIEW */
function openPreview(site, l) {
  if (!site) return;
  const p = document.createElement('div');
  p.className = 'preview';
  const canApprove = l && !site.public_url;
  p.innerHTML = `<div class="bar"><b style="padding:0 6px">${esc(site.business)}</b>
    <div class="seg"><button class="on" data-w="desk">${ic('monitor')} ${t('Computer')}</button><button data-w="phone">${ic('phone')} ${t('Phone')}</button></div>
    <a class="btn sm" href="${esc(site.local_url)}" target="_blank">${ic('ext')}New tab</a>
    ${canApprove ? `<button class="btn sm primary" id="pOk">${ic('check')}${t('Looks good: put it online')}</button>` : site.public_url ? `<a class="btn sm" href="${esc(site.public_url)}" target="_blank">${t('Live link')}</a>` : ''}
    <button class="btn sm ghost" id="pX">${t('Close')}</button></div>
    <div class="frame"><iframe src="${esc(site.local_url)}"></iframe></div>`;
  document.body.appendChild(p);
  p.onclick = (e) => { if (e.target === p) p.remove(); };
  $('#pX', p).onclick = () => p.remove();
  $$('[data-w]', p).forEach((b) => (b.onclick = () => { $$('[data-w]', p).forEach((x) => x.classList.toggle('on', x === b)); $('.frame', p).classList.toggle('phone', b.dataset.w === 'phone'); }));
  $('#pOk', p)?.addEventListener('click', async (e) => {
    const r = await act(e.currentTarget, () => req('POST', `/api/leads/${l.id}/approve-demo`), t('The demo is online. The Writer is drafting the first message for you.'));
    if (r) p.remove();
  });
}

/* ------------------------------------------------------------------ DEMOS */
function viewDemos() {
  const sites = S.sites.map((s) => ({ s, l: S.leads.find((x) => x.id === s.lead_id || x.demo?.slug === s.slug) })).sort((a, b) => (a.s.public_url ? 1 : 0) - (b.s.public_url ? 1 : 0) || (b.s.updated || '').localeCompare(a.s.updated || ''));
  const building = S.runs.filter((r) => r.agent === 'builder' && ['running', 'queued'].includes(r.status));
  return `<div class="page-head"><div><h1>${t('Demos')}</h1><p>${t('Free websites the team built. Look, approve, and the first message is written for you.')}</p></div></div>
  ${building.length ? `<div class="now" style="margin:0 0 16px"><span class="dot busy"></span>${building.map((r) => esc(r.title.replace('Builder · ', ''))).join(', ')}: ${building.length > 1 ? 'demos are' : 'demo is'} being built</div>` : ''}
  ${sites.length ? `<div class="demos">${sites.map(({ s, l }, i) => `<article class="card demo"><div class="shot" data-pv="${i}"><iframe loading="lazy" scrolling="no" src="${esc(s.local_url)}" tabindex="-1"></iframe></div>
    <div class="info"><div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><h3>${esc(s.business)}</h3>${(() => { const st = s.public_url ? ['good', 'Online'] : l && ['demo_built'].includes(l.stage) ? ['accent', 'Waiting for you'] : ['', 'Not used']; return `<span class="badge ${st[0]}">${st[1]}</span>`; })()}</div>
    <p>${esc(s.summary || l?.plan?.product || '')}</p>
    ${!s.public_url ? judgeBox(s.judge, { judging: s.judging, id: l?.id, kind: 'demo' }) : s.auto ? `<div class="judge good slim"><span class="j-ic">${ic('scale')}</span><div><b>${t('Put online by the Judge while you slept')}</b></div></div>` : ''}
    <div class="row-actions"><button class="btn sm ${!s.public_url && l?.stage === 'demo_built' ? 'primary' : 'outline'}" data-pv="${i}">${ic('eye')}${!s.public_url && l?.stage === 'demo_built' ? 'Review' : 'Preview'}</button>${s.public_url ? `<a class="btn sm outline" href="${esc(s.public_url)}" target="_blank" rel="noopener">${ic('ext')}Live link</a>` : ''}${l ? `<button class="btn sm ghost" data-lead="${l.id}">${t('Details')}</button>` : ''}</div></div></article>`).join('')}</div>`
    : `<div class="card empty"><b>${t('No demos yet')}</b>${t('When a business is worth it, the Builder makes one and it shows up here.')}</div>`}`;
}
wire.demos = () => {
  const sites = S.sites.map((s) => ({ s, l: S.leads.find((x) => x.id === s.lead_id || x.demo?.slug === s.slug) })).sort((a, b) => (a.s.public_url ? 1 : 0) - (b.s.public_url ? 1 : 0) || (b.s.updated || '').localeCompare(a.s.updated || ''));
  $$('[data-pv]').forEach((b) => (b.onclick = () => openPreview(sites[+b.dataset.pv].s, sites[+b.dataset.pv].l)));
  $$('[data-lead]').forEach((b) => (b.onclick = () => openLead(b.dataset.lead)));
  wireJudge();
};

/* ------------------------------------------------------------------ JUDGE */
function judgeBox(j, { judging, id, kind } = {}) {
  if (judging) return `<div class="judge busy"><span class="j-ic">${ic('scale')}</span><div><b>${t('The Judge is checking this…')}</b><span>${t('An independent AI reviewer reads it against what we really know about the business.')}</span></div></div>`;
  if (!j) return '';
  const tone = j.passes ? 'good' : j.verdict === 'hold' ? 'bad' : 'warn';
  const label = j.passes ? (j.revised ? t('Safe after small fixes') : t('Safe to send')) : t('Held: needs you');
  return `<div class="judge ${tone}"><span class="j-ic">${ic('scale')}</span><div class="grow"><div class="j-top"><b>${t('Judge')}: ${label}</b><span class="badge ${tone}">${j.score}/100 · ${t({ low: 'low risk', medium: 'medium risk', high: 'high risk' }[j.risk] || j.risk)}</span></div>
    ${j.summary ? `<p dir="auto">${esc(j.summary)}</p>` : ''}
    ${j.reasons?.length ? `<details><summary>${t('Why')}</summary><ul>${j.reasons.map((r) => `<li dir="auto">${esc(r)}</li>`).join('')}</ul></details>` : ''}
    <div class="row-actions" style="margin-top:8px">${j.revised && kind === 'message' ? `<button class="btn sm outline" data-usefix="${id}">${ic('check')}${t("Use the Judge's version")}</button>` : ''}${id ? `<button class="btn sm ghost" data-rejudge="${kind}:${id}">${t('Check again')}</button>` : ''}</div></div></div>`;
}
function wireJudge(scope = document) {
  $$('[data-rejudge]', scope).forEach((b) => (b.onclick = () => { const [k, id] = b.dataset.rejudge.split(':'); act(b, () => req('POST', `/api/judge/${k}/${id}`), t('The Judge is checking it again.')); }));
  $$('[data-usefix]', scope).forEach((b) => (b.onclick = () => {
    const a = S.approvals.find((x) => x.id === b.dataset.usefix);
    const card = b.closest('[data-a]');
    if (!a?.judge?.revised || !card) return;
    const set = (k, v) => { const el = $(`[data-k="${k}"]`, card); if (el && v != null) el.value = v; };
    set('body', a.judge.revised.body); set('subject', a.judge.revised.subject);
    toast(t("The Judge's version is in the box. Read it, then approve."));
  }));
}

/* --------------------------------------------------------------- MESSAGES */
function viewMessages() {
  const msgs = S.approvals.filter((a) => ['email', 'whatsapp'].includes(a.type));
  const tabs = [['pending', t('To approve'), (a) => a.status === 'pending'], ['ready', t('Ready to send'), (a) => a.status === 'approved'], ['sent', t('Sent'), (a) => a.status === 'sent'], ['rejected', t('Discarded'), (a) => a.status === 'rejected']];
  const tab = tabs.find((x) => x[0] === S.msgTab) || tabs[0];
  const list = msgs.filter(tab[2]);
  const smtp = S.config.outreach.sender === 'smtp' && S.config.smtp.user;
  return `<div class="page-head"><div><h1>${t('Messages')}</h1><p>${t('Nothing is sent until you say so.')} ${S.stats?.sentToday ?? 0} / ${S.config.outreach.daily_send_cap} ${t('sent today.')}</p></div></div>
  <div class="toolbar"><div class="seg">${tabs.map(([k, n, fn]) => `<button data-t="${k}" class="${S.msgTab === k ? 'on' : ''}">${n}<em>${msgs.filter(fn).length}</em></button>`).join('')}</div></div>
  <div class="grid">${list.length ? list.map((a) => {
    const l = S.leads.find((x) => x.id === a.lead_id);
    const wa = a.type === 'whatsapp';
    const head = `<div class="msg-top"><b>${esc(l?.business || a.title)}</b><span class="badge ${wa ? 'good' : 'info'}">${wa ? 'WhatsApp' : t('Email')}</span><span class="to" dir="ltr">${esc(a.to || '—')}</span><span class="grow"></span><span class="muted small">${ago(a.created)}</span></div>`;
    if (a.status === 'pending') return `<article class="card msg-card" data-a="${a.id}">${head}
      ${judgeBox(a.judge, { judging: a.judging, id: a.id, kind: 'message' })}
      <label class="field"><span>${t('Send to')}</span><input data-k="to" value="${esc(a.to)}"></label>
      ${wa ? '' : `<label class="field"><span>${t('Subject')}</span><input data-k="subject" value="${esc(a.subject)}"></label>`}
      <label class="field"><span>${t('Message')} ${wa ? `<em style="font-style:normal;color:var(--muted);font-weight:400">(${t('the English part below the line is only for you; it is not sent')})</em>` : ''}</span><textarea data-k="body" dir="auto" rows="${Math.min(16, (a.body.match(/\n/g) || []).length + 3)}">${esc(a.body)}</textarea></label>
      <div class="row-actions"><button class="btn primary" data-ok>${ic('check')}${t('Approve')}${smtp && !wa ? ` ${t('and send')}` : ''}</button><button class="btn ghost" data-save>${t('Save changes')}</button><span class="grow"></span><button class="btn ghost danger" data-no>${t('Discard')}</button></div></article>`;
    if (a.status === 'approved') return `<article class="card msg-card" data-a="${a.id}">${head}${a.auto ? `<div class="judge good slim"><span class="j-ic">${ic('scale')}</span><div><b>${t('Approved by the Judge while you slept')}</b>${a.judge ? `<span>${a.judge.score}/100 · ${esc(a.judge.summary)}</span>` : ''}</div></div>` : ''}<div class="msg-body ${wa ? 'wa' : ''}" dir="auto">${esc(wa ? a.body.split(/\n\s*-{3,}\s*\n|\n\s*\(?English( version| translation)?\)?\s*:?\s*\n/i)[0] : a.body)}</div>
      <div class="row-actions">${wa ? (a.wa_link ? `<a class="btn primary" href="${esc(a.wa_link)}" target="_blank" rel="noopener" data-opened>${ic('send')}${t('Open in WhatsApp')}</a>` : `<span class="badge warn">${t('No WhatsApp number: copy the text and send it yourself')}</span>`) : `<a class="btn primary" href="mailto:${esc(a.to)}?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(a.body)}">${ic('send')}Open in email</a>`}
        <button class="btn" data-copy>${ic('copy')}${t('Copy text')}</button><button class="btn" data-sent>${ic('check')}${t('I sent it')}</button></div>
      <p class="muted small" style="margin:0">${wa ? t('WhatsApp opens with the message ready. Press send there, then come back and press "I sent it".') : t('Send it from your mailbox, then press "I sent it".')}</p></article>`;
    if (a.status === 'sent') return `<article class="card msg-card" data-a="${a.id}">${head}<div class="msg-body ${wa ? 'wa' : ''}" dir="auto">${esc(a.body)}</div>
      <div class="row-actions"><span class="badge good">Sent ${ago(a.sent_at)}</span>${l ? `<button class="btn sm" data-reply="${l.id}">${ic('reply')}They replied</button><button class="btn sm ghost" data-lead="${l.id}">${t('Details')}</button>` : ''}</div></article>`;
    return `<article class="card msg-card">${head}<div class="msg-body" dir="auto">${esc(a.body)}</div></article>`;
  }).join('') : `<div class="card empty"><b>${{ pending: 'Nothing to approve', ready: 'Nothing waiting to be sent', sent: 'No messages sent yet', rejected: 'Nothing discarded' }[tab[0]]}</b>${tab[0] === 'pending' ? 'When you approve a demo, the first message is written and lands here.' : ''}</div>`}</div>`;
}
wire.messages = () => {
  $$('[data-t]').forEach((b) => (b.onclick = () => { S.msgTab = b.dataset.t; render(); }));
  $$('[data-a]').forEach((card) => {
    const id = card.dataset.a;
    const vals = () => Object.fromEntries($$('[data-k]', card).map((i) => [i.dataset.k, i.value]));
    $('[data-ok]', card)?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/approvals/${id}/decide`, { decision: 'approve', ...vals() }), t('Approved. It is in "Ready to send".')).then(() => { S.msgTab = 'ready'; render(); }));
    $('[data-save]', card)?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/approvals/${id}/decide`, { decision: 'save', ...vals() }), t('Saved.')));
    $('[data-no]', card)?.addEventListener('click', (e) => { if (confirm(t('Discard this message?'))) act(e.currentTarget, () => req('POST', `/api/approvals/${id}/decide`, { decision: 'reject' }), t('Discarded.')); });
    $('[data-sent]', card)?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/approvals/${id}/sent`), t('Marked as sent. Tell us when they reply.')));
    $('[data-copy]', card)?.addEventListener('click', () => { const a = S.approvals.find((x) => x.id === id); navigator.clipboard.writeText(a.body).then(() => toast(t('Copied.'))); });
  });
  $$('[data-reply]').forEach((b) => (b.onclick = () => openReply(S.leads.find((l) => l.id === b.dataset.reply))));
  $$('[data-lead]').forEach((b) => (b.onclick = () => openLead(b.dataset.lead)));
  wireJudge();
};

// The owner knows a business (walked past it, follows it on Instagram): add it and build its demo now.
function openAddBusiness() {
  const m = market(S.market);
  const p = document.createElement('div');
  p.className = 'preview';
  p.style.justifyContent = 'center';
  p.innerHTML = `<div class="card modal-card"><h2>${t('Add a business you know')}</h2>
    <p class="muted" style="margin:4px 0 16px">${t('Paste its Instagram, Facebook, Google Maps or website link. The Builder makes its demo website in a minute or two.')}</p>
    <div class="grid" style="gap:12px">
      <label class="field"><span>${t('Business name')}</span><input id="aName" dir="auto"></label>
      <label class="field"><span>${t('Link (Instagram, Facebook, Maps or website)')}</span><input id="aLink" dir="ltr" placeholder="https://instagram.com/…"></label>
      <div class="form-grid"><label class="field"><span>${t('Kind of business')}</span><select id="aNiche">${(m.niches || []).map((n) => `<option>${esc(n)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('City')}</span><select id="aCity">${(m.cities || []).map((c) => `<option>${esc(c)}</option>`).join('')}</select></label></div>
      <label class="field"><span>${t('Phone or WhatsApp (optional)')}</span><input id="aPhone" dir="ltr"></label>
      <label class="field"><span>${t('What do you know about it? (optional)')}</span><textarea id="aNotes" dir="auto" rows="3"></textarea></label>
    </div>
    <div class="row-actions" style="margin-top:16px"><button class="btn primary" id="aBuild">${ic('build')}${t('Build its demo now')}</button><button class="btn outline" id="aCheck">${t('Let the team check it first')}</button><span class="grow"></span><button class="btn ghost" id="aX">${t('Cancel')}</button></div></div>`;
  document.body.appendChild(p);
  $('#aName', p).focus();
  $('#aX', p).onclick = () => p.remove();
  const send = async (btn, build) => {
    const body = { market_id: S.market, business: $('#aName', p).value, link: $('#aLink', p).value, niche: $('#aNiche', p).value, city: $('#aCity', p).value, phone: $('#aPhone', p).value, notes: $('#aNotes', p).value, build };
    const r = await act(btn, () => req('POST', '/api/leads', body), build ? t('The Builder is making its demo. It shows up in Demos in a minute or two.') : t('Added. The team is checking it.'));
    if (r) p.remove();
  };
  $('#aBuild', p).onclick = (e) => send(e.currentTarget, true);
  $('#aCheck', p).onclick = (e) => send(e.currentTarget, false);
}

function openReply(l) {
  if (!l) return;
  const p = document.createElement('div');
  p.className = 'preview';
  p.style.justifyContent = 'center';
  p.innerHTML = `<div class="card modal-card"><h2>${esc(l.business)} replied</h2>
    <p class="muted" style="margin:4px 0 14px">${t('Paste their reply. The Closer writes your answer and it waits in Messages for you.')}</p>
    <textarea id="rText" dir="auto" placeholder="${t('Paste their message here')}"></textarea>
    <div class="row-actions" style="margin-top:12px"><button class="btn primary" id="rGo">${ic('reply')}${t('Write my answer')}</button><button class="btn ghost" id="rX">${t('Cancel')}</button></div></div>`;
  document.body.appendChild(p);
  $('#rText', p).focus();
  $('#rX', p).onclick = () => p.remove();
  $('#rGo', p).onclick = async (e) => {
    const text = $('#rText', p).value.trim();
    if (!text) return toast(t('Paste their reply first.'), 'err');
    const r = await act(e.currentTarget, () => req('POST', '/api/runs', { agent: 'closer', input: { lead_id: l.id, reply_text: text } }), t('The Closer is writing your answer.'));
    if (r) p.remove();
  };
}

/* ------------------------------------------------------------------- TEAM */
const STEP = { lead: 0, scout: 1, investigator: 2, opportunity: 3, strategist: 4, reviewer: 5, builder: 6, writer: 7, closer: 8 };
function viewTeam() {
  const running = S.runs.filter((r) => r.status === 'running');
  const cur = running[0];
  return `<div class="page-head"><div><h1>${t('Your AI team')}</h1><p>Eight specialists, each with one job. They hand work to each other; nothing leaves without you.</p></div>
    <div class="row-actions">${S.runner?.paused ? `<button class="btn primary" id="tResume">${ic('play')}${t('Resume')}</button>` : `<button class="btn outline" id="tPause">${ic('pause')}${t('Pause the team')}</button>`}</div></div>
  <div class="agents" style="margin-bottom:16px">${S.agents.sort((a, b) => (STEP[a.key] || 9) - (STEP[b.key] || 9)).map((a) => {
    const r = S.runs.find((x) => x.agent === a.key && x.status === 'running');
    const q = S.runs.filter((x) => x.agent === a.key && x.status === 'queued').length;
    return `<div class="card agent ${r ? 'on' : ''}"><div class="h"><span class="stepn">${STEP[a.key] || ''}</span><b>${esc(a.name)}</b><span class="badge ${r ? 'accent' : q ? 'info' : ''}">${r ? t('Working') : q ? `${q} ${t('waiting')}` : t('Ready')}</span></div><p>${esc(a.blurb)}</p></div>`;
  }).join('')}</div>
  <div class="grid cols-2">
    <section class="card"><div class="card-h"><h2>${cur ? `${t('Live')}: ${esc(cur.title)}` : t('Live')}</h2>${cur ? `<button class="btn sm ghost" id="tStop" data-run="${cur.id}">${t('Stop')}</button>` : ''}</div>
      <div class="feed" id="liveFeed" style="margin-top:8px">${cur ? (S.events[cur.id] || []).map((e) => eventRow(e)).filter(Boolean).join('') || `<div class="empty">${t('Starting…')}</div>` : `<div class="empty"><b>${t('Nobody is working right now')}</b>${t('Start a search on the Home page.')}</div>`}</div></section>
    <section class="card"><div class="card-h"><h2>${t('Everything that happened')}</h2></div><div class="feed" id="teamFeed" style="margin-top:8px">${S.activity.slice(0, 80).map(feedRow).join('')}</div></section>
  </div>`;
}
function eventText(e) {
  let text = '';
  if (e.kind === 'tool') {
    const i = e.input || {};
    const tool = e.tool.replace(/^mcp__hq__/, '');
    text = { WebSearch: `${t('Searching')}: “${i.query}”`, WebFetch: `${t('Reading')} ${hostOf(i.url)}`, Write: t('Writing the website'), Edit: t('Improving the website'), Read: t('Reading a file'), hq_add_lead: `${t('Found')}: ${i.business}`, hq_save_profile: t('Saved a profile'), hq_save_opportunity: `${t('Scored')} ${i.score}/100`, hq_save_plan: `${t('Planned')}: ${i.product}`, hq_save_review: `${t('Review')}: ${i.verdict}`, hq_register_site: t('Demo finished'), hq_request_approval: t('Message ready for you'), hq_note: i.text, hq_list_leads: t('Checking who we already know'), hq_get_lead: t('Opening a business'), hq_settings: t('Reading the offer') }[tool] || tool;
  } else if (e.kind === 'text') text = e.text.length > 220 ? `${e.text.slice(0, 220)}…` : e.text;
  else if (e.kind === 'result') text = e.ok ? t('Finished.') : t('Stopped with a problem.');
  return text;
}
function eventRow(e) {
  const text = eventText(e);
  if (!text) return '';
  return `<div class="ev"><time>${clock(e.at)}</time><span>${esc(text)}</span></div>`;
}
const feedRow = (a) => `<div class="ev ${a.kind || ''}"><time>${clock(a.at)}</time><span>${esc(a.text)}</span></div>`;
function liveEvent(runId, e) {
  const f = $('#liveFeed');
  if (!f || route() !== 'team') return;
  const html = eventRow(e);
  if (!html) return;
  if (f.querySelector('.empty')) f.innerHTML = '';
  f.insertAdjacentHTML('beforeend', html);
  f.scrollTop = f.scrollHeight;
}
function liveActivity(a) {
  for (const id of ['homeFeed', 'teamFeed']) { const f = $(`#${id}`); if (f) { f.querySelector('.empty')?.remove(); f.insertAdjacentHTML('afterbegin', feedRow(a)); } }
}
wire.team = () => {
  $('#tPause')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', '/api/runner/pause'), t('Paused. Nothing new will start.')));
  $('#tResume')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', '/api/runner/resume'), t('Resumed.')));
  $('#tStop')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/runs/${e.currentTarget.dataset.run}/stop`), t('Stopped.')));
  const cur = S.runs.find((r) => r.status === 'running');
  if (cur && !S.events[cur.id]) req('GET', `/api/runs/${cur.id}/events`).then((ev) => { S.events[cur.id] = ev; if (route() === 'team') { const f = $('#liveFeed'); if (f) { f.innerHTML = ev.map(eventRow).filter(Boolean).join(''); f.scrollTop = f.scrollHeight; } } }).catch(() => {});
};

/* ------------------------------------------------------------------ TASKS */
// Ask the team in plain words (the Team lead turns it into work), and repeating tasks on a schedule.
const EXAMPLES = ['Find 10 dentists in Erbil and build demos for the best 2', 'Which businesses are waiting for me?', 'Build a demo for the business I added last', 'What did the team do today?'];
const DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*] (.+)$/gm, '• $1').replace(/\n/g, '<br>');
function composer(id, compact) {
  return `<div class="ask ${compact ? 'compact' : ''}" id="${id}">
    <div class="ask-in"><textarea rows="${compact ? 1 : 2}" data-askbox placeholder="${t('Tell the team what to do, in your own words…')}" maxlength="2000" dir="auto">${esc(S.askDraft || '')}</textarea>
      <button class="btn primary" data-ask>${ic('send')}${t('Send to the team')}</button></div>
    <div class="ask-ex">${EXAMPLES.map((x) => `<button class="chip" data-ex="${esc(t(x))}">${esc(t(x))}</button>`).join('')}</div></div>`;
}
function wireComposer(scope = document) {
  $$('[data-askbox]', scope).forEach((ta) => {
    ta.oninput = () => { S.askDraft = ta.value; ta.style.height = 'auto'; ta.style.height = `${Math.min(220, ta.scrollHeight)}px`; };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ta.closest('.ask').querySelector('[data-ask]').click(); };
  });
  $$('[data-ex]', scope).forEach((b) => (b.onclick = () => { const ta = b.closest('.ask').querySelector('textarea'); ta.value = b.dataset.ex; S.askDraft = ta.value; ta.focus(); }));
  $$('[data-ask]', scope).forEach((b) => (b.onclick = () => {
    const ta = b.closest('.ask').querySelector('textarea'), text = ta.value.trim();
    if (!text) { ta.focus(); return toast(t('Write what the team should do.'), 'err'); }
    act(b, () => req('POST', '/api/ask', { text }), t('The Team lead is on it. The answer shows up in Tasks.'), () => { S.askDraft = ''; ta.value = ''; if (route() !== 'tasks') go('tasks'); });
  }));
}
function askThread() {
  const runs = S.runs.filter((r) => r.agent === 'lead').slice(0, 15);
  if (!runs.length) return `<div class="empty"><b>${t('No tasks yet')}</b>${t('Ask for anything above: a search, a question, or a demo for a business you know.')}</div>`;
  return runs.map((r) => {
    const live = r.status === 'running' ? (S.events[r.id] || []).map(eventText).filter(Boolean).slice(-1)[0] : '';
    const reply = r.status === 'done' ? r.summary || t('Finished.')
      : r.status === 'running' ? live || t('Working…')
        : r.status === 'queued' ? t('Waiting for a free spot in the team…')
          : r.status === 'failed' ? `${t('Stopped with a problem.')} ${String(r.error || '').split('\n')[0].slice(0, 200)}` : t('Stopped.');
    return `<div class="pair">
      <div class="me"><div dir="auto">${esc(r.input?.text || '')}</div><time>${r.input?.schedule_id ? '⏰ ' : ''}${ago(r.created)}</time></div>
      <div class="them ${r.status}"><span class="who">${ic('team')}${t('Team lead')}${r.status === 'running' ? '<i class="typing"><b></b><b></b><b></b></i>' : ''}</span><div class="body" dir="auto">${fmt(reply)}</div>
        ${['running', 'queued'].includes(r.status) ? `<button class="btn sm ghost" data-stoprun="${r.id}">${t('Stop')}</button>` : ''}</div></div>`;
  }).join('');
}
const schedDays = (s) => (s.days.length === 7 ? t('Every day') : s.days.join() === '0,1,2,3,4' ? t('Sunday to Thursday') : s.days.map((d) => t(DAYN[d])).join(', '));
const schedWhat = (s) => (s.kind === 'search' ? `${t('Find')} ${s.count} ${s.niche}, ${s.city}${s.build ? ` · ${t('demos for the best')} ${s.build}` : ''}` : s.text);
function schedForm() {
  const f = S.schedForm, m = market(f.market_id || S.config.market_id);
  const dayBtns = DAYN.map((d, i) => `<button type="button" class="day ${f.days.includes(i) ? 'on' : ''}" data-day="${i}">${t(d)}</button>`).join('');
  return `<div class="sched-form">
    <div class="seg" id="sKind"><button class="${f.kind === 'search' ? 'on' : ''}" data-kind="search">${ic('search')}${t('Find businesses')}</button><button class="${f.kind === 'ask' ? 'on' : ''}" data-kind="ask">${ic('msg')}${t('An instruction for the team')}</button></div>
    ${f.kind === 'search'
    ? `<div class="form-grid four">
        <label class="field"><span>${t('Kind of business')}</span><select data-f="niche">${m.niches.map((n) => `<option ${n === f.niche ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('City')}</span><select data-f="city">${m.cities.map((c) => `<option ${c === f.city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('How many')}</span><select data-f="count">${[5, 10, 20, 30].map((n) => `<option ${n === +f.count ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Build demos for the best')}</span><select data-f="build">${[0, 1, 2, 3, 5].map((n) => `<option ${n === +f.build ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>`
    : `<label class="field"><span>${t('What should the team do?')}</span><textarea data-f="text" rows="3" dir="auto" placeholder="${t('e.g. Every morning, tell me which businesses are waiting for me')}">${esc(f.text || '')}</textarea></label>`}
    <div class="sched-when"><div class="field"><span>${t('Days')}</span><div class="days">${dayBtns}</div>
        <div class="quick"><button type="button" data-days="0,1,2,3,4,5,6">${t('Every day')}</button><button type="button" data-days="0,1,2,3,4">${t('Sunday to Thursday')}</button></div></div>
      <label class="field"><span>${t('Time')}</span><input type="time" data-f="time" value="${esc(f.time)}"></label></div>
    <div class="row-actions"><button class="btn ghost" id="sCancel">${t('Cancel')}</button><button class="btn primary" id="sSave">${ic('check')}${t('Save the scheduled task')}</button></div></div>`;
}
function schedList() {
  const list = S.config.schedules || [];
  if (!list.length && !S.schedForm) return `<div class="empty"><b>${t('No scheduled tasks')}</b>${t('Let the team search on its own, for example every Sunday at 9:00.')}</div>`;
  return list.map((s) => `<div class="sched ${s.enabled ? '' : 'off'}">
    <label class="tog"><input type="checkbox" data-stog="${s.id}" ${s.enabled ? 'checked' : ''}><span class="sw"></span></label>
    <div class="grow"><b dir="auto">${esc(schedWhat(s))}</b><span>⏰ ${esc(schedDays(s))} · ${esc(s.time)}${s.last_at ? ` · ${t('last ran')} ${ago(s.last_at)}` : ''}</span></div>
    <button class="btn sm outline" data-srun="${s.id}">${ic('play')}${t('Run now')}</button>
    <button class="btn sm ghost" data-sdel="${s.id}" aria-label="${t('Remove')}">${ic('x')}</button></div>`).join('');
}
function viewTasks() {
  return `<div class="page-head"><div><h1>${t('Tasks')}</h1><p>${t('Tell the team what to do in plain words, or set work that repeats on its own.')}</p></div></div>
  <div class="grid" style="gap:16px">
    <section class="card"><div class="card-h"><h2>${t('Ask your team')}</h2><span class="sub">${t('Ctrl + Enter to send')}</span></div><div class="card-b">${composer('askMain')}</div></section>
    <div class="grid cols-2 tasks-cols">
      <section class="card"><div class="card-h"><h2>${t('Your tasks')}</h2></div><div class="card-b thread">${askThread()}</div></section>
      <section class="card"><div class="card-h"><h2>${t('Scheduled tasks')}</h2>${S.schedForm ? '' : `<button class="btn sm dark" id="sNew">+ ${t('New scheduled task')}</button>`}</div>
        <div class="card-b">${S.schedForm ? schedForm() : ''}${schedList()}<p class="muted small" style="margin:12px 0 0">${t('Scheduled tasks run while this computer is on and Jump HQ is open.')}</p></div></section>
    </div>
  </div>`;
}
wire.tasks = () => {
  wireComposer($('#app'));
  for (const r of S.runs.filter((x) => x.agent === 'lead' && x.status === 'running')) if (!S.events[r.id]) req('GET', `/api/runs/${r.id}/events`).then((ev) => { S.events[r.id] = ev; S.lastHtml = null; render(true); }).catch(() => {});
  $$('[data-stoprun]').forEach((b) => (b.onclick = () => act(b, () => req('POST', `/api/runs/${b.dataset.stoprun}/stop`), t('Stopped.'))));
  $('#sNew')?.addEventListener('click', () => { const m = market(S.config.market_id); S.schedForm = { kind: 'search', niche: m.niches[0], city: m.cities[0], count: 10, build: 2, days: [0], time: '09:00', text: '' }; render(); });
  $$('[data-stog]').forEach((c) => (c.onchange = () => act(c, () => req('PUT', `/api/schedules/${c.dataset.stog}`, { enabled: c.checked }), c.checked ? t('Scheduled task on.') : t('Scheduled task paused.'), refresh)));
  $$('[data-srun]').forEach((b) => (b.onclick = () => act(b, () => req('POST', `/api/schedules/${b.dataset.srun}/run`), t('Started.'), refresh)));
  $$('[data-sdel]').forEach((b) => (b.onclick = () => { if (confirm(t('Remove this scheduled task?'))) act(b, () => req('DELETE', `/api/schedules/${b.dataset.sdel}`), t('Removed.'), refresh); }));
  const f = S.schedForm; if (!f) return;
  const keep = () => { $$('[data-f]').forEach((el) => { f[el.dataset.f] = el.value; }); };
  $$('[data-kind]').forEach((b) => (b.onclick = () => { keep(); f.kind = b.dataset.kind; render(); }));
  $$('[data-day]').forEach((b) => (b.onclick = () => { keep(); const d = +b.dataset.day; f.days = f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort(); render(); }));
  $$('[data-days]').forEach((b) => (b.onclick = () => { keep(); f.days = b.dataset.days.split(',').map(Number); render(); }));
  $('#sCancel').onclick = () => { S.schedForm = null; render(); };
  $('#sSave').onclick = (e) => { keep(); act(e.currentTarget, () => req('POST', '/api/schedules', { ...f, count: +f.count, build: +f.build }), t('Saved. The team will do it on time.'), () => { S.schedForm = null; refresh(); }); };
};

/* ------------------------------------------------------- GETTING STARTED */
function startSteps() {
  let seenMap = false; try { seenMap = !!localStorage.getItem('hq_map_seen'); } catch { /* private window */ }
  return [
    ['Find your first businesses', S.leads.length > 0, () => $('#hGo')?.scrollIntoView({ behavior: 'smooth', block: 'center' })],
    ['Ask your team for something', S.runs.some((r) => r.agent === 'lead'), () => go('tasks')],
    ['Approve a demo', S.sites.some((x) => x.public_url), () => go('demos')],
    ['Send your first message', S.approvals.some((a) => a.status === 'sent'), () => go('messages')],
    ['Set a scheduled task', (S.config.schedules || []).length > 0, () => go('tasks')],
    ['Watch the team on the Live map', seenMap, () => go('map')],
  ];
}
function startCard() {
  let hidden = false; try { hidden = localStorage.getItem('hq_start_hidden') === '1'; } catch { /* private window */ }
  const steps = startSteps(), done = steps.filter((s) => s[1]).length;
  if (hidden || done === steps.length) return '';
  return `<section class="card start"><div class="card-h"><h2>${t('Getting started')}</h2><span class="sub">${done} / ${steps.length} ${t('done')}</span><button class="btn sm ghost" data-hidestart>${t('Hide')}</button></div>
    <div class="start-bar"><i style="width:${Math.round((done / steps.length) * 100)}%"></i></div>
    <div class="start-steps">${steps.map(([l, ok], i) => `<button class="step ${ok ? 'ok' : ''}" data-step="${i}"><span class="tick">${ok ? ic('check') : i + 1}</span>${t(l)}</button>`).join('')}</div></section>`;
}

/* ---------------------------------------------------------------- LIVE MAP */
// The 3D street (public/map.js) loads only when this page opens; it stops by itself when the page closes.
function viewMap() {
  return `<div class="mapview"><div class="map-stage" id="mapStage"><div class="mp-empty">${t('Building Pozaka Street…')}</div></div></div>`;
}
const fullEvents = new Set();
wire.map = async () => {
  const stage = $('#mapStage');
  try { localStorage.setItem('hq_map_seen', '1'); } catch { /* private window */ }
  try {
    await Promise.race([Promise.all(['800 40px "Noto Sans Arabic"', '800 40px "Plus Jakarta Sans"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]);
    const m = await import('/map.js');
    if (!stage.isConnected) return;
    m.mount(stage, {
      t, eventText, getState: () => S,
      ensureEvents: (id) => { if (fullEvents.has(id)) return; fullEvents.add(id); req('GET', `/api/runs/${id}/events`).then((ev) => { S.events[id] = ev; }).catch(() => fullEvents.delete(id)); },
    });
  } catch (e) { stage.innerHTML = `<div class="mp-empty">${esc(e.message)}</div>`; }
};

/* --------------------------------------------------------------- SETTINGS */
const SET_TABS = [['general', 'General', 'gear'], ['sleep', 'Sleep mode', 'moon'], ['connections', 'Connections', 'plug'], ['phone', 'Phone app', 'phone'], ['market', 'Market and prices', 'globe'], ['security', 'Security', 'shield']];
function viewSettings() {
  const tab = SET_TABS.find((x) => x[0] === S.setTab) || SET_TABS[0];
  const body = { general: setGeneral, sleep: setSleep, connections: setConnections, phone: setPhone, market: setMarket, security: setSecurity }[tab[0]]();
  return `<div class="page-head"><div><h1>${t('Settings')}</h1><p>${t('Set it once. The team uses these for every search and every message.')}</p></div></div>
  <div class="settings"><nav class="set-nav">${SET_TABS.map(([k, n, i]) => `<button data-st="${k}" class="${k === tab[0] ? 'on' : ''}">${ic(i)}${t(n)}</button>`).join('')}</nav>
  <div class="grid set-body">${body}</div></div>`;
}
const fld = (label, path, val, type = 'text', extra = '') => `<label class="field"><span>${t(label)}</span><input type="${type}" data-p="${path}" value="${esc(val ?? '')}" ${extra}></label>`;
const tog = (label, path, on, sub = '') => `<label class="tog"><input type="checkbox" data-p="${path}" ${on ? 'checked' : ''}><span class="sw"></span><span class="tl"><b>${t(label)}</b>${sub ? `<em>${t(sub)}</em>` : ''}</span></label>`;
const saveBar = () => `<div class="row-actions"><button class="btn primary lg" data-save>${t('Save settings')}</button></div>`;

function setGeneral() {
  const c = S.config;
  return `<section class="card"><div class="card-h"><h2>${t('Language')}</h2></div><div class="card-b">
    <p class="muted" style="margin:0 0 14px">${t('The dashboard, the phone app and everything the team writes for you (notes, reasons, reports) use this language. Messages to businesses always use their own language.')}</p>
    <div class="langs">${LANGS.map((l) => `<label class="lang ${c.ui_language === l.code ? 'on' : ''}"><input type="radio" name="lang" data-p="ui_language" value="${l.code}" ${c.ui_language === l.code ? 'checked' : ''}><b ${l.rtl ? 'dir="rtl"' : ''}>${l.name}</b><span>${l.en}</span></label>`).join('')}</div></div></section>
  <section class="card"><div class="card-h"><h2>${t('Your company')}</h2></div><div class="card-b form-grid">
    ${fld('Company name', 'company.name', c.company.name)}${fld('Website', 'company.website', c.company.website)}
    ${fld('Your name (used to sign messages)', 'company.sender_name', c.company.sender_name)}${fld('Your email', 'company.sender_email', c.company.sender_email)}
    <label class="field" style="grid-column:1/-1"><span>${t('Email signature')}</span><textarea data-p="company.signature" rows="3">${esc(c.company.signature)}</textarea></label></div></section>
  <section class="card"><div class="card-h"><h2>${t('How picky the team is')}</h2></div><div class="card-b form-grid">
    ${fld('Build a demo at this score or higher', 'qualify.threshold', c.qualify.threshold, 'number')}${fld('Keep for later from this score', 'qualify.hold', c.qualify.hold, 'number')}
    ${fld('Most messages per day', 'outreach.daily_send_cap', c.outreach.daily_send_cap, 'number')}${fld('Most agent jobs per day', 'limits.daily_runs', c.limits.daily_runs, 'number')}</div></section>
  ${saveBar()}`;
}

function setSleep() {
  const sl = S.config.sleep;
  const m = market(S.config.market_id);
  return `<section class="card sleep-hero ${S.mode === 'sleep' ? 'on' : ''}"><div class="night-ic">${ic('moon')}</div><div class="grow"><h2>${S.mode === 'sleep' ? t('Sleep mode is on') : t('Sleep mode is off')}</h2>
      <p>${t('In Sleep mode the team keeps working without you. Before anything leaves, an independent AI Judge checks it against what we really know about the business. Safe work goes out; anything risky waits for you in the morning.')}</p></div>
      <button class="btn ${S.mode === 'sleep' ? '' : 'dark'}" data-mode-btn="${S.mode === 'sleep' ? 'awake' : 'sleep'}">${ic(S.mode === 'sleep' ? 'sun' : 'moon')}${S.mode === 'sleep' ? t('Wake up') : t('Sleep now')}</button></section>
  <section class="card"><div class="card-h"><h2>${t('When')}</h2></div><div class="card-b grid" style="gap:14px">
    ${tog('Go to sleep by itself every night', 'sleep.schedule', sl.schedule, 'Switches to Sleep mode at the start time and back to Awake at the end time.')}
    <div class="form-grid">${fld('From', 'sleep.from', sl.from, 'time')}${fld('Until', 'sleep.to', sl.to, 'time')}</div></div></section>
  <section class="card"><div class="card-h"><h2>${t('What the team may do alone')}</h2></div><div class="card-b grid" style="gap:14px">
    ${tog('Put Judge-approved demos online', 'sleep.auto_publish', sl.auto_publish, 'The demo gets a public link and the first message is written.')}
    ${tog('Send Judge-approved emails', 'sleep.auto_send', sl.auto_send, 'Needs automatic email in Connections. WhatsApp messages are approved and wait for one tap from you.')}
    ${tog('Judge gives a second opinion in Awake mode too', 'sleep.second_opinion', sl.second_opinion, 'You see its score and reasons next to every demo and message.')}
    <div class="form-grid">${fld('The Judge must give at least (out of 100)', 'sleep.judge_min_score', sl.judge_min_score, 'number', 'min="50" max="100"')}${fld('Most messages sent per night', 'sleep.max_sends', sl.max_sends, 'number', 'min="0" max="50"')}</div>
    <p class="muted small" style="margin:0">${t('Always held for you: anything the Judge is unsure about, anything medium or high risk, wrong contact details, missing demo link, invented facts.')}</p></div></section>
  <section class="card"><div class="card-h"><h2>${t('Night plan')}</h2><span class="sub">${t('Searches the team runs while you sleep, one after another')}</span></div><div class="card-b grid" style="gap:10px">
    <div id="plan">${(sl.searches || []).map((x, i) => planRow(x, i, m)).join('')}</div>
    <div><button class="btn outline sm" id="planAdd">+ ${t('Add a search')}</button></div></div></section>
  ${saveBar()}`;
}
const planRow = (x, i, m) => `<div class="plan-row" data-row="${i}"><select data-pk="count">${[5, 10, 20, 30].map((n) => `<option ${n === +x.count ? 'selected' : ''}>${n}</option>`).join('')}</select>
  <select data-pk="niche">${(m.niches || []).map((n) => `<option ${n === x.niche ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
  <span class="muted">${t('in')}</span><select data-pk="city">${(m.cities || []).map((c) => `<option ${c === x.city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
  <span class="muted">${t('demos')}</span><select data-pk="build">${[1, 3, 5].map((n) => `<option ${n === +x.build ? 'selected' : ''}>${n}</option>`).join('')}</select>
  <button class="btn ghost sm" data-del="${i}" title="${t('Remove')}">${ic('x')}</button></div>`;

function connCard(key, icon, title, desc, status, body, steps) {
  const st = status === true ? ['good', t('Connected')] : status === 'manual' ? ['info', t('Manual')] : status === 'starting' ? ['warn', t('Starting…')] : ['', t('Not connected')];
  return `<section class="card conn"><div class="conn-h"><span class="conn-ic">${ic(icon)}</span><div class="grow"><h2>${t(title)}</h2><p>${t(desc)}</p></div><span class="badge ${st[0]}">${st[1]}</span></div>
    ${body ? `<div class="card-b" style="padding-top:4px">${body}</div>` : ''}
    ${steps ? `<details class="steps"><summary>${t('How to connect')}</summary><ol>${steps.map((x) => `<li>${t(x)}</li>`).join('')}</ol></details>` : ''}
    <div class="conn-f"><button class="btn sm outline" data-test="${key}">${t('Test')}</button>${['email', 'telegram', 'brain', 'whatsapp'].includes(key) ? `<button class="btn sm primary" data-save>${t('Save')}</button>` : ''}</div></section>`;
}
function setConnections() {
  const c = S.config, k = S.conns;
  if (!k) { loadConns(); return `<div class="card empty"><b>${t('Checking your connections…')}</b></div>`; }
  const models = [['sonnet', 'Claude Sonnet (best balance)'], ['opus', 'Claude Opus (smartest, slower)'], ['haiku', 'Claude Haiku (fastest, cheapest)']];
  return `<div class="conns">
  ${connCard('brain', 'team', 'AI brain', 'The model your team thinks with. Runs on your Claude plan on this computer.', k.brain.ok, `<div class="form-grid"><label class="field"><span>${t('Model')}</span><select data-p="limits.model">${models.map(([v, n]) => `<option value="${v}" ${c.limits.model === v ? 'selected' : ''}>${t(n)}</option>`).join('')}</select></label><div class="field"><span>${t('Status')}</span><div class="muted" style="padding-top:9px">${esc(k.brain.detail)}</div></div></div>`, ['Install Claude Code on this computer.', 'Open a terminal and run: claude', 'Sign in with your Claude account. Done.'])}
  ${connCard('email', 'send', 'Email sending', 'Send approved emails from your own address, by itself.', k.email.ok ? true : 'manual', `<div class="form-grid"><label class="field" style="grid-column:1/-1"><span>${t('When an email is approved')}</span><select data-p="outreach.sender"><option value="manual" ${c.outreach.sender === 'manual' ? 'selected' : ''}>${t('I send it myself from my mailbox')}</option><option value="smtp" ${c.outreach.sender === 'smtp' ? 'selected' : ''}>${t('Send it automatically')}</option></select></label>
    ${fld('Mail server', 'smtp.host', c.smtp.host)}${fld('Port', 'smtp.port', c.smtp.port, 'number')}${fld('Username', 'smtp.user', c.smtp.user)}${fld('Password', 'smtp.pass', c.smtp.pass, 'password')}</div>`, ['Zoho: Settings → Security → App passwords → create one.', 'Mail server smtp.zoho.com, port 465.', 'Username = your full email, Password = the app password. Press Test.'])}
  ${connCard('whatsapp', 'msg', 'WhatsApp', 'Approved WhatsApp messages open in your own WhatsApp, ready to send with one tap. Nothing is sent from a stranger number.', true, `<div class="form-grid">${fld('Country code for local numbers', 'markets.krd.phone_prefix', market('krd').phone_prefix)}</div>`, null)}
  ${connCard('telegram', 'alert', 'Telegram alerts', 'Get a ping on your phone when something needs you, and a morning report after Sleep mode.', k.telegram.ok, `<div class="form-grid">${fld('Bot token', 'connections.telegram.token', c.connections.telegram.token, 'password')}${fld('Chat ID (found by itself)', 'connections.telegram.chat_id', c.connections.telegram.chat_id)}</div>`, ['In Telegram, open @BotFather and send /newbot.', 'Pick a name. Copy the token it gives you and paste it here.', 'Open your new bot and press Start.', 'Press Save, then Test. The chat ID is found by itself.'])}
  ${connCard('publish', 'globe', 'Demo publishing', 'Approved demos go online for free on GitHub Pages, so businesses can open them.', k.publish.ok, `<div class="muted">${esc(k.publish.detail)} ${t('Repository')}: <b>${esc(k.publish.repo)}</b></div>`, ['Sign in to GitHub once with git on this computer.', 'The first publish creates the repository by itself.'])}
  ${connCard('phone', 'phone', 'Phone app', 'Control everything from your phone, anywhere, through a private secure link.', k.phone.ok ? true : k.phone.status === 'starting' ? 'starting' : false, `<div class="muted">${k.phone.url ? `${t('Public link')}: <b>${esc(k.phone.url)}</b><br>` : ''}${k.phone.devices} ${t('phones paired')}. <a href="#/settings" data-st-go="phone">${t('Pair a phone')}</a></div>`, null)}
  </div>`;
}
async function loadConns() { try { S.conns = await req('GET', '/api/connections'); if (route() === 'settings') { S.lastHtml = null; render(); } } catch (e) { toast(e.message, 'err'); } }

function setPhone() {
  return `<section class="card phone-pair"><div class="pair-qr" id="pairQr"><div class="empty">${t('Press "Show pairing code" to connect a phone.')}</div></div>
    <div class="grow"><h2>${t('Control the team from your phone')}</h2>
    <ol class="pair-steps"><li>${t('Install the Jump HQ app on your phone.')}</li><li>${t('Open it and tap "Scan pairing code".')}</li><li>${t('Point the camera at the code on this screen. Done.')}</li></ol>
    <p class="muted small">${t('The code works once and expires after 10 minutes. The phone gets its own key; your password never leaves this computer. It works on Wi-Fi and mobile data.')}</p>
    <div class="row-actions"><button class="btn primary" id="pairGo">${ic('phone')}${t('Show pairing code')}</button></div><div id="pairCode"></div></div></section>
  <section class="card"><div class="card-h"><h2>${t('Paired phones')}</h2></div><div class="card-b" id="devList"><span class="muted">${t('Loading…')}</span></div></section>`;
}
function setMarket() {
  const c = S.config, m = market(S.market);
  return `<section class="card"><div class="card-h"><h2>${t('Market and prices')}</h2>
      <select id="sMarket" style="width:auto">${Object.values(c.markets).map((x) => `<option value="${x.id}" ${x.id === S.market ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
    <div class="card-b form-grid">
    <label class="field"><span>${t('Default market for new searches')}</span><select data-p="market_id">${Object.values(c.markets).map((x) => `<option value="${x.id}" ${x.id === c.market_id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
    <label class="field"><span>${t('How we reach businesses')}</span><select data-p="markets.${m.id}.channel"><option value="whatsapp" ${m.channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option><option value="email" ${m.channel === 'email' ? 'selected' : ''}>${t('Email')}</option></select></label>
    ${fld(`${t('Website price')} (${m.currency})`, `markets.${m.id}.build_price`, m.build_price, 'number')}${fld(`${t('Care plan per month')} (${m.currency})`, `markets.${m.id}.monthly_price`, m.monthly_price, 'number')}
    ${fld('Language of messages', `markets.${m.id}.language`, m.language)}${fld('Country', `markets.${m.id}.country`, m.country)}
    <label class="field" style="grid-column:1/-1"><span>${t('Cities')}</span><input data-p="markets.${m.id}.cities" data-list value="${esc(m.cities.join(', '))}"><em>${t('Separate with commas.')}</em></label>
    <label class="field" style="grid-column:1/-1"><span>${t('Kinds of business')}</span><input data-p="markets.${m.id}.niches" data-list value="${esc(m.niches.join(', '))}"></label>
    <label class="field" style="grid-column:1/-1"><span>${t('What we offer (one or two sentences)')}</span><textarea data-p="offer.pitch" rows="3">${esc(c.offer.pitch)}</textarea></label></div></section>
  ${saveBar()}`;
}
const PROTECT = [
  'Nothing leaves without you or the Judge: no agent can send a message or publish by itself.',
  'Agents have no access to your files or terminal, only to their own working folder.',
  'Phones get their own key that you can remove any time; the password is never stored on the phone.',
  "The public link only opens the dashboard; the agents' private connection is blocked from the internet.",
  'Five wrong passwords lock sign-in for a minute.',
];
function setSecurity() {
  return `<section class="card"><div class="card-h"><h2>${t('Password')}</h2></div><div class="card-b form-grid">
    <label class="field"><span>${t('Current password')}</span><input type="password" id="pwOld"></label><label class="field"><span>${t('New password')}</span><input type="password" id="pwNew" minlength="8"></label>
    <div class="row-actions"><button class="btn" id="pwGo">${t('Change password')}</button><button class="btn ghost" id="logout">${t('Sign out')}</button></div></div></section>
  <section class="card"><div class="card-h"><h2>${t('How your workspace is protected')}</h2></div><div class="card-b"><ul class="clean">${PROTECT.map((x) => `<li><span class="ok-ic">${ic('check')}</span><div>${t(x)}</div></li>`).join('')}</ul></div></section>`;
}

function collect(scope = document) {
  const patch = {};
  for (const el of $$('[data-p]', scope)) {
    if (el.type === 'radio' && !el.checked) continue;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = Number(v);
    if (el.dataset.list !== undefined) v = v.split(',').map((x) => x.trim()).filter(Boolean);
    const keys = el.dataset.p.split('.');
    let o = patch;
    keys.slice(0, -1).forEach((k) => (o = o[k] ||= {}));
    o[keys.at(-1)] = v;
  }
  if ($('#plan', scope)) patch.sleep = { ...(patch.sleep || {}), searches: $$('.plan-row', scope).map((r) => Object.fromEntries($$('[data-pk]', r).map((x) => [x.dataset.pk, ['count', 'build'].includes(x.dataset.pk) ? +x.value : x.value]))) };
  return patch;
}
async function saveSettings(btn) {
  const before = S.config.ui_language;
  await act(btn, () => req('PUT', '/api/settings', collect()), t('Settings saved.'));
  S.conns = null;
  if (S.config.ui_language !== before) location.reload();
  else if (S.setTab === 'connections') loadConns();
}
wire.settings = () => {
  $$('[data-st]').forEach((b) => (b.onclick = () => { S.setTab = b.dataset.st; S.lastHtml = null; render(); }));
  $$('[data-st-go]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); S.setTab = b.dataset.stGo; S.lastHtml = null; render(); }));
  $$('[data-save]').forEach((b) => (b.onclick = () => saveSettings(b)));
  $$('.lang input').forEach((r) => (r.onchange = () => $$('.lang').forEach((x) => x.classList.toggle('on', x.contains(r)))));
  $('[data-mode-btn]')?.addEventListener('click', (e) => setMode(e.currentTarget.dataset.modeBtn));
  $('#sMarket')?.addEventListener('change', (e) => { S.market = e.target.value; render(); });
  const m = market(S.config.market_id);
  const wirePlan = () => $$('[data-del]').forEach((b) => (b.onclick = () => b.closest('.plan-row').remove()));
  $('#planAdd')?.addEventListener('click', () => { const i = $$('.plan-row').length; $('#plan').insertAdjacentHTML('beforeend', planRow({ count: 10, niche: m.niches[0], city: m.cities[0], build: 3 }, i, m)); wirePlan(); });
  wirePlan();
  $$('[data-test]').forEach((b) => (b.onclick = async () => {
    const which = b.dataset.test;
    if (['email', 'telegram'].includes(which)) await req('PUT', '/api/settings', collect(b.closest('.conn'))).catch(() => {});
    const r = await act(b, () => req('POST', '/api/connections/test', { which }));
    if (r?.message) toast(r.message);
    S.conns = null; loadConns();
  }));
  $('#pwGo')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', '/api/password', { current: $('#pwOld').value, next: $('#pwNew').value }), t('Password changed.')));
  $('#logout')?.addEventListener('click', async () => { await req('POST', '/api/logout'); boot(); });
  if ($('#devList')) loadDevices();
  $('#pairGo')?.addEventListener('click', async (e) => {
    const r = await act(e.currentTarget, () => req('POST', '/api/pair'));
    if (!r) return;
    $('#pairQr').innerHTML = r.svg;
    $('#pairCode').innerHTML = r.url ? `<div class="pair-meta"><span>${t('Or type this code in the app')}:</span><b class="code">${r.code}</b><span class="muted small">${esc(r.url)}</span></div>` : `<div class="badge warn">${t('No public link yet. Check Connections → Phone app.')}</div>`;
  });
};
async function loadDevices() {
  const list = await req('GET', '/api/devices').catch(() => []);
  const el = $('#devList'); if (!el) return;
  el.innerHTML = list.length ? list.map((d) => `<div class="dev"><span class="conn-ic">${ic('phone')}</span><div class="grow"><b>${esc(d.name)}</b><span class="muted small">${t('Paired')} ${ago(new Date(d.created).toISOString())} · ${t('last seen')} ${ago(new Date(d.seen).toISOString())}</span></div><button class="btn sm ghost danger" data-unpair="${d.id}">${t('Remove')}</button></div>`).join('') : `<span class="muted">${t('No phones yet.')}</span>`;
  $$('[data-unpair]', el).forEach((b) => (b.onclick = () => { if (confirm(t('Remove this phone? It will need to be paired again.'))) act(b, () => req('DELETE', `/api/devices/${b.dataset.unpair}`), t('Phone removed.')).then(loadDevices); }));
}

boot();
