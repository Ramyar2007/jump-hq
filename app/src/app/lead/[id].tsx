import React, { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Eye, Hammer, Reply, X } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { siteOf, statusOf, workingOn } from '@/lib/logic';
import { Badge, Btn, Card, Empty, Field, H, Ring, Row, Screen, T, ago } from '@/components/ui';

export default function LeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, t, req, refresh } = useApi();
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [reply, setReply] = useState('');
  const l = data?.leads.find((x) => x.id === id);
  if (!data || !l) return <Screen><Empty title={t('Loading…')} /></Screen>;
  const st = statusOf(data, l);
  const site = siteOf(data, l);
  const o = l.opportunity, p = l.profile, plan = l.plan;
  const q = data.config.qualify;
  const busyRun = workingOn(data, l);
  const run = async (key: string, fn: () => Promise<any>, done?: string) => {
    setBusy(key);
    try { await fn(); await refresh(); if (done) Alert.alert('', done); }
    catch (e: any) { Alert.alert('', e.message); }
    finally { setBusy(''); }
  };
  const link = (href: string | undefined, label: string) => (href ? <Pressable key={label} onPress={() => Linking.openURL(href)} style={{ backgroundColor: C.sunk, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 }}><T w={600} size={13} color={C.ink2}>{label}</T></Pressable> : null);
  return (
    <Screen>
      <Stack.Screen options={{ title: l.business }} />
      <Card>
        <Row gap={14}>
          <Ring score={o?.score} size={64} threshold={q.threshold} hold={q.hold} />
          <View style={{ flex: 1, gap: 4 }}>
            <H size={20}>{l.business}</H>
            {l.business_local ? <T color={C.muted}>{l.business_local}</T> : null}
            <T size={13} color={C.muted}>{[l.niche, [l.area, l.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</T>
            <Badge label={st.text} t={st.tone} />
          </View>
        </Row>
        <Row wrap gap={8}>
          {link(l.website, t('Website'))}{link(l.socials?.instagram, 'Instagram')}{link(l.socials?.facebook, 'Facebook')}{link(l.maps_url, 'Map')}
          {l.phone ? link(`tel:${l.phone}`, l.phone) : null}
        </Row>
      </Card>

      {!busyRun ? (
        <Card>
          {site ? <Btn kind={!site.public_url ? 'primary' : 'outline'} icon={<Eye size={18} color={!site.public_url ? '#fff' : C.ink} />} label={site.public_url ? t('Preview') : t('Review demo')} onPress={() => router.push(`/demo/${site.slug}`)} /> : null}
          {!site && ['qualified', 'planned', 'approved', 'hold', 'skipped', 'profiled'].includes(l.stage) ? <Btn kind={['approved', 'hold'].includes(l.stage) ? 'primary' : 'outline'} icon={<Hammer size={17} color={['approved', 'hold'].includes(l.stage) ? '#fff' : C.ink} />} label={['approved', 'hold'].includes(l.stage) ? t('Build demo') : t('Build a demo anyway')} busy={busy === 'build'} onPress={() => run('build', () => req('POST', `/api/leads/${l.id}/build`))} /> : null}
          {['sent', 'replied'].includes(l.stage) ? (
            <>
              <Field label={t('They replied')} placeholder={t('Paste their message here')} value={reply} onChangeText={setReply} multiline style={{ minHeight: 110 } as any} />
              <Btn kind="dark" icon={<Reply size={17} color="#fff" />} label={t('Write my answer')} busy={busy === 'reply'} onPress={() => (reply.trim() ? run('reply', () => req('POST', '/api/runs', { agent: 'closer', input: { lead_id: l.id, reply_text: reply } }).then(() => setReply('')), t('The Closer is writing your answer.')) : Alert.alert('', t('Paste their reply first.')))} />
              <Btn icon={<Check size={17} color={C.ink} />} label={t('Mark as client')} busy={busy === 'won'} onPress={() => run('won', () => req('PATCH', `/api/leads/${l.id}`, { stage: 'won', note: 'Became a client' }), t('Congratulations, a new client.'))} />
            </>
          ) : null}
          {!['skipped', 'lost', 'won'].includes(l.stage) ? <Btn kind="ghost" icon={<X size={17} color={C.ink2} />} label={t('Not a fit')} busy={busy === 'skip'} onPress={() => run('skip', () => req('PATCH', `/api/leads/${l.id}`, { stage: 'skipped', note: 'Marked as not a fit by you' }), t('Moved to "Not a fit".'))} /> : null}
        </Card>
      ) : <Card style={{ backgroundColor: C.blueSoft }}><T w={700} color={C.blue}>{st.text}</T></Card>}

      {o ? (
        <Card>
          <H>{t('Recommendation')}</H>
          {o.summary ? <T color={C.ink2}>{o.summary}</T> : null}
          {o.reasons?.length ? <><T w={800} size={12.5} color={C.faint}>{t('Why')}</T>{o.reasons.map((r: any, i: number) => <Row key={i} style={{ alignItems: 'flex-start' }} gap={8}><Check size={16} color={C.good} /><View style={{ flex: 1 }}><T size={14}>{r.point || r}</T>{r.evidence ? <T size={12.5} color={C.muted}>{r.evidence}</T> : null}</View></Row>)}</> : null}
          {o.risks?.length ? <><T w={800} size={12.5} color={C.faint}>{t('Risks')}</T>{o.risks.map((r: string, i: number) => <T key={i} size={14} color={C.warn}>{`• ${r}`}</T>)}</> : null}
        </Card>
      ) : null}

      {plan ? (
        <Card>
          <H>{t("What we'll build")}</H>
          <T w={700}>{plan.product}</T>
          {plan.why ? <T color={C.muted} size={14}>{plan.why}</T> : null}
          <Row wrap gap={6}>{(plan.must_have || []).map((x: string) => <View key={x} style={{ backgroundColor: C.sunk, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}><T size={13} w={600} color={C.ink2}>{x}</T></View>)}</Row>
        </Card>
      ) : null}

      {p ? (
        <Card>
          <H>{t('Public profile')}</H>
          {p.rating ? <T size={14}>{`${t('Rating')}: ${p.rating}${p.review_count ? ` (${p.review_count})` : ''}`}</T> : null}
          {p.hours ? <T size={14}>{`${t('Hours')}: ${p.hours}`}</T> : null}
          {p.address ? <T size={14}>{`${t('Address')}: ${p.address}`}</T> : null}
          {p.missing?.length ? <><T w={800} size={12.5} color={C.faint}>{t('Missing today')}</T><Row wrap gap={6}>{p.missing.map((x: string) => <View key={x} style={{ backgroundColor: C.sunk, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}><T size={13} w={600} color={C.ink2}>{x}</T></View>)}</Row></> : null}
        </Card>
      ) : null}

      <Card>
        <H>{t('History')}</H>
        {(l.history || []).slice().reverse().slice(0, 12).map((h: any, i: number) => <Row key={i} gap={10} style={{ alignItems: 'flex-start' }}><T size={12.5} color={C.faint} style={{ width: 86 }}>{ago(h.at, t)}</T><T size={13.5} style={{ flex: 1 }}>{h.text}</T></Row>)}
      </Card>
    </Screen>
  );
}
