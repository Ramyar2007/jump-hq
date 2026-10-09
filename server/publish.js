// Publishes demo sites to a free public host. Default: one GitHub Pages repo
// (<owner>.github.io/<repo>/<slug>/) using the git credentials already on this PC.
// Runs only when the owner presses Publish.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = execFile(cmd, args, { windowsHide: true, maxBuffer: 1 << 24, ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} ${args[0]}: ${(stderr || err.message).trim()}`));
      else resolve(stdout.trim());
    });
    if (opts.input) { p.stdin.write(opts.input); p.stdin.end(); }
  });
}

export async function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const out = await run('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n' });
  const kv = Object.fromEntries(out.split('\n').map((l) => l.split('=')).filter((x) => x.length >= 2).map(([k, ...v]) => [k, v.join('=')]));
  if (!kv.password) throw new Error('No GitHub credentials found in git. Sign in to GitHub once with git on this PC.');
  return kv.password;
}

async function gh(token, method, url, body) {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'agency-hq', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : {} };
}

export class Publisher {
  constructor({ sitesDir, config }) {
    this.sitesDir = sitesDir;
    this.config = config;
    this.busy = false;
  }

  async ensureRepo() {
    const cfg = this.config.data.publish;
    const token = await githubToken();
    const me = await gh(token, 'GET', '/user');
    if (me.status !== 200) throw new Error('GitHub login failed: ' + JSON.stringify(me.data).slice(0, 200));
    const owner = me.data.login;
    let repo = await gh(token, 'GET', `/repos/${owner}/${cfg.repo}`);
    if (repo.status === 404) {
      repo = await gh(token, 'POST', '/user/repos', { name: cfg.repo, private: false, description: 'Concept website redesigns by Jump (jumpagency.org)', auto_init: false, has_issues: false, has_wiki: false });
      if (repo.status >= 300) throw new Error('Could not create repo: ' + JSON.stringify(repo.data).slice(0, 300));
    }
    const remote = `https://github.com/${owner}/${cfg.repo}.git`;
    if (!fs.existsSync(path.join(this.sitesDir, '.git'))) {
      await run('git', ['init', '-b', 'main'], { cwd: this.sitesDir });
      await run('git', ['remote', 'add', 'origin', remote], { cwd: this.sitesDir });
    }
    if (!fs.existsSync(path.join(this.sitesDir, 'index.html'))) {
      fs.writeFileSync(path.join(this.sitesDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Jump concepts</title><meta name="robots" content="noindex"><body style="font:16px system-ui;background:#0b0b0c;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><p>Concept redesigns by <a style="color:#ff4433" href="https://jumpagency.org">Jump</a>.</p></body>`);
      fs.writeFileSync(path.join(this.sitesDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
      fs.writeFileSync(path.join(this.sitesDir, '.nojekyll'), '');
    }
    if (!fs.existsSync(path.join(this.sitesDir, '.gitignore'))) fs.writeFileSync(path.join(this.sitesDir, '.gitignore'), '*/\n');
    return { token, owner, repo: cfg.repo };
  }

  async publish(slug) {
    if (this.busy) throw new Error('Another publish is in progress, try again in a moment.');
    this.busy = true;
    try {
      const dir = path.join(this.sitesDir, slug);
      if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error('This demo has no index.html yet.');
      const { token, owner, repo } = await this.ensureRepo();
      // Allow-list: every demo folder is ignored unless it was explicitly published.
      const gi = path.join(this.sitesDir, '.gitignore');
      const lines = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8').split(/\r?\n/).filter(Boolean) : ['*/'];
      if (!lines.includes('*/')) lines.unshift('*/');
      if (!lines.includes(`!${slug}/`)) lines.push(`!${slug}/`);
      fs.writeFileSync(gi, lines.join('\n') + '\n');
      await run('git', ['add', '-A'], { cwd: this.sitesDir });
      await run('git', ['-c', 'user.name=Jump', '-c', 'user.email=ramyar@jumpagency.org', 'commit', '-m', `Publish ${slug}`, '--allow-empty'], { cwd: this.sitesDir });
      await run('git', ['push', '-u', 'origin', 'main'], { cwd: this.sitesDir });
      const pages = await gh(token, 'GET', `/repos/${owner}/${repo}/pages`);
      if (pages.status === 404) await gh(token, 'POST', `/repos/${owner}/${repo}/pages`, { source: { branch: 'main', path: '/' } });
      const base = this.config.data.publish.base_url || `https://${owner.toLowerCase()}.github.io/${repo}`;
      return `${base.replace(/\/$/, '')}/${slug}/`;
    } finally {
      this.busy = false;
    }
  }
}
