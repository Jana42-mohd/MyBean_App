import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { LoadError, friendlyError } from '@/components/LoadError';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { countryName } from '@/lib/countries';
import { EMPTY_PLACE, NearbyParent, Place, Scope, getMyPlace, nearbyParents, placeLabel, requestConnection } from '@/lib/neighbors';
import { Palette, useStyles, useTheme } from '@/lib/theme';

const PAGE = 30;

export default function NeighborsScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [place, setPlace] = useState<Place>(EMPTY_PLACE);
  const [scope, setScope] = useState<Scope>('city');
  const [rows, setRows] = useState<NearbyParent[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState<NearbyParent | null>(null);
  const [intro, setIntro] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (s: Scope, p: Place, append = false, offset = 0) => {
    if (!p.discoverable) { setLoading(false); return; }
    try {
      setError('');
      const list = await nearbyParents(s, offset, PAGE);
      setRows(prev => (append ? [...prev, ...list] : list));
      setMore(list.length === PAGE);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const p = await getMyPlace();
          setPlace(p);
          const s: Scope = p.area.trim() ? 'area' : 'city';
          setScope(s);
          await load(s, p);
        } catch (e) {
          setError(friendlyError(e));
          setLoading(false);
        }
      })();
    }, [load]),
  );

  const changeScope = (s: Scope) => {
    setScope(s);
    setLoading(true);
    load(s, place);
  };

  const send = async () => {
    if (!asking) return;
    setSending(true);
    try {
      await requestConnection(asking.id, intro);
      setAsking(null);
      setIntro('');
      load(scope, place);
      Alert.alert('Request sent', 'They will be notified. You can chat once they accept.');
    } catch (e) {
      Alert.alert('Could not send the request', friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const scopes: { key: Scope; label: string }[] = [
    ...(place.area.trim() ? [{ key: 'area' as Scope, label: place.area.trim() }] : []),
    { key: 'city', label: place.city.trim() || 'City' },
    { key: 'country', label: countryName(place.country) || 'Country' },
  ];

  const status = (r: NearbyParent) =>
    r.connection === 'connected' ? (
      <Pressable style={styles.smallBtn} onPress={() => router.push({ pathname: '/chat', params: { id: r.request_id!, name: r.name } })}><Text style={styles.smallBtnText}>Message</Text></Pressable>
    ) : r.connection === 'sent' ? (
      <Text style={styles.status}>Request sent</Text>
    ) : r.connection === 'received' ? (
      <Pressable style={styles.smallBtn} onPress={() => router.push('/connections')}><Text style={styles.smallBtnText}>Respond</Text></Pressable>
    ) : (
      <Pressable style={styles.smallBtn} onPress={() => { setAsking(r); setIntro(''); }}><Text style={styles.smallBtnText}>Connect</Text></Pressable>
    );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>← Back</Text></Pressable>
        <ThemedText style={styles.title}>Parents near you</ThemedText>
        <Text style={styles.subtitle}>Say hello to parents who chose to be found. Nobody can message you until you accept.</Text>

        <Pressable onPress={() => router.push('/connections')} style={styles.linkRow}><Text style={styles.link}>My connections and requests →</Text></Pressable>

        {!loading && !place.discoverable ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>You are hidden right now</Text>
            <Text style={styles.muted}>You only see other parents once you choose to be visible too. Set your country and city, then switch on "Let nearby parents find me" in Settings.</Text>
            <Pressable style={styles.primary} onPress={() => router.navigate('/(tabs)/settings')}><Text style={styles.primaryText}>Go to Settings</Text></Pressable>
          </View>
        ) : null}

        {place.discoverable ? (
          <>
            <View style={styles.scopes}>
              {scopes.map(s => (
                <Pressable key={s.key} onPress={() => changeScope(s.key)} style={[styles.scope, scope === s.key && styles.scopeActive]}>
                  <Text style={[styles.scopeText, scope === s.key && { color: colors.onAccent, fontWeight: '700' }]} numberOfLines={1}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <LoadError message={error} onRetry={() => load(scope, place)} /> : null}
            {loading ? <ActivityIndicator color={colors.accentText} style={{ marginTop: 24 }} /> : null}
            {!loading && !error && rows.length === 0 ? (
              <Text style={styles.empty}>No one here yet. Try a wider area, or check back soon as more parents join.</Text>
            ) : null}
            {rows.map(r => (
              <View key={r.id} style={styles.person}>
                <Avatar name={r.name} url={r.avatar_url} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{placeLabel(r)}</Text>
                </View>
                {status(r)}
              </View>
            ))}
            {more ? (
              <Pressable style={styles.moreBtn} onPress={() => load(scope, place, true, rows.length)}><Text style={styles.moreText}>Show more</Text></Pressable>
            ) : null}
          </>
        ) : null}
        <Text style={styles.safety}>Stay safe: do not share your address or your baby's full name until you know someone. You can block or report anyone from the chat.</Text>
      </ScrollView>

      <Modal visible={!!asking} transparent animationType="slide" onRequestClose={() => setAsking(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Connect with {asking?.name}</Text>
            <Text style={styles.muted}>Add a short hello (optional). They can accept or decline.</Text>
            <TextInput style={[styles.input, { minHeight: 80 }]} value={intro} onChangeText={setIntro} multiline maxLength={200} placeholder="Hi! My baby is 3 months old too..." placeholderTextColor={colors.muted} />
            <View style={styles.actions}>
              <Pressable onPress={() => setAsking(null)}><Text style={styles.cancel}>Cancel</Text></Pressable>
              <Pressable style={styles.primary} onPress={send} disabled={sending}><Text style={styles.primaryText}>{sending ? 'Sending...' : 'Send request'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: colors.muted, marginBottom: 12, fontSize: 14 },
  title: { fontSize: 28, color: colors.heading, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 12, lineHeight: 20 },
  linkRow: { marginBottom: 16 },
  link: { color: colors.link, fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  primary: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, alignSelf: 'flex-start', marginTop: 6 },
  primaryText: { color: colors.onAccent, fontWeight: '700' },
  scopes: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  scope: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, maxWidth: '100%' },
  scopeActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  scopeText: { color: colors.text, fontSize: 13 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  smallBtn: { backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  smallBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 13 },
  status: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24, lineHeight: 20 },
  moreBtn: { alignSelf: 'center', padding: 12 },
  moreText: { color: colors.link, fontWeight: '600' },
  safety: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 24 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, borderWidth: 1, borderColor: colors.border, gap: 8 },
  sheetTitle: { color: colors.heading, fontSize: 20, fontWeight: '700', lineHeight: 26 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, marginTop: 8, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  cancel: { color: colors.muted, fontSize: 15 },
});
