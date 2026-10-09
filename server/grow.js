// Grow mode: the Content creator agent plans and designs posts; this module turns them into real
// images and short vertical videos, sends each one to the Judge, and posts approved ones on time
// to the connected pages (Facebook Page, Telegram channel). Instagram / TikTok: one tap from the owner.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { id } from './db.js';

const firstFile = (list) => list.find((p) => p && fs.existsSync(p));
const CHROME = process.env.CHROME_BIN || firstFile([
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
]) || 'chromium';
const FFMPEG = process.env.FFMPEG_BIN || firstFile([
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
  ...(() => { // winget's full build
    const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    try { return fs.readdirSync(base).filter((d) => /ffmpeg/i.test(d)).flatMap((d) => fs.readdirSync(path.join(base, d)).map((x) => path.join(base, d, x, 'bin', 'ffmpeg.exe'))); } catch { return []; }
  })(),
  '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg',
]) || 'ffmpeg';

const run = (bin, args, timeout = 120000) => new Promise((resolve, reject) => {
  execFile(bin, args, { timeout, windowsHide: true, maxBuffer: 8 << 20 }, (err, out, errOut) => (err ? reject(new Error(String(errOut || err.message).trim().split('\n').slice(-2).join(' ').slice(0, 300))) : resolve(out)));
});

// One HTML slide → one PNG at the exact size. A design that spills over its edges is shrunk to fit,
// so a layout slip by the agent never ships as a cut-off post.
const FIT = (w, h) => `<style>html,body{margin:0!important;width:${w}px!important;height:${h}px!important;overflow:hidden!important}</style>
<script>addEventListener('load',()=>setTimeout(()=>{const b=document.body;let r={l:0,t:0,r:0,b:0};for(const el of b.querySelectorAll('*')){const x=el.getBoundingClientRect();if(!x.width||!x.height)continue;r.l=Math.min(r.l,x.left);r.t=Math.min(r.t,x.top);r.r=Math.max(r.r,x.right);r.b=Math.max(r.b,x.bottom);}
const s=Math.min(1,${w}/(r.r-r.l),${h}/(r.b-r.t));if(s<0.995){const wrap=document.createElement('div');while(b.firstChild)wrap.appendChild(b.firstChild);b.appendChild(wrap);wrap.style.cssText='position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform-origin:0 0;transform:scale('+s+') translate('+(-r.l+(${w}/s-(r.r-r.l))/2)+'px,'+(-r.t+(${h}/s-(r.b-r.t))/2)+'px)';}},300));</script>`;
async function shoot(html, png, w, h, fit = true) {
  const src = fs.readFileSync(html, 'utf8');
  const tmp = html.replace(/\.html?$/i, '.render.html');
  fs.writeFileSync(tmp, !fit ? src : /<\/body>/i.test(src) ? src.replace(/<\/body>/i, `${FIT(w, h)}</body>`) : src + FIT(w, h));
  try {
    await run(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=5000',
      `--window-size=${w},${h}`, `--screenshot=${png}`, pathToFileURL(tmp).href]);
  } finally { fs.rmSync(tmp, { force: true }); }
  if (!fs.existsSync(png)) throw new Error('The image could not be drawn.');
}

