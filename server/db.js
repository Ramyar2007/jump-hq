// Tiny JSON document store. One process (the HQ server) owns writes; agents reach it
// through the HTTP API (via the hq MCP server), never by touching this file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EMPTY = {
  hunts: [],
  leads: [],
  approvals: [],
  runs: [],
  activity: [],
  sites: [],
  posts: [],
  meta: { created: new Date().toISOString() },
};

// The life of a prospect. "skipped" = the AI decided it is not worth it; "lost" = they said no.
export const STAGES = ['new', 'profiled', 'qualified', 'hold', 'planned', 'approved', 'demo_built', 'email_drafted', 'sent', 'replied', 'won', 'lost', 'skipped'];

export function id(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48) || `site-${crypto.randomBytes(3).toString('hex')}`;
}

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const handle = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?(instagram|facebook)\.com\//, '').replace(/[/?#].*$/, '').replace(/^@/, '');
const digits = (p) => String(p || '').replace(/\D/g, '').slice(-9);

export class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.data = fs.existsSync(file) ? { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(file, 'utf8')) } : structuredClone(EMPTY);
    this.migrate();
    this.timer = null;
    this.listeners = new Set();
  }

  // v1 leads (vetting + likelihood) → v2 (profile + opportunity), so old work still shows properly.
  migrate() {
    for (const l of this.data.leads) {
      if (l.vetting && !l.profile) {
        const v = l.vetting;
        l.profile = {
          verdict: v.verdict, at: v.at,
          facts: (v.checks || []).map((c) => ({ text: c, source: '', verified: true })),
          rating: v.rating_summary || '', red_flags: v.red_flags || [], decision_maker: v.decision_maker || '',
          missing: l.issues || [], website_status: l.website ? 'weak' : 'none',
        };
      }
      if (l.likelihood && !l.opportunity) {
        const k = l.likelihood;
        l.opportunity = { score: k.score, confidence: null, decision: k.score >= 70 ? 'build' : k.score >= 50 ? 'hold' : 'skip', summary: k.best_angle || '', reasons: (k.reasons || []).map((r) => ({ point: r, evidence: '' })), risks: k.risks || [], best_angle: k.best_angle || '', at: k.at };
      }
      if (l.stage === 'lost' && !['sent', 'replied'].some((s) => (l.history || []).some((h) => /sent|replied/i.test(h.text))) ) l.stage = 'skipped';
      if (!l.market_id) l.market_id = /kingdom|uk/i.test(l.country || '') ? 'uk' : l.market_id || 'uk';
      l.socials ||= {};
    }
    for (const a of this.data.approvals) a.channel ||= a.type === 'email' ? 'email' : a.type;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  emit(kind, payload) { for (const fn of this.listeners) fn(kind, payload); }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  }

  flush() {
    clearTimeout(this.timer);
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }

  log(text, extra = {}) {
    const entry = { id: id('act'), at: new Date().toISOString(), text, ...extra };
    this.data.activity.unshift(entry);
    this.data.activity.length = Math.min(this.data.activity.length, 500);
    this.save();
    this.emit('activity', entry);
    return entry;
  }

  // ---- hunts (one search: a city + a kind of business) ----------------------
  addHunt(input) {
    const h = { id: id('hunt'), market_id: input.market_id, city: input.city, niche: input.niche, target: input.target, build_max: input.build_max, status: 'running', created: new Date().toISOString(), ended: null };
    this.data.hunts.unshift(h);
    this.save();
    this.emit('hunt', h);
    return h;
  }
  getHunt(hid) { return this.data.hunts.find((h) => h.id === hid); }
  updateHunt(hid, patch) { const h = this.getHunt(hid); if (!h) return null; Object.assign(h, patch); this.save(); this.emit('hunt', h); return h; }

  // ---- leads -------------------------------------------------------------
  findDuplicateLead(l) {
    const h = host(l.website);
    const ig = handle(l.socials?.instagram);
    const ph = digits(l.phone || l.whatsapp);
    return this.data.leads.find((x) =>
      (h && host(x.website) === h)
      || (ig && handle(x.socials?.instagram) === ig)
      || (ph.length >= 7 && digits(x.phone || x.whatsapp) === ph)
      || (x.business.toLowerCase() === String(l.business).toLowerCase() && (x.city || '').toLowerCase() === (l.city || '').toLowerCase()));
  }

  addLead(input) {
    const dup = this.findDuplicateLead(input);
    if (dup) return { lead: dup, duplicate: true };
    const now = new Date().toISOString();
    const lead = {
      id: id('lead'),
      hunt_id: input.hunt_id || null,
      market_id: input.market_id || 'uk',
      business: input.business,
      business_local: input.business_local || '',
      niche: input.niche || '',
      country: input.country || '',
      city: input.city || '',
      area: input.area || '',
      website: input.website || '',
      socials: input.socials || {},
      maps_url: input.maps_url || '',
      email: input.email || '',
      phone: input.phone || '',
      whatsapp: input.whatsapp || '',
      contact_page: input.contact_page || '',
      owner_name: input.owner_name || '',
      issues: input.issues || [],
      score: Number(input.score) || 0,
      notes: input.notes || '',
      source: input.source || '',
      stage: 'new',
      demo: null,
      profile: null,
      opportunity: null,
      plan: null,
      review: null,
      history: [{ at: now, text: 'Found' }],
      created: now,
      updated: now,
    };
    this.data.leads.unshift(lead);
    this.save();
    this.emit('lead', lead);
    return { lead, duplicate: false };
  }

  getLead(leadId) { return this.data.leads.find((l) => l.id === leadId); }

  updateLead(leadId, patch, note) {
    const lead = this.getLead(leadId);
    if (!lead) return null;
    const allowed = ['business', 'business_local', 'niche', 'country', 'city', 'area', 'website', 'socials', 'maps_url', 'email', 'phone', 'whatsapp', 'contact_page', 'owner_name', 'issues', 'score', 'notes', 'stage', 'demo', 'profile', 'opportunity', 'plan', 'review', 'vetting', 'likelihood', 'reason'];
    for (const k of allowed) if (patch[k] !== undefined) lead[k] = patch[k];
    if (patch.stage && !STAGES.includes(patch.stage)) lead.stage = 'new';
    lead.updated = new Date().toISOString();
    if (note) lead.history.push({ at: lead.updated, text: note });
    this.save();
    this.emit('lead', lead);
    return lead;
  }

  deleteLead(leadId) {
    this.data.leads = this.data.leads.filter((l) => l.id !== leadId);
    this.save();
    this.emit('lead_deleted', { id: leadId });
  }

  // ---- approvals ---------------------------------------------------------
  addApproval(input) {
    const a = {
      id: id('apr'),
      type: input.type || 'other',
      channel: input.channel || (input.type === 'email' ? 'email' : input.type),
      lead_id: input.lead_id || null,
      title: input.title || 'Approval needed',
      to: input.to || '',
      subject: input.subject || '',
      body: input.body || '',
      payload: input.payload || {},
      status: 'pending',
      run_id: input.run_id || null,
      created: new Date().toISOString(),
      decided: null,
      decision_note: '',
    };
    this.data.approvals.unshift(a);
    this.save();
    this.emit('approval', a);
    return a;
  }

  getApproval(aid) { return this.data.approvals.find((a) => a.id === aid); }

  decide(aid, status, patch = {}) {
    const a = this.getApproval(aid);
    if (!a) return null;
    Object.assign(a, patch, { status, decided: new Date().toISOString() });
    this.save();
    this.emit('approval', a);
    return a;
  }

  // ---- runs --------------------------------------------------------------
  addRun(run) { this.data.runs.unshift(run); this.data.runs.length = Math.min(this.data.runs.length, 400); this.save(); this.emit('run', run); return run; }
  getRun(rid) { return this.data.runs.find((r) => r.id === rid); }
  updateRun(rid, patch) { const r = this.getRun(rid); if (!r) return null; Object.assign(r, patch); this.save(); this.emit('run', r); return r; }

  // ---- sites -------------------------------------------------------------
  upsertSite(site) {
    const i = this.data.sites.findIndex((s) => s.slug === site.slug);
    if (i >= 0) this.data.sites[i] = { ...this.data.sites[i], ...site, updated: new Date().toISOString() };
    else this.data.sites.unshift({ ...site, created: new Date().toISOString(), updated: new Date().toISOString() });
    this.save();
    const s = this.data.sites.find((x) => x.slug === site.slug);
    this.emit('site', s);
    return s;
  }
}
