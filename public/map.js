// Live map: the AI team at work on a 3D Sulaimani street, lit by the real sun and moon and the real weather.
// Three.js, no build step. mount(stage, api) starts it; it cleans itself up when the stage leaves the page.
import * as THREE from 'three';
import { OrbitControls } from '/vendor/addons/controls/OrbitControls.js';
import { EffectComposer } from '/vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '/vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/vendor/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from '/vendor/addons/utils/BufferGeometryUtils.js';

const LAT = 35.5613, LON = 45.4373, TZ = 3; // Sulaimani, UTC+3 all year
const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function mulberry(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let rnd = mulberry(7);
const R = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const hashStr = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

// value noise + fbm, for the ground, the mountain and the clouds
const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };

/* ------------------------------------------------------------ sky maths */
// Sun and moon positions (suncalc formulas). Azimuth from north, clockwise. Scene: north = -z, east = +x.
const days = (ms) => ms / 864e5 - 10957.5;
const OBL = RAD * 23.4397;
function toHorizon(ra, dec, d) {
  const H = RAD * (280.16 + 360.9856235 * d) + LON * RAD - ra, phi = LAT * RAD;
  return {
    alt: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)),
    az: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI,
  };
}
function sunAt(ms) {
  const d = days(ms), M = RAD * (357.5291 + 0.98560028 * d);
  const L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
  return toHorizon(Math.atan2(Math.sin(L) * Math.cos(OBL), Math.cos(L)), Math.asin(Math.sin(OBL) * Math.sin(L)), d);
}
function moonAt(ms) {
  const d = days(ms), L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
  const ra = Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l));
  return toHorizon(ra, dec, d);
}
const dirOf = ({ alt, az }, v = V()) => v.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
const localParts = (ms) => { const d = new Date(ms + TZ * 36e5); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours() + d.getUTCMinutes() / 60 }; };
const atLocal = (ms, hours) => { const p = localParts(ms); return Date.UTC(p.y, p.m, p.d) - TZ * 36e5 + hours * 36e5; };
function dayMarks(ms) {
  let noon = 12, best = -99, dawn = 6, dusk = 18, prev = null;
  for (let h = 0; h <= 24; h += 1 / 30) {
    const a = sunAt(atLocal(ms, h)).alt / RAD;
    if (a > best) { best = a; noon = h; }
    if (prev !== null && prev < -3 && a >= -3) dawn = h;
    if (prev !== null && prev >= 3 && a < 3) dusk = h;
    prev = a;
  }
  return { dawn, noon, dusk };
}
function phaseOf(alt, h, marks) {
  const e = alt / RAD;
  if (e < -10) return 'Night';
  if (Math.abs(h - marks.noon) < 0.75 && e > 0) return 'Noon';
  if (h < marks.noon) return e < 8 ? 'Dawn' : 'Morning';
  if (e < -3) return 'Evening';
  return e < 10 ? 'Sunset' : 'Afternoon';
}

// Sky colours by sun height (degrees): [elevation, zenith, horizon]
const SKY = [[-90, '#010208', '#03050c'], [-18, '#02040b', '#070c1a'], [-11, '#060d22', '#121d3b'], [-6, '#13234a', '#3a4767'], [-2, '#22396b', '#b8693f'], [1, '#2f5089', '#f0874a'], [5, '#3d6eae', '#f6b27c'], [11, '#4886cd', '#e6d3b6'], [24, '#3e83d5', '#b9d7f1'], [50, '#2f74d0', '#cfe3f7'], [90, '#2a6ccb', '#d8eafb']]
  .map(([e, a, b]) => [e, C(a), C(b)]);
const SUNCOL = [[-6, C('#ff5a2a')], [0, C('#ff7a3d')], [6, C('#ffae66')], [16, C('#ffe2b8')], [40, C('#fff6ea')], [90, C('#ffffff')]];
function ramp(list, e, idx, out) {
  for (let i = 1; i < list.length; i++) if (e <= list[i][0]) { const k = (e - list[i - 1][0]) / (list[i][0] - list[i - 1][0]); return out.copy(list[i - 1][idx]).lerp(list[i][idx], k); }
  return out.copy(list[list.length - 1][idx]);
}

/* -------------------------------------------------------------- weather */
const WX = {
  clear: { clouds: 0.08, rain: 0, snow: 0, fog: 0, storm: 0, wind: 2 },
  clouds: { clouds: 0.85, rain: 0, snow: 0, fog: 0.05, storm: 0, wind: 4 },
  rain: { clouds: 0.95, rain: 0.75, snow: 0, fog: 0.2, storm: 0, wind: 5 },
  storm: { clouds: 1, rain: 1, snow: 0, fog: 0.25, storm: 1, wind: 12 },
  snow: { clouds: 0.9, rain: 0, snow: 0.85, fog: 0.25, storm: 0, wind: 3 },
  fog: { clouds: 0.45, rain: 0, snow: 0, fog: 1, storm: 0, wind: 1 },
};
function fromWmo(code, cover, windKmh) {
  const w = { clouds: clamp((cover ?? 20) / 100, 0, 1), rain: 0, snow: 0, fog: 0, storm: 0, wind: (windKmh ?? 8) / 3.6 };
  let label = 'Clear sky';
  if (code === 1) label = 'Mainly clear'; else if (code === 2) label = 'Partly cloudy'; else if (code === 3) label = 'Overcast';
  else if (code === 45 || code === 48) { label = 'Fog'; w.fog = 1; }
  else if (code >= 51 && code <= 57) { label = 'Drizzle'; w.rain = 0.3; }
  else if (code === 61 || code === 66) { label = 'Light rain'; w.rain = 0.45; }
  else if (code === 63) { label = 'Rain'; w.rain = 0.7; }
  else if (code === 65 || code === 67) { label = 'Heavy rain'; w.rain = 1; }
  else if (code === 71 || code === 77) { label = 'Light snow'; w.snow = 0.4; }
  else if (code === 73) { label = 'Snow'; w.snow = 0.7; }
  else if (code === 75) { label = 'Heavy snow'; w.snow = 1; }
  else if (code >= 80 && code <= 82) { label = 'Rain showers'; w.rain = [0.5, 0.8, 1][code - 80]; }
  else if (code === 85 || code === 86) { label = 'Snow showers'; w.snow = code === 85 ? 0.6 : 0.9; }
  else if (code >= 95) { label = 'Thunderstorm'; w.storm = 1; w.rain = 1; }
  if (w.rain || w.snow || w.storm) w.clouds = Math.max(w.clouds, 0.9);
  return { w, label };
}
const WX_ICON = { clear: '☀️', clouds: '☁️', rain: '🌧️', storm: '⛈️', snow: '🌨️', fog: '🌫️' };
const kindOf = (w) => (w.storm > 0.5 ? 'storm' : w.snow > 0.2 ? 'snow' : w.rain > 0.2 ? 'rain' : w.fog > 0.5 ? 'fog' : w.clouds > 0.6 ? 'clouds' : 'clear');

/* ---------------------------------------------------------------- roles */
const ROLE = {
  lead: { color: '#ff6b2c', icon: '🎯' },
  scout: { color: '#f59e0b', icon: '🔭', hat: 'cap' },
  investigator: { color: '#14b8a6', icon: '🔍', tool: 'glass' },
  opportunity: { color: '#eab308', icon: '📊' },
  strategist: { color: '#3b82f6', icon: '🧭' },
  reviewer: { color: '#22c55e', icon: '✅' },
  builder: { color: '#ef4444', icon: '🛠️', hat: 'hard' },
  writer: { color: '#06b6d4', icon: '✍️' },
  closer: { color: '#f43f5e', icon: '🤝', tool: 'phone' },
};
const ORDER = ['lead', 'scout', 'investigator', 'opportunity', 'strategist', 'reviewer', 'builder', 'writer', 'closer'];
// Rehearsal: the whole flow plays on the map without spending credits (clearly labelled on screen).
const REHEARSE = {
  lead: 'Planning the work: find 10 cafés in Sulaymaniyah',
  scout: 'Searching: beauty salons in Sulaymaniyah', investigator: 'Checking Instagram and Google Maps', opportunity: 'Scoring 5 businesses',
  strategist: 'Planning a Kurdish and English website', reviewer: 'Review: approved', builder: 'Building the demo website',
  writer: 'Writing the WhatsApp message in Sorani', closer: 'Message ready for you',
};
const TABLE_ROLES = new Set(['opportunity', 'strategist', 'reviewer']);
const SLOT_X = [33.5, -33.5, 46.5, -46.5, 59.5, -59.5, 72.5, -72.5];
const SHOP_Z = 12, TABLE = V(0, 0, 8), ITABLE = V(0, 0, -17.6);
// The city grows ring by ring as the team builds more demos.
const WORLD = 440, LEVEL_R = [80, 115, 155, 200, 250, 305, 365, 430], DEMOS_PER_LEVEL = 2;
// Avenues of the wider city (the inner streets are drawn in the detailed ground texture).
const AVE_X = [-420, -310, -200, 200, 310, 420], AVE_Z = [-370, -260, -150, 200, 305, 410];
// Desks inside Jump HQ: [x, z, facing] (1 = +x, -1 = -x, 0 = +z)
const DESKS = { lead: [-5.6, -12.9, 0], scout: [-10.4, -13.7, 1], investigator: [-10.4, -17.6, 1], opportunity: [-10.4, -21.5, 1], strategist: [-4.2, -23.1, 0], reviewer: [4.2, -23.1, 0], builder: [10.4, -21.5, -1], writer: [10.4, -17.6, -1], closer: [10.4, -13.7, -1] };
const DRONE_ROLES = ['scout', 'investigator', 'closer'];
const FILLER_SIGNS = ['نانەوایی', 'دەرمانخانە', 'کافێ', 'بازاڕی بچووک', 'جلوبەرگ', 'مۆبایل', 'شیرینی', 'کتێبخانە'];
const STATUS = {
  none: { label: 'No website', cls: 'bad' },
  checking: { label: 'Being checked…', cls: 'info' },
  building: { label: 'Building the demo', cls: 'busy' },
  demo: { label: 'Demo ready', cls: 'accent', color: '#ff6b2c' },
  online: { label: 'Demo online', cls: 'good', color: '#22c55e' },
  message: { label: 'Message ready', cls: 'accent', color: '#ff6b2c' },
  sent: { label: 'Message sent', cls: 'info', color: '#38bdf8' },
  replied: { label: 'Replied', cls: 'good', color: '#22c55e' },
  won: { label: 'Client', cls: 'gold', color: '#fbbf24' },
};

/* ------------------------------------------------------------- textures */
let MAXANISO = 8;
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = MAXANISO;
  return t;
}
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixRgb = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

// Facades: 8x8 window cells (one cell = 3 m wide, one floor 3.2 m). Cell corners are plain wall (used for roofs).
function facade(kind, seed) {
  rnd = mulberry(seed);
  const N = 8, CS = 128, S = N * CS;
  const [c, g] = canvas(S, S), [e, ge] = canvas(S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const glassGrad = (x, y, w, h, a, b) => { const gr = g.createLinearGradient(x, y, x + w * 0.6, y + h); gr.addColorStop(0, a); gr.addColorStop(0.6, b); gr.addColorStop(1, a); return gr; };
  if (kind === 'hq') {
    g.fillStyle = '#0d1830'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < N; r++) for (let k = 0; k < N; k++) {
      const x = k * CS, y = r * CS;
      g.fillStyle = glassGrad(x, y, CS, CS, '#22385c', `hsl(215,45%,${R(16, 26)}%)`); g.fillRect(x + 4, y + 4, CS - 8, CS - 24);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x + 10, y + CS - 24); g.lineTo(x + 50, y + 4); g.lineTo(x + 70, y + 4); g.lineTo(x + 30, y + CS - 24); g.fill();
      g.fillStyle = '#8193b0'; g.fillRect(x, y, CS, 4); g.fillRect(x, y, 4, CS);
      g.fillStyle = '#0a1222'; g.fillRect(x, y + CS - 20, CS, 16);
      if (rnd() < 0.5) { ge.globalAlpha = R(0.3, 0.75); ge.fillStyle = rnd() < 0.75 ? '#dbe8ff' : '#ffd9a8'; ge.fillRect(x + 4, y + 4, CS - 8, CS - 24); ge.globalAlpha = 1; }
    }
    return { map: tex(c, { repeat: true }), em: tex(e, { repeat: true }) };
  }
  const old = kind === 'old';
  g.fillStyle = old ? '#efe3cc' : kind === 'office' ? '#eceff3' : '#f4efe6'; g.fillRect(0, 0, S, S);
  if (old) { g.strokeStyle = 'rgba(120,100,70,.18)'; g.lineWidth = 2; for (let y = 0; y < S; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); for (let x = (y / 22) % 2 ? 0 : 24; x < S; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 22); g.stroke(); } } }
  for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(70,60,50,${R(0, 0.05)})`; g.fillRect(R(0, S), R(0, S), R(1, 5), R(1, 5)); }
  for (let i = 0; i < 40; i++) { const x = R(0, S), gr = g.createLinearGradient(x, 0, x, S); gr.addColorStop(0, 'rgba(60,50,40,0)'); gr.addColorStop(1, 'rgba(60,50,40,.06)'); g.fillStyle = gr; g.fillRect(x, R(0, S / 2), R(4, 14), S); }
  for (let r = 0; r < N; r++) {
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, r * CS + CS - 7, S, 7);
    if (kind === 'office') {
      const y = r * CS + 22, h = CS - 40;
      g.fillStyle = glassGrad(0, y, S, h, '#3a4d63', '#1c2a3a'); g.fillRect(0, y, S, h);
      for (let x = 0; x < S; x += 64) {
        g.fillStyle = '#c9d0d8'; g.fillRect(x, y, 5, h);
        if (rnd() < 0.36) { ge.globalAlpha = R(0.5, 1); ge.fillStyle = rnd() < 0.7 ? '#eaf1ff' : '#ffd8a0'; ge.fillRect(x + 5, y, 59, h); ge.globalAlpha = 1; }
      }
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, y, S, 6);
      continue;
    }
    for (let k = 0; k < N; k++) {
      const x = k * CS, y = r * CS, wx = x + 32, wy = y + 24, ww = 64, wh = old ? 80 : 74;
      g.fillStyle = old ? '#d9c9a8' : '#d6cfc2';
      if (old) { g.beginPath(); g.moveTo(wx - 6, wy + wh + 6); g.lineTo(wx - 6, wy + 26); g.arc(wx + ww / 2, wy + 26, ww / 2 + 6, Math.PI, 0); g.lineTo(wx + ww + 6, wy + wh + 6); g.fill(); }
      else g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      g.save(); g.beginPath();
      if (old) { g.moveTo(wx, wy + wh); g.lineTo(wx, wy + 26); g.arc(wx + ww / 2, wy + 26, ww / 2, Math.PI, 0); g.lineTo(wx + ww, wy + wh); g.closePath(); } else g.rect(wx, wy, ww, wh);
      g.clip();
      g.fillStyle = glassGrad(wx, wy, ww, wh, '#3b4a5c', '#18212c'); g.fillRect(wx, wy - 40, ww, wh + 40);
      g.fillStyle = 'rgba(255,255,255,.09)'; g.beginPath(); g.moveTo(wx, wy + wh * 0.7); g.lineTo(wx + ww * 0.6, wy - 10); g.lineTo(wx + ww * 0.85, wy - 10); g.lineTo(wx + ww * 0.1, wy + wh); g.fill();
      let shut = 0;
      if (!old && rnd() < 0.3) { shut = wh * R(0.25, 1); g.fillStyle = '#cbc2b2'; g.fillRect(wx, wy, ww, shut); g.fillStyle = 'rgba(0,0,0,.08)'; for (let s = wy; s < wy + shut; s += 6) g.fillRect(wx, s, ww, 1); }
      g.fillStyle = old ? '#cbb994' : '#d6cfc2'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      g.restore();
      g.fillStyle = '#b9b0a0'; g.fillRect(wx - 9, wy + wh + 6, ww + 18, 6);
      if (shut < wh * 0.95 && rnd() < 0.45) { ge.globalAlpha = R(0.45, 1); ge.fillStyle = pick(['#ffc06a', '#ffd28f', '#ffe4b8', '#ffb257', '#d6e6ff']); ge.fillRect(wx, wy + shut, ww, wh - shut); ge.globalAlpha = 1; }
    }
  }
  return { map: tex(c, { repeat: true }), em: tex(e, { repeat: true }) };
}

function groundTexture(S = 4096) {
  const k = S / 360, X = (x) => (x + 180) * k, Z = (z) => (z + 180) * k;
  const [c, g] = canvas(S, S);
  const rect = (x0, z0, x1, z1, f) => { g.fillStyle = f; g.fillRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k); };
  // park across the street
  rect(-30, 37, 30, 84, '#5d8a3a');
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${pick(['40,80,30', '120,150,60', '30,60,20'])},${R(0.05, 0.18)})`; g.beginPath(); g.arc(X(R(-30, 30)), Z(R(37, 84)), R(1, 5), 0, 7); g.fill(); }
  g.strokeStyle = '#d8c69e'; g.lineWidth = 2.4 * k; g.beginPath(); g.ellipse(X(0), Z(60), 17 * k, 13 * k, 0, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(X(0), Z(37)); g.lineTo(X(0), Z(47)); g.moveTo(X(-30), Z(84)); g.lineTo(X(-12), Z(69)); g.moveTo(X(30), Z(84)); g.lineTo(X(12), Z(69)); g.stroke();
  g.fillStyle = '#cfc6b5'; g.beginPath(); g.arc(X(0), Z(60), 6.5 * k, 0, 7); g.fill();
  // streets: main road z 24..34, back street z -44..-37, south street 92..99, cross streets |x| 84..91
  const side = '#c4bdb0', asph = '#3a3d42';
  rect(-180, 20, 180, 24, side); rect(-180, 34, 180, 37, side); rect(-180, -47, 180, -44, side); rect(-180, -37, 180, -34, side); rect(-180, 89, 180, 92, side); rect(-180, 99, 180, 102, side);
  for (const s of [-1, 1]) { rect(s > 0 ? 81 : -94, -180, s > 0 ? 94 : -81, 180, side); }
  rect(-180, 24, 180, 34, asph); rect(-180, -44, 180, -37, asph); rect(-180, 92, 180, 99, asph); rect(84, -180, 91, 180, asph); rect(-91, -180, -84, 180, asph);
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${pick(['255,255,255', '0,0,0'])},${R(0.02, 0.07)})`; const x = R(-180, 180); g.fillRect(X(x), Z(pick([R(24, 34), R(-44, -37), R(92, 99)])), R(1, 4), R(1, 4)); }
  for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(X(R(-180, 180)), Z(R(25, 33)), R(0.4, 1.4) * k, R(0.3, 0.9) * k, R(0, 3), 0, 7); g.fill(); }
  // sidewalk paving joints
  g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2;
  for (let x = -180; x < 180; x += 1.5) { for (const [a, b] of [[20, 24], [34, 37]]) { g.beginPath(); g.moveTo(X(x), Z(a)); g.lineTo(X(x), Z(b)); g.stroke(); } }
  // curbs and markings
  g.fillStyle = '#8f8a82'; for (const z of [23.85, 33.85, -44.15, -37.15]) g.fillRect(0, Z(z), S, 0.3 * k);
  g.fillStyle = '#f2f0ea'; g.fillRect(0, Z(24.5), S, 0.18 * k); g.fillRect(0, Z(33.3), S, 0.18 * k);
  for (let x = -180; x < 180; x += 6) { if (Math.abs(x) < 6) continue; g.fillRect(X(x), Z(28.92), 3 * k, 0.16 * k); g.fillRect(X(x), Z(-40.6), 3 * k, 0.14 * k); }
  for (let z = -180; z < 180; z += 6) { g.fillRect(X(87.45), Z(z), 0.14 * k, 3 * k); g.fillRect(X(-87.55), Z(z), 0.14 * k, 3 * k); }
  for (let x = -4; x <= 4; x += 1.2) g.fillRect(X(x), Z(24.8), 0.6 * k, 8.4 * k); // zebra to the park
  // plaza: stone tiles, a ring inlay around the holo-table
  rect(-27, -36, 27, 20, '#d9d1c2');
  g.strokeStyle = 'rgba(90,80,60,.16)'; g.lineWidth = 2;
  for (let x = -27; x <= 27; x += 2) { g.beginPath(); g.moveTo(X(x), Z(-36)); g.lineTo(X(x), Z(20)); g.stroke(); }
  for (let z = -36; z <= 20; z += 2) { g.beginPath(); g.moveTo(X(-27), Z(z)); g.lineTo(X(27), Z(z)); g.stroke(); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,105,80,${R(0.03, 0.09)})`; g.fillRect(X(Math.floor(R(-27, 27) / 2) * 2), Z(Math.floor(R(-36, 20) / 2) * 2), 2 * k, 2 * k); }
  g.fillStyle = '#c9c0ae'; g.beginPath(); g.arc(X(TABLE.x), Z(TABLE.z), 7 * k, 0, 7); g.fill();
  g.strokeStyle = '#ff6b2c'; g.lineWidth = 0.3 * k; g.beginPath(); g.arc(X(TABLE.x), Z(TABLE.z), 5.4 * k, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(90,80,60,.3)'; g.lineWidth = 3;
  for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; g.beginPath(); g.moveTo(X(TABLE.x + Math.cos(t) * 5.8), Z(TABLE.z + Math.sin(t) * 5.8)); g.lineTo(X(TABLE.x + Math.cos(t) * 7), Z(TABLE.z + Math.sin(t) * 7)); g.stroke(); }
  // fine grain over what was drawn (the rest stays clear: the city ground shows through)
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 160000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${R(0.015, 0.05)})`; g.fillRect(R(0, S), R(0, S), R(1, 3), R(1, 3)); }
  g.globalCompositeOperation = 'source-over';
  return tex(c);
}

// The wide city ground: soil and dry grass, the avenues and the long streets.
function cityGround(S) {
  const W = WORLD * 2 + 20, k = S / W, X = (x) => (x + W / 2) * k, Z = (z) => (z + W / 2) * k;
  const [c, g] = canvas(S, S), [n, ng] = canvas(512, 512), img = ng.createImageData(512, 512);
  const dry = rgb('#9c9466'), soil = rgb('#ab9470'), green = rgb('#7a8350');
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const v = fbm(x / 46, y / 46, 5), w = fbm(x / 13 + 40, y / 13, 3);
    let p = mixRgb(dry, green, smooth(0.45, 0.62, v)); p = mixRgb(p, soil, smooth(0.55, 0.7, w) * 0.6);
    const i = (y * 512 + x) * 4, sh = 0.92 + w * 0.12; img.data[i] = p[0] * sh; img.data[i + 1] = p[1] * sh; img.data[i + 2] = p[2] * sh; img.data[i + 3] = 255;
  }
  ng.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(n, 0, 0, S, S);
  const rect = (x0, z0, x1, z1, f) => { g.fillStyle = f; g.fillRect(X(x0), Z(z0), Math.max(1, (x1 - x0) * k), Math.max(1, (z1 - z0) * k)); };
  const side = '#c4bdb0', asph = '#3b3e43', E = W / 2;
  const roadX = (cx, h) => { rect(cx - h - 3, -E, cx + h + 3, E, side); rect(cx - h, -E, cx + h, E, asph); g.fillStyle = '#e8e6e0'; for (let z = -E; z < E; z += 6) g.fillRect(X(cx - 0.08), Z(z), Math.max(1, 0.16 * k), 3 * k); };
  const roadZ = (cz, h) => { rect(-E, cz - h - 3, E, cz + h + 3, side); rect(-E, cz - h, E, cz + h, asph); g.fillStyle = '#e8e6e0'; for (let x = -E; x < E; x += 6) g.fillRect(X(x), Z(cz - 0.08), 3 * k, Math.max(1, 0.16 * k)); };
  for (const z of AVE_Z) roadZ(z, 4);
  for (const z of [-40.5, 95.5]) roadZ(z, 3.5);
  roadZ(29, 5);
  for (const x of AVE_X) roadX(x, 4);
  for (const x of [-87.5, 87.5]) roadX(x, 3.5);
  for (const x of AVE_X.concat([-87.5, 87.5])) for (const z of AVE_Z.concat([-40.5, 95.5, 29])) rect(x - 4, z - 4, x + 4, z + 4, asph);
  for (let i = 0; i < 70000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${R(0.015, 0.05)})`; g.fillRect(R(0, S), R(0, S), R(1, 2.5), R(1, 2.5)); }
  return tex(c);
}

