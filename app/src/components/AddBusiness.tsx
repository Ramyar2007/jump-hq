// "I know a business": paste its link and the Builder makes its demo now.
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Hammer, Plus } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { Btn, Card, Field, H, T } from './ui';

export function AddBusiness() {
  const { data, t, req, refresh } = useApi();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState('');
  if (!data) return null;
  const m = data.config.markets[data.config.market_id];
  const send = async (build: boolean) => {
    if (!name.trim()) return Alert.alert('', t('Type the name of the business.'));
    setBusy(build ? 'b' : 'c');
    try {
      await req('POST', '/api/leads', { market_id: m.id, business: name, link, phone, city: m.cities[0], niche: '', build });
      setName(''); setLink(''); setPhone(''); setOpen(false);
      await refresh();
      Alert.alert('', build ? t('The Builder is making its demo. It shows up in Demos in a minute or two.') : t('Added. The team is checking it.'));
    } catch (e: any) { Alert.alert('', e.message); }
    finally { setBusy(''); }
  };
  if (!open) return <Btn kind="outline" icon={<Plus size={18} color={C.ink} />} label={t('Add a business you know')} onPress={() => setOpen(true)} />;
  return (
    <Card>
      <H>{t('Add a business you know')}</H>
      <T size={13.5} color={C.muted}>{t('Paste its Instagram, Facebook, Google Maps or website link. The Builder makes its free sample in a minute or two.')}</T>
      <Field label={t('Business name')} value={name} onChangeText={setName} />
      <Field label={t('Link (Instagram, Facebook, Maps or website)')} value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="https://instagram.com/…" style={{ textAlign: 'left' } as any} />
      <Field label={t('Phone or WhatsApp (optional)')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={{ textAlign: 'left' } as any} />
      <Btn kind="primary" icon={<Hammer size={17} color="#fff" />} label={t('Build its demo now')} busy={busy === 'b'} onPress={() => send(true)} />
      <Btn kind="outline" label={t('Let the team check it first')} busy={busy === 'c'} onPress={() => send(false)} />
      <Btn kind="ghost" label={t('Cancel')} onPress={() => setOpen(false)} />
    </Card>
  );
}
