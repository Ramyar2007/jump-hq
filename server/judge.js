// The Judge: an independent AI reviewer that checks anything that would leave the building
// (a demo going online, a message going to a business). In Sleep mode its verdict replaces the
// owner's approval; in Awake mode it is a second opinion shown next to every item.
// Hard rules are checked in code first, so the model can never wave through a broken item.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CLAUDE = process.env.CLAUDE_BIN || (process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', '.local', 'bin', 'claude.exe') : 'claude');

const LANG_NAME = { en: 'English', ckb: 'Kurdish Sorani', ar: 'Arabic' };
export const langName = (code) => LANG_NAME[code] || 'English';

// Visible text of a demo page, without scripts/styles, so the Judge reads what a visitor reads.
function pageText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Checks that never depend on the model.
function hardChecks(kind, item, ctx) {
  const fails = [];
  if (kind === 'message') {
    const body = String(item.body || '');
    const links = body.match(/https?:\/\/\S+/g) || [];
    if (!body.trim()) fails.push('The message is empty.');
    if (item.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.to || '')) fails.push('The "to" address is not a real email address.');
    if (item.type === 'whatsapp' && String(item.to || '').replace(/\D/g, '').length < 8) fails.push('There is no valid WhatsApp number.');
    if (ctx.demoUrl && !body.includes(ctx.demoUrl.replace(/\/$/, ''))) fails.push('The message does not link to the demo website.');
    if (links.length > 2) fails.push('Too many links: it would look like spam.');
    if (/lorem ipsum|\[(your|business|name)[^\]]*\]|{{|TODO/i.test(body)) fails.push('The message still has placeholder text in it.');
  }
  if (kind === 'demo') {
    const text = ctx.text || '';
    if (text.length < 300) fails.push('The page is almost empty.');
    if (!/concept/i.test(text) && !/نموونە|نموذج|پێشنیار/.test(text)) fails.push('The "concept website, not the official site" notice is missing.');
    if (/lorem ipsum|TODO|placeholder/i.test(text)) fails.push('The page still has placeholder text.');
  }
  return fails;
}

function prompt(kind, item, ctx, cfg) {
  const lang = langName(cfg.ui_language);
  const common = `You are the Judge in an AI agency team. Another agent made the item below. Nobody else will look at it before it goes out, so you are the last line of defence for the owner's reputation.
Be strict and fair. Approve only what a careful, honest business owner would be proud to send. Never approve anything that invents facts, misleads, pressures, or could embarrass the owner.

Write "reasons" and "summary" in ${lang}, in plain words a non-technical owner understands.
Answer with ONLY one JSON object, no other text:
{"verdict":"approve"|"revise"|"hold","score":0-100,"risk":"low"|"medium"|"high","summary":"one sentence","reasons":["..."],"revised":null or {"subject":"...","body":"..."}}
- "approve": safe to go out as it is.
- "revise": small, safe fixes are enough; put the fixed version in "revised" (keep the same language, the same link, the same signature).
- "hold": something is wrong or risky; the owner must decide in the morning.`;

  if (kind === 'message') {
    return `${common}

ITEM: a first ${item.type === 'whatsapp' ? 'WhatsApp message' : 'email'} to a business (cold outreach).
To: ${item.to}
${item.subject ? `Subject: ${item.subject}\n` : ''}Body:
"""
${item.body}
"""

What we really know about this business (anything in the message must be backed by this):
${JSON.stringify(ctx.facts, null, 2)}
Their demo link: ${ctx.demoUrl || '(none)'}
Our offer: ${ctx.offer}
Expected language of the message: ${ctx.language}

Check: 1) every claim about the business is backed by the facts above (no invented numbers, reviews or compliments); 2) polite, warm, no fake urgency, no pressure, no exaggerated promises; 3) right language, natural wording; 4) exactly one link and it is the demo; 5) has a clear, easy way to say no; 6) the recipient looks like the business's own public contact; 7) short enough to read in 30 seconds.`;
  }
  return `${common}

ITEM: a free concept website ("demo") built for a business, about to be put online at a public address and sent to them.
Business facts we know:
${JSON.stringify(ctx.facts, null, 2)}

Visible text of the demo page (trimmed):
"""
${(ctx.text || '').slice(0, 7000)}
"""

Check: 1) it clearly says it is a concept and not the official website; 2) no invented reviews, ratings, awards, prices or menu items that are not in the facts; 3) the name, contact and location match the facts; 4) it reads well in its languages; 5) nothing offensive or embarrassing. For a demo, never use "revise" (you cannot edit the page): use "approve" or "hold".`;
}

