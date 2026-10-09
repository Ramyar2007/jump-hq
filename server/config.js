import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULTS = {
  company: {
    name: 'Jump',
    website: 'https://jumpagency.org',
    sender_name: 'Ramyar',
    sender_email: 'ramyar@jumpagency.org',
    signature: 'Ramyar\nJump, web design studio\njumpagency.org',
  },
  // Markets: where we look for clients. Each has its own language, money, prices and how we reach people.
  market_id: 'krd',
  markets: {
    krd: {
      id: 'krd',
      label: 'Kurdistan Region',
      country: 'Iraq (Kurdistan Region)',
      currency: 'IQD',
      language: 'Kurdish Sorani',
      site_languages: ['Kurdish Sorani', 'English'],
      channel: 'whatsapp',
      phone_prefix: '964',
      build_price: 350000,
      monthly_price: 35000,
      cities: ['Sulaymaniyah', 'Erbil', 'Duhok', 'Halabja', 'Ranya', 'Kalar', 'Zakho', 'Koya'],
      niches: ['restaurants', 'cafes', 'beauty salons', 'barbershops', 'dental clinics', 'medical clinics', 'gyms', 'hotels', 'bakeries and sweet shops', 'clothing shops', 'car showrooms', 'real estate offices'],
    },
    uk: {
      id: 'uk',
      label: 'United Kingdom',
      country: 'United Kingdom',
      currency: 'GBP',
      language: 'English',
      site_languages: ['English'],
      channel: 'email',
      phone_prefix: '44',
      build_price: 349,
      monthly_price: 29,
      cities: ['Manchester', 'Leeds', 'Bristol', 'Birmingham', 'Liverpool', 'Sheffield', 'Nottingham', 'Glasgow', 'Edinburgh', 'Brighton'],
      niches: ['independent restaurants', 'cafes and coffee shops', 'barbers', 'beauty salons', 'dental clinics', 'plumbers and electricians'],
    },
  },
  offer: {
    pitch: 'A fast, mobile-first website made for this business before they pay anything. If they like it, we put it live on their own address and look after it every month (hosting, edits, updates).',
  },
  limits: {
    concurrency: 1,
    daily_runs: 30,
    pause_at_utilization: 0.9,
    model: 'sonnet',
    max_turns: 60,
  },
  qualify: {
    threshold: 70, // build at or above this score
    hold: 50, // 50-69 = keep for later, below = skip
    batch: 6,
  },
  outreach: {
    daily_send_cap: 8,
    sender: 'manual',
  },
  publish: {
    method: 'github',
    repo: 'jump-demos',
    base_url: '',
  },
  smtp: { host: 'smtp.zoho.com', port: 465, secure: true, user: '', pass: '' },
  auth: { salt: '', hash: '' },
  mcp_token: '',
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
}

export class Config {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const stored = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    delete stored.market; // v1 single market → markets{}
    if (stored.offer) { delete stored.offer.build_price; delete stored.offer.monthly_price; }
    this.data = deepMerge(DEFAULTS, stored);
    if (!this.data.mcp_token) this.data.mcp_token = crypto.randomBytes(24).toString('hex');
    this.save();
  }

  save() { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); }

  update(patch) {
    const safe = { ...patch };
    delete safe.auth; delete safe.mcp_token;
    this.data = deepMerge(this.data, safe);
    this.save();
    return this.public();
  }

  market(mid) {
    const m = this.data.markets[mid || this.data.market_id] || Object.values(this.data.markets)[0];
    return m;
  }

  // The settings as seen from one market (what the agents get in their prompt).
  view(mid) {
    const m = this.market(mid);
    return { ...this.data, market: m, offer: { ...this.data.offer, build_price: m.build_price, monthly_price: m.monthly_price } };
  }

  // Never send secrets to the browser.
  public() {
    const d = structuredClone(this.data);
    delete d.auth; delete d.mcp_token;
    d.smtp = { ...d.smtp, pass: d.smtp.pass ? '••••••••' : '' };
    d.has_password = Boolean(this.data.auth.hash);
    return d;
  }

  setPassword(pw) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
    this.data.auth = { salt, hash };
    this.save();
  }

  checkPassword(pw) {
    const { salt, hash } = this.data.auth;
    if (!salt || !hash) return false;
    const got = crypto.scryptSync(String(pw), salt, 64);
    const want = Buffer.from(hash, 'hex');
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  }
}
