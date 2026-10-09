# Jump HQ: SmartSuli AI Hackathon pitch

**One line:** An AI sales team that finds Sulaimani businesses with no proper website, builds each one a free demo site in Kurdish and English, and writes the WhatsApp message. You approve from your phone. At night, an AI Judge approves for you.

---

## The problem (one, specific, Sulaimani)

Most restaurants, salons, clinics and shops in Sulaimani live only on Instagram and Facebook. Their menu is photos in posts. There are no opening hours, no booking, and nothing comes up when someone searches.

The people who could fix this, Sulaimani's young web developers and small studios, can't reach them at scale. Finding businesses by hand, checking them, designing a sample and writing a message in good Sorani takes hours per business. Upwork, Fiverr and Stripe payouts don't work from Iraq, so local clients are the market. Most of these developers give up after a few tries.

**Problem in one sentence:** Sulaimani businesses stay offline because selling them a website one by one is too slow for the developers who could build it.

## The solution

Jump HQ is a team of AI agents that does the slow part:

| Step | Agent | What it does |
|---|---|---|
| 1 | Scout | Searches Google, maps and Instagram in English, Kurdish and Arabic ("چێشتخانە سلێمانی") for real, active businesses |
| 2 | Investigator | Checks each business is real and open, and builds a profile. Every fact is marked *verified* or *assumed* |
| 3 | Opportunity | Scores 0–100: do they really need a site, can they pay, can we reach them |
| 4 | Strategist | Decides what *this* business needs: a menu with WhatsApp ordering, booking, a price list |
| 5 | Reviewer | Double-checks before anything is built |
| 6 | Builder | Builds the demo website from their real content. Kurdish by default (right-to-left) plus English, phone-first |
| 7 | Writer | Writes a short, honest WhatsApp message in natural Sorani with one link: their demo |
| 8 | Closer | When they reply, drafts the answer |
| ⚖ | **Judge** | Independent reviewer: checks every demo and message against the verified facts before it can go out |

**The owner does one thing: approve or reject, on the phone.**

## What is new (built during the 2 hackathon days)

1. **Sleep mode with an AI Judge.** Press Sleep (or schedule 23:00–08:00) and the team keeps working alone. Each demo and message goes to the Judge first. Rules in code catch a wrong number, a missing link or spam. Then an AI review checks for invented facts, pressure or a wrong tone. Safe items go out; anything risky waits for the morning. You wake up to a report: "While you slept: 2 searches, 20 businesses, 4 demos, 3 messages ready, 1 held."
   - *Real catches from testing:* it flagged an email that praised "online booking in three steps" that nothing we know supports, and rewrote it. It held a message that used a phone number that wasn't the business's own.
2. **Phone app** (Android). Pair it by scanning a QR code. It works on mobile data from anywhere through a private, secure link. From the phone you can switch Awake/Sleep, approve messages, preview demos and send in WhatsApp with one tap.
3. **Whole product in English, Kurdish Sorani and Arabic**: dashboard, phone app, and every note and report the agents write for the owner.
4. **Connections hub**: AI brain, email sending, WhatsApp, Telegram alerts, demo publishing, phone. Each has a status, plain steps and a Test button.

*Honest note for the judges:* the search → demo pipeline was started on Oct 6. Everything in this list was built Oct 8–9 at the hackathon.

## Where the AI is (criterion 3)

AI does every step: search, checking the facts, scoring, product planning, building the website, writing in Sorani, answering replies and judging safety. The human only decides. Two independent AI layers (the Reviewer before building, the Judge before anything goes out) keep it honest.

## Business model

**Who pays:** web freelancers and small agencies in Kurdistan (and abroad), and our own studio.

| Plan | Price | For |
|---|---|---|
| Solo | **25,000 IQD / month** (~$19) | one freelancer: 150 businesses checked, 50 demos a month |
| Studio | **65,000 IQD / month** (~$49) | small agency: 500 businesses, team, its own domain |
| Done for you | **350,000 IQD** per website + **35,000 IQD / month** care | our own studio sells the websites directly (our real prices) |

**Our cost, from real runs:** ~$0.22 (≈290 IQD) to research one business end to end. A demo site costs ~$0.11, a message ~$0.05, a Judge check ~$0.03. A Solo user who checks 150 businesses costs us about **$5–8 a month**, so the margin is **~65–75%**.

**Why a freelancer pays:** one website sold (350,000 IQD) pays for **14 months** of Solo.

## First month (projections, clearly labelled)

- **Own studio (Sulaimani + Erbil):** 2 searches a night × 10 businesses ≈ 600 businesses checked → ~60 demos → 60 WhatsApp messages. At a 10% reply rate that is 6 conversations, and 2–3 clients ≈ **700,000–1,050,000 IQD** plus **70,000–105,000 IQD / month** recurring.
- **Subscriptions:** 10 freelancers from the hackathon network and Sulaimani developer groups × 25,000 IQD ≈ **250,000 IQD / month** recurring.
- **Month 3 target:** 50 paying users ≈ 1,250,000 IQD / month recurring, and 10 studio clients.

## 3-minute script (Round 1)

**0:00–0:20 Problem.** "Walk down Salim Street. Most of the restaurants and salons have no website, only Instagram photos. And Sulaimani's young developers can't sell to them fast enough. Doing it one by one is too slow."

**0:20–0:45 Solution.** "Jump HQ is an AI sales team. I choose *restaurants, Sulaymaniyah*. Eight agents find them, check they're real, score them, build each one a free website in Kurdish, and write the WhatsApp message in Sorani."

**0:45–1:40 Live demo (phone in hand).**
- Home: show the real Sulaimani results from today's search (found → checked → worth it → demos).
- Open a demo: a Kurdish website made for a real restaurant.
- Messages: the Judge's verdict ("88/100, safe"). Tap Approve, and WhatsApp opens with the message ready.

**1:40–2:10 Sleep mode.** "At night I press Sleep. The team keeps working. Before anything goes out, an independent AI Judge checks it against the facts. In testing it caught an invented compliment and a wrong phone number. In the morning I get a report."

**2:10–2:45 Money.** "Freelancers pay 25,000 dinars a month. One website sold pays for 14 months. Our cost is about 300 dinars per business researched. We also sell the websites ourselves: 350,000 dinars each plus monthly care."

**2:45–3:00 Close.** "Built at this hackathon: the Judge, Sleep mode, the phone app, Kurdish and Arabic. Jump HQ gets Sulaimani's businesses online, and pays the developers who do it."

## Likely judge questions

- **Is it spam?** No. Nothing is sent without the owner or the Judge. There's a daily cap (8 by default), every message has a clear opt-out, and it only uses the business's own public contact. The Judge holds anything that looks pushy or invented.
- **What if the AI invents facts?** Every fact is marked verified or assumed. The Reviewer and the Judge both check against it, and demos say "concept website, not the official site".
- **Why not just ChatGPT?** It's a whole pipeline: search, verify, score, build, write, judge, send. It runs in Kurdish, on its own at night, with safety checks.
- **Privacy?** Public business information only, never private people. Everything runs on the owner's own computer.
- **Can it scale beyond Sulaimani?** Markets are settings: Kurdistan (IQD, Sorani, WhatsApp) and the UK (GBP, English, email) are already set up.
