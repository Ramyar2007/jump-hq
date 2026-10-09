// Headless screenshots of a demo site (desktop full page + phone first screen).
// node scripts/demoshot.mjs <path-to-index.html> <out-prefix>
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';

const [, , file, out] = process.argv;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
for (const [w, h, n] of [[1440, 900, 'd'], [390, 844, 'm']]) {
  await p.setViewport({ width: w, height: h });
  await p.goto(pathToFileURL(file).href, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  await p.screenshot({ path: `${out}_${n}.png`, fullPage: n === 'd' });
}
console.log('errors', JSON.stringify(errs));
await b.close();