function runClaude(text, cfg, cwd) {
  return new Promise((resolve, reject) => {
    const args = ['-p', text, '--output-format', 'json', '--model', cfg.limits.model || 'sonnet', '--max-turns', '1',
      '--setting-sources', 'project,local', '--strict-mcp-config', '--tools', '', '--permission-mode', 'dontAsk', '--no-session-persistence'];
    const child = spawn(CLAUDE, args, { cwd, windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('The Judge took too long.')); }, 180000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const env = JSON.parse(out);
        if (env.is_error) return reject(new Error(String(env.result || 'Judge failed').slice(0, 300)));
        const m = String(env.result || '').match(/\{[\s\S]*\}/);
        if (!m) return reject(new Error('The Judge gave no verdict.'));
        resolve({ verdict: JSON.parse(m[0]), cost: env.total_cost_usd || 0 });
      } catch (e) { reject(new Error(`Judge output unreadable: ${(err || out).slice(0, 200)}`)); }
    });
  });
}

export class Judge {
  constructor({ store, config, root, sitesDir }) {
    this.store = store;
    this.config = config;
    this.cwd = path.join(root, 'workspace');
    this.sitesDir = sitesDir;
    this.chain = Promise.resolve();
    this.busy = 0;
  }

  facts(lead) {
    if (!lead) return {};
    const p = lead.profile || {};
    return {
      business: lead.business, local_name: lead.business_local, city: lead.city, area: lead.area, niche: lead.niche,
      phone: lead.phone, whatsapp: lead.whatsapp, email: lead.email, website: lead.website, socials: lead.socials,
      rating: p.rating, review_count: p.review_count, followers: p.followers, hours: p.hours, address: p.address,
      services: p.services, verified_facts: (p.facts || []).filter((f) => f.verified).map((f) => f.text),
      assumptions: (p.facts || []).filter((f) => !f.verified).map((f) => f.text),
      owner_name: lead.owner_name, plan: lead.plan?.product,
    };
  }

  // One judgement at a time, so the owner's plan is not hammered.
  judge(kind, item, extra = {}) {
    const job = this.chain.then(() => this.#judge(kind, item, extra));
    this.chain = job.catch(() => {});
    return job;
  }

  async #judge(kind, item, extra) {
    const cfg = this.config.data;
    const lead = extra.lead || null;
    const market = this.config.market(lead?.market_id);
    const ctx = { facts: this.facts(lead), demoUrl: extra.demoUrl || '', offer: cfg.offer.pitch, language: market.language };
    if (kind === 'demo') {
      const file = path.join(this.sitesDir, item.slug, 'index.html');
      ctx.text = fs.existsSync(file) ? pageText(fs.readFileSync(file, 'utf8')) : '';
    }
    const fails = hardChecks(kind, item, ctx);
    const at = new Date().toISOString();
    if (fails.length) return { verdict: 'hold', score: 0, risk: 'high', summary: fails[0], reasons: fails, revised: null, by: 'rules', at };
    this.busy++;
    try {
      const { verdict: v, cost } = await runClaude(prompt(kind, item, ctx, cfg), cfg, this.cwd);
      const out = {
        verdict: ['approve', 'revise', 'hold'].includes(v.verdict) ? v.verdict : 'hold',
        score: Math.max(0, Math.min(100, Math.round(Number(v.score) || 0))),
        risk: ['low', 'medium', 'high'].includes(v.risk) ? v.risk : 'high',
        summary: String(v.summary || ''),
        reasons: Array.isArray(v.reasons) ? v.reasons.map(String).slice(0, 8) : [],
        revised: v.revised && typeof v.revised === 'object' && v.revised.body ? { subject: v.revised.subject || item.subject || '', body: String(v.revised.body) } : null,
        by: 'ai', cost, at,
      };
      if (kind === 'demo' && out.verdict === 'revise') out.verdict = 'hold';
      // the owner's bar: anything under the minimum score or not low-risk is held
      const min = cfg.sleep.judge_min_score;
      out.passes = (out.verdict === 'approve' || (out.verdict === 'revise' && out.revised)) && out.score >= min && out.risk === 'low';
      // a revised message must still pass the hard rules
      if (out.revised && hardChecks(kind, { ...item, ...out.revised }, ctx).length) { out.passes = false; out.verdict = 'hold'; }
      return out;
    } catch (e) {
      return { verdict: 'hold', score: 0, risk: 'high', summary: `The Judge could not check this: ${e.message}`, reasons: [], revised: null, by: 'error', at, passes: false };
    } finally { this.busy--; }
  }
}