// 2-4 vertical slides → one short video with a slow push-in and soft fades (about 3 s per slide).
async function reel(pngs, mp4) {
  const per = 3.2, fade = 0.5, fps = 30;
  const args = ['-y'];
  for (const p of pngs) args.push('-loop', '1', '-framerate', String(fps), '-t', String(per), '-i', p);
  const parts = pngs.map((_, i) => `[${i}:v]scale=1188:2112,zoompan=z='1+0.0009*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=${fps},setsar=1,format=yuv420p[v${i}]`);
  let last = 'v0';
  for (let i = 1; i < pngs.length; i++) {
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${(i * (per - fade)).toFixed(2)}[x${i}]`);
    last = `x${i}`;
  }
  args.push('-filter_complex', parts.join(';'), '-map', `[${last}]`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', mp4);
  await run(FFMPEG, args, 240000);
}

const SIZES = { image: [1080, 1350], video: [1080, 1920] };

// ---- Our own post templates: the agent writes the words and picks the look, these draw it. ----
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : d);
// "Grow **faster** with video" → the starred words in the accent colour.
const marked = (s) => escHtml(s).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>');
const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

export function slideHtml(sl, { w, h, theme, accent, brand, site, index, total }) {
  const a = hex(accent, '#ff6b2c');
  const T = {
    dark: { bg: `radial-gradient(1100px 900px at 85% 10%, ${a}33, transparent 60%), radial-gradient(900px 700px at 0% 100%, ${a}22, transparent 60%), #0b1120`, ink: '#f5f6fa', soft: '#aeb6c8', card: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.12)', hi: a, btn: a, btnInk: lum(a) > 0.6 ? '#0b1120' : '#ffffff' },
    light: { bg: `radial-gradient(1000px 800px at 100% 0%, ${a}26, transparent 60%), #f6f4ef`, ink: '#101626', soft: '#4d5568', card: '#ffffff', line: 'rgba(16,22,38,.10)', hi: a, btn: '#101626', btnInk: '#ffffff' },
    accent: { bg: `radial-gradient(1000px 900px at 100% 0%, rgba(255,255,255,.22), transparent 60%), ${a}`, ink: lum(a) > 0.6 ? '#0b1120' : '#ffffff', soft: lum(a) > 0.6 ? 'rgba(11,17,32,.72)' : 'rgba(255,255,255,.82)', card: lum(a) > 0.6 ? 'rgba(11,17,32,.08)' : 'rgba(255,255,255,.14)', line: 'rgba(0,0,0,.08)', hi: lum(a) > 0.6 ? '#0b1120' : '#ffffff', btn: lum(a) > 0.6 ? '#0b1120' : '#ffffff', btnInk: lum(a) > 0.6 ? '#ffffff' : a },
  }[theme] || null;
  const c = T || {};
  const tall = h > 1500;
  const pad = tall ? 96 : 84;
  const bullets = (Array.isArray(sl.bullets) ? sl.bullets : []).filter(Boolean).slice(0, 4);
  const big = String(sl.big || '').slice(0, 14);
  const rtl = /[؀-ۿ]/.test(`${sl.headline || ""}${sl.body || ""}${sl.kicker || ""}${sl.cta || ""}`);
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Vazirmatn:wght@500;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{background:${c.bg};color:${c.ink};font-family:'Plus Jakarta Sans','Vazirmatn',sans-serif;padding:${pad}px;display:flex;flex-direction:column}
.top{display:flex;align-items:center;justify-content:space-between;gap:24px;font-size:${tall ? 34 : 30}px;font-weight:800}
.logo{display:flex;align-items:center;gap:16px}.logo i{width:${tall ? 58 : 52}px;height:${tall ? 58 : 52}px;border-radius:16px;background:${c.hi};color:${c.btnInk};display:grid;place-items:center;font-style:normal;font-size:${tall ? 32 : 28}px}
.site{font-weight:600;color:${c.soft};font-size:${tall ? 28 : 26}px}
.c{flex:1;display:flex;flex-direction:column;justify-content:center;gap:${tall ? 44 : 34}px;min-height:0;overflow:hidden;padding:${tall ? 40 : 28}px 0}
.k{align-self:flex-start;font-size:${tall ? 30 : 28}px;font-weight:800;letter-spacing:.04em;padding:12px 26px;border-radius:999px;background:${c.card};border:2px solid ${c.line};color:${c.hi}}
.big{font-size:${tall ? 260 : 220}px;font-weight:900;line-height:.95;color:${c.hi};letter-spacing:-.03em}
h1{font-size:${tall ? 124 : 104}px;line-height:1.08;font-weight:800;letter-spacing:-.02em}
h1 em{font-style:normal;color:${c.hi}}
p.b{font-size:${tall ? 46 : 40}px;line-height:1.38;color:${c.soft};font-weight:500}
ul{list-style:none;display:flex;flex-direction:column;gap:${tall ? 22 : 18}px}
li{display:flex;gap:22px;align-items:center;font-size:${tall ? 44 : 38}px;font-weight:700;line-height:1.25;background:${c.card};border:2px solid ${c.line};border-radius:26px;padding:${tall ? 30 : 24}px 32px}
li b{flex:none;width:${tall ? 50 : 44}px;height:${tall ? 50 : 44}px;border-radius:50%;background:${c.hi};color:${c.btnInk};display:grid;place-items:center;font-size:${tall ? 28 : 24}px}
.cta{display:flex;align-items:center;justify-content:space-between;gap:24px}
.btn{font-size:${tall ? 44 : 38}px;font-weight:800;background:${c.btn};color:${c.btnInk};padding:${tall ? 34 : 28}px ${tall ? 50 : 42}px;border-radius:28px}
.dots{display:flex;gap:12px}.dots s{width:18px;height:18px;border-radius:50%;background:${c.line}}.dots s.on{background:${c.hi};width:46px;border-radius:9px}
</style></head><body>
<div class="top"><div class="logo"><i>${escHtml(String(brand || 'J').trim()[0] || 'J')}</i><span dir="auto">${escHtml(brand)}</span></div>${site ? `<span class="site" dir="ltr">${escHtml(site)}</span>` : ''}</div>
<div class="c" id="c">
${sl.kicker ? `<div class="k" dir="auto">${escHtml(sl.kicker)}</div>` : ''}
${big ? `<div class="big" dir="auto">${escHtml(big)}</div>` : ''}
${sl.headline ? `<h1 dir="auto">${marked(sl.headline)}</h1>` : ''}
${sl.body ? `<p class="b" dir="auto">${marked(sl.body)}</p>` : ''}
${bullets.length ? `<ul>${bullets.map((b, i) => `<li dir="auto"><b>${i + 1}</b><span>${marked(b)}</span></li>`).join('')}</ul>` : ''}
</div>
<div class="cta">${sl.cta ? `<div class="btn" dir="auto">${escHtml(sl.cta)}</div>` : '<span></span>'}${total > 1 ? `<div class="dots">${Array.from({ length: total }, (_, i) => `<s class="${i === index ? 'on' : ''}"></s>`).join('')}</div>` : ''}</div>
<script>
// shrink the text until everything fits the canvas
addEventListener('load',()=>{const c=document.getElementById('c');const els=[...c.querySelectorAll('h1,p.b,li,.big,.k')];let n=0;
while(c.scrollHeight>c.clientHeight+1&&n++<40){for(const e of els){const fs=parseFloat(getComputedStyle(e).fontSize);e.style.fontSize=(fs*0.94)+'px';}}});
</script></body></html>`;
}

export class Grow {
  constructor({ store, config, judge, dataDir, say, telegram, asleep }) {
    Object.assign(this, { store, config, judge, say, telegram, asleep });
    this.dir = path.join(dataDir, 'posts');
    fs.mkdirSync(this.dir, { recursive: true });
    store.data.posts ||= [];
    // anything half-made when the server stopped is shown as failed, not stuck forever
    for (const p of store.data.posts) if (['making', 'judging', 'posting'].includes(p.status)) p.status = p.media ? 'pending' : 'failed';
    setInterval(() => this.tick(), 30e3);
  }

  get posts() { return this.store.data.posts; }
  get social() { return this.config.data.connections.social || {}; }
  runDir(runId) { return path.join(this.dir, runId); }
  get(pid) { return this.posts.find((p) => p.id === pid); }
  set(p, patch) { Object.assign(p, patch); this.store.save(); this.store.emit('post', p); return p; }

  platforms() {
    const s = this.social, tg = this.config.data.connections.telegram;
    return {
      facebook: Boolean(s.fb_page_id && s.fb_token),
      telegram: Boolean(s.telegram_channel && tg.token),
      instagram: 'tap', tiktok: 'tap',
    };
  }

  // The Content creator finished: read its posts.json, draw every post, then judge it.
  async importRun(runRec) {
    const dir = this.runDir(runRec.id);
    const file = path.join(dir, 'posts.json');
    if (!fs.existsSync(file)) return this.store.log(this.say('grow_none'), { kind: 'error', run_id: runRec.id });
    let list;
    try { list = JSON.parse(fs.readFileSync(file, 'utf8')); list = Array.isArray(list) ? list : list.posts; } catch { return this.store.log(this.say('grow_none'), { kind: 'error' }); }
    let made = 0;
    for (const [i, raw] of (list || []).slice(0, 14).entries()) {
      const format = raw.format === 'video' ? 'video' : 'image';
      // a slide is the words for our template ({headline, body, ...}) or, for old runs, an HTML file name
      const slides = (Array.isArray(raw.slides) ? raw.slides : [raw.slide || raw.html]).filter(Boolean).map((x) => (typeof x === 'object' ? x : String(x))).slice(0, format === 'video' ? 4 : 1);
      const p = {
        id: id('post'), run_id: runRec.id, n: i + 1, format, slides,
        title: String(raw.title || '').slice(0, 80), caption: String(raw.caption || '').slice(0, 2200),
        hashtags: (Array.isArray(raw.hashtags) ? raw.hashtags : String(raw.hashtags || '').split(/\s+/)).map((h) => String(h).replace(/^#?/, '#')).filter((h) => h.length > 1).slice(0, 15),
        scheduled_at: Number.isNaN(Date.parse(raw.scheduled_at)) ? new Date(Date.now() + (i + 1) * 864e5).toISOString() : new Date(raw.scheduled_at).toISOString(),
        theme: ['dark', 'light', 'accent'].includes(raw.theme) ? raw.theme : 'dark', accent: hex(raw.accent, ''),
        status: 'making', media: '', created: new Date().toISOString(), results: {},
      };
      this.posts.unshift(p); this.store.save(); this.store.emit('post', p);
      try {
        await this.render(p, dir);
        made++;
        this.set(p, { status: 'judging' });
        this.review(p.id);
      } catch (e) { this.set(p, { status: 'failed', error: e.message }); }
    }
    this.store.log(this.say('grow_made', { n: made }), { kind: made ? 'done' : 'error', run_id: runRec.id });
  }

  async render(p, dir) {
    const [w, h] = SIZES[p.format];
    const pngs = [];
    const co = this.config.data.company || {};
    for (const [k, s] of p.slides.entries()) {
      let html;
      if (typeof s === 'object') {
        html = path.join(dir, `post${p.n}-${k + 1}.html`);
        const site = String(co.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        fs.writeFileSync(html, slideHtml(s, { w, h, theme: p.theme, accent: p.accent, brand: co.name || 'Jump', site, index: k, total: p.slides.length }));
      } else {
        html = path.resolve(dir, s);
        if (!html.startsWith(path.resolve(dir)) || !fs.existsSync(html)) throw new Error(`Missing design file ${s}`);
      }
      const png = path.join(dir, `post${p.n}-${k + 1}.png`);
      await shoot(html, png, w, h, typeof s !== 'object');
      pngs.push(png);
    }
    if (!pngs.length) throw new Error('No design was made for this post.');
    if (p.format === 'image') return this.set(p, { media: `${p.run_id}/${path.basename(pngs[0])}` });
    const mp4 = path.join(dir, `post${p.n}.mp4`);
    await reel(pngs, mp4);
    this.set(p, { media: `${p.run_id}/post${p.n}.mp4`, poster: `${p.run_id}/${path.basename(pngs[0])}` });
  }

  text(p) {
    const dir = this.runDir(p.run_id);
    const slideText = p.slides.map((s) => { if (typeof s === 'object') return Object.values(s).flat().join(' ').replace(/\*\*/g, ''); try { return fs.readFileSync(path.resolve(dir, s), 'utf8'); } catch { return ''; } })
      .join(' ').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return slideText.slice(0, 3000);
  }

  async review(pid) {
    let p = this.get(pid);
    if (!p) return;
    const v = await this.judge.judge('post', { caption: p.caption, hashtags: p.hashtags, text: this.text(p), format: p.format });
    p = this.get(pid);
    if (!p || p.status === 'discarded') return;
    const patch = { judge: v, status: 'pending' };
    if (v.revised?.body) { patch.original_caption = p.caption; patch.caption = v.revised.body; }
    // Sleep mode: what the Judge passes is scheduled by itself.
    if (this.asleep() && v.passes) Object.assign(patch, { status: 'approved', auto: true });
    this.set(p, patch);
  }

  approve(pid, edits = {}) {
    const p = this.get(pid);
    if (!p) throw new Error('No such post');
    const patch = { status: 'approved', approved_at: new Date().toISOString() };
    if (typeof edits.caption === 'string') patch.caption = edits.caption.slice(0, 2200);
    if (edits.scheduled_at && !Number.isNaN(Date.parse(edits.scheduled_at))) patch.scheduled_at = new Date(edits.scheduled_at).toISOString();
    return this.set(p, patch);
  }

  discard(pid) { const p = this.get(pid); if (!p) throw new Error('No such post'); return this.set(p, { status: 'discarded' }); }

  async postNow(pid) {
    const p = this.get(pid);
    if (!p) throw new Error('No such post');
    return this.publish(p);
  }

  async tick() {
    const due = this.posts.filter((p) => p.status === 'approved' && Date.parse(p.scheduled_at) <= Date.now());
    for (const p of due) { try { await this.publish(p); } catch {} }
  }

  async publish(p) {
    if (!p.media) throw new Error('This post has no picture or video yet.');
    const on = this.platforms();
    if (!on.facebook && !on.telegram) {
      this.set(p, { status: 'ready' });
      return p;
    }
    this.set(p, { status: 'posting' });
    const file = path.join(this.dir, p.media);
    const body = [p.caption, p.hashtags.join(' ')].filter(Boolean).join('\n\n');
    const results = { ...p.results };
    if (on.facebook && !results.facebook?.ok) results.facebook = await this.toFacebook(file, body, p.format).then((u) => ({ ok: true, url: u }), (e) => ({ ok: false, error: e.message }));
    if (on.telegram && !results.telegram?.ok) results.telegram = await this.toTelegram(file, body, p.format).then((u) => ({ ok: true, url: u }), (e) => ({ ok: false, error: e.message }));
    const ok = Object.values(results).some((r) => r.ok);
    this.set(p, { results, status: ok ? 'posted' : 'failed', posted_at: ok ? new Date().toISOString() : p.posted_at, error: ok ? '' : Object.values(results).map((r) => r.error).filter(Boolean)[0] });
    this.store.log(this.say(ok ? 'grow_posted' : 'grow_post_fail', { t: p.title || `#${p.n}`, w: Object.keys(results).filter((k) => results[k].ok).join(', ') }), { kind: ok ? 'done' : 'error' });
    if (ok && this.asleep()) this.telegram.notify(`📣 Posted: ${p.title || p.caption.slice(0, 60)}`);
    return p;
  }

  async toFacebook(file, body, format) {
    const s = this.social;
    const form = new FormData();
    form.append('access_token', s.fb_token);
    form.append(format === 'video' ? 'description' : 'caption', body);
    form.append('source', new Blob([fs.readFileSync(file)]), path.basename(file));
    const host = format === 'video' ? 'https://graph-video.facebook.com' : 'https://graph.facebook.com';
    const res = await fetch(`${host}/v21.0/${encodeURIComponent(s.fb_page_id)}/${format === 'video' ? 'videos' : 'photos'}`, { method: 'POST', body: form, signal: AbortSignal.timeout(180000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error?.message || `Facebook said ${res.status}`);
    return `https://www.facebook.com/${data.post_id || data.id}`;
  }

  async toTelegram(file, body, format) {
    const tg = this.config.data.connections.telegram;
    const form = new FormData();
    form.append('chat_id', this.social.telegram_channel);
    form.append('caption', body.slice(0, 1024));
    form.append(format === 'video' ? 'video' : 'photo', new Blob([fs.readFileSync(file)]), path.basename(file));
    const res = await fetch(`https://api.telegram.org/bot${tg.token}/${format === 'video' ? 'sendVideo' : 'sendPhoto'}`, { method: 'POST', body: form, signal: AbortSignal.timeout(180000) });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.description || `Telegram said ${res.status}`);
    const ch = String(this.social.telegram_channel);
    return ch.startsWith('@') ? `https://t.me/${ch.slice(1)}/${data.result.message_id}` : '';
  }

  // Settings → Connections → Social pages: a real test against each connected page.
  async test() {
    const s = this.social, out = [];
    if (s.fb_page_id && s.fb_token) {
      const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(s.fb_page_id)}?fields=name&access_token=${encodeURIComponent(s.fb_token)}`, { signal: AbortSignal.timeout(15000) });
      const d = await r.json().catch(() => ({}));
      if (d.error || !d.name) throw new Error(`Facebook: ${d.error?.message || 'page not found'}`);
      out.push(`Facebook Page "${d.name}"`);
    }
    if (s.telegram_channel) {
      const tg = this.config.data.connections.telegram;
      if (!tg.token) throw new Error('Telegram: add your bot token under Telegram alerts first.');
      const r = await fetch(`https://api.telegram.org/bot${tg.token}/getChat?chat_id=${encodeURIComponent(s.telegram_channel)}`, { signal: AbortSignal.timeout(15000) });
      const d = await r.json().catch(() => ({}));
      if (!d.ok) throw new Error(`Telegram: ${d.description || 'channel not found'}. Add your bot to the channel as an admin.`);
      out.push(`Telegram channel "${d.result.title}"`);
    }
    if (!out.length) throw new Error('Add a Facebook Page or a Telegram channel first.');
    return `Connected: ${out.join(' and ')}.`;
  }
}
