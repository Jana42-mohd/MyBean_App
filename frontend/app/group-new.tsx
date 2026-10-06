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
import { Palette, useStyles, useTheme } from '@/lib/theme';

export default function NewGroupScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
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
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Annex playgroup" placeholderTextColor={colors.muted} maxLength={40} />

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

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: colors.muted, marginBottom: 12, fontSize: 14 },
  title: { fontSize: 28, color: colors.heading, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 8, lineHeight: 20 },
  label: { color: colors.muted, fontSize: 13, marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  personOn: { borderColor: colors.accent },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: colors.onAccent, fontWeight: '700' },
  primary: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, marginTop: 20 },
  primaryText: { color: colors.onAccent, fontWeight: '700', textAlign: 'center' },
});
