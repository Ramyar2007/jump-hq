# Jump HQ

**An AI sales team for web developers in Sulaimani.** It finds local businesses that have no proper website, checks them, builds each one a free demo website in Kurdish and English, and writes the WhatsApp message in Sorani. The owner approves from the phone. In **Sleep mode** an independent **AI Judge** approves safe work and holds anything risky until the morning.

SmartSuli AI Hackathon 2026, open track. Pitch: [PITCH.md](PITCH.md).

## What it does

1. **Search.** Pick a kind of business and a city (e.g. *restaurants, Sulaymaniyah*).
2. **Eight specialists** work through them: Scout → Investigator → Opportunity → Strategist → Reviewer → Builder → Writer → Closer. A ninth, the **Team lead**, takes plain-language instructions ("find 10 dentists in Erbil and build demos for the best 2", "which businesses are waiting for me?") and hands the work to the right specialist.
3. **The Judge** checks every demo and every message before it can leave. First come hard rules in code (real contact, the demo link, no spam, no placeholders), then an independent AI review against the verified facts (no invented claims, no pressure, the right language).
4. **The owner decides**: on the computer, or on the phone app.

| Mode | Who approves |
|---|---|
| Awake | You approve everything. The Judge gives a second opinion with a score and reasons. |
| Sleep | The Judge approves safe work (score ≥ 80 and low risk). Demos go online and emails send by themselves, within caps. WhatsApp messages wait for one tap. Anything risky is held. You get a morning report. |

## Using it (for a new team)

The first page shows a **Getting started** checklist. Everything else is three places:

| Where | What you do there |
|---|---|
| **Home → Ask your team** (also in the phone app) | Type what you want in your own words. The Team lead answers or starts the work. |
| **Tasks** | Every instruction and its answer, plus **Scheduled tasks**: repeat a search or an instruction on chosen days at a set time (e.g. Sunday to Thursday, 09:00). **Run now** tries one immediately. |
| **Demos / Messages** | Approve a demo (it goes online and the Writer drafts the message), then approve and send the message. |

**Live map**: a 3D Sulaimani street (Pozaka Street) with the real time of day and live weather. The team works inside Jump HQ (click an agent to fly to their desk); drones, a build beam and paper planes show the work out on the street; each demo floats over its shop. The city grows ring by ring as you build more demos. Quality is **Auto** by default: it measures the computer's speed and switches to a lighter mode on weak laptops; if 3D is impossible it shows the team as a simple list. **Rehearsal** plays the whole flow without spending any AI credits.

## Built during the hackathon (Oct 8–9)

- The AI Judge (`server/judge.js`) and Sleep mode with a schedule, a night search plan and a morning report (`server/index.js`)
- The phone app (`app/`, Expo / React Native): pair by QR, Awake/Sleep switch, approve messages, preview demos, one-tap WhatsApp, settings
- English, Kurdish Sorani and Arabic across the dashboard, the app, the agents' notes and the Judge (`public/i18n.js`, the single source, synced into the app)
- Connections hub: AI brain, email (SMTP), WhatsApp, Telegram alerts, GitHub Pages publishing, phone link
- Ask the team (the Team lead agent), Tasks page and scheduled tasks; Getting started checklist
- The Live map (`public/map.js`, Three.js): real sun and moon, Open-Meteo weather, office interior, growing city, auto quality for weak laptops
- Private public link for the phone (Cloudflare quick tunnel) plus a link beacon (a secret gist), so the phone finds the computer again after a restart

The search → demo pipeline (Scout … Writer) was started on Oct 6, before the hackathon.

## Run it

Needs Node 20+, and Claude Code installed and signed in on the computer (the agents run on the owner's Claude plan).

Double-click **Start Jump HQ.bat**. On a new computer it checks for Node.js (opens the download page if missing), installs what it needs the first time, and opens the dashboard. Or by hand:

```
npm install
npm start            # http://localhost:4777
```

First visit: create a password. Then **Settings → Phone app → Show pairing code**, and scan it with the app.

Phone app: `cd app && npm install && npx expo start`, or install the APK built with EAS (`npx eas-cli build -p android --profile preview`).

## How it is built

```
server/
  index.js     dashboard API, ask + scheduled tasks, phone pairing (device keys), Sleep mode, night plan, connections, WebSocket
  runner.js    starts each agent as a headless Claude Code session with a narrow tool set, queue + usage limits
  agents.js    the nine agents' prompts (Team lead + eight specialists) (owner-facing text in the owner's language)
  judge.js     hard rules + independent AI review; approve / revise / hold
  connect.js   Telegram alerts, Cloudflare tunnel, link beacon, health checks
  publish.js   approved demos → GitHub Pages
mcp/hq-mcp.js  the only way agents can change anything: a small MCP server over a token-protected local API
public/        dashboard (vanilla JS, no build step), map.js = the Live map, i18n.js = all three languages
app/           phone app (Expo SDK 57, expo-router)
```

**Safety:** agents can't send, publish, use a terminal or read files outside their folder. Outbound messages only become approval requests. The Team lead can start searches and queue specialists, but never send, publish or approve. The agent API is blocked from the public link. Phones get their own revocable keys. Five wrong passwords lock sign-in for a minute. There's a daily send cap and an opt-out line in every message.
