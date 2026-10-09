// The Judge's verdict on a demo or a message: score, risk, why, and its fixed version.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Scale } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C, tone } from '@/lib/theme';
import { Badge, Btn, Row, T } from './ui';

export function JudgeBox({ j, judging, onUseFix, onRecheck }: { j?: any; judging?: boolean; onUseFix?: () => void; onRecheck?: () => void }) {
  const { t } = useApi();
  const [open, setOpen] = useState(false);
  if (judging) {
    return (
      <Row style={{ backgroundColor: C.blueSoft, borderRadius: 12, padding: 12, alignItems: 'flex-start' }}>
        <ActivityIndicator color={C.blue} />
        <View style={{ flex: 1 }}><T w={800} size={14}>{t('The Judge is checking this…')}</T><T size={13} color={C.muted}>{t('An independent AI reviewer reads it against what we really know about the business.')}</T></View>
      </Row>
    );
  }
  if (!j) return null;
  const tn = j.passes ? 'good' : j.verdict === 'hold' ? 'bad' : 'warn';
  const c = tone(tn);
  const label = j.passes ? (j.revised ? t('Safe after small fixes') : t('Safe to send')) : t('Held: needs you');
  const risk = t(({ low: 'low risk', medium: 'medium risk', high: 'high risk' } as any)[j.risk] || j.risk);
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 12, padding: 12, gap: 8 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Scale size={16} color={c.fg} /></View>
        <View style={{ flex: 1, gap: 4 }}>
          <T w={800} size={14.5}>{`${t('Judge')}: ${label}`}</T>
          <Badge label={`${j.score}/100 · ${risk}`} t={tn} />
          {j.summary ? <T size={14} color={C.ink2}>{j.summary}</T> : null}
        </View>
      </Row>
      {j.reasons?.length ? (
        <Pressable onPress={() => setOpen(!open)}><T w={700} size={13.5} color={C.blue}>{`${open ? '▾' : '▸'} ${t('Why')}`}</T></Pressable>
      ) : null}
      {open ? j.reasons.map((r: string, i: number) => <T key={i} size={13.5} color={C.ink2}>{`• ${r}`}</T>) : null}
      <Row wrap gap={8}>
        {j.revised && onUseFix ? <Btn small kind="outline" label={t("Use the Judge's version")} onPress={onUseFix} /> : null}
        {onRecheck ? <Btn small kind="ghost" label={t('Check again')} onPress={onRecheck} /> : null}
      </Row>
    </View>
  );
}
