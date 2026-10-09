// Full-screen demo preview with the one decision: put it online (or leave it).
import React, { useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Check, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { Btn, Empty, Row } from '@/components/ui';
import { JudgeBox } from '@/components/Judge';

export default function DemoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, conn, t, req, refresh } = useApi();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const s = data?.sites.find((x) => x.slug === slug);
  if (!data || !s || !conn) return <Empty title={t('Loading…')} />;
  const l = data.leads.find((x) => x.id === s.lead_id || x.demo?.slug === s.slug);
  const uri = s.public_url || `${conn.url}${s.local_url}?k=${conn.token}`;
  const approve = async () => {
    if (!l) return;
    setBusy(true);
    try { await req('POST', `/api/leads/${l.id}/approve-demo`); await refresh(); Alert.alert('', t('The demo is online. The Writer is drafting the first message for you.')); router.back(); }
    catch (e: any) { Alert.alert('', e.message); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: s.business }} />
      {Platform.OS === 'web' ? React.createElement('iframe', { src: uri, style: { flex: 1, border: 0, width: '100%', height: '100%', background: '#fff' } }) : <WebView source={{ uri }} style={{ flex: 1 }} startInLoadingState />}
      <View style={{ padding: 12, paddingBottom: 12 + ins.bottom, gap: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line }}>
        {!s.public_url ? <JudgeBox j={s.judge} judging={s.judging} onRecheck={l ? () => req('POST', `/api/judge/demo/${l.id}`).then(refresh).catch(() => {}) : undefined} /> : null}
        <Row gap={8}>
          {!s.public_url && l ? <Btn style={{ flex: 1 }} kind="primary" icon={<Check size={18} color="#fff" />} label={t('Looks good: put it online')} busy={busy} onPress={approve} /> : null}
          {s.public_url ? <Btn style={{ flex: 1 }} kind="outline" icon={<ExternalLink size={17} color={C.ink} />} label={t('Live link')} onPress={() => Linking.openURL(s.public_url)} /> : null}
          {l ? <Btn kind="ghost" label={t('Details')} onPress={() => router.push(`/lead/${l.id}`)} /> : null}
        </Row>
      </View>
    </View>
  );
}
