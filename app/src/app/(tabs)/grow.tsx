import React, { useState } from 'react';
import { Alert, Image, Share, View } from 'react-native';
import { Check, Play, Send, Share2, Sparkles, Trash2 } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { JudgeBox } from '@/components/Judge';
import { Badge, Btn, Card, Empty, Field, Row, Screen, Seg, T } from '@/components/ui';

type Tab = 'pending' | 'approved' | 'posted' | 'discarded';
const TABS: [Tab, string, (p: any) => boolean][] = [
  ['pending', 'To approve', (p) => ['making', 'judging', 'pending', 'failed'].includes(p.status)],
  ['approved', 'Scheduled', (p) => ['approved', 'posting', 'ready'].includes(p.status)],
  ['posted', 'Posted', (p) => p.status === 'posted'],
  ['discarded', 'Discarded', (p) => p.status === 'discarded'],
];
type Mix = 'mix' | 'images' | 'videos';
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function Grow() {
  const { data, t, req, refresh, conn } = useApi();
  const [tab, setTab] = useState<Tab>('pending');
  const [brief, setBrief] = useState('');
  const [mix, setMix] = useState<Mix>('mix');
  const [count, setCount] = useState<'3' | '5' | '7'>('5');
  const [busy, setBusy] = useState('');
  const [pulling, setPulling] = useState(false);
  if (!data) return <Screen><Empty title={t('Loading…')} /></Screen>;
  const posts: any[] = (data as any).posts || [];
  const pl = (data as any).platforms || {};
  const making = data.runs.some((r: any) => r.agent === 'creator' && ['running', 'queued'].includes(r.status));
  const cur = TABS.find((x) => x[0] === tab)!;
  const list = posts.filter(cur[2]);
  const media = (path: string) => ({ uri: `${conn?.url}/p/${path}`, headers: { Authorization: `Bearer ${conn?.token}` } });

  const act = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    try { await fn(); await refresh(); } catch (e: any) { Alert.alert('', e.message); } finally { setBusy(''); }
  };
  const make = () => act('make', async () => {
    await req('POST', '/api/posts/make', { brief, count: Number(count), mix });
    setBrief('');
    Alert.alert('', t('The Content creator is designing your posts. They show up here in a few minutes.'));
  });
  const chip = (on: any, name: string) => <Badge key={name} label={`${name}${on === true ? '' : on === 'tap' ? ` · ${t('one tap')}` : ` · ${t('not connected')}`}`} t={on === true ? 'good' : ''} />;

  return (
    <Screen onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} refreshing={pulling}>
      <T color={C.muted}>{t('Your own posts and short videos, made by the team, checked by the Judge, posted on time.')}</T>
      <Card>
        <Field label={t('What should the posts be about?')} value={brief} onChangeText={setBrief} multiline placeholder={t('e.g. our new AI video ad offer, a before and after, a tip for online shops')} />
        <Seg<Mix> items={[['mix', t('Pictures and videos')], ['images', t('Pictures')], ['videos', t('Videos')]]} value={mix} onChange={setMix} />
        <Seg<'3' | '5' | '7'> items={[['3', `3 ${t('Posts')}`], ['5', `5 ${t('Posts')}`], ['7', `7 ${t('Posts')}`]]} value={count} onChange={setCount} />
        <Btn kind="primary" icon={<Sparkles size={17} color="#fff" />} label={t('Make posts')} busy={busy === 'make'} onPress={make} />
        <Row wrap gap={6}><T size={13} color={C.muted}>{`${t('Posts go to')}:`}</T>{chip(pl.facebook, 'Facebook')}{chip(pl.telegram, 'Telegram')}{chip(pl.instagram, 'Instagram')}{chip(pl.tiktok, 'TikTok')}</Row>
      </Card>
      {making ? <Badge label={t('The Content creator is designing your posts. They show up here in a few minutes.')} t="info" /> : null}
      <Seg<Tab> items={TABS.map(([k, n, fn]) => [k, t(n), posts.filter(fn).length] as [Tab, string, number])} value={tab} onChange={setTab} />
      {list.length ? list.map((p) => {
        const pic = p.format === 'video' ? p.poster : p.media;
        return (
          <Card key={p.id}>
            {pic ? (
              <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: C.surface2 }}>
                <Image source={media(pic)} style={{ width: '100%', aspectRatio: p.format === 'video' ? 9 / 16 : 4 / 5 }} resizeMode="cover" />
                {p.format === 'video' ? <View style={{ position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: '#0008', borderRadius: 40, padding: 14 }}><Play size={28} color="#fff" /></View> : null}
              </View>
            ) : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8} style={{ flex: 1 }}><T w={800} size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{p.title || `#${p.n}`}</T><Badge label={p.format === 'video' ? t('Video') : t('Picture')} t="info" /></Row>
              <T size={12.5} color={C.faint}>{when(p.scheduled_at)}</T>
            </Row>
            {p.status === 'judging' || p.status === 'making' ? <JudgeBox judging /> : ['pending', 'failed'].includes(p.status) ? <JudgeBox j={p.judge} onRecheck={() => act(`j${p.id}`, () => req('POST', `/api/posts/${p.id}/judge`))} /> : p.auto ? <Badge label={t('Approved by the Judge while you slept')} t="good" /> : null}
            {p.error && p.status === 'failed' ? <T size={13} color={C.bad}>{p.error}</T> : null}
            <T size={14} style={{ writingDirection: 'auto' as any }}>{p.caption}</T>
            {p.hashtags?.length ? <T size={13} color={C.muted}>{p.hashtags.join(' ')}</T> : null}
            {p.status === 'posted' ? <Row wrap gap={6}>{Object.entries(p.results || {}).map(([k, r]: any) => <Badge key={k} label={k} t={r.ok ? 'good' : 'bad'} />)}</Row> : null}
            {p.status === 'ready' ? <T size={13} color={C.muted}>{t('No page is connected yet: download it and post it, or connect your pages and it posts itself.')}</T> : null}
            <Row wrap gap={8}>
              {p.status === 'pending' ? <Btn small kind="primary" icon={<Check size={16} color="#fff" />} label={t('Approve')} busy={busy === `a${p.id}`} onPress={() => act(`a${p.id}`, () => req('POST', `/api/posts/${p.id}/approve`, {}))} /> : null}
              {['approved', 'ready', 'pending'].includes(p.status) && p.media ? <Btn small kind={p.status === 'pending' ? 'outline' : 'primary'} icon={<Send size={16} color={p.status === 'pending' ? C.ink : '#fff'} />} label={t('Post now')} busy={busy === `n${p.id}`} onPress={() => act(`n${p.id}`, () => req('POST', `/api/posts/${p.id}/post-now`))} /> : null}
              {p.caption ? <Btn small kind="ghost" icon={<Share2 size={16} color={C.ink} />} label={t('Copy caption')} onPress={() => Share.share({ message: [p.caption, (p.hashtags || []).join(' ')].filter(Boolean).join('\n\n') })} /> : null}
              {!['posted', 'discarded'].includes(p.status) ? <Btn small kind="ghost" icon={<Trash2 size={16} color={C.bad} />} label={t('Discard')} busy={busy === `d${p.id}`} onPress={() => act(`d${p.id}`, () => req('POST', `/api/posts/${p.id}/discard`))} /> : null}
            </Row>
          </Card>
        );
      }) : <Card><Empty title={t('No posts here yet')} sub={tab === 'pending' ? t('Write what the posts should be about and press Make posts.') : undefined} /></Card>}
    </Screen>
  );
}
