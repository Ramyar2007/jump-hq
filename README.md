# Jump HQ

**An AI team that finds your clients and runs your social media.** It's built for Sulaimani's online businesses and freelancers (ad makers, designers, marketers, developers, data analysts, Instagram and TikTok shops). It works 24/7 in Kurdish Sorani, Arabic and English, and the owner approves everything from the phone.

Jump HQ is a **public online service**. Customers sign up on our website, get their own private Jump HQ in seconds and pay monthly. There's nothing to install and no AI account needed: the agents run on our side.

SmartSuli AI Hackathon 2026, open track. Pitch and judge Q&A: [PITCH.md](PITCH.md).

## Plans

| Plan | Price | For |
|---|---|---|
| Free trial | $0 for 7 days | trying both modes |
| **Pro** | **$20 / month** | one freelancer or one online shop: both modes, 25 team jobs a day |
| **Agency** | **$60 / month** | agencies and teams: several brands, 80 team jobs a day |

Payment: FIB, card or bank transfer (works from Iraq). Plan limits are enforced on the server, so a customer can't raise their own limits or switch to a costlier model.

## Two modes, one team

### 1. Find clients
A short chat with the **setup assistant** (Settings → Your business) tells Jump HQ what you sell: ads, design, marketing, apps, websites, data… Every agent adapts to it: the search, the scoring, the free sample, the message and the price.

| Agent | What it does |
|---|---|
| **Team lead** | Takes plain-language orders ("find 10 dentists in Erbil and build samples for the best 2") and hands the work to the right specialist |
| **Scout** | Looks for buying signals in three languages: people asking for your service, brands already paying for ads, shops whose pages went quiet, hiring posts |
| **Investigator** | Proves each business is real: followers, recent posts, public contact. Every fact is marked *verified* or *assumed* |
| **Analyst** (Opportunity + Strategist + Reviewer) | Scores need, budget and reach. Only the best go on |
| **Builder** | Makes a free sample of your work for that business, whatever you sell: an ad concept (script + storyboard), a store page, a data report, a clickable app prototype, a small game, a website or a proposal (Kurdish RTL + English) |
| **Writer** | A short, honest WhatsApp message (or email) in natural Sorani with one link: the sample |
| **Closer** | When they reply, drafts the answer until they say yes |

You can also paste a business you already know (an Instagram, Maps or website link) under **Add a business** and build its sample right away.

### 2. Grow (your own pages)
- The **Content creator** agent plans the next posts from what you sell and what works in your niche right now.
- Jump HQ draws each post with its own templates: **1080×1350 picture posts** and **10-second vertical videos** (1080×1920) for Reels, TikTok and Stories. Kurdish and Arabic are fully right-to-left.
- Approved posts go out **on schedule** to your **Facebook Page** and **Telegram channel**. Instagram and TikTok: download and post with one tap.

### The AI Judge (on everything)
Every sample, message and post passes the Judge before it can leave. Hard rules run in code first (real contact, the sample link, no spam, no placeholders, no empty captions), then an independent AI review against the verified facts (no invented prices, results or reviews, no pressure, right language). Verdict: **approve / revise / hold**.

| Mode | Who approves |
|---|---|
| **Awake** | You approve everything. The Judge gives a second opinion with a score and reasons. |
| **Sleep** | The Judge approves safe work (score ≥ 80, low risk). Samples go online and emails send by themselves, within daily caps. WhatsApp messages wait for one tap. Anything risky is held. In the morning you get a **"While you slept"** report (also on Telegram). Sleep can run on a schedule, e.g. 23:00–08:00. |

## What the customer sees

**Website** (`public/cloud.html`, English and Kurdish): what the team does, plans, free week, sign up, sign in, account page with plan and usage.

**Dashboard** (their private Jump HQ): Home · Tasks · Businesses · Demos · Messages · Grow · AI team · Live map · Settings

- **Home:** Awake/Sleep switch, *Needs you*, live search progress, **Ask your team** box, Getting started checklist, numbers and activity.
- **Tasks:** every instruction and its answer, plus **Scheduled tasks** (chosen days and time, *Run now*).
- **Live map:** a 3D Sulaimani street (Pozaka Street) with real sun, moon and live weather. The team works inside the Jump HQ office, drones and a build beam show the work outside, and the city grows as more samples are built. Auto quality for weak laptops, with a 2D fallback. **Rehearsal** plays the whole flow with no AI cost.
- **Settings:** General (language) · Your business · Grow · Sleep mode · Connections (AI brain, email, WhatsApp, Telegram, Facebook Page, publishing, phone; each with steps and a **Test** button) · Phone app · Market and prices · Security.

**Phone app** (`app/`, Android, Expo): pair by QR code, Awake/Sleep, Needs you, Ask your team, Add a business, approve samples and messages, see the Judge's verdict, open WhatsApp with the message ready.

Everything is in **English, Kurdish Sorani and Arabic**: the website, dashboard, app, the agents' notes and the Judge.

## Owner side (us)

- **One private Jump HQ per customer:** own data, password, team and samples. It starts on demand behind the gateway and sleeps after 30 idle minutes.
- **Owner view** (`/cloud/admin`, secret key): customers, plans, jobs, samples, AI cost this month, revenue and profit. Marking a customer as paid unlocks their plan.
- **Token saver:** the cheap model for most jobs, the stronger one only for the Builder and the Content creator, merged checking steps and a step limit per job. A Pro customer costs us about $4–6 a month.

## Built during the hackathon (Oct 8–9)

Grow mode and the Content creator · setup for any business · the AI Judge and Sleep mode · Team lead, Tasks and scheduled tasks · the phone app · English / Sorani / Arabic everywhere · Connections hub · Live map · Jump HQ Cloud (website, plans, one Jump HQ per customer, owner view) · token saver.

The search → sample pipeline (Scout … Writer) was started on Oct 6, before the hackathon.

## How it is built

```
server/
  cloud.js     Jump HQ Cloud: public website, sign-up, plans, one private Jump HQ per customer, owner view
  index.js     each customer's Jump HQ: API, Ask + scheduled tasks, Sleep mode, night plan, phone keys, WebSocket
  runner.js    runs every agent job, queue, plan limits, token saver
  agents.js    the agents' instructions (Team lead, specialists, Content creator), shaped by "Your business"
  judge.js     hard rules + independent AI review: approve / revise / hold
  grow.js      Grow: picture posts and short videos, Judge, scheduled posting to Facebook and Telegram
  publish.js   approved samples go online (GitHub Pages)
  connect.js   Telegram alerts, public link, health checks
  codex.js     optional Codex engine, kept away from customer credentials
mcp/hq-mcp.js  the only way agents can change anything: a small token-protected MCP server
public/        website + dashboard (vanilla JS, no build step), map.js = Live map, i18n.js = all three languages
app/           phone app (Expo SDK 57, expo-router)
scripts/       host.mjs (hosting), selftest.js, i18n tools
```

**Hosting:** `Dockerfile` + `render.yaml` for a cloud server, or `Host Jump HQ.bat` (`scripts/host.mjs`), which starts the gateway with a public Cloudflare link and a sign-up cap. Environment: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `CLOUD_ADMIN_KEY`.

**Safety:** agents can't send or publish directly; outbound work only becomes approval requests. Agents run with a narrow tool set and only Jump HQ's own MCP connection. The Team lead can start work but never send, publish or approve. Customers are fully separated. Passwords are hashed, sign-in is rate-limited, phones get their own revocable keys, and there's a daily send cap and an opt-out line in every message. Public business information only, never private people.

**Check:** `node scripts/selftest.js`
