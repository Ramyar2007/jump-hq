// Starts headless Claude Code sessions on the owner's subscription, streams their events,
// enforces the concurrency / daily / usage limits, and lets the owner stop anything.
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { AGENTS, PIPELINE } from './agents.js';
import { id, slugify } from './db.js';

const CLAUDE = process.env.CLAUDE_BIN || (process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', '.local', 'bin', 'claude.exe') : 'claude');

export class Runner {
  constructor({ store, config, root, dataDir, port, broadcast, say }) {
    this.say = say || ((k) => k);
    this.store = store;
    this.config = config;
    this.root = root;
    this.port = port;
    this.broadcast = broadcast;
    this.procs = new Map();
    this.paused = false;
    this.pauseReason = '';
    this.usage = store.data.meta.usage || null;
    this.runsDir = path.join(dataDir, 'runs');
    this.tmpDir = path.join(dataDir, 'tmp');
    this.workDir = path.join(root, 'workspace');
    this.sitesDir = process.env.HQ_SITES ? path.resolve(process.env.HQ_SITES) : path.join(root, 'sites');
    for (const d of [this.runsDir, this.tmpDir, this.workDir, this.sitesDir]) fs.mkdirSync(d, { recursive: true });
    // Anything left "running" from a previous server life is dead now.
    for (const r of store.data.runs) if (r.status === 'running') store.updateRun(r.id, { status: 'interrupted', ended: new Date().toISOString() });
    setTimeout(() => this.tick(), 1500);
  }

  state() {
    return {
      paused: this.paused,
      pauseReason: this.pauseReason,
      usage: this.usage,
      running: [...this.procs.keys()],
      queued: this.store.data.runs.filter((r) => r.status === 'queued').map((r) => r.id),
      today: this.runsToday(),
      limits: this.config.data.limits,
    };
  }

  runsToday() {
    const day = new Date().toISOString().slice(0, 10);
    return this.store.data.runs.filter((r) => r.started && r.started.slice(0, 10) === day).length;
  }

  pushState() { this.broadcast({ type: 'runner', state: this.state() }); }

  setPaused(p, reason = '') { this.paused = p; this.pauseReason = p ? reason : ''; this.pushState(); if (!p) this.tick(); }

  // ---- context builders --------------------------------------------------
  siteFor(lead) {
    const slug = lead.demo?.slug || slugify(`${lead.business}-${lead.city}`);
    return { slug, dir: path.join(this.sitesDir, slug) };
  }

  demoUrl(slug) {
    const site = this.store.data.sites.find((s) => s.slug === slug);
    return site?.public_url || '';
  }

  batchLeads(agentKey, input) {
    const agent = AGENTS[agentKey];
    const max = this.config.data.qualify.batch || 6;
    const ready = (l) => l && l.stage === agent.from;
    let pool = Array.isArray(input.lead_ids) && input.lead_ids.length
      ? input.lead_ids.map((i) => this.store.getLead(i)).filter(ready)
      : this.store.data.leads.filter(ready);
    // one market per run (the prompt speaks that market's language and prices)
    const mid = pool[0]?.market_id;
    pool = pool.filter((l) => l.market_id === mid);
    // never give the same business to two runs at once
    const busy = new Set(this.store.data.runs.filter((r) => ['queued', 'running'].includes(r.status) && r.agent === agentKey).flatMap((r) => r.input.lead_ids || []));
    return pool.filter((l) => !busy.has(l.id)).slice(0, max);
  }

  marketOf(run) {
    const lead = run.lead_id && this.store.getLead(run.lead_id);
    const first = (run.input.lead_ids || []).map((i) => this.store.getLead(i)).find(Boolean);
    const hunt = run.input.hunt_id && this.store.getHunt(run.input.hunt_id);
    return lead?.market_id || first?.market_id || hunt?.market_id || run.input.market_id || this.config.data.market_id;
  }

  validate(agentKey, input) {
    const agent = AGENTS[agentKey];
    if (!agent) throw new Error(`Unknown agent ${agentKey}`);
    if (agent.batch) {
      const leads = this.batchLeads(agentKey, input);
      if (!leads.length) throw new Error(`No businesses waiting for the ${agent.name} right now.`);
      input.lead_ids = leads.map((l) => l.id);
      return null;
    }
    if (!agent.needsLead) return null;
    const lead = this.store.getLead(input.lead_id);
    if (!lead) throw new Error('Pick a lead first');
    if (agentKey === 'writer') {
      const { slug } = this.siteFor(lead);
      if (!this.store.data.sites.find((s) => s.slug === slug)) throw new Error('Build a demo for this lead first (Builder).');
      if (!this.demoUrl(slug)) throw new Error('Approve the demo first, so the message can link to it.');
    }
    if (agentKey === 'closer' && !String(input.reply_text || '').trim()) throw new Error('Paste their reply first.');
    return lead;
  }

  // ---- queue -------------------------------------------------------------
  enqueue(agentKey, input = {}, opts = {}) {
    const lead = this.validate(agentKey, input);
    const agent = AGENTS[agentKey];
    const run = {
      id: id('run'),
      agent: agentKey,
      title: agent.name + (lead ? ` · ${lead.business}` : agent.batch ? ` · ${input.lead_ids.length} business${input.lead_ids.length > 1 ? 'es' : ''}` : input.niche ? ` · ${input.niche}, ${input.city}` : ''),
      hunt_id: input.hunt_id || lead?.hunt_id || (input.lead_ids || []).map((i) => this.store.getLead(i)?.hunt_id).find(Boolean) || null,
      input,
      lead_id: lead?.id || null,
      status: 'queued',
      autopilot: Boolean(opts.autopilot),
      created: new Date().toISOString(),
      started: null,
      ended: null,
      cost_usd: 0,
      turns: 0,
      summary: '',
      error: '',
    };
    this.store.addRun(run);
    this.tick();
    return run;
  }

  tick() {
    const lim = this.config.data.limits;
    // a reading is only valid until its window resets
    const fh = this.usage?.five_hour;
    if (fh?.resetsAt && fh.resetsAt * 1000 < Date.now()) this.usage = { ...this.usage, five_hour: { ...fh, utilization: 0 } };
    if (this.paused && /5-hour window|usage limit/i.test(this.pauseReason) && !(this.usage?.five_hour?.utilization >= lim.pause_at_utilization)) { this.paused = false; this.pauseReason = ''; }
    if (this.paused) return;
    if (this.usage?.five_hour?.utilization >= lim.pause_at_utilization) {
      return this.setPaused(true, `Usage at ${Math.round(this.usage.five_hour.utilization * 100)}% of the 5-hour window. Paused to protect your plan; resumes when you press Resume.`);
    }
    while (this.procs.size < lim.concurrency) {
      if (this.runsToday() >= lim.daily_runs) return this.setPaused(true, `Daily run cap reached (${lim.daily_runs}). Raise it in Settings or resume tomorrow.`);
      // Client-facing work first, then qualification, then new hunting; oldest first within a tier.
      const PRI = { closer: 0, writer: 1, builder: 2, reviewer: 3, strategist: 4, opportunity: 5, investigator: 6, scout: 7 };
      const next = this.store.data.runs.filter((r) => r.status === 'queued').sort((a, b) => (PRI[a.agent] ?? 9) - (PRI[b.agent] ?? 9) || a.created.localeCompare(b.created))[0];
      if (!next) break;
      this.start(next);
    }
    this.pushState();
  }

  start(run) {
    const agent = AGENTS[run.agent];
    const market = this.marketOf(run);
    const cfg = { ...this.config.view(market), mcp_token: this.config.data.mcp_token };
    const lead = run.lead_id ? this.store.getLead(run.lead_id) : null;
    const ctx = { lead, channel: cfg.market.channel, leads: (run.input.lead_ids || []).map((i) => this.store.getLead(i)).filter(Boolean) };
    const addDirs = [];
    if (lead) {
      const { slug, dir } = this.siteFor(lead);
      ctx.siteDir = dir.replaceAll('\\', '/');
      ctx.slug = slug;
      ctx.site = this.store.data.sites.find((s) => s.slug === slug);
      ctx.demoUrl = this.demoUrl(slug) || '(not published yet)';
      if (run.agent === 'builder') { fs.mkdirSync(dir, { recursive: true }); addDirs.push(dir); this.store.updateLead(lead.id, { demo: { slug } }); }
    }
    const prompt = agent.prompt(cfg, run.input, ctx);

    const mcpFile = path.join(this.tmpDir, `mcp-${run.id}.json`);
    fs.writeFileSync(mcpFile, JSON.stringify({
      mcpServers: {
        hq: {
          command: process.execPath,
          args: [path.join(this.root, 'mcp', 'hq-mcp.js')],
          env: { HQ_URL: `http://127.0.0.1:${this.port}`, HQ_TOKEN: cfg.mcp_token, HQ_RUN_ID: run.id },
        },
      },
    }));

    const allowed = [...agent.tools, 'mcp__hq'];
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json', '--verbose',
      '--model', cfg.limits.model,
      '--max-turns', String(cfg.limits.max_turns),
      '--setting-sources', 'project,local',
      '--strict-mcp-config', '--mcp-config', mcpFile,
      '--tools', agent.tools.join(','),
      '--allowedTools', allowed.join(','),
      '--permission-mode', 'dontAsk',
      '--no-session-persistence',
      '--name', `HQ ${run.title}`,
    ];
    for (const d of addDirs) args.push('--add-dir', d);

    const logFile = path.join(this.runsDir, `${run.id}.jsonl`);
    const log = fs.createWriteStream(logFile, { flags: 'a' });
    const child = spawn(CLAUDE, args, { cwd: this.workDir, env: { ...process.env, HQ_RUN_ID: run.id }, windowsHide: true });
    this.procs.set(run.id, child);
    this.store.updateRun(run.id, { status: 'running', started: new Date().toISOString(), pid: child.pid });
    const what = run.title.split(' · ').slice(1).join(' · ');
    this.store.log(this.say('started', { a: agent.name, w: what }), { run_id: run.id, kind: 'start' });

    const emit = (ev) => {
      const e = { at: new Date().toISOString(), ...ev };
      log.write(JSON.stringify(e) + '\n');
      this.broadcast({ type: 'run_event', run_id: run.id, event: e });
    };

    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      let msg;
      try { msg = JSON.parse(line); } catch { return emit({ kind: 'raw', text: line.slice(0, 2000) }); }
      this.handle(run, msg, emit);
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); if (stderr.length > 8000) stderr = stderr.slice(-8000); });

    child.on('close', (code) => {
      this.procs.delete(run.id);
      log.end();
      fs.rm(mcpFile, { force: true }, () => {});
      const cur = this.store.getRun(run.id);
      if (cur.status === 'running') {
        const failed = code !== 0 && !cur.summary;
        this.store.updateRun(run.id, { status: failed ? 'failed' : 'done', ended: new Date().toISOString(), error: failed ? (stderr.trim().slice(-600) || `exit ${code}`) : cur.error });
      } else {
        this.store.updateRun(run.id, { ended: cur.ended || new Date().toISOString() });
      }
      const fin = this.store.getRun(run.id);
      const what2 = run.title.split(' · ').slice(1).join(' · ');
      const how = { done: 'finished', failed: 'ran into a problem with', stopped: 'was stopped on', cancelled: 'was cancelled on' }[fin.status] || fin.status;
      this.store.log(`${['done', 'failed', 'stopped'].includes(fin.status) ? this.say({ done: 'finished', failed: 'failed', stopped: 'stopped' }[fin.status], { a: agent.name, w: what2 }) : `${agent.name} ${how} ${what2}`}${fin.status === 'failed' && fin.error ? `: ${String(fin.error).split(/\r?\n/)[0].slice(0, 140)}` : ''}`, { run_id: run.id, kind: fin.status === 'done' ? 'done' : 'error' });
      this.afterRun(fin);
      this.tick();
    });
    child.on('error', (e) => {
      this.procs.delete(run.id);
      this.store.updateRun(run.id, { status: 'failed', ended: new Date().toISOString(), error: `Could not start Claude Code: ${e.message}` });
      this.tick();
    });
  }

  handle(run, msg, emit) {
    switch (msg.type) {
      case 'system':
        if (msg.subtype === 'init') emit({ kind: 'init', model: msg.model, tools: msg.tools, mcp: msg.mcp_servers });
        break;
      case 'assistant':
        for (const c of msg.message?.content || []) {
          if (c.type === 'text' && c.text.trim()) emit({ kind: 'text', text: c.text });
          if (c.type === 'tool_use') emit({ kind: 'tool', tool: c.name, input: c.input, tool_id: c.id });
        }
        break;
      case 'user':
        for (const c of msg.message?.content || []) {
          if (c.type === 'tool_result') {
            const raw = Array.isArray(c.content) ? c.content.map((x) => x.text || '').join('\n') : String(c.content || '');
            emit({ kind: 'tool_result', tool_id: c.tool_use_id, error: Boolean(c.is_error), text: raw.slice(0, 1500) });
          }
        }
        break;
      case 'rate_limit_event': {
        const w = msg.rate_limit_info?.unifiedWindows;
        if (w) {
          this.usage = { ...w, status: msg.rate_limit_info.status, at: new Date().toISOString() };
          this.store.data.meta.usage = this.usage;
          this.store.save();
          this.pushState();
        }
        if (msg.rate_limit_info?.status && !['allowed', 'allowed_warning'].includes(msg.rate_limit_info.status)) {
          this.setPaused(true, `Claude usage limit reached (${msg.rate_limit_info.rateLimitType}). Queue paused.`);
        }
        break;
      }
      case 'result': {
        const patch = { cost_usd: msg.total_cost_usd || 0, turns: msg.num_turns || 0, summary: String(msg.result || '').slice(0, 4000) };
        if (msg.is_error) { patch.status = 'failed'; patch.error = String(msg.result || msg.subtype).slice(0, 1000); }
        else patch.status = 'done';
        patch.ended = new Date().toISOString();
        this.store.updateRun(run.id, patch);
        emit({ kind: 'result', ok: !msg.is_error, text: patch.summary, turns: patch.turns, duration_ms: msg.duration_ms });
        if (/usage limit|rate limit|limit reached/i.test(String(msg.result))) this.setPaused(true, 'Claude usage limit reached. Queue paused.');
        break;
      }
      default:
        break;
    }
  }

  // Autopilot: each step hands the businesses that passed to the next step, in batches.
  // Nothing goes outside automatically: the owner approves every demo and every message.
  afterRun(run) {
    if (run.hunt_id) setTimeout(() => this.checkHunt(run.hunt_id), 500);
    if (!run.autopilot || run.status !== 'done') return;
    const hunt = run.hunt_id && this.store.getHunt(run.hunt_id);
    if (hunt?.status === 'stopped') return;
    const at = PIPELINE.indexOf(run.agent);
    const nextKey = PIPELINE[at + 1];
    if (!nextKey) return;
    const inHunt = (l) => (run.hunt_id ? l.hunt_id === run.hunt_id : true);
    const fromRun = run.agent === 'scout'
      ? this.store.data.leads.filter((l) => l.found_by_run === run.id)
      : (run.input.lead_ids || []).map((i) => this.store.getLead(i)).filter(Boolean);
    const wanted = AGENTS[nextKey].from || 'approved';
    let ids = fromRun.filter((l) => inHunt(l) && l.stage === wanted).map((l) => l.id);
    if (!ids.length) {
      const msg = { scout: 'The Scout found no new businesses', investigator: 'None of these businesses could be verified', opportunity: 'None scored high enough for a demo', strategist: 'No plans were made', reviewer: 'The Reviewer did not approve any of them' }[run.agent] || 'Nothing passed this step';
      this.store.log(`${msg}${hunt ? ` (${hunt.niche} in ${hunt.city})` : ''}.`, { run_id: run.id, kind: 'note' });
      return;
    }
    if (nextKey === 'builder') {
      const built = this.store.data.leads.filter((l) => l.hunt_id === run.hunt_id && (l.demo?.slug && this.store.data.sites.some((s) => s.slug === l.demo.slug))).length;
      const queued = this.store.data.runs.filter((r) => r.hunt_id === run.hunt_id && r.agent === 'builder' && ['queued', 'running', 'done'].includes(r.status)).length;
      const room = Math.max(0, (hunt?.build_max ?? Number(run.input.build ?? 3)) - Math.max(built, queued));
      const best = ids.map((i) => this.store.getLead(i)).sort((a, b) => (b.opportunity?.score || 0) - (a.opportunity?.score || 0));
      for (const l of best.slice(0, room)) {
        try { this.enqueue('builder', { lead_id: l.id, hunt_id: run.hunt_id }, { autopilot: true }); } catch (e) { this.store.log(`Skipped ${l.business}: ${e.message}`); }
      }
      if (best.length > room) this.store.log(`${best.length - room} more approved businesses are waiting: build them any time from Businesses.`, { run_id: run.id, kind: 'note' });
      return;
    }
    const size = this.config.data.qualify.batch || 6;
    for (let k = 0; k < ids.length; k += size) {
      try { this.enqueue(nextKey, { lead_ids: ids.slice(k, k + size), hunt_id: run.hunt_id }, { autopilot: true }); } catch (e) { this.store.log(`Autopilot stopped: ${e.message}`, { run_id: run.id, kind: 'error' }); }
    }
  }

  checkHunt(hid) {
    const h = this.store.getHunt(hid);
    if (!h || h.status !== 'running') return;
    const open = this.store.data.runs.some((r) => r.hunt_id === hid && ['queued', 'running'].includes(r.status));
    if (!open) {
      this.store.updateHunt(hid, { status: 'done', ended: new Date().toISOString() });
      const f = this.store.data.leads.filter((l) => l.hunt_id === hid);
      const demos = f.filter((l) => l.stage === 'demo_built').length;
      this.store.log(this.say('search_done', { n: f.length, niche: h.niche, city: h.city, d: demos }), { kind: 'done' });
    }
  }

  stopHunt(hid) {
    for (const r of this.store.data.runs.filter((x) => x.hunt_id === hid && ['queued', 'running'].includes(x.status))) this.stop(r.id);
    this.store.updateHunt(hid, { status: 'stopped', ended: new Date().toISOString() });
  }

  stop(runId) {
    const child = this.procs.get(runId);
    const run = this.store.getRun(runId);
    if (run && run.status === 'queued') { this.store.updateRun(runId, { status: 'cancelled', ended: new Date().toISOString() }); this.pushState(); return true; }
    if (!child) return false;
    this.store.updateRun(runId, { status: 'stopped', ended: new Date().toISOString() });
    if (process.platform === 'win32') execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {});
    else child.kill('SIGTERM');
    this.store.log(`Stopped ${run?.title || runId}`, { run_id: runId, kind: 'error' });
    return true;
  }

  stopAll() {
    for (const r of this.store.data.runs.filter((x) => x.status === 'queued')) this.store.updateRun(r.id, { status: 'cancelled', ended: new Date().toISOString() });
    for (const rid of [...this.procs.keys()]) this.stop(rid);
    this.setPaused(true, 'Stopped by you.');
  }

  events(runId) {
    const f = path.join(this.runsDir, `${runId}.jsonl`);
    if (!fs.existsSync(f)) return [];
    return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
}
