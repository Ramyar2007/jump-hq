// Connection to the owner's Jump HQ (through its private public link) + the live state of the agency.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setLang, t as tr } from './i18n';

export type Lead = any;
export type Approval = any;
export type Site = any;
export type Boot = {
  mode: 'awake' | 'sleep';
  night: any;
  link: string;
  config: any;
  agents: any[];
  stages: string[];
  leads: Lead[];
  approvals: Approval[];
  runs: any[];
  hunts: any[];
  sites: Site[];
  activity: any[];
  runner: any;
  stats: any;
};
type Conn = { url: string; token: string; company?: string; beacon?: string } | null;

const KEY = 'jumphq.conn';
const store = {
  async get(): Promise<Conn> {
    try {
      const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  async set(c: Conn) {
    try {
      if (Platform.OS === 'web') { if (c) globalThis.localStorage?.setItem(KEY, JSON.stringify(c)); else globalThis.localStorage?.removeItem(KEY); return; }
      if (c) await SecureStore.setItemAsync(KEY, JSON.stringify(c)); else await SecureStore.deleteItemAsync(KEY);
    } catch {}
  },
};

type Ctx = {
  ready: boolean;
  conn: Conn;
  data: Boot | null;
  lang: string;
  online: boolean;
  error: string;
  t: (s: string) => string;
  req: <T = any>(method: string, path: string, body?: any) => Promise<T>;
  refresh: () => Promise<void>;
  pair: (url: string, code: string) => Promise<void>;
  pairWithPassword: (url: string, password: string) => Promise<void>;
  unpair: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<Boot | null>>;
};
const ApiCtx = createContext<Ctx>(null as any);
export const useApi = () => useContext(ApiCtx);

const clean = (u: string) => u.trim().replace(/\/+$/, '').replace(/^(?!https?:\/\/)/, 'https://');

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [conn, setConn] = useState<Conn>(null);
  const [data, setData] = useState<Boot | null>(null);
  const [lang, setLangState] = useState('en');
  const [online, setOnline] = useState(true);
  const [error, setError] = useState('');
  const ws = useRef<WebSocket | null>(null);
  const timer = useRef<any>(null);
  const connRef = useRef<Conn>(null);
  connRef.current = conn;

  const applyLang = useCallback((code: string) => { setLang(code); setLangState(code); }, []);

  // The computer's public link changes when it restarts; it posts the new one to its beacon.
  const relinking = useRef<Promise<boolean> | null>(null);
  const relink = useCallback(() => {
    const c = connRef.current;
    if (!c?.beacon) return Promise.resolve(false);
    relinking.current ||= (async () => {
      try {
        const j = await (await fetch(`${c.beacon}?t=${Date.now()}`)).json();
        if (j?.url && j.url !== c.url) {
          const next = { ...c, url: j.url };
          connRef.current = next;
          await store.set(next);
          setConn(next);
          return true;
        }
      } catch {}
      return false;
    })().finally(() => { setTimeout(() => { relinking.current = null; }, 15000); });
    return relinking.current;
  }, []);

  const req = useCallback(async (method: string, path: string, body?: any, retried = false): Promise<any> => {
    const c = connRef.current;
    if (!c) throw new Error(tr('Not paired'));
    let r: Response;
    try {
      r = await fetch(`${c.url}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${c.token}` }, body: body ? JSON.stringify(body) : undefined });
    } catch {
      if (!retried && (await relink())) return req(method, path, body, true);
      setOnline(false);
      throw new Error(tr('Cannot reach your computer. Is Jump HQ running?'));
    }
    if (!retried && [502, 530, 1033].includes(r.status) && (await relink())) return req(method, path, body, true);
    setOnline(true);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await store.set(null); setConn(null); setData(null); throw new Error(tr('This phone was removed. Pair it again.')); }
    if (!r.ok) throw new Error(j.error || `${r.status}`);
    return j;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = (await req('GET', '/api/bootstrap')) as Boot;
      if (d.config?.ui_language) applyLang(d.config.ui_language);
      setData(d);
      setError('');
    } catch (e: any) { setError(e.message); }
  }, [req, applyLang]);

  // live updates: the server says "something changed", we refetch (debounced)
  const soon = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(refresh, 400); }, [refresh]);
  useEffect(() => {
    if (!conn) return;
    let alive = true;
    let retry: any;
    let fails = 0;
    const open = () => {
      const u = `${conn.url.replace(/^http/, 'ws')}/ws?t=${conn.token}`;
      const s = new WebSocket(u);
      ws.current = s;
      s.onmessage = (m) => {
        try {
          const msg = JSON.parse(String(m.data));
          if (msg.type === 'mode') setData((d) => (d ? { ...d, mode: msg.mode } : d));
          if (['change', 'mode', 'runner'].includes(msg.type)) soon();
        } catch {}
      };
      s.onopen = () => { fails = 0; setOnline(true); };
      s.onclose = () => { if (!alive) return; fails++; if (fails % 3 === 0) relink(); retry = setTimeout(open, 3000); };
    };
    open();
    refresh();
    const poll = setInterval(refresh, 30000);
    return () => { alive = false; clearTimeout(retry); clearInterval(poll); ws.current?.close(); };
  }, [conn, refresh, soon, relink]);

  useEffect(() => { store.get().then((c) => { setConn(c); setReady(true); }); }, []);

  const finish = useCallback(async (url: string, r: any) => {
    const c = { url, token: r.token, company: r.company, beacon: r.beacon || '' };
    await store.set(c);
    if (r.lang) applyLang(r.lang);
    setConn(c);
  }, [applyLang]);

  const device = () => `${Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android phone' : 'Browser'}`;
  const post = async (url: string, path: string, body: any) => {
    let r: Response;
    try { r = await fetch(`${url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { throw new Error(tr('Cannot reach that address. Check the link on your computer.')); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `${r.status}`);
    return j;
  };
  const pair = useCallback(async (u: string, code: string) => { const url = clean(u); await finish(url, await post(url, '/api/pair/claim', { code, device: device() })); }, [finish]);
  const pairWithPassword = useCallback(async (u: string, password: string) => { const url = clean(u); await finish(url, await post(url, '/api/pair/password', { password, device: device() })); }, [finish]);
  const unpair = useCallback(async () => { await store.set(null); setConn(null); setData(null); }, []);

  const value = useMemo<Ctx>(() => ({ ready, conn, data, lang, online, error, t: tr, req, refresh, pair, pairWithPassword, unpair, setData }),
    // lang is in the deps so every screen re-renders in the new language
    [ready, conn, data, lang, online, error, req, refresh, pair, pairWithPassword, unpair]);
  return <ApiCtx.Provider value={value}>{children}</ApiCtx.Provider>;
}
