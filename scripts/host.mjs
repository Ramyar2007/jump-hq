// Host Jump HQ Cloud from this laptop: starts the gateway (server/cloud.js) and a free Cloudflare
// quick tunnel, then prints the public link and the owner view. Keep the window open while hosting.
//   node scripts/host.mjs            (PORT 8080, at most 25 sign-ups; agents use this PC's Claude login)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '8080';
const DATA = path.join(ROOT, 'cloud-data');
fs.mkdirSync(DATA, { recursive: true });

// The owner key stays the same between starts.
const keyFile = path.join(DATA, 'admin_key.txt');
if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(12).toString('hex'));
const ADMIN_KEY = fs.readFileSync(keyFile, 'utf8').trim();

const findCloudflared = () => {
  const list = process.platform === 'win32'
    ? ['C:\\Program Files (x86)\\cloudflared\\cloudflared.exe', 'C:\\Program Files\\cloudflared\\cloudflared.exe']
    : ['/usr/local/bin/cloudflared', '/usr/bin/cloudflared', '/opt/homebrew/bin/cloudflared'];
  return list.find((p) => fs.existsSync(p)) || 'cloudflared';
};

const env = { ...process.env, PORT, CLOUD_ADMIN_KEY: ADMIN_KEY, CLOUD_MAX_ACCOUNTS: process.env.CLOUD_MAX_ACCOUNTS || '25' };
const gw = spawn(process.execPath, [path.join(ROOT, 'server', 'cloud.js')], { env, stdio: 'inherit' });

let tunnel, url = '';
function startTunnel() {
  tunnel = spawn(findCloudflared(), ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], { windowsHide: true });
  tunnel.on('error', () => console.log('\n  cloudflared is missing. Install it: winget install Cloudflare.cloudflared\n'));
  let buf = '';
  const read = (d) => {
    buf = (buf + d).slice(-4000);
    const m = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/.exec(buf);
    if (!m || m[0] === url) return;
    url = m[0];
    console.log(`  Public link ${url} is starting (takes about 20 seconds)...`);
    waitLive().then(() => {
      fs.writeFileSync(path.join(ROOT, 'PUBLIC_LINK.txt'), `Jump HQ public link: ${url}\nOwner view: ${url}/cloud/admin?key=${ADMIN_KEY}\n`);
      console.log(`\n  ================================================================`);
      console.log(`   JUMP HQ IS LIVE:  ${url}`);
      console.log(`   Owner view:       ${url}/cloud/admin?key=${ADMIN_KEY}`);
      console.log(`   (also saved in PUBLIC_LINK.txt; keep this window open)`);
      console.log(`  ================================================================\n`);
      if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { windowsHide: true });
    });
  };
  tunnel.stdout.on('data', read); tunnel.stderr.on('data', read);
  tunnel.on('exit', () => { url = ''; setTimeout(startTunnel, 3000); });
}

// A new quick tunnel takes a few seconds before it answers.
// Asking too early makes Windows cache "not found" for the new name, so wait first and flush once.
async function waitLive() {
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  await nap(15000);
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(url + '/healthz', { signal: AbortSignal.timeout(8000) })).ok) return; } catch {}
    if (i === 5 && process.platform === 'win32') spawn('ipconfig', ['/flushdns'], { windowsHide: true });
    await nap(2000);
  }
}

// Renew the tunnel if it dies silently.
setInterval(async () => {
  if (!url) return;
  try { if ((await fetch(url + '/healthz', { signal: AbortSignal.timeout(10000) })).ok) return; } catch {}
  console.log('  Public link stopped answering, opening a new one...');
  tunnel.kill();
}, 5 * 60e3);

startTunnel();
const stop = () => { try { tunnel.removeAllListeners('exit'); tunnel.kill(); } catch {} gw.kill(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
gw.on('exit', (c) => { console.log(`Gateway stopped (${c}).`); stop(); });
