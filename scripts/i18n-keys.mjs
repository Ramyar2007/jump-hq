// Lists every t('...') string in the given files that has no translation yet.
// Usage: node scripts/i18n-keys.mjs public/app.js [more files]
import fs from 'node:fs';
import { DICT } from '../public/i18n.js';

const keys = new Set();
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?<![A-Za-z])t\((?:'((?:[^'\\]|\\.)*)'|"([^"]*)")\)/g)) keys.add((m[1] ?? m[2]).replace(/\\'/g, "'"));
}
const missing = [...keys].filter((k) => !DICT.ckb?.[k] || !DICT.ar?.[k]);
console.log(JSON.stringify({ total: keys.size, missing }, null, 1));
