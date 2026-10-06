import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { LoadError, friendlyError } from '@/components/LoadError';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Group, myGroups, respondGroupInvite } from '@/lib/groups';
import { Connection, myConnections, removeConnection, respondToRequest } from '@/lib/neighbors';
import { timeAgo } from '@/lib/time';
import { Palette, useStyles } from '@/lib/theme';

export default function ConnectionsScreen() {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError('');
      const [c, g] = await Promise.all([myConnections(), myGroups()]);
      setRows(c);
      setGroups(g);
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

  const groupInvites = groups.filter(g => g.status === 'invited');
  const myGroupList = groups.filter(g => g.status === 'member');
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
        {!loading && !error && rows.length === 0 && groups.length === 0 ? <Text style={styles.empty}>No connections yet. Find parents near you and say hello.</Text> : null}
        <Pressable style={styles.findBtn} onPress={() => router.push('/neighbors')}><Text style={styles.findText}>Find parents near me</Text></Pressable>

        {groupInvites.length > 0 ? <Text style={styles.heading}>Group invitations</Text> : null}
        {groupInvites.map(g => (
          <View key={g.id} style={styles.card}>
            <Text style={styles.name}>{g.name}</Text>
            <Text style={styles.muted}>{g.invited_by_name ?? 'A parent'} invited you · {g.member_count} {g.member_count === 1 ? 'person' : 'people'} so far</Text>
            <View style={styles.row}>
              <Pressable style={styles.accept} onPress={() => run(() => respondGroupInvite(g.id, true))}><Text style={styles.acceptText}>Join</Text></Pressable>
              <Pressable style={styles.decline} onPress={() => run(() => respondGroupInvite(g.id, false))}><Text style={styles.declineText}>Decline</Text></Pressable>
            </View>
          </View>
        ))}

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

        <Text style={styles.heading}>Groups</Text>
        {myGroupList.map(g => (
          <Pressable key={g.id} style={[styles.card, styles.row]} onPress={() => router.push({ pathname: '/group', params: { id: g.id, name: g.name } })}>
            <View style={styles.groupIcon}><Text style={styles.groupIconText}>{g.name.trim()[0]?.toUpperCase() ?? 'G'}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
              <Text style={styles.muted} numberOfLines={1}>{g.member_count} {g.member_count === 1 ? 'person' : 'people'}{g.last_message_at ? ` · ${timeAgo(g.last_message_at)}` : ''}{g.muted ? ' · muted' : ''}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}
        {myGroupList.length === 0 ? <Text style={styles.muted}>Chat with several parents at once, like a playgroup. Everyone in a group is someone you are connected with.</Text> : null}
        <Pressable style={[styles.findBtn, { marginTop: 10 }]} onPress={() => router.push('/group-new')}><Text style={styles.findText}>+ New group</Text></Pressable>

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

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: colors.muted, marginBottom: 12, fontSize: 14 },
  title: { fontSize: 28, color: colors.heading, fontWeight: '700', marginBottom: 12 },
  empty: { color: colors.muted, lineHeight: 20, marginBottom: 12 },
  findBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  findText: { color: colors.link, fontWeight: '600', textAlign: 'center' },
  heading: { color: colors.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 12 },
  intro: { color: colors.text, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  accept: { backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 18 },
  acceptText: { color: colors.onAccent, fontWeight: '700' },
  decline: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 18 },
  declineText: { color: colors.text },
  cancel: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  groupIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  groupIconText: { color: colors.onAccent, fontWeight: '700', fontSize: 18 },
  chev: { color: colors.muted, fontSize: 24 },
});
