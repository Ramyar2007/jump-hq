// Jump HQ: find local businesses that need a website, prove it with a free demo, win them as clients.
// No framework: one state object, hash routes, re-render on change. Live updates over a WebSocket.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = document.getElementById('root');

const S = { config: null, agents: [], leads: [], approvals: [], runs: [], sites: [], activity: [], hunts: [], runner: null, stats: null, events: {}, lead: null, msgTab: 'pending', filter: 'all', q: '', market: null, ws: null };

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
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = text;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), kind === 'err' ? 7000 : 3500);
}
async function act(btn, fn, done) {
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = 'Working…'; }
  try { const r = await fn(); if (done) toast(done); await refresh(); return r; }
  catch (e) { toast(e.message, 'err'); }
  finally { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = label; } }
}
const ago = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 50) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
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
  if (w) return { text: w.status === 'running' ? `${agentName(w.agent)} working…` : `Waiting for the ${agentName(w.agent)}`, tone: 'info' };
  const site = siteOf(l);
  return ({
    new: { text: 'Found', tone: '' },
    profiled: { text: 'Checked', tone: '' },
    qualified: { text: 'Worth building', tone: 'accent' },
    planned: { text: 'Plan ready', tone: 'accent' },
    approved: { text: 'Ready to build', tone: 'accent' },
    hold: { text: 'On hold', tone: 'warn' },
    skipped: { text: 'Not a fit', tone: '' },
    demo_built: { text: site?.public_url ? 'Demo online' : 'Demo ready for you', tone: 'good' },
    email_drafted: { text: 'Message waiting for you', tone: 'good' },
    sent: { text: 'Contacted', tone: 'info' },
    replied: { text: 'Talking', tone: 'info' },
    won: { text: 'Client', tone: 'good' },
    lost: { text: 'Said no', tone: 'bad' },
  })[l.stage] || { text: l.stage, tone: '' };
}
function nextStep(l) {
  if (workingOn(l)) return null;
  const site = siteOf(l);
  if (l.stage === 'demo_built' && site && !site.public_url) return { label: 'Review demo', icon: 'eye', run: () => openPreview(site, l) };
  if (['approved', 'hold'].includes(l.stage) && !site) return { label: 'Build demo', icon: 'build', run: (b) => act(b, () => req('POST', `/api/leads/${l.id}/build`), `Building a demo for ${l.business}.`) };
  if (l.stage === 'email_drafted') return { label: 'Open message', icon: 'msg', run: () => { S.msgTab = 'pending'; go('messages'); } };
  if (l.stage === 'sent') return { label: 'They replied', icon: 'reply', run: () => openReply(l) };
  return null;
}
const AV = ['#e4572e', '#2a9d8f', '#1d4ed8', '#0f8a5f', '#c2410c', '#0e7490', '#b45309', '#334155', '#be123c', '#4d7c0f'];
const avatar = (l) => { const n = l.business || '?'; let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `<span class="av" style="background:${AV[h % AV.length]}">${esc(n.replace(/^(the|al|el)\s+/i, '').trim()[0]?.toUpperCase() || '?')}</span>`; };
const ring = (l) => {
  const o = l.opportunity;
  if (!o) return '<span class="ring none" title="Not scored yet"><b>–</b></span>';
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
  if (!s.authed) return renderAuth(s.needsSetup);
  await refresh(true);
  connect();
  addEventListener('hashchange', render);
  render();
}

