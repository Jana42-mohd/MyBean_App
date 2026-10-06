import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ALL_BABIES, BabyPicker } from '@/components/BabyPicker';
import { EditEntry, EditableEntry } from '@/components/EditEntry';
import { MilestonePhoto } from '@/components/MilestonePhoto';
import { NO_PHOTO_CHANGE, PhotoChoice, PhotoField } from '@/components/PhotoField';
import { LoadError, friendlyError } from '@/components/LoadError';
import { useLiveRefresh } from '@/hooks/use-live';
import { Baby, babyNames, bornBabies, fetchBabies, formatDateInput, isValidDate, todayStr } from '@/lib/babies';
import { ageAtLabel } from '@/lib/growth';
import { logEntry } from '@/lib/logActions';
import { LogRow, deleteLog, fetchLogs } from '@/lib/logs';
import { photoUrls, uploadPhoto } from '@/lib/photos';
import { Palette, useStyles, useTheme } from '@/lib/theme';

const SUGGESTIONS = [
  'First smile', 'Held head up', 'Rolled over', 'Laughed', 'Sat up', 'First solid food',
  'First tooth', 'Crawled', 'Pulled to stand', 'First word', 'First steps', 'Slept through the night',
];

export default function MilestonesScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [filter, setFilter] = useState(ALL_BABIES);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditableEntry | null>(null);

  // add sheet
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(ALL_BABIES);
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<PhotoChoice>(NO_PHOTO_CHANGE);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setError('');
      setBabies(bornBabies(await fetchBabies()));
      const list = await fetchLogs('milestone', 500);
      setRows(list);
      const paths = list.map(r => r.data?.photo).filter(Boolean) as string[];
      if (paths.length) photoUrls(paths).then(setUrls);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useLiveRefresh(load);

  const visible = rows
    .filter(r => filter === ALL_BABIES || r.baby_id === filter)
    .sort((a, b) => (a.data.date < b.data.date ? 1 : -1));

  const birthOf = (babyId: string | null) => babies.find(b => b.id === babyId)?.birth_date ?? null;

  const openAdd = () => {
    setTarget(babies.length === 1 ? babies[0].id : filter);
    setText('');
    setDate(todayStr());
    setNotes('');
    setPhoto(NO_PHOTO_CHANGE);
    setOpen(true);
  };

  const save = async () => {
    const who = target === ALL_BABIES ? babies : babies.filter(b => b.id === target);
    if (!text.trim()) return Alert.alert('What happened?', 'Describe the milestone, or tap one of the suggestions.');
    if (!isValidDate(date)) return Alert.alert('Date', 'Enter the date as a real date, like 2025-03-14.');
    if (date > todayStr()) return Alert.alert('Date', 'That date is in the future.');
    if (who.length === 0) return;
    setSaving(true);
    try {
      let photoPath: string | undefined;
      if (photo.local) {
        try {
          photoPath = await uploadPhoto(photo.local); // one file, shared by all the babies this milestone is for
        } catch (e) {
          const saveWithout = await new Promise<boolean>(resolve =>
            Alert.alert('The photo did not upload', `${friendlyError(e)}\n\nSave the milestone without it?`, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Save without photo', onPress: () => resolve(true) },
            ]),
          );
          if (!saveWithout) return;
        }
      }
      await logEntry('milestone', { milestone: text.trim(), date, notes: notes.trim() || undefined, photo: photoPath }, who, new Date(`${date}T12:00:00`).toISOString());
      setOpen(false);
      load();
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (r: LogRow) =>
    Alert.alert('Delete this milestone?', 'This removes it for everyone in your household.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLog(r.id, r.data?.photo);
            load();
          } catch (e) {
            Alert.alert('Could not delete', friendlyError(e));
          }
        },
      },
    ]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.navigate('/(tabs)/home')} hitSlop={10}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
        <ThemedText style={styles.title}>Milestones</ThemedText>
        <Text style={styles.subtitle}>Rolling, smiling, first words: the moments worth remembering</Text>

        {error ? <LoadError message={error} onRetry={load} /> : null}
        {!loading && babies.length === 0 && !error ? <LoadError message="Milestones start once a baby has been born." /> : null}

        <BabyPicker babies={babies} value={filter} onChange={setFilter} />

        {babies.length > 0 ? (
          <Pressable style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addText}>+ Add a milestone</Text>
          </Pressable>
        ) : null}

        {visible.length === 0 && babies.length > 0 && !error ? (
          <Text style={styles.empty}>No milestones yet. Add the first one!</Text>
        ) : null}

        {visible.map(r => {
          const birth = birthOf(r.baby_id);
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{r.data.milestone}</Text>
                <Text style={styles.cardMeta}>
                  {r.baby ? `${r.baby} · ` : ''}{r.data.date}{birth ? ` · ${ageAtLabel(birth, r.data.date)}` : ''}
                </Text>
                {r.data.notes ? <Text style={styles.cardNotes}>{r.data.notes}</Text> : null}
                {r.data.photo ? <MilestonePhoto path={r.data.photo} url={urls[r.data.photo]} /> : null}
              </View>
              <Pressable onPress={() => setEditing({ id: r.id, type: 'milestone', data: r.data, baby: r.baby })} hitSlop={8}>
                <Text style={styles.action}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(r)} hitSlop={8}>
                <Text style={[styles.action, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New milestone</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <BabyPicker babies={babies} value={target} onChange={setTarget} allLabel="All babies" />
              <View style={styles.sugRow}>
                {SUGGESTIONS.map(sg => (
                  <Pressable key={sg} onPress={() => setText(sg)} style={[styles.sug, text === sg && styles.sugActive]}>
                    <Text style={[styles.sugText, text === sg && { color: colors.onAccent }]}>{sg}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>What happened?</Text>
              <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="e.g. Rolled over by herself" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={t => setDate(formatDateInput(t))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={10}
              />
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput style={[styles.input, { minHeight: 56 }]} value={notes} onChangeText={setNotes} multiline placeholder="Anything you want to remember" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Photo (optional)</Text>
              <PhotoField value={photo} onChange={setPhoto} />
              <View style={styles.actions}>
                <Pressable onPress={() => setOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable>
                <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? 'Saving...' : `Save${target === ALL_BABIES && babies.length > 1 ? ` for ${babyNames(babies)}` : ''}`}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <EditEntry entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: colors.muted, marginBottom: 12, fontSize: 14 },
  title: { fontSize: 28, color: colors.heading, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 16, lineHeight: 20 },
  addBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, marginBottom: 18 },
  addText: { color: colors.onAccent, fontWeight: '700', textAlign: 'center' },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.highlight },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  cardMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  cardNotes: { color: colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 },
  action: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, borderWidth: 1, borderColor: colors.border },
  sheetTitle: { color: colors.heading, fontSize: 20, fontWeight: '700', lineHeight: 26, marginBottom: 12 },
  sugRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  sug: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  sugActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  sugText: { color: colors.text, fontSize: 12 },
  label: { color: colors.muted, fontSize: 13, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  cancel: { color: colors.muted, fontSize: 15 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  saveText: { color: colors.onAccent, fontWeight: '700' },
});
