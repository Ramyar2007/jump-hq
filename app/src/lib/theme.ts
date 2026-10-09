// Same "Clean Pro" look as the dashboard: white cards on a soft grey, navy, one orange action.
export const C = {
  bg: '#f4f6fa',
  surface: '#ffffff',
  surface2: '#f7f9fc',
  sunk: '#eef2f8',
  ink: '#0f1b33',
  ink2: '#33415c',
  muted: '#5b6b87',
  faint: '#8e9ab0',
  line: '#e6ebf3',
  line2: '#d5dde9',
  navy: '#0f1b33',
  navy2: '#1d2c4d',
  night: '#0a1326',
  accent: '#ff6b2c',
  accent2: '#eb5a1c',
  accentSoft: '#fff1ea',
  blue: '#1d4ed8',
  blueSoft: '#eef3ff',
  good: '#0f8a5f',
  goodSoft: '#e3f6ee',
  warn: '#a35f00',
  warnSoft: '#fff4dc',
  bad: '#c2362b',
  badSoft: '#fde9e7',
  moon: '#ffcf7a',
  moonInk: '#3b2600',
};

export const tone = (t?: string) =>
  ({
    good: { bg: C.goodSoft, fg: C.good },
    warn: { bg: C.warnSoft, fg: C.warn },
    bad: { bg: C.badSoft, fg: C.bad },
    info: { bg: C.blueSoft, fg: C.blue },
    accent: { bg: C.accentSoft, fg: C.accent2 },
  } as Record<string, { bg: string; fg: string }>)[t || ''] || { bg: C.sunk, fg: C.ink2 };

export const R = { card: 16, sm: 11 };
export const shadow = { shadowColor: '#0f1b33', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 };
