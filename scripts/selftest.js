import assert from 'node:assert/strict';
import { DEFAULTS } from '../server/config.js';
import { budget } from '../server/agents.js';
import { slideHtml } from '../server/grow.js';
import { hardChecks } from '../server/judge.js';

let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`ok ${checks} - ${name}`);
}

check('creator uses its configured model and turn budget', () => {
  assert.deepEqual(budget(DEFAULTS, 'creator'), { model: 'sonnet', turns: 30 });
});

check('post Judge catches an empty caption', () => {
  assert.ok(hardChecks('post', { caption: '', text: 'A design' }, {}, 'en').includes('The message is empty.'));
});

check('post Judge catches placeholder text', () => {
  assert.ok(hardChecks('post', { caption: 'A great offer', text: 'TODO: add a price' }, {}, 'en').some((x) => /placeholder/i.test(x)));
});

check('post Judge allows a complete caption without placeholders', () => {
  assert.deepEqual(hardChecks('post', { caption: 'Message us for a sample', text: 'A real offer' }, {}, 'en'), []);
});

check('Grow template escapes user supplied headline and brand text', () => {
  const html = slideHtml({ headline: 'Meet **our** <shops>' }, {
    w: 1080, h: 1350, theme: 'dark', accent: '#ff6b2c', brand: '<Jump>', site: 'jumpagency.org', index: 0, total: 1,
  });
  assert.ok(html.includes('Meet <em>our</em> &lt;shops&gt;'));
  assert.ok(html.includes('&lt;Jump&gt;'));
  assert.ok(!html.includes('<shops>'));
});

console.log(`Self-test passed (${checks} checks).`);
