// The one big switch: Awake (you approve) or Sleep (the Judge approves, risky things wait).
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { Card, Row, T, clock } from './ui';

export function ModeCard() {
  const { data, t, req, refresh, setData } = useApi();
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const sleep = data.mode === 'sleep';
  const n = data.night;
  const go = async (mode: 'awake' | 'sleep') => {
    if (busy || mode === data.mode) return;
    const run = async () => {
      setBusy(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      try { const r = await req('POST', '/api/mode', { mode }); setData((d) => (d ? { ...d, mode: r.mode, night: r.night } : d)); await refresh(); }
      catch (e: any) { Alert.alert('', e.message); }
      finally { setBusy(false); }
    };
    if (mode === 'sleep') Alert.alert(t('Sleep'), t('Go to Sleep mode? The team keeps working and the Judge approves safe demos and messages for you. Anything risky waits for the morning.'), [{ text: t('Cancel'), style: 'cancel' }, { text: t('Sleep now'), onPress: run }]);
    else run();
  };
  const stats: [string, string][] = [['searches', 'Searches'], ['found', 'Businesses found'], ['demos', 'Demos built'], ['published', 'Put online'], ['sent', 'Messages sent'], ['held', 'Held for you']];
  return (
    <Card dark style={{ backgroundColor: sleep ? C.night : C.navy, padding: 18, gap: 14 }}>
      <Row style={{ backgroundColor: 'rgba(0,0,0,.25)', borderRadius: 13, padding: 4 }} gap={4}>
        {(['awake', 'sleep'] as const).map((m) => {
          const on = data.mode === m;
          const Icon = m === 'awake' ? Sun : Moon;
          return (
            <Pressable key={m} onPress={() => go(m)} style={{ flex: 1, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: on ? (m === 'sleep' ? C.moon : '#fff') : 'transparent' }}>
              <Icon size={19} color={on ? (m === 'sleep' ? C.moonInk : C.navy) : '#9fb0cf'} />
              <T w={800} size={16} color={on ? (m === 'sleep' ? C.moonInk : C.navy) : '#9fb0cf'}>{t(m === 'awake' ? 'Awake' : 'Sleep')}</T>
            </Pressable>
          );
        })}
      </Row>
      <View style={{ gap: 4 }}>
        <T w={800} size={18} color="#fff">{sleep ? t('Sleep mode is on') : t('You approve everything before it goes out.')}</T>
        <T size={14} color="#b8c4dc">{sleep ? `${t('The team works alone. The Judge checks every demo and message before it goes out.')}${n?.start ? ` ${t('Since')} ${clock(n.start)}.` : ''}` : t('Switch to Sleep and the team keeps working. The Judge approves safe work; anything risky waits for you.')}</T>
      </View>
      {sleep && n ? (
        <Row wrap gap={8}>
          {stats.map(([k, l]) => (
            <View key={k} style={{ backgroundColor: 'rgba(255,255,255,.07)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11, minWidth: '30%', flexGrow: 1 }}>
              <T w={800} size={20} color="#fff">{String(n[k] ?? 0)}</T>
              <T w={600} size={11.5} color="#a9b6d0">{t(l)}</T>
            </View>
          ))}
        </Row>
      ) : null}
    </Card>
  );
}

export function NightReport() {
  const { data, t } = useApi();
  const [hidden, setHidden] = useState('');
  const n = data?.night;
  if (!data || data.mode === 'sleep' || !n?.end || hidden === n.start || Date.now() - new Date(n.end).getTime() > 20 * 3600e3) return null;
  const stats: [string, string][] = [['searches', 'Searches'], ['found', 'Businesses found'], ['demos', 'Demos built'], ['published', 'Put online'], ['sent', 'Messages sent'], ['ready', 'Ready to send'], ['held', 'Held for you']];
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}><View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Sun size={19} color={C.accent} /></View>
          <View><T w={800} size={17}>{t('While you slept')}</T><T size={13} color={C.muted} ltr>{`${clock(n.start)} – ${clock(n.end)}`}</T></View></Row>
        <Pressable onPress={() => setHidden(n.start)}><T w={700} size={13.5} color={C.blue}>{t('Got it')}</T></Pressable>
      </Row>
      <Row wrap gap={8}>
        {stats.map(([k, l]) => (
          <View key={k} style={{ backgroundColor: C.surface2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11, minWidth: '30%', flexGrow: 1 }}>
            <T w={800} size={20}>{String(n[k] ?? 0)}</T>
            <T w={600} size={11.5} color={C.muted}>{t(l)}</T>
          </View>
        ))}
      </Row>
    </Card>
  );
}
