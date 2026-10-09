// The same plain-language rules the dashboard uses, so phone and computer always agree.
import type { Boot, Lead } from './api';
import { t } from './i18n';

export const siteOf = (d: Boot, l: Lead) => d.sites.find((x) => x.lead_id === l.id || (l.demo?.slug && x.slug === l.demo.slug));
export const leadOf = (d: Boot, id?: string) => d.leads.find((l) => l.id === id);
export const agentName = (d: Boot, k: string) => d.agents.find((a) => a.key === k)?.name || k;
export const workingOn = (d: Boot, l: Lead) => d.runs.find((r) => ['running', 'queued'].includes(r.status) && (r.lead_id === l.id || (r.input?.lead_ids || []).includes(l.id)));

export function statusOf(d: Boot, l: Lead): { text: string; tone: string } {
  const w = workingOn(d, l);
  if (w) return { text: w.status === 'running' ? `${agentName(d, w.agent)} ${t('working…')}` : `${t('Waiting for')} ${agentName(d, w.agent)}`, tone: 'info' };
  const site = siteOf(d, l);
  return ({
    new: { text: t('Found'), tone: '' },
    profiled: { text: t('Checked'), tone: '' },
    qualified: { text: t('Worth building'), tone: 'accent' },
    planned: { text: t('Plan ready'), tone: 'accent' },
    approved: { text: t('Ready to build'), tone: 'accent' },
    hold: { text: t('On hold'), tone: 'warn' },
    skipped: { text: t('Not a fit'), tone: '' },
    demo_built: { text: site?.public_url ? t('Demo online') : t('Demo ready for you'), tone: 'good' },
    email_drafted: { text: t('Message waiting for you'), tone: 'good' },
    sent: { text: t('Contacted'), tone: 'info' },
    replied: { text: t('Talking'), tone: 'info' },
    won: { text: t('Client'), tone: 'good' },
    lost: { text: t('Said no'), tone: 'bad' },
  } as Record<string, { text: string; tone: string }>)[l.stage] || { text: l.stage, tone: '' };
}

export type Todo = { kind: 'demo' | 'message' | 'send' | 'paused'; title: string; sub: string; id: string };
export function needsYou(d: Boot): Todo[] {
  const items: Todo[] = [];
  if (d.runner?.paused) items.push({ kind: 'paused', title: t('The team is paused'), sub: d.runner.pauseReason || '', id: 'paused' });
  for (const l of d.leads) {
    const s = siteOf(d, l);
    if (l.stage === 'demo_built' && s && !s.public_url && !workingOn(d, l)) items.push({ kind: 'demo', title: `${t('Look at the demo for')} ${l.business}`, sub: s.judge && !s.judge.passes ? `${t('Held by the Judge')}: ${s.judge.summary}` : `${l.opportunity ? `${l.opportunity.score}/100 · ` : ''}${t('approve it and the first message gets written')}`, id: l.id });
  }
  for (const a of d.approvals.filter((x) => x.status === 'pending' && ['email', 'whatsapp'].includes(x.type))) {
    items.push({ kind: 'message', title: leadOf(d, a.lead_id)?.business || a.title, sub: a.judge && !a.judge.passes ? `${t('Held by the Judge')}: ${a.judge.summary}` : `${a.type === 'whatsapp' ? 'WhatsApp' : t('Email')} · ${t('Read & approve')}`, id: a.id });
  }
  for (const a of d.approvals.filter((x) => x.status === 'approved' && ['email', 'whatsapp'].includes(x.type))) {
    items.push({ kind: 'send', title: `${t('Send the message to')} ${leadOf(d, a.lead_id)?.business || a.to}`, sub: a.auto ? t('Approved by the Judge while you slept') : t('approved, not sent yet'), id: a.id });
  }
  return items;
}

export const money = (d: Boot, n: number) => {
  const m = d.config.markets[d.config.market_id] || {};
  const v = Number(n || 0).toLocaleString('en-US');
  return m.currency === 'GBP' ? `£${v}` : m.currency === 'USD' ? `$${v}` : `${v} ${m.currency || ''}`;
};
// The WhatsApp text without the English copy for the owner.
export const mainText = (body: string) => String(body || '').split(/\n\s*-{3,}\s*\n|\n\s*\(?English( version| translation)?\)?\s*:?\s*\n/i)[0].trim();
