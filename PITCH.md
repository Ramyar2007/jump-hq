# Jump HQ: SmartSuli AI Hackathon pitch

**One line:** An AI sales team for any service business in Sulaimani (web studios, AI video ad makers, marketers, data analysts, app studios). Tell it what you sell. It finds the clients who need it, makes each one a free sample of your work, and writes the WhatsApp message in Kurdish. You approve from your phone. At night, an AI Judge approves for you.

---

## The problem (one, specific, Sulaimani)

Sulaimani is full of skilled people who sell a service: web developers, AI video ad makers, marketers, designers, data analysts, small agencies. Their problem is not skill. It is finding clients.

Every client is found the slow way. They search by hand, check the business is real, make a sample of their work and write a good message in Sorani. That takes hours per client. Upwork, Fiverr and Stripe payouts don't work from Iraq, so local clients are the market. Most of them give up after a few tries.

The clients are right there. Most restaurants, salons, clinics and shops live only on Instagram: no website, no ads beyond posts, no booking, no numbers.

**Real numbers, from our own agents today (9 Oct), for one trade (websites):** they searched Sulaimani restaurants and beauty salons. Only 9 could be found online at all, and **0 of the 9 had a website**. The top salon has 28,400 Instagram followers and posts almost daily, yet its bio links only to a map pin.

**Problem in one sentence:** Sulaimani's freelancers and small agencies stay without work, and local businesses stay without their help, because finding and pitching clients one by one is too slow.

**How it adapts:** a 2-minute setup chat (Settings → Your business) tells every agent what you sell. The search, the scoring, the free sample, the message and the prices all change with it. The free sample is a demo website, an ad concept (script and storyboard), a campaign proposal, a sample data report or a clickable app prototype.

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
5. **Jump HQ Cloud**: a public website with sign-up, a free week and monthly plans. Each customer gets a private Jump HQ on our server, and the owner view shows revenue, AI cost and profit.
6. **Token saver**: the cheap model for most steps, 3 checking steps merged into 1, and step limits per job.

*Honest note for the judges:* the search → demo pipeline was started on Oct 6. Everything in this list was built Oct 8–9 at the hackathon.

## Where the AI is (criterion 3)

AI does every step: search, checking the facts, scoring, product planning, building the website, writing in Sorani, answering replies and judging safety. The human only decides. Two independent AI layers (the Reviewer before building, the Judge before anything goes out) keep it honest.

## Business model: Jump HQ Cloud (hosted, monthly)

Jump HQ runs **online**. A freelancer or studio signs up at the website, gets their own private Jump HQ in seconds and pays monthly. No install, no Claude account, no setup: the agents run on **our** API key, so every customer is recurring revenue for us, and we control the cost.

| Plan | Price | Limit | For |
|---|---|---|---|
| Free trial | 0, 7 days | 6 team jobs a day | trying it |
| **Starter** | **$15 / month** (≈20,000 IQD) | 20 jobs a day, ~30 demos a month | one freelancer |
| **Pro** | **$40 / month** (≈52,000 IQD) | 60 jobs a day, ~100 demos a month | agencies, small teams |
| Done for you | 350,000 IQD per website + 35,000 IQD / month care | | our own studio sells the websites directly |

Payment: FIB, card or bank transfer (works from Iraq). The plan limit is enforced on the server, so a customer can't run up our bill.

**Owner view** (`/cloud/admin`): every customer, their plan, jobs, demos, **AI cost this month and profit**, live.

### Token saver (cut our cost per customer)
- The cheap model (Haiku) does searching, checking, scoring and writing. Only the Builder (the demo site) uses the stronger model.
- **Opportunity + Strategist + Reviewer merged into one Analyst step**: 6 steps per search became 4.
- Every job has a step limit (6–30 instead of 60). The AI Judge's code rules run first, for free.

