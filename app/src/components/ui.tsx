// Small building blocks, all language-aware (Kurdish and Arabic flip to right-to-left).
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextProps, type ViewStyle, type TextInputProps, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, shadow, tone } from '@/lib/theme';
import { useApi } from '@/lib/api';

export const useRtl = () => { const { lang } = useApi(); return lang === 'ckb' || lang === 'ar'; };
export const useFont = () => {
  const rtl = useRtl();
  return (w: 400 | 500 | 600 | 700 | 800 = 400) => (rtl
    ? { 400: 'NotoSansArabic_400Regular', 500: 'NotoSansArabic_500Medium', 600: 'NotoSansArabic_600SemiBold', 700: 'NotoSansArabic_700Bold', 800: 'NotoSansArabic_800ExtraBold' }[w]
    : { 400: 'PlusJakartaSans_400Regular', 500: 'PlusJakartaSans_500Medium', 600: 'PlusJakartaSans_600SemiBold', 700: 'PlusJakartaSans_700Bold', 800: 'PlusJakartaSans_800ExtraBold' }[w]);
};

// Text that follows the language direction. "ltr" forces left-to-right (emails, numbers, links).
export function T({ w = 400, size = 15, color = C.ink, style, ltr, center, ...p }: TextProps & { w?: 400 | 500 | 600 | 700 | 800; size?: number; color?: string; ltr?: boolean; center?: boolean }) {
  const rtl = useRtl();
  const font = useFont();
  return <Text {...p} style={[{ fontFamily: font(w), fontSize: size, color, lineHeight: Math.round(size * (rtl ? 1.65 : 1.45)), textAlign: center ? 'center' : ltr ? 'left' : rtl ? 'right' : 'left', writingDirection: ltr ? 'ltr' : rtl ? 'rtl' : 'ltr' }, style]} />;
}

export const Row = ({ style, children, gap = 10, wrap }: { style?: ViewStyle; children: React.ReactNode; gap?: number; wrap?: boolean }) => {
  const rtl = useRtl();
  return <View style={[{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
};

export function Screen({ children, onRefresh, refreshing = false, pad = true }: { children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean; pad?: boolean }) {
  const ins = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: pad ? 16 : 0, paddingBottom: 40 + ins.bottom, gap: 14 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} /> : undefined}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export const Card = ({ children, style, dark }: { children: React.ReactNode; style?: ViewStyle; dark?: boolean }) => (
  <View style={[{ backgroundColor: dark ? C.navy : C.surface, borderRadius: R.card, padding: 16, gap: 10 }, shadow, style]}>{children}</View>
);

export function Btn({ label, onPress, kind = 'plain', icon, busy, small, disabled, style }: { label: string; onPress?: () => void; kind?: 'primary' | 'dark' | 'plain' | 'outline' | 'ghost' | 'danger'; icon?: React.ReactNode; busy?: boolean; small?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const bg = { primary: C.accent, dark: C.navy, plain: C.sunk, outline: C.surface, ghost: 'transparent', danger: C.badSoft }[kind];
  const fg = { primary: '#fff', dark: '#fff', plain: C.ink, outline: C.ink, ghost: C.ink2, danger: C.bad }[kind];
  const rtl = useRtl();
  return (
    <Pressable onPress={busy || disabled ? undefined : onPress} style={({ pressed }) => [{ height: small ? 38 : 48, paddingHorizontal: small ? 13 : 18, borderRadius: R.sm, backgroundColor: bg, flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      kind === 'outline' && { borderWidth: 1.5, borderColor: C.line2 }, kind === 'primary' && { shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, style]}>
      {busy ? <ActivityIndicator color={fg} size="small" /> : icon}
      <T w={700} size={small ? 13.5 : 15} color={fg}>{label}</T>
    </Pressable>
  );
}

export const Badge = ({ label, t: tn }: { label: string; t?: string }) => {
  const c = tone(tn);
  return <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}><T w={700} size={12} color={c.fg}>{label}</T></View>;
};

export function Ring({ score, size = 44, threshold = 70, hold = 50 }: { score?: number | null; size?: number; threshold?: number; hold?: number }) {
  const has = score != null;
  const col = !has ? C.faint : score! >= threshold ? C.good : score! >= hold ? '#f0a020' : '#d4574c';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 4, borderColor: has ? col : C.sunk, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface }}>
      <T w={800} size={size * 0.32} color={has ? C.ink : C.faint} center ltr>{has ? String(score) : '–'}</T>
    </View>
  );
}

export function Field({ label, ...p }: TextInputProps & { label?: string }) {
  const rtl = useRtl();
  const font = useFont();
  return (
    <View style={{ gap: 6 }}>
      {label ? <T w={700} size={13.5} color={C.ink2}>{label}</T> : null}
      <TextInput placeholderTextColor={C.faint} {...p} style={[{ borderWidth: 1.5, borderColor: C.line2, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: p.multiline ? 10 : 0, minHeight: 46, fontSize: 15, color: C.ink, backgroundColor: C.surface, fontFamily: font(500), textAlign: rtl ? 'right' : 'left', textAlignVertical: p.multiline ? 'top' : 'center' }, p.style as any]} />
    </View>
  );
}

export function Seg<K extends string>({ items, value, onChange }: { items: [K, string, number?][]; value: K; onChange: (k: K) => void }) {
  const rtl = useRtl();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: rtl ? 'row-reverse' : 'row', padding: 4, gap: 2, backgroundColor: '#e6ebf3', borderRadius: 12, flexGrow: 1 }}>
      {items.map(([k, label, n]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={[{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9, flexDirection: rtl ? 'row-reverse' : 'row', gap: 6, alignItems: 'center' }, value === k && { backgroundColor: C.surface, ...shadow }]}>
          <T w={700} size={13.5} color={value === k ? C.ink : C.ink2}>{label}</T>
          {n != null ? <T w={600} size={12.5} color={C.faint}>{String(n)}</T> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

export const Empty = ({ title, sub }: { title: string; sub?: string }) => (
  <View style={{ paddingVertical: 34, paddingHorizontal: 20, alignItems: 'center', gap: 4 }}>
    <T w={700} size={16} center>{title}</T>
    {sub ? <T color={C.muted} center>{sub}</T> : null}
  </View>
);

export const H = ({ children, size = 17 }: { children: React.ReactNode; size?: number }) => <T w={800} size={size}>{children}</T>;

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.line }} />;

export const ago = (iso?: string, t: (s: string) => string = (s) => s) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 50) return t('just now');
  if (s < 3600) return `${Math.round(s / 60)} ${t('min ago')}`;
  if (s < 86400) return `${Math.round(s / 3600)} ${t('h ago')}`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
};
export const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
