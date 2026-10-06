import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { LoadError, friendlyError } from '@/components/LoadError';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MAX_GROUP_SIZE, createGroup } from '@/lib/groups';
import { Connection, myConnections } from '@/lib/neighbors';

export default function NewGroupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [people, setPeople] = useState<Connection[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      myConnections()
        .then(rows => { setPeople(rows.filter(r => r.status === 'accepted')); setError(''); })
        .catch(e => setError(friendlyError(e)))
        .finally(() => setLoading(false));
    }, []),
  );

  const toggle = (id: string) =>
    setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : p.length >= MAX_GROUP_SIZE - 1 ? p : [...p, id]));

  const create = async () => {
    setSaving(true);
    try {
      const id = await createGroup(name, picked);
      router.replace({ pathname: '/group', params: { id, name: name.trim() } });
    } catch (e) {
      Alert.alert('Could not create the group', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>← Back</Text></Pressable>
        <ThemedText style={styles.title}>New group</ThemedText>
        <Text style={styles.subtitle}>Up to {MAX_GROUP_SIZE} parents, including you. You can only invite parents you are connected with, and each has to accept.</Text>

        <Text style={styles.label}>Group name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Annex playgroup" placeholderTextColor="#A4CDD3" maxLength={40} />

        <Text style={styles.label}>Invite ({picked.length} chosen)</Text>
        {error ? <LoadError message={error} /> : null}
        {!loading && !error && people.length === 0 ? (
          <Text style={styles.muted}>You have no connections yet. Connect with parents near you first, then start a group.</Text>
        ) : null}
        {people.map(p => {
          const on = picked.includes(p.other_id);
          return (
            <Pressable key={p.id} style={[styles.person, on && styles.personOn]} onPress={() => toggle(p.other_id)}>
              <Avatar name={p.name} url={p.avatar_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.muted} numberOfLines={1}>{[p.area, p.city].filter(Boolean).join(', ')}</Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
            </Pressable>
          );
        })}

        <Pressable style={[styles.primary, (!name.trim() || picked.length === 0 || saving) && { opacity: 0.5 }]} onPress={create} disabled={!name.trim() || picked.length === 0 || saving}>
          <Text style={styles.primaryText}>{saving ? 'Creating...' : 'Create group and send invitations'}</Text>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09282eff' },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: '#A4CDD3', marginBottom: 12, fontSize: 14 },
  title: { fontSize: 28, color: '#FED8FE', fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#A4CDD3', marginBottom: 8, lineHeight: 20 },
  label: { color: '#A4CDD3', fontSize: 13, marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 10, padding: 12, color: '#E8FBFF' },
  muted: { color: '#A4CDD3', fontSize: 12, lineHeight: 18 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#2F9BA8', marginBottom: 8 },
  personOn: { borderColor: '#FED8FE' },
  name: { color: '#E8FBFF', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#2F9BA8', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#FED8FE', borderColor: '#FED8FE' },
  tick: { color: '#09282eff', fontWeight: '700' },
  primary: { backgroundColor: '#FED8FE', borderRadius: 12, padding: 14, marginTop: 20 },
  primaryText: { color: '#09282eff', fontWeight: '700', textAlign: 'center' },
});