function blobTexture(seed, lo, hi, size = 512) {
  const [c, g] = canvas(size, size), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = smooth(lo, hi, fbm(x / 40 + seed, y / 40, 4)) * 255; const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

function signTexture(text, bg, fg) {
  const [c, g] = canvas(1024, 160);
  const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 160); g.fillStyle = gr; g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 6; g.strokeRect(10, 10, 1004, 140);
  const arabic = /[؀-ۿ]/.test(text);
  let size = 92; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = arabic ? 'rtl' : 'ltr';
  do { g.font = `800 ${size}px ${arabic ? '"Noto Sans Arabic"' : '"Plus Jakarta Sans"'}, sans-serif`; size -= 4; } while (g.measureText(text).width > 940 && size > 30);
  g.fillText(text, 512, arabic ? 86 : 82);
  return tex(c);
}

function siteTexture(name, local, color, niche) {
  const W = 1024, H = 640, [c, g] = canvas(W, H);
  const beauty = /beauty|salon|nail|hair|spa|barber/i.test(niche + name), food = /food|restaurant|cafe|caffe|coffee|kebab|bakery|falafel/i.test(niche + name);
  const [bg1, bg2, ink, acc] = beauty ? ['#fbf1ec', '#f3dcd3', '#3b2626', '#b86b5e'] : food ? ['#fdf4e6', '#f4dfbd', '#2d2116', '#c2621d'] : ['#eef5f6', '#d5e7ea', '#13282c', '#0e7490'];
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, bg1); gr.addColorStop(1, bg2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = ink; g.fillRect(0, 0, W, 34); g.fillStyle = '#ffffffcc'; g.font = '600 17px "Plus Jakarta Sans", sans-serif'; g.textBaseline = 'middle'; g.fillText('Concept website by Jump', 24, 17);
  g.fillStyle = ink; g.font = '700 26px Georgia, serif'; g.fillText(name.slice(0, 26), 40, 78);
  for (let i = 0; i < 3; i++) { g.fillStyle = `${ink}22`; g.fillRect(560 + i * 92, 70, 70, 14); }
  g.fillStyle = color; roundRect(g, 846, 58, 140, 40, 20); g.fill(); g.fillStyle = '#fff'; g.font = '700 17px "Plus Jakarta Sans", sans-serif'; g.fillText('Book now', 875, 79);
  g.fillStyle = acc; g.font = '600 18px "Plus Jakarta Sans", sans-serif'; g.fillText('SULAYMANIYAH', 40, 150);
  g.fillStyle = ink; let s = 74; do { g.font = `500 ${s}px Georgia, serif`; s -= 4; } while (g.measureText(name).width > 520 && s > 34);
  wrapText(g, name, 40, 222, 520, s + 8);
  if (local) { g.direction = 'rtl'; g.textAlign = 'right'; g.font = '700 34px "Noto Sans Arabic", sans-serif'; g.fillStyle = acc; g.fillText(local.slice(0, 30), 560, 380); g.textAlign = 'left'; g.direction = 'ltr'; }
  g.fillStyle = `${ink}99`; g.font = '400 22px "Plus Jakarta Sans", sans-serif'; g.fillText('Kurdish · English · Call to book', 40, 425);
  g.fillStyle = ink; roundRect(g, 40, 460, 210, 56, 28); g.fill(); g.fillStyle = '#fff'; g.font = '700 20px "Plus Jakarta Sans", sans-serif'; g.fillText('Call to book', 80, 489);
  g.strokeStyle = ink; g.lineWidth = 2; roundRect(g, 266, 460, 190, 56, 28); g.stroke(); g.fillStyle = ink; g.fillText('Instagram', 312, 489);
  const ig = g.createLinearGradient(600, 120, 990, 600); ig.addColorStop(0, acc); ig.addColorStop(1, color); g.fillStyle = ig; roundRect(g, 600, 120, 384, 440, 26); g.fill();
  g.fillStyle = '#ffffff33'; g.beginPath(); g.arc(800, 300, 120, 0, 7); g.fill(); g.beginPath(); g.arc(900, 470, 60, 0, 7); g.fill();
  g.fillStyle = '#ffffffdd'; g.font = '700 30px "Noto Sans Arabic", sans-serif'; g.textAlign = 'center'; g.fillText('ماڵپەڕی نموونە', 792, 520); g.textAlign = 'left';
  for (let i = 0; i < 3; i++) { g.fillStyle = '#ffffffaa'; roundRect(g, 40 + i * 180, 560, 160, 56, 12); g.fill(); }
  return tex(c);
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrapText(g, text, x, y, max, lh) {
  const words = String(text).split(/\s+/); let line = '', n = 0;
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > max && line) { g.fillText(line, x, y + n * lh); line = w; n++; if (n > 1) break; } else line = t; }
  if (n <= 1) g.fillText(line, x, y + n * lh);
}

