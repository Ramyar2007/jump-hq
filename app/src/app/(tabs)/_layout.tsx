import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home, Users, Monitor, MessageSquare, Settings } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { C } from '@/lib/theme';
import { useFont, useRtl } from '@/components/ui';

export default function TabsLayout() {
  const { t, data } = useApi();
  const font = useFont();
  const rtl = useRtl();
  const msgs = data ? data.approvals.filter((a) => a.status === 'pending' || (a.status === 'approved' && ['email', 'whatsapp'].includes(a.type))).length : 0;
  const demos = data ? data.leads.filter((l) => l.stage === 'demo_built' && data.sites.some((s) => (s.lead_id === l.id || s.slug === l.demo?.slug) && !s.public_url)).length : 0;
  const sleep = data?.mode === 'sleep';
  const tabs = [
    ['index', t('Home'), Home, 0],
    ['businesses', t('Businesses'), Users, 0],
    ['demos', t('Demos'), Monitor, demos],
    ['messages', t('Messages'), MessageSquare, msgs],
    ['settings', t('Settings'), Settings, 0],
  ] as const;
  const order = rtl ? [...tabs].reverse() : tabs;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: sleep ? C.night : C.navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: font(800), fontSize: 18 },
        headerTitleAlign: rtl ? 'center' : 'left',
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.line, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font(700), fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: C.accent, fontSize: 11 },
      }}>
      {order.map(([name, title, Icon, n]) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <View><Icon color={color} size={22} /></View>, tabBarBadge: n ? n : undefined }} />
      ))}
    </Tabs>
  );
}
