import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { LogOut, Pause, Play, OctagonX } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { LANGS } from '@/lib/i18n';
import { C } from '@/lib/theme';
import { Badge, Btn, Card, Empty, Field, H, Row, Screen, T } from '@/components/ui';
import { ModeCard } from '@/components/ModeCard';

function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ alignItems: 'flex-start' }} gap={12}>
      <View style={{ flex: 1 }}><T w={700}>{label}</T>{sub ? <T size={13} color={C.muted}>{sub}</T> : null}</View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.accent, false: '#cfd8e6' }} thumbColor="#fff" />
    </Row>
  );
}

export default function SettingsTab() {
  const { data, t, req, refresh, unpair, conn } = useApi();
  const [conns, setConns] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [minScore, setMinScore] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => { req('GET', '/api/connections').then(setConns).catch(() => {}); }, [req]);
  useEffect(() => { if (data) { setMinScore(String(data.config.sleep.judge_min_score)); setFrom(data.config.sleep.from); setTo(data.config.sleep.to); } }, [data?.config.sleep.judge_min_score, data?.config.sleep.from, data?.config.sleep.to]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Screen><Empty title={t('Loading…')} /></Screen>;
  const c = data.config;
  const save = async (patch: any, key = 'save') => {
    setBusy(key);
    try { await req('PUT', '/api/settings', patch); await refresh(); }
    catch (e: any) { Alert.alert('', e.message); }
    finally { setBusy(''); }
  };
  const test = async (which: string) => {
    setBusy(which);
    try { const r = await req('POST', '/api/connections/test', { which }); Alert.alert('', r.message || t('Connected')); setConns(await req('GET', '/api/connections')); }
    catch (e: any) { Alert.alert('', e.message); }
    finally { setBusy(''); }
  };
  const paused = data.runner?.paused;
  const CONN: [string, string][] = [['brain', 'AI brain'], ['email', 'Email sending'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram alerts'], ['publish', 'Demo publishing'], ['phone', 'Phone app']];
  return (
    <Screen>
      <ModeCard />

      <Card>
        <H>{t('Language')}</H>
        <T size={13.5} color={C.muted}>{t('The dashboard, the phone app and everything the team writes for you (notes, reasons, reports) use this language. Messages to businesses always use their own language.')}</T>
        <Row gap={8}>
          {LANGS.map((l) => (
            <Pressable key={l.code} onPress={() => save({ ui_language: l.code }, 'lang')} style={{ flex: 1, borderWidth: 2, borderColor: c.ui_language === l.code ? C.accent : C.line, backgroundColor: c.ui_language === l.code ? C.accentSoft : C.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <T w={800} size={16} center>{l.name}</T>
            </Pressable>
          ))}
        </Row>
      </Card>

      <Card>
        <H>{t('Sleep mode')}</H>
        <Toggle label={t('Go to sleep by itself every night')} sub={t('Switches to Sleep mode at the start time and back to Awake at the end time.')} value={c.sleep.schedule} onChange={(v) => save({ sleep: { schedule: v } })} />
        <Row gap={10}>
          <View style={{ flex: 1 }}><Field label={t('From')} value={from} onChangeText={setFrom} onEndEditing={() => /^\d{1,2}:\d{2}$/.test(from) && save({ sleep: { from } })} keyboardType="numbers-and-punctuation" /></View>
          <View style={{ flex: 1 }}><Field label={t('Until')} value={to} onChangeText={setTo} onEndEditing={() => /^\d{1,2}:\d{2}$/.test(to) && save({ sleep: { to } })} keyboardType="numbers-and-punctuation" /></View>
        </Row>
        <Toggle label={t('Put Judge-approved demos online')} sub={t('The demo gets a public link and the first message is written.')} value={c.sleep.auto_publish} onChange={(v) => save({ sleep: { auto_publish: v } })} />
        <Toggle label={t('Send Judge-approved emails')} sub={t('Needs automatic email in Connections. WhatsApp messages are approved and wait for one tap from you.')} value={c.sleep.auto_send} onChange={(v) => save({ sleep: { auto_send: v } })} />
        <Toggle label={t('Judge gives a second opinion in Awake mode too')} sub={t('You see its score and reasons next to every demo and message.')} value={c.sleep.second_opinion} onChange={(v) => save({ sleep: { second_opinion: v } })} />
        <Field label={t('The Judge must give at least (out of 100)')} value={minScore} onChangeText={setMinScore} keyboardType="number-pad" onEndEditing={() => { const n = Math.max(50, Math.min(100, Number(minScore) || 80)); setMinScore(String(n)); save({ sleep: { judge_min_score: n } }); }} />
        <T size={12.5} color={C.muted}>{t('Always held for you: anything the Judge is unsure about, anything medium or high risk, wrong contact details, missing demo link, invented facts.')}</T>
      </Card>

      <Card>
        <H>{t('Connections')}</H>
        {conns ? CONN.map(([k, label]) => {
          const s = conns[k];
          const ok = k === 'email' ? (s.ok ? true : 'manual') : s.ok;
          return (
            <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
              <View style={{ flex: 1 }}><T w={700}>{t(label)}</T>{k === 'phone' && s.url ? <T size={12} color={C.muted} ltr numberOfLines={1}>{s.url}</T> : null}</View>
              <Badge label={ok === true ? t('Connected') : ok === 'manual' ? t('Manual') : t('Not connected')} t={ok === true ? 'good' : ok === 'manual' ? 'info' : ''} />
              {['brain', 'email', 'telegram', 'publish'].includes(k) ? <Btn small kind="outline" label={t('Test')} busy={busy === k} onPress={() => test(k)} /> : null}
            </Row>
          );
        }) : <T color={C.muted}>{t('Checking your connections…')}</T>}
        <T size={12.5} color={C.muted}>{t('Change connection details on the computer: Settings → Connections.')}</T>
      </Card>

      <Card>
        <H>{t('Your AI team')}</H>
        <T size={13.5} color={C.muted}>{paused ? `${t('Team paused')}. ${data.runner.pauseReason || ''}` : `${t('Team ready')} · ${data.runner?.today ?? 0} ${t('jobs today')}`}</T>
        {paused ? <Btn kind="primary" icon={<Play size={17} color="#fff" />} label={t('Resume')} busy={busy === 'resume'} onPress={() => { setBusy('resume'); req('POST', '/api/runner/resume').then(refresh).finally(() => setBusy('')); }} />
          : <Btn icon={<Pause size={17} color={C.ink} />} label={t('Pause the team')} busy={busy === 'pause'} onPress={() => { setBusy('pause'); req('POST', '/api/runner/pause').then(refresh).finally(() => setBusy('')); }} />}
        <Btn kind="danger" icon={<OctagonX size={17} color={C.bad} />} label={t('Stop everything now')} onPress={() => Alert.alert(t('Stop everything now'), t('Stops every agent at once and cancels what is waiting. Work already done is kept.'), [{ text: t('Cancel'), style: 'cancel' }, { text: t('Stop'), style: 'destructive', onPress: () => req('POST', '/api/runner/stop-all').then(refresh).catch(() => {}) }])} />
      </Card>

      <Card>
        <H>{t('This phone')}</H>
        <T size={13} color={C.muted} ltr numberOfLines={1}>{conn?.url}</T>
        <Btn kind="ghost" icon={<LogOut size={17} color={C.bad} />} label={t('Unpair this phone')} onPress={() => Alert.alert('', t('Unpair this phone? You will need a new pairing code from the computer.'), [{ text: t('Cancel'), style: 'cancel' }, { text: t('Unpair this phone'), style: 'destructive', onPress: unpair }])} />
      </Card>
    </Screen>
  );
}
