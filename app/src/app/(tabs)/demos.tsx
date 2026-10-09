import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Monitor } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { Badge, Card, Empty, Row, Screen, T } from '@/components/ui';
import { JudgeBox } from '@/components/Judge';

export default function Demos() {
  const { data, t, refresh } = useApi();
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  if (!data) return <Screen><Empty title={t('Loading…')} /></Screen>;
  const sites = data.sites.map((s) => ({ s, l: data.leads.find((x) => x.id === s.lead_id || x.demo?.slug === s.slug) }))
    .sort((a, b) => (a.s.public_url ? 1 : 0) - (b.s.public_url ? 1 : 0) || (b.s.updated || '').localeCompare(a.s.updated || ''));
  const building = data.runs.filter((r) => r.agent === 'builder' && ['running', 'queued'].includes(r.status));
  return (
    <Screen onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} refreshing={pulling}>
      <T color={C.muted}>{t('Free websites the team built. Look, approve, and the first message is written for you.')}</T>
      {building.length ? <Card style={{ backgroundColor: C.blueSoft }}><T w={700} color={C.blue}>{`${building.map((r) => r.title.replace('Builder · ', '')).join(', ')} · ${t('working…')}`}</T></Card> : null}
      {sites.length ? sites.map(({ s, l }) => {
        const waiting = !s.public_url && l?.stage === 'demo_built';
        return (
          <Pressable key={s.slug} onPress={() => router.push(`/demo/${s.slug}`)}>
            {({ pressed }) => (
              <Card style={{ opacity: pressed ? 0.88 : 1 }}>
                <Row gap={12}>
                  <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: waiting ? C.accentSoft : C.sunk, alignItems: 'center', justifyContent: 'center' }}><Monitor size={21} color={waiting ? C.accent : C.ink2} /></View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T w={800} size={16} numberOfLines={1}>{s.business}</T>
                    <Badge label={s.public_url ? t('Online') : waiting ? t('Waiting for you') : t('Not used')} t={s.public_url ? 'good' : waiting ? 'accent' : ''} />
                  </View>
                </Row>
                {s.summary ? <T size={13.5} color={C.muted} numberOfLines={3}>{s.summary}</T> : null}
                {!s.public_url ? <JudgeBox j={s.judge} judging={s.judging} /> : s.auto ? <Badge label={t('Put online by the Judge while you slept')} t="good" /> : null}
              </Card>
            )}
          </Pressable>
        );
      }) : <Card><Empty title={t('No demos yet')} sub={t('When a business is worth it, the Builder makes one and it shows up here.')} /></Card>}
    </Screen>
  );
}
