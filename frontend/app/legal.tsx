import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import * as info from '@/lib/appInfo';
import { PRIVACY, TERMS, fillPlaceholders } from '@/lib/legal';
import { Palette, useStyles } from '@/lib/theme';

const values = {
  APP_NAME: info.APP_NAME,
  OWNER_NAME: info.OWNER_NAME,
  SUPPORT_EMAIL: info.SUPPORT_EMAIL,
  DATA_REGION: info.DATA_REGION,
  EMAIL_PROVIDER: info.EMAIL_PROVIDER,
  BACKUP_DAYS: info.BACKUP_DAYS,
  GOVERNING_LAW: info.GOVERNING_LAW,
  POLICY_UPDATED: info.POLICY_UPDATED,
};

// /legal?doc=privacy  or  /legal?doc=terms. Reachable signed out (linked from the signup screen).
export default function LegalScreen() {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const d = doc === 'terms' ? TERMS : PRIVACY;
  const fill = (t: string) => fillPlaceholders(t, values);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <ThemedText style={styles.title}>{d.title}</ThemedText>
        {d.sections.map(s => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading}>{s.heading}</Text>
            {s.body.map((p, i) =>
              p.startsWith('- ') ? (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={[styles.body, { flex: 1 }]}>{fill(p.slice(2))}</Text>
                </View>
              ) : (
                <Text key={i} style={styles.body}>{fill(p)}</Text>
              )
            )}
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: colors.muted, marginBottom: 12, fontSize: 14 },
  title: { fontSize: 28, color: colors.heading, fontWeight: '700', marginBottom: 16 },
  section: { marginBottom: 20 },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 24, marginBottom: 8 },
  body: { color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: colors.accentText, fontSize: 14, lineHeight: 22 },
});