**Our cost (measured on the old setup, before the saver):** ~$0.22 to research one business end to end, ~$0.11 per demo site, ~$0.05 per message, ~$0.03 per Judge check. With the saver, research runs on a model that costs about 1/3 as much (estimate; measured per customer in the owner view).
**Margin:** a Starter user doing ~30 demos and ~100 businesses a month costs us roughly **$4–6**, so **$15 leaves ~$9–11 profit (60–70%)**.

**Why a freelancer pays:** one website sold (350,000 IQD) pays for **more than a year** of Starter.

## First month (projections, clearly labelled)

- **Own studio (Sulaimani + Erbil):** 2 searches a night × 10 businesses ≈ 600 businesses checked → ~60 demos → 60 WhatsApp messages. At a 10% reply rate that is 6 conversations, and 2–3 clients ≈ **700,000–1,050,000 IQD** plus **70,000–105,000 IQD / month** recurring.
- **Subscriptions:** 10 freelancers from the hackathon network and Sulaimani developer groups on Starter ≈ **$150 (≈200,000 IQD) / month** recurring.
- **Month 3 target:** 50 paying users (mix of Starter and Pro) ≈ **$1,000 (≈1,300,000 IQD) / month** recurring, and 10 studio clients.

## 3-minute script (Round 1)

**0:00–0:20 Problem.** "Sulaimani is full of skilled people: web developers, AI video ad makers, marketers, data analysts. Their problem isn't skill, it's finding clients. Every client takes hours by hand, and Upwork and Fiverr don't work from Iraq. Meanwhile the clients are right there: this morning our agents checked nine Sulaimani businesses. Zero had a website, even a salon with 28,000 followers."

**0:20–0:45 Solution.** "Jump HQ is an AI sales team for any service business. You tell it what you sell in a 2-minute chat. Eight agents find the clients who need it, check they're real, score them, make each one a free sample of your work (a demo site, an ad concept, a data report), and write the message in Sorani."

**0:45–1:40 Live demo (phone in hand).**
- Setup chat: type "I make AI video ads" and show the team adapt (sample becomes an ad concept).
- Home: show the real Sulaimani results from today's search (found → checked → worth it → samples).
- Open a sample: a Kurdish website made for a real salon.
- Messages: the Judge's verdict ("88/100, safe"). Tap Approve, and WhatsApp opens with the message ready.

**1:40–2:10 Sleep mode.** "At night I press Sleep. The team keeps working. Before anything goes out, an independent AI Judge checks it against the facts. In testing it caught an invented compliment and a wrong phone number. In the morning I get a report."

**2:10–2:45 Money.** "It's online: sign up, and your team is working in seconds. No install. Starter is 15 dollars a month. One client won pays for more than a year, whether you sell websites, video ads or data reports. The AI runs on our key, the cheap model does most of the work, and plan limits keep every customer profitable. We also use it ourselves: our own studio wins projects with it."

**2:45–3:00 Close.** "Built at this hackathon: the Judge, Sleep mode, the phone app, setup for any business, Kurdish and Arabic. Jump HQ gives every Sulaimani freelancer and agency an AI sales team."

## Likely judge questions

- **Is it spam?** No. Nothing is sent without the owner or the Judge. There's a daily cap (8 by default), every message has a clear opt-out, and it only uses the business's own public contact. The Judge holds anything that looks pushy or invented.
- **What if the AI invents facts?** Every fact is marked verified or assumed. The Reviewer and the Judge both check against it, and demos say "concept website, not the official site".
- **Why not just ChatGPT?** It's a whole pipeline: search, verify, score, build, write, judge, send. It runs in Kurdish, on its own at night, with safety checks.
- **Privacy?** Public business information only, never private people. Every customer gets their own private Jump HQ (separate data, separate password). Studios that want it can still run it on their own computer.
- **How do you make money if the AI costs money?** The customer pays monthly and we pay the AI. The plan limit caps what each customer can spend, the cheap model does most steps, and the owner view shows cost vs. revenue per customer.
- **Can it scale beyond Sulaimani?** Markets are settings: Kurdistan (IQD, Sorani, WhatsApp) and the UK (GBP, English, email) are already set up.
