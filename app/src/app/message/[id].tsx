import React, { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Send, Trash2 } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { leadOf, mainText } from '@/lib/logic';
import { Badge, Btn, Card, Empty, Field, Row, Screen, T, ago } from '@/components/ui';
import { JudgeBox } from '@/components/Judge';

export default function MessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, t, req, refresh } = useApi();
  const router = useRouter();
  const a = data?.approvals.find((x) => x.id === id);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState('');
  const [loaded, setLoaded] = useState('');
  useEffect(() => { if (a && loaded !== a.id) { setTo(a.to || ''); setSubject(a.subject || ''); setBody(a.body || ''); setLoaded(a.id); } }, [a, loaded]);
  if (!data || !a) return <Screen><Empty title={t('Loading…')} /></Screen>;
  const l = leadOf(data, a.lead_id);
  const wa = a.type === 'whatsapp';
  const smtp = data.config.outreach.sender === 'smtp' && data.config.smtp.user;
  const run = async (key: string, fn: () => Promise<any>, done?: string, back?: boolean) => {
    setBusy(key);
    try { await fn(); await refresh(); if (done) Alert.alert('', done); if (back) router.back(); }
    catch (e: any) { Alert.alert('', e.message); }
    finally { setBusy(''); }
  };
  const decide = (decision: string, extra: any = {}) => req('POST', `/api/approvals/${a.id}/decide`, { decision, to, subject, body, ...extra });
  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T w={800} size={19} style={{ flex: 1 }}>{l?.business || a.title}</T>
          <Badge label={wa ? 'WhatsApp' : t('Email')} t={wa ? 'good' : 'info'} />
        </Row>
        <T size={13} color={C.muted}>{`${t('written')} ${ago(a.created, t)}`}</T>
        <JudgeBox j={a.judge} judging={a.judging}
          onUseFix={a.status === 'pending' && a.judge?.revised ? () => { setBody(a.judge.revised.body); if (a.judge.revised.subject) setSubject(a.judge.revised.subject); Alert.alert('', t("The Judge's version is in the box. Read it, then approve.")); } : undefined}
          onRecheck={a.status === 'pending' ? () => run('judge', () => req('POST', `/api/judge/message/${a.id}`), t('The Judge is checking it again.')) : undefined} />
      </Card>

      {a.status === 'pending' ? (
        <Card>
          <Field label={t('Send to')} value={to} onChangeText={setTo} autoCapitalize="none" style={{ textAlign: 'left', writingDirection: 'ltr' } as any} />
          {wa ? null : <Field label={t('Subject')} value={subject} onChangeText={setSubject} />}
          <Field label={t('Message')} value={body} onChangeText={setBody} multiline style={{ minHeight: 220, textAlign: 'auto' } as any} />
          {wa ? <T size={12.5} color={C.muted}>{`(${t('the English part below the line is only for you; it is not sent')})`}</T> : null}
          <Btn kind="primary" icon={<Check size={18} color="#fff" />} label={`${t('Approve')}${smtp && !wa ? ` ${t('and send')}` : ''}`} busy={busy === 'ok'} onPress={() => run('ok', () => decide('approve'), t('Approved. It is in "Ready to send".'))} />
          <Row gap={8}>
            <Btn style={{ flex: 1 }} label={t('Save changes')} busy={busy === 'save'} onPress={() => run('save', () => decide('save'), t('Saved.'))} />
            <Btn style={{ flex: 1 }} kind="danger" icon={<Trash2 size={16} color={C.bad} />} label={t('Discard')} busy={busy === 'no'} onPress={() => Alert.alert('', t('Discard this message?'), [{ text: t('Cancel'), style: 'cancel' }, { text: t('Discard'), style: 'destructive', onPress: () => run('no', () => req('POST', `/api/approvals/${a.id}/decide`, { decision: 'reject' }), t('Discarded.'), true) }])} />
          </Row>
        </Card>
      ) : (
        <Card>
          <View style={{ backgroundColor: wa ? '#e9f8ef' : C.surface2, borderRadius: 12, padding: 14 }}>
            <T size={14.5} style={{ writingDirection: 'auto' as any }}>{wa ? mainText(a.body) : a.body}</T>
          </View>
          <T size={13} color={C.muted} ltr>{a.to}</T>
          {a.status === 'approved' ? (
            <>
              {wa ? (a.wa_link ? <Btn kind="primary" icon={<Send size={18} color="#fff" />} label={t('Open in WhatsApp')} onPress={() => Linking.openURL(a.wa_link)} /> : <Badge label={t('No WhatsApp number: copy the text and send it yourself')} t="warn" />)
                : <Btn kind="primary" icon={<Send size={18} color="#fff" />} label={t('Open in email')} onPress={() => Linking.openURL(`mailto:${a.to}?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(a.body)}`)} />}
              <Btn icon={<Check size={18} color={C.ink} />} label={t('I sent it')} busy={busy === 'sent'} onPress={() => run('sent', () => req('POST', `/api/approvals/${a.id}/sent`), t('Marked as sent. Tell us when they reply.'), true)} />
              <T size={13} color={C.muted}>{wa ? t('WhatsApp opens with the message ready. Press send there, then come back and press "I sent it".') : t('Send it from your mailbox, then press "I sent it".')}</T>
            </>
          ) : a.status === 'sent' ? <Badge label={`${t('Sent')} ${ago(a.sent_at, t)}`} t="good" /> : <Badge label={t('Discarded')} />}
        </Card>
      )}
    </Screen>
  );
}
