import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { leadOf, mainText } from '@/lib/logic';
import { Badge, Card, Empty, Row, Screen, Seg, T, ago } from '@/components/ui';

type Tab = 'pending' | 'ready' | 'sent' | 'rejected';
const ST: Record<Tab, string> = { pending: 'pending', ready: 'approved', sent: 'sent', rejected: 'rejected' };

export default function Messages() {
  const { data, t, refresh } = useApi();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');
  const [pulling, setPulling] = useState(false);
  if (!data) return <Screen><Empty title={t('Loading…')} /></Screen>;
  const msgs = data.approvals.filter((a) => ['email', 'whatsapp'].includes(a.type));
  const list = msgs.filter((a) => a.status === ST[tab]);
  const count = (k: Tab) => msgs.filter((a) => a.status === ST[k]).length;
  return (
    <Screen onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} refreshing={pulling}>
      <T color={C.muted}>{`${t('Nothing is sent until you say so.')} ${data.stats?.sentToday ?? 0} / ${data.config.outreach.daily_send_cap} ${t('sent today.')}`}</T>
      <Seg<Tab> items={[['pending', t('To approve'), count('pending')], ['ready', t('Ready to send'), count('ready')], ['sent', t('Sent'), count('sent')], ['rejected', t('Discarded'), count('rejected')]]} value={tab} onChange={setTab} />
      {list.length ? list.map((a) => {
        const l = leadOf(data, a.lead_id);
        const wa = a.type === 'whatsapp';
        const j = a.judge;
        const jt = j ? (j.passes ? 'good' : j.verdict === 'hold' ? 'bad' : 'warn') : '';
        return (
          <Pressable key={a.id} onPress={() => router.push(`/message/${a.id}`)}>
            {({ pressed }) => (
              <Card style={{ opacity: pressed ? 0.85 : 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={8} style={{ flex: 1 }}><T w={800} size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{l?.business || a.title}</T><Badge label={wa ? 'WhatsApp' : t('Email')} t={wa ? 'good' : 'info'} /></Row>
                  <T size={12.5} color={C.faint}>{ago(a.created, t)}</T>
                </Row>
                {a.judging ? <Badge label={t('The Judge is checking this…')} t="info" /> : j ? <Badge label={`${t('Judge')}: ${j.passes ? (j.revised ? t('Safe after small fixes') : t('Safe to send')) : t('Held: needs you')} · ${j.score}/100`} t={jt} /> : null}
                {a.auto && a.status !== 'pending' ? <Badge label={t('Approved by the Judge while you slept')} t="good" /> : null}
                <View style={{ backgroundColor: wa ? '#e9f8ef' : C.surface2, borderRadius: 10, padding: 12 }}>
                  <T size={14} numberOfLines={4} style={{ writingDirection: 'auto' as any }}>{wa ? mainText(a.body) : a.body}</T>
                </View>
              </Card>
            )}
          </Pressable>
        );
      }) : <Card><Empty title={t(({ pending: 'Nothing to approve', ready: 'Nothing waiting to be sent', sent: 'No messages sent yet', rejected: 'Nothing discarded' } as const)[tab])} /></Card>}
    </Screen>
  );
}
