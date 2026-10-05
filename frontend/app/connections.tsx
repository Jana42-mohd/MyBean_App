import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { LoadError, friendlyError } from '@/components/LoadError';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Connection, myConnections, removeConnection, respondToRequest } from '@/lib/neighbors';
import { timeAgo } from '@/lib/time';

export default function ConnectionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<Connection[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError('');
      setRows(await myConnections());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', friendlyError(e));
    }
    load();
  };

  const incoming = rows.filter(r => r.status === 'pending' && r.direction === 'incoming');
  const outgoing = rows.filter(r => r.status === 'pending' && r.direction === 'outgoing');
  const connected = rows.filter(r => r.status === 'accepted');

  const openChat = (r: Connection) => router.push({ pathname: '/chat', params: { id: r.id, name: r.name } });

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>← Back</Text></Pressable>
        <ThemedText style={styles.title}>My connections</ThemedText>
        {error ? <LoadError message={error} onRetry={load} /> : null}
        {!loading && !error && rows.length === 0 ? <Text style={styles.empty}>No connections yet. Find parents near you and say hello.</Text> : null}
        <Pressable style={styles.findBtn} onPress={() => router.push('/neighbors')}><Text style={styles.findText}>Find parents near me</Text></Pressable>

        {incoming.length > 0 ? <Text style={styles.heading}>Requests for you</Text> : null}
        {incoming.map(r => (
          <View key={r.id} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={r.name} url={r.avatar_url} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.muted}>{timeAgo(r.created_at)}</Text>
              </View>
            </View>
            {r.intro ? <Text style={styles.intro}>"{r.intro}"</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.accept} onPress={() => run(() => respondToRequest(r.id, true))}><Text style={styles.acceptText}>Accept</Text></Pressable>
              <Pressable style={styles.decline} onPress={() => run(() => respondToRequest(r.id, false))}><Text style={styles.declineText}>Decline</Text></Pressable>
            </View>
          </View>
        ))}

        {connected.length > 0 ? <Text style={styles.heading}>Connected</Text> : null}
        {connected.map(r => (
          <Pressable key={r.id} style={[styles.card, styles.row]} onPress={() => openChat(r)}>
            <Avatar name={r.name} url={r.avatar_url} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.muted} numberOfLines={1}>{[r.area, r.city].filter(Boolean).join(', ')}{r.last_message_at ? ` · ${timeAgo(r.last_message_at)}` : ''}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}

        {outgoing.length > 0 ? <Text style={styles.heading}>Waiting for an answer</Text> : null}
        {outgoing.map(r => (
          <View key={r.id} style={[styles.card, styles.row]}>
            <Avatar name={r.name} url={r.avatar_url} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.muted}>Sent {timeAgo(r.created_at)}</Text>
            </View>
            <Pressable onPress={() => run(() => removeConnection(r.id))} hitSlop={8}><Text style={styles.cancel}>Cancel</Text></Pressable>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09282eff' },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: '#A4CDD3', marginBottom: 12, fontSize: 14 },
  title: { fontSize: 28, color: '#FED8FE', fontWeight: '700', marginBottom: 12 },
  empty: { color: '#A4CDD3', lineHeight: 20, marginBottom: 12 },
  findBtn: { borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 10, padding: 12, marginBottom: 8 },
  findText: { color: '#FDFECC', fontWeight: '600', textAlign: 'center' },
  heading: { color: '#A4CDD3', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2F9BA8', marginBottom: 10, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: '#E8FBFF', fontSize: 16, fontWeight: '700', lineHeight: 22 },
  muted: { color: '#A4CDD3', fontSize: 12 },
  intro: { color: '#E8FBFF', fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  accept: { backgroundColor: '#FED8FE', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 18 },
  acceptText: { color: '#09282eff', fontWeight: '700' },
  decline: { borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 18 },
  declineText: { color: '#E8FBFF' },
  cancel: { color: '#ff9db1', fontSize: 13, fontWeight: '600' },
  chev: { color: '#A4CDD3', fontSize: 24 },
});
