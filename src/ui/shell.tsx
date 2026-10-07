import type { ReactNode } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? { background: '#0b1220', card: '#142033', text: '#f1f5f9', muted: '#bac7d9', accent: '#5eead4', border: '#334155' }
    : { background: '#f4f7fb', card: '#ffffff', text: '#172033', muted: '#526277', accent: '#0f766e', border: '#d5dfeb' };
}
export function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const colors = usePalette();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', gap: 20 }}>
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>DEVQUIZ / ENGLISH FIRST</Text>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 30, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 24 }}>{subtitle}</Text>
        </View>
        {children}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
export function Grid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{children}</View>;
}
export function Card({ title, children }: { title: string; children: ReactNode }) {
  const colors = usePalette();
  const { width, fontScale } = useWindowDimensions();
  const cardWidth = width >= 768 && fontScale < 1.4 ? '48%' : '100%';
  return <View style={{ width: cardWidth, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 20, gap: 12, backgroundColor: colors.card }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 19, fontWeight: '600' }}>{title}</Text>
    {children}
  </View>;
}
export function Copy({ children }: { children: ReactNode }) {
  const colors = usePalette();
  return <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 24 }}>{children}</Text>;
}
export function EmptyState({ title, detail }: { title: string; detail: string }) {
  const colors = usePalette();
  return <View style={{ padding: 24, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.card, gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '600' }}>{title}</Text>
    <Copy>{detail}</Copy>
  </View>;
}
type Destination = '/(tabs)/learn' | '/(tabs)/practice' | '/(tabs)/exams' | '/(tabs)/progress';
export function Action({ label, href }: { label: string; href: Destination }) {
  const colors = usePalette();
  return <Link href={href} asChild><Pressable accessibilityRole="link" accessibilityLabel={label} style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, opacity: pressed ? 0.65 : 1 })}>
    <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
  </Pressable></Link>;
}
