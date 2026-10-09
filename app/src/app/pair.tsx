// First screen: connect this phone to the owner's Jump HQ by scanning the code on the computer.
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QrCode, KeyRound } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { LANGS, setLang } from '@/lib/i18n';
import { C } from '@/lib/theme';
import { Btn, Card, Field, Row, T } from '@/components/ui';

function parse(s: string) {
  try {
    const u = new URL(s.replace(/^jumphq:\/\//, 'https://x/'));
    return { url: decodeURIComponent(u.searchParams.get('u') || ''), code: u.searchParams.get('c') || '' };
  } catch { return null; }
}

export default function Pair() {
  const { t, pair, pairWithPassword } = useApi();
  const ins = useSafeAreaInsets();
  const [perm, ask] = useCameraPermissions();
  const [scan, setScan] = useState(false);
  const [manual, setManual] = useState(false);
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const done = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { Alert.alert('', e.message); setScan(false); } finally { setBusy(false); }
  };
  const onScan = ({ data }: { data: string }) => {
    if (busy) return;
    const p = parse(data);
    if (!p?.url || !p.code) return;
    setScan(false);
    done(() => pair(p.url, p.code));
  };
  const startScan = async () => {
    if (!perm?.granted) { const r = await ask(); if (!r.granted) return Alert.alert('', t('Allow the camera to scan the code, or type the code instead.')); }
    setScan(true);
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.navy }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: ins.top + 30, paddingBottom: ins.bottom + 30, gap: 18, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Row gap={12}>
          <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}><T w={800} size={22} color="#fff" center>J</T></View>
          <View><T w={800} size={22} color="#fff">Jump HQ</T><T size={13} color="#8fa0c0">{t('Your AI team, in your pocket')}</T></View>
        </Row>
        <T w={800} size={28} color="#fff">{t('Find local businesses that need a website, and win them as clients.')}</T>
        <Row gap={8}>
          {LANGS.map((l) => <Pressable key={l.code} onPress={() => { setLang(l.code); force((x) => x + 1); }} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center' }}><T w={700} color="#fff" center>{l.name}</T></Pressable>)}
        </Row>
        {scan ? (
          <View style={{ borderRadius: 18, overflow: 'hidden', aspectRatio: 1, backgroundColor: '#000' }}>
            <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
          </View>
        ) : null}
        <Card>
          <T w={800} size={18}>{t('Connect to your computer')}</T>
          <T size={14} color={C.muted}>{t('On the computer open Jump HQ → Settings → Phone app → Show pairing code.')}</T>
          {!scan ? <Btn kind="primary" icon={<QrCode size={19} color="#fff" />} label={t('Scan pairing code')} busy={busy} onPress={startScan} /> : <Btn label={t('Cancel')} onPress={() => setScan(false)} />}
          {!manual ? <Btn kind="ghost" icon={<KeyRound size={17} color={C.ink2} />} label={t('Type the code instead')} onPress={() => setManual(true)} /> : (
            <>
              <Field label={t('Link shown under the code')} placeholder="https://….trycloudflare.com" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{ textAlign: 'left' } as any} />
              <Field label={t('Pairing code')} placeholder="9B4D4224" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" style={{ textAlign: 'left', letterSpacing: 3 } as any} />
              <Btn kind="dark" label={t('Connect')} busy={busy} onPress={() => (url && code ? done(() => pair(url, code)) : Alert.alert('', t('Type the link and the code.')))} />
              <T size={13} color={C.muted}>{t('Or use your dashboard password with the link:')}</T>
              <Field label={t('Password')} value={password} onChangeText={setPassword} secureTextEntry />
              <Btn label={t('Connect with password')} busy={busy} onPress={() => (url && password ? done(() => pairWithPassword(url, password)) : Alert.alert('', t('Type the link and the password.')))} />
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
