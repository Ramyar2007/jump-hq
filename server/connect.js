// Outside connections: Telegram alerts, the public link for the phone (Cloudflare quick tunnel),
// and health checks for every connection the Settings page shows.
import { spawn, execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const exists = (cmd) => new Promise((resolve) => execFile(process.platform === 'win32' ? 'where' : 'which', [cmd], { windowsHide: true }, (e, out) => resolve(e ? '' : String(out).split(/\r?\n/)[0].trim())));

export function lanUrl(port) {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal && !/^169\.254\./.test(n.address)) return `http://${n.address}:${port}`;
  }
  return '';
}

// ---- Telegram: the owner gets pinged on their phone ------------------------------------
export class Telegram {
  constructor(config) { this.config = config; }
  get on() { const t = this.config.data.connections.telegram; return Boolean(t.enabled && t.token && t.chat_id); }
  async send(text, cfg = this.config.data.connections.telegram) {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chat_id, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.description || `Telegram said ${res.status}`);
    return true;
  }
  notify(text) { if (this.on) this.send(text).catch(() => {}); }
  // Finds the chat id after the owner sent any message to their bot.
  async findChat(token) {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.description || 'That bot token did not work.');
    const msg = [...(data.result || [])].reverse().find((u) => u.message?.chat?.id);
    if (!msg) throw new Error('Open your bot in Telegram, press Start or send it "hi", then try again.');
    return String(msg.message.chat.id);
  }
}

// ---- Public link: a free Cloudflare quick tunnel so the phone works on mobile data -------
export class Tunnel {
  constructor({ port, onUrl }) { this.port = port; this.onUrl = onUrl; this.url = ''; this.proc = null; this.status = 'off'; this.wanted = false; this.bin = ''; }
  async start() {
    this.wanted = true;
    if (this.proc) return;
    this.bin ||= await exists('cloudflared') || (process.platform === 'win32' ? await exists(path.join('C:\\Program Files (x86)\\cloudflared', 'cloudflared.exe')) : '');
    if (!this.bin) { this.status = 'missing'; return; }
    this.status = 'starting';
    const p = spawn(this.bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${this.port}`], { windowsHide: true });
    this.proc = p;
    const read = (d) => {
      const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && m[0] !== this.url) { this.url = m[0]; this.status = 'on'; this.onUrl?.(this.url); }
    };
    p.stdout.on('data', read); p.stderr.on('data', read);
    p.on('close', () => {
      this.proc = null; this.url = ''; this.status = this.wanted ? 'restarting' : 'off'; this.onUrl?.('');
      if (this.wanted) setTimeout(() => this.start(), 5000);
    });
    p.on('error', () => { this.proc = null; this.status = 'missing'; });
  }
  stop() { this.wanted = false; if (this.proc) this.proc.kill(); this.proc = null; this.url = ''; this.status = 'off'; this.onUrl?.(''); }
  // A quick tunnel sometimes dies silently: check it answers, renew if not.
  async check() {
    if (!this.url || !this.proc) return;
    try { const r = await fetch(`${this.url}/api/ping`, { signal: AbortSignal.timeout(10000) }); if (r.ok) return; } catch {}
    this.proc?.kill();
  }
}

export async function claudeStatus() {
  const bin = process.env.CLAUDE_BIN || (process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', '.local', 'bin', 'claude.exe') : 'claude');
  return new Promise((resolve) => execFile(bin, ['--version'], { windowsHide: true, timeout: 15000 }, (e, out) => resolve(e ? { ok: false, detail: 'Claude Code is not installed or not signed in on this computer.' } : { ok: true, detail: String(out).trim() })));
}

export async function githubStatus() {
  return new Promise((resolve) => {
    const p = execFile('git', ['credential', 'fill'], { windowsHide: true, timeout: 10000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } }, (e, out) => resolve(!e && /password=/.test(out) ? { ok: true, detail: 'Signed in to GitHub on this computer.' } : { ok: false, detail: 'Not signed in to GitHub yet.' }));
    p.stdin.write('protocol=https\nhost=github.com\n\n'); p.stdin.end();
  });
}