function flagTexture() {
  const [c, g] = canvas(600, 400);
  g.fillStyle = '#ed2024'; g.fillRect(0, 0, 600, 134); g.fillStyle = '#ffffff'; g.fillRect(0, 134, 600, 133); g.fillStyle = '#278e43'; g.fillRect(0, 267, 600, 133);
  g.fillStyle = '#febd11'; g.save(); g.translate(300, 200);
  for (let i = 0; i < 21; i++) { g.rotate((Math.PI * 2) / 21); g.beginPath(); g.moveTo(-9, -40); g.lineTo(0, -88); g.lineTo(9, -40); g.fill(); }
  g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill(); g.restore();
  return tex(c);
}
function moonTexture() {
  const [c, g] = canvas(512, 256); g.fillStyle = '#d9d8d0'; g.fillRect(0, 0, 512, 256);
  rnd = mulberry(99);
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(90,92,98,${R(0.18, 0.35)})`; g.beginPath(); g.ellipse(R(0, 512), R(40, 216), R(20, 70), R(14, 40), R(0, 3), 0, 7); g.fill(); }
  for (let i = 0; i < 160; i++) { const x = R(0, 512), y = R(0, 256), r = R(1, 7); g.fillStyle = 'rgba(60,60,60,.25)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.6, 0, 7); g.fill(); }
  return tex(c);
}
function glowTexture() {
  const [c, g] = canvas(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c);
}

/* ----------------------------------------------------- static geometry */
function tint(geo, color) {
  const c = C(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function boxUV(w, h, d, uOff = 0) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(n.getY(i)) > 0.5) { uv.setXY(i, 0.003, 0.997); continue; }
    const fw = Math.abs(n.getX(i)) > 0.5 ? d : w;
    uv.setXY(i, uOff + (uv.getX(i) * fw) / 24, (uv.getY(i) * h) / 25.6);
  }
  return geo;
}

/* --------------------------------------------------------------- people */
const PG = {};
function personGeos() {
  if (PG.leg) return PG;
  Object.assign(PG, {
    leg: new THREE.CapsuleGeometry(0.11, 0.6, 4, 10), shoe: new THREE.BoxGeometry(0.2, 0.12, 0.32), torso: new THREE.CapsuleGeometry(0.29, 0.5, 6, 14),
    arm: new THREE.CapsuleGeometry(0.085, 0.46, 4, 10), hand: new THREE.SphereGeometry(0.09, 10, 8), head: new THREE.SphereGeometry(0.25, 24, 18),
    hair: new THREE.SphereGeometry(0.262, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), eye: new THREE.SphereGeometry(0.034, 8, 6),
    cap: new THREE.SphereGeometry(0.27, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), brim: new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20),
    canopy: new THREE.ConeGeometry(0.95, 0.42, 16, 1, true), stick: new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6),
  });
  return PG;
}
function makePerson(shirt, { pants = '#26304a', skin = '#d9a77f', hair = '#24180f', hat, tool } = {}) {
  const G = personGeos(), g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
  const mShirt = M(shirt, { roughness: 0.6 }), mSkin = M(skin, { roughness: 0.55 }), mPants = M(pants), mDark = M('#15181f');
  const mesh = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const hips = new THREE.Group(); hips.position.y = 0.94; g.add(hips);
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.x = 0.13 * s; hips.add(p); mesh(G.leg, mPants, 0, -0.42, 0, p); mesh(G.shoe, mDark, 0, -0.86, 0.06, p); return p; });
  const torso = mesh(G.torso, mShirt, 0, 1.33, 0); torso.scale.z = 0.78;
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.37 * s, 1.62, 0); g.add(p); mesh(G.arm, mShirt, 0, -0.3, 0, p); mesh(G.hand, mSkin, 0, -0.6, 0, p); return p; });
  const head = new THREE.Group(); head.position.y = 2.0; g.add(head);
  mesh(G.head, mSkin, 0, 0, 0, head);
  mesh(G.hair, M(hair, { roughness: 0.9 }), 0, 0.03, -0.012, head).rotation.x = -0.25;
  for (const s of [-1, 1]) mesh(G.eye, mDark, 0.085 * s, 0.03, 0.225, head);
  if (hat === 'hard') { mesh(G.cap, M('#fbbf24', { roughness: 0.4 }), 0, 0.06, 0, head); mesh(G.brim, M('#fbbf24', { roughness: 0.4 }), 0, 0.07, 0.04, head).scale.set(1.45, 1, 1.45); }
  if (hat === 'cap') { mesh(G.cap, M(shirt), 0, 0.05, 0, head); mesh(G.brim, M(shirt), 0, 0.07, 0.2, head).scale.set(1, 1, 1.2); }
  const right = arms[1];
  if (tool === 'glass') { const t = new THREE.Group(); t.position.set(0, -0.68, 0.08); right.add(t); mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20), M('#d4a017', { metalness: 0.7, roughness: 0.3 }), 0, -0.12, 0, t); mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 18), new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.45, roughness: 0.05 }), 0, -0.12, 0, t).rotation.x = Math.PI / 2; }
  if (tool === 'phone') mesh(new THREE.BoxGeometry(0.08, 0.16, 0.02), M('#111827', { roughness: 0.3 }), 0, -0.66, 0.08, right);
  const umbrella = new THREE.Group(); umbrella.position.set(-0.32, 2.05, 0.05); umbrella.visible = false; g.add(umbrella);
  const can = mesh(G.canopy, new THREE.MeshStandardMaterial({ color: pick(['#1f2937', '#b91c1c', '#1e3a8a', '#0f766e', '#f59e0b']), roughness: 0.5, side: THREE.DoubleSide }), 0, 0.72, 0, umbrella); can.castShadow = true;
  mesh(G.stick, mDark, 0, 0.2, 0, umbrella);
  return { g, legs, arms, head, umbrella, ph: rnd() * 10 };
}
function animatePerson(p, dt, T, { moving = 0, action = 'idle', rain = 0 }) {
  const [L, Rr] = p.legs, [AL, AR] = p.arms;
  p.umbrella.visible = rain > 0.15;
  if (moving) {
    p.ph += dt * moving * 2.6;
    const s = Math.sin(p.ph), amp = moving > 4 ? 0.95 : 0.6;
    L.rotation.x = s * amp; Rr.rotation.x = -s * amp;
    AL.rotation.x = -s * amp * 0.8; AR.rotation.x = s * amp * 0.8; AL.rotation.z = -0.08; AR.rotation.z = 0.08;
    p.g.children[0].position.y = 0.94 + Math.abs(Math.cos(p.ph)) * 0.05;
    p.head.rotation.set(0, 0, 0);
  } else {
    L.rotation.x *= 0.8; Rr.rotation.x *= 0.8; p.g.children[0].position.y = 0.94;
    let al = 0, ar = 0, alz = -0.08, arz = 0.08;
    const k = T + p.ph;
    if (action === 'type') { al = -1.15 + Math.sin(k * 14) * 0.06; ar = -1.15 + Math.cos(k * 15) * 0.06; p.head.rotation.x = 0.25; }
    else if (action === 'hammer') { ar = -1.6 - Math.max(0, Math.sin(k * 8)) * 1.1; al = -0.7; p.head.rotation.x = -0.1; }
    else if (action === 'inspect') { ar = -1.7 + Math.sin(k * 1.3) * 0.12; arz = 0.25 + Math.sin(k * 0.9) * 0.2; p.head.rotation.y = Math.sin(k * 0.9) * 0.35; }
    else if (action === 'talk') { ar = -2.55; arz = -0.35; al = -0.4 + Math.sin(k * 2.4) * 0.35; p.head.rotation.y = Math.sin(k * 0.7) * 0.2; }
    else if (action === 'gesture') { al = -1.0 + Math.sin(k * 1.7) * 0.3; ar = -1.0 + Math.sin(k * 1.7 + 2) * 0.3; alz = -0.3; arz = 0.3; p.head.rotation.x = 0.1; }
    else if (action === 'scan') { al = -2.4; ar = -2.4; alz = 0.35; arz = -0.35; p.head.rotation.y = Math.sin(k * 0.6) * 0.6; }
    else if (action === 'wait') { al = -0.35; ar = -0.35; alz = 0.55; arz = -0.55; Rr.rotation.x = Math.max(0, Math.sin(k * 5)) * -0.15; }
    else if (action === 'sleep') { p.head.rotation.x = 0.45; al = 0.05; ar = 0.05; }
    else { al = Math.sin(k * 0.8) * 0.05; ar = -al; p.head.rotation.y = Math.sin(k * 0.35) * 0.45; p.head.rotation.x = 0; }
    if (p.umbrella.visible) { al = -2.2; alz = 0.15; }
    AL.rotation.x += (al - AL.rotation.x) * 0.2; AR.rotation.x += (ar - AR.rotation.x) * 0.2;
    AL.rotation.z += (alz - AL.rotation.z) * 0.2; AR.rotation.z += (arz - AR.rotation.z) * 0.2;
    if (!['type', 'hammer', 'gesture', 'sleep'].includes(action)) p.head.rotation.x *= 0.9;
  }
  if (moving && p.umbrella.visible) { p.arms[0].rotation.x = -2.2; p.arms[0].rotation.z = 0.15; }
}
const turnTo = (cur, target, k) => { let d = target - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return cur + d * k; };

/* ======================================================= 2D fallback */
// No 3D on this computer (old graphics, blocked WebGL): show the team as a simple live board instead.
function fallbackBoard(stage, api, why) {
  const t = api.t;
  stage.innerHTML = `<div class="mp-board"><div class="mp-board-h"><b>${esc(t('Your AI team'))}</b><span>${esc(why)}</span></div><div class="mp-board-l"></div></div>`;
  const list = stage.querySelector('.mp-board-l');
  const draw = () => {
    if (!stage.isConnected) return clearInterval(timer);
    const st = api.getState(), names = Object.fromEntries((st.agents || []).map((a) => [a.key, a.name]));
    list.innerHTML = ORDER.map((k) => {
      const run = st.runs.find((r) => r.agent === k && r.status === 'running'), q = st.runs.some((r) => r.agent === k && r.status === 'queued');
      const ev = run ? (st.events[run.id] || []).map(api.eventText).filter(Boolean).slice(-1)[0] || run.title : '';
      return `<div class="mp-board-r ${run ? 'on' : ''}" style="--c:${ROLE[k].color}"><i>${ROLE[k].icon}</i><div><b>${esc(names[k] || k)}</b><span>${esc(run ? ev : q ? t('Waiting') : t('Ready'))}</span></div></div>`;
    }).join('');
  };
  const timer = setInterval(draw, 1500); draw();
}

/* ================================================================ mount */
export function mount(stage, api) {
  const t = api.t;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
  catch { fallbackBoard(stage, api, t('This computer cannot show the 3D map, so here is the team as a list.')); return; }
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dispose(); fallbackBoard(stage, api, t('The graphics card stopped the 3D map. Reload the page to try again.')); });
  MAXANISO = renderer.capabilities.getMaxAnisotropy();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  const prefs = (() => { try { return JSON.parse(localStorage.getItem('jhq-map') || '{}'); } catch { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('jhq-map', JSON.stringify(prefs)); } catch { /* private window */ } };
  prefs.time ||= 'live'; prefs.wx ||= 'live'; prefs.q ||= 'auto'; prefs.team ||= 'live';
  // How strong is this computer? Weak graphics start light; the frame-rate check below adjusts from there.
  const gpu = (() => { try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch { return ''; } })();
  const weak = /swiftshader|llvmpipe|software|mali|adreno|powervr|intel\(r\) (hd|uhd) graphics [2-6]|intel.*hd graphics( \d{3,4})?$/i.test(gpu) || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  let tier = prefs.q === 'auto' ? (weak ? 'fast' : 'high') : prefs.q;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 4000);
  camera.position.set(38, 58, 112);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 3, 6);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.minDistance = 12; controls.maxDistance = 650; controls.maxPolarAngle = 1.42;
  controls.autoRotateSpeed = 0.35; controls.autoRotate = !!prefs.rotate;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------------- sky, sun, moon, lights */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: C('#2a6ccb') }, uHor: { value: C('#cfe3f7') }, uSunDir: { value: V(0, 1, 0) }, uSunCol: { value: C('#fff') }, uStars: { value: 0 }, uSunVis: { value: 1 }, uFlash: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uHor, uSunDir, uSunCol; uniform float uStars, uSunVis, uFlash, uTime; varying vec3 vDir;
      float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 c = y > 0.0 ? mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.5)) : mix(uHor, uHor * 0.55, clamp(-y * 5.0, 0.0, 1.0));
        float s = max(dot(d, uSunDir), 0.0), hz = 1.0 - clamp(abs(y) * 2.2, 0.0, 1.0);
        c += uSunCol * (pow(s, 5.0) * 0.32 + pow(s, 60.0) * 0.6) * uSunVis * (0.35 + 0.65 * hz) * smoothstep(-0.3, 0.05, uSunDir.y);
        c += uSunCol * smoothstep(0.99955, 0.9998, s) * 30.0 * uSunVis * smoothstep(-0.03, 0.01, uSunDir.y);
        if (uStars > 0.01 && y > 0.0) {
          vec3 p = d * 300.0; vec3 id = floor(p); float r = h31(id);
          float st = step(0.991, r) * smoothstep(0.34, 0.0, length(fract(p) - 0.5));
          c += vec3(0.85, 0.92, 1.0) * st * (0.55 + 0.45 * sin(uTime * 2.5 + r * 120.0)) * uStars * smoothstep(0.02, 0.3, y) * (0.5 + (r - 0.991) * 120.0);
        }
        c += vec3(0.75, 0.82, 1.0) * uFlash * (0.4 + 0.6 * clamp(y, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10; scene.add(sky);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 16), new THREE.ShaderMaterial({
    fog: false, uniforms: { uSunDir: { value: V(0, 1, 0) }, uMap: { value: moonTexture() }, uVis: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uSunDir; uniform sampler2D uMap; uniform float uVis; varying vec3 vN; varying vec2 vUv; void main(){ float l = smoothstep(-0.05, 0.25, dot(normalize(vN), uSunDir)); vec3 a = texture2D(uMap, vUv).rgb; gl_FragColor = vec4(a * (l * 2.6 + 0.04) * uVis, 1.0); }',
  }));
  scene.add(moon);

  const key = new THREE.DirectionalLight('#ffffff', 3);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -150, right: 150, top: 120, bottom: -120, near: 10, far: 700 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05;
  key.target.position.set(0, 0, 10); scene.add(key, key.target);
  const hemi = new THREE.HemisphereLight('#bcd7f5', '#5d5444', 1); scene.add(hemi);
  scene.fog = new THREE.FogExp2('#cfe3f7', 0.0018);

  /* ---------------- ground, water, snow */
  const cityMat = new THREE.MeshStandardMaterial({ map: cityGround(weak ? 1024 : 2048), roughness: 0.96 });
  const cityFloor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2 + 20, WORLD * 2 + 20), cityMat); cityFloor.rotation.x = -Math.PI / 2; cityFloor.receiveShadow = true; scene.add(cityFloor);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture(weak ? 2048 : 4096), roughness: 0.95, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.renderOrder = 1; scene.add(ground);
  const outer = new THREE.Mesh(new THREE.RingGeometry(WORLD + 5, 3200, 64, 1), new THREE.MeshStandardMaterial({ color: '#958d60', roughness: 1 })); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; outer.receiveShadow = true; scene.add(outer);
  const puddles = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2, WORLD * 2), new THREE.MeshStandardMaterial({ color: '#1d2228', roughness: 0.04, metalness: 0.35, transparent: true, opacity: 0, alphaMap: blobTexture(3, 0.56, 0.6), depthWrite: false }));
  puddles.material.alphaMap.wrapS = puddles.material.alphaMap.wrapT = THREE.RepeatWrapping; puddles.material.alphaMap.repeat.set(15, 15);
  puddles.rotation.x = -Math.PI / 2; puddles.position.y = 0.03; puddles.renderOrder = 2; puddles.receiveShadow = true; scene.add(puddles);
  const snowLayer = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2, WORLD * 2), new THREE.MeshStandardMaterial({ color: '#f4f7fb', roughness: 0.85, transparent: true, opacity: 0, alphaMap: blobTexture(11, 0.28, 0.5), depthWrite: false }));
  snowLayer.material.alphaMap.wrapS = snowLayer.material.alphaMap.wrapT = THREE.RepeatWrapping; snowLayer.material.alphaMap.repeat.set(12, 12);
  snowLayer.rotation.x = -Math.PI / 2; snowLayer.position.y = 0.05; snowLayer.renderOrder = 3; snowLayer.receiveShadow = true; scene.add(snowLayer);

  /* ---------------- mountains: Goizha to the north */
  function ridge(width, depth, zc, peak, seed, xs = 1) {
    const geo = new THREE.PlaneGeometry(width, depth, 260, 70); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, cols = new Float32Array(p.count * 3), H = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), u = x * xs;
      const prof = 0.55 + 0.45 * Math.exp(-(((u + 120) / 340) ** 2)) + 0.35 * Math.exp(-(((u - 330) / 200) ** 2)) + (fbm(u * 0.004 + seed, 1.3) - 0.5) * 0.7;
      const across = smooth(0, 1, 1 - Math.abs(z + depth * 0.08) / (depth * 0.5));
      const det = (fbm(u * 0.018 + seed, z * 0.018) - 0.5) * 0.5 + (1 - Math.abs(fbm(u * 0.05, z * 0.05 + seed) * 2 - 1)) * 0.12;
      const h = Math.max(-4, peak * Math.pow(across, 1.25) * (prof + det));
      p.setY(i, h); p.setZ(i, z + zc); H[i] = h / peak;
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, flatShading: false }));
    mesh.receiveShadow = true; scene.add(mesh);
    return { geo, H, peak, mesh };
  }
  const mountains = [ridge(2600, 440, -760, 230, 2), ridge(3600, 620, -1300, 420, 7, 0.7)];
  const lowC = rgb('#8a8256').map((v) => v / 255), midC = rgb('#7c6b55').map((v) => v / 255), hiC = rgb('#a19686').map((v) => v / 255), snowC = [0.93, 0.95, 0.98];
  let snowLineNow = -1;
  function paintMountains(line) {
    if (Math.abs(line - snowLineNow) < 0.02) return; snowLineNow = line;
    for (const m of mountains) {
      const col = m.geo.attributes.color, n = m.geo.attributes.normal;
      for (let i = 0; i < m.H.length; i++) {
        const h = m.H[i], slope = 1 - n.getY(i), j = h2(i, 3) * 0.08;
        let c = h < 0.35 ? lowC.map((v, k) => lerp(v, midC[k], smooth(0.15, 0.35, h + j))) : midC.map((v, k) => lerp(v, hiC[k], smooth(0.35, 0.8, h + j)));
        c = c.map((v, k) => lerp(v, midC[k] * 0.8, smooth(0.25, 0.6, slope)));
        const sn = smooth(line, line + 0.08, h + j * 1.5) * (1 - smooth(0.45, 0.75, slope));
        col.setXYZ(i, ...c.map((v, k) => lerp(v, snowC[k], sn)));
      }
      col.needsUpdate = true;
    }
  }
  const month = localParts(Date.now()).m;
  const seasonLine = [0.45, 0.5, 0.62, 0.85, 1.1, 1.2, 1.2, 1.2, 1.2, 1.1, 0.8, 0.55][month];
  paintMountains(seasonLine);

  /* ---------------- materials */
  const facades = { fac0: facade('apt', 11), fac1: facade('office', 23), fac2: facade('old', 37), hq: facade('hq', 51) };
  const facMat = {};
  for (const [k, f] of Object.entries(facades)) facMat[k] = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.em, emissive: '#ffffff', emissiveIntensity: 0, vertexColors: k !== 'hq', roughness: k === 'hq' ? 0.25 : 0.88, metalness: k === 'hq' ? 0.45 : 0 });
  const mats = {
    ...facMat,
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    misc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }),
    snow: new THREE.MeshStandardMaterial({ color: '#f5f8fc', roughness: 0.8, transparent: true, opacity: 0 }),
    trunk: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  };
  const buckets = {};
  let curLevel = 0;
  const qx = new THREE.Quaternion(), ex = new THREE.Euler();
  function add(key, geo, x, y, z, { ry = 0, rx = 0, color = '#ffffff' } = {}) {
    geo.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), qx.setFromEuler(ex.set(rx, ry, 0)), V(1, 1, 1)));
    (buckets[`${curLevel}|${key}`] ||= []).push(tint(geo, color));
  }
  const local = (cx, cz, ry, lx, lz) => { const c = Math.cos(ry), s = Math.sin(ry); return [cx + lx * c + lz * s, cz - lx * s + lz * c]; };
  const PALETTE = ['#efe6d6', '#e8dcc6', '#f1ece2', '#e5d3b8', '#d9cbb5', '#ece4da', '#e3d9cf', '#d8c3a5', '#f3e9dc', '#cdbfae'];

  // a low old-town house (shown where the modern city has not grown yet)
  function house(x, z, w, d, ry = 0) {
    const h = Math.round(R(1, 2.4)) * 3.2 + 0.4, color = pick(PALETTE);
    add('fac2', boxUV(w, h, d, Math.floor(R(0, 8)) / 8), x, h / 2, z, { ry, color });
    add('roof', new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), x, h + 0.25, z, { ry, color: pick(['#bdb6aa', '#c8c1b5', '#b0a99d']) });
    add('snow', new THREE.BoxGeometry(w - 0.2, 0.12, d - 0.2), x, h + 0.56, z, { ry });
    if (rnd() < 0.6) add('misc', new THREE.CylinderGeometry(0.55, 0.55, 1.2, 10), x + R(-w / 3, w / 3), h + 1.1, z + R(-d / 3, d / 3), { color: pick(['#f0f0ee', '#1d1f22', '#2f6db5']) });
  }
  let lod = false; // far buildings get fewer details (keeps weak computers fast)
  function building(x, z, w, d, h, kind, ry = 0) {
    const color = pick(PALETTE), roofC = pick(['#bdb6aa', '#c8c1b5', '#b0a99d']);
    add({ apt: 'fac0', office: 'fac1', old: 'fac2' }[kind], boxUV(w, h, d, Math.floor(R(0, 8)) / 8), x, h / 2, z, { ry, color: kind === 'office' ? pick(['#e8ecf1', '#dfe5ec', '#f0f2f5']) : color });
    add('roof', new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), x, h + 0.15, z, { ry, color: roofC });
    for (const [lx, lz, bw, bd] of [[0, d / 2, w + 0.3, 0.25], [0, -d / 2, w + 0.3, 0.25], [w / 2, 0, 0.25, d + 0.3], [-w / 2, 0, 0.25, d + 0.3]]) {
      const [px, pz] = local(x, z, ry, lx, lz); add('roof', new THREE.BoxGeometry(bw, 0.75, bd), px, h + 0.55, pz, { ry, color });
    }
    add('snow', new THREE.BoxGeometry(w - 0.3, 0.14, d - 0.3), x, h + 0.38, z, { ry });
    const tanks = rnd() < 0.85 ? 1 + Math.floor(R(0, 3)) : 0;
    for (let i = 0; i < tanks; i++) { const [px, pz] = local(x, z, ry, R(-w / 2 + 1.2, w / 2 - 1.2), R(-d / 2 + 1.2, d / 2 - 1.2)); add('misc', new THREE.CylinderGeometry(0.6, 0.6, 1.3, 16), px, h + 0.95, pz, { color: pick(['#f0f0ee', '#1d1f22', '#2f6db5', '#e8e2d0', '#f0f0ee']) }); }
    if (lod) return;
    if (rnd() < 0.4) { const [px, pz] = local(x, z, ry, R(-w / 2 + 1, w / 2 - 1), d / 2 - 0.8); add('misc', new THREE.CylinderGeometry(0.55, 0.45, 0.08, 20), px, h + 1.1, pz, { ry, rx: -0.9, color: '#e9eaec' }); }
    for (let i = 0, n = Math.floor(R(1, 4)); i < n; i++) { const [px, pz] = local(x, z, ry, R(-w / 2 + 0.8, w / 2 - 0.8), d / 2 + 0.2); add('misc', new THREE.BoxGeometry(0.85, 0.55, 0.38), px, Math.floor(R(1, h / 3.2)) * 3.2 + 0.4, pz, { ry, color: '#e6e8ea' }); }
    if (kind === 'apt') {
      const floors = Math.floor(h / 3.2);
      for (let f = 1; f < floors; f++) for (let c = 0; c < Math.floor(w / 3); c++) {
        if ((c + f) % 2 || rnd() < 0.35) continue;
        const lx = -w / 2 + (c + 0.5) * 3, y = h - (floors - f) * 3.2 - (h % 3.2) + 0.05;
        if (y < 2.5) continue;
        let [px, pz] = local(x, z, ry, lx, d / 2 + 0.5); add('misc', new THREE.BoxGeometry(2.6, 0.16, 1.0), px, y, pz, { ry, color });
        [px, pz] = local(x, z, ry, lx, d / 2 + 0.98); add('misc', new THREE.BoxGeometry(2.6, 0.95, 0.06), px, y + 0.55, pz, { ry, color: pick(['#4b5563', '#6b7280', '#e5e7eb']) });
      }
    }
  }

  // city blocks around the street, deterministic
  rnd = mulberry(2024);
  const blocked = (x, z, w, d) => {
    const E = WORLD, r = [[-30, -38, 30, 24], [-84, 4, 84, 37], [-32, 34, 32, 86], [-E, 18, E, 38], [-E, -48, E, -33], [-E, 88, E, 103], [79, -E, 96, E], [-96, -E, -79, E]];
    return r.some(([a, b, c2, e]) => x + w / 2 > a && x - w / 2 < c2 && z + d / 2 > b && z - d / 2 < e)
      || AVE_X.some((ax) => Math.abs(x - ax) < w / 2 + 7.5) || AVE_Z.some((az) => Math.abs(z - az) < d / 2 + 7.5);
  };
  for (let x = -WORLD; x < WORLD; x += R(13, 17)) {
    for (let z = -WORLD; z < WORLD; z += R(14, 19)) {
      const w = R(9, 14), d = R(9, 13), cx = x + w / 2, cz = z + d / 2;
      const dist = Math.hypot(cx, cz) + Math.max(w, d) / 2, level = LEVEL_R.findIndex((rr) => dist <= rr);
      if (level < 0 || blocked(cx, cz, w + 1, d + 1)) continue;
      const near = dist < 190, south = cz > 38 && near, ry = cz > 38 ? Math.PI : 0;
      const h = south ? R(6.4, 13) : near ? (cz < -48 ? R(12, 38) : R(9.6, 24)) : R(9.6, 18) + (dist < 300 ? R(0, 22) : 0);
      const kind = h > 26 && rnd() < 0.6 ? 'office' : rnd() < 0.3 ? 'old' : 'apt';
      lod = dist > 200;
      curLevel = level; building(cx, cz, w, d, Math.round(h / 3.2) * 3.2, kind, ry);
      if (level > 0) { curLevel = `h${level}`; house(cx, cz, w * R(0.75, 0.95), d * R(0.75, 0.95), ry); }
    }
  }
  const cityMeshes = [];
  for (const [lk, geos] of Object.entries(buckets)) {
    const [lv, k] = lk.split('|');
    const m = new THREE.Mesh(mergeGeometries(geos), mats[k]); m.castShadow = k !== 'snow'; m.receiveShadow = true; scene.add(m);
    cityMeshes.push({ m, level: +String(lv).replace('h', ''), house: String(lv).startsWith('h'), snow: k === 'snow' });
    geos.forEach((g) => g.dispose());
  }
  let cityR = LEVEL_R[0], cityLevel = 1;
  function growCity(dt, snowCover) {
    cityR = lerp(cityR, LEVEL_R[cityLevel - 1], 1 - Math.exp(-dt * 0.8));
    for (const c of cityMeshes) {
      const lo = c.level ? LEVEL_R[c.level - 1] : 0, hi = LEVEL_R[c.level];
      const grown = smooth(0, 1, (cityR - lo + 2) / (hi - lo)), g = c.house ? 1 - smooth(0, 0.35, grown) : grown;
      c.m.scale.y = Math.max(0.001, g); c.m.visible = g > 0.002 && (!c.snow || snowCover > 0.01);
    }
  }
  rnd = mulberry(77);

  /* ---------------- trees (instanced, they sway in the wind) */
  const trees = [];
  const addTree = (x, z, type, s = 1) => trees.push({ x, z, type, s: s * R(0.85, 1.2), ph: R(0, 6), d: Math.hypot(x, z) });
  for (let x = -170; x <= 170; x += 20) if (Math.abs(x) > 8) addTree(x + R(-1, 1), 35.8, 'round', 0.8);
  for (let i = 0; i < 46; i++) { const a = R(0, Math.PI * 2), r = R(16, 28); const x = clamp(Math.cos(a) * r * 1.3, -28, 28), z = clamp(60 + Math.sin(a) * r, 39, 83); if (Math.hypot(x, z - 60) > 8.5) addTree(x, z, rnd() < 0.7 ? 'round' : 'poplar', 1.1); }
  for (let x = -176; x <= 176; x += 7) if (Math.abs(x) > 96) { addTree(x, -32, 'poplar'); }
  for (let z = -176; z <= 170; z += 8) { addTree(96, z, 'poplar'); addTree(-96, z, 'poplar'); }
  for (const [x, z] of [[-24, -8], [24, -8], [-24, 17], [24, 17], [-24, -30], [24, -30]]) addTree(x, z, 'round', 1.15);
  for (let x = -176; x <= 176; x += 9) addTree(x + R(-2, 2), -49, rnd() < 0.5 ? 'poplar' : 'round');
  for (const ax of AVE_X) for (let z = -WORLD; z <= WORLD; z += 18) if (Math.hypot(ax, z) < WORLD && !AVE_Z.some((az) => Math.abs(z - az) < 10)) addTree(ax + 6, z + R(-2, 2), rnd() < 0.6 ? 'poplar' : 'round', 0.9);
  for (const az of AVE_Z) for (let x = -WORLD; x <= WORLD; x += 18) if (Math.hypot(x, az) < WORLD && !AVE_X.some((ax) => Math.abs(x - ax) < 10)) addTree(x + R(-2, 2), az + 6, rnd() < 0.5 ? 'poplar' : 'round', 0.9);
  const crownGeo = new THREE.IcosahedronGeometry(1, 2); { const p = crownGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 + (fbm(v.x * 2 + 9, v.y * 2 + v.z) - 0.5) * 0.5); p.setXYZ(i, v.x, v.y, v.z); } crownGeo.computeVertexNormals(); }
  const poplarGeo = new THREE.ConeGeometry(1, 1, 9, 4); { const p = poplarGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + (h2(i, 1) - 0.5) * 0.25; p.setX(i, p.getX(i) * k * (1 - Math.max(0, -y - 0.3) * 0.6)); p.setZ(i, p.getZ(i) * k); } poplarGeo.computeVertexNormals(); }
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
  const rounds = trees.filter((x) => x.type === 'round'), poplars = trees.filter((x) => x.type === 'poplar');
  const roundMesh = new THREE.InstancedMesh(crownGeo, leafMat, rounds.length), poplarMesh = new THREE.InstancedMesh(poplarGeo, leafMat, poplars.length);
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.26, 1, 7), new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.9 }), trees.length);
  for (const m of [roundMesh, poplarMesh, trunkMesh]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  const LEAF = ['#4f6d2f', '#5c7a35', '#476528', '#6b8238', '#a88a2c', '#c19a32', '#7c8a33'];
  rounds.forEach((tr, i) => roundMesh.setColorAt(i, C(LEAF[Math.floor(h2(i, 5) * 4.6)])));
  poplars.forEach((tr, i) => poplarMesh.setColorAt(i, C(LEAF[h2(i, 8) < 0.35 ? 4 + Math.floor(h2(i, 2) * 3) : Math.floor(h2(i, 9) * 4)])));
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), one = V(1, 1, 1);
  let cityRT = LEVEL_R[0];
  const treeG = () => 1;
  function swayTrees(T, wind) {
    const amp = 0.015 + wind * 0.006;
    trees.forEach((tr, i) => { const g = treeG(tr), th = (tr.type === 'poplar' ? 3.2 : 2.4) * tr.s * g; trunkMesh.setMatrixAt(i, mtx.compose(V(tr.x, th / 2, tr.z), q.identity(), V(tr.s * g, th, tr.s * g))); });
    trunkMesh.instanceMatrix.needsUpdate = true;
    rounds.forEach((tr, i) => { const s = tr.s * treeG(tr); e3.set(Math.sin(T * 1.3 + tr.ph) * amp, 0, Math.cos(T * 1.1 + tr.ph) * amp); roundMesh.setMatrixAt(i, mtx.compose(V(tr.x, 2.4 * s + 1.6 * s, tr.z), q.setFromEuler(e3), V(2.3 * s, 2.0 * s, 2.3 * s))); });
    poplars.forEach((tr, i) => { const s = tr.s * treeG(tr); e3.set(Math.sin(T * 1.6 + tr.ph) * amp * 1.4, 0, Math.cos(T * 1.2 + tr.ph) * amp * 1.4); poplarMesh.setMatrixAt(i, mtx.compose(V(tr.x, 3.2 * s + 4.6 * s, tr.z), q.setFromEuler(e3), V(1.25 * s, 10 * s, 1.25 * s))); });
    roundMesh.instanceMatrix.needsUpdate = true; poplarMesh.instanceMatrix.needsUpdate = true;
  }
  swayTrees(0, 2);

  /* ---------------- street lamps */
  const lampSpots = [];
  for (let x = -168; x <= 168; x += 16) { lampSpots.push([x, 23.4, Math.PI]); lampSpots.push([x + 8, 34.6, 0]); }
  for (const [x, z] of [[-26, -4], [26, -4], [-26, 12], [26, 12]]) lampSpots.push([x, z, 0]);
  const poleM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 6.2, 8), new THREE.MeshStandardMaterial({ color: '#30353d', metalness: 0.6, roughness: 0.4 }), lampSpots.length);
  const headMat = new THREE.MeshStandardMaterial({ color: '#2d2f33', emissive: '#ffd08a', emissiveIntensity: 0 });
  const headM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.16, 1.1), headMat, lampSpots.length);
  lampSpots.forEach(([x, z, ry], i) => { poleM.setMatrixAt(i, mtx.compose(V(x, 3.1, z), q.identity(), one)); headM.setMatrixAt(i, mtx.compose(V(x, 6.15, z + (ry ? -0.45 : 0.45)), q.identity(), one)); });
  poleM.castShadow = true; scene.add(poleM, headM);
  const lampLights = lampSpots.filter(([x]) => Math.abs(x) < 60).slice(0, 12).map(([x, z, ry]) => { const l = new THREE.PointLight('#ffc77a', 0, 26, 1.6); l.position.set(x, 5.8, z + (ry ? -0.6 : 0.6)); scene.add(l); return l; });

  /* ---------------- HQ */
  const hq = new THREE.Group(); scene.add(hq);
  const hqBody = new THREE.Mesh(boxUV(28, 19.2, 15), facMat.hq); hqBody.position.set(0, 9.6, -18); hqBody.castShadow = hqBody.receiveShadow = true; hq.add(hqBody);
  const stripMat = new THREE.MeshStandardMaterial({ color: '#ff6b2c', emissive: '#ff6b2c', emissiveIntensity: 1.2 });
  for (const y of [3.6, 19.25]) { const s = new THREE.Mesh(new THREE.BoxGeometry(28.4, 0.22, 0.22), stripMat); s.position.set(0, y, -10.4); hq.add(s); }
  const hqRoof = new THREE.Mesh(new THREE.BoxGeometry(28.6, 0.5, 15.6), new THREE.MeshStandardMaterial({ color: '#1b2230', roughness: 0.6 })); hqRoof.position.set(0, 19.45, -18); hqRoof.castShadow = true; hq.add(hqRoof);
  const lobby = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 1.6), new THREE.MeshStandardMaterial({ color: '#2a3b55', roughness: 0.05, metalness: 0.3, emissive: '#ffe1b0', emissiveIntensity: 0.1 })); lobby.position.set(0, 1.7, -9.9); hq.add(lobby);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 3.6), new THREE.MeshStandardMaterial({ color: '#0f1b33', roughness: 0.4, metalness: 0.4 })); canopy.position.set(0, 3.9, -9.4); canopy.castShadow = true; hq.add(canopy);
  { // big rooftop sign
    const [c, g] = canvas(2048, 400); g.clearRect(0, 0, 2048, 400);
    g.fillStyle = '#ff6b2c'; roundRect(g, 40, 40, 320, 320, 70); g.fill();
    g.fillStyle = '#fff'; g.font = '800 250px "Plus Jakarta Sans", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText('J', 200, 214);
    g.textAlign = 'left'; g.font = '800 240px "Plus Jakarta Sans", sans-serif'; g.fillText('JUMP', 420, 214); g.fillStyle = '#ff6b2c'; g.fillText('HQ', 1180, 214);
    const sm = new THREE.MeshStandardMaterial({ map: tex(c), emissiveMap: tex(c), emissive: '#ffffff', emissiveIntensity: 0.6, transparent: true, roughness: 0.4 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 3.9), sm); sign.position.set(-1, 22, -10.6); hq.add(sign); hq.userData.sign = sm;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 0.25, 0.25), new THREE.MeshStandardMaterial({ color: '#30353d', metalness: 0.7, roughness: 0.3 })); frame.position.set(0, 19.9, -10.8); hq.add(frame);
  }
  const ledCanvas = canvas(1024, 384), ledTex = tex(ledCanvas[0]);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: ledTex })); led.position.set(-7.5, 8.2, -10.42); hq.add(led);
  const ledFrame = new THREE.Mesh(new THREE.BoxGeometry(12.5, 5, 0.3), new THREE.MeshStandardMaterial({ color: '#0b0f17', roughness: 0.5 })); ledFrame.position.set(-7.5, 8.2, -10.6); hq.add(ledFrame);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 9, 8), new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.8, roughness: 0.3 })); mast.position.set(10, 24.2, -21); mast.castShadow = true; hq.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff2020', emissiveIntensity: 2 })); beacon.position.set(10, 28.8, -21); hq.add(beacon);
  const panelGeo = new THREE.BoxGeometry(3.2, 0.08, 1.8), panelMat = new THREE.MeshStandardMaterial({ color: '#1e3a5f', metalness: 0.7, roughness: 0.2 });
  for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(panelGeo, panelMat); p.position.set(-11 + (i % 4) * 3.6, 20.4, -22 - Math.floor(i / 4) * 2.6); p.rotation.x = -0.35; p.castShadow = true; hq.add(p); }
  // the Kurdistan flag: big, on a tall pole in the middle of the plaza
  const FW = 10, FH = 6.6;
  { const steel = new THREE.MeshStandardMaterial({ color: '#d7dbe0', metalness: 0.85, roughness: 0.22 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.7, 40), new THREE.MeshStandardMaterial({ color: '#cfc6b6', roughness: 0.7 })); plinth.position.set(TABLE.x, 0.35, TABLE.z); plinth.castShadow = plinth.receiveShadow = true; scene.add(plinth);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 26, 16), steel); pole.position.set(TABLE.x, 13.3, TABLE.z); pole.castShadow = true; scene.add(pole);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), new THREE.MeshStandardMaterial({ color: '#febd11', metalness: 0.9, roughness: 0.2 })); fin.position.set(TABLE.x, 26.5, TABLE.z); scene.add(fin); }
  const flagGeo = new THREE.PlaneGeometry(FW, FH, 40, 24), flagBase = flagGeo.attributes.position.array.slice();
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.75 })); flag.position.set(TABLE.x + FW / 2 + 0.2, 26 - FH / 2 - 0.3, TABLE.z); flag.castShadow = true; scene.add(flag);
  const flagSpot = new THREE.SpotLight('#fff1d6', 0, 45, 0.4, 0.6, 1.1); flagSpot.position.set(TABLE.x + 8, 1.5, TABLE.z + 12); flagSpot.target = flag; scene.add(flagSpot);
  { const wood = new THREE.MeshStandardMaterial({ color: '#8a5a35', roughness: 0.7 }), iron = new THREE.MeshStandardMaterial({ color: '#2b2f36', metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5, b = new THREE.Group(); b.position.set(TABLE.x + Math.cos(a) * 8.6, 0, TABLE.z + Math.sin(a) * 8.6); b.rotation.y = -a - Math.PI / 2;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.6), wood); seat.position.y = 0.48; const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.08), wood); back.position.set(0, 0.8, -0.28);
      for (const s2 of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.55), iron); l.position.set(s2 * 1.05, 0.24, 0); b.add(l); }
      for (const m of [seat, back]) { m.castShadow = true; b.add(m); }
      scene.add(b);
    } }
  // Pozaka Street signs
  { const [c, g] = canvas(1024, 256); g.fillStyle = '#0f5132'; g.fillRect(0, 0, 1024, 256); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(14, 14, 996, 228); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 84px "Noto Sans Arabic", sans-serif'; g.direction = 'rtl'; g.fillText('شەقامی پۆزاکا', 512, 112); g.direction = 'ltr'; g.font = '700 60px "Plus Jakarta Sans", sans-serif'; g.fillText('Pozaka Street', 512, 200);
    const signM = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.5, side: THREE.DoubleSide });
    for (const x of [-27.5, 27.5]) { const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), signM); s2.position.set(x, 4.4, 22.6); scene.add(s2);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 8), poleM.material); p2.position.set(x, 2.3, 22.8); scene.add(p2); } }

  /* ---------------- holo-table */
  const holo = new THREE.Group(); holo.position.copy(ITABLE); holo.scale.setScalar(0.62); scene.add(holo);
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.95, 40), new THREE.MeshStandardMaterial({ color: '#1b2230', metalness: 0.6, roughness: 0.35 })); tb.position.y = 0.48; tb.castShadow = tb.receiveShadow = true; holo.add(tb);
  const holoMat = new THREE.MeshBasicMaterial({ color: '#5eead4', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const ringTop = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 8, 64), holoMat); ringTop.rotation.x = Math.PI / 2; ringTop.position.y = 0.98; holo.add(ringTop);
  const holoSpin = new THREE.Group(); holoSpin.position.y = 1.0; holo.add(holoSpin);
  const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 2), new THREE.MeshBasicMaterial({ color: '#5eead4', wireframe: true, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })); globe.position.y = 1.7; holoSpin.add(globe);
  const bars = [...Array(7)].map((_, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 0.3), holoMat); const a = (i / 7) * Math.PI * 2; b.position.set(Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6); holoSpin.add(b); return b; });
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.03, 6, 64), holoMat); ring2.position.y = 1.7; holoSpin.add(ring2);

  /* ---------------- park fountain */
  { const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.7, 40), new THREE.MeshStandardMaterial({ color: '#cbc3b4', roughness: 0.8 })); basin.position.set(0, 0.35, 60); basin.receiveShadow = basin.castShadow = true; scene.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.85, 40), new THREE.MeshStandardMaterial({ color: '#2b6f8f', roughness: 0.05, metalness: 0.2 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.62, 60); scene.add(water); }
  const jets = [0, 1, 2, 3, 4].map((i) => { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#cfeeff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); const a = (i / 5) * Math.PI * 2; j.position.set(i ? Math.cos(a) * 1.8 : 0, 0.6, 60 + (i ? Math.sin(a) * 1.8 : 0)); scene.add(j); return j; });

  /* ---------------- inside Jump HQ: the team's office on the ground floor */
  const inside = new THREE.Group(); scene.add(inside);
  const floorTex = (() => {
    const [c, g] = canvas(1024, 1024);
    for (let y = 0; y < 1024; y += 64) for (let x = -R(0, 200); x < 1024;) {
      const w = R(200, 340); g.fillStyle = `hsl(${R(24, 31)}, ${R(30, 40)}%, ${R(36, 46)}%)`; g.fillRect(x, y, w, 64);
      for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(70,40,15,${R(0.05, 0.14)})`; g.fillRect(x, y + R(3, 61), w, R(1, 2.5)); }
      g.fillStyle = 'rgba(30,18,8,.6)'; g.fillRect(x, y, 2, 64); x += w;
    }
    g.fillStyle = 'rgba(30,18,8,.6)'; for (let y = 0; y < 1024; y += 64) g.fillRect(0, y, 1024, 2);
    const t2 = tex(c, { repeat: true }); t2.repeat.set(3.2, 1.7); return t2;
  })();
  const recv = (m) => { m.receiveShadow = true; return m; };
  const floor = recv(new THREE.Mesh(new THREE.PlaneGeometry(27.2, 14.3), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.32, metalness: 0.04 })));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.04, -18.05); inside.add(floor);
  const rug = recv(new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshStandardMaterial({ color: '#1f2a3d', roughness: 0.95 }))); rug.rotation.x = -Math.PI / 2; rug.position.set(ITABLE.x, 0.05, ITABLE.z); inside.add(rug);
  const rugRing = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.05, 64), new THREE.MeshBasicMaterial({ color: '#ff6b2c' })); rugRing.rotation.x = -Math.PI / 2; rugRing.position.set(ITABLE.x, 0.06, ITABLE.z); inside.add(rugRing);
  const wallM = new THREE.MeshStandardMaterial({ color: '#ebe7e0', roughness: 0.92, side: THREE.BackSide });
  const backM = new THREE.MeshStandardMaterial({ color: '#172033', roughness: 0.8, side: THREE.BackSide });
  const ceilM = new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.95, side: THREE.BackSide });
  const glassM = new THREE.MeshStandardMaterial({ color: '#a9c8e8', roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false });
  const shell = recv(new THREE.Mesh(new THREE.BoxGeometry(27.3, 4.65, 14.4), [wallM, wallM, ceilM, new THREE.MeshBasicMaterial({ visible: false }), glassM, backM]));
  shell.position.set(0, 2.32, -18.05); inside.add(shell);
  const darkM = new THREE.MeshStandardMaterial({ color: '#202734', metalness: 0.6, roughness: 0.35 });
  for (let x = -12; x <= 12; x += 3) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 4.6, 0.09), darkM); m.position.set(x, 2.3, -10.92); inside.add(m); }
  { const m = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.09, 0.09), darkM); m.position.set(0, 3.3, -10.92); inside.add(m); }
  // the live board, the logo and the ceiling lights
  const ledIn = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 3.15), new THREE.MeshBasicMaterial({ map: ledTex })); ledIn.position.set(0, 2.85, -25.18); inside.add(ledIn);
  { const fr = new THREE.Mesh(new THREE.BoxGeometry(8.7, 3.45, 0.1), darkM); fr.position.set(0, 2.85, -25.24); inside.add(fr); }
  const logoIn = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.4), new THREE.MeshStandardMaterial({ map: hq.userData.sign.map, emissiveMap: hq.userData.sign.map, emissive: '#ffffff', emissiveIntensity: 0.5, transparent: true }));
  logoIn.position.set(-13.58, 3.1, -18.6); logoIn.rotation.y = Math.PI / 2; inside.add(logoIn);
  const ceilLightM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4e2', emissiveIntensity: 1.3 });
  for (const x of [-7.5, 0, 7.5]) for (const z of [-14.2, -21.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 0.9), ceilLightM); l.position.set(x, 4.6, z); inside.add(l); }
  const roomLights = [[-7, -14.5], [7, -14.5], [-7, -21.5], [7, -21.5]].map(([x, z]) => { const l = new THREE.PointLight('#fff1de', 0, 15, 1.4); l.position.set(x, 4.1, z); inside.add(l); return l; });
  // coffee bar, plants, a sofa by the window
  const whiteM = new THREE.MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.35 });
  { const bar = recv(new THREE.Mesh(new THREE.BoxGeometry(3, 1.05, 0.7), whiteM)); bar.position.set(0, 0.53, -24.55); bar.castShadow = true; inside.add(bar);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.06, 0.8), new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 0.4 })); top.position.set(0, 1.08, -24.55); inside.add(top);
    const mach = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.45), darkM); mach.position.set(-0.8, 1.38, -24.6); inside.add(mach);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 3 })); dot.position.set(-0.8, 1.5, -24.36); inside.add(dot);
    for (const x of [0.2, 0.45, 0.7]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 12), whiteM); cup.position.set(x, 1.17, -24.45); inside.add(cup); } }
  const potM = new THREE.MeshStandardMaterial({ color: '#d6d3d1', roughness: 0.6 }), leafIn = new THREE.MeshStandardMaterial({ color: '#3f6b2a', roughness: 0.8, flatShading: true });
  for (const [x, z] of [[-12.8, -11.6], [12.8, -11.6], [-12.8, -24.5], [12.8, -24.5], [-2.6, -24.6], [2.6, -24.6]]) {
    const pot = recv(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.7, 20), potM)); pot.position.set(x, 0.35, z); pot.castShadow = true; inside.add(pot);
    for (let i = 0; i < 4; i++) { const l = recv(new THREE.Mesh(crownGeo, leafIn)); l.scale.set(0.42, 0.62, 0.42); l.position.set(x + R(-0.2, 0.2), 1.0 + i * 0.32, z + R(-0.2, 0.2)); inside.add(l); }
  }
  { const sofaM = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.9 }), sofa = new THREE.Group(); sofa.position.set(6.5, 0, -12.1); sofa.rotation.y = Math.PI;
    const seat = recv(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 0.95), sofaM)); seat.position.y = 0.32; const back = recv(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.25), sofaM)); back.position.set(0, 0.75, 0.38);
    sofa.add(seat, back); for (const x of [-1.6, 1.6]) { const arm = recv(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.95), sofaM)); arm.position.set(x, 0.45, 0); sofa.add(arm); } inside.add(sofa);
    const tbl = recv(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 24), whiteM)); tbl.position.set(6.5, 0.21, -13.6); inside.add(tbl); }
  // one standing desk per agent, each with its own live screen
  const deskTop = new THREE.MeshStandardMaterial({ color: '#f4f4f5', roughness: 0.4 });
  const rot = (ry, lx, lz) => [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)];
  const desks = Object.fromEntries(ORDER.map((k) => {
    const [x, z, f] = DESKS[k], ry = f === 1 ? Math.PI / 2 : f === -1 ? -Math.PI / 2 : 0, col = ROLE[k].color;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; inside.add(g);
    const top = recv(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.9), deskTop)); top.position.y = 1.02; top.castShadow = true; g.add(top);
    for (const sx of [-0.85, 0.85]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.7), darkM); l.position.set(sx, 0.5, 0); g.add(l); }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.02), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.5 })); strip.position.set(0, 1.0, -0.46); g.add(strip);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), darkM); stand.position.set(0, 1.2, 0.24); g.add(stand);
    const [sc, sg] = canvas(512, 288), scrTex = tex(sc);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.65), new THREE.MeshBasicMaterial({ map: scrTex })); screen.position.set(0, 1.62, 0.2); screen.rotation.set(0.08, Math.PI, 0); g.add(screen);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.72, 0.04), darkM); bezel.position.set(0, 1.62, 0.23); bezel.rotation.x = -0.08; g.add(bezel);
    const screen2 = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.65), screen.material); screen2.position.set(0, 1.62, 0.26); screen2.rotation.x = -0.08; g.add(screen2); // readable from the room too
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.2), darkM); kb.position.set(0, 1.065, -0.12); g.add(kb);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })); mug.position.set(0.7, 1.1, -0.1); g.add(mug);
    const pad = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.06, -0.85); g.add(pad);
    const at = (lx, lz) => { const [dx, dz] = rot(ry, lx, lz); return V(x + dx, 0, z + dz); };
    return [k, { ry, spot: at(0, -0.85), side: at(1.3, -0.85), front: at(1.3, 1.05), scr: [sc, sg], scrTex, scrKey: '', pad }];
  }));
  const BREAKS = [{ n: 'coffee', p: V(0, 0, -23.45), ry: Math.PI }, { n: 'window', p: V(-8.6, 0, -11.75), ry: 0 }, { n: 'window2', p: V(2.5, 0, -11.75), ry: 0 }, { n: 'sofa', p: V(4.6, 0, -13.2), ry: Math.PI / 2 }];

  /* ---------------- drones and the build beam: the team's work out on the street */
  const droneMat = new THREE.MeshStandardMaterial({ color: '#1f2937', metalness: 0.6, roughness: 0.35 });
  const rotorMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.5, roughness: 0.4 });
  const drones = Object.fromEntries(DRONE_ROLES.map((k, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.8), droneMat); body.castShadow = true; g.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: ROLE[k].color, metalness: 0.3, roughness: 0.3 })); dome.position.y = 0.1; g.add(dome);
    const rotors = [];
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 1.0), droneMat); arm.position.set(x * 0.4, 0, z * 0.4); arm.rotation.y = Math.atan2(x, z); g.add(arm);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 20), rotorMat); r.position.set(x * 0.78, 0.1, z * 0.78); g.add(r); rotors.push(r);
    }
    const ledM = new THREE.MeshStandardMaterial({ color: ROLE[k].color, emissive: ROLE[k].color, emissiveIntensity: 2 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), ledM); led.position.set(0, -0.12, 0.42); g.add(led);
    const beamM = new THREE.MeshBasicMaterial({ color: ROLE[k].color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.6, 28, 1, true), beamM); beam.position.y = -2.4; g.add(beam);
    g.scale.setScalar(2.4);
    const home = V(-6 + i * 6, 20.1, -14.2);
    g.position.copy(home); scene.add(g);
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.0, 40), new THREE.MeshBasicMaterial({ color: ROLE[k].color, transparent: true, opacity: 0.7 })); pad.rotation.x = -Math.PI / 2; pad.position.set(home.x, 19.72, home.z); scene.add(pad);
    return [k, { k, g, rotors, beamM, ledM, home, spot: null, hover: 0, idx: 0 }];
  }));
  const buildBeamM = new THREE.MeshBasicMaterial({ color: C(ROLE.builder.color).multiplyScalar(2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const buildBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 10, 1, true), buildBeamM); buildBeam.frustumCulled = false; scene.add(buildBeam);
  const beamDots = [...Array(5)].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: C('#ffd2bd').multiplyScalar(2) })); m.visible = false; scene.add(m); return m; });
  const ROOF_OUT = V(0, 20.4, -11.2);

  /* ---------------- shops (the businesses the team works on) */
  const shopBodyMat = new THREE.MeshStandardMaterial({ color: '#e9e1d3', roughness: 0.85 });
  const shops = SLOT_X.map((x, i) => {
    const g = new THREE.Group(); g.position.set(x, 0, SHOP_Z); scene.add(g);
    const tintC = PALETTE[i % PALETTE.length];
    const upper = new THREE.Mesh(tint(boxUV(11, 4.8, 10, (i % 8) / 8), tintC), facMat.fac2); upper.position.y = 3.9 + 2.4; upper.castShadow = upper.receiveShadow = true; g.add(upper);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(11, 3.9, 10), shopBodyMat); lower.position.y = 1.95; lower.castShadow = lower.receiveShadow = true; g.add(lower);
    const glassMat = new THREE.MeshStandardMaterial({ color: '#16202b', roughness: 0.08, metalness: 0.3, emissive: '#ffcf8f', emissiveIntensity: 0.1 });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 2.7), glassMat); glass.position.set(0, 1.55, 5.02); g.add(glass);
    for (const s of [-4.75, 0, 4.75]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.9, 0.12), new THREE.MeshStandardMaterial({ color: '#2b2f36', metalness: 0.6 })); m.position.set(s, 1.55, 5.06); g.add(m); }
    const [ac, ag] = canvas(256, 64); const awnColor = pick(['#b91c1c', '#0f766e', '#1d4ed8', '#c2410c', '#15803d', '#a16207']);
    for (let s = 0; s < 16; s++) { ag.fillStyle = s % 2 ? '#f8fafc' : awnColor; ag.fillRect(s * 16, 0, 16, 64); }
    const awnMat = new THREE.MeshStandardMaterial({ map: tex(ac), roughness: 0.8, side: THREE.DoubleSide });
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 1.9), awnMat); awn.position.set(0, 3.15, 5.85); awn.rotation.x = -1.2; awn.castShadow = true; g.add(awn);
    const signMat = new THREE.MeshStandardMaterial({ map: signTexture(FILLER_SIGNS[i], '#1f2937', '#ffffff'), roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.05 });
    signMat.emissiveMap = signMat.map;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 1.45, 0.25), [shopBodyMat, shopBodyMat, shopBodyMat, shopBodyMat, signMat, shopBodyMat]); sign.position.set(0, 4.45, 5.15); g.add(sign);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.3, 0.35, 10.3), new THREE.MeshStandardMaterial({ color: '#bdb6aa', roughness: 0.95 })); roof.position.y = 8.85; roof.castShadow = true; g.add(roof);
    const snowTop = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.14, 9.8), mats.snow); snowTop.position.y = 9.1; g.add(snowTop);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 16), new THREE.MeshStandardMaterial({ color: pick(['#f0f0ee', '#1d1f22', '#2f6db5']), roughness: 0.5 })); tank.position.set(R(-3, 3), 9.7, -2); tank.castShadow = true; g.add(tank);
    g.traverse((o) => { if (o.isMesh) o.userData.shop = i; });
    return { i, x, g, glassMat, signMat, lead: null, status: 'filler', holo: null, progress: 0, chip: null, signKey: '' };
  });

  function makeHolo(shop) {
    const l = shop.lead, grp = new THREE.Group(); grp.position.set(shop.x, 13.4, SHOP_Z + 2.5); scene.add(grp);
    const col = C('#ff6b2c');
    const inner = new THREE.Group(); grp.add(inner);
    const panelMat = new THREE.MeshBasicMaterial({ map: siteTexture(l.business, l.business_local, '#ff6b2c', l.niche || ''), transparent: true, opacity: 0.94, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 5.4), panelMat); panel.position.y = 2.7; inner.add(panel);
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(13, 9.5), glowMat); glow.position.set(0, 2.7, -0.08); inner.add(glow);
    const frameMat = new THREE.LineBasicMaterial({ color: col.clone().multiplyScalar(3) });
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(8.9, 5.7)), frameMat); frame.position.y = 2.7; inner.add(frame);
    const beamMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 1.1, 4.2, 20, 1, true), beamMat); beam.position.set(0, -2.1, -2.5); grp.add(beam);
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 0.12), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); inner.add(scan);
    return { grp, inner, panel, panelMat, glowMat, frameMat, beamMat, scan, col, key: l.id };
  }
  const glowTex = glowTexture();

  /* ---------------- cars */
  const cars = [...Array(14)].map((_, i) => {
    const g = new THREE.Group(); scene.add(g);
    const paint = new THREE.MeshStandardMaterial({ color: pick(['#f4f4f2', '#c0c4ca', '#111317', '#8b1e1e', '#d9cbb0', '#f4f4f2', '#55606e', '#1f3a68', '#f4f4f2']), metalness: 0.55, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.78, 1.86), paint); body.position.y = 0.72; body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.66, 1.7), new THREE.MeshStandardMaterial({ color: '#1a2330', metalness: 0.4, roughness: 0.12 })); cab.position.set(-0.25, 1.4, 0); cab.castShadow = true; g.add(cab);
    const roofP = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 1.62), paint); roofP.position.set(-0.25, 1.75, 0); g.add(roofP);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16), wm = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.8 });
    const wheels = [[1.35, 0.95], [1.35, -0.95], [-1.35, 0.95], [-1.35, -0.95]].map(([x, z]) => { const w = new THREE.Mesh(wheelGeo, wm); w.rotation.x = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); return w; });
    const headMatC = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4dc', emissiveIntensity: 0.3 });
    const tailMat = new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#ff2020', emissiveIntensity: 0.3 });
    for (const s of [-0.65, 0.65]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.36), headMatC); h.position.set(2.16, 0.82, s); g.add(h); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.36), tailMat); tl.position.set(-2.16, 0.82, s); g.add(tl); }
    const beamM = new THREE.MeshBasicMaterial({ color: '#fff1d0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 20, 1, true), beamM); cone.rotation.z = Math.PI / 2; cone.position.set(6.6, 0.7, 0); g.add(cone);
    const dir = i % 2 ? -1 : 1;
    g.position.set(R(-290, 290), 0, dir > 0 ? 26.6 : 31.4); g.rotation.y = dir > 0 ? 0 : Math.PI;
    return { g, dir, v: R(8, 13), base: 0, wheels, headMatC, tailMat, beamM };
  });

  /* ---------------- passers-by and birds */
  const SHIRTS = ['#3b6ea5', '#a23b3b', '#e2e2e2', '#2f855a', '#b7791f', '#4a5568', '#c05621', '#2c5282', '#7c2d12', '#0f766e'];
  const peds = [...Array(10)].map((_, i) => {
    const p = makePerson(pick(SHIRTS), { skin: pick(['#e0b48f', '#c99671', '#a8764f', '#eac3a0']), pants: pick(['#1f2937', '#374151', '#3f3a32', '#1e3a5f']), hair: pick(['#1b130d', '#2b1d12', '#4a3626', '#0f0f0f']) });
    const south = i % 3 === 0;
    p.g.position.set(R(-150, 150), 0, south ? 35.9 : 22.9); scene.add(p.g);
    return { p, dir: rnd() < 0.5 ? -1 : 1, v: R(1.1, 1.6) };
  });
  const birdMat = new THREE.MeshBasicMaterial({ color: '#1a1a1a', side: THREE.DoubleSide });
  const birds = [...Array(9)].map(() => {
    const g = new THREE.Group(), wg = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0.9, 0.05, 0.25), V(0, 0, 0.45)]);
    const L = new THREE.Mesh(wg, birdMat), Rw = new THREE.Mesh(wg, birdMat); Rw.scale.x = -1; g.add(L, Rw); scene.add(g);
    return { g, L, Rw, r: R(30, 80), y: R(38, 62), a: R(0, 6), s: R(0.15, 0.3) * (rnd() < 0.5 ? -1 : 1), ph: R(0, 6) };
  });

  /* ---------------- clouds */
  const CL = 30, PUFF = 8;
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.94 });
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), cloudMat, CL * PUFF);
  clouds.frustumCulled = false; scene.add(clouds);
  const cloudData = [...Array(CL)].map((_, i) => ({ x: R(-500, 500), y: R(85, 135), z: R(-420, 160), s: R(0.7, 1.4), on: 0, puffs: [...Array(PUFF)].map(() => ({ x: R(-22, 22), y: R(-3, 5), z: R(-9, 9), s: R(9, 17) })), order: h2(i, 4) }));

  /* ---------------- rain, snow, lightning */
  const DROPS = 16000;
  const rainGeo = new THREE.BufferGeometry();
  { const pos = new Float32Array(DROPS * 6), dr = new Float32Array(DROPS * 8), end = new Float32Array(DROPS * 2);
    for (let i = 0; i < DROPS; i++) { const d = [Math.random(), Math.random(), Math.random(), 26 + Math.random() * 14]; dr.set(d, i * 8); dr.set(d, i * 8 + 4); end[i * 2] = 0; end[i * 2 + 1] = 1; }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); rainGeo.setAttribute('aDrop', new THREE.BufferAttribute(dr, 4)); rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1)); }
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uCenter: { value: V() }, uWind: { value: new THREE.Vector2() }, uOpacity: { value: 0 }, uCount: { value: 1 }, uColor: { value: C('#b8c6d8') } },
    vertexShader: `attribute vec4 aDrop; attribute float aEnd; uniform float uTime, uCount; uniform vec3 uCenter; uniform vec2 uWind; varying float vA;
      void main(){
        float size = 170.0, H = 80.0;
        float y = mod(aDrop.z * H - uTime * aDrop.w, H);
        vec3 p = vec3(uCenter.x + mod(aDrop.x * size - uCenter.x, size) - size * 0.5, y, uCenter.z + mod(aDrop.y * size - uCenter.z, size) - size * 0.5);
        p.xz += uWind * (H - y) / aDrop.w;
        vec3 v = normalize(vec3(uWind.x, -aDrop.w, uWind.y));
        if (aEnd > 0.5) p -= v * 1.7;
        vA = (aEnd > 0.5 ? 0.0 : 1.0) * step(aDrop.x, uCount) * (1.0 - step(-14.3, p.x) * step(p.x, 14.3) * step(-25.8, p.z) * step(p.z, -10.2) * step(p.y, 20.5));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'uniform float uOpacity; uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * uOpacity); }',
  });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
  const FLAKES = 9000, snowGeo = new THREE.BufferGeometry();
  { const pos = new Float32Array(FLAKES * 3), fd = new Float32Array(FLAKES * 4); for (let i = 0; i < FLAKES; i++) fd.set([Math.random(), Math.random(), Math.random(), 1.2 + Math.random() * 1.6], i * 4);
    snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); snowGeo.setAttribute('aFlake', new THREE.BufferAttribute(fd, 4)); }
  const snowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uCenter: { value: V() }, uWind: { value: new THREE.Vector2() }, uOpacity: { value: 0 }, uCount: { value: 1 }, uPx: { value: 1 } },
    vertexShader: `attribute vec4 aFlake; uniform float uTime, uCount, uPx; uniform vec3 uCenter; uniform vec2 uWind; varying float vA;
      void main(){
        float size = 150.0, H = 70.0;
        float y = mod(aFlake.z * H - uTime * aFlake.w, H);
        vec3 p = vec3(uCenter.x + mod(aFlake.x * size - uCenter.x, size) - size * 0.5, y, uCenter.z + mod(aFlake.y * size - uCenter.z, size) - size * 0.5);
        p.x += sin(uTime * 0.9 + aFlake.y * 40.0) * 0.8 + uWind.x * (H - y) / aFlake.w * 0.4; p.z += cos(uTime * 0.7 + aFlake.x * 40.0) * 0.8 + uWind.y * (H - y) / aFlake.w * 0.4;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = uPx * (0.22 + aFlake.w * 0.07) * 420.0 / -mv.z;
        vA = step(aFlake.x, uCount) * (1.0 - step(-14.3, p.x) * step(p.x, 14.3) * step(-25.8, p.z) * step(p.z, -10.2) * step(p.y, 20.5));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform float uOpacity; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.15, d) * vA * uOpacity); }',
  });
  const snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; scene.add(snow);
  const boltMat = new THREE.LineBasicMaterial({ color: new THREE.Color(5, 5, 6), transparent: true, opacity: 0 });
  const bolt = new THREE.Line(new THREE.BufferGeometry(), boltMat); bolt.frustumCulled = false; scene.add(bolt);
  let flash = 0, nextBolt = 4;
  function strike() {
    const pts = [], x0 = R(-160, 160), z0 = R(-300, -60); let x = x0, z = z0;
    for (let y = 120; y > 0; y -= R(4, 9)) { pts.push(V(x, y, z)); x += R(-5, 5); z += R(-3, 3); }
    pts.push(V(x, 0, z)); bolt.geometry.dispose(); bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    flash = 1;
  }

  /* ---------------- agents */
  const agents = {};
  ORDER.forEach((k, i) => {
    const r = ROLE[k], p = makePerson(r.color, { hat: r.hat, tool: r.tool, skin: ['#e0b48f', '#c99671', '#d9a77f', '#b98560', '#eac3a0', '#c48b65', '#dcae86', '#a8764f'][i], hair: ['#1b130d', '#2b1d12', '#3b2a1c', '#0f0f0f'][i % 4] });
    p.g.position.copy(desks[k].spot); p.g.rotation.y = desks[k].ry; scene.add(p.g);
    p.g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; p.g.add(halo);
    p.g.traverse((o) => { if (o.isMesh) o.userData.agent = k; });
    agents[k] = { key: k, i, p, desk: desks[k], path: [], face: 0, task: { kind: 'idle' }, action: 'idle', moving: 0, halo, bubble: '', patrol: 0, wait: 0, visit: 0, lastPlane: 0 };
  });
  const scanRings = [...Array(4)].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 48), new THREE.MeshBasicMaterial({ color: ROLE.scout.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.06; scene.add(m); return { m, t: 1 }; });
  let ringIdx = 0;
  const planes = [];
  const planeGeo = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0.5), V(-0.35, 0, -0.4), V(0, 0.06, -0.25), V(0, 0, 0.5), V(0.35, 0, -0.4), V(0, 0.06, -0.25)]);
  planeGeo.computeVertexNormals();
  const planeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bdf4ff', emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const sparks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: new THREE.Color(4, 2.2, 0.8), size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const SP = 140, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP);
  sparks.geometry.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); sparks.frustumCulled = false; scene.add(sparks);
  let spI = 0;
  const emitSpark = (x, y, z) => { const i = spI++ % SP; spPos.set([x, y, z], i * 3); spVel.set([R(-2, 2), R(1, 4), R(-1, 2)], i * 3); spLife[i] = R(0.5, 1); };

  /* ---------------- HUD (HTML over the canvas) */
  const hud = document.createElement('div'); hud.className = 'mp-ui'; stage.appendChild(hud);
  const TIMES = [['live', 'Live'], ['dawn', 'Dawn'], ['day', 'Day'], ['noon', 'Noon'], ['sunset', 'Sunset'], ['night', 'Night'], ['lapse', 'Time-lapse']];
  const WXS = [['live', 'Live'], ['clear', 'Clear'], ['clouds', 'Clouds'], ['rain', 'Rain'], ['storm', 'Storm'], ['snow', 'Snow'], ['fog', 'Fog']];
  const QS = [['auto', 'Auto'], ['lite', 'Light'], ['fast', 'Fast'], ['high', 'High'], ['ultra', '4K']];
  const TEAMS = [['live', 'Live'], ['demo', 'Rehearsal']];
  const seg = (g, list, cur) => `<div class="mp-seg" data-g="${g}">${list.map(([k, l]) => `<button data-v="${k}" class="${cur === k ? 'on' : ''}">${esc(t(l))}</button>`).join('')}</div>`;
  hud.innerHTML = `
    <div class="mp-labels"></div>
    <div class="mp-clock"><div class="mp-place">${esc(t('Sulaimani'))} · ${esc(t('Pozaka Street'))}</div><div class="mp-time">--:--</div><div class="mp-phase"></div><div class="mp-wx"></div><div class="mp-city"></div><div class="mp-src"></div></div>
    <button class="mp-toggle" aria-expanded="false">☰ <span>${esc(t('Menu'))}</span></button>
    <div class="mp-view"><button class="mp-go-in" data-act="inside">🏢 ${esc(t('Inside Jump HQ'))}</button><button class="mp-go-out" data-act="street">← ${esc(t('Back to the street'))}</button></div>
    <div class="mp-ctl">
      <div class="mp-row"><span>${esc(t('Time'))}</span>${seg('time', TIMES, prefs.time)}</div>
      <div class="mp-row"><span>${esc(t('Weather'))}</span>${seg('wx', WXS, prefs.wx)}</div>
      <div class="mp-row"><span>${esc(t('Team'))}</span>${seg('team', TEAMS, prefs.team)}</div>
      <div class="mp-row"><span>${esc(t('Quality'))}</span>${seg('q', QS, prefs.q)}<span class="mp-tier"></span><button class="mp-btn ${prefs.rotate ? 'on' : ''}" data-act="rotate">⟳ ${esc(t('Auto-rotate'))}</button><button class="mp-btn" data-act="reset">${esc(t('Reset view'))}</button><button class="mp-btn" data-act="full">⛶ ${esc(t('Full screen'))}</button></div>
    </div>
    <div class="mp-team"></div>
    <div class="mp-card" hidden></div>
    <div class="mp-sleep" hidden>🌙 ${esc(t('Sleep mode: the team works alone'))}</div>`;
  const $h = (s) => hud.querySelector(s);
  const labelsEl = $h('.mp-labels');
  $h('.mp-toggle').onclick = (e) => { const o = hud.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); };
  hud.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const g = b.closest('.mp-seg')?.dataset.g;
    if (g) { prefs[g] = b.dataset.v; savePrefs(); b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); if (g === 'time' && b.dataset.v === 'lapse') lapseStart = performance.now(); if (g === 'team') { demoStart = performance.now(); sync(); } if (g === 'q') applyQuality(); return; }
    const a = b.dataset.act;
    if (a === 'rotate') { prefs.rotate = !prefs.rotate; controls.autoRotate = prefs.rotate; b.classList.toggle('on', prefs.rotate); savePrefs(); }
    if (a === 'reset' || a === 'street') goStreet();
    if (a === 'inside') goInside();
    if (a === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen?.(); }
    if (b.dataset.agent) { sel = { type: 'agent', key: b.dataset.agent, follow: true }; goInside(b.dataset.agent); showCard(); }
    if (b.dataset.close !== undefined) { sel = null; showCard(); }
  });

  const labels = new Map();
  function label(id, cls) {
    let el = labels.get(id);
    if (!el) { el = document.createElement('div'); el.className = `mp-l ${cls}`; labelsEl.appendChild(el); labels.set(id, el); el.dataset.html = ''; }
    return el;
  }
  const setHTML = (el, html) => { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };

  /* ---------------- quality, resize */
  function applyQuality() {
    if (prefs.q !== 'auto') tier = prefs.q;
    const w = stage.clientWidth || 800, dpr = window.devicePixelRatio || 1;
    const pr = tier === 'lite' ? Math.min(dpr, 1) * 0.7 : tier === 'fast' ? Math.min(dpr, 1) : tier === 'ultra' ? clamp(Math.max(dpr, 3840 / w), 1, 3) : Math.min(dpr, 2);
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
    const sm = tier === 'fast' ? 1024 : tier === 'ultra' ? 4096 : 2048;
    key.castShadow = tier !== 'lite';
    if (key.shadow.mapSize.x !== sm) { key.shadow.mapSize.set(sm, sm); key.shadow.map?.dispose(); key.shadow.map = null; }
    bloom.enabled = tier === 'high' || tier === 'ultra';
    mountains[1].mesh.visible = tier !== 'lite';
    camera.far = tier === 'lite' ? 2200 : 4000; camera.updateProjectionMatrix();
    renderer.antialias = tier !== 'lite';
    snowMat.uniforms.uPx.value = pr;
    resize();
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);
  applyQuality();

  /* ---------------- camera fly-to, picking */
  let fly = null, sel = null;
  function flyTo(target, pos) { fly = { t0: performance.now(), from: controls.target.clone(), to: target.clone(), pFrom: camera.position.clone(), pTo: pos || target.clone().add(camera.position.clone().sub(controls.target).setLength(34)) }; }
  controls.addEventListener('start', () => { fly = null; if (sel) sel.follow = false; });
  let view = 'street';
  const STREET = { t: V(0, 3, 6), p: V(38, 58, 112) }, ROOM = { t: V(-1.5, 1.2, -18.8), p: V(10.2, 4.0, -11.6) };
  const clampRoom = (v, pad = 0.3) => v.set(clamp(v.x, -13.2 + pad, 13.2 - pad), clamp(v.y, 0.6, 4.25), clamp(v.z, -24.8 + pad, -11.25));
  function setLimits() {
    const inn = view === 'inside';
    controls.minDistance = inn ? 1.2 : 12; controls.maxDistance = inn ? 11 : 650; controls.maxPolarAngle = inn ? 1.65 : 1.42;
    controls.autoRotate = !inn && !!prefs.rotate; hud.classList.toggle('in', inn);
  }
  function goInside(k) {
    view = 'inside'; setLimits();
    if (k) {
      const a = agents[k], p = a.p.g.position, ry = a.desk.ry;
      const f = V(Math.sin(ry), 0, Math.cos(ry)), side = V(Math.cos(ry), 0, -Math.sin(ry));
      flyTo(V(p.x + f.x * 0.5, 1.45, p.z + f.z * 0.5), clampRoom(V(p.x + f.x * 3.9 + side.x * 2.2, 2.75, p.z + f.z * 3.9 + side.z * 2.2)));
    } else flyTo(ROOM.t, ROOM.p);
  }
  function goStreet() { view = 'street'; setLimits(); sel = null; showCard(); flyTo(STREET.t, STREET.p); }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (view === 'inside') {
      const hit = ray.intersectObjects(Object.values(agents).map((a) => a.p.g), true)[0];
      if (hit?.object.userData.agent) { sel = { type: 'agent', key: hit.object.userData.agent, follow: true }; goInside(sel.key); showCard(); }
      return;
    }
    const hit = ray.intersectObjects([hqBody, lobby, ...shops.map((s) => s.g)], true)[0];
    if (hit && (hit.object === hqBody || hit.object === lobby)) goInside();
    else if (hit && hit.object.userData.shop !== undefined && shops[hit.object.userData.shop].lead) select({ type: 'shop', i: hit.object.userData.shop });
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(view === 'inside' ? Object.values(agents).map((a) => a.p.g) : [hqBody, lobby, ...shops.filter((x) => x.lead).map((x) => x.g)], true)[0];
    renderer.domElement.style.cursor = hit ? 'pointer' : '';
  });
  function select(s) {
    sel = { ...s, follow: true };
    flyTo(V(shops[s.i].x, 6, SHOP_Z + 4));
    showCard();
  }

  /* ---------------- live data from the app */
  let st = api.getState(), ago = 0;
  const statusText = (k) => {
    const pf = st.config?.profile;
    if (k === 'none' && pf?.configured) return (st.config.ui_language !== 'en' && pf.gap_label_local) || pf.gap_label || t('No website');
    return t(STATUS[k]?.label || '');
  };
  function eventLine(run) {
    api.ensureEvents(run.id);
    const ev = (st.events[run.id] || []).slice().reverse();
    for (const e of ev) { const txt = api.eventText(e); if (txt && e.kind !== 'result') return txt; }
    return run.title?.split(' · ').slice(1).join(' · ') || '';
  }
  function siteOf(l) { return st.sites.find((x) => x.lead_id === l.id || (l.demo?.slug && x.slug === l.demo.slug)); }
  function leadStatus(l) {
    const site = siteOf(l), msgs = st.approvals.filter((a) => a.lead_id === l.id && ['whatsapp', 'email'].includes(a.type));
    if (l.stage === 'won') return 'won';
    if (l.stage === 'replied') return 'replied';
    if (l.stage === 'sent' || msgs.some((a) => a.status === 'sent')) return 'sent';
    if (msgs.some((a) => ['pending', 'approved'].includes(a.status))) return 'message';
    if (site?.public_url) return 'online';
    if (site) return 'demo';
    return 'none';
  }
  const RANK = { won: 9, replied: 8, sent: 7, message: 6, online: 5, demo: 4 };
  const rankOf = (l) => RANK[leadStatus(l)] || ({ approved: 3, demo_built: 3, scored: 2, profiled: 2, new: 1, hold: 0.5 }[l.stage] ?? 0);
  function syncShops() {
    const mid = st.config?.market_id;
    let leads = st.leads.filter((l) => !mid || l.market_id === mid || !l.market_id);
    if (!leads.length) leads = st.leads;
    leads = leads.slice().sort((a, b) => rankOf(b) - rankOf(a) || (b.opportunity?.score || 0) - (a.opportunity?.score || 0)).slice(0, 8);
    const keep = new Set(leads.map((l) => l.id));
    for (const s of shops) if (s.lead && !keep.has(s.lead.id)) s.lead = null;
    for (const l of leads) {
      const s = shops.find((x) => x.lead?.id === l.id) || shops.find((x) => !x.lead);
      if (s) s.lead = l;
    }
    for (const s of shops) {
      const l = s.lead;
      const k = l ? `${l.id}|${l.business}|${l.business_local || ''}` : `f${s.i}`;
      if (s.signKey !== k) {
        s.signKey = k; s.signMat.map?.dispose();
        const bg = l ? ['#1f2937', '#7f1d1d', '#0f3d3e', '#3b2f2f', '#1e3a5f', '#4a2f1a'][hashStr(l.business) % 6] : '#2a2f38';
        s.signMat.map = signTexture(l ? (l.business_local || l.business) : FILLER_SIGNS[s.i], bg, l ? '#fde7c8' : '#e5e7eb'); s.signMat.emissiveMap = s.signMat.map; s.signMat.needsUpdate = true;
      }
      s.status = l ? leadStatus(l) : 'filler';
      const wantHolo = l && ['demo', 'online', 'message', 'sent', 'replied', 'won'].includes(s.status);
      if (s.holo && (!l || s.holo.key !== l.id)) { scene.remove(s.holo.grp); s.holo = null; }
      if (s.building) s.sawBuild = true;
      if (s.holo && !wantHolo && !s.building) { scene.remove(s.holo.grp); s.holo = null; s.sawBuild = false; }
      if ((wantHolo || s.building) && !s.holo) { s.holo = makeHolo(s); s.progress = wantHolo && !s.sawBuild ? 1 : 0.001; }
      if (s.holo) { const c = C(STATUS[s.status]?.color || '#ff6b2c'); s.holo.col.copy(c); s.holo.frameMat.color.copy(c).multiplyScalar(3); s.holo.glowMat.color.copy(c); s.holo.beamMat.color.copy(c); s.holo.scan.material.color.copy(c).multiplyScalar(4); }
    }
  }
  const slotOf = (leadId) => shops.find((s) => s.lead?.id === leadId);
  let demoStart = performance.now();
  function rehearsal() {
    const SECS = [8, 16, 14, 8, 8, 7, 20, 11, 13], total = SECS.reduce((x, y) => x + y, 0);
    let tt = ((performance.now() - demoStart) / 1000) % total, step = 0;
    while (tt > SECS[step]) { tt -= SECS[step]; step++; }
    const k = ORDER[step];
    const fresh = shops.filter((s) => s.lead && s.status === 'none'), done = shops.filter((s) => s.lead && s.status !== 'none');
    const pickS = (list, n) => list.slice(0, n).map((s) => s.lead.id);
    const ids = k === 'builder' ? pickS(fresh.length ? fresh : shops.filter((s) => s.lead), 1) : k === 'investigator' ? pickS(fresh.length ? fresh : shops.filter((s) => s.lead), 3) : pickS(done.length ? done : shops.filter((s) => s.lead), 1);
    const next = ORDER[(step + 1) % ORDER.length];
    return { running: [{ id: `demo-${k}`, agent: k, status: 'running', input: { lead_ids: ids }, title: '', demo: t(REHEARSE[k]) }], queued: [{ id: `demo-q-${next}`, agent: next, status: 'queued' }] };
  }
  function syncAgents() {
    const demo = prefs.team === 'demo' ? rehearsal() : null;
    const running = demo ? demo.running : st.runs.filter((r) => r.status === 'running'), queued = demo ? demo.queued : st.runs.filter((r) => r.status === 'queued');
    for (const s of shops) { s.building = false; s.checking = false; }
    for (const k of ORDER) {
      const a = agents[k], run = running.find((r) => r.agent === k), q = queued.filter((r) => r.agent === k).length;
      const ids = run ? [run.lead_id, run.input?.lead_id, ...(run.input?.lead_ids || [])].filter(Boolean) : [];
      const targets = ids.map(slotOf).filter(Boolean);
      let kind = 'idle';
      if (run) kind = k === 'scout' ? 'scout' : TABLE_ROLES.has(k) ? 'table' : k === 'builder' ? 'build' : k === 'writer' ? 'write' : 'visit';
      else if (q) kind = 'queued';
      if (kind === 'build' && targets[0]) targets[0].building = true;
      if (kind === 'visit' && k === 'investigator') targets.forEach((s) => (s.checking = true));
      const sig = `${kind}|${targets.map((s) => s.i).join(',')}`;
      if (a.task.sig !== sig) { a.task = { kind, targets, sig, run }; a.goalKey = ''; a.visit = 0; a.wait = 0; }
      a.task.run = run;
      a.bubble = run ? (run.demo || eventLine(run)) : q ? `${t('Waiting')} (${q})` : '';
    }
  }
  function demoCount() {
    const mid = st.config?.market_id;
    return st.sites.filter((x) => { const l = st.leads.find((y) => y.id === x.lead_id); return l && (!mid || l.market_id === mid); }).length;
  }
  // each desk screen shows what its agent is doing right now
  function drawScreen(a, names) {
    const busy = !['idle', 'queued'].includes(a.task.kind), key = `${a.task.kind}|${a.bubble}|${names[a.key]}`;
    if (a.desk.scrKey === key) return;
    a.desk.scrKey = key;
    const [, g] = a.desk.scr, col = ROLE[a.key].color;
    g.fillStyle = '#0b1220'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = col; g.fillRect(0, 0, 512, 48);
    g.fillStyle = '#0b1220'; g.font = '800 26px "Plus Jakarta Sans", "Noto Sans Arabic", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.direction = 'ltr';
    g.fillText(`${ROLE[a.key].icon} ${names[a.key] || a.key}`, 16, 25);
    const stx = busy ? t('Working') : a.task.kind === 'queued' ? t('Waiting') : t('Ready');
    g.font = '700 20px "Plus Jakarta Sans", "Noto Sans Arabic", sans-serif';
    const sw = g.measureText(stx).width + 24;
    g.fillStyle = '#0b1220'; roundRect(g, 496 - sw, 11, sw, 28, 14); g.fill(); g.fillStyle = busy ? '#4ade80' : '#cbd5e1'; g.fillText(stx, 508 - sw, 25);
    const text = a.bubble || (busy ? '' : t('Ready')), rtl = /[؀-ۿ]/.test(text);
    g.fillStyle = '#f1f5f9'; g.font = '600 27px "Plus Jakarta Sans", "Noto Sans Arabic", sans-serif'; g.direction = rtl ? 'rtl' : 'ltr'; g.textAlign = rtl ? 'right' : 'left';
    let line = '', y = 92;
    for (const w of text.split(/\s+/)) {
      const tt = line ? `${line} ${w}` : w;
      if (g.measureText(tt).width > 470 && line) { g.fillText(line, rtl ? 496 : 16, y); line = w; y += 36; if (y > 170) { line += '…'; break; } } else line = tt;
    }
    if (line) g.fillText(line, rtl ? 496 : 16, y);
    g.direction = 'ltr'; g.textAlign = 'left';
    if (busy) for (let i = 0; i < 5; i++) { g.fillStyle = `${col}${['cc', '99', '77', '55', '33'][i]}`; g.fillRect(16, 206 + i * 14, 80 + (hashStr(a.bubble + i) % 340), 7); }
    a.desk.scrTex.needsUpdate = true;
  }
  function sync() {
    st = api.getState(); syncShops(); syncAgents(); updateTeamBar();
    const demos = demoCount();
    cityLevel = clamp(1 + Math.floor(demos / DEMOS_PER_LEVEL), 1, LEVEL_R.length);
    const names = Object.fromEntries((st.agents || []).map((x) => [x.key, x.name]));
    for (const k of ORDER) drawScreen(agents[k], names);
    const left = cityLevel < LEVEL_R.length ? DEMOS_PER_LEVEL * cityLevel - demos : 0;
    setHTML($h('.mp-city'), `🏙️ ${esc(t('City level'))} ${cityLevel}/${LEVEL_R.length} · ${left ? `${left} ${esc(t('more demos grow the city'))}` : esc(t('The city is full size'))}`);
    if (sel) showCard();
    hud.querySelector('.mp-sleep').hidden = st.mode !== 'sleep';
  }


  function updateTeamBar() {
    const names = Object.fromEntries((st.agents || []).map((a) => [a.key, a.name]));
    const html = ORDER.map((k) => {
      const a = agents[k], kind = a.task.kind, on = kind !== 'idle' && kind !== 'queued';
      return `<button class="mp-chip ${on ? 'on' : kind === 'queued' ? 'wait' : ''}" data-agent="${k}" style="--c:${ROLE[k].color}"><i>${ROLE[k].icon}</i><b>${esc(names[k] || k)}</b><em>${esc(on ? t('Working') : kind === 'queued' ? t('Waiting') : t('Ready'))}</em></button>`;
    }).join('');
    setHTML($h('.mp-team'), html);
  }
  function showCard() {
    const el = $h('.mp-card');
    if (!sel) { el.hidden = true; return; }
    el.hidden = false;
    let html = '';
    if (sel.type === 'agent') {
      const a = agents[sel.key], info = (st.agents || []).find((x) => x.key === sel.key) || {}, on = !['idle', 'queued'].includes(a.task.kind);
      html = `<div class="mp-ch"><i style="background:${ROLE[sel.key].color}">${ROLE[sel.key].icon}</i><div><b>${esc(info.name || sel.key)}</b><em>${esc(on ? t('Working') : a.task.kind === 'queued' ? t('Waiting') : t('Ready'))}</em></div><button data-close aria-label="${esc(t('Close'))}">✕</button></div>
        ${a.bubble ? `<p class="mp-now" dir="auto">${esc(a.bubble)}</p>` : ''}<p class="mp-blurb" dir="auto">${esc(info.blurb || '')}</p>`;
    } else {
      const s = shops[sel.i], l = s.lead; if (!l) { sel = null; el.hidden = true; return; }
      const site = siteOf(l);
      html = `<div class="mp-ch"><i style="background:${STATUS[s.status]?.color || '#64748b'}">🏪</i><div><b dir="auto">${esc(l.business)}</b>${l.business_local ? `<em dir="rtl">${esc(l.business_local)}</em>` : ''}</div><button data-close aria-label="${esc(t('Close'))}">✕</button></div>
        <p class="mp-now"><span class="mp-pill ${STATUS[s.status]?.cls || ''}">${esc(statusText(s.status))}</span> ${esc(l.city || '')}</p>
        <div class="mp-links">${site ? `<a href="${esc(site.public_url || `/d/${site.slug}/`)}" target="_blank" rel="noopener">${esc(t('Open the demo'))} ↗</a>` : ''}${l.socials?.instagram ? `<a href="${esc(l.socials.instagram)}" target="_blank" rel="noopener">Instagram ↗</a>` : ''}</div>`;
    }
    setHTML(el, html);
  }

  /* ---------------- agent movement (inside the office) */
  function route(a, to) {
    const from = a.p.g.position, d = a.desk, pts = [];
    if (from.distanceTo(d.spot) < 0.4) pts.push(d.side.clone(), d.front.clone());
    const toDesk = to.distanceTo(d.spot) < 0.05;
    const end = toDesk ? d.front : to;
    const last = pts.length ? pts[pts.length - 1] : from.clone();
    const cp = V(); new THREE.Line3(last.clone(), end.clone()).closestPointToPoint(ITABLE, true, cp);
    if (cp.distanceTo(ITABLE) < 2.6 && end.distanceTo(ITABLE) > 3) pts.push(V(ITABLE.x + (last.x + end.x >= 0 ? 3.3 : -3.3), 0, ITABLE.z + ((last.z + end.z) / 2 > ITABLE.z ? 1.5 : -1.5)));
    pts.push(end.clone());
    if (toDesk) pts.push(d.side.clone(), d.spot.clone());
    return pts;
  }
  function goal(a, pos, face, action, key) {
    if (a.goalKey === key) return;
    a.goalKey = key; a.goalFace = face; a.goalAction = action;
    a.path = a.p.g.position.distanceTo(pos) < 0.3 ? [] : route(a, pos);
  }
  function think(a, dt, T, night) {
    const k = a.task.kind, d = a.desk;
    if (k === 'table') {
      const ang = { opportunity: Math.PI, strategist: -Math.PI / 2, reviewer: 0 }[a.key] ?? 0, p = V(ITABLE.x + Math.cos(ang) * 2.4, 0, ITABLE.z + Math.sin(ang) * 2.4);
      goal(a, p, Math.atan2(ITABLE.x - p.x, ITABLE.z - p.z), 'gesture', 'table');
      return;
    }
    if (k === 'idle' && night < 0.6) { // free time: now and then a coffee, the window or the sofa
      if (!a.goalKey) { goal(a, d.spot, d.ry, 'idle', 'desk-idle'); a.wait = R(6, 30); }
      if (a.path.length) return;
      a.wait -= dt;
      if (a.wait > 0) return;
      if (a.goalKey.startsWith('break')) { goal(a, d.spot, d.ry, 'idle', 'desk-idle'); a.wait = R(25, 45); }
      else { const b = BREAKS[(a.i + Math.floor(T / 40)) % BREAKS.length], p = b.p.clone(); p.x += ((a.i % 3) - 1) * 0.9; goal(a, p, b.ry, 'idle', `break-${b.n}-${a.i}`); a.wait = R(8, 14); }
      return;
    }
    const act = k === 'idle' ? 'sleep' : k === 'queued' ? 'wait' : { investigator: 'inspect', closer: 'talk' }[a.key] || 'type';
    goal(a, d.spot, d.ry, act, `desk-${act}`);
  }
  function moveAgent(a, dt) {
    const p = a.p.g.position;
    if (a.path.length) {
      const tg = a.path[0], dx = tg.x - p.x, dz = tg.z - p.z, dd = Math.hypot(dx, dz), sp = 2.6;
      if (dd < 0.08) a.path.shift();
      else { const kk = Math.min(1, (sp * dt) / dd); p.x += dx * kk; p.z += dz * kk; a.p.g.rotation.y = turnTo(a.p.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10)); }
      a.moving = a.path.length ? sp : 0;
    } else { a.moving = 0; a.p.g.rotation.y = turnTo(a.p.g.rotation.y, a.goalFace ?? 0, Math.min(1, dt * 5)); }
  }
  // drones fly out from the roof to the shops while their agent works at the desk
  function droneTask(k) {
    const a = agents[k];
    if (['idle', 'queued'].includes(a.task.kind)) return null;
    if (k === 'scout') return (i) => V(clamp(Math.sin(i * 2.3) * (cityR - 14), -150, 150), 9, 27 + Math.cos(i * 1.7) * 3);
    const tg = (a.task.targets || []).length ? a.task.targets : shops.filter((x) => x.lead);
    if (!tg.length) return null;
    return (i) => { const s2 = tg[i % tg.length]; return V(s2.x, k === 'closer' ? 7 : 8.5, SHOP_Z + 8.5); };
  }
  function flyDrone(d, dt, T, night) {
    const task = droneTask(d.k), p = d.g.position;
    if (!task) d.spot = null;
    else if (!d.spot) { d.idx++; d.spot = task(d.idx); d.hover = d.k === 'scout' ? 4 : 7; d.scanned = false; }
    const tgt = d.spot || d.home, dx = tgt.x - p.x, dz = tgt.z - p.z, horiz = Math.hypot(dx, dz), cruise = 21;
    p.y += clamp((horiz > 1.5 ? Math.max(cruise, tgt.y) : tgt.y) - p.y, -5 * dt, 6 * dt);
    const travel = horiz > 0.05 && (p.y > cruise - 1.5 || horiz < 1.5);
    if (travel) { const sp = Math.min(horiz, 13 * dt); p.x += (dx / horiz) * sp; p.z += (dz / horiz) * sp; }
    const there = d.spot && horiz < 0.4 && Math.abs(p.y - tgt.y) < 0.4;
    if (there) { d.hover -= dt; p.y += Math.sin(T * 3 + d.idx) * 0.006; if (d.hover <= 0) d.spot = null; } // next spot on the next frame
    d.g.rotation.x = lerp(d.g.rotation.x, travel && horiz > 1 ? (dz / horiz) * 0.22 : 0, Math.min(1, dt * 4));
    d.g.rotation.z = lerp(d.g.rotation.z, travel && horiz > 1 ? -(dx / horiz) * 0.22 : 0, Math.min(1, dt * 4));
    const flying = p.distanceTo(d.home) > 0.2;
    d.rotors.forEach((r) => (r.rotation.y += (flying || task ? 45 : 0) * dt));
    d.beamM.opacity = lerp(d.beamM.opacity, there && d.k !== 'closer' ? 0.1 + night * 0.12 : 0, Math.min(1, dt * 4));
    d.ledM.emissiveIntensity = flying ? (Math.sin(T * 8) > 0 ? 4 : 0.6) : 1;
    if (there && d.k === 'scout' && !d.scanned) { d.scanned = true; for (let j = 0; j < 2; j++) { const r = scanRings[ringIdx++ % scanRings.length]; r.t = -j * 0.35; r.m.position.set(p.x, 0.07, p.z); } }
  }

  /* ---------------- time + weather state */
  let lapseStart = performance.now(), live = { w: { ...WX.clear }, label: 'Clear sky', temp: null, ok: false, at: 0 }, W = { ...WX.clear }, wet = 0, snowCover = 0, marks = dayMarks(Date.now()), marksDay = -1;
  async function loadWeather() {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=Asia%2FBaghdad`);
      const d = (await r.json()).current;
      const { w, label: lb } = fromWmo(d.weather_code, d.cloud_cover, d.wind_speed_10m);
      live = { w, label: lb, temp: Math.round(d.temperature_2m), dir: d.wind_direction_10m, ok: true, at: Date.now() };
    } catch { live.ok = false; }
  }
  loadWeather(); const wxTimer = setInterval(loadWeather, 10 * 60e3);
  function simNow() {
    const now = Date.now();
    const pt = prefs.time;
    if (pt === 'live') return now;
    if (pt === 'lapse') return atLocal(now, 0) + (((performance.now() - lapseStart) / 1000) * (24 / 90) + localParts(now).h) % 24 * 36e5;
    return atLocal(now, { dawn: marks.dawn + 0.55, day: marks.noon - 2.6, noon: marks.noon, sunset: marks.dusk + 0.05, night: 22.5 }[pt] ?? 12);
  }

  const tmpC = C('#fff'), tmpH = C('#fff'), sunCol = C('#fff'), sunD = V(), moonD = V(), greyT = C('#7b858f'), greyH = C('#a3acb5'), labelV = V();
  const fps = { n: 0, t: -2, last: 0, down: 0 };
  let T = 0, last = performance.now(), raf = 0, syncT = 0, ledT = 0, frameN = 0, clockAt = 0;
  sync();

  function drawLed() {
    const [c, g] = ledCanvas, running = st.runs.filter((r) => r.status === 'running');
    g.fillStyle = '#05080f'; g.fillRect(0, 0, 1024, 384);
    for (let y = 0; y < 384; y += 4) { g.fillStyle = 'rgba(255,255,255,.02)'; g.fillRect(0, y, 1024, 1); }
    g.fillStyle = '#ff6b2c'; g.font = '800 46px "Plus Jakarta Sans", sans-serif'; g.textBaseline = 'top'; g.fillText('JUMP HQ', 36, 28);
    g.fillStyle = '#ef4444'; g.beginPath(); g.arc(300, 54, 10, 0, 7); g.fill(); g.fillStyle = '#fca5a5'; g.font = '700 30px "Plus Jakarta Sans", sans-serif'; g.fillText('LIVE', 320, 38);
    const mid = st.config?.market_id, leads = st.leads.filter((l) => !mid || l.market_id === mid);
    const stats = [[leads.length, t('Businesses')], [st.sites.filter((s) => leads.some((l) => l.id === s.lead_id)).length, t('Demos')], [st.approvals.filter((a) => leads.some((l) => l.id === a.lead_id) && ['whatsapp', 'email'].includes(a.type)).length, t('Messages')]];
    stats.forEach(([n, l], i) => { g.fillStyle = '#ffffff'; g.font = '800 92px "Plus Jakarta Sans", sans-serif'; g.fillText(String(n), 36 + i * 330, 104); g.fillStyle = '#94a3b8'; g.font = '600 30px "Plus Jakarta Sans", "Noto Sans Arabic", sans-serif'; g.fillText(l, 36 + i * 330, 206); });
    const names = Object.fromEntries((st.agents || []).map((a) => [a.key, a.name]));
    const line = running.length ? `${names[running[0].agent] || running[0].agent}: ${running[0].title.split(' · ').slice(1).join(' · ')}` : t('Team ready');
    g.fillStyle = '#fde7c8'; g.font = '600 34px "Plus Jakarta Sans", "Noto Sans Arabic", sans-serif'; g.fillText(line.slice(0, 48), 36, 300);
    ledTex.needsUpdate = true;
  }
  drawLed();

  function frame(now) {
    if (!stage.isConnected) { dispose(); return; }
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const rawDt = (now - last) / 1000, dt = Math.min(0.05, rawDt); last = now; T += dt; frameN++;
    fps.n++; fps.t += rawDt;
    if (fps.t > 4) { // every 4 seconds: too slow? go lighter. Plenty of room? go back up once.
      const f = fps.n / fps.t; fps.n = 0; fps.t = 0; fps.last = Math.round(f);
      if (prefs.q === 'auto' && f < 26 && tier !== 'lite') { tier = { ultra: 'high', high: 'fast', fast: 'lite' }[tier]; fps.down++; applyQuality(); }
      else if (prefs.q === 'auto' && f > 57 && tier === 'fast' && !weak && !fps.down) { tier = 'high'; applyQuality(); }
      setHTML($h('.mp-tier'), prefs.q === 'auto' ? `${t('Now')}: ${t({ lite: 'Light', fast: 'Fast', high: 'High', ultra: '4K' }[tier])} · ${fps.last} fps` : `${fps.last} fps`);
    }
    syncT -= dt; if (syncT <= 0) { syncT = 0.6; sync(); }
    ledT -= dt; if (ledT <= 0) { ledT = 2; drawLed(); }

    // ---- time of day
    const ms = simNow(), lp = localParts(ms);
    if (lp.d !== marksDay) { marks = dayMarks(ms); marksDay = lp.d; }
    const sun = sunAt(ms), mo = moonAt(ms), e = sun.alt / RAD;
    dirOf(sun, sunD); dirOf(mo, moonD);
    // ---- weather
    const target = prefs.wx === 'live' ? live.w : WX[prefs.wx];
    const kk = 1 - Math.exp(-dt * 1.6);
    for (const k of Object.keys(W)) W[k] = lerp(W[k], target[k] ?? 0, kk);
    wet = clamp(wet + (W.rain > 0.08 ? dt * 0.25 * W.rain : -dt * 0.02), 0, 1);
    snowCover = clamp(snowCover + (W.snow > 0.08 ? dt * 0.12 * W.snow : -dt * 0.015), 0, 1);
    const oc = clamp(W.clouds * 0.7 + W.rain * 0.45 + W.snow * 0.35 + W.fog * 0.5 + W.storm * 0.35, 0, 1);
    const day = smooth(-4, 12, e), night = 1 - smooth(-10, 2, e);
    // sky
    ramp(SKY, e, 1, tmpC); ramp(SKY, e, 2, tmpH);
    const bright = 0.06 + 0.94 * smooth(-10, 14, e);
    tmpC.lerp(greyT.clone().multiplyScalar(bright), oc * 0.85); tmpH.lerp(greyH.clone().multiplyScalar(bright), oc * 0.8);
    ramp(SUNCOL, e, 1, sunCol);
    flash = Math.max(0, flash - dt * 3.5);
    if (W.storm > 0.5) { nextBolt -= dt; if (nextBolt <= 0) { strike(); nextBolt = R(3, 11); } }
    const fl = flash > 0 ? flash * (0.6 + 0.4 * Math.sin(T * 60)) : 0;
    const su = sky.material.uniforms;
    su.uTop.value.copy(tmpC); su.uHor.value.copy(tmpH); su.uSunDir.value.copy(sunD); su.uSunCol.value.copy(sunCol);
    su.uStars.value = (1 - smooth(-16, -5, e)) * (1 - oc * 0.95); su.uSunVis.value = 1 - oc * 0.9; su.uFlash.value = fl * 0.6; su.uTime.value = T;
    sky.position.copy(camera.position);
    moon.position.copy(camera.position).addScaledVector(moonD, 1500); moon.visible = mo.alt > -0.05;
    moon.material.uniforms.uSunDir.value.copy(sunD); moon.material.uniforms.uVis.value = 1 - oc * 0.85;
    // light
    if (e > -3) { key.position.copy(key.target.position).addScaledVector(sunD, 300); key.color.copy(sunCol); key.intensity = 3.3 * smooth(-1, 14, e) * (1 - 0.78 * oc); }
    else if (mo.alt > 0) { key.position.copy(key.target.position).addScaledVector(moonD, 300); key.color.set('#a9bde0'); key.intensity = 0.42 * smooth(0, 0.2, mo.alt) * (1 - 0.85 * oc); }
    else key.intensity = 0;
    hemi.color.copy(tmpC).lerp(C('#ffffff'), 0.35); hemi.intensity = 0.16 + 1.05 * smooth(-9, 10, e) * (1 + 0.25 * oc) + fl * 4;
    scene.fog.color.copy(tmpH).lerp(tmpC, 0.35).multiplyScalar(0.92); scene.fog.density = (0.0012 + W.fog * 0.012 + W.rain * 0.0035 + W.snow * 0.004) * clamp(220 / Math.max(1, camera.position.distanceTo(controls.target)), 0.3, 1);
    renderer.toneMappingExposure = lerp(1.0, 1.5, night);
    bloom.strength = lerp(0.16, 0.42, night) + fl * 0.4; bloom.threshold = lerp(0.95, 0.86, night); bloom.radius = 0.4;
    // city lights
    const lightsOn = Math.max(night, oc * 0.25 * day);
    for (const k of ['fac0', 'fac1', 'fac2']) facMat[k].emissiveIntensity = lightsOn * 1.05;
    facMat.hq.emissiveIntensity = 0.08 + lightsOn * 0.55;
    headMat.emissiveIntensity = night * 3.2; lampLights.forEach((l) => (l.intensity = night * 30));
    stripMat.emissiveIntensity = 1 + night * 1.6; hq.userData.sign.emissiveIntensity = 0.45 + night * 0.75; lobby.material.emissiveIntensity = 0.1 + night * 0.7;
    beacon.material.emissiveIntensity = (Math.sin(T * 3) > 0.6 ? 6 : 0.4) * (0.4 + night);
    led.material.color.setScalar(0.9 - night * 0.15);
    for (const s of shops) { s.glassMat.emissiveIntensity = 0.1 + lightsOn * 0.55; s.signMat.emissiveIntensity = 0.05 + night * 0.55; }
    const inn = view === 'inside';
    roomLights.forEach((l) => (l.intensity = inn ? 16 : 0)); ceilLightM.emissiveIntensity = 1.1 + night * 0.4;
    flagSpot.intensity = night * 70;
    // ground wetness and snow
    groundMat.roughness = lerp(0.95, 0.4, wet); groundMat.color.setScalar(lerp(1, 0.72, wet)); cityMat.roughness = groundMat.roughness; cityMat.color.copy(groundMat.color);
    puddles.material.opacity = wet * 0.75; puddles.visible = wet > 0.01;
    snowLayer.material.opacity = snowCover * 0.95; snowLayer.visible = snowCover > 0.01;
    mats.snow.opacity = snowCover; growCity(dt, snowCover); cityRT = cityR;
    if (frameN % 30 === 0) paintMountains(Math.min(seasonLine, lerp(seasonLine, 0.18, snowCover)));
    // clouds
    const wind = W.wind, windAng = ((live.dir ?? 270) + 180) * RAD, wx = Math.sin(windAng) * wind, wz = -Math.cos(windAng) * wind;
    cloudMat.color.set('#ffffff').lerp(C('#5f6670'), clamp(W.rain * 0.6 + W.storm * 0.4, 0, 1)); cloudMat.opacity = 0.9 + W.fog * 0.08;
    let ci = 0;
    for (const c of cloudData) {
      c.on = lerp(c.on, c.order < W.clouds * 1.02 ? 1 : 0, dt * 0.4);
      c.x += (wx * 0.9 + 1.2) * dt; c.z += wz * 0.9 * dt; if (c.x > 520) c.x = -520; if (c.x < -520) c.x = 520; if (c.z > 200) c.z = -440; if (c.z < -440) c.z = 200;
      const thick = 1 + W.rain * 0.4 + W.storm * 0.4;
      for (const pf of c.puffs) { const s = pf.s * c.s * c.on; clouds.setMatrixAt(ci++, mtx.compose(V(c.x + pf.x * c.s, c.y + pf.y - (1 - c.on) * 6, c.z + pf.z * c.s), q.identity(), V(s, s * 0.52 * thick, s * 0.8))); }
    }
    clouds.instanceMatrix.needsUpdate = true;
    // rain + snow
    rainMat.uniforms.uTime.value = T; rainMat.uniforms.uCenter.value.copy(controls.target); rainMat.uniforms.uWind.value.set(wx, wz); rainMat.uniforms.uOpacity.value = clamp(W.rain * 1.4, 0, 0.8); rainMat.uniforms.uCount.value = clamp(W.rain * 1.1, 0, 1) * (tier === 'lite' ? 0.25 : tier === 'fast' ? 0.45 : 1);
    rain.visible = W.rain > 0.02;
    rainMat.uniforms.uColor.value.set(night > 0.5 ? '#9fb0c6' : '#dbe5f1');
    snowMat.uniforms.uTime.value = T; snowMat.uniforms.uCenter.value.copy(controls.target); snowMat.uniforms.uWind.value.set(wx, wz); snowMat.uniforms.uOpacity.value = clamp(W.snow * 1.3, 0, 0.95); snowMat.uniforms.uCount.value = clamp(W.snow * 1.1, 0, 1);
    snow.visible = W.snow > 0.02;
    boltMat.opacity = flash > 0.35 ? 1 : 0;
    if (tier !== 'lite' || frameN % 4 === 0) swayTrees(T, wind);
    // flag
    { const p = flagGeo.attributes.position, amp = 0.35 + Math.min(wind, 14) * 0.05;
      for (let i = 0; i < p.count; i++) { const x = flagBase[i * 3], y = flagBase[i * 3 + 1], k2 = (x + FW / 2) / FW; p.setZ(i, (Math.sin(x * 0.75 - T * (3 + wind * 0.25) + y * 0.18) + 0.35 * Math.sin(x * 1.9 - T * 5.1)) * amp * k2); }
      p.needsUpdate = true; if (frameN % 2 === 0) flagGeo.computeVertexNormals(); }
    // fountain
    jets.forEach((j, i) => { const h = (i ? 1.4 : 3.2) * (0.9 + Math.sin(T * 6 + i) * 0.08); j.scale.y = h; j.position.y = 0.6 + h / 2; });
    // ---- holo-table
    const atTable = ORDER.filter((k) => agents[k].task.kind === 'table');
    const holoOn = atTable.length ? 1 : 0;
    holoMat.color.set(atTable.length ? ROLE[atTable[0]].color : '#5eead4'); globe.material.color.copy(holoMat.color);
    holoMat.opacity = lerp(holoMat.opacity, holoOn ? 0.75 : 0.22, dt * 3); globe.material.opacity = holoMat.opacity * 0.5;
    holoSpin.rotation.y += dt * (holoOn ? 1.2 : 0.25);
    bars.forEach((b, i) => { const h = holoOn ? 0.6 + Math.abs(Math.sin(T * 1.7 + i * 1.3)) * 1.8 : 0.3; b.scale.y = lerp(b.scale.y, h, dt * 4); b.position.y = b.scale.y / 2; });
    // ---- agents
    for (const k of ORDER) {
      const a = agents[k];
      think(a, dt, T, night); moveAgent(a, dt);
      const act = a.moving ? 'walk' : a.goalAction || 'idle';
      animatePerson(a.p, dt, T, { moving: a.moving, action: act, rain: 0 });
      const busy = !['idle', 'queued'].includes(a.task.kind);
      a.halo.material.opacity = busy ? 0.45 + Math.sin(T * 4) * 0.25 : 0;
      a.desk.pad.material.opacity = busy ? 0.45 + Math.sin(T * 4) * 0.2 : 0.18;
      if (a.task.kind === 'write' && T - a.lastPlane > 3.2) { a.lastPlane = T; const s = (a.task.targets || [])[0] || shops.find((x) => x.lead) || shops[0]; const m = new THREE.Mesh(planeGeo, planeMat); m.position.copy(ROOF_OUT); m.scale.setScalar(2.2); scene.add(m); planes.push({ m, from: ROOF_OUT.clone(), to: V(s.x, 6, SHOP_Z + 5.5), t: 0 }); }
    }
    for (const d of Object.values(drones)) flyDrone(d, dt, T, night);
    { const b = agents.builder, s = b.task.kind === 'build' ? b.task.targets?.[0] : null;
      buildBeamM.opacity = lerp(buildBeamM.opacity, s ? 0.55 + Math.sin(T * 6) * 0.2 : 0, dt * 3); buildBeam.visible = buildBeamM.opacity > 0.01;
      if (s) { const to = V(s.x, 13.4, SHOP_Z + 2.5), dir = to.clone().sub(ROOF_OUT); buildBeam.position.copy(ROOF_OUT).addScaledVector(dir, 0.5); buildBeam.scale.set(1, dir.length(), 1); buildBeam.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize()); }
      beamDots.forEach((m, i) => { m.visible = !!s && buildBeam.visible; if (s) m.position.lerpVectors(ROOF_OUT, V(s.x, 13.4, SHOP_Z + 2.5), (T * 0.7 + i / beamDots.length) % 1); }); }
    for (const r of scanRings) { r.t = Math.min(1, r.t + dt * 0.7); const s = 1 + Math.max(0, r.t) * 9; r.m.scale.set(s, s, s); r.m.material.opacity = r.t < 0 ? 0 : (1 - r.t) * 0.7; }
    for (let i = planes.length - 1; i >= 0; i--) {
      const pl = planes[i]; pl.t += dt / 2.6; const k2 = Math.min(1, pl.t);
      const pos = pl.from.clone().lerp(pl.to, k2); pos.y += Math.sin(k2 * Math.PI) * 9;
      pl.m.lookAt(pos); pl.m.position.copy(pos);
      if (pl.t >= 1) { scene.remove(pl.m); planes.splice(i, 1); }
    }
    for (let i = 0; i < SP; i++) { if (spLife[i] <= 0) { spPos[i * 3 + 1] = -99; continue; } spLife[i] -= dt; spVel[i * 3 + 1] -= 9 * dt; for (let j = 0; j < 3; j++) spPos[i * 3 + j] += spVel[i * 3 + j] * dt; if (spPos[i * 3 + 1] < 0.05) { spPos[i * 3 + 1] = 0.05; spVel[i * 3 + 1] *= -0.3; } }
    sparks.geometry.attributes.position.needsUpdate = true;
    // ---- shop holograms
    for (const s of shops) {
      if (!s.holo) continue;
      const h = s.holo, done = ['demo', 'online', 'message', 'sent', 'replied', 'won'].includes(s.status);
      s.progress = done ? Math.min(1, s.progress + dt * 0.7) : s.building ? Math.min(0.9, s.progress + dt / 75) : s.progress;
      const pz = Math.max(0.001, 1 - Math.pow(1 - s.progress, 3));
      h.inner.scale.y = pz; h.grp.position.y = 13.4 + Math.sin(T * 1.4 + s.i) * 0.25;
      h.grp.rotation.y = turnTo(h.grp.rotation.y, Math.atan2(camera.position.x - h.grp.position.x, camera.position.z - h.grp.position.z) * 0.6, dt * 2);
      h.scan.position.y = 5.39; h.scan.visible = s.progress < 0.995; // top edge of the growing panel (inner is scaled)
      h.glowMat.opacity = (0.3 + night * 0.15) * pz; h.panelMat.color.setScalar(1 - night * 0.3);
      h.beamMat.opacity = (0.12 + night * 0.18) * (0.7 + 0.3 * Math.sin(T * 3));
      if (s.building && rnd() < 0.6) emitSpark(s.x + R(-4, 4), 13.4 + 5.4 * pz, SHOP_Z + 2.6);
    }
    // ---- cars, people, birds
    for (const lane of [1, -1]) {
      const list = cars.filter((c) => c.dir === lane).sort((a, b) => (a.g.position.x - b.g.position.x) * lane);
      list.forEach((c, i) => {
        const ahead = list[i + 1], gap = ahead ? (ahead.g.position.x - c.g.position.x) * lane : 99;
        const want = gap < 9 ? Math.min(c.v, ahead.base) * 0.8 : c.v;
        c.base = lerp(c.base || c.v, want, dt * 2);
        c.g.position.x += c.base * lane * dt * (1 - W.fog * 0.3 - W.snow * 0.3);
        if (c.g.position.x > 300) c.g.position.x = -300; if (c.g.position.x < -300) c.g.position.x = 300;
        c.wheels.forEach((w) => (w.rotation.y += c.base * dt * 2.7));
        c.headMatC.emissiveIntensity = 0.3 + lightsOn * 3; c.tailMat.emissiveIntensity = 0.3 + lightsOn * 2; c.beamM.opacity = lightsOn * 0.09;
      });
    }
    for (const pd of peds) {
      const g = pd.p.g; g.position.x += pd.dir * pd.v * dt; g.rotation.y = pd.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const lim = Math.min(160, cityR - 6);
      if (Math.abs(g.position.x) > lim) { pd.dir = -Math.sign(g.position.x); g.position.x = clamp(g.position.x, -lim, lim); }
      animatePerson(pd.p, dt, T, { moving: pd.v, rain: W.rain });
      g.visible = W.storm < 0.7 || pd.p.ph % 2 < 1;
    }
    const birdsOn = day > 0.6 && W.rain < 0.15 && W.snow < 0.2;
    for (const b of birds) { b.g.visible = birdsOn; if (!birdsOn) continue; b.a += b.s * dt; b.g.position.set(Math.cos(b.a) * b.r, b.y + Math.sin(T + b.ph) * 2, Math.sin(b.a) * b.r - 10); b.g.rotation.y = -b.a + (b.s > 0 ? 0 : Math.PI); const f = Math.sin(T * 9 + b.ph) * 0.6; b.L.rotation.z = f; b.Rw.rotation.z = -f; }
    // ---- camera
    if (fly) { const k2 = smooth(0, 1, (performance.now() - fly.t0) / 1200); controls.target.lerpVectors(fly.from, fly.to, k2); camera.position.lerpVectors(fly.pFrom, fly.pTo, k2); if (k2 >= 1) fly = null; }
    else if (sel?.follow && sel.type === 'agent') { const p = agents[sel.key].p.g.position; const d = V(p.x, 1.5, p.z).sub(controls.target); controls.target.add(d.multiplyScalar(0.08)); camera.position.add(d); }
    const fov = view === 'inside' ? 60 : 42;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
    controls.update();
    if (view === 'inside' && !fly) { clampRoom(camera.position, 0.15); clampRoom(controls.target, 0.6); }
    composer.render(dt);
    // ---- labels
    const w = stage.clientWidth, h = stage.clientHeight;
    const put = (el, pos, show = true) => {
      labelV.copy(pos).project(camera);
      if (!show || labelV.z > 1 || Math.abs(labelV.x) > 1.2 || Math.abs(labelV.y) > 1.2) { el.style.display = 'none'; return; }
      el.style.display = ''; el.style.transform = `translate(${((labelV.x + 1) / 2) * w}px,${((1 - labelV.y) / 2) * h}px) translate(-50%,-100%)`;
    };
    const names = Object.fromEntries((st.agents || []).map((x) => [x.key, x.name]));
    const camDist = camera.position.distanceTo(controls.target);
    for (const k of ORDER) {
      const a = agents[k], el = label(`a-${k}`, 'mp-a');
      const zz = a.goalAction === 'sleep' && !a.moving ? 'Zz' : '';
      const bub = a.bubble || zz, busyA = !['idle', 'queued'].includes(a.task.kind);
      const full = true;
      if (view !== 'inside') { el.style.display = 'none'; continue; }
      setHTML(el, `<span class="mp-n" style="--c:${ROLE[k].color}"><i>${ROLE[k].icon}</i>${full ? esc(names[k] || k) : ''}</span>${bub && camDist < 170 ? `<span class="mp-bub" dir="auto">${esc(bub.length > 70 ? `${bub.slice(0, 68)}…` : bub)}</span>` : ''}`);
      el.classList.toggle('busy', busyA);
      put(el, labelV.copy(a.p.g.position).setY(2.6));
    }
    for (const s of shops) {
      const el = label(`s-${s.i}`, 'mp-s');
      if (!s.lead) { el.style.display = 'none'; continue; }
      const k2 = s.building ? 'building' : s.checking && s.status === 'none' ? 'checking' : s.status;
      setHTML(el, `<span class="mp-pill ${STATUS[k2]?.cls || ''}">${esc(statusText(k2))}</span><b dir="auto">${esc(s.lead.business)}</b>`);
      put(el, labelV.set(s.x, 10.2, SHOP_Z + 5), camDist < 260 && view !== 'inside');
    }
    // ---- clock
    if (now - clockAt > 400) {
      clockAt = now;
      const hh = Math.floor(lp.h), mm = Math.floor((lp.h - hh) * 60);
      const ph = phaseOf(sun.alt, lp.h, marks);
      const kind = prefs.wx === 'live' ? kindOf(live.w) : prefs.wx;
      const wxLabel = prefs.wx === 'live' ? (live.ok ? t(live.label) : t('Weather offline')) : t(WXS.find((x) => x[0] === prefs.wx)[1]);
      setHTML($h('.mp-time'), `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      setHTML($h('.mp-phase'), `${{ Night: '🌙', Evening: '🌆', Sunset: '🌇', Dawn: '🌅', Morning: '🌤️', Noon: '☀️', Afternoon: '🌤️' }[ph]} ${esc(t(ph))}`);
      setHTML($h('.mp-wx'), `${WX_ICON[kind]} ${esc(wxLabel)}${live.temp !== null && prefs.wx === 'live' ? ` · ${live.temp}°C` : ''}${prefs.wx === 'live' && live.ok ? ` · ${esc(t('Wind'))} ${Math.round(live.w.wind * 3.6)} km/h` : ''}`);
      const isLive = prefs.time === 'live' && prefs.wx === 'live';
      if (prefs.team === 'demo') setHTML($h('.mp-src'), `<span class="mp-dot prev"></span>${esc(t('Rehearsal: no credits are spent'))}`);
      else setHTML($h('.mp-src'), isLive ? `<span class="mp-dot"></span>${esc(t('Live'))} · ${esc(t('Weather from Open-Meteo'))}` : `<span class="mp-dot prev"></span>${esc(t('Preview'))}`);
    }
  }
  stage.querySelector('.mp-empty')?.remove();
  raf = requestAnimationFrame(frame);

  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  function dispose() {
    cancelAnimationFrame(raf); clearInterval(wxTimer); ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
    scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { for (const v of Object.values(x)) if (v?.isTexture) v.dispose(); x.dispose(); }); });
    composer.dispose?.(); renderer.dispose(); renderer.forceContextLoss?.();
  }
  return { dispose };
}
