// "Ask your team": write what you want in plain words; the Team lead turns it into work.
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Send } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { Btn, Card, Field, H, Row, T, ago, useRtl } from './ui';

const EXAMPLES = ['Find 10 dentists in Erbil and build demos for the best 2', 'Which businesses are waiting for me?', 'What did the team do today?'];
const plain = (s: string) => String(s || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*[-*] /gm, '• ');

export function AskTeam() {
  const { data, t, req, refresh } = useApi();
  const rtl = useRtl();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const send = async () => {
    if (!text.trim()) return Alert.alert('', t('Write what the team should do.'));
    setBusy(true);
    try { await req('POST', '/api/ask', { text: text.trim() }); setText(''); await refresh(); Alert.alert('', t('The Team lead is on it. The answer shows up here.')); }
    catch (e: any) { Alert.alert('', e.message); }
    finally { setBusy(false); }
  };
  const runs = data.runs.filter((r: any) => r.agent === 'lead').slice(0, 3);
  return (
    <Card>
      <H size={19}>{t('Ask your team')}</H>
      <Field value={text} onChangeText={setText} placeholder={t('Tell the team what to do, in your own words…')} multiline style={{ minHeight: 76, textAlignVertical: 'top', paddingTop: 12 } as any} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: rtl ? 'row-reverse' : 'row' }}>
        {EXAMPLES.map((x) => (
          <Pressable key={x} onPress={() => setText(t(x))} style={{ paddingHorizontal: 12, height: 36, borderRadius: 10, justifyContent: 'center', backgroundColor: C.sunk }}>
            <T w={600} size={13} color={C.ink2}>{t(x)}</T>
          </Pressable>
        ))}
      </ScrollView>
      <Btn kind="primary" label={t('Send to the team')} icon={<Send size={18} color="#fff" />} busy={busy} onPress={send} />
      {runs.map((r: any) => (
        <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}><T w={700} size={13.5} numberOfLines={2} style={{ flex: 1 }}>{r.input?.text || ''}</T><T size={12} color={C.faint}>{ago(r.created, t)}</T></Row>
          <T size={13.5} color={r.status === 'failed' ? C.bad : C.ink2} numberOfLines={8}>
            {r.status === 'done' ? plain(r.summary || t('Finished.')) : r.status === 'running' ? t('Working…') : r.status === 'queued' ? t('Waiting for a free spot in the team…') : r.status === 'failed' ? t('Stopped with a problem.') : t('Stopped.')}
          </T>
        </View>
      ))}
    </Card>
  );
}
