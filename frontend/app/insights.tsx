import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BabyPicker } from '@/components/BabyPicker';
import { BarChart } from '@/components/BarChart';
import { LoadError, friendlyError } from '@/components/LoadError';
import { Baby, bornBabies, fetchBabies } from '@/lib/babies';
import { LogRow, fetchLogs } from '@/lib/logs';
import { buildDays, computeStats, summaryText } from '@/lib/insights';
import { formatDuration, timeAgo, toDate } from '@/lib/time';

// Chart colors validated (dataviz validator) on the card surface #0f3a41 in dark mode:
// distinct for color-blind viewers and >= 3:1 contrast.
const SLEEP = '#9085e9';
const FEED = '#199e70';
const WET = '#3987e5';
const DIRTY = '#d95926';

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babyId, setBabyId] = useState('');
  const [days, setDays] = useState<7 | 30>(7);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError('');
      const born = bornBabies(await fetchBabies());
      setBabies(born);
      setBabyId(prev => (born.some(b => b.id === prev) ? prev : born[0]?.id ?? ''));
      const since = new Date();
      since.setDate(since.getDate() - 30);
      since.setHours(0, 0, 0, 0);
      setRows(await fetchLogs(['nap', 'feeding', 'diaper'], 3000, since.toISOString()));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const baby = babies.find(b => b.id === babyId);
  const mine = useMemo(() => rows.filter(r => r.baby_id === babyId), [rows, babyId]);
  const buckets = useMemo(() => buildDays(mine, days), [mine, days]);
  const stats = useMemo(() => {
    const from = buckets[0].date.getTime();
    return computeStats(
      mine.filter(r => (r.type === 'nap' ? toDate(r.data?.end).getTime() : new Date(r.logged_at).getTime()) >= from),
      buckets
    );
  }, [mine, buckets]);

  const labelFor = (i: number, label: string, key: string) => (days === 7 ? label : i % 5 === 0 ? key.slice(8) : '');
  const sleepData = buckets.map((b, i) => ({
    key: b.key,
    label: labelFor(i, b.label, b.key),
    segments: [{ value: b.sleepMin / 60, color: SLEEP, name: 'Sleep' }],
  }));
  const feedData = buckets.map((b, i) => ({
    key: b.key,
    label: labelFor(i, b.label, b.key),
    segments: [{ value: b.feedings, color: FEED, name: 'Feedings' }],
  }));
  const diaperData = buckets.map((b, i) => ({
    key: b.key,
    label: labelFor(i, b.label, b.key),
    segments: [
      { value: b.wet, color: WET, name: 'Wet' },
      { value: b.dirty, color: DIRTY, name: 'Dirty' },
    ],
  }));

  const share = () => {
    if (baby) Share.share({ message: summaryText(baby.name, days, buckets, stats) });
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.navigate('/(tabs)/home')} hitSlop={10}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
        <ThemedText style={styles.title}>Insights</ThemedText>
        <Text style={styles.subtitle}>Patterns in sleep, feeding and diapers</Text>

        {error ? <LoadError message={error} onRetry={load} /> : null}
        {!loading && babies.length === 0 && !error ? (
          <LoadError message="Insights appear once a baby has been born and you've logged a few things." />
        ) : null}

        <BabyPicker babies={babies} value={babyId} onChange={setBabyId} showAll={false} />

        {baby ? (
          <>
            <View style={styles.rangeRow}>
              {([7, 30] as const).map(n => (
                <Pressable key={n} onPress={() => setDays(n)} style={[styles.chip, days === n && styles.chipActive]}>
                  <Text style={[styles.chipText, days === n && styles.chipTextActive]}>{n} days</Text>
                </Pressable>
              ))}
            </View>

            {stats.daysWithData === 0 ? (
              <View style={styles.card}>
                <Text style={styles.body}>No logs for {baby.name} in this period yet. Log a feeding, nap or diaper and come back.</Text>
              </View>
            ) : (
              <>
                <View style={styles.tiles}>
                  <View style={styles.tile}>
                    <Text style={styles.tileLabel}>Sleep / day</Text>
                    <Text style={styles.tileValue}>{formatDuration(stats.avgSleepMin)}</Text>
                  </View>
                  <View style={styles.tile}>
                    <Text style={styles.tileLabel}>Feedings / day</Text>
                    <Text style={styles.tileValue}>{stats.avgFeedings.toFixed(1)}</Text>
                  </View>
                  <View style={styles.tile}>
                    <Text style={styles.tileLabel}>Feeds every</Text>
                    <Text style={styles.tileValue}>{stats.avgFeedGapHours ? `${stats.avgFeedGapHours.toFixed(1)}h` : 'n/a'}</Text>
                  </View>
                </View>
                {stats.lastFeedingAt ? <Text style={styles.note}>Last feeding {timeAgo(stats.lastFeedingAt)}. Longest sleep {formatDuration(stats.longestSleepMin)}.</Text> : null}

                <BarChart title="Sleep" unit="hours per day" data={sleepData} format={v => formatDuration(v * 60)} />
                <BarChart title="Feedings" unit="per day" data={feedData} format={v => String(v)} />
                <BarChart title="Diapers" unit="per day" data={diaperData} format={v => String(v)} legend />

                <Pressable style={styles.shareBtn} onPress={share}>
                  <Text style={styles.shareText}>Share summary (for your doctor)</Text>
                </Pressable>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09282eff' },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: '#A4CDD3', marginBottom: 12, fontSize: 14 },
  title: { fontSize: 28, color: '#FED8FE', fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#A4CDD3', marginBottom: 16 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#2F9BA8' },
  chipActive: { backgroundColor: '#2F9BA8', borderColor: '#FED8FE' },
  chipText: { color: '#E8FBFF', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#E8FBFF' },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tile: { flex: 1, backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2F9BA8' },
  tileLabel: { color: '#A4CDD3', fontSize: 11, marginBottom: 4 },
  tileValue: { color: '#E8FBFF', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  note: { color: '#A4CDD3', fontSize: 12, marginBottom: 16, lineHeight: 18 },
  card: { backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2F9BA8', marginBottom: 16 },
  body: { color: '#E8FBFF', fontSize: 14, lineHeight: 21 },
  shareBtn: { backgroundColor: '#FED8FE', borderRadius: 10, padding: 14 },
  shareText: { color: '#09282eff', fontWeight: '700', textAlign: 'center' },
});
