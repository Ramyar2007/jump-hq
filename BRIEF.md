# Jump HQ: agent-run web design agency (master brief)

**What it is:** a web dashboard (the "HQ") that runs Claude Code agents on the owner's own Claude
subscription (no API key) to run a small web design agency end to end:
find businesses with weak websites → build each a free concept redesign → publish the demo →
draft a personal email → handle replies → close. **Nothing leaves without the owner's approval.**

Owner: Ramyar (Jump, jumpagency.org, mailbox ramyar@jumpagency.org on Zoho free).
Started 2026-10-06. Market default: **United Kingdom**, independent restaurants, cafes, barbers, salons, dentists, trades.
Offer default: £349 one-time build + £29/month care (editable in Settings).

## Run it
- Double-click `Start Jump HQ.bat` (or `npm start`). Opens http://localhost:4777.
- First visit: create the dashboard password (min 8 chars). Change it later in Settings → Security.
- Your laptop must be on and logged into Claude Code (`claude` CLI) for agents to work.
- Phone access (later): install Tailscale on PC + phone, then start with `set HQ_HOST=0.0.0.0` and open `http://<pc-tailscale-ip>:4777`. Never expose it to the open internet: it can run agents on your PC.

## The staff (server/agents.js)
| # | Agent | Job | Tools |
|---|---|---|---|
| 01 | Scout | finds businesses in a city+niche with concrete website problems, public contact | WebSearch, WebFetch, hq |
| 02 | Builder | builds a single-file concept redesign from their real content into `sites/<slug>/index.html` | WebSearch, WebFetch, Read/Write/Edit/Glob, hq |
| 03 | Writer | drafts a 70-120 word honest email with one link (the public demo) → approvals | WebFetch, hq |
| 04 | Closer | reads a pasted reply, drafts the answer, updates the stage | WebFetch, Read, hq |
**Autopilot** = Scout, then auto-queues Builder for the top N new leads. Publishing + emailing stay manual approvals.

## Safety rails (do not remove)
- Agents run with `--permission-mode dontAsk` + a fixed tool allowlist, `--strict-mcp-config` (only the hq MCP), no Bash, `--setting-sources project,local` (no user hooks/MCPs). Workspace `CLAUDE.md` tells them to ignore the Peptonix rules.
- The ONLY way an agent changes agency state is the `hq` MCP server (mcp/hq-mcp.js) → token-protected `/agent-api`.
- Emails: agents can only call `hq_request_approval`. Sending = owner approves; manual (copy into Zoho) by default, or SMTP if configured. Daily send cap (default 8) protects the new domain.
- Demos are private (`/d/<slug>/`, login required) until the owner presses Publish (GitHub Pages repo `jump-demos` on the Ramyar2007 account, created on first publish, `robots.txt` disallow, "concept redesign, not the official site" bar on every demo).
- Usage guard: reads Claude's `rate_limit_event` (5-hour + 7-day windows), shows meters, auto-pauses the queue at 90% of the 5-hour window, max 1 agent at once, max 30 runs/day (Settings).
- Dashboard: password (scrypt), HttpOnly session cookie, login rate limit, binds 127.0.0.1 by default.

## Files
- `server/index.js` API + WebSocket + agent API · `server/runner.js` spawns `claude -p --output-format stream-json`, parses events, queue/limits/stop · `server/agents.js` prompts · `server/publish.js` GitHub Pages · `server/db.js` JSON store · `server/config.js` settings + password
- `public/` dashboard (vanilla JS, no build): Overview, Agents, Live, Pipeline (kanban, drag to move), Approvals (edit/approve/reject/mark sent), Demos (desktop+phone previews, publish), Activity, Settings
- `data/` (gitignored): config.json, db.json, sessions.json, runs/<id>.jsonl event logs
- `sites/` (gitignored here; is its own git repo for GitHub Pages once published)
- Test instance: `HQ_DATA=.test/data HQ_SITES=.test/sites HQ_PORT=4788 node server/index.js`; `.test/shots.mjs` = headless screenshots.

## Status log
- 2026-10-06: v1 built while the owner was away. Verified: API, auth, MCP tools (8), duplicate detection, approval → sent flow, a REAL Scout run (Leeds cafes: checked ~15, added 2 genuine leads with evidence), dashboard screenshots desktop + 390px, no console errors.
- Next: first real Builder run, publish first demo, warm up the mailbox (1-2 weeks of normal emails), then Writer drafts. Optional: Tailscale for phone access; demo.jumpagency.org CNAME → GitHub Pages; SMTP if Zoho allows.
