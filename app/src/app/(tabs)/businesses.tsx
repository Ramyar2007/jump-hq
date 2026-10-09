import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { statusOf } from '@/lib/logic';
import { Badge, Card, Empty, Field, Ring, Row, Screen, Seg, T } from '@/components/ui';

type F = 'all' | 'worth' | 'you' | 'contacted' | 'clients' | 'hold' | 'skipped';
const FILTERS: Record<F, (l: any) => boolean> = {
  all: () => true,
  worth: (l) => ['qualified', 'planned', 'approved'].includes(l.stage),
  you: (l) => ['demo_built', 'email_drafted'].includes(l.stage),
  contacted: (l) => ['sent', 'replied'].includes(l.stage),
  clients: (l) => l.stage === 'won',
  hold: (l) => l.stage === 'hold',
  skipped: (l) => ['skipped', 'lost'].includes(l.stage),
};
const AV = ['#e4572e', '#2a9d8f', '#1d4ed8', '#0f8a5f', '#c2410c', '#0e7490', '#b45309', '#334155', '#be123c', '#4d7c0f'];
const avColor = (n: string) => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };

export default function Businesses() {
  const { data, t, refresh } = useApi();
  const router = useRouter();
  const [f, setF] = useState<F>('all');
  const [q, setQ] = useState('');
  const [pulling, setPulling] = useState(false);
  if (!data) return <Screen><Empty title={t('Loading…')} /></Screen>;
  const qq = q.toLowerCase();
  const list = data.leads.filter(FILTERS[f]).filter((l) => !qq || `${l.business} ${l.business_local} ${l.city} ${l.area} ${l.niche}`.toLowerCase().includes(qq))
    .sort((a, b) => (b.opportunity?.score ?? -1) - (a.opportunity?.score ?? -1) || b.updated.localeCompare(a.updated));
  const n = (k: F) => data.leads.filter(FILTERS[k]).length;
  const qual = data.config.qualify;
  return (
    <Screen onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} refreshing={pulling}>
      <Seg<F> items={[['all', t('All'), n('all')], ['worth', t('Worth building'), n('worth')], ['you', t('Waiting for you'), n('you')], ['contacted', t('Contacted'), n('contacted')], ['clients', t('Clients'), n('clients')], ['hold', t('On hold'), n('hold')], ['skipped', t('Not a fit'), n('skipped')]]} value={f} onChange={setF} />
      <Field placeholder={t('Search by name or area')} value={q} onChangeText={setQ} />
      <Card style={{ padding: 0, gap: 0 }}>
        {list.length ? list.map((l, i) => {
          const st = statusOf(data, l);
          return (
            <Pressable key={l.id} onPress={() => router.push(`/lead/${l.id}`)} style={({ pressed }) => ({ backgroundColor: pressed ? C.surface2 : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: C.line })}>
              <Row style={{ padding: 14 }} gap={12}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: avColor(l.business), alignItems: 'center', justifyContent: 'center' }}><T w={800} size={18} color="#fff" center>{(l.business.replace(/^(the|al|el)\s+/i, '').trim()[0] || '?').toUpperCase()}</T></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <T w={700} size={15} numberOfLines={1}>{l.business}</T>
                  <T size={12.5} color={C.muted} numberOfLines={1}>{[l.niche, [l.area, l.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</T>
                  <Badge label={st.text} t={st.tone} />
                </View>
                <Ring score={l.opportunity?.score} threshold={qual.threshold} hold={qual.hold} />
              </Row>
            </Pressable>
          );
        }) : <Empty title={data.leads.length ? t('Nothing here') : t('No businesses yet')} sub={data.leads.length ? t('Try another filter.') : t('Start a search on the Home page.')} />}
      </Card>
    </Screen>
  );
}
