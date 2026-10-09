// The dashboard's dictionary (public/i18n.js) is the one source of truth.
// This copies it into the phone app so both always speak the same words.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'public', 'i18n.js'), 'utf8');
// The app lays out right-to-left itself, so it must not also flip the whole web page.
const body = src.replace("typeof document !== 'undefined'", 'false');
const out = `// GENERATED from public/i18n.js by scripts/sync-app-i18n.mjs. Edit that file, then run: npm run sync\n${body}`;
fs.writeFileSync(path.join(root, 'app', 'src', 'lib', 'i18n.js'), out);
console.log('synced i18n into the app');
