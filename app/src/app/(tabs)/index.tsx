import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Eye, MessageSquare, Pause, Search, Send, WifiOff } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { agentName, money, needsYou } from '@/lib/logic';
import { Btn, Card, Empty, H, Row, Screen, T, clock, useRtl } from '@/components/ui';
import { ModeCard, NightReport } from '@/components/ModeCard';
import { AddBusiness } from '@/components/AddBusiness';
import { AskTeam } from '@/components/AskTeam';

function Chips({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  const rtl = useRtl();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: rtl ? 'row-reverse' : 'row' }}>
      {items.map((x) => (
        <Pressable key={x} onPress={() => onChange(x)} style={{ paddingHorizontal: 14, height: 40, borderRadius: 11, justifyContent: 'center', borderWidth: 2, borderColor: value === x ? C.accent : C.line, backgroundColor: value === x ? C.accentSoft : C.surface2 }}>
          <T w={700} size={14} color={value === x ? C.accent2 : C.ink}>{x[0].toUpperCase() + x.slice(1)}</T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function Home() {
  const { data, t, req, refresh, online, error, conn } = useApi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const m = data ? data.config.markets[data.config.market_id] : null;
  const [niche, setNiche] = useState('');
  const [city, setCity] = useState('');
  const [count, setCount] = useState('10');
  if (!data || !m) {
    return <Screen><Stack.Screen options={{ headerTitle: conn?.company ? `${conn.company} HQ` : 'Jump HQ' }} />{error ? <Card><Row><WifiOff color={C.bad} size={20} /><T style={{ flex: 1 }}>{error}</T></Row><Btn label={t('Try again')} onPress={refresh} /></Card> : <Empty title={t('Loading…')} />}</Screen>;
  }
  const todo = needsYou(data);
  const st = data.stats || {};
  const hunt = data.hunts[0];
  const run = data.runs.find((r) => r.status === 'running');
  const open = (k: string, id: string) => {
    if (k === 'demo') router.push(`/lead/${id}`);
    else if (k === 'message' || k === 'send') router.push(`/message/${id}`);
    else req('POST', '/api/runner/resume').then(refresh).catch((e) => Alert.alert('', e.message));
  };
  const start = async () => {
    setBusy(true);
    try {
      await req('POST', '/api/hunts', { market_id: data.config.market_id, niche: niche || m.niches[0], city: city || m.cities[0], count: Number(count), build: 3 });
      await refresh();
      Alert.alert('', t('Search started. You can close this page, the team keeps working.'));
    } catch (e: any) { Alert.alert('', e.message); }
    finally { setBusy(false); }
  };
  const IconFor = { demo: Eye, message: MessageSquare, send: Send, paused: Pause } as const;
  return (
    <Screen onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} refreshing={pulling}>
      <Stack.Screen options={{ headerTitle: `${data.config.company.name} HQ` }} />
      {!online ? <Card style={{ backgroundColor: C.badSoft }}><Row><WifiOff color={C.bad} size={18} /><T style={{ flex: 1 }} color={C.bad}>{t('Cannot reach your computer. Is Jump HQ running?')}</T></Row></Card> : null}
      <ModeCard />
      <NightReport />
      <AskTeam />

      <Card style={{ padding: 0, gap: 0 }}>
        <Row style={{ padding: 16, paddingBottom: 6, justifyContent: 'space-between' }}><H>{t('Needs you')}</H>{todo.length ? <T color={C.muted} size={13}>{`${todo.length} ${t('to do')}`}</T> : null}</Row>
        {todo.length ? todo.slice(0, 8).map((it, i) => {
          const Icon = IconFor[it.kind];
          return (
            <Pressable key={`${it.kind}${it.id}`} onPress={() => open(it.kind, it.id)} style={({ pressed }) => ({ backgroundColor: pressed ? C.surface2 : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: C.line })}>
              <Row style={{ paddingHorizontal: 16, paddingVertical: 13 }} gap={12}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: i === 0 ? C.accentSoft : C.sunk, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={i === 0 ? C.accent : C.ink2} /></View>
                <View style={{ flex: 1 }}><T w={700} numberOfLines={1}>{it.title}</T><T size={13} color={C.muted} numberOfLines={2}>{it.sub}</T></View>
              </Row>
            </Pressable>
          );
        }) : <Empty title={t('Nothing waiting')} sub={t('New demos and messages will show up here.')} />}
      </Card>

      {run || (hunt && hunt.status === 'running') ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}><H>{hunt ? `${t('Searching')}: ${hunt.niche}, ${hunt.city}` : t('Live')}</H><T w={700} size={13} color={C.accent}>{t('● live')}</T></Row>
          {hunt ? (
            <Row gap={6}>
              {([['found', 'Found'], ['verified', 'Checked'], ['high', 'Worth building'], ['demos', 'Demos built']] as const).map(([k, l]) => (
                <View key={k} style={{ flex: 1, backgroundColor: k === 'demos' && hunt.funnel[k] ? C.accentSoft : C.surface2, borderRadius: 10, padding: 9 }}>
                  <T w={800} size={22} color={k === 'demos' && hunt.funnel[k] ? C.accent : C.ink}>{String(hunt.funnel[k] ?? 0)}</T>
                  <T w={600} size={11} color={C.muted} numberOfLines={2}>{t(l)}</T>
                </View>
              ))}
            </Row>
          ) : null}
          {run ? <Row style={{ backgroundColor: C.blueSoft, borderRadius: 10, padding: 11 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue }} /><T w={700} size={13.5} color={C.blue} style={{ flex: 1 }}>{`${agentName(data, run.agent)} ${t('is working')} · ${run.title.split(' · ').slice(1).join(' · ')}`}</T></Row> : null}
        </Card>
      ) : null}

      <Card>
        <H size={19}>{t('Find new clients')}</H>
        <T color={C.muted} size={14}>{t('Choose who to look for. The team finds them, checks them, and makes the best ones a free sample of your work.')}</T>
        <T w={700} size={13} color={C.faint}>{t('Kind of business')}</T>
        <Chips items={m.niches} value={niche || m.niches[0]} onChange={setNiche} />
        <T w={700} size={13} color={C.faint}>{t('City')}</T>
        <Chips items={m.cities} value={city || m.cities[0]} onChange={setCity} />
        <T w={700} size={13} color={C.faint}>{t('How many')}</T>
        <Chips items={['5', '10', '20', '30']} value={count} onChange={setCount} />
        <Btn kind="primary" label={t('Start search')} icon={<Search size={18} color="#fff" />} busy={busy} onPress={start} style={{ marginTop: 6 }} />
      </Card>
      <AddBusiness />

      <Row wrap gap={10}>
        {([['Businesses checked', st.leads], ['Demos built', st.demos], ['Messages sent', st.sentTotal], ['Clients', st.won], ['Monthly income', st.mrr ? money(data, st.mrr) : '0']] as const).map(([k, v]) => (
          <Card key={k} style={{ flexGrow: 1, minWidth: '45%', padding: 14, gap: 2 }}><T w={800} size={24}>{String(v ?? 0)}</T><T w={600} size={12.5} color={C.muted}>{t(k)}</T></Card>
        ))}
      </Row>

      <Card style={{ gap: 0, padding: 0 }}>
        <View style={{ padding: 16, paddingBottom: 8 }}><H>{t('What the team did')}</H></View>
        {data.activity.slice(0, 8).map((a, i) => (
          <Row key={a.id} style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, alignItems: 'flex-start' }} gap={12}>
            <T size={12} w={600} color={C.faint} ltr style={{ width: 46 }}>{clock(a.at)}</T>
            <T size={13.5} color={a.kind === 'error' ? C.bad : C.ink} style={{ flex: 1 }}>{a.text}</T>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
