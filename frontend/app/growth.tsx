import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BabyPicker } from '@/components/BabyPicker';
import { EditEntry, EditableEntry } from '@/components/EditEntry';
import { GrowthChart, GrowthPoint } from '@/components/GrowthChart';
import { GrowthForm } from '@/components/GrowthForm';
import { LoadError, friendlyError } from '@/components/LoadError';
import { useLiveRefresh } from '@/hooks/use-live';
import { Baby, bornBabies, fetchBabies } from '@/lib/babies';
import { GrowthData, GrowthMetric, formatLength, formatWeight, ordinal, percentile, sexFromGender, ageMonths } from '@/lib/growth';
import { logEntry } from '@/lib/logActions';
import { LogRow, deleteLog, fetchLogs } from '@/lib/logs';
import { useUnits } from '@/lib/units';
import { Palette, useStyles, useTheme } from '@/lib/theme';


const METRICS: { key: GrowthMetric; label: string; field: keyof GrowthData }[] = [
  { key: 'wfa', label: 'Weight', field: 'weightKg' },
  { key: 'lhfa', label: 'Length', field: 'lengthCm' },
  { key: 'hcfa', label: 'Head', field: 'headCm' },
];

export default function GrowthScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [units, setUnits] = useUnits();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babyId, setBabyId] = useState('');
  const [rows, setRows] = useState<LogRow[]>([]);
  const [metric, setMetric] = useState<GrowthMetric>('wfa');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EditableEntry | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError('');
      const born = bornBabies(await fetchBabies());
      setBabies(born);
      setBabyId(prev => (born.some(b => b.id === prev) ? prev : born[0]?.id ?? ''));
      setRows(await fetchLogs('growth', 500));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useLiveRefresh(load);

  const baby = babies.find(b => b.id === babyId);
  const sex = sexFromGender(baby?.gender);
  const mine = useMemo(
    () => rows.filter(r => r.baby_id === babyId).sort((a, b) => (a.data.date < b.data.date ? -1 : 1)),
    [rows, babyId]
  );

  const cfg = METRICS.find(m => m.key === metric)!;
  const imperial = units === 'imperial';
  const toDisplay = useCallback(
    (v: number) => (metric === 'wfa' ? (imperial ? v * 2.20462262 : v) : imperial ? v / 2.54 : v),
    [metric, imperial]
  );
  const fmt = useCallback((v: number) => (metric === 'wfa' ? formatWeight(v, units) : formatLength(v, units)), [metric, units]);

  const points: GrowthPoint[] = useMemo(() => {
    if (!baby?.birth_date) return [];
    return mine
      .filter(r => r.data[cfg.field] !== undefined)
      .map(r => {
        const months = Math.max(0, ageMonths(baby.birth_date!, r.data.date));
        const value = r.data[cfg.field] as number;
        return {
          key: r.id,
          months,
          value,
          date: r.data.date,
          percentile: sex ? ordinal(percentile(metric, sex, months, value)) : undefined,
        };
      });
  }, [mine, baby, cfg.field, metric, sex]);

  const latest = points[points.length - 1];

  const add = async (data: GrowthData) => {
    if (!baby) return;
    try {
      await logEntry('growth', data, [baby], new Date(`${data.date}T12:00:00`).toISOString());
      setAddOpen(false);
      load();
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
    }
  };

  const confirmDelete = (r: LogRow) =>
    Alert.alert('Delete this measurement?', 'This removes it for everyone in your household.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLog(r.id);
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
        <ThemedText style={styles.title}>Growth</ThemedText>
        <Text style={styles.subtitle}>Weight, length and head size compared with WHO growth standards</Text>

        {error ? <LoadError message={error} onRetry={load} /> : null}
        {!loading && babies.length === 0 && !error ? <LoadError message="Growth tracking starts once a baby has been born." /> : null}

        <BabyPicker babies={babies} value={babyId} onChange={setBabyId} showAll={false} />

        {baby ? (
          <>
            <View style={styles.topRow}>
              <View style={styles.chips}>
                {METRICS.map(m => (
                  <Pressable key={m.key} onPress={() => setMetric(m.key)} style={[styles.chip, metric === m.key && styles.chipActive]}>
                    <Text style={styles.chipText}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setUnits(imperial ? 'metric' : 'imperial')} hitSlop={8}>
                <Text style={styles.unitToggle}>{imperial ? 'lb / in' : 'kg / cm'} ⇄</Text>
              </Pressable>
            </View>

            {!baby.birth_date ? (
              <LoadError message={`Add ${baby.name}'s birth date (Settings → Babies → Edit) to see growth charts.`} />
            ) : (
              <>
                {latest ? (
                  <View style={styles.summary}>
                    <Text style={styles.summaryValue}>{fmt(latest.value)}</Text>
                    <Text style={styles.summaryMeta}>
                      {latest.percentile ? `${latest.percentile} percentile` : 'latest'} · {latest.date}
                    </Text>
                  </View>
                ) : null}

                <GrowthChart
                  title={`${baby.name}: ${cfg.label.toLowerCase()} for age`}
                  metric={metric}
                  sex={sex}
                  points={points}
                  toDisplay={toDisplay}
                  axisUnit={metric === 'wfa' ? (imperial ? 'lb' : 'kg') : imperial ? 'in' : 'cm'}
                  fmtValue={fmt}
                  color={colors.wet}
                />

                {!sex ? (
                  <Text style={styles.note}>Percentile lines need a boy or girl in {baby.name}&apos;s details. Showing measurements only.</Text>
                ) : null}
                {baby.gestational_age === 'premature' ? (
                  <Text style={styles.note}>
                    {baby.name} was born early. Doctors usually judge growth by corrected age (age counted from the due date), so ask yours how to read these percentiles.
                  </Text>
                ) : null}
              </>
            )}

            <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
              <Text style={styles.addText}>+ Add a measurement</Text>
            </Pressable>

            {mine.length > 0 ? (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.listTitle}>All measurements</Text>
                {[...mine].reverse().map(r => (
                  <View key={r.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowDate}>{r.data.date}{r.author ? ` · ${r.author}` : ''}</Text>
                      <Text style={styles.rowVals}>
                        {[
                          r.data.weightKg !== undefined ? formatWeight(r.data.weightKg, units) : null,
                          r.data.lengthCm !== undefined ? formatLength(r.data.lengthCm, units) : null,
                          r.data.headCm !== undefined ? `head ${formatLength(r.data.headCm, units)}` : null,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                      {r.data.notes ? <Text style={styles.rowNotes}>{r.data.notes}</Text> : null}
                    </View>
                    <Pressable onPress={() => setEditing({ id: r.id, type: 'growth', data: r.data, baby: r.baby })} hitSlop={8}>
                      <Text style={styles.action}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(r)} hitSlop={8}>
                      <Text style={[styles.action, { color: colors.danger }]}>Delete</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.disclaimer}>
              Percentiles use the WHO Child Growth Standards (0 to 5 years). They show how a measurement compares with many healthy babies. They are not a diagnosis, and every baby grows at their own pace. Talk to your doctor about any concern.
            </Text>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add a measurement{baby ? ` for ${baby.name}` : ''}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <GrowthForm units={units} birthDate={baby?.birth_date} submitLabel="Save" onCancel={() => setAddOpen(false)} onSubmit={add} />
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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.tint, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  unitToggle: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  summary: { marginBottom: 10 },
  summaryValue: { color: colors.text, fontSize: 30, fontWeight: '700', lineHeight: 38 },
  summaryMeta: { color: colors.muted, fontSize: 13 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  addBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14 },
  addText: { color: colors.onAccent, fontWeight: '700', textAlign: 'center' },
  listTitle: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  rowDate: { color: colors.muted, fontSize: 12 },
  rowVals: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  rowNotes: { color: colors.muted, fontSize: 12, marginTop: 2 },
  action: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 20 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, borderWidth: 1, borderColor: colors.border },
  sheetTitle: { color: colors.heading, fontSize: 20, fontWeight: '700', lineHeight: 26, marginBottom: 12 },
});
