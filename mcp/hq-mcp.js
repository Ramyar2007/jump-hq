#!/usr/bin/env node
// stdio MCP server handed to every agent run. It is the agents' only way to change
// agency state; it forwards to the HQ HTTP API with a per-install token.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const HQ = process.env.HQ_URL || 'http://127.0.0.1:4777';
const TOKEN = process.env.HQ_TOKEN || '';
const RUN = process.env.HQ_RUN_ID || '';

async function call(method, path, body) {
  const res = await fetch(`${HQ}/agent-api${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-hq-token': TOKEN, 'x-hq-run': RUN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HQ ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const ok = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e.message || e) }] });
const wrap = (fn) => async (args) => { try { return ok(await fn(args)); } catch (e) { return fail(e); } };

const server = new McpServer({ name: 'hq', version: '1.0.0' });

server.tool('hq_note', 'Post a one-line progress update to the owner\'s live feed.', { text: z.string().max(300) },
  wrap(({ text }) => call('POST', '/note', { text })));

server.tool('hq_list_leads', 'List leads already in the pipeline (to avoid duplicates and pick work).',
  { stage: z.string().optional().describe('Filter by stage, e.g. new, qualified, demo_built, sent') },
  wrap(({ stage }) => call('GET', `/leads${stage ? `?stage=${encodeURIComponent(stage)}` : ''}`)));

server.tool('hq_get_lead', 'Get one lead with its full details and history.', { lead_id: z.string() },
  wrap(({ lead_id }) => call('GET', `/leads/${lead_id}`)));

const S = z.string().optional();
server.tool('hq_add_lead', 'Add a real, active business to the pipeline. Duplicates are detected automatically. A website is NOT required.', {
  business: z.string().describe('Business name (Latin letters)'),
  business_local: S.describe('Name in the local language/script, if they use one'),
  niche: z.string(),
  city: z.string(),
  area: S.describe('Neighbourhood / street area'),
  country: z.string(),
  website: S.describe('Their current website URL, empty if none'),
  socials: z.object({ instagram: S, facebook: S, tiktok: S }).partial().optional().describe('Public page URLs'),
  maps_url: S,
  phone: S.describe('PUBLIC business phone'),
  whatsapp: S.describe('PUBLIC business WhatsApp number'),
  email: S.describe('PUBLIC business email only'),
  contact_page: S,
  owner_name: S.describe('Only if the business publishes it'),
  issues: z.array(z.string()).describe('Their digital gaps, short and checkable'),
  score: z.number().min(1).max(10),
  notes: z.string().describe('What they sell, standout details'),
  source: S.describe('Where you found them'),
  hunt_id: S.describe('The search id from your instructions'),
}, wrap((a) => call('POST', '/leads', a)));

server.tool('hq_update_lead', 'Update a lead (stage, notes, contact details).', {
  lead_id: z.string(),
  stage: z.enum(['new', 'profiled', 'qualified', 'hold', 'planned', 'approved', 'demo_built', 'email_drafted', 'sent', 'replied', 'won', 'lost', 'skipped']).optional(),
  note: S.describe('Short history note explaining the change'),
  email: S,
  phone: S,
  whatsapp: S,
  contact_page: S,
  notes: S,
}, wrap(({ lead_id, ...rest }) => call('PATCH', `/leads/${lead_id}`, rest)));

const fact = z.object({ text: z.string(), source: z.string().describe('Where you saw it (site name or URL)'), verified: z.boolean().describe('true only if you saw it on a source; assumptions = false') });
server.tool('hq_save_profile', 'Save the public business profile for a lead. verdict "fail" removes it from the pipeline.', {
  lead_id: z.string(),
  verdict: z.enum(['pass', 'fail']),
  facts: z.array(fact),
  rating: S.describe('e.g. "4.6"'),
  review_count: z.number().optional(),
  rating_source: S,
  followers: S.describe('e.g. "Instagram 12.4k"'),
  website_status: z.enum(['none', 'social_only', 'weak', 'ok', 'good']),
  services: z.array(z.string()).default([]),
  hours: S,
  address: S,
  contact: z.object({ phone: S, whatsapp: S, email: S }).partial().optional(),
  decision_maker: S.describe('Only if the business publishes it'),
  cares_about: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]).describe('What is missing from their online presence today'),
  red_flags: z.array(z.string()).default([]),
}, wrap(({ lead_id, ...rest }) => call('POST', `/leads/${lead_id}/profile`, rest)));

server.tool('hq_save_opportunity', 'Save the opportunity score and decision for a profiled lead.', {
  lead_id: z.string(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  decision: z.enum(['build', 'hold', 'skip']),
  summary: z.string().describe('2-3 plain sentences a business person understands'),
  reasons: z.array(z.object({ point: z.string(), evidence: z.string() })),
  risks: z.array(z.string()).default([]),
  best_angle: z.string(),
}, wrap(({ lead_id, ...rest }) => call('POST', `/leads/${lead_id}/opportunity`, rest)));

server.tool('hq_save_plan', 'Save the product plan: what we should build for this business.', {
  lead_id: z.string(),
  product: z.string(),
  why: z.string(),
  must_have: z.array(z.string()),
  sections: z.array(z.string()),
  primary_action: z.string(),
  languages: z.array(z.string()),
  style: z.string(),
  avoid: z.array(z.string()).default([]),
}, wrap(({ lead_id, ...rest }) => call('POST', `/leads/${lead_id}/plan`, rest)));

server.tool('hq_save_review', 'Save the final check before building. approve = build it, hold = check later, reject = do not build.', {
  lead_id: z.string(),
  verdict: z.enum(['approve', 'hold', 'reject']),
  checks: z.array(z.object({ check: z.string(), ok: z.boolean(), note: z.string().default('') })),
  issues: z.array(z.string()).default([]),
  summary: z.string(),
}, wrap(({ lead_id, ...rest }) => call('POST', `/leads/${lead_id}/review`, rest)));

server.tool('hq_register_site', 'Register the demo site you built for a lead (after writing index.html into the site folder).', {
  lead_id: z.string(),
  summary: z.string().describe('2-3 factual sentences: what this redesign improves versus their current site'),
}, wrap((a) => call('POST', '/sites', a)));

server.tool('hq_request_approval', 'Queue something for the owner to approve. This is the ONLY way an email or outbound action can happen.', {
  type: z.enum(['email', 'whatsapp', 'publish', 'other']),
  lead_id: z.string().optional(),
  title: z.string().describe('One line the owner sees in the approvals inbox'),
  to: z.string().optional().describe('Email address, or WhatsApp number in international format'),
  subject: z.string().optional(),
  body: z.string().optional(),
}, wrap((a) => call('POST', '/approvals', a)));

server.tool('hq_settings', 'Read the agency profile: company, market, offer and pricing.', {},
  wrap(() => call('GET', '/settings')));

await server.connect(new StdioServerTransport());
