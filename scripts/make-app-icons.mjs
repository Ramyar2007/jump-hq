// Renders the app icon, Android adaptive icon and splash from HTML with the local Chrome.
// node app/assets/make-icons.mjs  (run from the agency-hq folder)
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve('app/assets');
const J = (size, bg, radius, scale = 0.56) => `<html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;background:${bg};border-radius:${radius}px;display:grid;place-items:center">
<span style="font:800 ${Math.round(size * scale)}px 'Arial Black',Arial,sans-serif;color:#fff;letter-spacing:-.04em;transform:translateY(-2%)">J</span></div></body></html>`;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage();
const shot = async (html, size, file) => {
  await p.setViewport({ width: size, height: size });
  await p.setContent(html);
  await p.screenshot({ path: path.join(dir, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
};
await shot(J(1024, '#ff6b2c', 0), 1024, 'icon.png');
// adaptive: the system adds the background + mask; keep the letter in the safe zone
await shot(J(1024, 'transparent', 0, 0.36), 1024, 'adaptive-icon.png');
await shot(J(512, '#ff6b2c', 120), 512, 'splash.png');
await b.close();
console.log('icons written');