function renderAuth(setup) {
  root.innerHTML = `<div class="auth"><div class="auth-side"><div class="logo"><i>J</i>Jump</div>
      <div><h2>Find local businesses that need a website, and win them as clients.</h2><p>An AI team searches, checks and scores businesses, builds free demo websites for the best ones, and writes the first message. You approve everything.</p></div><span class="small" style="color:#8394b5">jumpagency.org</span></div>
    <div class="auth-main"><div class="card"><h1>${setup ? 'Welcome' : 'Welcome back'}</h1>
      <p>${setup ? 'Create a password to protect your workspace.' : 'Sign in to your workspace.'}</p>
      <form id="authf"><label class="field"><span>Password</span><input type="password" id="pw" autocomplete="${setup ? 'new-password' : 'current-password'}" required minlength="${setup ? 8 : 1}"></label>
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
    Object.assign(S, { config: d.config, agents: d.agents, leads: d.leads, approvals: d.approvals, runs: d.runs, sites: d.sites, activity: d.activity, hunts: d.hunts || [], runner: d.runner, stats: d.stats });
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
    else if (msg.type === 'stats') { S.stats = msg.stats; }
    else if (msg.type === 'run_event') { (S.events[msg.run_id] ||= []).push(msg.event); liveEvent(msg.run_id, msg.event); }
    else if (msg.type === 'change') { if (msg.kind === 'activity') { S.activity.unshift(msg.payload); liveActivity(msg.payload); } soon(); }
  };
  ws.onclose = () => setTimeout(connect, 2500);
}

/* ------------------------------------------------------------------ shell */
const VIEWS = [['home', 'Home', 'home'], ['prospects', 'Businesses', 'users'], ['demos', 'Demos', 'monitor'], ['messages', 'Messages', 'msg'], ['team', 'AI team', 'team'], ['settings', 'Settings', 'gear']];
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
  const fn = { home: viewHome, prospects: viewProspects, demos: viewDemos, messages: viewMessages, team: viewTeam, settings: viewSettings }[v] || viewHome;
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
  $('#nav').innerHTML = VIEWS.map(([k, t, i]) => `<a href="#/${k}" class="navl ${route() === k ? 'on' : ''}">${ic(i)}${t}${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('');
  const r = S.runner || {};
  const run = S.runs.find((x) => x.status === 'running');
  $('#status').innerHTML = r.paused
    ? `<div class="line"><span class="dot warn"></span>Team paused</div><div class="why">${esc(r.pauseReason || '')}</div><button class="btn primary sm" id="resume">${ic('play')}Resume</button>`
    : run ? `<div class="line"><span class="dot busy"></span>${esc(agentName(run.agent))} is working</div><div class="why">${esc(run.title.split(' · ').slice(1).join(' · '))}</div>`
      : `<div class="line"><span class="dot on"></span>Team ready</div><div class="why">${S.runner?.today ?? 0} jobs today</div>`;
  $('#resume')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', '/api/runner/resume'), 'The team is back at work.'));
}

/* ------------------------------------------------------------------- HOME */
function needsYou() {
  const items = [];
  for (const l of S.leads) {
    const site = siteOf(l);
    if (l.stage === 'demo_built' && site && !site.public_url && !workingOn(l)) items.push({ icon: 'eye', title: `Look at the demo for ${l.business}`, sub: `${l.opportunity ? `${l.opportunity.score}/100 · ` : ''}approve it and the first message gets written`, btn: 'Review', run: () => openPreview(site, l) });
  }
  for (const a of S.approvals.filter((x) => x.status === 'pending')) items.push({ icon: 'msg', title: a.title, sub: `${a.type === 'whatsapp' ? 'WhatsApp' : a.type === 'email' ? 'Email' : 'Request'} · written ${ago(a.created)}`, btn: 'Read & approve', run: () => { S.msgTab = 'pending'; go('messages'); } });
  for (const a of S.approvals.filter((x) => x.status === 'approved' && ['email', 'whatsapp'].includes(x.type))) items.push({ icon: 'send', title: `Send the message to ${S.leads.find((l) => l.id === a.lead_id)?.business || a.to}`, sub: 'approved, not sent yet', btn: 'Send', run: () => { S.msgTab = 'ready'; go('messages'); } });
  for (const h of S.hunts.filter((x) => x.status === 'running' && !x.working && !x.queued)) items.push({ icon: 'play', title: `Finish the search for ${h.niche} in ${h.city}`, sub: 'it stopped half-way', btn: 'Continue', run: (b) => act(b, () => req('POST', `/api/hunts/${h.id}/continue`), 'Search continued.') });
  if (S.runner?.paused) items.unshift({ icon: 'pause', title: 'The team is paused', sub: S.runner.pauseReason || '', btn: 'Resume', run: (b) => act(b, () => req('POST', '/api/runner/resume'), 'Resumed.') });
  return items;
}

function viewHome() {
  const m = market(S.market);
  const hunt = S.hunts[0];
  const st = S.stats || {};
  const todo = needsYou();
  const hr = new Date().getHours();
  return `
  <div class="page-head"><div><h1>Good ${hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening'}${S.config.company.sender_name ? `, ${esc(S.config.company.sender_name)}` : ''}</h1>
    <p>${todo.length ? `${todo.length} thing${todo.length > 1 ? 's' : ''} need${todo.length > 1 ? '' : 's'} you. Everything else is handled.` : 'You are all caught up.'}</p></div></div>

  <div class="grid" style="gap:16px">
    <section class="card finder">
      <h2>Find new clients</h2>
      <p>Choose what to look for. The team finds the businesses, checks them, and builds free demo websites for the best ones.</p>
      <div class="picks">
        <label class="pickbox"><small>How many</small><select id="hCount">${[5, 10, 20, 30].map((n) => `<option ${n === 10 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="pickbox wide"><small>Kind of business</small><select id="hNiche">${(m.niches || []).map((n) => `<option>${esc(n[0].toUpperCase() + n.slice(1))}</option>`).join('')}</select></label>
        <label class="pickbox"><small>City</small><select id="hCity">${(m.cities || []).map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        <button class="btn primary lg" id="hGo">${ic('search')}Start search</button>
      </div>
      <div class="finder-foot">
        <label>Build demos for the best <select id="hBuild">${[1, 3, 5, 10].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Market <select id="hMarket">${Object.values(S.config.markets).map((x) => `<option value="${x.id}" ${x.id === S.market ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
        <span>Messages go by ${m.channel === 'whatsapp' ? 'WhatsApp' : 'email'} in ${esc(m.language)}, only after you approve.</span>
      </div>
    </section>

    ${hunt ? huntCard(hunt) : ''}

    <div class="grid cols-2">
      <section class="card"><div class="card-h"><h2>Needs you</h2><span class="sub">${todo.length ? `${todo.length} to do` : ''}</span></div>
        <div style="padding:8px 0 6px">${todo.length ? todo.map((t, i) => `<div class="todo"><span class="ico ${i === 0 ? 'hot' : ''}">${ic(t.icon)}</span><div class="t"><b>${esc(t.title)}</b><span>${esc(t.sub)}</span></div><button class="btn sm ${i === 0 ? 'dark' : ''}" data-todo="${i}">${t.btn}</button></div>`).join('') : '<div class="empty"><b>Nothing waiting</b>New demos and messages will show up here.</div>'}</div></section>
      <section class="card"><div class="card-h"><h2>What the team did</h2><a class="small" href="#/team">See all</a></div>
        <div class="feed" id="homeFeed" style="max-height:330px;margin-top:8px">${S.activity.slice(0, 9).map(feedRow).join('') || '<div class="empty">Nothing yet. Start a search above.</div>'}</div></section>
    </div>

    <div class="kpis">
      ${kpi('Businesses checked', st.leads ?? 0)}${kpi('Demos built', st.demos ?? 0)}${kpi('Messages sent', st.sentTotal ?? 0)}${kpi('Clients', st.won ?? 0)}${kpi('Monthly income', st.mrr ? money(st.mrr) : '0')}
    </div>
  </div>`;
}
const kpi = (k, v) => `<div class="card kpi"><div class="v">${v}</div><div class="k">${k}</div></div>`;

function huntCard(h) {
  const f = h.funnel;
  const steps = [['found', 'Found'], ['verified', 'Verified'], ['worth', 'Worth considering'], ['high', 'High value'], ['approved', 'Approved to build'], ['demos', 'Demos built']];
  const max = Math.max(1, f.found);
  const w = h.working;
  const now = h.status === 'running'
    ? (w ? `<span class="dot busy"></span><span class="grow">${agentName(w.agent)} ${AGENT_VERB[w.agent] || 'is working'}${h.queued ? ` · ${h.queued} more step${h.queued > 1 ? 's' : ''} lined up` : ''}</span><button class="btn sm ghost" id="hStop">Stop</button>` : '<span class="dot warn"></span><span class="grow">Waiting to continue</span>')
    : `<span class="dot ${h.status === 'done' ? 'on' : ''}"></span><span class="grow">${h.status === 'done' ? `Finished ${ago(h.ended)}` : 'Stopped'}. ${f.demos ? `${f.demos} demo${f.demos > 1 ? 's' : ''} ready for you.` : ''}</span>${f.found ? '<a class="btn sm dark" href="#/prospects">See the businesses</a>' : ''}`;
  return `<section class="card"><div class="card-h"><h2>${h.status === 'running' ? 'Searching' : 'Last search'}: ${esc(h.niche)} in ${esc(h.city)}</h2>${h.status === 'running' ? '<span class="live">● live</span>' : `<span class="sub">${ago(h.created)} · looked for ${h.target}</span>`}</div>
    <div class="card-b"><div class="funnel">${steps.map(([k, t], i) => `<div class="fstep ${i === steps.length - 1 && f[k] ? 'hot' : ''}"><div class="n">${f[k] ?? 0}</div><div class="l">${t}</div><div class="bar" style="width:${Math.round(((f[k] ?? 0) / max) * 100)}%"></div></div>`).join('')}</div>
    <div class="now ${h.status === 'running' && w ? '' : 'idle'}">${now}</div></div></section>`;
}

const wire = {};
wire.home = () => {
  const todo = needsYou();
  $$('[data-todo]').forEach((b) => (b.onclick = () => todo[+b.dataset.todo].run(b)));
  $('#hMarket').onchange = (e) => { S.market = e.target.value; render(); };
  $('#hGo').onclick = (e) => act(e.currentTarget, () => req('POST', '/api/hunts', { market_id: S.market, city: $('#hCity').value, niche: $('#hNiche').value, count: +$('#hCount').value, build: +$('#hBuild').value }), 'Search started. You can close this page, the team keeps working.');
  $('#hStop')?.addEventListener('click', (e) => { if (confirm('Stop this search? Work already done is kept.')) act(e.currentTarget, () => req('POST', `/api/hunts/${S.hunts[0].id}/stop`), 'Search stopped.'); });
};

/* -------------------------------------------------------------- PROSPECTS */
const FILTERS = [
  ['all', 'All', () => true],
  ['worth', 'Worth building', (l) => ['qualified', 'planned', 'approved'].includes(l.stage)],
  ['you', 'Waiting for you', (l) => ['demo_built', 'email_drafted'].includes(l.stage)],
  ['contacted', 'Contacted', (l) => ['sent', 'replied'].includes(l.stage)],
  ['clients', 'Clients', (l) => l.stage === 'won'],
  ['hold', 'On hold', (l) => l.stage === 'hold'],
  ['skipped', 'Not a fit', (l) => ['skipped', 'lost'].includes(l.stage)],
];
function viewProspects() {
  const f = FILTERS.find((x) => x[0] === S.filter) || FILTERS[0];
  const q = S.q.toLowerCase();
  const list = S.leads.filter(f[2]).filter((l) => !q || `${l.business} ${l.business_local} ${l.city} ${l.area} ${l.niche}`.toLowerCase().includes(q))
    .sort((a, b) => (b.opportunity?.score ?? -1) - (a.opportunity?.score ?? -1) || b.updated.localeCompare(a.updated));
  return `<div class="page-head"><div><h1>Businesses</h1><p>Everyone the team found, best first. Click a business to see the full profile and why.</p></div></div>
  <div class="toolbar"><div class="seg">${FILTERS.map(([k, t, fn]) => `<button data-f="${k}" class="${S.filter === k ? 'on' : ''}">${t}<em>${S.leads.filter(fn).length}</em></button>`).join('')}</div>
    <input id="q" placeholder="Search by name or area" value="${esc(S.q)}"></div>
  <div class="card">${list.length ? `<div class="blist">${list.map((l) => {
    const st = statusOf(l);
    const nx = nextStep(l);
    const why = l.opportunity?.summary || l.reason || (l.issues || []).join(' · ') || l.notes || '';
    return `<div class="brow" data-lead="${l.id}">${avatar(l)}<div class="t"><b>${esc(l.business)}${l.business_local ? ` <span class="rtl" style="display:inline;font-weight:600;color:var(--muted)">${esc(l.business_local)}</span>` : ''}</b><span>${esc([l.niche, [l.area, l.city].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}${why ? ` · ${esc(why)}` : ''}</span></div>
      <div class="s">${ring(l)}<span class="badge ${st.tone}">${esc(st.text)}</span></div>
      <div class="a">${nx ? `<button class="btn sm ${nx.label === 'Review demo' ? 'primary' : 'outline'}" data-next="${l.id}">${ic(nx.icon)}${nx.label}</button>` : ''}</div></div>`;
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
    <div class="links">${link(l.website, hostOf(l.website))}${link(l.socials?.instagram, 'Instagram')}${link(l.socials?.facebook, 'Facebook')}${link(l.socials?.tiktok, 'TikTok')}${link(l.maps_url, 'Map')}${l.phone ? `<span>${esc(l.phone)}</span>` : ''}${l.whatsapp && l.whatsapp !== l.phone ? `<span>WhatsApp ${esc(l.whatsapp)}</span>` : ''}${l.email ? `<span>${esc(l.email)}</span>` : ''}</div></div><button class="x" title="Close">×</button>
  </div>
  <div class="drawer-b">
    ${o ? `<section class="card card-b sec"><h3>Recommendation</h3><div class="reco"><div class="big-score ${cls}" style="--p:${o.score}"><div><b>${o.score}</b><span>of 100</span></div></div>
      <div><h4>${label}</h4><div class="meta-row">${o.confidence != null ? `<span class="badge">Confidence ${o.confidence}%</span>` : ''}${rv ? `<span class="badge ${rv.verdict === 'approve' ? 'good' : rv.verdict === 'hold' ? 'warn' : 'bad'}">Reviewer: ${{ approve: 'approved', hold: 'on hold', reject: 'rejected' }[rv.verdict]}</span>` : ''}</div>
      ${o.summary ? `<p>${esc(o.summary)}</p>` : ''}</div></div>
      ${o.reasons?.length ? `<h3 style="margin-top:16px">Why</h3><ul class="clean">${o.reasons.map((r) => `<li><span class="ok-ic">${ic('check')}</span><div>${esc(r.point || r)}${r.evidence ? `<span class="ev">${esc(r.evidence)}</span>` : ''}</div></li>`).join('')}</ul>` : ''}
      ${o.risks?.length ? `<h3 style="margin-top:14px">Risks</h3><ul class="clean">${o.risks.map((r) => `<li><span style="color:var(--warn)">${ic('alert')}</span><div>${esc(r)}</div></li>`).join('')}</ul>` : ''}
    </section>` : ''}

    ${plan ? `<section class="card card-b sec"><h3>What we'll build</h3><h4 style="font-size:16px">${esc(plan.product)}</h4><p class="muted" style="margin:4px 0 12px">${esc(plan.why)}</p>
      <dl class="kv"><dt>Main button</dt><dd>${esc(plan.primary_action)}</dd><dt>Languages</dt><dd>${esc((plan.languages || []).join(' + '))}</dd><dt>Look and feel</dt><dd>${esc(plan.style)}</dd></dl>
      <div class="chips" style="margin-top:12px">${(plan.must_have || []).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div></section>` : ''}

    ${site ? `<section class="card sec" style="overflow:hidden"><div class="demo"><div class="shot" data-preview>${site ? `<iframe loading="lazy" scrolling="no" src="${esc(site.local_url)}" tabindex="-1"></iframe>` : ''}</div><div class="info"><h3>Demo website</h3><p>${esc(site.summary || '')}</p>
      <div class="row-actions"><button class="btn sm" data-preview>${ic('eye')}Preview</button>${site.public_url ? `<a class="btn sm" href="${esc(site.public_url)}" target="_blank" rel="noopener">${ic('ext')}Live link</a>` : ''}</div></div></div></section>` : ''}

    ${p ? `<section class="card card-b sec"><h3>Public profile</h3>
      <dl class="kv">${p.rating ? `<dt>Rating</dt><dd>${esc(p.rating)}${p.review_count ? ` from ${esc(p.review_count)} reviews` : ''}${p.rating_source ? ` (${esc(p.rating_source)})` : ''}</dd>` : ''}${p.followers ? `<dt>Followers</dt><dd>${esc(p.followers)}</dd>` : ''}
      <dt>Website today</dt><dd>${esc({ none: 'None', social_only: 'Only social media pages', weak: 'Weak / outdated', ok: 'OK', good: 'Good' }[p.website_status] || '—')}</dd>${p.hours ? `<dt>Hours</dt><dd>${esc(p.hours)}</dd>` : ''}${p.address ? `<dt>Address</dt><dd>${esc(p.address)}</dd>` : ''}${p.decision_maker ? `<dt>Owner / manager</dt><dd>${esc(p.decision_maker)}</dd>` : ''}</dl>
      ${p.missing?.length ? `<h3 style="margin-top:14px">Missing today</h3><div class="chips">${p.missing.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
      ${p.cares_about?.length ? `<h3 style="margin-top:14px">What they care about</h3><div class="chips">${p.cares_about.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
      ${p.facts?.length ? `<h3 style="margin-top:14px">Facts <span style="text-transform:none;letter-spacing:0;font-weight:500">· ✓ verified, ○ assumed</span></h3><ul class="clean facts">${p.facts.map((f) => `<li><span class="${f.verified ? 'ok-ic' : 'as-ic'}">${ic(f.verified ? 'check' : 'circle')}</span><div>${esc(f.text)}${f.source ? `<span class="ev">${esc(f.source)}</span>` : ''}</div></li>`).join('')}</ul>` : ''}
      ${p.red_flags?.length ? `<h3 style="margin-top:14px">Red flags</h3><ul class="clean">${p.red_flags.map((r) => `<li><span class="no-ic">${ic('x')}</span><div>${esc(r)}</div></li>`).join('')}</ul>` : ''}
    </section>` : '<section class="card card-b"><p class="muted" style="margin:0">The profile appears here once the Investigator has checked this business.</p></section>'}

    ${rv?.checks?.length ? `<section class="card card-b sec"><h3>Reviewer's checks</h3><p style="margin:0 0 10px">${esc(rv.summary)}</p><ul class="clean">${rv.checks.map((c) => `<li><span class="${c.ok ? 'ok-ic' : 'no-ic'}">${ic(c.ok ? 'check' : 'x')}</span><div>${esc(c.check)}${c.note ? `<span class="ev">${esc(c.note)}</span>` : ''}</div></li>`).join('')}</ul></section>` : ''}

    ${l.reason && ['skipped', 'hold', 'lost'].includes(l.stage) ? `<section class="card card-b"><h3 class="sec" style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px">Why it stopped</h3>${esc(l.reason)}</section>` : ''}

    <section class="card card-b sec"><h3>History</h3><div class="timeline">${(l.history || []).slice().reverse().map((h) => `<div><time>${ago(h.at)}</time><span>${esc(h.text)}</span></div>`).join('')}</div></section>
  </div>
  <div class="drawer-f">${nx ? `<button class="btn primary" id="dNext">${ic(nx.icon)}${nx.label}</button>` : ''}
    ${!site && !workingOn(l) && ['qualified', 'planned', 'skipped', 'profiled'].includes(l.stage) ? '<button class="btn outline" id="dBuild">Build a demo anyway</button>' : ''}
    ${['sent', 'replied'].includes(l.stage) ? '<button class="btn dark" id="dWon">Mark as client</button>' : ''}
    <span class="grow"></span>${!['skipped', 'lost', 'won'].includes(l.stage) ? '<button class="btn ghost" id="dSkip">Not a fit</button>' : ''}</div>`;
  $('.drawer-b', d).scrollTop = keep;
  $('.x', d).onclick = closeLead;
  $$('[data-preview]', d).forEach((b) => (b.onclick = () => openPreview(site, l)));
  $('#dNext')?.addEventListener('click', (e) => nx.run(e.currentTarget));
  $('#dBuild')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/leads/${l.id}/build`), `Building a demo for ${l.business}.`));
  $('#dWon')?.addEventListener('click', (e) => act(e.currentTarget, () => req('PATCH', `/api/leads/${l.id}`, { stage: 'won', note: 'Became a client' }), 'Congratulations, a new client.'));
  $('#dSkip')?.addEventListener('click', (e) => act(e.currentTarget, () => req('PATCH', `/api/leads/${l.id}`, { stage: 'skipped', note: 'Marked as not a fit by you' }), 'Moved to "Not a fit".'));
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('.preview')) $('.preview').remove(); else if (S.lead) closeLead(); } });

/* ---------------------------------------------------------------- PREVIEW */
function openPreview(site, l) {
  if (!site) return;
  const p = document.createElement('div');
  p.className = 'preview';
  const canApprove = l && !site.public_url;
  p.innerHTML = `<div class="bar"><b style="padding:0 6px">${esc(site.business)}</b>
    <div class="seg"><button class="on" data-w="desk">${ic('monitor')} Computer</button><button data-w="phone">${ic('phone')} Phone</button></div>
    <a class="btn sm" href="${esc(site.local_url)}" target="_blank">${ic('ext')}New tab</a>
    ${canApprove ? `<button class="btn sm primary" id="pOk">${ic('check')}Looks good: put it online</button>` : site.public_url ? `<a class="btn sm" href="${esc(site.public_url)}" target="_blank">Live link</a>` : ''}
    <button class="btn sm ghost" id="pX">Close</button></div>
    <div class="frame"><iframe src="${esc(site.local_url)}"></iframe></div>`;
  document.body.appendChild(p);
  p.onclick = (e) => { if (e.target === p) p.remove(); };
  $('#pX', p).onclick = () => p.remove();
  $$('[data-w]', p).forEach((b) => (b.onclick = () => { $$('[data-w]', p).forEach((x) => x.classList.toggle('on', x === b)); $('.frame', p).classList.toggle('phone', b.dataset.w === 'phone'); }));
  $('#pOk', p)?.addEventListener('click', async (e) => {
    const r = await act(e.currentTarget, () => req('POST', `/api/leads/${l.id}/approve-demo`), 'The demo is online. The Writer is drafting the first message for you.');
    if (r) p.remove();
  });
}

/* ------------------------------------------------------------------ DEMOS */
function viewDemos() {
  const sites = S.sites.map((s) => ({ s, l: S.leads.find((x) => x.id === s.lead_id || x.demo?.slug === s.slug) })).sort((a, b) => (a.s.public_url ? 1 : 0) - (b.s.public_url ? 1 : 0) || (b.s.updated || '').localeCompare(a.s.updated || ''));
  const building = S.runs.filter((r) => r.agent === 'builder' && ['running', 'queued'].includes(r.status));
  return `<div class="page-head"><div><h1>Demos</h1><p>Free websites the team built. Look, approve, and the first message is written for you.</p></div></div>
  ${building.length ? `<div class="now" style="margin:0 0 16px"><span class="dot busy"></span>${building.map((r) => esc(r.title.replace('Builder · ', ''))).join(', ')}: ${building.length > 1 ? 'demos are' : 'demo is'} being built</div>` : ''}
  ${sites.length ? `<div class="demos">${sites.map(({ s, l }, i) => `<article class="card demo"><div class="shot" data-pv="${i}"><iframe loading="lazy" scrolling="no" src="${esc(s.local_url)}" tabindex="-1"></iframe></div>
    <div class="info"><div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><h3>${esc(s.business)}</h3>${(() => { const st = s.public_url ? ['good', 'Online'] : l && ['demo_built'].includes(l.stage) ? ['accent', 'Waiting for you'] : ['', 'Not used']; return `<span class="badge ${st[0]}">${st[1]}</span>`; })()}</div>
    <p>${esc(s.summary || l?.plan?.product || '')}</p>
    <div class="row-actions"><button class="btn sm ${!s.public_url && l?.stage === 'demo_built' ? 'primary' : 'outline'}" data-pv="${i}">${ic('eye')}${!s.public_url && l?.stage === 'demo_built' ? 'Review' : 'Preview'}</button>${s.public_url ? `<a class="btn sm outline" href="${esc(s.public_url)}" target="_blank" rel="noopener">${ic('ext')}Live link</a>` : ''}${l ? `<button class="btn sm ghost" data-lead="${l.id}">Details</button>` : ''}</div></div></article>`).join('')}</div>`
    : '<div class="card empty"><b>No demos yet</b>When a business is worth it, the Builder makes one and it shows up here.</div>'}`;
}
wire.demos = () => {
  const sites = S.sites.map((s) => ({ s, l: S.leads.find((x) => x.id === s.lead_id || x.demo?.slug === s.slug) })).sort((a, b) => (a.s.public_url ? 1 : 0) - (b.s.public_url ? 1 : 0) || (b.s.updated || '').localeCompare(a.s.updated || ''));
  $$('[data-pv]').forEach((b) => (b.onclick = () => openPreview(sites[+b.dataset.pv].s, sites[+b.dataset.pv].l)));
  $$('[data-lead]').forEach((b) => (b.onclick = () => openLead(b.dataset.lead)));
};

/* --------------------------------------------------------------- MESSAGES */
function viewMessages() {
  const msgs = S.approvals.filter((a) => ['email', 'whatsapp'].includes(a.type));
  const tabs = [['pending', 'To approve', (a) => a.status === 'pending'], ['ready', 'Ready to send', (a) => a.status === 'approved'], ['sent', 'Sent', (a) => a.status === 'sent'], ['rejected', 'Discarded', (a) => a.status === 'rejected']];
  const t = tabs.find((x) => x[0] === S.msgTab) || tabs[0];
  const list = msgs.filter(t[2]);
  const smtp = S.config.outreach.sender === 'smtp' && S.config.smtp.user;
  return `<div class="page-head"><div><h1>Messages</h1><p>Nothing is sent until you say so. ${S.stats?.sentToday ?? 0} of ${S.config.outreach.daily_send_cap} sent today.</p></div></div>
  <div class="toolbar"><div class="seg">${tabs.map(([k, n, fn]) => `<button data-t="${k}" class="${S.msgTab === k ? 'on' : ''}">${n}<em>${msgs.filter(fn).length}</em></button>`).join('')}</div></div>
  <div class="grid">${list.length ? list.map((a) => {
    const l = S.leads.find((x) => x.id === a.lead_id);
    const wa = a.type === 'whatsapp';
    const head = `<div class="msg-top"><b>${esc(l?.business || a.title)}</b><span class="badge ${wa ? 'good' : 'info'}">${wa ? 'WhatsApp' : 'Email'}</span><span class="to">to ${esc(a.to || '—')}</span><span class="grow"></span><span class="muted small">${ago(a.created)}</span></div>`;
    if (a.status === 'pending') return `<article class="card msg-card" data-a="${a.id}">${head}
      <label class="field"><span>Send to</span><input data-k="to" value="${esc(a.to)}"></label>
      ${wa ? '' : `<label class="field"><span>Subject</span><input data-k="subject" value="${esc(a.subject)}"></label>`}
      <label class="field"><span>Message ${wa ? '<em style="font-style:normal;color:var(--muted);font-weight:400">(the English part below the line is only for you; it is not sent)</em>' : ''}</span><textarea data-k="body" dir="auto" rows="${Math.min(16, (a.body.match(/\n/g) || []).length + 3)}">${esc(a.body)}</textarea></label>
      <div class="row-actions"><button class="btn primary" data-ok>${ic('check')}Approve${smtp && !wa ? ' and send' : ''}</button><button class="btn ghost" data-save>Save changes</button><span class="grow"></span><button class="btn ghost danger" data-no>Discard</button></div></article>`;
    if (a.status === 'approved') return `<article class="card msg-card" data-a="${a.id}">${head}<div class="msg-body ${wa ? 'wa' : ''}" dir="auto">${esc(wa ? a.body.split(/\n\s*-{3,}\s*\n|\n\s*\(?English( version| translation)?\)?\s*:?\s*\n/i)[0] : a.body)}</div>
      <div class="row-actions">${wa ? (a.wa_link ? `<a class="btn primary" href="${esc(a.wa_link)}" target="_blank" rel="noopener" data-opened>${ic('send')}Open in WhatsApp</a>` : '<span class="badge warn">No WhatsApp number: copy the text and send it yourself</span>') : `<a class="btn primary" href="mailto:${esc(a.to)}?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(a.body)}">${ic('send')}Open in email</a>`}
        <button class="btn" data-copy>${ic('copy')}Copy text</button><button class="btn" data-sent>${ic('check')}I sent it</button></div>
      <p class="muted small" style="margin:0">${wa ? 'WhatsApp opens with the message ready. Press send there, then come back and press "I sent it".' : 'Send it from your mailbox, then press "I sent it".'}</p></article>`;
    if (a.status === 'sent') return `<article class="card msg-card" data-a="${a.id}">${head}<div class="msg-body ${wa ? 'wa' : ''}" dir="auto">${esc(a.body)}</div>
      <div class="row-actions"><span class="badge good">Sent ${ago(a.sent_at)}</span>${l ? `<button class="btn sm" data-reply="${l.id}">${ic('reply')}They replied</button><button class="btn sm ghost" data-lead="${l.id}">Details</button>` : ''}</div></article>`;
    return `<article class="card msg-card">${head}<div class="msg-body" dir="auto">${esc(a.body)}</div></article>`;
  }).join('') : `<div class="card empty"><b>${{ pending: 'Nothing to approve', ready: 'Nothing waiting to be sent', sent: 'No messages sent yet', rejected: 'Nothing discarded' }[t[0]]}</b>${t[0] === 'pending' ? 'When you approve a demo, the first message is written and lands here.' : ''}</div>`}</div>`;
}
wire.messages = () => {
  $$('[data-t]').forEach((b) => (b.onclick = () => { S.msgTab = b.dataset.t; render(); }));
  $$('[data-a]').forEach((card) => {
    const id = card.dataset.a;
    const vals = () => Object.fromEntries($$('[data-k]', card).map((i) => [i.dataset.k, i.value]));
    $('[data-ok]', card)?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/approvals/${id}/decide`, { decision: 'approve', ...vals() }), 'Approved. It is in "Ready to send".').then(() => { S.msgTab = 'ready'; render(); }));
    $('[data-save]', card)?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/approvals/${id}/decide`, { decision: 'save', ...vals() }), 'Saved.'));
    $('[data-no]', card)?.addEventListener('click', (e) => { if (confirm('Discard this message?')) act(e.currentTarget, () => req('POST', `/api/approvals/${id}/decide`, { decision: 'reject' }), 'Discarded.'); });
    $('[data-sent]', card)?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/approvals/${id}/sent`), 'Marked as sent. Tell us when they reply.'));
    $('[data-copy]', card)?.addEventListener('click', () => { const a = S.approvals.find((x) => x.id === id); navigator.clipboard.writeText(a.body).then(() => toast('Copied.')); });
  });
  $$('[data-reply]').forEach((b) => (b.onclick = () => openReply(S.leads.find((l) => l.id === b.dataset.reply))));
  $$('[data-lead]').forEach((b) => (b.onclick = () => openLead(b.dataset.lead)));
};

function openReply(l) {
  if (!l) return;
  const p = document.createElement('div');
  p.className = 'preview';
  p.style.justifyContent = 'center';
  p.innerHTML = `<div class="card modal-card"><h2>${esc(l.business)} replied</h2>
    <p class="muted" style="margin:4px 0 14px">Paste their reply. The Closer writes your answer and it waits in Messages for you.</p>
    <textarea id="rText" dir="auto" placeholder="Paste their message here"></textarea>
    <div class="row-actions" style="margin-top:12px"><button class="btn primary" id="rGo">${ic('reply')}Write my answer</button><button class="btn ghost" id="rX">Cancel</button></div></div>`;
  document.body.appendChild(p);
  $('#rText', p).focus();
  $('#rX', p).onclick = () => p.remove();
  $('#rGo', p).onclick = async (e) => {
    const text = $('#rText', p).value.trim();
    if (!text) return toast('Paste their reply first.', 'err');
    const r = await act(e.currentTarget, () => req('POST', '/api/runs', { agent: 'closer', input: { lead_id: l.id, reply_text: text } }), 'The Closer is writing your answer.');
    if (r) p.remove();
  };
}

/* ------------------------------------------------------------------- TEAM */
const STEP = { scout: 1, investigator: 2, opportunity: 3, strategist: 4, reviewer: 5, builder: 6, writer: 7, closer: 8 };
function viewTeam() {
  const running = S.runs.filter((r) => r.status === 'running');
  const cur = running[0];
  return `<div class="page-head"><div><h1>Your AI team</h1><p>Eight specialists, each with one job. They hand work to each other; nothing leaves without you.</p></div>
    <div class="row-actions">${S.runner?.paused ? `<button class="btn primary" id="tResume">${ic('play')}Resume</button>` : `<button class="btn outline" id="tPause">${ic('pause')}Pause the team</button>`}</div></div>
  <div class="agents" style="margin-bottom:16px">${S.agents.sort((a, b) => (STEP[a.key] || 9) - (STEP[b.key] || 9)).map((a) => {
    const r = S.runs.find((x) => x.agent === a.key && x.status === 'running');
    const q = S.runs.filter((x) => x.agent === a.key && x.status === 'queued').length;
    return `<div class="card agent ${r ? 'on' : ''}"><div class="h"><span class="stepn">${STEP[a.key] || ''}</span><b>${esc(a.name)}</b><span class="badge ${r ? 'accent' : q ? 'info' : ''}">${r ? 'Working' : q ? `${q} waiting` : 'Ready'}</span></div><p>${esc(a.blurb)}</p></div>`;
  }).join('')}</div>
  <div class="grid cols-2">
    <section class="card"><div class="card-h"><h2>${cur ? `Live: ${esc(cur.title)}` : 'Live'}</h2>${cur ? `<button class="btn sm ghost" id="tStop" data-run="${cur.id}">Stop</button>` : ''}</div>
      <div class="feed" id="liveFeed" style="margin-top:8px">${cur ? (S.events[cur.id] || []).map((e) => eventRow(e)).filter(Boolean).join('') || '<div class="empty">Starting…</div>' : '<div class="empty"><b>Nobody is working right now</b>Start a search on the Home page.</div>'}</div></section>
    <section class="card"><div class="card-h"><h2>Everything that happened</h2></div><div class="feed" id="teamFeed" style="margin-top:8px">${S.activity.slice(0, 80).map(feedRow).join('')}</div></section>
  </div>`;
}
function eventRow(e) {
  let text = '';
  if (e.kind === 'tool') {
    const i = e.input || {};
    const t = e.tool.replace(/^mcp__hq__/, '');
    text = { WebSearch: `Searching: “${i.query}”`, WebFetch: `Reading ${hostOf(i.url)}`, Write: 'Writing the website', Edit: 'Improving the website', Read: 'Reading a file', hq_add_lead: `Found: ${i.business}`, hq_save_profile: 'Saved a profile', hq_save_opportunity: `Scored ${i.score}/100`, hq_save_plan: `Planned: ${i.product}`, hq_save_review: `Review: ${i.verdict}`, hq_register_site: 'Demo finished', hq_request_approval: 'Message ready for you', hq_note: i.text, hq_list_leads: 'Checking who we already know', hq_get_lead: 'Opening a business', hq_settings: 'Reading the offer' }[t] || t;
  } else if (e.kind === 'text') text = e.text.length > 220 ? `${e.text.slice(0, 220)}…` : e.text;
  else if (e.kind === 'result') text = e.ok ? 'Finished.' : 'Stopped with a problem.';
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
  $('#tPause')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', '/api/runner/pause'), 'Paused. Nothing new will start.'));
  $('#tResume')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', '/api/runner/resume'), 'Resumed.'));
  $('#tStop')?.addEventListener('click', (e) => act(e.currentTarget, () => req('POST', `/api/runs/${e.currentTarget.dataset.run}/stop`), 'Stopped.'));
  const cur = S.runs.find((r) => r.status === 'running');
  if (cur && !S.events[cur.id]) req('GET', `/api/runs/${cur.id}/events`).then((ev) => { S.events[cur.id] = ev; if (route() === 'team') { const f = $('#liveFeed'); if (f) { f.innerHTML = ev.map(eventRow).filter(Boolean).join(''); f.scrollTop = f.scrollHeight; } } }).catch(() => {});
};

/* --------------------------------------------------------------- SETTINGS */
function viewSettings() {
  const c = S.config;
  const m = market(S.market);
  return `<div class="page-head"><div><h1>Settings</h1><p>Set it once. The team uses these for every search and every message.</p></div></div>
  <div class="grid" style="max-width:860px">
    <section class="card"><div class="card-h"><h2>Your company</h2></div><div class="card-b form-grid">
      ${fld('Company name', 'company.name', c.company.name)}${fld('Website', 'company.website', c.company.website)}
      ${fld('Your name (used to sign messages)', 'company.sender_name', c.company.sender_name)}${fld('Your email', 'company.sender_email', c.company.sender_email)}
      <label class="field" style="grid-column:1/-1"><span>Email signature</span><textarea data-p="company.signature" rows="3">${esc(c.company.signature)}</textarea></label></div></section>

    <section class="card"><div class="card-h"><h2>Market and prices</h2>
      <select id="sMarket" style="width:auto">${Object.values(c.markets).map((x) => `<option value="${x.id}" ${x.id === S.market ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
      <div class="card-b form-grid">
      <label class="field"><span>Default market for new searches</span><select data-p="market_id">${Object.values(c.markets).map((x) => `<option value="${x.id}" ${x.id === c.market_id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
      <label class="field"><span>How we reach businesses</span><select data-p="markets.${m.id}.channel"><option value="whatsapp" ${m.channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option><option value="email" ${m.channel === 'email' ? 'selected' : ''}>Email</option></select></label>
      ${fld(`Website price (${m.currency}, one time)`, `markets.${m.id}.build_price`, m.build_price, 'number')}${fld(`Care plan (${m.currency} per month)`, `markets.${m.id}.monthly_price`, m.monthly_price, 'number')}
      ${fld('Language of messages', `markets.${m.id}.language`, m.language)}${fld('Country', `markets.${m.id}.country`, m.country)}
      <label class="field" style="grid-column:1/-1"><span>Cities</span><input data-p="markets.${m.id}.cities" data-list value="${esc(m.cities.join(', '))}"><em>Separate with commas.</em></label>
      <label class="field" style="grid-column:1/-1"><span>Kinds of business</span><input data-p="markets.${m.id}.niches" data-list value="${esc(m.niches.join(', '))}"></label>
      <label class="field" style="grid-column:1/-1"><span>What we offer (one or two sentences)</span><textarea data-p="offer.pitch" rows="3">${esc(c.offer.pitch)}</textarea></label></div></section>

    <section class="card"><div class="card-h"><h2>How picky the team is</h2></div><div class="card-b form-grid">
      ${fld('Build a demo at this score or higher', 'qualify.threshold', c.qualify.threshold, 'number')}${fld('Keep for later from this score', 'qualify.hold', c.qualify.hold, 'number')}
      ${fld('Most messages per day', 'outreach.daily_send_cap', c.outreach.daily_send_cap, 'number')}${fld('Most agent jobs per day', 'limits.daily_runs', c.limits.daily_runs, 'number')}</div></section>

    <section class="card"><div class="card-h"><h2>Sending email</h2></div><div class="card-b form-grid">
      <label class="field" style="grid-column:1/-1"><span>When you approve an email</span><select data-p="outreach.sender"><option value="manual" ${c.outreach.sender === 'manual' ? 'selected' : ''}>I send it myself from my mailbox</option><option value="smtp" ${c.outreach.sender === 'smtp' ? 'selected' : ''}>Send it automatically (needs the details below)</option></select></label>
      ${fld('Mail server', 'smtp.host', c.smtp.host)}${fld('Port', 'smtp.port', c.smtp.port, 'number')}${fld('Username', 'smtp.user', c.smtp.user)}${fld('Password', 'smtp.pass', c.smtp.pass, 'password')}</div></section>

    <div class="row-actions"><button class="btn primary lg" id="sSave">Save settings</button></div>

    <section class="card"><div class="card-h"><h2>Password</h2></div><div class="card-b form-grid">
      <label class="field"><span>Current password</span><input type="password" id="pwOld"></label><label class="field"><span>New password</span><input type="password" id="pwNew" minlength="8"></label>
      <div class="row-actions"><button class="btn" id="pwGo">Change password</button><button class="btn ghost" id="logout">Sign out</button></div></div></section>
  </div>`;
}
const fld = (label, path, val, type = 'text') => `<label class="field"><span>${label}</span><input type="${type}" data-p="${path}" value="${esc(val ?? '')}"></label>`;
wire.settings = () => {
  $('#sMarket').onchange = (e) => { S.market = e.target.value; render(); };
  $('#sSave').onclick = (e) => {
    const patch = {};
    for (const el of $$('[data-p]')) {
      let v = el.value;
      if (el.type === 'number') v = Number(v);
      if (el.dataset.list !== undefined) v = v.split(',').map((x) => x.trim()).filter(Boolean);
      const keys = el.dataset.p.split('.');
      let o = patch;
      keys.slice(0, -1).forEach((k) => (o = o[k] ||= {}));
      o[keys.at(-1)] = v;
    }
    act(e.currentTarget, () => req('PUT', '/api/settings', patch), 'Settings saved.');
  };
  $('#pwGo').onclick = (e) => act(e.currentTarget, () => req('POST', '/api/password', { current: $('#pwOld').value, next: $('#pwNew').value }), 'Password changed.');
  $('#logout').onclick = async () => { await req('POST', '/api/logout'); boot(); };
};

boot();
